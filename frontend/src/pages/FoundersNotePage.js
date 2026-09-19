import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FoundersNotePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen pb-32 lg:pl-80" style={{ background: '#0a0a1a' }} data-testid="founders-note-page">
      <div className="w-full max-w-2xl mx-auto px-6 sm:px-10 lg:px-12 pt-6 sm:pt-10">
        <Link to="/profile" className="inline-flex items-center gap-2 text-[#a0a0b8] hover:text-white text-sm mb-8" data-testid="back-btn">
          <ChevronLeft className="w-4 h-4" />
          Back to Profile
        </Link>

        <h1 className="text-3xl sm:text-4xl text-white mb-10" data-testid="founders-note-title">
          A Note From The Founder
        </h1>

        <div className="space-y-6 text-[#d4d4e0] text-sm sm:text-base leading-relaxed" data-testid="founders-note-body">
          <p>
            I built HORMOscope after cancer forced me to actually listen to my body for the first time.
          </p>

          <p>
            For years, I ignored the signs. Pushed through. Apologized for being "too emotional" or "too sensitive." I thought something was wrong with me.
          </p>

          <p>
            Then I got sick. And I had to pay attention.
          </p>

          <p>
            That's when I realized my body had been telling me everything all along. I just didn't know how to read it.
          </p>

          <p>
            So I built HORMOscope to translate what your cycle is trying to tell you. Not astrology. Your actual hormones.
          </p>

          <p className="text-[#F4D3DC]">
            Because you shouldn't have to get sick to start listening.
          </p>
        </div>

        <div className="mt-12 pt-8">
          <div className="flex items-center gap-4">
            <img 
              src="https://customer-assets.emergentagent.com/job_e50c2d92-7748-4a4a-9e13-69705a94ca58/artifacts/95z2mabt_1000007702.png"
              alt="Angelita Braaten"
              className="w-14 h-14 rounded-full object-cover border-2 border-[#D4A853]/40 shadow-[0_0_20px_rgba(212,168,83,0.25)]"
              data-testid="founder-photo"
            />
            <div>
              <p className="text-white text-base">Angelita Braaten</p>
              <p className="text-[#a0a0b8] text-sm">Founder, HORMOscope</p>
              <p className="text-[#c9b8f0] text-sm mt-1">HORMOscope.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
