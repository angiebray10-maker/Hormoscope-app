# HORMOscope Pro — Premium Product Blueprint

## Product Vision
HORMOscope Pro positions the app as a **personalized cycle intelligence and life planning platform** — not just a period tracker. It turns raw cycle data into actionable daily guidance, helping women plan their lives around their biology.

---

## 1. Premium Feature Set

### Category A: Daily Intelligence
| Feature | Premium Name | What the User Gets |
|---|---|---|
| Daily cycle guidance | **Daily Rhythm Report** | A personalized briefing each day based on cycle day and phase. Covers energy, mood, focus, movement, recovery, and self-care recommendations. |
| Hormone trend chart | **Hormone Map** | A visual chart showing estrogen, progesterone, and LH levels across the user's cycle. Each day highlights which hormones are rising/falling and what that means. |

### Category B: Reports & Patterns
| Feature | Premium Name | What the User Gets |
|---|---|---|
| Weekly reports | **Weekly Rhythm Review** | End-of-week summary showing symptom patterns, mood trends, energy levels, and how the week aligned with their cycle phase. |
| Monthly reports | **Monthly Cycle Report** | Full-cycle analysis with pattern detection across symptoms, mood, pain, libido, and energy. Highlights recurring patterns and trends over time. |

### Category C: Personalized Planning
| Feature | Premium Name | What the User Gets |
|---|---|---|
| Cycle-based life planning | **Cycle Planner** | Suggests optimal days for high-effort tasks, social events, rest days, and important decisions based on where the user is in their cycle. |
| Hyper-personalized recommendations | **Smart Guidance** | Tailored daily tips for exercise type, productivity windows, recovery needs, libido awareness, pain management, and self-care — all based on cycle day, phase, logged symptoms, and historical patterns. |

---

## 2. Paywall-Ready Value Props

- **Daily Rhythm Report** — "Know exactly what your body needs today"
- **Hormone Map** — "See your hormones in motion, not just your period on a calendar"
- **Weekly Rhythm Review** — "Spot patterns you never noticed before"
- **Monthly Cycle Report** — "Your cycle, decoded — month after month"
- **Cycle Planner** — "Plan your life around your biology, not against it"
- **Smart Guidance** — "Exercise, focus, rest, and self-care — personalized to your cycle day"

---

## 3. In-App Navigation (Premium Sections)

```
Home (Dashboard)
├── Daily Rhythm Report (Pro badge)
├── Hormone Map (Pro badge)

Calendar
├── Period / Intimacy tracking (Free)
├── Cycle Planner overlay (Pro)

Insights (New Tab or Section)
├── Weekly Rhythm Review (Pro)
├── Monthly Cycle Report (Pro)
├── Symptom Pattern Analysis (Pro)

Journal
├── Free journaling (Free)
├── Mood correlation insights (Pro)

Profile
├── Subscription management
├── Cycle settings
```

**Suggested nav update:** Add an "Insights" icon to the bottom nav (replaces or adds alongside existing items). This becomes the premium hub.

---

## 4. MVP vs Later Roadmap

### MVP (Build First)
These features deliver the core "cycle intelligence" value and are essential for launch:

| Priority | Feature | Reason |
|---|---|---|
| P0 | **Daily Rhythm Report** | Core daily engagement driver. Shows immediate value. |
| P0 | **Hormone Map** | Visual differentiator. No other tracker shows this so clearly. |
| P1 | **Weekly Rhythm Review** | Builds retention through pattern visibility. |
| P1 | **Smart Guidance** (basic) | Daily recommendations based on cycle day + phase. |

### Phase 2 (Build After Launch)
| Priority | Feature | Reason |
|---|---|---|
| P2 | **Monthly Cycle Report** | Requires 1+ months of data to be useful. |
| P2 | **Cycle Planner** | Requires confidence in cycle prediction accuracy. |
| P2 | **Mood correlation insights** | Needs journal + symptom data cross-referencing. |

