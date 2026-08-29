from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Iterator

import pymupdf


MIN_NATIVE_TEXT_CHARS = 400


def resolve_tesseract(value: str | None) -> Path:
    candidates = [value, os.getenv("TESSERACT_CMD"), shutil.which("tesseract"), r"C:\Program Files\Tesseract-OCR\tesseract.exe"]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise FileNotFoundError("Tesseract was not found; set TESSERACT_CMD or pass --tesseract")


def extract_pages(
    manifest_path: Path, output_path: Path, tesseract: Path | None,
    tessdata: Path | None, allow_ocr_pending: bool = False) -> tuple[int, list[dict[str, object]]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(output_path.suffix + ".part")
    count = 0
    pending: list[dict[str, object]] = []
    with temporary.open("w", encoding="utf-8", newline="\n") as output:
        for item in manifest:
            pdf = Path(item["relative_path"])
            with pymupdf.open(pdf) as document:
                for page_number, page in enumerate(document, start=1):
                    native_text = page.get_text("text").strip()
                    extraction_method = "NATIVE_TEXT"
                    source_text = native_text
                    if len(native_text) < MIN_NATIVE_TEXT_CHARS:
                        if allow_ocr_pending:
                            pending.append({"sourcePdfPath": item["relative_path"], "page": page_number, "nativeTextChars": len(native_text)})
                            continue
                        if not tesseract:
                            raise ValueError(f"OCR is required for {pdf.name} page {page_number}, but Tesseract is unavailable")
                        source_text = run_tesseract(page, tesseract, tessdata).strip()
                        extraction_method = "OCR_FALLBACK"
                    if not source_text:
                        raise ValueError(f"No extractable text for {pdf.name} page {page_number}")
                    record = {
                        "recordType": "LOCAL_PDF_PAGE",
                        "year": item["year"],
                        "examNo": item["exam_no"],
                        "stage": item["stage"],
                        "session": item["session"],
                        "form": item["form"],
                        "sourcePdfPath": item["relative_path"],
                        "sourcePdfSha256": item["sha256"],
                        "page": page_number,
                        "extractionMethod": extraction_method,
                        "nativeTextChars": len(native_text),
                        "sourceText": source_text,
                        "reviewStatus": "NEEDS_REVIEW",
                    }
                    output.write(json.dumps(record, ensure_ascii=False) + "\n")
                    count += 1
    temporary.replace(output_path)
    return count, pending


def run_tesseract(page: pymupdf.Page, executable: Path, tessdata: Path | None) -> str:
    with tempfile.TemporaryDirectory(prefix="local-pdf-ocr-") as directory:
        image_path = Path(directory) / "page.png"
        output_base = Path(directory) / "result"
        page.get_pixmap(matrix=pymupdf.Matrix(3, 3), alpha=False).save(image_path)
        command = [str(executable), str(image_path), str(output_base), "-l", "kor+eng", "--psm", "6"]
        if tessdata:
            command.extend(["--tessdata-dir", str(tessdata)])
        subprocess.run(command, check=True, capture_output=True)
        return output_base.with_suffix(".txt").read_text(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract page-level evidence from user-provided past-exam PDFs")
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/local-pdf-manifest.json"))
    parser.add_argument("--output", type=Path, default=Path("data/processed/local-pdf-pages.jsonl"))
    parser.add_argument("--tesseract")
    parser.add_argument("--tessdata", type=Path, default=Path("data/tools/tessdata-best"))
    parser.add_argument("--allow-ocr-pending", action="store_true")
    args = parser.parse_args()

    tessdata = args.tessdata if args.tessdata.is_dir() else None
    tesseract = None if args.allow_ocr_pending else resolve_tesseract(args.tesseract)
    count, pending = extract_pages(args.manifest, args.output, tesseract, tessdata, args.allow_ocr_pending)
    print(f"Extracted {count} local PDF page record(s) to {args.output}")
    if pending:
        pending_path = args.output.with_name(f"{args.output.stem}-pending-ocr.json")
        pending_path.write_text(json.dumps(pending, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Deferred OCR for {len(pending)} page(s); see {pending_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())