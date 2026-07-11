import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bainsla Music Tags — YouTube Tag, Title & Trend Studio",
  description:
    "Real high-rank titles, premium 500-char tags, thumbnails, hashtags, keyword research, rank checker and a viral-trend monitor for YouTube. Web dashboard + Chrome extension.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
