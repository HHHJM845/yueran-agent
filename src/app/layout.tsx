import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIGC 视频项目协同工作台",
  description: "内部 AIGC 视频项目商业业务与创意提案协同系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
