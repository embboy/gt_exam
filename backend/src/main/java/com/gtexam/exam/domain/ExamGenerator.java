package com.gtexam.exam.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class ExamGenerator {
    private final ExamPublishValidator publishValidator;

    public ExamGenerator(ExamPublishValidator publishValidator) {
        this.publishValidator = publishValidator;
    }

    public List<QuestionCandidate> generate(
            List<QuestionCandidate> candidatePool,
            List<String> subjectCodes,
            Set<Long> officiallyUsedQuestionIds) {
        Set<String> uniqueSubjects = new LinkedHashSet<>(subjectCodes);
        if (uniqueSubjects.size() != subjectCodes.size()) {
            throw new PublishValidationException("EXAM_BLUEPRINT_INVALID", "Subject codes must be unique");
        }

        List<QuestionCandidate> selected = new ArrayList<>();
        Set<String> selectedHashes = new HashSet<>();
        for (String subjectCode : subjectCodes) {
            List<QuestionCandidate> subjectSelection = candidatePool.stream()
                    .filter(candidate -> candidate.subjectCode().equals(subjectCode))
                    .filter(candidate -> candidate.status() == QuestionStatus.APPROVED)
                    .filter(QuestionCandidate::legalAtReferenceDate)
                    .filter(candidate -> !candidate.semanticDuplicateBlocked())
                    .filter(candidate -> !officiallyUsedQuestionIds.contains(candidate.questionId()))
                    .filter(candidate -> selectedHashes.add(candidate.normalizedHash()))
                    .sorted(Comparator.comparingLong(QuestionCandidate::questionId))
                    .limit(ExamPublishValidator.QUESTIONS_PER_SUBJECT)
                    .toList();
            if (subjectSelection.size() != ExamPublishValidator.QUESTIONS_PER_SUBJECT) {
                throw new PublishValidationException(
                        "EXAM_CANDIDATES_INSUFFICIENT",
                        "Subject " + subjectCode + " does not have 40 eligible questions");
            }
            selected.addAll(subjectSelection);
        }

        publishValidator.validate(selected, uniqueSubjects, officiallyUsedQuestionIds);
        return List.copyOf(selected);
    }
}