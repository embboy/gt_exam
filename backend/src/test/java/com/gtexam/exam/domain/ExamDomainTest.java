package com.gtexam.exam.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ExamDomainTest {
    private final ExamPublishValidator validator = new ExamPublishValidator();

    @Test
    void acceptsExactlyFortyApprovedQuestionsPerSubject() {
        List<QuestionCandidate> candidates = candidates("A", 1, 40);
        candidates.addAll(candidates("B", 41, 40));

        validator.validate(candidates, Set.of("A", "B"), Set.of());
    }

    @Test
    void rejectsPreviouslyUsedOfficialQuestion() {
        List<QuestionCandidate> candidates = candidates("A", 1, 40);

        PublishValidationException error = assertThrows(PublishValidationException.class,
                () -> validator.validate(candidates, Set.of("A"), Set.of(7L)));

        assertEquals("QUESTION_ALREADY_USED", error.code());
    }

    @Test
    void appliesSubjectCutoffAndAveragePassRules() {
        ScoreCalculator calculator = new ScoreCalculator();

        ScoreCalculator.StageScore passed = calculator.calculate(Map.of("A", 24, "B", 24), 2);
        ScoreCalculator.StageScore failedByCutoff = calculator.calculate(Map.of("A", 15, "B", 35), 2);

        assertEquals(new BigDecimal("60.00"), passed.average());
        assertTrue(passed.passed());
        assertFalse(failedByCutoff.passed());
    }

    @Test
    void generatorDoesNotReturnPartialExamWhenCandidatesAreInsufficient() {
        ExamGenerator generator = new ExamGenerator(validator);

        PublishValidationException error = assertThrows(PublishValidationException.class,
                () -> generator.generate(candidates("A", 1, 39), List.of("A"), Set.of()));

        assertEquals("EXAM_CANDIDATES_INSUFFICIENT", error.code());
    }

    private static List<QuestionCandidate> candidates(String subjectCode, long firstId, int count) {
        List<QuestionCandidate> candidates = new ArrayList<>();
        for (int offset = 0; offset < count; offset++) {
            long questionId = firstId + offset;
            candidates.add(new QuestionCandidate(
                    questionId,
                    subjectCode,
                    QuestionStatus.APPROVED,
                    "hash-" + questionId,
                    true,
                    false));
        }
        return candidates;
    }
}