### Phase 3 (Future)
| Priority | Feature | Reason |
|---|---|---|
| P3 | TTC (Trying to Conceive) mode | Different recommendation set for users actively trying. |
| P3 | Partner sharing | Let users share cycle summaries with a partner. |
| P3 | Export / PDF reports | Shareable reports for healthcare providers. |

---

## 5. Safety & Trust Considerations

### Must-Do
- **Never use diagnostic language.** Say "your body may..." not "you have..."
- **Always include a disclaimer:** "This is not medical advice. Consult your healthcare provider for medical concerns."
- **Hormone Map disclaimer:** "Hormone levels shown are based on typical cycle patterns and may not reflect your individual levels. For accurate hormone testing, consult your doctor."
- **Avoid claiming accuracy** for predictions. Use "based on typical patterns" language.
- **No fertility guarantees.** If TTC mode is added later, make it clear the app does not replace medical fertility guidance.

### Recommended Trust Signals
- "Built with guidance from women's health research"
- "Your data stays private — we never sell your information"
- Show sources for cycle phase data (e.g., "Based on published menstrual cycle research")

---

## 6. Personalization Logic

### Data Inputs for Personalization
| Input | Source | Used For |
|---|---|---|
| Cycle day | Calculated from last period date | Phase detection, daily recommendations |
| Cycle phase | Derived from cycle day + cycle length | Hormone Map, Daily Rhythm Report |
| Symptom logs | User-logged daily | Smart Guidance, pattern analysis |
| Period history | Tracked periods | Cycle regularity, prediction accuracy |
| Mood/energy logs | Journal + symptom tracker | Weekly/Monthly reports |
| User goals | Onboarding preference | TTC vs wellness-only recommendations |

### Cycle Phase Mapping (Standard 28-Day Cycle)
| Phase | Days | Dominant Hormones | General Guidance |
|---|---|---|---|
| **Menstrual** | 1–5 | Low estrogen, low progesterone | Rest, gentle movement, iron-rich foods, self-compassion |
| **Follicular** | 6–13 | Rising estrogen | Energy building, planning, trying new things, strength training |
| **Ovulatory** | 14–16 | Peak estrogen, LH surge | Peak energy, social activities, high-intensity exercise, communication |
| **Luteal** | 17–28 | Rising progesterone, falling estrogen | Winding down, comfort, yoga/stretching, meal prep, nesting |

### Personalization Depth Tiers
1. **Basic (Free):** Phase-based generic tips (same for all users in the same phase)
2. **Pro (MVP):** Phase + cycle day + logged symptoms → personalized daily guidance
3. **Pro (Phase 2):** All above + historical pattern matching → predictive insights ("Last month around this time, you logged headaches — here's what might help")

---

## 7. Subscription Structure

| Plan | Price | Billing | Value Anchor |
|---|---|---|---|
| **Yearly** | $79.99/yr ($6.67/mo) | Annual | Best Value — Save 33% |
| **Monthly** | $9.99/mo | Monthly | Flexibility, cancel anytime |

### Free Tier Includes
- Basic period tracking
- Intimacy logging
- Calendar view
- Journal (unlimited entries)
- Basic cycle phase indicator

### Pro Tier Adds
- Daily Rhythm Report
- Hormone Map
- Weekly Rhythm Review
- Monthly Cycle Report (Phase 2)
- Smart Guidance
- Cycle Planner (Phase 2)
- Ad-free experience

---

## 8. Implementation Notes

### Backend Requirements
- Cycle phase calculation engine (pure logic, no external API needed)
- Hormone level mapping (static data based on published research)
- Recommendation engine (rule-based, mapping phase + symptoms → guidance)
- Report generation (aggregation queries on cycle_logs, journal_entries)

### Frontend Requirements
- Hormone Map chart (use Recharts or similar)
- Daily Rhythm Report card on Home dashboard
- Insights tab with Weekly/Monthly report views
- Pro badge/lock on premium features
- Entitlement check via RevenueCat

### No AI Required
All premium features can be built with **rule-based logic** and **data aggregation** — no LLM or AI integration needed. This keeps costs low and avoids the user's explicit request to not include AI.
