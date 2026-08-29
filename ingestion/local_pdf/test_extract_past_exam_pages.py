import json
import tempfile
import unittest
from pathlib import Path

import pymupdf

from extract_past_exam_pages import extract_pages


def write_native_pdf(path: Path) -> None:
    document = pymupdf.open()
    document.new_page().insert_textbox((36, 36, 560, 780), "official question text " * 50)
    document.save(path)
    document.close()


class ExtractPastExamPagesTest(unittest.TestCase):
    def test_uses_native_text_when_page_has_sufficient_text(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pdf = root / "exam.pdf"
            write_native_pdf(pdf)
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps([{
                "year": 2025, "exam_no": 36, "stage": 1, "session": 1,
                "form": None, "relative_path": str(pdf), "sha256": "a" * 64,
            }]), encoding="utf-8")
            output = root / "pages.jsonl"

            count, pending = extract_pages(manifest, output, None, None)
            self.assertEqual(1, count)
            self.assertEqual([], pending)
            record = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual("NATIVE_TEXT", record["extractionMethod"])
            self.assertIn("official question text", record["sourceText"])


if __name__ == "__main__":
    unittest.main()