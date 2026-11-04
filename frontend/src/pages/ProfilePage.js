import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { User, LogOut, ChevronRight, Shield, FileText, Flower2, Mail, Loader2, BookOpen, Trash2, Camera, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import logger from '../utils/logger';
import TabFooter from '../components/TabFooter';
import { loadNotifPrefs, saveNotifPrefs, applyNotificationSchedule, DEFAULT_NOTIF_PREFS, WEEKDAY_LABELS } from '../utils/notifications';

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

// v62 (Angelita, Nov 2, 2026): the upgrade path for accounts created
// anonymously under v61. She adds her email, a password she chooses,
// and her name; the backend converts the same account in place, so
// nothing she logged is lost. Shown only while the account is still
// anonymous; it disappears for good once she has an email.
function AttachEmailSection() {
  const { user, attachEmail } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await attachEmail(email.trim(), password, name.trim());
    } catch (err) {
      setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const label = 'text-xs tracking-wider uppercase block mb-2 text-[#CFC3CC]';
  const input = 'w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none bg-white/5 border border-white/15';

  return (
    <div className="glass-card p-5 mb-6 space-y-4" data-testid="attach-email-section" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div>
        <p className="text-[#F4D3DC] text-sm font-medium">Add your email</p>
        <p className="text-[#CFC3CC] text-xs mt-1 leading-relaxed">
          You started without an account. Add your email and name so you can sign in on any device. Everything you have logged stays right where it is.
        </p>
      </div>
      <div>
        <label className={label} htmlFor="attach-name">Name</label>
        <input id="attach-name" data-testid="attach-name-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" className={input} />
      </div>
      <div>
        <label className={label} htmlFor="attach-email">Email</label>
        <input id="attach-email" data-testid="attach-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className={input} />
      </div>
      <div>
        <label className={label} htmlFor="attach-password">Password</label>
        <input id="attach-password" data-testid="attach-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password (8+ characters)" className={input} />
      </div>
      {error && <p className="text-sm" role="alert" style={{ color: '#FF8FA3' }}>{error}</p>}
      <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-full text-white text-sm font-medium disabled:opacity-50" style={{ background: 'transparent', border: '1.5px solid #FF4F9A' }} data-testid="attach-email-save-btn">
        {saving ? 'Saving…' : 'Save my email'}
      </button>
    </div>
  );
}

// v64 (Angelita, Nov 4, 2026): notification settings live here on
// the second tab. The shape is fixed by her order: twice a week at
// 9 AM. She picks which two days, or turns them off. New signups
// get Monday and Thursday set automatically at onboarding; this
// section is where that choice is changed afterwards.
function NotificationsSection() {
  const [prefs, setPrefs] = useState(() => loadNotifPrefs() || { ...DEFAULT_NOTIF_PREFS, enabled: false });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async (next) => {
    setPrefs(next);
    saveNotifPrefs(next);
    setBusy(true);
    setMsg('');
    const res = await applyNotificationSchedule(next, { askPermission: next.enabled });
    setBusy(false);
    if (!next.enabled) setMsg('Reminders off.');
    else if (res.scheduled) setMsg('Saved. Your reminders are set.');
    else if (res.reason === 'denied') setMsg('Your phone has notifications off for HORMOscope. Turn them on in your phone settings, then flip this switch off and on again.');
    else if (res.reason === 'web') setMsg('Saved. Reminders ring inside the app on your phone.');
    else setMsg('Saved.');
  };

  const toggleDay = (id) => {
    let days = prefs.days.includes(id) ? prefs.days.filter((d) => d !== id) : [...prefs.days, id];
    if (days.length > 2) days = days.slice(days.length - 2);
    if (days.length === 0) days = [id];
    apply({ ...prefs, days: days.sort((a, b) => a - b) });
  };

  return (
    <div className="glass-card p-5 mb-6" data-testid="notifications-section" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-white text-base flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: '#FF4F9A' }} />
          Reminders
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.enabled}
          data-testid="notif-toggle"
          disabled={busy}
          onClick={() => apply({ ...prefs, enabled: !prefs.enabled })}
          className="relative w-12 h-7 rounded-full transition-colors disabled:opacity-50"
          style={{ background: prefs.enabled ? '#FF4F9A' : 'rgba(255,255,255,0.15)' }}
        >
          <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all" style={{ left: prefs.enabled ? 22 : 2 }} />
        </button>
      </div>
      <p className="text-[#CFC3CC] text-xs leading-relaxed mb-4">
        Twice a week at 9 AM, a small nudge that your Daily Read is waiting. Pick your two days:
      </p>
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_LABELS.map(({ id, label }) => {
          const active = prefs.days.includes(id);
          return (
            <button
              key={id}
              type="button"
              data-testid={`notif-day-${id}`}
              disabled={busy}
              onClick={() => toggleDay(id)}
              className="px-3.5 py-2 rounded-full text-sm disabled:opacity-50"
              style={active
                ? { background: 'rgba(255,79,154,0.18)', border: '1.5px solid #FF4F9A', color: '#fff' }
                : { background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#CFC3CC' }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {msg && <p className="text-sm text-[#E6E0EE] mt-3" role="status">{msg}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { user, token, logout, updateUser } = useAuth();
  const { companionEntitled } = usePremium();
  const navigate = useNavigate();
  // v62: the name edit is back (restored from v60).
  // v64 (Angelita, Nov 4, 2026): the photo upload is back too, here
  // on the second tab where she said the picture goes.
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(user?.profile_photo || null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.profile_photo) setPhotoPreview(user.profile_photo);
  }, [user?.profile_photo]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/profile/photo`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      updateUser(res.data);
      setPhotoPreview(res.data.profile_photo);
    } catch (err) {
      logger.error('Photo upload error:', err);
      setPhotoPreview(user?.profile_photo || null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/profile`, {
        name
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      updateUser(res.data);
      setIsEditing(false);
    } catch (err) {
      logger.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

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
        {!isEditing ? (
          <button
            data-testid="edit-profile-btn"
            onClick={() => { setName(user?.name || ''); setIsEditing(true); }}
            className="btn-glass"
          >
            Edit
          </button>
        ) : (
          <button
            data-testid="save-profile-btn"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-full bg-transparent border-[1.5px] border-[#E8A4B8] text-[#F4D3DC] font-medium text-sm"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {/* v62 (Angelita, Nov 2, 2026): name and email are back on the
          top card (restored from v60). v64: the photo upload is back
          on the circle; tap it to change her picture. */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              accept="image/*"
              className="hidden"
              id="profile-photo-input"
            />
            <label
              htmlFor="profile-photo-input"
              className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#F4D3DC] to-[#C9B8F0] flex items-center justify-center overflow-hidden border-2 border-[#F4D3DC]/30 hover:border-[#F4D3DC] transition-all cursor-pointer block"
              data-testid="profile-photo-btn"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </label>
            {!photoPreview && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#F4D3DC] flex items-center justify-center shadow-lg pointer-events-none">
                <Camera className="w-4 h-4 text-[#12090E]" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                data-testid="profile-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-luxe text-lg font-medium mb-1 w-full"
                placeholder="Your name"
              />
            ) : (
              <h2 className="text-xl font-medium text-[#FDF8FA] tracking-wide">
                {user?.name || 'Beautiful'}
              </h2>
            )}
            {!user?.is_anonymous && (
              <p className="text-[#E6E0EE] text-xs break-all" data-testid="profile-email">{user?.email}</p>
            )}
          </div>
        </div>
      </div>

      {user?.is_anonymous && <AttachEmailSection />}

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
            <span className="text-[#FDF8FA]">Privacy and Security</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#CFC3CC]" />
        </Link>

        <Link 
          to="/terms"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#C9B8F0]" />
            <span className="text-[#FDF8FA]">Terms and Disclaimers</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#CFC3CC]" />
        </Link>
      </div>

      {/* The Attunement Mode card that used to sit here is removed
          (Angelita, Oct 31, 2026): Attunement has its own tab, and
          this duplicate only cluttered Profile. */}
      <MyDetailsSection user={user} token={token} updateUser={updateUser} />

      <NotificationsSection />

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
