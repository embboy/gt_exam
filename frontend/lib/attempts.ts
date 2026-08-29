import type { Prisma } from "@/generated/prisma/client";
import { safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export class AttemptError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function assertOwned(userId: bigint, ownerId: bigint) {
  if (userId !== ownerId) {
    throw new AttemptError(403, "FORBIDDEN", "The attempt belongs to another user");
  }
}

function asNumber(value: Prisma.Decimal | null) {
  return value === null ? null : value.toNumber();
}

export async function loadAttempt(userExamId: bigint, userId: bigint) {
  const attempt = await prisma.userExam.findUnique({ where: { id: userExamId }, include: { exam: true } });
  if (!attempt) {
    throw new AttemptError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
  }
  assertOwned(userId, attempt.userId);

  const [sessionDefinitions, sessions, snapshots, answers] = await Promise.all([
    prisma.mockExamSession.findMany({ where: { examId: attempt.examId } }),
    prisma.userExamSession.findMany({ where: { userExamId } }),
    prisma.userExamQuestion.findMany({ where: { userExamId } }),
    prisma.userAnswer.findMany({ where: { userExamId } }),
  ]);
  const examQuestions = await prisma.mockExamQuestion.findMany({
    where: { id: { in: snapshots.map((item) => item.examQuestionId) } },
  });
  const versions = await prisma.questionVersion.findMany({
    where: { id: { in: snapshots.map((item) => item.questionVersionId) } },
  });
  const subjects = await prisma.subject.findMany({
    where: { id: { in: examQuestions.map((item) => item.subjectId) } },
  });
  const definitionById = new Map(sessionDefinitions.map((item) => [item.id, item]));
  const examQuestionById = new Map(examQuestions.map((item) => [item.id, item]));
  const versionById = new Map(versions.map((item) => [item.id, item]));
  const subjectById = new Map(subjects.map((item) => [item.id, item]));

  return {
    userExamId: safeId(attempt.id),
    examId: safeId(attempt.examId),
    status: attempt.status,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    totalScore: asNumber(attempt.totalScore),
    passed: attempt.passed,
    paper: attempt.exam.sourcePdfUrl && attempt.exam.sourceExamYear ? {
      year: attempt.exam.sourceExamYear,
      pdfUrl: attempt.exam.sourcePdfUrl,
    } : null,
    sessions: sessions.map((session) => {
      const definition = definitionById.get(session.examSessionId);
      return {
        sessionNo: definition?.sessionNo,
        status: session.status,
        durationMinutes: definition?.durationMinutes,
        startedAt: session.startedAt?.toISOString() ?? null,
        expiresAt: session.expiresAt?.toISOString() ?? null,
      };
    }).sort((left, right) => (left.sessionNo ?? 0) - (right.sessionNo ?? 0)),
    questions: snapshots.map((snapshot) => {
      const examQuestion = examQuestionById.get(snapshot.examQuestionId);
      const version = versionById.get(snapshot.questionVersionId);
      const subject = examQuestion ? subjectById.get(examQuestion.subjectId) : undefined;
      if (!examQuestion || !version || !subject) {
        throw new Error("Attempt snapshot references missing exam data");
      }
      return {
        examQuestionId: safeId(snapshot.examQuestionId),
        subjectCode: subject.code,
        questionNo: examQuestion.questionNo,
        stem: version.stem,
        options: [version.option1, version.option2, version.option3, version.option4, version.option5],
      };
    }),
    answers: answers.map((answer) => ({
      examQuestionId: safeId(answer.examQuestionId),
      selectedAnswer: answer.selectedAnswer,
      version: safeId(answer.answerVersion),
      savedAt: answer.answeredAt.toISOString(),
    })),
  };
}

export async function startAttempt(examId: bigint, userId: bigint, requestId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const repeated = await tx.userExam.findUnique({ where: { startRequestId: requestId } });
    if (repeated) {
      assertOwned(userId, repeated.userId);
      if (repeated.examId !== examId) {
        throw new AttemptError(409, "REQUEST_ID_REUSED", "Request ID was used for another exam");
      }
      return { id: repeated.id, created: false };
    }

    const active = await tx.userExam.findFirst({
      where: { userId, examId, status: { in: ["CREATED", "IN_PROGRESS"] } },
      orderBy: { attemptNo: "desc" },
    });
    if (active) {
      return { id: active.id, created: false };
    }

    const exam = await tx.mockExam.findFirst({ where: { id: examId, status: "PUBLISHED" } });
    if (!exam) {
      throw new AttemptError(404, "EXAM_NOT_FOUND", "Published exam not found");
    }
    const sessionDefinitions = await tx.mockExamSession.findMany({
      where: { examId },
      orderBy: { sessionNo: "asc" },
    });
    const examQuestions = await tx.mockExamQuestion.findMany({ where: { examId } });
    if (sessionDefinitions.length === 0 || examQuestions.length === 0) {
      throw new AttemptError(422, "EXAM_NOT_READY", "Exam has no sessions or questions");
    }

    const latest = await tx.userExam.aggregate({
      where: { userId, examId },
      _max: { attemptNo: true },
    });
    const now = new Date();
    const firstSession = sessionDefinitions[0];
    const attempt = await tx.userExam.create({
      data: {
        userId,
        examId,
        attemptNo: (latest._max.attemptNo ?? 0) + 1,
        status: "IN_PROGRESS",
        startedAt: now,
        startRequestId: requestId,
      },
    });
    await tx.userExamSession.createMany({
      data: sessionDefinitions.map((session) => ({
        userExamId: attempt.id,
        examSessionId: session.id,
        status: session.id === firstSession.id ? "IN_PROGRESS" : "READY",
        startedAt: session.id === firstSession.id ? now : null,
        expiresAt: session.id === firstSession.id
          ? new Date(now.getTime() + session.durationMinutes * 60_000)
          : null,
      })),
    });
    await tx.userExamQuestion.createMany({
      data: examQuestions.map((question) => ({
        userExamId: attempt.id,
        examId,
        examQuestionId: question.id,
        questionId: question.questionId,
        questionVersionId: question.questionVersionId,
      })),
    });
    return { id: attempt.id, created: true };
  }, { isolationLevel: "Serializable" });

  return { attempt: await loadAttempt(result.id, userId), created: result.created };
}

