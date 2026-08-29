from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from archive_validation import extract_validated_pdfs


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_extract_pdf(archive: Path, destination: Path) -> list[Path]:
    return extract_validated_pdfs(archive, destination)


def prepare_archives(incoming: Path, manifest_path: Path, data_root: Path) -> tuple[list[Path], list[str]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    allowed = {
        item["file_name"]: item
        for item in manifest
        if item["kind"] == "QUESTION" and item.get("license") == "KOGL_TYPE_1"
    }
    prepared: list[Path] = []
    rejected: list[str] = []

    for archive in sorted(incoming.glob("*.zip")):
        item = allowed.get(archive.name)
        if not item:
            rejected.append(f"{archive.name}: manifest에서 확인된 Q-Net 문제지가 아닙니다")
            continue
        actual_checksum = sha256_file(archive)
        if actual_checksum != item["sha256"]:
            rejected.append(f"{archive.name}: SHA-256가 manifest와 일치하지 않습니다")
            continue
        target_archive = data_root / item["relative_path"]
        target_archive.parent.mkdir(parents=True, exist_ok=True)
        if not target_archive.exists() or sha256_file(target_archive) != actual_checksum:
            shutil.copy2(archive, target_archive)
        extracted = target_archive.parent / "extracted" / target_archive.stem
        _safe_extract_pdf(target_archive, extracted)
        prepared.append(target_archive)

    return prepared, rejected


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify and extract user-provided Q-Net question ZIP files")
    parser.add_argument("--incoming", type=Path, default=Path("data/incoming"))
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/qnet-manifest.json"))
    parser.add_argument("--data-root", type=Path, default=Path("data"))
    args = parser.parse_args()

    prepared, rejected = prepare_archives(args.incoming, args.manifest, args.data_root)
    print(f"Prepared {len(prepared)} verified archive(s)")
    for message in rejected:
        print(f"REJECTED: {message}")
    return 1 if rejected else 0


if __name__ == "__main__":
    raise SystemExit(main())