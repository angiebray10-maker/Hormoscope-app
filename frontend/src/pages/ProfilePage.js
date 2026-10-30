import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { User, LogOut, ChevronRight, Shield, FileText, Flower2, Mail, Camera, Loader2, Heart, BookOpen, Trash2, Bell } from 'lucide-react';
import { syncLocalNotifications, checkNotificationPermission, getNotificationPrefs, isNativePlatform, NOTIFICATION_TIMES } from '../utils/localNotifications';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import logger from '../utils/logger';
import DateSelect from '../components/DateSelect';
import TabFooter from '../components/TabFooter';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const APP_URL = process.env.REACT_APP_BACKEND_URL?.replace('/api', '') || window.location.origin;

function AttunedSection({ token }) {
  // Attunement Mode is FREE for everyone (Angelita, Oct 18, 2026): no Pro
  // gate anywhere on this section.
  // v42 (Angelita, Oct 25, 2026): this card no longer creates an invite
  // code itself. There is ONE sync flow, in the Attunement tab, because
  // the "What your partner can see" checklist now lives there and must
  // always appear during setup. This card routes there instead.
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setStatus(res.data))
      .catch(() => setStatus({ is_linked: false }));
  }, [token]);

  const handleUnlink = async () => {
    try {
      await axios.post(`${API}/partner/unlink`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setStatus({ is_linked: false });
    } catch (err) {
      logger.error('Unlink error:', err);
    }
  };

  return (
    <div className="glass-card p-5 mb-6" data-testid="attuned-section">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#FF4F9A]/20 flex items-center justify-center">
          <Heart className="w-5 h-5 text-[#FF4F9A]" fill="#FF4F9A" />
        </div>
        <div>
          <p className="text-[#F4D3DC] text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>Attunement Mode</p>
          <p className="text-[#CFC3CC] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Built by one woman, a breast cancer survivor, from real personal experience.</p>
        </div>
      </div>

      {status === null ? (
        <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 text-[#FF4F9A] animate-spin" /></div>
      ) : status.is_linked ? (
        <div>
          <p className="text-white text-sm mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Linked with <span className="font-semibold" style={{ color: '#f4a7b9' }}>{status.partner_name}</span>
          </p>
          <p className="text-[#CFC3CC] text-xs mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            He can see your cycle calendar — ovulation, fertile days, and your next period. Your journal stays private.
          </p>
          <div className="flex gap-2">
            <Link to="/attunement" className="flex-1 py-2.5 rounded-full text-white text-sm font-medium text-center"
              style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }}>
              Open Attunement Mode
            </Link>
            <button onClick={handleUnlink} className="px-4 py-2.5 rounded-full text-white/75 text-xs"
              style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,255,255,0.12)' }}>
              Unlink
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[#CFC3CC] text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Link your partner's account to yours so they can follow your cycle. If they track too, you'll see both cycles side by side.
          </p>
          <Link to="/attunement" data-testid="attuned-go-btn"
            className="block w-full py-2.5 rounded-full text-white text-sm font-medium text-center"
            style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }}>
            Create &amp; share invite code
          </Link>
        </div>
      )}
    </div>
  );
}


const SITUATION_OPTIONS = [
  { id: 'regular', label: 'I get a period' },
  { id: 'unsure', label: 'Not sure of my cycle length' },
  { id: 'hormonal_birth_control', label: 'Hormonal birth control' },
  { id: 'pregnant', label: 'Pregnant' },
  { id: 'postpartum', label: 'Postpartum / breastfeeding' },
  { id: 'menopause', label: 'Perimenopause or menopause' },
];
const CONDITION_OPTIONS = ['PMDD', 'PCOS', 'Endometriosis', 'Irregular cycles'];

function MyDetailsSection({ user, token, updateUser }) {
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [situation, setSituation] = useState(user?.cycle_status || 'regular');
  const [conditions, setConditions] = useState(user?.conditions || []);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await axios.put(`${API}/profile`, { birthday: birthday || '', cycle_status: situation, conditions }, { headers: { Authorization: `Bearer ${token}` } });
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
        <p className="text-white text-base mb-2">Birthday <span className="text-[#E6E0EE] text-xs">(optional)</span></p>
        <DateSelect testId="profile-birthday" value={birthday} onChange={setBirthday} minYear={1930} maxYear={new Date().getFullYear() - 18} />
      </div>
      <div>
        <p className="text-white text-base mb-2">My cycle right now</p>
        <select value={situation} onChange={(e) => setSituation(e.target.value)} className="w-full rounded-xl px-3 py-2.5 bg-white/5 border border-white/15 text-white" data-testid="profile-situation">
          {SITUATION_OPTIONS.map((o) => <option key={o.id} value={o.id} className="bg-[#15152B]">{o.label}</option>)}
        </select>
        {!['regular', 'unsure'].includes(situation) && <p className="text-[#E6E0EE] text-xs mt-1">Fertility predictions are turned off.</p>}
      </div>
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
      <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-full text-white text-sm font-medium disabled:opacity-50" style={{ background: '#FF4F9A' }} data-testid="save-details-btn">
        {saving ? 'Saving…' : 'Save my details'}
      </button>
      {msg && <p className="text-sm text-center text-[#E6E0EE]" role="status">{msg}</p>}
    </div>
  );
}

