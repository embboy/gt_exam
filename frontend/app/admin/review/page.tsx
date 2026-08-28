"use client";

import { ClipboardCheck, FileSearch, LogIn, Send } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Subject = { subjectId: number; code: string; name: string };
type SourceItem = { sourceImportItemId: number; page: number; column: string | null; rawText: string; source: { year: number | null; title: string }; drafts: { questionNo: number; reviewStatus: string }[] };
type AnswerItem = { sourceImportItemId: number; year: number | null; title: string; page: number; verificationStatus: string };
type Queue = { subjects: Subject[]; sourceItems: SourceItem[]; answerEvidenceItems: AnswerItem[] };

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message : "요청을 처리하지 못했습니다.";
    throw new Error(message);
  }
  return payload as T;
}

export default function ReviewPage() {
  const [token, setToken] = useState("");
  const [queue, setQueue] = useState<Queue | null>(null);
  const [selected, setSelected] = useState<SourceItem | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => { setToken(window.localStorage.getItem("gt-exam-review-token") ?? ""); }, []);

  async function loadQueue(activeToken = token) {
    try {
      setQueue(await api<Queue>("/api/v1/admin/review-queue", activeToken));
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "검수 대기열을 불러오지 못했습니다.");
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const payload = await result.json() as { accessToken?: string; message?: string };
      if (!result.ok || !payload.accessToken) throw new Error(payload.message ?? "로그인에 실패했습니다.");
      window.localStorage.setItem("gt-exam-review-token", payload.accessToken);
      setToken(payload.accessToken);
      await loadQueue(payload.accessToken);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "로그인에 실패했습니다.");
    }
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const options = [1, 2, 3, 4, 5].map((number) => String(form.get(`option${number}`) ?? ""));
    try {
      await api("/api/v1/admin/source-question-drafts", token, { method: "POST", body: JSON.stringify({
        sourceImportItemId: selected.sourceImportItemId, subjectId: Number(form.get("subjectId")), sourceQuestionNo: Number(form.get("questionNo")),
        stem: form.get("stem"), options, proposedAnswer: form.get("answer") ? Number(form.get("answer")) : null,
        answerEvidenceImportItemId: form.get("answerEvidence") ? Number(form.get("answerEvidence")) : null,
        difficulty: Number(form.get("difficulty")), explanation: form.get("explanation"), examReferenceDate: form.get("referenceDate"),
      }) });
      setNotice("검수 초안을 등록했습니다. 최종 승인은 관리자만 수행할 수 있습니다.");
      await loadQueue();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "초안을 등록하지 못했습니다.");
    }
  }

  if (!token) {
    return <main className="reviewShell"><section className="reviewLogin" aria-labelledby="review-login-title"><ClipboardCheck size={32} /><p className="eyebrow">QUESTION REVIEW</p><h1 id="review-login-title">문항 검수</h1><form onSubmit={signIn}><label>이메일<input name="email" type="email" required autoComplete="email" /></label><label>비밀번호<input name="password" type="password" required autoComplete="current-password" /></label><button className="primaryButton" type="submit"><LogIn size={17} />로그인</button></form>{notice && <p className="formNotice">{notice}</p>}</section></main>;
  }

  return <main className="reviewShell"><header className="reviewHeader"><div><p className="eyebrow">QUESTION REVIEW</p><h1>기출 문항 검수</h1></div><button className="secondaryButton" type="button" onClick={() => loadQueue()}><FileSearch size={17} />대기열 새로고침</button></header>{notice && <p className="formNotice">{notice}</p>}{!queue ? <p>대기열을 불러오는 중입니다.</p> : <div className="reviewLayout"><aside className="queueList"><h2>OCR 대기열</h2>{queue.sourceItems.map((item) => <button className={selected?.sourceImportItemId === item.sourceImportItemId ? "queueItem selected" : "queueItem"} key={item.sourceImportItemId} onClick={() => setSelected(item)} type="button"><strong>{item.source.year}년 · {item.source.title}</strong><span>{item.page}쪽 {item.column ?? ""} · 등록 {item.drafts.length}건</span></button>)}</aside><section className="reviewEditor">{selected ? <><div className="sourceText"><h2>원문 OCR</h2><pre>{selected.rawText}</pre></div><form className="draftForm" onSubmit={createDraft}><h2>문항 정정</h2><div className="formGrid"><label>과목<select name="subjectId" required>{queue.subjects.map((subject) => <option key={subject.subjectId} value={subject.subjectId}>{subject.name}</option>)}</select></label><label>문항 번호<input name="questionNo" type="number" min="1" max="40" required /></label><label>난이도<select name="difficulty" defaultValue="3">{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>시험 기준일<input name="referenceDate" type="date" defaultValue="2026-10-31" required /></label></div><label>지문<textarea name="stem" minLength={10} required /></label>{[1, 2, 3, 4, 5].map((number) => <label key={number}>보기 {number}<input name={`option${number}`} required /></label>)}<div className="formGrid"><label>정답<select name="answer" required><option value="">선택</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>공식 정답 증거<select name="answerEvidence" required><option value="">선택</option>{queue.answerEvidenceItems.filter((item) => item.year === selected.source.year).map((item) => <option key={item.sourceImportItemId} value={item.sourceImportItemId}>{item.title} · {item.page}쪽 · {item.verificationStatus}</option>)}</select></label></div><label>해설<textarea name="explanation" required /></label><button className="primaryButton" type="submit"><Send size={17} />검수 초안 등록</button></form></> : <p className="reviewEmpty">왼쪽에서 OCR 원문을 선택하세요.</p>}</section></div>}</main>;
}