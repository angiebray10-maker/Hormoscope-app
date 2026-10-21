import React, { useState, useEffect, useCallback } from 'react';
import { BookHeart, Send, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import PROVERBS_CHAPTERS from '../data/proverbsChapters';
import { DAILY_PROVERBS } from '../data/dailyProverbs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// 31 Proverbs (Angelita, Oct 21, 2026): the Devotional tab renamed and
// rebuilt as the community hub. Proverbs has 31 chapters, so the day of
// the month picks the chapter, and the tab shows the FULL chapter, not
// just a verse. Underneath it, a comment section where the women read
// together: leave a comment, see the other women, talk about the Word.
export default function DevotionalPage() {
  const { user, token } = useAuth();
  const chapter = new Date().getDate(); // 1..31, one chapter per day
  const verses = PROVERBS_CHAPTERS[chapter] || [];
  const keyEntry = DAILY_PROVERBS.find((d) => d.day === chapter);
  const keyVerseNum = keyEntry ? parseInt(keyEntry.reference.split(':')[1], 10) : null;
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentMsg, setCommentMsg] = useState('');

  const fetchComments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/devotional/comments`, {
        params: { chapter },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      setComments(res.data?.comments || []);
    } catch (e) {
      setComments([]);
    }
  }, [token, chapter]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handlePost = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    setCommentMsg('');
    try {
      const res = await axios.post(`${API}/devotional/comments`, { chapter, text },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setComments((prev) => [res.data, ...(prev || [])]);
      setDraft('');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setCommentMsg(typeof detail === 'string' ? detail : 'Your comment did not post. Try again in a moment.');
    } finally { setPosting(false); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/devotional/comments/${id}`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setComments((prev) => (prev || []).filter((c) => c.id !== id));
    } catch (e) { /* a failed delete leaves the comment where it is */ }
  };

  const fmtWhen = (iso) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      return sameDay
        ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  };

  return (
    <div
      className="min-h-screen pb-32 lg:pb-8 lg:pl-64 px-5 pt-8"
      style={{ background: 'linear-gradient(180deg, #1a1030 0%, #0f0a1a 30%, #0a0a1a 100%)' }}
      data-testid="proverbs-page"
    >
      <div className="w-full max-w-2xl mx-auto">
        <p className="text-[10px] tracking-widest uppercase mb-1" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>
          31 Proverbs
        </p>
        <div className="flex items-center gap-2 mb-2">
          <BookHeart className="w-5 h-5 text-[#ff8fab]" />
          <h1 className="text-3xl text-white" style={{ fontFamily: "'Poiret One', cursive" }}>
            Proverbs {chapter}
          </h1>
        </div>
        <p className="text-[#c9b8f0] text-sm mb-2" data-testid="proverbs-date">
          {today}
        </p>
        <p className="text-[#b8b8d1] text-xs leading-relaxed mb-8">
          One chapter a day, the whole chapter, all month long. Read it here, then talk
          it over with the women below.
        </p>

        {/* The full chapter */}
        <div className="card p-6 sm:p-8 mb-6" data-testid="proverbs-chapter">
          <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-5">
            Proverbs chapter {chapter} · KJV
          </p>
          <div>
            {verses.map((v) => {
              const isKey = keyVerseNum === v.n;
              return (
                <p
                  key={v.n}
                  className={isKey ? 'rounded-lg px-3 py-2 mb-1' : 'px-3 py-0.5'}
                  style={isKey
                    ? { background: 'rgba(255,20,147,0.08)', borderLeft: '3px solid #FF1493', fontFamily: 'Poppins, sans-serif', fontSize: '15px', lineHeight: '27px', color: '#FDF3F6' }
                    : { fontFamily: 'Poppins, sans-serif', fontSize: '15px', lineHeight: '27px', color: 'rgba(255,255,255,0.82)' }}
                  data-testid={`proverbs-verse-${v.n}`}
                >
                  <span className="text-[10px] align-super mr-1.5" style={{ color: '#D4A853', fontFamily: 'Poppins, sans-serif' }}>{v.n}</span>
                  {v.t}
                  {isKey && (
                    <span className="block text-[9px] tracking-widest uppercase mt-1" style={{ color: '#ff8fab' }}>
                      Today&apos;s key verse
                    </span>
                  )}
                </p>
              );
            })}
          </div>
        </div>

        {/* The women: comments under the chapter */}
        <div data-testid="proverbs-comments">
          <p className="text-[10px] tracking-widest uppercase mb-1" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>
            Comment and Connect
          </p>
          <p className="text-[#b8b8d1] text-xs leading-relaxed mb-4">
            Leave a comment under today&apos;s chapter and read what the other women
            are seeing in it. This is your community hub.
          </p>

          <div className="flex gap-2 mb-2">
            <input
              type="text" value={draft}
              onChange={(e) => { setDraft(e.target.value); if (commentMsg) setCommentMsg(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
              placeholder="Share what this chapter says to you..."
              maxLength={500}
              className="flex-1 min-w-0 rounded-full px-4 py-2.5 text-sm outline-none placeholder-white/25 text-white"
              style={{ fontFamily: 'Poppins, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(244,167,185,0.25)' }}
              data-testid="proverbs-comment-input"
            />
            <button onClick={handlePost} disabled={posting || !draft.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
              style={{ background: '#FF1493' }}
              data-testid="proverbs-comment-post" aria-label="Post comment">
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          {commentMsg && (
            <p className="text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#ff8fa3' }} data-testid="proverbs-comment-msg">{commentMsg}</p>
          )}

          {comments === null ? (
            <p className="text-white/30 text-xs py-6 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>Loading the conversation...</p>
          ) : comments.length === 0 ? (
            <p className="text-white/30 text-xs py-6 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
              No comments yet under this chapter. Be the first to share what it says to you.
            </p>
          ) : (
            <div>
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl px-4 py-3 mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,184,240,0.10)' }} data-testid={`proverbs-comment-${c.id}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px]" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>
                      {c.name} <span className="text-white/25">· {fmtWhen(c.created_at)}</span>
                    </p>
                    {user && c.user_id === user.id && (
                      <button onClick={() => handleDelete(c.id)} aria-label="Delete my comment" className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-white/40 active:opacity-70">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-white/85 text-sm leading-relaxed mt-1 whitespace-pre-wrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
