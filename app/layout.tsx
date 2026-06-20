import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { VaultProvider } from "@/lib/vault/VaultContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Tracker",
  description: "A local-first personal finance tracker with an AI planner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <VaultProvider>{children}</VaultProvider>
      </body>
    </html>
  );
}
