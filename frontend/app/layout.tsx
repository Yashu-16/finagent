import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinAgent — AI Boardroom",
  description: "Multi-agent strategic decision simulation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}