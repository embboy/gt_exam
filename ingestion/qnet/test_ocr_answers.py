import unittest

from ocr_answers import answer_evidence


class OcrAnswersTest(unittest.TestCase):
    def test_marks_matching_complete_native_and_ocr_answers_as_cross_checked(self) -> None:
        answers = " ".join(str((index % 5) + 1) for index in range(40))

        evidence = answer_evidence(answers, answers)

        self.assertEqual("CROSS_CHECKED", evidence["verificationStatus"])
        self.assertEqual(40, evidence["nativeAnswerCount"])

    def test_requires_review_when_ocr_does_not_match_native_text(self) -> None:
        native_answers = " ".join(str((index % 5) + 1) for index in range(40))
        ocr_answers = " ".join("1" for _ in range(40))

        evidence = answer_evidence(native_answers, ocr_answers)

        self.assertEqual("NEEDS_REVIEW", evidence["verificationStatus"])


if __name__ == "__main__":
    unittest.main()