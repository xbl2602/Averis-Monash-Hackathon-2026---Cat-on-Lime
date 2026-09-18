import type { Metadata } from "next";
import { Nav } from "./core/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shipping Doc Verifier",
  description: "Averis x Monash Hackathon 2026 — 航运单证核验",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
