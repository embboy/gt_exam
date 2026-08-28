from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any


REQUIRED_FIELDS = {
    "subjectCode",
    "topicCode",
    "stem",
    "options",
    "correctAnswer",
    "explanation",
    "difficulty",
    "examReferenceDate",
    "derivedFromQuestionId",
}
ALLOWED_FIELDS = REQUIRED_FIELDS | {"lawVersionIds"}


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    field: str
    message: str


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    return re.sub(r"\s+", " ", normalized).strip().casefold()


def normalized_hash(payload: dict[str, Any]) -> str:
    options = payload.get("options", [])
    content = "\n".join([str(payload.get("stem", "")), *(str(option) for option in options)])
    return hashlib.sha256(normalize_text(content).encode("utf-8")).hexdigest()


def validate_question(payload: object) -> list[ValidationIssue]:
    if not isinstance(payload, dict):
        return [ValidationIssue("TYPE_INVALID", "$", "Question must be a JSON object")]

    issues: list[ValidationIssue] = []
    missing = REQUIRED_FIELDS - payload.keys()
    unexpected = payload.keys() - ALLOWED_FIELDS
    issues.extend(ValidationIssue("REQUIRED", field, "Required field is missing") for field in sorted(missing))
    issues.extend(ValidationIssue("UNEXPECTED", field, "Unexpected field") for field in sorted(unexpected))

    for field in ("subjectCode", "topicCode", "stem", "explanation"):
        value = payload.get(field)
        if field not in missing and (not isinstance(value, str) or not value.strip()):
            issues.append(ValidationIssue("TEXT_INVALID", field, "A non-empty string is required"))

    options = payload.get("options")
    if not isinstance(options, list) or len(options) != 5:
        issues.append(ValidationIssue("OPTIONS_COUNT_INVALID", "options", "Exactly five options are required"))
    elif any(not isinstance(option, str) or not option.strip() for option in options):
        issues.append(ValidationIssue("OPTION_INVALID", "options", "Every option must be a non-empty string"))
    elif len({normalize_text(option) for option in options}) != 5:
        issues.append(ValidationIssue("OPTION_DUPLICATE", "options", "Options must be unique after normalization"))

    _validate_integer_range(payload, "correctAnswer", 1, 5, issues)
    _validate_integer_range(payload, "difficulty", 1, 5, issues)
    _validate_integer_range(payload, "derivedFromQuestionId", 1, None, issues)

    reference_date = payload.get("examReferenceDate")
    if not isinstance(reference_date, str):
        issues.append(ValidationIssue("DATE_INVALID", "examReferenceDate", "ISO date is required"))
    else:
        try:
            date.fromisoformat(reference_date)
        except ValueError:
            issues.append(ValidationIssue("DATE_INVALID", "examReferenceDate", "ISO date is required"))

    law_version_ids = payload.get("lawVersionIds", [])
    if not isinstance(law_version_ids, list) or any(
            not isinstance(value, int) or isinstance(value, bool) or value < 1 for value in law_version_ids):
        issues.append(ValidationIssue("LAW_VERSION_INVALID", "lawVersionIds", "Positive integer IDs are required"))
    elif len(law_version_ids) != len(set(law_version_ids)):
        issues.append(ValidationIssue("LAW_VERSION_DUPLICATE", "lawVersionIds", "Law version IDs must be unique"))

    return issues


def _validate_integer_range(
        payload: dict[str, Any], field: str, minimum: int, maximum: int | None,
        issues: list[ValidationIssue]) -> None:
    value = payload.get(field)
    valid_integer = isinstance(value, int) and not isinstance(value, bool)
    if not valid_integer or value < minimum or (maximum is not None and value > maximum):
        issues.append(ValidationIssue("INTEGER_RANGE_INVALID", field, "Integer is outside the allowed range"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a generated GT Exam question")
    parser.add_argument("json_file", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.json_file.read_text(encoding="utf-8"))
    issues = validate_question(payload)
    print(json.dumps({"valid": not issues, "normalizedHash": normalized_hash(payload),
                      "issues": [issue.__dict__ for issue in issues]}, ensure_ascii=False, indent=2))
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
