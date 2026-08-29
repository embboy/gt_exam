import tempfile
import unittest
from pathlib import Path

import pymupdf

from prepare_past_exam_pdfs import canonical_pdfs, parse_file_name, prepare_pdfs


def write_pdf(path: Path) -> None:
    document = pymupdf.open()
    document.new_page().insert_text((72, 72), "official question paper")
    document.save(path)
    document.close()


class PreparePastExamPdfsTest(unittest.TestCase):
    def test_prefers_form_a_when_form_a_and_b_exist(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            write_pdf(source / "2020년 제31회 시험문제지_1차 1교시 B형.pdf")
            write_pdf(source / "2020년 제31회 시험문제지_1차 1교시 A형.pdf")

            self.assertEqual(["2020년 제31회 시험문제지_1차 1교시 A형.pdf"], [path.name for path in canonical_pdfs(source)])

    def test_writes_manifest_for_valid_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            source.mkdir()
            write_pdf(source / "2022년 제33회 시험문제지_1차 1교시.pdf")

            records = prepare_pdfs(source, root / "raw", root / "manifest.json")

            self.assertEqual(1, len(records))
            self.assertEqual(2022, records[0].year)
            self.assertEqual(1, records[0].stage)
            self.assertEqual(1, records[0].session)
            self.assertTrue((root / "raw/2022년 제33회 시험문제지_1차 1교시.pdf").is_file())

    def test_rejects_unrecognized_file_name(self) -> None:
        with self.assertRaises(ValueError):
            parse_file_name(Path("unidentified.pdf"))


if __name__ == "__main__":
    unittest.main()