import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

// Adding explicit font display strategy to avoid FOUT (Flash of Unstyled Text)
const inter = Inter({
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

const SITE_URL = "https://surprisal.party";
const TITLE = "Surprisal Party";
const DESCRIPTION =
  "Predictable words carry little information, surprising words carry a lot. Drag the slider to compress a text down to the kernel a predictor couldn't have guessed.";
// 1200×630 preview card at public/og.png → served at /og.png (resolved via metadataBase).
const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: TITLE,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: TITLE,
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
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
        className={`${inter.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-ground text-prose`}
        style={{ fontFamily: "var(--font-sans, var(--font-sans-fallback))" }}
      >
        {children}
      </body>
    </html>
  );
}
