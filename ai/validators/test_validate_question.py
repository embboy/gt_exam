import unittest

from validate_question import normalized_hash, validate_question


def valid_question() -> dict[str, object]:
    return {
        "subjectCode": "REAL_ESTATE_PRINCIPLES",
        "topicCode": "ECONOMICS",
        "stem": "다음 중 부동산 수요에 관한 설명으로 옳은 것은?",
        "options": ["보기 1", "보기 2", "보기 3", "보기 4", "보기 5"],
        "correctAnswer": 2,
        "explanation": "보기 2가 수요 법칙에 부합하며 나머지는 조건이 다르다.",
        "difficulty": 3,
        "examReferenceDate": "2026-10-31",
        "derivedFromQuestionId": 101,
        "lawVersionIds": [],
    }


class ValidateQuestionTest(unittest.TestCase):
    def test_accepts_valid_question(self) -> None:
        self.assertEqual([], validate_question(valid_question()))

    def test_rejects_normalized_duplicate_options(self) -> None:
        payload = valid_question()
        payload["options"] = ["보기 1", " 보기   1 ", "보기 3", "보기 4", "보기 5"]

        codes = {issue.code for issue in validate_question(payload)}

        self.assertIn("OPTION_DUPLICATE", codes)

    def test_hash_is_stable_across_whitespace_and_unicode_width(self) -> None:
        first = valid_question()
        second = valid_question()
        second["stem"] = "  다음 중  부동산 수요에 관한 설명으로 옳은 것은? "
        second["options"] = ["보기 １", "보기 ２", "보기 ３", "보기 ４", "보기 ５"]

        self.assertEqual(normalized_hash(first), normalized_hash(second))


if __name__ == "__main__":
    unittest.main()