package com.gtexam.exam.domain;

import java.util.Objects;

public record QuestionCandidate(
        long questionId,
        String subjectCode,
        QuestionStatus status,
        String normalizedHash,
        boolean legalAtReferenceDate,
        boolean semanticDuplicateBlocked) {

    public QuestionCandidate {
        if (questionId <= 0) {
            throw new IllegalArgumentException("questionId must be positive");
        }
        Objects.requireNonNull(subjectCode, "subjectCode");
        Objects.requireNonNull(status, "status");
        Objects.requireNonNull(normalizedHash, "normalizedHash");
    }
}