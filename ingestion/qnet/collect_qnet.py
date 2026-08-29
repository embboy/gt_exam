from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import time
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path

from archive_validation import decode_zip_member_name, extract_validated_pdfs


BASE_URL = "https://www.q-net.or.kr"
DETAIL_URL = f"{BASE_URL}/cst003.do?id=cst00302&gSite=Q&gId="
DOWNLOAD_URL = f"{BASE_URL}/crf011.do?id=crf01106&gSite=Q&gId="
FILE_PATTERN = re.compile(
    r"fileDown\(\s*'(?P<path>[^']+)'\s*,\s*'(?P<name>[^']+)'(?:\s*,\s*'[^']*')?\s*\)"
)
TITLE_PATTERN = re.compile(r"<p[^>]*class=\"[^\"]*subject[^\"]*\"[^>]*>(.*?)</p>", re.DOTALL)


@dataclass(frozen=True)
class Attachment:
    kind: str
    article_id: str
    article_url: str
    title: str
    file_name: str
    download_url: str
    sha256: str
    size: int
    relative_path: str
    license: str


def parse_detail(content: str) -> tuple[str, list[tuple[str, str]], str]:
    matches = [(html.unescape(match.group("path")), html.unescape(match.group("name")))
               for match in FILE_PATTERN.finditer(content)]
    if not matches:
        raise ValueError("Q-Net detail page has no downloadable attachment")

    title_match = TITLE_PATTERN.search(content)
    if title_match:
        title = _strip_tags(title_match.group(1))
    else:
        title = ""
    license_name = "KOGL_TYPE_1" if "공공누리" in content and "출처표시" in content else "UNVERIFIED"
    return title, matches, license_name


def collect(index_file: Path, raw_root: Path, manifest_file: Path, years: set[int] | None) -> list[Attachment]:
    records = json.loads(index_file.read_text(encoding="utf-8"))
    user_agent = os.getenv("QNET_USER_AGENT", "gt-exam-archive/1.0")
    attachments: list[Attachment] = []

    for record in records:
        year = int(record["year"])
        if years and year not in years:
            continue
        for kind, article_key, code, menu_type in (
                ("QUESTION", "questionArticleId", "1008", "cst00309"),
                ("ANSWER", "answerArticleId", "1206", "cst00310")):
            article_id = str(record[article_key])
            content = _fetch_detail(article_id, code, menu_type, user_agent)
            title, files, license_name = parse_detail(content)
            if not title:
                title = files[0][1]
            year_root = raw_root / str(year) / kind.lower()
            year_root.mkdir(parents=True, exist_ok=True)
            for file_path, file_name in files:
                destination = year_root / _safe_file_name(file_name)
                download_url = DOWNLOAD_URL + "&" + urllib.parse.urlencode(
                    {"filePath": file_path, "fileName": file_name})
                _download(download_url, destination, user_agent)
                attachments.append(Attachment(
                    kind=kind,
                    article_id=article_id,
                    article_url=f"{DETAIL_URL}&artlSeq={article_id}",
                    title=title,
                    file_name=file_name,
                    download_url=download_url,
                    sha256=_sha256(destination),
                    size=destination.stat().st_size,
                    relative_path=destination.relative_to(raw_root.parent.parent).as_posix(),
                    license=license_name,
                ))
                if destination.suffix.lower() == ".zip":
                    _extract_zip(destination, year_root / "extracted" / destination.stem)
                _write_manifest(manifest_file, attachments)
            time.sleep(0.4)

    _write_manifest(manifest_file, attachments)
    return attachments


def _write_manifest(manifest_file: Path, attachments: list[Attachment]) -> None:
    manifest_file.parent.mkdir(parents=True, exist_ok=True)
    temporary = manifest_file.with_suffix(manifest_file.suffix + ".part")
    temporary.write_text(
        json.dumps([asdict(item) for item in attachments], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary.replace(manifest_file)


def _fetch_detail(article_id: str, code: str, menu_type: str, user_agent: str) -> str:
    body = urllib.parse.urlencode({
        "page": "1",
        "schType": "A",
        "schText": "공인중개사",
        "artlSeq": article_id,
        "boardId": "Q004",
        "code": code,
        "menuType": menu_type,
        "cst": "Y",
    }).encode("utf-8")
    request = urllib.request.Request(DETAIL_URL, data=body, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


def _download(url: str, destination: Path, user_agent: str) -> None:
    if destination.exists() and destination.stat().st_size > 0:
        return
    request = urllib.request.Request(url, headers={"User-Agent": user_agent})
    temporary = destination.with_suffix(destination.suffix + ".part")
    with urllib.request.urlopen(request, timeout=180) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    temporary.replace(destination)


def _extract_zip(archive: Path, destination: Path) -> None:
    extract_validated_pdfs(archive, destination)


def _decode_zip_name(member: zipfile.ZipInfo) -> str:
    return decode_zip_member_name(member)


def _safe_file_name(value: str) -> str:
    return re.sub(r"[<>:\\|?*\"]", "_", Path(value).name).strip()


def _strip_tags(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", value))).strip()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect licensed Q-Net realtor exam attachments")
    parser.add_argument("--index", type=Path, default=Path(__file__).with_name("source_index.json"))
    parser.add_argument("--raw-root", type=Path, default=Path("data/raw/qnet"))
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/qnet-manifest.json"))
    parser.add_argument("--year", type=int, action="append", dest="years")
    args = parser.parse_args()
    attachments = collect(args.index, args.raw_root, args.manifest,
                          set(args.years) if args.years else None)
    print(f"Collected {len(attachments)} attachments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
