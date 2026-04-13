import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, MessageSquare } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-violet-500/30 font-sans pb-24">
      <nav className="border-b border-white/10 bg-[#050816]/70 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition">
            <ArrowLeft size={18} /> Back to Home
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 pt-24 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 text-violet-300 mb-6">
          <MessageSquare size={28} />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">Contact Support</h1>
        <p className="text-white/60 text-lg mb-12 max-w-xl mx-auto">
          Need help with your PRO subscription, or experiencing a bug? Our team is here to help you out.
        </p>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 md:p-12 backdrop-blur-md shadow-[0_0_60px_rgba(15,23,42,0.35)] flex flex-col items-center">
          <Mail size={40} className="text-white/40 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">Email Us</h2>
          <p className="text-white/60 mb-8 text-center max-w-sm">
            Send us an email and we'll get back to you within 24-48 hours.
          </p>
          
          {/* මෙතන ඔයාගේ ඇත්ත Email එක දාන්න */}
          <a 
            href="mailto:support@viralflow.ai" 
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(168,85,247,0.25)] transition hover:scale-[1.02]"
          >
            support@viralflow.ai
          </a>
        </div>
      </main>
    </div>
  );
}