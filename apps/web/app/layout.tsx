import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaudeRoulette — Build something with a stranger",
  description:
    "Get randomly matched with another developer for a 30-minute AI-powered coding jam session.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface text-zinc-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