export async function saveAnswer(input: {
  userExamId: bigint;
  userId: bigint;
  examQuestionId: bigint;
  selectedAnswer: number;
  expectedVersion: bigint;
  requestId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.userExam.findUnique({ where: { id: input.userExamId } });
    if (!attempt) {
      throw new AttemptError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
    }
    assertOwned(input.userId, attempt.userId);
    if (attempt.status !== "IN_PROGRESS") {
      throw new AttemptError(409, "EXAM_ALREADY_SUBMITTED", "Attempt is not in progress");
    }

    const snapshot = await tx.userExamQuestion.findUnique({
      where: { userExamId_examQuestionId: {
        userExamId: input.userExamId,
        examQuestionId: input.examQuestionId,
      } },
    });
    if (!snapshot) {
      throw new AttemptError(400, "QUESTION_NOT_IN_EXAM", "Question is not part of this attempt");
    }
    const examQuestion = await tx.mockExamQuestion.findUnique({ where: { id: input.examQuestionId } });
    const session = examQuestion && await tx.userExamSession.findUnique({
      where: { userExamId_examSessionId: {
        userExamId: input.userExamId,
        examSessionId: examQuestion.examSessionId,
      } },
    });
    const now = new Date();
    if (!session || session.status !== "IN_PROGRESS" || !session.expiresAt || session.expiresAt <= now) {
      throw new AttemptError(409, "EXAM_EXPIRED", "The question session is not active");
    }

    const repeated = await tx.userAnswer.findUnique({
      where: { userExamId_lastRequestId: {
        userExamId: input.userExamId,
        lastRequestId: input.requestId,
      } },
    });
    if (repeated) {
      return repeated;
    }
    const existing = await tx.userAnswer.findUnique({
      where: { userExamId_examQuestionId: {
        userExamId: input.userExamId,
        examQuestionId: input.examQuestionId,
      } },
    });
    if ((existing?.answerVersion ?? 0n) !== input.expectedVersion) {
      throw new AttemptError(409, "VERSION_CONFLICT", "Answer version is stale");
    }

    if (!existing) {
      return tx.userAnswer.create({ data: {
        userExamId: input.userExamId,
        examQuestionId: input.examQuestionId,
        selectedAnswer: input.selectedAnswer,
        answerVersion: 1n,
        lastRequestId: input.requestId,
        answeredAt: now,
      } });
    }
    const updated = await tx.userAnswer.updateMany({
      where: {
        userExamId: input.userExamId,
        examQuestionId: input.examQuestionId,
        answerVersion: input.expectedVersion,
      },
      data: {
        selectedAnswer: input.selectedAnswer,
        answerVersion: { increment: 1n },
        lastRequestId: input.requestId,
        answeredAt: now,
      },
    });
    if (updated.count !== 1) {
      throw new AttemptError(409, "VERSION_CONFLICT", "Answer was changed concurrently");
    }
    return tx.userAnswer.findUniqueOrThrow({
      where: { userExamId_examQuestionId: {
        userExamId: input.userExamId,
        examQuestionId: input.examQuestionId,
      } },
    });
  });
}

