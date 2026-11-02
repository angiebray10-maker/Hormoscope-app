import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { User, LogOut, ChevronRight, Shield, FileText, Flower2, Mail, Loader2, BookOpen, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import logger from '../utils/logger';
import TabFooter from '../components/TabFooter';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const APP_URL = process.env.REACT_APP_BACKEND_URL?.replace('/api', '') || window.location.origin;

const CONDITION_OPTIONS = ['PMDD', 'PCOS', 'Endometriosis', 'Irregular cycles'];

function MyDetailsSection({ user, token, updateUser }) {
  // Oct 31, 2026 (Angelita): the Birthday field and the "My cycle
  // right now" list are removed from Profile ("just more junk").
  // UI only: her stored birthday and cycle_status are untouched in
  // the database; the save below simply no longer sends them, and
  // the server only updates fields it receives.
  const [conditions, setConditions] = useState(user?.conditions || []);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await axios.put(`${API}/profile`, { conditions }, { headers: { Authorization: `Bearer ${token}` } });
      updateUser(res.data);
      setMsg('Saved.');
    } catch (err) {
      setMsg(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : "Couldn't save. Please try again.");
    } finally { setSaving(false); }
  };
  const row = 'flex items-center gap-3 py-1.5 text-sm text-[#F7F4FA] cursor-pointer';

  return (
    <div className="glass-card p-5 mb-6 space-y-5" data-testid="my-details" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div>
        <p className="text-white text-base mb-1">Conditions I live with</p>
        {CONDITION_OPTIONS.map((c) => (
          <label key={c} className={row}>
            <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={conditions.includes(c)} onChange={(e) => setConditions(e.target.checked ? [...conditions, c] : conditions.filter((x) => x !== c))} data-testid={`condition-${c}`} />
            {c}
          </label>
        ))}
      </div>
      {/* v42 (Angelita, Oct 25, 2026): the "What your partner can see"
          checklist moved to the Attunement tab. It pops up during sync
          setup, behind "Sync my cycle with him / her", where the choice
          belongs; it can also be changed there after linking. The
          values still save through PUT /profile partner_visibility. */}
      {/* v48 (Angelita, Oct 26, 2026): the two decorative motion/orb
          settings are removed from Profile (she called them Lively
          leftovers). The CSS and index.js machinery behind them stays
          dormant, untouched; the front page pulsating orb signature
          is not affected. */}
      <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-full text-white text-sm font-medium disabled:opacity-50" style={{ background: 'transparent', border: '1.5px solid #FF4F9A' }} data-testid="save-details-btn">
        {saving ? 'Saving…' : 'Save my details'}
      </button>
      {msg && <p className="text-sm text-center text-[#E6E0EE]" role="status">{msg}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { user, token, logout, updateUser } = useAuth();
  const { companionEntitled } = usePremium();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // Account deletion: owner only, password confirmed, handled by the server.
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const closeDelete = () => {
    if (deleting) return;
    setShowDelete(false);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await axios.delete(`${API}/auth/account`, {
        headers: { Authorization: `Bearer ${token}` },
        data: user?.is_anonymous ? {} : { password: deletePassword }
      });
      setDeleted(true);
    } catch (err) {
      setDeleteError(err?.response?.data?.detail || 'Deletion could not be completed. Your account was not changed. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeletedDone = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="pb-48 lg:pb-8 lg:pl-72 p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="label-luxe mb-2">Settings</p>
          <h1 className="text-4xl text-[#F4D3DC] font-script">
            Profile
          </h1>
        </div>
      </div>

      {/* v61 (Angelita, Nov 1, 2026): no name, no email, no photo.
          The top card is a plain anonymous card. */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#F4D3DC] to-[#C9B8F0] flex items-center justify-center border-2 border-[#F4D3DC]/30">
            <User className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-medium text-[#FDF8FA] tracking-wide">
              My Profile
            </h2>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="bento-card overflow-hidden mb-6">
        <Link
          to="/app-map"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5"
          data-testid="app-map-link"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#E8A4B8]" />
            <span className="text-[#FDF8FA]">App map</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#CFC3CC]" />
        </Link>
        <Link 
          to="/founders-note"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Flower2 className="w-5 h-5 text-[#E8A4B8]" />
            <span className="text-[#FDF8FA]">Founder&apos;s Note</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#CFC3CC]" />
        </Link>

        <Link
          to="/guide"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-[#E8A4B8]" />
            <span className="text-[#FDF8FA]">Instructional Guide</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#CFC3CC]" />
        </Link>
        
        <Link 
          to="/contact"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-[#F4D3DC]" />
            <span className="text-[#FDF8FA]">Contact Us</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#CFC3CC]" />
        </Link>

        <Link 
          to="/privacy"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#C9B8F0]" />
            <span className="text-[#FDF8FA]">Privacy Policy</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#CFC3CC]" />
        </Link>

        <Link 
          to="/terms"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#C9B8F0]" />
            <span className="text-[#FDF8FA]">Terms of Service</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#CFC3CC]" />
        </Link>
      </div>

      {/* The Attunement Mode card that used to sit here is removed
          (Angelita, Oct 31, 2026): Attunement has its own tab, and
          this duplicate only cluttered Profile. */}
      <MyDetailsSection user={user} token={token} updateUser={updateUser} />

      {/* Logout: legacy email accounts only (v61). An anonymous
          user has no sign-in to return to, so a Sign Out button
          would only throw her data away with no way back. */}
      {!user?.is_anonymous && (
      <button
        data-testid="logout-btn"
        onClick={handleLogout}
        className="w-full py-4 rounded-full bg-[#E85A6B]/10 hover:bg-[#E85A6B]/20 text-[#E85A6B] border border-[#E85A6B]/30 transition-all flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
      )}

      {/* Delete account */}
      <button
        data-testid="delete-account-btn"
        onClick={() => setShowDelete(true)}
        className="w-full mt-4 py-3 text-sm text-[#CFC3CC] hover:text-[#E85A6B] transition-colors flex items-center justify-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        Delete My Account
      </button>

      {/* A short founder note near the bottom of Profile, in
          Angelita's own dictated words (Oct 31, 2026), exactly as
          she said them. */}
      <p className="text-center text-sm text-[#E6E0EE] leading-relaxed mt-8 mb-2 px-2" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="profile-founder-note">
        I&apos;m just a solopreneur. It&apos;s just me, one person. This app was made by one woman, a breast cancer survivor.
      </p>

      {/* v50: our logo rests at the very bottom of Profile. */}
      <TabFooter />

      {showDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" data-no-swipe="true" style={{ background: 'rgba(10,6,18,0.88)' }}>
          <div className="glass-card max-w-md w-full p-6" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
            {!deleted ? (
              <>
                <h2 className="text-2xl text-[#F4D3DC] mb-3" style={{ fontFamily: "'Poiret One', sans-serif" }}>Delete your account?</h2>
                <p className="text-sm text-[#CDBEC6] leading-relaxed mb-3">
                  This permanently deletes your HORMOscope account and everything in it:
                </p>
                <ul className="text-sm text-[#CDBEC6] leading-relaxed mb-3 list-disc pl-5 space-y-1">
                  <li>Your cycle history and daily logs</li>
                  <li>Your journal, including sealed vault days</li>
                  <li>Your intimacy records</li>
                  <li>Your Journal Companion conversations</li>
                  <li>Your partner connections (they are disconnected)</li>
                </ul>
                <p className="text-sm text-[#CDBEC6] leading-relaxed mb-3">
                  This cannot be undone.{user?.is_anonymous
                    ? ' The app data stored on the server is erased, and this device starts fresh.'
                    : ' Your email will no longer sign in.'} If you have a
                  Journal Companion subscription through Google Play, cancel it in Google Play
                  too, deleting your account does not cancel Play billing. Billing records
                  the law requires are kept without your name or email.
                </p>
                {!user?.is_anonymous && (
                  <>
                    <p className="text-sm text-[#F4D3DC] mb-2">Type your password to confirm it is really you.</p>
                    <Input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Your password"
                      data-testid="delete-password-input"
                      className="mb-3"
                    />
                  </>
                )}
                {user?.is_anonymous && (
                  <p className="text-sm text-[#F4D3DC] mb-3">Tap Permanently delete to confirm.</p>
                )}
                {deleteError && <p className="text-sm mb-3" style={{ color: '#FF8FA3' }}>{deleteError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={closeDelete}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-full border border-white/20 text-[#FDF8FA] text-sm disabled:opacity-50"
                  >
                    Keep my account
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting || (!user?.is_anonymous && !deletePassword)}
                    data-testid="confirm-delete-btn"
                    className="flex-1 py-3 rounded-full text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: '#C62F45' }}
                  >
                    {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {deleting ? 'Deleting...' : 'Permanently delete'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl text-[#F4D3DC] mb-3" style={{ fontFamily: "'Poiret One', sans-serif" }}>Your account is deleted</h2>
                <p className="text-sm text-[#CDBEC6] leading-relaxed mb-5">
                  Your account and your personal data have been removed.{user?.is_anonymous
                    ? ' This device starts fresh the next time you open the app.'
                    : ' You have been signed out, and this email can no longer sign in.'} Thank you for the
                  time you spent here, and take good care of yourself.
                </p>
                <button
                  onClick={handleDeletedDone}
                  data-testid="deleted-done-btn"
                  className="w-full py-3 rounded-full text-white text-sm font-semibold"
                  style={{ background: 'transparent', border: '1.5px solid #FF4F9A' }}
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
