import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// 全局字体：展示用无衬线 + 小标签用等宽字体，呼应品牌视觉规范
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shipping Doc Verifier",
  description: "Averis x Monash Hackathon 2026 — 航运单证核验：邮件分类、字段抽取、BL/SI 比对一次跑通。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 根布局只提供字体和全局样式，不再固定导航/容器——
  // 各个区域（营销首页 / 控制台 / 功能页）各自决定自己的外壳，见对应 layout.tsx
  return (
    <html lang="zh" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
