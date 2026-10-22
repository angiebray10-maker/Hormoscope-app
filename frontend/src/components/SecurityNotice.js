import React from 'react';
import { Shield } from 'lucide-react';

// Security & privacy notice. Every line here must stay literally true;
// verified in code on Oct 22, 2026:
//  - passwords: bcrypt hash (backend/server.py hash_password)
//  - delete account: DELETE /api/auth/account + Profile > Delete account
// Do NOT add "encrypted at rest" or "security tested" unless that becomes true.
export const SECURITY_POINTS = [
  'Your data travels over HTTPS (encrypted in transit).',
  'Passwords are stored only as secure hashes (bcrypt), never as plain text.',
  'We never sell your data.',
  'You can delete your account and data at any time from Profile.',
  "We follow Google Play's User Data and health app policies.",
];

export default function SecurityNotice({ compact = false, className = '' }) {
  return (
    <div
      className={`security-notice rounded-2xl border border-white/15 ${compact ? 'p-3' : 'p-5'} ${className}`}
      style={{ background: 'rgba(255,255,255,0.04)' }}
      data-testid="security-notice"
    >
      <p className={`flex items-center gap-2 text-white font-semibold ${compact ? 'text-xs mb-1.5' : 'text-sm mb-3'}`}>
        <Shield className="w-4 h-4" /> Security &amp; privacy
      </p>
      <ul className={`space-y-1 ${compact ? 'text-[11px]' : 'text-sm'}`} style={{ color: '#E6E0EE' }}>
        {SECURITY_POINTS.map((t) => <li key={t}>• {t}</li>)}
      </ul>
    </div>
  );
}
