import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Mail, MessageCircle, Sparkles } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen pb-32 lg:pb-8 lg:pl-72 p-6">
      <Link to="/profile" className="inline-flex items-center gap-2 text-[#9A8B91] hover:text-[#FDF8FA] mb-8">
        <ChevronLeft className="w-5 h-5" />
        Back
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F4D3DC] to-[#E8A4B8] flex items-center justify-center">
          <Mail className="w-6 h-6 text-[#0D0609]" />
        </div>
        <h1 className="text-4xl text-[#F4D3DC] font-script">
          Contact Us
        </h1>
      </div>

      {/* Beta Notice */}
      <div className="glass-card-glow p-6 mb-6 border border-[#F4D3DC]/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#F4D3DC]/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#F4D3DC]" />
          </div>
          <div>
            <h2 className="text-[#F4D3DC] font-medium mb-2">We&apos;re in Beta!</h2>
            <p className="text-[#C9B8C1] text-sm leading-relaxed">
              HORMOscope is currently in beta. If you have any issues, suggestions, or feedback, please let me know! Your input helps make this app better for all women.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Email Contact */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-medium text-[#FDF8FA] mb-4">
            Get In Touch
          </h2>
          <p className="text-[#9A8B91] mb-4 text-sm">
            Have questions, found a bug, or want to suggest a feature? Send me a message!
          </p>
          <a 
            href="mailto:hormoscope@gmail.com?subject=horMoscope%20Beta%20Feedback"
            className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-[#F4D3DC]/20 hover:border-[#F4D3DC]/40 transition-colors"
          >
            <Mail className="w-6 h-6 text-[#F4D3DC]" />
            <div>
              <p className="text-[#FDF8FA] font-medium">Email Me</p>
              <p className="text-[#F4D3DC] text-sm">hormoscope@gmail.com</p>
            </div>
          </a>
        </div>

        {/* Feedback */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-medium text-[#FDF8FA] mb-4">
            Share Your Thoughts
          </h2>
          <p className="text-[#9A8B91] mb-4 text-sm">
            Love something? Hate something? I want to hear it all. Your feedback shapes the future of HORMOscope.
          </p>
          <a 
            href="mailto:hormoscope@gmail.com?subject=HORMOscope%20Suggestion&body=Hi!%0A%0AI%20have%20a%20suggestion%20for%20HORMOscope%3A%0A%0A"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#F4D3DC] to-[#E8A4B8] text-[#0D0609] font-medium text-sm"
          >
            <MessageCircle className="w-5 h-5" />
            Send Feedback
          </a>
        </div>

        {/* Quick Links */}
        <div className="bento-card p-5">
          <h2 className="text-sm font-medium text-[#FDF8FA] mb-4">Quick Links</h2>
          <div className="space-y-3 text-sm">
            <Link to="/" className="block text-[#9A8B91] hover:text-[#F4D3DC] transition-colors">
              → Home Dashboard
            </Link>
            <Link to="/chat" className="block text-[#9A8B91] hover:text-[#F4D3DC] transition-colors">
              → HORMOscope
            </Link>
            <Link to="/calendar" className="block text-[#9A8B91] hover:text-[#F4D3DC] transition-colors">
              → Cycle Calendar
            </Link>
            <Link to="/subscription" className="block text-[#9A8B91] hover:text-[#F4D3DC] transition-colors">
              → Premium Features
            </Link>
            <Link to="/privacy" className="block text-[#9A8B91] hover:text-[#F4D3DC] transition-colors">
              → Privacy Policy
            </Link>
            <Link to="/terms" className="block text-[#9A8B91] hover:text-[#F4D3DC] transition-colors">
              → Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
