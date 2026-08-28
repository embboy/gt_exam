package com.gtexam.exam.domain;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ExamDomainSmoke {
    private ExamDomainSmoke() {
    }

    public static void main(String[] args) {
        ExamPublishValidator validator = new ExamPublishValidator();
        List<QuestionCandidate> candidates = candidates("A", 1, 40);
        candidates.addAll(candidates("B", 41, 40));
        validator.validate(candidates, Set.of("A", "B"), Set.of());

        ExamGenerator generator = new ExamGenerator(validator);
        List<QuestionCandidate> generated = generator.generate(candidates, List.of("A", "B"), Set.of());
        require(generated.size() == 80, "Stage 1 exam must contain 80 questions");

        try {
            validator.validate(candidates, Set.of("A", "B"), Set.of(7L));
            throw new AssertionError("Previously used question must be rejected");
        } catch (PublishValidationException error) {
            require("QUESTION_ALREADY_USED".equals(error.code()), "Unexpected publish error");
        }

        ScoreCalculator calculator = new ScoreCalculator();
        ScoreCalculator.StageScore passing = calculator.calculate(Map.of("A", 24, "B", 24), 2);
        ScoreCalculator.StageScore cutoffFailure = calculator.calculate(Map.of("A", 15, "B", 35), 2);
        require(new BigDecimal("60.00").equals(passing.average()), "Average must be 60.00");
        require(passing.passed(), "Passing score was rejected");
        require(!cutoffFailure.passed(), "Subject cutoff was not applied");

        System.out.println("Exam domain smoke checks passed");
    }

    private static List<QuestionCandidate> candidates(String subjectCode, long firstId, int count) {
        List<QuestionCandidate> candidates = new ArrayList<>();
        for (int offset = 0; offset < count; offset++) {
            long questionId = firstId + offset;
            candidates.add(new QuestionCandidate(
                    questionId, subjectCode, QuestionStatus.APPROVED,
                    "hash-" + questionId, true, false));
        }
        return candidates;
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
}