import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Instructional Guide — the one home for how to use HORMOscope, living on
// the Profile tab next to the Founder's Note (Angelita, Oct 17). Written to
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
          <section>
            <h2 className="text-xl sm:text-2xl text-white mb-3">Home</h2>
            <p>
              Home is your day at a glance. The glowing orb shows what day of your cycle you are on and which
              phase you are in. Under it you will find Today&apos;s Mood, food and
              activity guidance for right where you are in your cycle, and a card called This Time Last Cycle,
              which shows you what you logged on this same cycle day one cycle ago. Everything you log lives
              on the Calendar, so nothing you record is ever lost.
            </p>
            <p className="mt-3">
              The Your Cycle Phases list shows all four phases. Tap any phase and its full card opens: a
              picture of what is happening inside your body in that phase, what your hormones are doing, and
              how that usually feels. It is the fastest way to understand why a day feels the way it does.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl text-white mb-3">Daily Devotional</h2>
            <p>
              The Devotional tab, right beside Home, holds the day&apos;s verse from Proverbs: one chapter
              for each day of the month, so a fresh reading is waiting for you every morning. It is a quiet
              minute that is just for you.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl text-white mb-3">Quick Log</h2>
            <p>
              The floating icons on Home are your quick log. Tap any one of them once and the whole sheet
              opens at once. Nothing goes around in a circle that you have to wait for.
            </p>
            <p className="mt-3">
              It starts with How do you feel? The faces and every feeling are all there together, the good
              ones and the hard ones too: anger, sadness, hurt, feeling misunderstood, jealousy, all of them.
              Your feelings are real, and every one of them belongs here. Below that you can log symptoms,
              cravings, how you collected your flow (tampon, pads, cup, disc, period underwear, or any mix of
              them), your energy, and your sleep.
            </p>
            <p className="mt-3">
              Every tap saves to that day the moment you tap it, and you will see a small Saved to today
              message so you know it landed. Add a note at the bottom if you like, then tap Done.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl text-white mb-3">Calendar</h2>
            <p>
              The Calendar is your whole record. Tap any day to see everything you logged on that day, and to
              log your period or intimacy for it. A small pink heart marks the days you logged intimacy.
            </p>
            <p className="mt-3">
              Green days are your estimated fertile window, worked out from the cycle dates you log, and
              the strongest green is the estimated ovulation day. These are estimates, not measurements,
              and every body varies, so please do not rely on them to prevent pregnancy: HORMOscope is for
              awareness, not contraception. If you press and hold a day with a heart, you can privately note who you were with.
              That note is for your eyes only and is never shown anywhere else.
            </p>
            <p className="mt-3">
              The little calendar in the corner of your Journal works the same way, green ovulation days and
              all, and tapping a day there takes you straight to that day&apos;s page in your book.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl text-white mb-3">Journal</h2>
            <p>
              Your Journal is a real book, one day per page. Write whatever the day held, tap Save, and it is
              kept on that day&apos;s page for good. Turn the pages with the Older day and Newer day buttons,
              and use the little calendar in the corner to jump straight to a day you want to read again.
            </p>
            <p className="mt-3">
              Over time the book becomes your story: you can look back, compare days, and see in your own
              words how far you have come. Your Journal is yours, always.
            </p>
            <p className="mt-3">
              Your journal also holds a companion, if you want one: you pick the name, and your companion
              answers you right inside the book, knowing your cycle and what your day has held. If you would
              rather it be only you and your thoughts, turn the companion off in the journal settings and the
              page is yours alone.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl text-white mb-3">Attunement</h2>
            <p>
              Attunement lets someone you trust follow your cycle with you, so they understand what your
              body is going through and care lands right on time. Send your partner a sign-up link and you track
              side by side.
            </p>
            <p className="mt-3">
              There is also one simple share link on the same tab. Send it to anyone else you would like to
              share your cycle with. For now, one person can be linked at a time, and the page will always
              tell you honestly where things stand.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl text-white mb-3">Journal Companion</h2>
            <p>
              Inside your Journal lives your companion, Your Journey&apos;s Companion: yours to name,
              yours to write with on the page, knowing your cycle and what your day has held.
            </p>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl text-white mb-3">Profile</h2>
            <p>
              Your Profile tab is home base for you: your name and picture, your cycle settings, and your
              account. It is also where the Founder&apos;s Note lives, and where this guide sits whenever you
              need it.
            </p>
            <p className="mt-3 text-[#F4D3DC]">
              Your body has been telling you the truth all along. HORMOscope just helps you read it.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
