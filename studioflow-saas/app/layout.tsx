import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudioFlow",
  description: "Internal order and retouch workflow for photo studios"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
