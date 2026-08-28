package com.gtexam.exam.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class ExamPublishValidator {
    public static final int QUESTIONS_PER_SUBJECT = 40;

    public void validate(
            List<QuestionCandidate> candidates,
            Set<String> expectedSubjectCodes,
            Set<Long> officiallyUsedQuestionIds) {
        if (expectedSubjectCodes.isEmpty()) {
            throw new PublishValidationException("EXAM_BLUEPRINT_EMPTY", "At least one subject is required");
        }

        Map<String, Long> counts = candidates.stream()
                .collect(Collectors.groupingBy(QuestionCandidate::subjectCode, Collectors.counting()));
        if (!counts.keySet().equals(expectedSubjectCodes)
                || counts.values().stream().anyMatch(count -> count != QUESTIONS_PER_SUBJECT)) {
            throw new PublishValidationException(
                    "EXAM_QUESTION_COUNT_INVALID",
                    "Every expected subject must contain exactly 40 questions");
        }

        requireUnique(candidates, QuestionCandidate::questionId, "QUESTION_DUPLICATE");
        requireUnique(candidates, QuestionCandidate::normalizedHash, "QUESTION_HASH_DUPLICATE");

        for (QuestionCandidate candidate : candidates) {
            if (candidate.status() != QuestionStatus.APPROVED) {
                throw new PublishValidationException("QUESTION_NOT_APPROVED", "Question is not approved");
            }
            if (!candidate.legalAtReferenceDate()) {
                throw new PublishValidationException("LEGAL_DATE_INVALID", "Question is invalid at reference date");
            }
            if (candidate.semanticDuplicateBlocked()) {
                throw new PublishValidationException("SEMANTIC_DUPLICATE_BLOCKED", "Question is semantically blocked");
            }
            if (officiallyUsedQuestionIds.contains(candidate.questionId())) {
                throw new PublishValidationException("QUESTION_ALREADY_USED", "Question was used by an official mock exam");
            }
        }
    }

    private static <T> void requireUnique(
            List<QuestionCandidate> candidates,
            Function<QuestionCandidate, T> keyExtractor,
            String errorCode) {
        Set<T> seen = new HashSet<>();
        boolean duplicate = candidates.stream().map(keyExtractor).anyMatch(value -> !seen.add(value));
        if (duplicate) {
            throw new PublishValidationException(errorCode, "Duplicate candidate value");
        }
    }
}