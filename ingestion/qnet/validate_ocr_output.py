from __future__ import annotations

import argparse
import json
from pathlib import Path

import pymupdf

from ocr_questions import iter_question_sources, validated_pdf_paths


def validate_ocr_output(
        ocr_output: Path, manifest: Path, index: Path, data_root: Path,
        validation_report: Path) -> dict[str, object]:
    verified_paths = validated_pdf_paths(validation_report)
    expected = {
        (source.pdf_path.relative_to(data_root).as_posix(), page, column)
        for source in iter_question_sources(manifest, index, data_root, validated_pdf_paths=verified_paths)
        for page in range(1, _page_count(source.pdf_path) + 1)
        for column in ("LEFT", "RIGHT")
    }
    seen: set[tuple[str, int, str]] = set()
    issues: list[dict[str, object]] = []
    for line_no, line in enumerate(ocr_output.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
            key = (str(record["sourcePdfPath"]), int(record["page"]), str(record["column"]))
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            issues.append({"line": line_no, "code": "MALFORMED_RECORD", "detail": str(error)})
            continue
        if key not in expected:
            issues.append({"line": line_no, "code": "UNEXPECTED_PAGE_COLUMN", "key": key})
        elif key in seen:
            issues.append({"line": line_no, "code": "DUPLICATE_PAGE_COLUMN", "key": key})
        elif not str(record.get("ocrText", "")).strip():
            issues.append({"line": line_no, "code": "EMPTY_OCR_TEXT", "key": key})
        seen.add(key)
    for key in sorted(expected - seen):
        issues.append({"code": "MISSING_PAGE_COLUMN", "key": key})
    return {"expectedRecords": len(expected), "actualRecords": len(seen), "issues": issues}


def _page_count(pdf_path: Path) -> int:
    with pymupdf.open(pdf_path) as document:
        return len(document)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Q-Net OCR page and column completeness")
    parser.add_argument("--input", type=Path, default=Path("data/processed/qnet-question-ocr.jsonl"))
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/qnet-manifest.json"))
    parser.add_argument("--index", type=Path, default=Path(__file__).with_name("source_index.json"))
    parser.add_argument("--data-root", type=Path, default=Path("data"))
    parser.add_argument("--validation-report", type=Path, default=Path("data/processed/qnet-pdf-validation.json"))
    parser.add_argument("--output", type=Path, default=Path("data/processed/qnet-ocr-validation.json"))
    args = parser.parse_args()

    result = validate_ocr_output(args.input, args.manifest, args.index, args.data_root, args.validation_report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Validated {result['actualRecords']}/{result['expectedRecords']} OCR page-column record(s)")
    if result["issues"]:
        print(f"Found {len(result['issues'])} OCR validation issue(s); see {args.output}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())