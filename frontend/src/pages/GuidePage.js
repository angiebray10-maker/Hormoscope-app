import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Instructional Guide — the one home for how to use HORMOscope, living on
// the Profile tab next to the Founder's Note (Angelita, Oct 17; refreshed for the current app). Written to
// match what the app actually does today.
export default function GuidePage() {
  return (
    <div className="min-h-screen pb-32 lg:pl-80" style={{ background: '#0B0B1E' }} data-testid="guide-page">
      <div className="w-full max-w-2xl mx-auto px-6 sm:px-10 lg:px-12 pt-6 sm:pt-10">
        <Link to="/profile" className="inline-flex items-center gap-2 text-[#a0a0b8] hover:text-white text-sm mb-8" data-testid="back-btn">
          <ChevronLeft className="w-4 h-4" />
          Back to Profile
        </Link>

        <h1 className="text-3xl sm:text-4xl text-white mb-3" data-testid="guide-title">
          Instructional Guide
        </h1>
        <p className="text-[#c9b8f0] text-sm sm:text-base mb-10">
          How to use HORMOscope the way it was designed.
        </p>

        <div className="space-y-10 text-[#d4d4e0] text-sm sm:text-base leading-relaxed" data-testid="guide-body">
          <section data-testid="guide-overview">
            <h2 className="text-xl sm:text-2xl text-white mb-3">What HORMOscope does</h2>
            <p className="mb-3">HORMOscope brings together cycle tracking, the calendar, your Daily Read, mood and symptom logging, phase guides and Attuned Partner Mode.</p>
          </section>
          <section data-testid="guide-verify">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Confirm your email</h2>
            <p className="mb-3">When you sign up we email you a link and a 6-digit code. Tap the link, or type the code into the pink banner at the top of the app. You can keep using the app before you confirm; tap Resend email if it has not arrived (check spam), or Later to hide the banner for now.</p>
          </section>
          <section data-testid="guide-home">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Home</h2>
            <p className="mb-3">Home is your day at a glance. The day circle shows which day of your cycle you are on and which phase you are in. It glows with a slow, pulsing orb in your phase&apos;s colour: rose for your period, pink for follicular, gold around ovulation and lilac for luteal.</p>
            <p className="mb-3">Under it you will see a one-line read of how today may feel, and your Daily Read. Tap See more to open the phase list, food and activity tips for where you are in your cycle.</p>
            <p className="mb-3">The orb also stays still if your phone is set to reduce motion.</p>
          </section>
          <section data-testid="guide-quicklog">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Quick log</h2>
            <p className="mb-3">Under Log today there are 5 buttons: Mood, Energy, Symptoms, Cravings and Sleep. Tap one to open it and choose what fits. Every tap saves to today straight away and you will see a small Saved to today message. Mood starts with 8 core feelings; tap More feelings for the rest. Everything you log is kept on your Calendar.</p>
          </section>
          <section data-testid="guide-calendar">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Calendar</h2>
            <p className="mb-3">The Calendar is your whole record. Tap any day to see what you logged, or to log or edit your period and intimacy for that day, including past or irregular periods.</p>
            <p className="mb-3">Green days are your estimated fertile window, worked out from the period dates you log. These are estimates, not measurements: please do not use HORMOscope to prevent pregnancy. If your cycle situation makes predictions unreliable (for example pregnancy, breastfeeding or hormonal birth control), fertile-window predictions are switched off.</p>
          </section>
          <section data-testid="guide-journal">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Journal</h2>
            <p className="mb-3">Your Journal is a book, one day per page. Write, tap Save, and use Older day, Newer day or the small calendar to move between pages.</p>
            <p className="mb-3">Your entries are private, saved to your day, and never shared, not even with a partner linked in Attuned Partner Mode.</p>
          </section>
          <section data-testid="guide-attuned">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Attuned Partner Mode</h2>
            <p className="mb-3">Attuned Partner Mode lets someone you trust follow your cycle with you.</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li><strong>Invite code:</strong> in Profile, tap Create &amp; share invite code and send it. Your partner signs up and enters the code in the Partner Hub.</li>
              <li><strong>Boyfriend or partner without a cycle:</strong> they see your phase, what it may feel like and how to show up for you.</li>
              <li><strong>Girlfriend sync:</strong> if you both track your cycles, the Attunement tab shows your two cycles side by side for the next 4 weeks and highlights the days your phases overlap.</li>
              <li><strong>Visibility settings:</strong> in Profile, under My details, you choose exactly what your partner can see. Anything you switch off stays private to you.</li>
            </ul>
          </section>
          <section data-testid="guide-profile">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Profile</h2>
            <p className="mb-3">Profile holds your name and photo, My details (optional birthday, cycle situation, conditions like PMDD, PCOS or endometriosis, and partner visibility), reminders and your account. You can delete your account and data here at any time.</p>
            <p className="mb-3">Profile is also where the Founder&apos;s Note, this guide and the App Map live.</p>
          </section>
          <section data-testid="guide-appmap">
            <h2 className="text-xl sm:text-2xl text-white mb-3">App Map</h2>
            <p className="mb-3">Lost? The <Link to="/app-map" className="text-[#FF4F9A] underline">App Map</Link> lists every section of HORMOscope with a link straight to it.</p>
          </section>
          <p className="text-[#F4D3DC] text-center pt-4">
            Your body has been telling you the truth all along. HORMOscope just helps you read it.
          </p>
        </div>
      </div>
    </div>
  );
}
