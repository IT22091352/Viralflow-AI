import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-violet-500/30 font-sans pb-24">
      {/* Navbar Simple */}
      <nav className="border-b border-white/10 bg-[#050816]/70 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition">
            <ArrowLeft size={18} /> Back to Home
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 pt-16">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 md:p-12 backdrop-blur-md shadow-[0_0_60px_rgba(15,23,42,0.35)]">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-8">Terms of Service</h1>
          <div className="space-y-8 text-white/70 leading-relaxed text-sm md:text-base">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Introduction</h2>
              <p>Welcome to ViralFlow AI. By using our website and services, you agree to comply with and be bound by the following terms and conditions. If you disagree with any part of these terms, please do not use our service.</p>
            </section>
            
            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Description of Service</h2>
              <p>ViralFlow AI provides an AI-powered video transcription and subtitle generation software-as-a-service (SaaS). We offer both free and premium (PRO) tiers with varying features, rendering capabilities, and customization options.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. User Accounts & Subscriptions</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>You must create an account to download processed videos.</li>
                <li>PRO subscriptions are billed as specified during the checkout process (via our merchant of record).</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Acceptable Use & Fair Usage</h2>
              <p>You agree not to use ViralFlow AI to process illegal, highly explicit, or copyrighted material you do not own. We reserve the right to suspend accounts that abuse the platform, employ automated bots, or exceed standard fair-use bandwidth limits.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Limitation of Liability</h2>
              <p>ViralFlow AI is provided "as is" without warranties of any kind. We are not liable for any direct, indirect, or consequential damages resulting from the use or inability to use our services, including transcription inaccuracies.</p>
            </section>

            <p className="pt-8 text-xs text-white/40 border-t border-white/10">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </main>
    </div>
  );
}