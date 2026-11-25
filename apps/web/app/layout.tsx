import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SOLVEX — Beyond Tickets. Predicting Problems.",
    template: "%s | SOLVEX",
  },
  description:
    "A smarter support operations platform. Resolve customer issues sooner with predictive SLA intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
