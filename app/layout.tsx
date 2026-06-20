import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { VaultProvider } from "@/lib/vault/VaultContext";
import { ThemeProvider, themeInitScript } from "@/lib/theme/ThemeContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Tracker",
  description: "A local-first personal finance tracker with an AI planner.",
};

export const viewport: Viewport = {
  // Mobile-friendly: edge-to-edge layout and a theme-aware browser chrome.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(98% 0.004 165)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(17% 0.01 165)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before paint; light by default.
            suppressHydrationWarning so a browser extension that rewrites this
            inline script (a common cause of hydration diffs) doesn't error. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <VaultProvider>{children}</VaultProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
