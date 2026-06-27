import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentOS",
  description: "AI-powered talent discovery, learning and recruitment platform"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
