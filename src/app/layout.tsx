import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GameVault — Your Gaming Journal & Backlog Tracker",
  description:
    "Track what you're playing right now, mark games as finished with the exact date, rate them, log sessions and watch your gaming story unfold. Powered by Steam data.",
  keywords: ["game tracker", "backlog", "gaming journal", "completed games", "play sessions"],
  authors: [{ name: "GameVault" }],
  openGraph: {
    title: "GameVault",
    description: "Your gaming journal & backlog tracker",
    siteName: "GameVault",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <div className="app-bg" aria-hidden="true" />
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
