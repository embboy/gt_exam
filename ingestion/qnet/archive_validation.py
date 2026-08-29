from __future__ import annotations

import shutil
import stat
import zipfile
from pathlib import Path

import pymupdf


class ArchiveValidationError(ValueError):
    """Raised when a Q-Net archive cannot safely yield readable question PDFs."""


def decode_zip_member_name(member: zipfile.ZipInfo) -> str:
    if member.flag_bits & 0x800:
        return member.filename
    try:
        return member.filename.encode("cp437").decode("cp949")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return member.filename


def extract_validated_pdfs(archive: Path, destination: Path) -> list[Path]:
    """Atomically replace destination only after every extracted PDF is usable."""
    temporary = destination.with_name(f".{destination.name}.part")
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)

    try:
        with zipfile.ZipFile(archive) as bundle:
            corrupted_member = bundle.testzip()
            if corrupted_member:
                raise ArchiveValidationError(f"ZIP CRC validation failed: {corrupted_member}")

            pdf_members = [member for member in bundle.infolist() if not member.is_dir() and Path(decode_zip_member_name(member)).suffix.lower() == ".pdf"]
            if not pdf_members:
                raise ArchiveValidationError("ZIP does not contain a PDF question paper")

            extracted: list[Path] = []
            for member in pdf_members:
                _validate_member(member)
                relative_path = _safe_pdf_relative_path(decode_zip_member_name(member))
                target = temporary / relative_path
                target.parent.mkdir(parents=True, exist_ok=True)
                with bundle.open(member) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
                _validate_pdf(target)
                extracted.append(target)
    except (OSError, zipfile.BadZipFile) as error:
        raise ArchiveValidationError(f"Cannot validate ZIP archive {archive.name}: {error}") from error
    except Exception:
        raise

    if destination.exists():
        shutil.rmtree(destination)
    temporary.replace(destination)
    return [destination / path.relative_to(temporary) for path in extracted]


def _validate_member(member: zipfile.ZipInfo) -> None:
    if member.flag_bits & 0x1:
        raise ArchiveValidationError(f"Encrypted PDF member is not supported: {member.filename}")
    if stat.S_ISLNK(member.external_attr >> 16):
        raise ArchiveValidationError(f"Symbolic-link PDF member is not allowed: {member.filename}")
    if member.file_size == 0:
        raise ArchiveValidationError(f"Empty PDF member: {member.filename}")


def _safe_pdf_relative_path(member_name: str) -> Path:
    path = Path(member_name)
    if path.is_absolute() or ".." in path.parts or not path.name:
        raise ArchiveValidationError(f"Unsafe ZIP member path: {member_name}")
    return path


def _validate_pdf(path: Path) -> None:
    with path.open("rb") as source:
        if source.read(5) != b"%PDF-":
            raise ArchiveValidationError(f"PDF header is invalid: {path.name}")
    try:
        with pymupdf.open(path) as document:
            if not document.is_pdf or len(document) == 0:
                raise ArchiveValidationError(f"PDF has no readable pages: {path.name}")
    except pymupdf.FileDataError as error:
        raise ArchiveValidationError(f"PDF cannot be opened: {path.name}") from error