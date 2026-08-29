from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pymupdf

from archive_validation import ArchiveValidationError, extract_validated_pdfs


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_question_archives(manifest_path: Path, data_root: Path) -> dict[str, object]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validated: list[dict[str, object]] = []
    failures: list[dict[str, str]] = []

    for item in manifest:
        if item.get("kind") != "QUESTION" or Path(item["relative_path"]).suffix.lower() != ".zip":
            continue
        archive = data_root / item["relative_path"]
        try:
            if not archive.is_file():
                raise ArchiveValidationError("archive is missing")
            if sha256_file(archive) != item["sha256"]:
                raise ArchiveValidationError("archive checksum differs from manifest")
            extracted_root = archive.parent / "extracted" / archive.stem
            pdfs = extract_validated_pdfs(archive, extracted_root)
            validated.append({
                "archiveSha256": item["sha256"],
                "archivePath": item["relative_path"],
                "status": "VALID",
                "pdfs": [
                    {
                        "path": pdf.relative_to(data_root).as_posix(),
                        "pageCount": _page_count(pdf),
                    }
                    for pdf in pdfs
                ],
            })
        except (ArchiveValidationError, OSError) as error:
            failures.append({"archivePath": item["relative_path"], "reason": str(error)})

    return {"validated": validated, "failures": failures}


def _page_count(pdf_path: Path) -> int:
    with pymupdf.open(pdf_path) as document:
        return len(document)


def main() -> int:
    parser = argparse.ArgumentParser(description="Re-extract and validate Q-Net question ZIP archives")
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/qnet-manifest.json"))
    parser.add_argument("--data-root", type=Path, default=Path("data"))
    parser.add_argument("--output", type=Path, default=Path("data/processed/qnet-pdf-validation.json"))
    args = parser.parse_args()

    result = validate_question_archives(args.manifest, args.data_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Validated {len(result['validated'])} Q-Net question archive(s)")
    if result["failures"]:
        print(f"Rejected {len(result['failures'])} archive(s); see {args.output}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())