import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';

const inter = Inter({ subsets: ["latin"] });

// 🟢 Ultimate SEO & Social Media Meta Tags with Real Domain
export const metadata: Metadata = {
  metadataBase: new URL("https://viralflow-ai-tawny.vercel.app"),
  title: "ViralFlow AI | The Ultimate AI Caption Generator",
  description: "Transform raw footage into viral social assets. Let AI auto-generate perfectly synced, cinematic subtitles in seconds. Perfect for TikTok, Reels, and Shorts.",
  keywords: ["AI captions", "video subtitles", "viral video editor", "auto captions", "TikTok captions", "Reels editor", "shorts captions", "video transcription"],
  authors: [{ name: "ViralFlow AI Team" }],
  
  openGraph: {
    title: "ViralFlow AI | Add Viral Captions to Videos in Seconds",
    description: "Transform raw footage into viral social assets. Auto-generate perfectly synced, cinematic subtitles in seconds.",
    url: "https://viralflow-ai-tawny.vercel.app/", 
    siteName: "ViralFlow AI",
    images: [
      {
        url: "/opengraph-image.png", 
        width: 1200,
        height: 630,
        alt: "ViralFlow AI - Premium Video Subtitle Generator",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "ViralFlow AI | The Ultimate AI Caption Generator",
    description: "Auto-generate perfectly synced, cinematic subtitles in seconds. Perfect for TikTok, Reels, and Shorts.",
    images: ["/opengraph-image.png"], 
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}