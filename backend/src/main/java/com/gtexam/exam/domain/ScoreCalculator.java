package com.gtexam.exam.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

public final class ScoreCalculator {
    private static final BigDecimal POINTS_PER_QUESTION = new BigDecimal("2.5");
    private static final BigDecimal SUBJECT_CUTOFF = new BigDecimal("40.00");
    private static final BigDecimal AVERAGE_CUTOFF = new BigDecimal("60.00");

    public StageScore calculate(Map<String, Integer> correctCounts, int expectedSubjectCount) {
        if (correctCounts.size() != expectedSubjectCount) {
            throw new IllegalArgumentException("All subjects must be present");
        }

        Map<String, BigDecimal> subjectScores = new LinkedHashMap<>();
        correctCounts.forEach((subjectCode, correctCount) -> {
            if (correctCount < 0 || correctCount > ExamPublishValidator.QUESTIONS_PER_SUBJECT) {
                throw new IllegalArgumentException("Correct count must be between 0 and 40");
            }
            subjectScores.put(subjectCode, POINTS_PER_QUESTION.multiply(BigDecimal.valueOf(correctCount)));
        });

        BigDecimal average = subjectScores.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(expectedSubjectCount), 2, RoundingMode.HALF_UP);
        boolean hasNoSubjectFailure = subjectScores.values().stream()
                .allMatch(score -> score.compareTo(SUBJECT_CUTOFF) >= 0);
        return new StageScore(Map.copyOf(subjectScores), average,
                hasNoSubjectFailure && average.compareTo(AVERAGE_CUTOFF) >= 0);
    }

    public record StageScore(Map<String, BigDecimal> subjectScores, BigDecimal average, boolean passed) {
    }
}