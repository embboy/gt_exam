"use client";

import { ArrowRight, BookOpenCheck, Clock3, LogIn, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Stage = 1 | 2;
type ExamKind = "PAST_EXAM" | "PREDICTED";
type Exam = { examId: number; setNo: number; title: string; sessions: { sessionNo: number; durationMinutes: number }[] };

export default function ExamDashboard() {
  const [stage, setStage] = useState<Stage>(1);
  const [kind, setKind] = useState<ExamKind>("PAST_EXAM");
  const [token, setToken] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [notice, setNotice] = useState("");
  const meta = stage === 1 ? { subjects: 2, questions: 80, sessions: "1교시 · 100분" } : { subjects: 3, questions: 120, sessions: "2교시 · 100분 + 50분" };

  useEffect(() => { setToken(window.localStorage.getItem("gt-exam-token") ?? ""); }, []);
  useEffect(() => { void loadExams(); }, [kind, stage]);
  async function loadExams() { const response = await fetch(`/api/v1/exams?kind=${kind}&stage=${stage}`); if (response.ok) setExams(await response.json() as Exam[]); else setNotice("시험 목록을 불러오지 못했습니다."); }
  async function signIn(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) }); const result = await response.json() as { accessToken?: string; message?: string }; if (!response.ok || !result.accessToken) { setNotice(result.message ?? "로그인에 실패했습니다."); return; } window.localStorage.setItem("gt-exam-token", result.accessToken); setToken(result.accessToken); }
  async function startExam(examId: number) { if (!token) { setNotice("시험을 시작하려면 로그인하세요."); return; } const response = await fetch(`/api/v1/exams/${examId}/start`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "X-Request-Id": crypto.randomUUID() } }); const result = await response.json() as { userExamId?: number; message?: string }; if (!response.ok || !result.userExamId) { setNotice(result.message ?? "시험을 시작하지 못했습니다."); return; } window.location.assign(`/exam/${result.userExamId}`); }

  return <main><header className="topbar"><div className="brand"><span className="brandMark">GT</span><span>2026 공인중개사 모의고사</span></div><a className="iconButton" href="/wrong-notes" aria-label="오답노트" title="오답노트"><BookOpenCheck size={19} /></a></header><section className="workspace" aria-labelledby="page-title"><div className="headingRow"><div><p className="eyebrow">MY EXAMS</p><h1 id="page-title">모의고사</h1></div><div className="examDate"><Clock3 size={18} /> 2026.10.31 기준</div></div><div className="modeTabs">{(["PAST_EXAM", "PREDICTED"] as const).map((value) => <button key={value} className={kind === value ? "active" : ""} onClick={() => setKind(value)} type="button">{value === "PAST_EXAM" ? "기출 모의고사" : "예상 모의고사"}</button>)}</div><div className="stageTabs">{([1, 2] as const).map((value) => <button key={value} className={stage === value ? "active" : ""} onClick={() => setStage(value)} type="button">제{value}차 시험</button>)}</div><div className="summaryBand"><div><strong>{meta.subjects}</strong><span>시험과목 단위</span></div><div><strong>{meta.questions}</strong><span>전체 문항</span></div><div><strong>{meta.sessions}</strong><span>시험 구성</span></div><div className="rule"><ShieldCheck size={20} /><span>과목 40점 이상 · 평균 60점 이상</span></div></div>{!token && <form className="dashboardLogin" onSubmit={signIn}><label>이메일<input name="email" type="email" required /></label><label>비밀번호<input name="password" type="password" required /></label><button className="secondaryButton" type="submit"><LogIn size={17} />로그인</button></form>}{notice && <p className="formNotice">{notice}</p>}<div className="listHeader"><h2>{kind === "PAST_EXAM" ? "기출" : "예상"} 제{stage}차 시험</h2><span>{exams.length}개 공개</span></div><div className="examList">{exams.map((exam) => <article className="examRow" key={exam.examId}><div className="setNumber">{String(exam.setNo).padStart(2, "0")}</div><div className="examInfo"><h3>{exam.title}</h3><p>{exam.sessions.map((session) => `${session.sessionNo}교시 ${session.durationMinutes}분`).join(" · ")} · {meta.questions}문항</p></div><div className="status status-ready">응시 가능</div><button className="primaryButton" type="button" onClick={() => startExam(exam.examId)}>시작<ArrowRight size={18} /></button></article>)}{exams.length === 0 && <p className="reviewEmpty">검수와 게시를 완료한 시험이 아직 없습니다.</p>}</div></section></main>;
}