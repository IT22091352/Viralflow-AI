import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-violet-500/30 font-sans pb-24">
      <nav className="border-b border-white/10 bg-[#050816]/70 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition">
            <ArrowLeft size={18} /> Back to Home
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 pt-16">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 md:p-12 backdrop-blur-md shadow-[0_0_60px_rgba(15,23,42,0.35)]">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-8">Privacy Policy</h1>
          <div className="space-y-8 text-white/70 leading-relaxed text-sm md:text-base">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
              <p>When you use ViralFlow AI, we may collect the following data:</p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li><strong>Account Information:</strong> Email address and basic profile data securely handled by our authentication provider (Clerk).</li>
                <li><strong>Media Files:</strong> Video and audio files you upload for transcription.</li>
                <li><strong>Usage Data:</strong> Basic analytics regarding how you interact with our platform.</li>
              </ul>
            </section>
            
            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
              <p>Your media files are strictly used for the purpose of generating subtitles. We utilize third-party infrastructure (Cloudinary for media hosting and OpenAI for AI transcription). Files are temporarily stored to process your request and are not used to train our own AI models without your consent.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Third-Party Services</h2>
              <p>We rely on trusted third-party services to operate ViralFlow AI:</p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li><strong>Authentication:</strong> Clerk handles your login and session data.</li>
                <li><strong>Payments:</strong> All payments are securely processed by our Merchant of Record (e.g., Lemon Squeezy). We do not store your credit card information.</li>
                <li><strong>Processing:</strong> Cloudinary and OpenAI process the media files.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Data Security</h2>
              <p>We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>
            </section>

            <p className="pt-8 text-xs text-white/40 border-t border-white/10">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </main>
    </div>
  );
}