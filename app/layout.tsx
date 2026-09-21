import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./_components/providers";
import { THEME_INIT_SCRIPT } from "./_components/theme";

// Global fonts: sans-serif for display text, monospace for small labels
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
  description:
    "Classify shipping emails, extract shipment fields from SI and BL attachments, and catch mismatches before a Bill of Lading is finalized.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The root layout only provides fonts, global styles and the theme bootstrap.
  // Each area (landing page / dashboard / feature pages) supplies its own shell.
  // The inline script sets data-theme before first paint, so React must not
  // complain that <html> differs from the server markup (suppressHydrationWarning).
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