// v43: on-device local notifications live here now. This is the one
// place the daily reminder preference can be changed after onboarding
// (onboarding step 5 writes the same local storage keys and the same
// server fields). Changing anything re-schedules on the device at
// once. If Android permission is denied there is exactly ONE plain
// line about it (per the Oct 22 plan: no nagging, ever).
function NotificationsSection({ user, token, updateUser }) {
  const prefs = getNotificationPrefs(user);
  const [enabled, setEnabled] = useState(prefs.enabled);
  const [time, setTime] = useState(prefs.time);
  // v49: the same three choices onboarding offers (Angelita, Oct 26).
  const [periodAlert, setPeriodAlert] = useState(prefs.period);
  const [ovulationAlert, setOvulationAlert] = useState(prefs.ovulation);
  // v55: the partner daily note reminder is a fourth choice, but it
  // belongs to partners only: the row renders only when this account
  // is a linked partner (checked against /partner/status below).
  const [partnerDaily, setPartnerDaily] = useState(prefs.partnerDaily);
  const [partnerTime, setPartnerTime] = useState(prefs.partnerTime || '09:00');
  const [isPartner, setIsPartner] = useState(false);
  const [permDisplay, setPermDisplay] = useState(null);
  const [msg, setMsg] = useState('');
  const native = isNativePlatform();

  useEffect(() => {
    let live = true;
    checkNotificationPermission().then((d) => { if (live) setPermDisplay(d); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((res) => { if (live) setIsPartner(!!(res.data?.is_linked && res.data?.role === 'partner')); })
      .catch(() => {});
    return () => { live = false; };
  }, [token]);

  const apply = async (nextEnabled, nextTime, nextPeriod = periodAlert, nextOvulation = ovulationAlert, nextPartnerDaily = partnerDaily, nextPartnerTime = partnerTime) => {
    setEnabled(nextEnabled);
    setTime(nextTime);
    setPeriodAlert(nextPeriod);
    setOvulationAlert(nextOvulation);
    setPartnerDaily(nextPartnerDaily);
    setPartnerTime(nextPartnerTime);
    setMsg('');
    const anyOn = nextEnabled || nextPeriod || nextOvulation || nextPartnerDaily;
    const mergedPrefs = { ...(user.notification_preferences || {}), period_reminder: nextPeriod, ovulation_reminder: nextOvulation, partner_daily_note: nextPartnerDaily, partner_daily_time: nextPartnerTime };
    try {
      localStorage.setItem('hormoscope-notifications-enabled', nextEnabled ? 'true' : 'false');
      localStorage.setItem('hormoscope-notification-time', nextTime);
      localStorage.setItem('hormoscope-notifications-period', nextPeriod ? 'true' : 'false');
      localStorage.setItem('hormoscope-notifications-ovulation', nextOvulation ? 'true' : 'false');
      localStorage.setItem('hormoscope-notifications-partner-daily', nextPartnerDaily ? 'true' : 'false');
      localStorage.setItem('hormoscope-notification-partner-time', nextPartnerTime);
    } catch (e) { /* storage unavailable: server fields below still save */ }
    try {
      const res = await axios.put(`${API}/profile`, { notifications_enabled: nextEnabled, notification_time: nextTime, notification_preferences: mergedPrefs }, { headers: { Authorization: `Bearer ${token}` } });
      updateUser(res.data);
    } catch (err) {
      logger.error('Notification preference save failed:', err);
    }
    const result = await syncLocalNotifications({
      user: { ...user, notifications_enabled: nextEnabled, notification_time: nextTime, notification_preferences: mergedPrefs },
      token,
      requestPermission: anyOn,
    });
    if (result && result.permission) setPermDisplay(result.permission);
    setMsg(anyOn ? 'Saved.' : 'Notifications off.');
  };

  const row = 'flex items-center gap-3 py-1.5 text-sm text-[#F7F4FA] cursor-pointer';

  return (
    <div className="glass-card p-5 mb-6 space-y-4" data-testid="notifications-section" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#FF4F9A]/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-[#FF4F9A]" />
        </div>
        <div>
          <p className="text-[#F4D3DC] text-sm font-medium">Daily Notifications</p>
          <p className="text-[#CFC3CC] text-xs">Your Daily Read and cycle alerts, on this device.</p>
        </div>
      </div>
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={enabled} onChange={(e) => apply(e.target.checked, time)} data-testid="notifications-enabled-toggle" />
        Daily Read reminder
      </label>
      <div>
        <p className="text-white text-base mb-2">Reminder time</p>
        <select value={time} disabled={!enabled} onChange={(e) => apply(enabled, e.target.value)} className="w-full rounded-xl px-3 py-2.5 bg-white/5 border border-white/15 text-white disabled:opacity-50" data-testid="notification-time-select">
          {NOTIFICATION_TIMES.map((t) => <option key={t.time} value={t.time} className="bg-[#15152B]">{t.label}</option>)}
        </select>
      </div>
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={periodAlert} onChange={(e) => apply(enabled, time, e.target.checked, ovulationAlert)} data-testid="notifications-period-toggle" />
        <span>Period coming
          <span className="block text-xs text-[#CFC3CC]">A gentle note the evening before your period is estimated to start.</span>
        </span>
      </label>
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={ovulationAlert} onChange={(e) => apply(enabled, time, periodAlert, e.target.checked)} data-testid="notifications-ovulation-toggle" />
        <span>Ovulation week starting
          <span className="block text-xs text-[#CFC3CC]">A note the morning your ovulation week is estimated to begin.</span>
        </span>
      </label>
      {isPartner && (
        <>
          <label className={row}>
            <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={partnerDaily} onChange={(e) => apply(enabled, time, periodAlert, ovulationAlert, e.target.checked, partnerTime)} data-testid="notifications-partner-daily-toggle" />
            <span>Daily partner note reminder
              <span className="block text-xs text-[#CFC3CC]">A daily nudge to log in and see what your person is wishing for you to do for them today. The note itself never appears on your lock screen.</span>
            </span>
          </label>
          <div>
            <p className="text-white text-base mb-2">Partner reminder time</p>
            <select value={partnerTime} disabled={!partnerDaily} onChange={(e) => apply(enabled, time, periodAlert, ovulationAlert, partnerDaily, e.target.value)} className="w-full rounded-xl px-3 py-2.5 bg-white/5 border border-white/15 text-white disabled:opacity-50" data-testid="notification-partner-time-select">
              {NOTIFICATION_TIMES.map((t) => <option key={t.time} value={t.time} className="bg-[#15152B]">{t.label}</option>)}
            </select>
          </div>
        </>
      )}
      {native && (enabled || periodAlert || ovulationAlert) && permDisplay === 'denied' && (
        <p className="text-sm text-[#E6E0EE]" data-testid="notifications-denied-line">Notifications are turned off for HORMOscope in your phone settings. Turn them on there to get your Daily Read and cycle alerts.</p>
      )}
      {msg && <p className="text-sm text-[#E6E0EE]" role="status">{msg}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { user, token, logout, updateUser } = useAuth();
  const { companionEntitled } = usePremium();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(user?.profile_photo || null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

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

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API}/profile/photo`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      updateUser(res.data);
      setPhotoPreview(res.data.profile_photo);
    } catch (err) {
      logger.error('Photo upload error:', err);
      alert('Failed to upload photo. Please try again.');
      setPhotoPreview(user?.profile_photo || null);
    } finally {
      setUploading(false);
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
        data: { password: deletePassword }
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
            onClick={() => setIsEditing(true)}
            className="btn-glass"
          >
            Edit
          </button>
        ) : (
          <button
            data-testid="save-profile-btn"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-full bg-gradient-to-r from-[#F4D3DC] to-[#E8A4B8] text-[#12090E] font-medium text-sm"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {/* Profile Photo & Info */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-5">
          {/* Photo Upload */}
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
              
              {/* Upload overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </label>
            
            {/* Camera badge — only show when no photo */}
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
            <p className="text-[#E6E0EE] text-xs break-all" data-testid="profile-email">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Email verification lived here in v39-v41. v42 (Angelita,
          Oct 25, 2026): it moved to the START of onboarding, where the
          email is first given. Nothing renders here anymore. */}

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

      {/* Attunement Mode */}
      <AttunedSection token={token} />
      <MyDetailsSection user={user} token={token} updateUser={updateUser} />
      <NotificationsSection user={user} token={token} updateUser={updateUser} />

      {/* Logout */}
      <button
        data-testid="logout-btn"
        onClick={handleLogout}
        className="w-full py-4 rounded-full bg-[#E85A6B]/10 hover:bg-[#E85A6B]/20 text-[#E85A6B] border border-[#E85A6B]/30 transition-all flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>

      {/* Delete account */}
      <button
        data-testid="delete-account-btn"
        onClick={() => setShowDelete(true)}
        className="w-full mt-4 py-3 text-sm text-[#CFC3CC] hover:text-[#E85A6B] transition-colors flex items-center justify-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        Delete My Account
      </button>

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
                  This cannot be undone, and your email will no longer sign in. If you have a
                  Journal Companion subscription through Google Play, cancel it in Google Play
                  too, deleting your account does not cancel Play billing. Billing records
                  the law requires are kept without your name or email.
                </p>
                <p className="text-sm text-[#F4D3DC] mb-2">Type your password to confirm it is really you.</p>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  data-testid="delete-password-input"
                  className="mb-3"
                />
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
                    disabled={deleting || !deletePassword}
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
                  Your account and your personal data have been removed. You have been
                  signed out, and this email can no longer sign in. Thank you for the
                  time you spent here, and take good care of yourself.
                </p>
                <button
                  onClick={handleDeletedDone}
                  data-testid="deleted-done-btn"
                  className="w-full py-3 rounded-full text-white text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, #FF5C8A, #FF4F9A)' }}
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
