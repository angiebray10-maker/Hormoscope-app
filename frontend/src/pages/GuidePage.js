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
            <p className="mb-3">HORMOscope has four tabs, in this order: Home, Journal, Attunement and Profile. It brings together cycle tracking, your Daily Read, mood and symptom logging, phase guides and Attuned Partner Mode. Home is where you read your day, and Journal is where you log it: the calendar lives at the top of Journal.</p>
            <p className="mb-3">Science, not Stars. Your daily reads come from your cycle and what you log, not from astrology.</p>
          </section>
          <section data-testid="guide-verify">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Confirm your email</h2>
            <p className="mb-3">When you sign up we email you a link and a 6-digit code. Tap the link, or type the code into the pink banner at the top of the app. You can keep using the app before you confirm; tap Resend email if it has not arrived (check spam), or Later to hide the banner for now.</p>
          </section>
          <section data-testid="guide-home">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Home</h2>
            <p className="mb-3">Home is read-only. It is where you read your day: there is nothing to log, no questions to answer and nothing to fill in here. All of that lives in Journal.</p>
            <p className="mb-3">Your prediction for today is here, with your estimated next period. The day peach shows which day of your cycle you are on and which phase you are in.</p>
            <p className="mb-3">Your Daily Read explains what is going on in your body and in your phase today. Home also carries the daily recipe and vitamins for today, and your daily affirmation.</p>
          </section>
          <section data-testid="guide-journal">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Journal</h2>
            <p className="mb-3">All logging lives in Journal, all in this one tab. The calendar sits at the top of Journal. Its days wear their phase colours, with markers for period days, intimate days, and predicted fertile and ovulation days.</p>
            <p className="mb-3">Tap any day to open it. That day holds all the daily questions: your mood and feelings, your energy, symptoms, cravings, sleep, your period collection method, supplements and vitamins, and your note. The note is the writing for that day; there is no separate place for writing. The day&apos;s answers, together with your note, are that day&apos;s journal entry.</p>
            <p className="mb-3">On any day you can add or remove your period and set its flow, mark or unmark intimacy and add partner names, and use Reset period to set a new Day 1.</p>
            <p className="mb-3">Predicted fertile and ovulation days are estimates, worked out from the period dates you log. These are estimates, not measurements: please do not use HORMOscope to prevent pregnancy. If your cycle situation makes predictions unreliable (for example pregnancy, breastfeeding or hormonal birth control), fertile-window predictions are switched off.</p>
            <p className="mb-3">Under the calendar and the day, you can browse all your past days by month and by year. Your history chart is there too, showing your cycle progression plus your mood and energy trends over time.</p>
            <p className="mb-3">You can fill in a past day, change it, or delete a note, a log, or an intimacy mark on any day whenever you want.</p>
            <p className="mb-3">Your entries are yours. They are only shared if you turn on the sharing choices in Attunement for a linked partner.</p>
          </section>
          <section data-testid="guide-attuned">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Attuned Partner Mode</h2>
            <p className="mb-3">Attuned Partner Mode lets someone you trust follow your cycle with you.</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li><strong>Invite code:</strong> in Profile, tap Create &amp; share invite code and send it. Your partner signs up and enters the code in the Partner Hub.</li>
              <li><strong>Boyfriend or partner without a cycle:</strong> they see your phase, what it may feel like and how to show up for you.</li>
              <li><strong>Girlfriend sync:</strong> if you both track your cycles, the Attunement tab shows your two cycles side by side for the next 4 weeks and highlights the days your phases overlap.</li>
              <li><strong>Sharing choices:</strong> in Attunement, you choose what your partner sees with toggles. Alongside the journal and intimacy choices, you can turn on “Share my daily log” and “Include my note”. Those two start off, and they are only sent if you turn them on. Anything you leave unchecked is never sent, and it stays private to you.</li>
            </ul>
          </section>
          <section data-testid="guide-gifts">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Gift Catalog</h2>
            <p className="mb-3">The Gift Catalog lives in Attunement. It runs in sections: Flowers, Chocolates, Drinks, Period essentials, Period underwear and clothing, Beauty from the Inside Out, Comfort, Little extras, Candles and scented products, Advent calendars and gift sets, and Jewelry and extra special things. Inside each section, like sits with like.</p>
            <p className="mb-3">Tap the heart on anything you like and it goes onto your wishlist. Tap a product name to open it on Amazon.</p>
            <p className="mb-3">At the bottom of the catalog is the Community wall. Comment there on which items you tried and liked, and leave suggestions of what you would like to see. Looking for something you want? Leave a comment and Angelita will find it for you.</p>
          </section>
          <section data-testid="guide-profile">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Profile</h2>
            <p className="mb-3">Profile holds your name and photo, My details (optional birthday, cycle situation, and conditions like PMDD, PCOS or endometriosis), reminders and your account. You can delete your account and data here at any time. What your partner can see is chosen in Attunement.</p>
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
