from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import AbstractSet, Iterator

import pymupdf


QUESTION_NUMBER_PATTERN = re.compile(r"(?m)^\s*(\d{1,3})\s*[.．]\s+")


@dataclass(frozen=True)
class QuestionSource:
    year: int
    exam_no: int
    article_id: str
    archive_sha256: str
    archive_path: str
    pdf_path: Path


def detect_question_numbers(text: str) -> list[int]:
    return list(dict.fromkeys(int(match.group(1)) for match in QUESTION_NUMBER_PATTERN.finditer(text)))


def iter_question_sources(
        manifest_file: Path, index_file: Path, data_root: Path,
        years: set[int] | None = None) -> Iterator[QuestionSource]:
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    exam_numbers = {
        int(record["year"]): int(record["examNo"])
        for record in json.loads(index_file.read_text(encoding="utf-8"))
    }

    for attachment in manifest:
        if attachment["kind"] != "QUESTION":
            continue
        relative_path = Path(attachment["relative_path"])
        year = int(relative_path.parts[2])
        if years and year not in years:
            continue
        archive = data_root / relative_path
        if archive.suffix.lower() == ".zip":
            pdfs = _canonical_pdfs(archive.parent / "extracted" / archive.stem)
        elif archive.suffix.lower() == ".pdf":
            pdfs = [archive]
        else:
            continue
        for pdf_path in pdfs:
            yield QuestionSource(
                year=year,
                exam_no=exam_numbers[year],
                article_id=str(attachment["article_id"]),
                archive_sha256=str(attachment["sha256"]),
                archive_path=attachment["relative_path"],
                pdf_path=pdf_path,
            )


def _canonical_pdfs(extracted_root: Path) -> list[Path]:
    pdfs = sorted(extracted_root.rglob("*.pdf"))
    form_a = [path for path in pdfs if "A형" in path.name.upper()]
    return form_a if form_a else pdfs


def ocr_source(
        source: QuestionSource, tesseract: Path, tessdata: Path | None,
    scale: float = 3.0, max_pages: int | None = None,
    completed: AbstractSet[tuple[str, int, str]] | None = None) -> Iterator[dict[str, object]]:
    with pymupdf.open(source.pdf_path) as document:
        page_count = min(len(document), max_pages) if max_pages else len(document)
        for page_index in range(page_count):
            page = document[page_index]
            midpoint = page.rect.x0 + page.rect.width / 2
            columns = (
                ("LEFT", pymupdf.Rect(page.rect.x0, page.rect.y0, midpoint, page.rect.y1)),
                ("RIGHT", pymupdf.Rect(midpoint, page.rect.y0, page.rect.x1, page.rect.y1)),
            )
            for column, clip in columns:
                key = (source.pdf_path.as_posix(), page_index + 1, column)
                if completed and key in completed:
                    continue
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=clip, alpha=False)
                text = _run_tesseract(pixmap.tobytes("png"), tesseract, tessdata)
                yield {
                    "recordType": "OCR_COLUMN",
                    "year": source.year,
                    "examNo": source.exam_no,
                    "sourceArticleId": source.article_id,
                    "sourceArchiveSha256": source.archive_sha256,
                    "sourceArchivePath": source.archive_path,
                    "sourcePdfPath": source.pdf_path.as_posix(),
                    "page": page_index + 1,
                    "column": column,
                    "pdfClip": [round(value, 3) for value in (clip.x0, clip.y0, clip.x1, clip.y1)],
                    "detectedQuestionNumbers": detect_question_numbers(text),
                    "ocrText": text.strip(),
                    "reviewStatus": "NEEDS_REVIEW",
                }


def _run_tesseract(image: bytes, executable: Path, tessdata: Path | None) -> str:
    with tempfile.TemporaryDirectory(prefix="qnet-ocr-") as directory:
        image_path = (Path(directory) / "column.png").resolve()
        output_base = (Path(directory) / "result").resolve()
        image_path.write_bytes(image)
        command = [
            str(executable.resolve()), str(image_path), str(output_base),
            "-l", "kor+eng", "--psm", "6",
        ]
        if tessdata:
            command.extend(["--tessdata-dir", str(tessdata.resolve())])
        subprocess.run(command, check=True, capture_output=True)
        return output_base.with_suffix(".txt").read_text(encoding="utf-8")


def _resolve_tesseract(value: str | None) -> Path:
    candidates = [
        value,
        os.getenv("TESSERACT_CMD"),
        shutil.which("tesseract"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise FileNotFoundError("Tesseract was not found; set TESSERACT_CMD or pass --tesseract")


def main() -> int:
    parser = argparse.ArgumentParser(description="OCR Q-Net question PDFs into review-required JSONL")
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/qnet-manifest.json"))
    parser.add_argument("--index", type=Path, default=Path(__file__).with_name("source_index.json"))
    parser.add_argument("--data-root", type=Path, default=Path("data"))
    parser.add_argument("--output", type=Path, default=Path("data/processed/qnet-question-ocr.jsonl"))
    parser.add_argument("--tesseract")
    parser.add_argument("--tessdata", type=Path, default=Path("data/tools/tessdata-best"))
    parser.add_argument("--year", type=int, action="append", dest="years")
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--workers", type=int, default=min(4, os.cpu_count() or 1))
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    tesseract = _resolve_tesseract(args.tesseract)
    tessdata = args.tessdata if args.tessdata.is_dir() else None
    sources = list(iter_question_sources(
        args.manifest, args.index, args.data_root, set(args.years) if args.years else None))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    completed = _completed_keys(args.output) if not args.overwrite else set()
    count = 0
    mode = "w" if args.overwrite else "a"
    with args.output.open(mode, encoding="utf-8", newline="\n") as output:
        snapshot = frozenset(completed)
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = [
                executor.submit(
                    lambda item=source: list(ocr_source(
                        item, tesseract, tessdata, max_pages=args.max_pages, completed=snapshot)))
                for source in sources
            ]
            for future in as_completed(futures):
                for record in future.result():
                    key = (str(record["sourcePdfPath"]), int(record["page"]), str(record["column"]))
                    output.write(json.dumps(record, ensure_ascii=False) + "\n")
                    output.flush()
                    completed.add(key)
                    count += 1
    print(f"Wrote {count} review-required OCR column records to {args.output}")
    return 0


def _completed_keys(output: Path) -> set[tuple[str, int, str]]:
    if not output.is_file():
        return set()
    keys: set[tuple[str, int, str]] = set()
    for line in output.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        keys.add((str(record["sourcePdfPath"]), int(record["page"]), str(record["column"])))
    return keys


if __name__ == "__main__":
    raise SystemExit(main())