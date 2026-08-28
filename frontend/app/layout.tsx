import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "공인중개사 모의고사",
  description: "2026 공인중개사 시험 대비 모의고사",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}