import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BRAND, HEADING_FONT, BODY_FONT } from '../lib/phases';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const EMPTY = { title: '', image_url: '', amazon_url: '', category: '', note: '' };

// Admins only (ADMIN_EMAILS). Add, edit, hide or delete catalog items.
export default function AdminCatalogPage() {
  const { token } = useAuth();
  const H = { headers: { Authorization: `Bearer ${token}` } };
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => axios.get(`${API}/admin/catalog`, H).then((r) => setItems(r.data.items)).catch(() => setItems('denied'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const detail = (e) => (typeof e.response?.data?.detail === 'string' ? e.response.data.detail : 'Could not save.');
  const save = async () => {
    setMsg('');
    try {
      if (editing) await axios.put(`${API}/admin/catalog/${editing}`, form, H); else await axios.post(`${API}/admin/catalog`, form, H);
      setForm(EMPTY); setEditing(null); setMsg('Saved.'); load();
    } catch (e) { setMsg(detail(e)); }
  };
  const hide = async (it) => { await axios.put(`${API}/admin/catalog/${it.id}`, { hidden: !it.hidden }, H); load(); };
  const del = async (it) => { if (window.confirm(`Delete "${it.title}"?`)) { await axios.delete(`${API}/admin/catalog/${it.id}`, H); load(); } };
  const field = (k, label, ph) => (
    <label className="block mb-3"><span className="text-xs uppercase tracking-wider" style={{ color: BRAND.lilac }}>{label}</span>
      <input value={form[k] || ''} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="input-dark mt-1" data-testid={`admin-${k}`} /></label>
  );
  if (items === 'denied') return <div className="min-h-screen p-6 text-white" style={{ background: BRAND.bg }}>Admins only.</div>;
  return (
    <div className="min-h-screen px-4 pt-8 pb-28" style={{ background: BRAND.bg, fontFamily: BODY_FONT }} data-testid="admin-catalog">
      <Link to="/boutique" className="inline-flex items-center gap-1 text-[#E6E0EE] mb-3"><ChevronLeft className="w-5 h-5" /> Catalog</Link>
      <h1 className="text-3xl text-white mb-4" style={{ fontFamily: HEADING_FONT }}>Manage Catalog</h1>
      <div className="rounded-2xl p-4 mb-6" style={{ background: BRAND.surface }}>
        {field('title', 'Title', 'Product name')}
        {field('amazon_url', 'Amazon link', 'https://www.amazon.com/dp/...')}
        {field('image_url', 'Image link', 'https://...')}
        {field('category', 'Category (optional)', 'Comfort, Self-care...')}
        {field('note', 'Note (optional)', 'Why you love it')}
        <p className="text-[11px] mb-3" style={{ color: BRAND.textMuted }}>The Associates tag hormoscope20-20 is added to Amazon links automatically. No prices are shown.</p>
        <div className="flex gap-2">
          <button onClick={save} disabled={!form.title || !form.amazon_url || !form.image_url} className="flex-1 py-2.5 rounded-full text-white disabled:opacity-50" style={{ background: BRAND.pink }} data-testid="admin-save">{editing ? 'Save changes' : 'Add item'}</button>
          {editing && <button onClick={() => { setEditing(null); setForm(EMPTY); }} className="px-4 rounded-full text-white border border-white/20">Cancel</button>}
        </div>
        {msg && <p className="text-xs mt-2" style={{ color: BRAND.textMuted }}>{msg}</p>}
      </div>
      {(items || []).map((it) => (
        <div key={it.id} className="flex gap-3 items-center rounded-2xl p-2 mb-2" style={{ background: BRAND.surface, opacity: it.hidden ? 0.5 : 1 }}>
          <img src={it.image_url} alt="" className="w-14 h-14 rounded-xl object-contain bg-white" />
          <div className="flex-1 min-w-0"><p className="text-white text-sm truncate">{it.title}</p><p className="text-[11px]" style={{ color: BRAND.textMuted }}>{it.hidden ? 'Hidden' : 'Live'}{it.category ? ` \u00b7 ${it.category}` : ''}</p></div>
          <div className="flex flex-col gap-1 text-[11px]">
            <button onClick={() => { setEditing(it.id); setForm({ ...EMPTY, ...it }); window.scrollTo(0, 0); }} style={{ color: BRAND.lilac }}>Edit</button>
            <button onClick={() => hide(it)} style={{ color: BRAND.lilac }}>{it.hidden ? 'Show' : 'Hide'}</button>
            <button onClick={() => del(it)} style={{ color: '#E85A6B' }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
