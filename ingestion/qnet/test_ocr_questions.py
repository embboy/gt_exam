import json
import tempfile
import unittest
from pathlib import Path

from ocr_questions import _canonical_pdfs, _completed_keys, detect_question_numbers, iter_question_sources, validated_pdf_paths


class OcrQuestionsTest(unittest.TestCase):
    def test_detects_unique_question_numbers_at_line_starts(self) -> None:
        text = "9. 첫 문제\n보기 10. 본문 숫자\n  10． 둘째 문제\n9. OCR 중복"

        self.assertEqual([9, 10], detect_question_numbers(text))

    def test_maps_extracted_pdf_to_archive_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            extracted = root / "raw/qnet/2025/question/extracted/questions"
            extracted.mkdir(parents=True)
            (extracted / "stage1.pdf").write_bytes(b"pdf")
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps([{
                "kind": "QUESTION",
                "article_id": "5247125",
                "sha256": "abc123",
                "relative_path": "raw/qnet/2025/question/questions.zip",
            }]), encoding="utf-8")
            index = root / "index.json"
            index.write_text(json.dumps([{"year": 2025, "examNo": 36}]), encoding="utf-8")

            sources = list(iter_question_sources(manifest, index, root))

            self.assertEqual(1, len(sources))
            self.assertEqual(36, sources[0].exam_no)
            self.assertEqual("abc123", sources[0].archive_sha256)
            self.assertEqual("stage1.pdf", sources[0].pdf_path.name)

    def test_reads_completed_ocr_keys_for_resume(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "ocr.jsonl"
            output.write_text(json.dumps({
                "sourcePdfPath": "exam.pdf", "page": 2, "column": "RIGHT",
            }) + "\n", encoding="utf-8")

            self.assertEqual({("exam.pdf", 2, "RIGHT")}, _completed_keys(output))

    def test_retries_empty_ocr_records_when_resuming(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "ocr.jsonl"
            output.write_text(json.dumps({
                "sourcePdfPath": "exam.pdf", "page": 1, "column": "LEFT", "ocrText": "",
            }) + "\n", encoding="utf-8")

            self.assertEqual(set(), _completed_keys(output))

    def test_reads_only_validated_pdf_paths(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / "validation.json"
            report.write_text(json.dumps({
                "validated": [{"status": "VALID", "pdfs": [{"path": "raw/qnet/2025/question/extracted/a.pdf"}]}],
                "failures": [],
            }), encoding="utf-8")

            self.assertEqual({"raw/qnet/2025/question/extracted/a.pdf"}, validated_pdf_paths(report))

    def test_prefers_form_a_over_duplicate_form_b(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            form_a = root / "1차 A형.pdf"
            form_b = root / "1차 B형.pdf"
            form_a.write_bytes(b"a")
            form_b.write_bytes(b"b")

            self.assertEqual([form_a], _canonical_pdfs(root))


if __name__ == "__main__":
    unittest.main()