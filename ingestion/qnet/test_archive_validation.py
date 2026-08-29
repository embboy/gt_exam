import tempfile
import unittest
import zipfile
from pathlib import Path

import pymupdf

from archive_validation import ArchiveValidationError, extract_validated_pdfs


def valid_pdf_bytes() -> bytes:
    document = pymupdf.open()
    document.new_page()
    result = document.tobytes()
    document.close()
    return result


class ArchiveValidationTest(unittest.TestCase):
    def test_extracts_only_openable_pdf_members(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "questions.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("nested/questions.pdf", valid_pdf_bytes())
                output.writestr("readme.txt", "not a question paper")

            extracted = extract_validated_pdfs(archive, root / "extracted")

            self.assertEqual([root / "extracted/nested/questions.pdf"], extracted)

    def test_rejects_member_that_is_not_a_valid_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "questions.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("questions.pdf", b"%PDF-not-a-real-pdf")

            with self.assertRaises(ArchiveValidationError):
                extract_validated_pdfs(archive, root / "extracted")

    def test_rejects_zip_path_traversal(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "questions.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("../questions.pdf", valid_pdf_bytes())

            with self.assertRaises(ArchiveValidationError):
                extract_validated_pdfs(archive, root / "extracted")


if __name__ == "__main__":
    unittest.main()