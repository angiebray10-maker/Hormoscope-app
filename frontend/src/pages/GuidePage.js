import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Instructional Guide — the one home for how to use HORMOscope, living on
// the Profile tab next to the Founder's Note (Angelita, Oct 17; rewritten
// shorter and plainer Oct 31, 2026, to match the app as it now stands:
// four tabs, read-only Home, all logging in Journal, Attunement holding
// partner sync and the Gift Catalog, Profile holding account
// settings only).
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
          How to use HORMOscope, in plain steps.
        </p>

        <div className="space-y-10 text-[#d4d4e0] text-sm sm:text-base leading-relaxed" data-testid="guide-body">
          <section data-testid="guide-overview">
            <h2 className="text-xl sm:text-2xl text-white mb-3">What HORMOscope does</h2>
            <p className="mb-3">HORMOscope has four tabs, in this order: Home, Journal, Attunement and Profile. Home is where you read your day. Journal is where you log it.</p>
            <p className="mb-3">Your daily reads come from your cycle and what you log, not from astrology.</p>
          </section>
          <section data-testid="guide-home">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Home</h2>
            <p className="mb-3">Home is read only. There is nothing to log and no questions to answer here. All of that lives in Journal.</p>
            <p className="mb-3">At the top, the big day peach tells you where you are: You are on day N, inside the peach, glowing in your phase color. Each phase has its own color: red for menstrual, blue for follicular, green for ovulatory and purple for luteal. You will see the same colors in the Journal calendar.</p>
            <p className="mb-3">Home also shows your estimated next period, your Daily Read for today, the daily recipe and vitamins, and your daily affirmation. The HORMOscope logo rests at the bottom of the page.</p>
          </section>
          <section data-testid="guide-journal">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Journal</h2>
            <p className="mb-3">All logging lives in Journal. The calendar sits at the top. Its days wear their phase colors, with markers for period days, intimate days, and estimated fertile and ovulation days.</p>
            <p className="mb-3">Tap any day to open it. That day holds all the daily questions: your mood and feelings, your energy, symptoms, cravings, sleep, your period collection method, supplements and vitamins, and your note. The note is your writing for that day.</p>
            <p className="mb-3">On any day you can add or remove your period and set its flow, mark intimacy, and use Reset period to set a new Day 1. You can change or delete anything on any day later.</p>
            <p className="mb-3">Under the calendar is your history: your past days by month and by year, and a chart of your cycles with your mood and energy trends.</p>
            <p className="mb-3">Fertile and ovulation days are estimates from the period dates you log. They are not measurements. HORMOscope is for awareness, not contraception.</p>
            <p className="mb-3">Your entries are yours. A linked partner sees them only if you turn on the sharing choices in Attunement.</p>
          </section>
          <section data-testid="guide-attuned">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Attunement</h2>
            <p className="mb-3">Attunement is where you link with a partner, so they can follow your cycle with you.</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li><strong>Invite code:</strong> in the Attunement tab, create an invite code and send it to your partner. They enter it in the Partner Hub.</li>
              <li><strong>Partner without a cycle:</strong> they get a view of your phase, what it may feel like, and how to show up for you.</li>
              <li><strong>Partner who also gets a period:</strong> you can sync, and Attunement shows both of your cycles side by side.</li>
              <li><strong>Sharing choices:</strong> in Attunement, you pick what your partner sees. Your journal and your intimacy log stay private unless you turn their sharing on. You can also share your daily log and your note. Anything you leave off is never sent.</li>
            </ul>
          </section>
          <section data-testid="guide-gifts">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Gift Catalog</h2>
            <p className="mb-3">The Gift Catalog lives in Attunement. It runs in sections: Flowers, Chocolates, Drinks, Period essentials, Period underwear and clothing, Beauty from the Inside Out, Comfort, Little extras, Candles and scented products, Advent calendars and gift sets, and Jewelry and extra special things. Inside each section, like sits with like.</p>
            <p className="mb-3">A few products carry a small founder banner: a personal favorite, a personal recommendation, or her personal wish item.</p>
            <p className="mb-3">Tap the heart on anything you like and it goes onto your wishlist. Your picks also gather in your boutique, your own list, which a linked partner can see. Tap a product name to open it on Amazon.</p>
            <p className="mb-3">At the bottom of the catalog is the Community wall. Comment there on which items you tried and liked, and leave suggestions of what you would like to see. Looking for something you want? Leave a comment and Angelita will find it for you.</p>
          </section>
          <section data-testid="guide-profile">
            <h2 className="text-xl sm:text-2xl text-white mb-3">Profile</h2>
            <p className="mb-3">Profile holds your name, the conditions you live with (like PMDD, PCOS or endometriosis), and your account. You can sign out here, and delete your account and data here at any time.</p>
            <p className="mb-3">Profile is also where the Founder&apos;s Note, this guide and the App Map live. What your partner can see is chosen in Attunement, not here.</p>
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
