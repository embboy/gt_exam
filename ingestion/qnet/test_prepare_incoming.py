import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

import pymupdf

from prepare_incoming import prepare_archives


def valid_pdf_bytes() -> bytes:
    document = pymupdf.open()
    document.new_page()
    result = document.tobytes()
    document.close()
    return result


class PrepareIncomingTest(unittest.TestCase):
    def test_verifies_and_extracts_manifest_matched_pdf_archive(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            incoming = root / "incoming"
            incoming.mkdir()
            archive = incoming / "exam.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("questions.pdf", valid_pdf_bytes())
            checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps([{
                "kind": "QUESTION", "file_name": "exam.zip", "license": "KOGL_TYPE_1",
                "sha256": checksum, "relative_path": "raw/qnet/2025/question/exam.zip",
            }]), encoding="utf-8")

            prepared, rejected = prepare_archives(incoming, manifest, root)

            self.assertEqual([], rejected)
            self.assertEqual([root / "raw/qnet/2025/question/exam.zip"], prepared)
            self.assertTrue((root / "raw/qnet/2025/question/extracted/exam/questions.pdf").is_file())

    def test_rejects_archive_with_unverified_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            incoming = root / "incoming"
            incoming.mkdir()
            archive = incoming / "exam.zip"
            archive.write_bytes(b"unverified")
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps([{
                "kind": "QUESTION", "file_name": "exam.zip", "license": "KOGL_TYPE_1",
                "sha256": "0" * 64, "relative_path": "raw/qnet/2025/question/exam.zip",
            }]), encoding="utf-8")

            prepared, rejected = prepare_archives(incoming, manifest, root)

            self.assertEqual([], prepared)
            self.assertEqual(1, len(rejected))


if __name__ == "__main__":
    unittest.main()