import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOPHRO",
  description: "MOPHRO project collaboration workspace",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
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
