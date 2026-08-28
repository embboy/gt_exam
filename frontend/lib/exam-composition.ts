export const QUESTIONS_PER_SUBJECT = 40;
export const DIFFICULTY_QUOTAS = new Map([[1, 4], [2, 8], [3, 16], [4, 8], [5, 4]]);

export type CompositionCandidate = {
  questionId: bigint;
  subjectId: bigint;
  topicId: bigint | null;
  questionVersionId: bigint;
  difficulty: number;
  normalizedHash: string;
};

export class CompositionError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

export function selectComposition(candidates: CompositionCandidate[], subjectIds: bigint[], blockedPairs: Set<string>) {
  const selected: CompositionCandidate[] = [];
  const selectedIds = new Set<bigint>();
  const selectedHashes = new Set<string>();
  for (const subjectId of subjectIds) {
    const subjectCandidates = candidates.filter((candidate) => candidate.subjectId === subjectId);
    for (const [difficulty, quota] of DIFFICULTY_QUOTAS) {
      const bucket = subjectCandidates.filter((candidate) => candidate.difficulty === difficulty);
      let count = 0;
      for (const candidate of bucket) {
        const conflicts = [...selectedIds].some((id) => blockedPairs.has(pairKey(candidate.questionId, id)));
        if (selectedIds.has(candidate.questionId) || selectedHashes.has(candidate.normalizedHash) || conflicts) continue;
        selected.push(candidate);
        selectedIds.add(candidate.questionId);
        selectedHashes.add(candidate.normalizedHash);
        count += 1;
        if (count === quota) break;
      }
      if (count !== quota) throw new CompositionError("EXAM_CANDIDATES_INSUFFICIENT", `Subject ${subjectId} needs ${quota} eligible difficulty-${difficulty} questions`);
    }
  }
  return selected;
}

export function pairKey(left: bigint, right: bigint) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}