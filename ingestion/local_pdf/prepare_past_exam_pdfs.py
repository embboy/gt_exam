from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

import pymupdf


FILE_PATTERN = re.compile(r"(?P<year>20\d{2})년\s*제(?P<exam_no>\d+)회.*?(?P<stage>[12])차[_\s]?(?P<session>\d)교시(?:\s*(?P<form>[AB])형)?", re.IGNORECASE)


@dataclass(frozen=True)
class PastExamPdf:
    year: int
    exam_no: int
    stage: int
    session: int
    form: str | None
    file_name: str
    relative_path: str
    sha256: str
    page_count: int
    page_text: list[dict[str, object]]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_file_name(path: Path) -> tuple[int, int, int, int, str | None]:
    matched = FILE_PATTERN.search(path.stem)
    if not matched:
        raise ValueError(f"Cannot identify year, stage, or session from {path.name}")
    return (
        int(matched.group("year")),
        int(matched.group("exam_no")),
        int(matched.group("stage")),
        int(matched.group("session")),
        matched.group("form") and matched.group("form").upper(),
    )


def canonical_pdfs(source_directory: Path) -> list[Path]:
    candidates: dict[tuple[int, int, int, int], Path] = {}
    for pdf in sorted(source_directory.glob("*.pdf")):
        year, exam_no, stage, session, form = parse_file_name(pdf)
        key = (year, exam_no, stage, session)
        selected = candidates.get(key)
        if selected is None or form == "A":
            candidates[key] = pdf
    return [candidates[key] for key in sorted(candidates)]


def prepare_pdfs(source_directory: Path, raw_directory: Path, manifest_path: Path) -> list[PastExamPdf]:
    records: list[PastExamPdf] = []
    for pdf in canonical_pdfs(source_directory):
        year, exam_no, stage, session, form = parse_file_name(pdf)
        destination = raw_directory / pdf.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or sha256_file(destination) != sha256_file(pdf):
            shutil.copy2(pdf, destination)
        page_text = _validate_and_describe_pdf(destination)
        records.append(PastExamPdf(
            year=year,
            exam_no=exam_no,
            stage=stage,
            session=session,
            form=form,
            file_name=pdf.name,
            relative_path=destination.as_posix(),
            sha256=sha256_file(destination),
            page_count=len(page_text),
            page_text=page_text,
        ))
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps([asdict(record) for record in records], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return records


def _validate_and_describe_pdf(pdf: Path) -> list[dict[str, object]]:
    with pdf.open("rb") as source:
        if source.read(5) != b"%PDF-":
            raise ValueError(f"Invalid PDF header: {pdf.name}")
    try:
        with pymupdf.open(pdf) as document:
            if not document.is_pdf or not len(document):
                raise ValueError(f"Unreadable PDF: {pdf.name}")
            return [
                {"page": page_number, "nativeTextChars": len(page.get_text("text").strip()), "ocrRequired": len(page.get_text("text").strip()) < 400}
                for page_number, page in enumerate(document, start=1)
            ]
    except pymupdf.FileDataError as error:
        raise ValueError(f"Unreadable PDF: {pdf.name}") from error


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare user-provided past-exam PDFs as the only local source")
    parser.add_argument("--source", type=Path, default=Path(r"C:\Users\venge\Downloads\기출문제"))
    parser.add_argument("--raw-directory", type=Path, default=Path("data/raw/local-pdf"))
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/local-pdf-manifest.json"))
    args = parser.parse_args()

    records = prepare_pdfs(args.source, args.raw_directory, args.manifest)
    print(f"Prepared {len(records)} canonical past-exam PDF(s) from {args.source}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())