"use client";

import { FormEvent, useEffect, useState } from "react";

export default function AccountPage() {
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setToken(window.localStorage.getItem("gt-exam-token") ?? "");
  }, []);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setNotice("대시보드에서 로그인한 뒤 비밀번호를 변경하세요.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/password", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
      }),
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) {
      setNotice(result.message ?? "비밀번호를 변경하지 못했습니다.");
      return;
    }

    event.currentTarget.reset();
    setNotice("비밀번호를 변경했습니다.");
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brandMark">GT</span><span>2026 공인중개사 모의고사</span></div>
        <a className="iconButton" href="/" aria-label="모의고사" title="모의고사">&larr;</a>
      </header>
      <section className="workspace" aria-labelledby="account-title">
        <div className="headingRow"><div><p className="eyebrow">MY ACCOUNT</p><h1 id="account-title">비밀번호 변경</h1></div></div>
        <form className="dashboardLogin" onSubmit={changePassword}>
          <label>현재 비밀번호<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>새 비밀번호<input name="newPassword" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label>
          <button className="secondaryButton" type="submit">변경</button>
        </form>
        {notice && <p className="formNotice">{notice}</p>}
      </section>
    </main>
  );
}