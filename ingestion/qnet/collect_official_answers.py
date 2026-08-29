from __future__ import annotations

import argparse
import json
import time
import urllib.parse
from dataclasses import asdict, dataclass
from pathlib import Path

import pymupdf

from collect_qnet import (
    DETAIL_URL,
    DOWNLOAD_URL,
    _download,
    _fetch_detail,
    _safe_file_name,
    _sha256,
    parse_detail,
)


@dataclass(frozen=True)
class OfficialAnswerPdf:
    year: int
    exam_no: int
    article_id: str
    article_url: str
    file_name: str
    download_url: str
    relative_path: str
    sha256: str
    page_count: int
    license: str


def collect_answers(index_path: Path, raw_directory: Path, manifest_path: Path, years: set[int] | None) -> list[OfficialAnswerPdf]:
    index = json.loads(index_path.read_text(encoding="utf-8"))
    user_agent = "gt-exam-answer-evidence/1.0"
    records: list[OfficialAnswerPdf] = []

    for item in index:
        year = int(item["year"])
        if years and year not in years:
            continue
        exam_no = int(item["examNo"])
        article_id = str(item["answerArticleId"])
        title, attachments, license_name = parse_detail(_fetch_detail(article_id, "1206", "cst00310", user_agent))
        if license_name != "KOGL_TYPE_1":
            raise ValueError(f"Unverified answer rights for {year} exam {exam_no}: {title}")

        pdf_attachments = [(path, name) for path, name in attachments if name.lower().endswith(".pdf") and "정답" in name]
        if not pdf_attachments:
            raise ValueError(f"No final-answer PDF for {year} exam {exam_no}: {title}")

        for file_path, file_name in pdf_attachments:
            destination = raw_directory / str(year) / _safe_file_name(file_name)
            download_url = answer_download_url(file_path, file_name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            _download(download_url, destination, user_agent)
            page_count = validate_pdf(destination)
            records.append(OfficialAnswerPdf(
                year=year,
                exam_no=exam_no,
                article_id=article_id,
                article_url=f"{DETAIL_URL}&artlSeq={article_id}",
                file_name=file_name,
                download_url=download_url,
                relative_path=destination.as_posix(),
                sha256=_sha256(destination),
                page_count=page_count,
                license=license_name,
            ))
        time.sleep(0.4)

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = manifest_path.with_suffix(manifest_path.suffix + ".part")
    temporary.write_text(json.dumps([asdict(record) for record in records], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(manifest_path)
    return records


def answer_download_url(file_path: str, file_name: str) -> str:
    return f"{DOWNLOAD_URL}&{urllib.parse.urlencode({'filePath': file_path, 'fileName': file_name})}"


def validate_pdf(path: Path) -> int:
    with path.open("rb") as source:
        if source.read(5) != b"%PDF-":
            raise ValueError(f"Invalid final-answer PDF header: {path.name}")
    with pymupdf.open(path) as document:
        if not document.is_pdf or not len(document):
            raise ValueError(f"Unreadable final-answer PDF: {path.name}")
        return len(document)


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect verified Q-Net final-answer PDFs as grading evidence")
    parser.add_argument("--index", type=Path, default=Path(__file__).with_name("source_index.json"))
    parser.add_argument("--raw-directory", type=Path, default=Path("data/raw/qnet-answer-evidence"))
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/qnet-answer-manifest.json"))
    parser.add_argument("--year", type=int, action="append", dest="years")
    args = parser.parse_args()

    selected_years = set(args.years) if args.years else set(range(2017, 2026))
    records = collect_answers(args.index, args.raw_directory, args.manifest, selected_years)
    print(f"Collected {len(records)} verified official final-answer PDF(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())