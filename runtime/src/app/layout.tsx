import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Adding explicit font display strategy to avoid FOUT (Flash of Unstyled Text)
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap", // Ensures text remains visible during font loading
  preload: true,
  fallback: ["system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap", // Ensures text remains visible during font loading
  preload: true,
  fallback: ["monospace"],
});

export const metadata: Metadata = {
  title: "Compression-Prediction Explorer",
  description: "Interactive demonstration of the compression-prediction equivalence.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" data-theme="bumblebee" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        style={{ fontFamily: "var(--font-sans, var(--font-sans-fallback))" }}
      >
        {children}
      </body>
    </html>
  );
}
