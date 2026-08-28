import assert from "node:assert/strict";

import { CompositionError, pairKey, selectComposition } from "../lib/exam-composition";

function candidates(subjectId: bigint, startId: bigint) {
  const result = [];
  let questionId = startId;
  for (const [difficulty, count] of [[1, 4], [2, 8], [3, 16], [4, 8], [5, 4]] as const) {
    for (let index = 0; index < count + 1; index += 1) {
      result.push({ questionId, subjectId, topicId: null, questionVersionId: questionId + 10_000n, difficulty, normalizedHash: `hash-${questionId}` });
      questionId += 1n;
    }
  }
  return result;
}

const subjectOne = 1n;
const subjectTwo = 2n;
const pool = [...candidates(subjectOne, 1n), ...candidates(subjectTwo, 1_000n)];
const selected = selectComposition(pool, [subjectOne, subjectTwo], new Set([pairKey(1n, 2n)]));

assert.equal(selected.length, 80);
for (const subjectId of [subjectOne, subjectTwo]) {
  const subjectQuestions = selected.filter((item) => item.subjectId === subjectId);
  assert.equal(subjectQuestions.length, 40);
  assert.deepEqual(Object.fromEntries([1, 2, 3, 4, 5].map((difficulty) => [difficulty, subjectQuestions.filter((item) => item.difficulty === difficulty).length])), { 1: 4, 2: 8, 3: 16, 4: 8, 5: 4 });
}
assert(!selected.some((item) => item.questionId === 2n), "BLOCK pair candidate should be excluded when an alternative exists");
assert(selected.some((item) => item.questionId === 5n), "An eligible replacement must preserve the difficulty quota");
assert.throws(() => selectComposition(pool.filter((item) => !(item.subjectId === subjectOne && item.difficulty === 1)), [subjectOne], new Set()), (error: unknown) => error instanceof CompositionError && error.code === "EXAM_CANDIDATES_INSUFFICIENT");
console.log("Exam composition policy tests passed");