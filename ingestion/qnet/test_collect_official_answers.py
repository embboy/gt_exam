import tempfile
import unittest
import json
from pathlib import Path

import pymupdf

from collect_official_answers import answer_download_url, validate_pdf


class ValidateOfficialAnswerPdfTest(unittest.TestCase):
    def test_returns_page_count_for_valid_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "answer.pdf"
            document = pymupdf.open()
            document.new_page()
            document.save(path)
            document.close()

            self.assertEqual(1, validate_pdf(path))

    def test_rejects_non_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "answer.pdf"
            path.write_text("not a PDF", encoding="utf-8")

            with self.assertRaises(ValueError):
                validate_pdf(path)

    def test_encodes_korean_answer_file_name(self) -> None:
        url = answer_download_url("bbs/Q004/Q004_2185316", "2017년 최종 정답.pdf")

        self.assertIn("filePath=bbs%2FQ004%2FQ004_2185316", url)
        self.assertIn("fileName=2017%EB%85%84+%EC%B5%9C%EC%A2%85+%EC%A0%95%EB%8B%B5.pdf", url)

    def test_2017_a_form_key_matches_visually_reviewed_official_table(self) -> None:
        key_path = Path(__file__).parents[2] / "data" / "processed" / "official-answer-keys.json"
        keys = json.loads(key_path.read_text(encoding="utf-8"))
        key = next(item for item in keys if item["year"] == 2017 and item["examNo"] == 28 and item["form"] == "A")
        expected_answers = [
            5, 3, 3, 4, 5, 2, 1, 4, 2, 5, 1, 5, 2, 1, 3, 3, 5, 4, 3, 1,
            1, 4, 2, 4, 3, 3, 2, 2, 3, 4, 3, 3, 5, 2, 4, 1, 4, 1, 5, 2,
            1, 1, 2, 3, 2, 3, 4, 1, 5, 4, 5, 1, 3, 1, 4, 4, 4, 3, 3, 2,
            5, 5, 2, 1, 3, 2, 2, 1, 5, 5, 2, 5, 4, 2, 5, 1, 3, 2, 1, 4,
        ]

        self.assertEqual(80, len(key["answers"]))
        self.assertEqual([[answer] for answer in expected_answers], key["answers"])


if __name__ == "__main__":
    unittest.main()