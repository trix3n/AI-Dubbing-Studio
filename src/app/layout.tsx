import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LONGRAY — AI Dubbing Studio",
  description: "A private workspace for Russian to Vietnamese interviews.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