export async function submitAttempt(userExamId: bigint, userId: bigint, idempotencyKey: string) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.userExam.findUnique({ where: { id: userExamId } });
    if (!attempt) {
      throw new AttemptError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
    }
    assertOwned(userId, attempt.userId);
    if (attempt.status === "SUBMITTED" || attempt.status === "EXPIRED") {
      if (attempt.submitIdempotencyKey !== idempotencyKey) {
        throw new AttemptError(409, "EXAM_ALREADY_SUBMITTED", "Attempt was already submitted");
      }
      return resultResponse(tx, attempt.id);
    }

    const snapshots = await tx.userExamQuestion.findMany({ where: { userExamId } });
    const examQuestions = await tx.mockExamQuestion.findMany({
      where: { id: { in: snapshots.map((item) => item.examQuestionId) } },
    });
    const versions = await tx.questionVersion.findMany({
      where: { id: { in: snapshots.map((item) => item.questionVersionId) } },
      include: { acceptedAnswers: true },
    });
    const answers = await tx.userAnswer.findMany({ where: { userExamId } });
    const answerByQuestion = new Map(answers.map((answer) => [answer.examQuestionId, answer]));
    const versionById = new Map(versions.map((version) => [version.id, version]));
    const subjectIds = [...new Set(examQuestions.map((question) => question.subjectId))];
    const subjects = await tx.subject.findMany({ where: { id: { in: subjectIds } } });

    for (const answer of answers) {
      const snapshot = snapshots.find((item) => item.examQuestionId === answer.examQuestionId);
      const version = snapshot && versionById.get(snapshot.questionVersionId);
      await tx.userAnswer.update({
        where: { userExamId_examQuestionId: { userExamId, examQuestionId: answer.examQuestionId } },
        data: { isCorrect: isAcceptedAnswer(version, answer.selectedAnswer) },
      });
    }
    const now = new Date();
    const wrongSnapshots = snapshots.filter((snapshot) => {
      const version = versionById.get(snapshot.questionVersionId);
      return !isAcceptedAnswer(version, answerByQuestion.get(snapshot.examQuestionId)?.selectedAnswer);
    });
    if (wrongSnapshots.length > 0) {
      await tx.wrongHistory.createMany({
        data: wrongSnapshots.map((snapshot) => ({
          userId,
          questionId: snapshot.questionId,
          questionVersionId: snapshot.questionVersionId,
          userExamId,
          selectedAnswer: answerByQuestion.get(snapshot.examQuestionId)?.selectedAnswer ?? null,
          attemptedAt: now,
        })),
      });
      for (const snapshot of wrongSnapshots) {
        await tx.wrongNote.upsert({
          where: { userId_questionId: { userId, questionId: snapshot.questionId } },
          create: { userId, questionId: snapshot.questionId, reviewStatus: "NEW", updatedAt: now },
          update: { updatedAt: now },
        });
      }
    }
    const scores: number[] = [];
    for (const subject of subjects) {
      const subjectQuestions = examQuestions.filter((question) => question.subjectId === subject.id);
      const correctCount = subjectQuestions.filter((question) => {
        const snapshot = snapshots.find((item) => item.examQuestionId === question.id);
        const version = snapshot && versionById.get(snapshot.questionVersionId);
        return isAcceptedAnswer(version, answerByQuestion.get(question.id)?.selectedAnswer);
      }).length;
      const score = subjectQuestions.length === 0 ? 0 : correctCount * 100 / subjectQuestions.length;
      scores.push(score);
      await tx.userExamSubjectResult.upsert({
        where: { userExamId_subjectId: { userExamId, subjectId: subject.id } },
        create: { userExamId, subjectId: subject.id, correctCount, score, passedCutoff: score >= 40 },
        update: { correctCount, score, passedCutoff: score >= 40 },
      });
    }
    const average = scores.length === 0 ? 0 : scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const passed = scores.every((score) => score >= 40) && average >= 60;
    await tx.userExamSession.updateMany({
      where: { userExamId, status: { in: ["READY", "IN_PROGRESS"] } },
      data: { status: "SUBMITTED", submittedAt: now },
    });
    await tx.userExam.update({
      where: { id: userExamId },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        totalScore: average,
        passed,
        submitIdempotencyKey: idempotencyKey,
        rowVersion: { increment: 1n },
      },
    });
    return resultResponse(tx, userExamId);
  }, { isolationLevel: "Serializable" });
}

async function resultResponse(tx: Prisma.TransactionClient, userExamId: bigint) {
  const [attempt, results, subjects] = await Promise.all([
    tx.userExam.findUniqueOrThrow({ where: { id: userExamId } }),
    tx.userExamSubjectResult.findMany({ where: { userExamId } }),
    tx.subject.findMany(),
  ]);
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  return {
    userExamId: safeId(userExamId),
    subjectScores: Object.fromEntries(results.map((result) => [
      subjectById.get(result.subjectId)?.code ?? result.subjectId.toString(),
      result.score.toNumber(),
    ])),
    average: attempt.totalScore?.toNumber() ?? 0,
    passed: attempt.passed ?? false,
  };
}

function isAcceptedAnswer(
  version: { correctAnswer: number; acceptedAnswers: { answer: number }[] } | undefined,
  selectedAnswer: number | null | undefined,
) {
  if (!version || !selectedAnswer) return false;
  return version.acceptedAnswers.length === 0
    ? version.correctAnswer === selectedAnswer
    : version.acceptedAnswers.some((item) => item.answer === selectedAnswer);
}