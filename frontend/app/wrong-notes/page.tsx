"use client";

import { BookOpenCheck, CheckCircle2, LogIn, RotateCcw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type WrongItem = { questionId: number; subjectCode: string; subjectName: string; stem: string; options: string[]; correctAnswer: number; explanation: string; selectedAnswer: number | null; wrongCount: number; reviewStatus: "NEW" | "REVIEWING" | "MASTERED"; note: string | null };
type WrongNotes = { items: WrongItem[]; summary: { subjectCode: string; subjectName: string; wrongCount: number }[] };

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof value === "object" && value && "message" in value && typeof value.message === "string" ? value.message : "요청을 처리하지 못했습니다.");
  return value as T;
}

export default function WrongNotesPage() {
  const [token, setToken] = useState("");
  const [notes, setNotes] = useState<WrongNotes | null>(null);
  const [selected, setSelected] = useState<WrongItem | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { setToken(window.localStorage.getItem("gt-exam-token") ?? ""); }, []);
  useEffect(() => { if (token) loadNotes(token); }, [token]);
  async function loadNotes(activeToken: string) { try { const data = await request<WrongNotes>("/api/v1/me/wrong-notes", activeToken); setNotes(data); setSelected((current) => data.items.find((item) => item.questionId === current?.questionId) ?? data.items[0] ?? null); } catch (error) { setMessage(error instanceof Error ? error.message : "오답노트를 불러오지 못했습니다."); } }
  async function signIn(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); try { const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) }); const result = await response.json() as { accessToken?: string; message?: string }; if (!response.ok || !result.accessToken) throw new Error(result.message ?? "로그인에 실패했습니다."); window.localStorage.setItem("gt-exam-token", result.accessToken); setToken(result.accessToken); } catch (error) { setMessage(error instanceof Error ? error.message : "로그인에 실패했습니다."); } }
  async function updateNote(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const data = new FormData(event.currentTarget); try { await request(`/api/v1/me/wrong-notes/${selected.questionId}/review`, token, { method: "POST", body: JSON.stringify({ reviewStatus: data.get("reviewStatus"), note: data.get("note") || null }) }); setMessage("오답노트를 저장했습니다."); await loadNotes(token); } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); } }
  if (!token) return <main className="reviewShell"><section className="reviewLogin" aria-labelledby="wrong-login-title"><BookOpenCheck size={32} /><p className="eyebrow">MY WRONG NOTES</p><h1 id="wrong-login-title">오답노트</h1><form onSubmit={signIn}><label>이메일<input name="email" type="email" autoComplete="email" required /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label><button className="primaryButton" type="submit"><LogIn size={17} />로그인</button></form>{message && <p className="formNotice">{message}</p>}</section></main>;
  return <main className="reviewShell"><header className="reviewHeader"><div><p className="eyebrow">MY WRONG NOTES</p><h1>다시 풀 문제</h1></div><button className="secondaryButton" type="button" onClick={() => loadNotes(token)}><RotateCcw size={17} />새로고침</button></header>{message && <p className="formNotice">{message}</p>}{!notes ? <p>오답노트를 불러오는 중입니다.</p> : <div className="wrongLayout"><aside className="wrongList"><h2>과목별 오답</h2>{notes.summary.map((item) => <p key={item.subjectCode}>{item.subjectName}<strong>{item.wrongCount}</strong></p>)}<h2>문항</h2>{notes.items.map((item) => <button type="button" key={item.questionId} className={item.questionId === selected?.questionId ? "queueItem selected" : "queueItem"} onClick={() => setSelected(item)}><strong>{item.subjectName}</strong><span>{item.wrongCount}회 오답 · {item.reviewStatus}</span></button>)}</aside><section className="wrongDetail">{selected ? <><p className="questionMeta">{selected.subjectName} · 누적 오답 {selected.wrongCount}회</p><h2>{selected.stem}</h2><ol className="optionList">{selected.options.map((option, index) => <li key={option} className={index + 1 === selected.correctAnswer ? "correct" : index + 1 === selected.selectedAnswer ? "incorrect" : ""}>{option}</li>)}</ol><div className="answerPanel"><p><CheckCircle2 size={18} /> 정답 {selected.correctAnswer}번</p><p>{selected.explanation}</p></div><form className="draftForm" onSubmit={updateNote}><label>학습 상태<select name="reviewStatus" defaultValue={selected.reviewStatus}><option value="NEW">새 오답</option><option value="REVIEWING">복습 중</option><option value="MASTERED">숙지 완료</option></select></label><label>개인 메모<textarea name="note" defaultValue={selected.note ?? ""} /></label><button className="primaryButton" type="submit">저장</button></form></> : <p className="reviewEmpty">아직 오답 문항이 없습니다.</p>}</section></div>}</main>;
}