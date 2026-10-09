import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { User, LogOut, ChevronRight, Shield, FileText, Sparkles, Mail, Camera, Loader2, Crown, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const APP_URL = process.env.REACT_APP_BACKEND_URL?.replace('/api', '') || window.location.origin;

function AttunedSection({ token }) {
  const [status, setStatus] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setStatus(res.data))
      .catch(() => setStatus({ is_linked: false }));
  }, [token]);

  const handleInvite = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/partner/invite`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setInviteCode(res.data.invite_code);
    } catch (err) {
      logger.error('Invite error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = async () => {
    try {
      await axios.post(`${API}/partner/unlink`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setStatus({ is_linked: false });
      setInviteCode(null);
    } catch (err) {
      logger.error('Unlink error:', err);
    }
  };

  const copyCode = () => {
    if (inviteCode) {
      navigator.clipboard?.writeText(inviteCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="glass-card p-5 mb-6" data-testid="attuned-section">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#FF1493]/20 flex items-center justify-center">
          <Heart className="w-5 h-5 text-[#FF1493]" fill="#FF1493" />
        </div>
        <div>
          <p className="text-[#F4D3DC] text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>Attuned Partner Mode</p>
          <p className="text-[#9A8B91] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Built by one woman, a breast cancer survivor, from real personal experience.</p>
        </div>
      </div>

      {status === null ? (
        <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 text-[#FF1493] animate-spin" /></div>
      ) : status.is_linked ? (
        <div>
          <p className="text-white text-sm mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Linked with <span className="font-semibold" style={{ color: '#f4a7b9' }}>{status.partner_name}</span>
          </p>
          <p className="text-[#9A8B91] text-xs mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            He can see your cycle calendar — ovulation, fertile days, and your next period. Your journal stays private.
          </p>
          <div className="flex gap-2">
            <Link to="/partner-hub" className="flex-1 py-2.5 rounded-full text-white text-sm font-medium text-center"
              style={{ fontFamily: 'Poppins, sans-serif', background: '#FF1493' }}>
              Open Partner Hub
            </Link>
            <button onClick={handleUnlink} className="px-4 py-2.5 rounded-full text-white/50 text-xs"
              style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,255,255,0.12)' }}>
              Unlink
            </button>
          </div>
        </div>
      ) : inviteCode ? (
        <div>
          <p className="text-[#9A8B91] text-xs mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Share this code with your partner. He creates his own HORMOscope account, opens Partner Hub, and enters it.
          </p>
          <button onClick={copyCode}
            className="w-full py-3 rounded-xl text-center mb-2"
            style={{ background: 'rgba(255,20,147,0.08)', border: '1px dashed rgba(255,20,147,0.4)' }}>
            <span className="text-white text-xl font-bold tracking-[0.3em]" style={{ fontFamily: 'Poppins, sans-serif' }}>{inviteCode}</span>
            <span className="block text-[#9A8B91] text-[10px] mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {copied ? 'Copied!' : 'Tap to copy'}
            </span>
          </button>
          <p className="text-[#9A8B91] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
            He sees your cycle calendar only — never your journal.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[#9A8B91] text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Link his account to yours so he can follow your cycle — ovulation days, fertile window, and when to expect your period.
          </p>
          <button onClick={handleInvite} disabled={generating}
            className="w-full py-2.5 rounded-full text-white text-sm font-medium disabled:opacity-50"
            style={{ fontFamily: 'Poppins, sans-serif', background: '#FF1493' }}>
            {generating ? 'Creating invite...' : 'Invite Your Partner'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user, token, logout, updateUser } = useAuth();
  const { isPro } = usePremium();
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

  return (
    <div className="pb-32 lg:pb-8 lg:pl-72 p-6 min-h-screen">
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
              className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#F4D3DC] to-[#9B7BC9] flex items-center justify-center overflow-hidden border-2 border-[#F4D3DC]/30 hover:border-[#F4D3DC] transition-all cursor-pointer block"
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
          
          <div className="flex-1">
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
            <p className="text-[#9A8B91] text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="bento-card overflow-hidden mb-6">
        <Link 
          to="/founders-note"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#E8A4B8]" />
            <span className="text-[#FDF8FA]">Founder&apos;s Note</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9A8B91]" />
        </Link>
        
        <Link 
          to="/contact"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-[#F4D3DC]" />
            <span className="text-[#FDF8FA]">Contact Us</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9A8B91]" />
        </Link>

        <Link 
          to="/privacy"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#9B7BC9]" />
            <span className="text-[#FDF8FA]">Privacy Policy</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9A8B91]" />
        </Link>

        <Link 
          to="/terms"
          className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-t border-white/5"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#9B7BC9]" />
            <span className="text-[#FDF8FA]">Terms of Service</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9A8B91]" />
        </Link>
      </div>

      {/* Pro Upgrade */}
      {!isPro && (
        <Link
          to="/pro"
          className="glass-card p-5 mb-6 flex items-center justify-between border border-[#7b4fa6]/30 hover:border-[#7b4fa6]/60 transition-all block"
          data-testid="upgrade-pro-btn"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7b4fa6]/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-[#c9b8f0]" />
            </div>
            <div>
              <p className="text-[#F4D3DC] text-sm font-medium">Upgrade to Pro</p>
              <p className="text-[#9A8B91] text-xs">Unlock all premium features</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#7b4fa6]" />
        </Link>
      )}
      {isPro && (
        <Link to="/pro" className="block mb-6 rounded-xl p-4" style={{ border: '2px solid #D4A853', background: 'rgba(212,168,83,0.06)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(212,168,83,0.15)' }}>
              <Crown className="w-5 h-5" style={{ color: '#D4A853' }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: '#D4A853', fontFamily: 'Poppins, sans-serif' }}>HORMOscope Pro</p>
              <p className="text-[#9A8B91] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Your Pro Self, Cycle by Cycle</p>
            </div>
          </div>
          <div className="w-full py-2.5 rounded-full text-white text-sm font-semibold text-center" style={{ fontFamily: 'Poppins, sans-serif', background: 'linear-gradient(135deg, #D4A853, #c9a030)', border: '1px solid #D4A853' }}>
            View Your Pro Features
          </div>
        </Link>
      )}

      {/* Attuned Partner Mode */}
      <AttunedSection token={token} />

      {/* Logout */}
      <button
        data-testid="logout-btn"
        onClick={handleLogout}
        className="w-full py-4 rounded-full bg-[#E85A6B]/10 hover:bg-[#E85A6B]/20 text-[#E85A6B] border border-[#E85A6B]/30 transition-all flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
}
