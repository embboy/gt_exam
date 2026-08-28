from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Iterator

import pymupdf

from ocr_questions import QuestionSource, _resolve_tesseract, _run_tesseract


ANSWER_DIGIT_PATTERN = re.compile(r"(?<!\d)[1-5](?!\d)")


def answer_evidence(native_text: str, ocr_text: str) -> dict[str, object]:
    """Keep OCR as review evidence; it is never an official answer key by itself."""
    native_answers = ANSWER_DIGIT_PATTERN.findall(native_text)
    ocr_answers = ANSWER_DIGIT_PATTERN.findall(ocr_text)
    native_complete = len(native_answers) >= 40
    agreement = native_answers[:40] == ocr_answers[:40] and native_complete
    return {
        "nativeText": native_text.strip(),
        "ocrText": ocr_text.strip(),
        "nativeAnswerCount": len(native_answers),
        "ocrAnswerCount": len(ocr_answers),
        "verificationStatus": "CROSS_CHECKED" if agreement else "NEEDS_REVIEW",
    }


def iter_answer_sources(
        manifest_file: Path, index_file: Path, data_root: Path,
        years: set[int] | None = None) -> Iterator[QuestionSource]:
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    exam_numbers = {
        int(record["year"]): int(record["examNo"])
        for record in json.loads(index_file.read_text(encoding="utf-8"))
    }
    for attachment in manifest:
        if attachment["kind"] != "ANSWER":
            continue
        relative_path = Path(attachment["relative_path"])
        year = int(relative_path.parts[2])
        if years and year not in years:
            continue
        pdf_path = data_root / relative_path
        yield QuestionSource(
            year=year,
            exam_no=exam_numbers[year],
            article_id=str(attachment["article_id"]),
            archive_sha256=str(attachment["sha256"]),
            archive_path=attachment["relative_path"],
            pdf_path=pdf_path,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="OCR Q-Net answer PDFs into review-required JSONL")
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/qnet-manifest.json"))
    parser.add_argument("--index", type=Path, default=Path(__file__).with_name("source_index.json"))
    parser.add_argument("--data-root", type=Path, default=Path("data"))
    parser.add_argument("--output", type=Path, default=Path("data/processed/qnet-answer-ocr.jsonl"))
    parser.add_argument("--tesseract")
    parser.add_argument("--tessdata", type=Path, default=Path("data/tools/tessdata-best"))
    parser.add_argument("--year", type=int, action="append", dest="years")
    args = parser.parse_args()

    tesseract = _resolve_tesseract(args.tesseract)
    tessdata = args.tessdata if args.tessdata.is_dir() else None
    sources = iter_answer_sources(
        args.manifest, args.index, args.data_root, set(args.years) if args.years else None)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with args.output.open("w", encoding="utf-8", newline="\n") as output:
        for source in sources:
            with pymupdf.open(source.pdf_path) as document:
                for page_index, page in enumerate(document):
                    native_text = page.get_text("text")
                    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(3, 3), alpha=False)
                    text = _run_tesseract(pixmap.tobytes("png"), tesseract, tessdata)
                    evidence = answer_evidence(native_text, text)
                    record = {
                        "recordType": "ANSWER_PAGE",
                        "year": source.year,
                        "examNo": source.exam_no,
                        "sourceArticleId": source.article_id,
                        "sourceArchiveSha256": source.archive_sha256,
                        "sourceArchivePath": source.archive_path,
                        "sourcePdfPath": source.pdf_path.as_posix(),
                        "page": page_index + 1,
                        "pdfClip": [
                            round(value, 3)
                            for value in (page.rect.x0, page.rect.y0, page.rect.x1, page.rect.y1)
                        ],
                        **evidence,
                        "ocrText": evidence["ocrText"],
                        "reviewStatus": "NEEDS_REVIEW",
                    }
                    output.write(json.dumps(record, ensure_ascii=False) + "\n")
                    output.flush()
                    count += 1
    print(f"Wrote {count} review-required answer page records to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())