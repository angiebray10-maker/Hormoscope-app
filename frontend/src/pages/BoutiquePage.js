import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Heart, ExternalLink, ChevronLeft, Lock, Users, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BRAND, PHASE_COLORS, HEADING_FONT, BODY_FONT } from '../lib/phases';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SOFT = [PHASE_COLORS.follicular, '#FFC9A8', PHASE_COLORS.luteal, '#8FD3C9'];
export const DISCLOSURE = 'As an Amazon Associate, HORMOscope earns from qualifying purchases.';

export const firstName = (n) => ((n || '').trim().split(/\s+/)[0] || 'My');
const possessive = (n) => (n === 'My' ? 'My' : `${n}${n.endsWith('s') ? '\u2019' : '\u2019s'}`);

export function Disclosure() {
  return <p className="text-[11px] text-center mt-6 px-4" style={{ color: BRAND.textMuted, fontFamily: "'Inter', sans-serif" }} data-testid="amazon-disclosure">{DISCLOSURE}</p>;
}

// Elegant product card shared by Catalog, Wishlist and the partner view.
export function ProductCard({ item, idx = 0, hearted, onHeart }) {
  const accent = SOFT[idx % SOFT.length];
  return (
    <div className="rounded-3xl overflow-hidden flex flex-col" style={{ background: BRAND.surface, border: `1px solid ${accent}40`, boxShadow: `0 10px 30px -18px ${accent}` }} data-testid="product-card">
      <div className="relative aspect-square bg-white">
        {item.image_url && <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-contain p-3" />}
        {onHeart && (
          <button onClick={() => onHeart(item)} aria-label={hearted ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={!!hearted}
            className="absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(11,11,30,0.75)' }} data-testid="heart-btn">
            <Heart className="w-5 h-5" style={{ color: BRAND.pink }} fill={hearted ? BRAND.pink : 'none'} />
          </button>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1" style={{ fontFamily: BODY_FONT }}>
        {item.category && <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: accent }}>{item.category}</p>}
        <p className="text-white text-[13px] leading-snug line-clamp-2">{item.title}</p>
        {item.note && <p className="text-[11px] mt-1 line-clamp-2" style={{ color: BRAND.textMuted }}>{item.note}</p>}
        <a href={item.amazon_url} target="_blank" rel="noopener noreferrer sponsored" className="mt-auto pt-3 text-[12px] inline-flex items-center gap-1 font-medium" style={{ color: accent }} data-testid="view-on-amazon">
          View on Amazon <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

const Grid = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>;

export default function BoutiquePage() {
  const { token, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'wishlist' ? 'wishlist' : 'catalog';
  const [catalog, setCatalog] = useState([]);
  const [wish, setWish] = useState({ items: [], public: true });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const H = { headers: { Authorization: `Bearer ${token}` } };

  const load = useCallback(async () => {
    try {
      const [c, w] = await Promise.all([axios.get(`${API}/catalog`), axios.get(`${API}/wishlist`, H)]);
      setCatalog(c.data.items || []); setWish(w.data);
    } catch (e) { /* offline: keep what we have */ }
    finally { setLoading(false); }
    axios.get(`${API}/admin/catalog`, H).then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const ids = new Set(wish.items.map((i) => i.id));
  const toggle = async (item) => {
    const had = ids.has(item.id);
    setWish((w) => ({ ...w, items: had ? w.items.filter((i) => i.id !== item.id) : [item, ...w.items] }));
    try { await axios.post(`${API}/wishlist/${item.id}`, {}, H); } catch (e) { load(); }
  };
  const setPublic = async (pub) => {
    setWish((w) => ({ ...w, public: pub }));
    try { await axios.put(`${API}/wishlist/visibility`, { public: pub }, H); } catch (e) { load(); }
  };
  const title = `${possessive(firstName(wish.name || user?.name))} Wishlist`;

  return (
    <div className="min-h-screen px-4 pt-8 pb-28" style={{ background: BRAND.bg, fontFamily: BODY_FONT }} data-testid="boutique">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-3xl text-white" style={{ fontFamily: HEADING_FONT }}>{tab === 'catalog' ? 'HORMOscope Catalog' : title}</h1>
        {isAdmin && <Link to="/admin/catalog" aria-label="Manage catalog" className="p-2" style={{ color: BRAND.lilac }} data-testid="admin-catalog-link"><Settings className="w-5 h-5" /></Link>}
      </div>
      <p className="text-xs mb-4" style={{ color: BRAND.textMuted }}>{tab === 'catalog' ? 'Hand-picked by Angie. Tap the heart to save to your wishlist.' : 'Your saved favorites, all in one place.'}</p>
      <div className="flex p-1 rounded-full mb-5" style={{ background: BRAND.surface }} role="tablist">
        {[['catalog', 'Catalog'], ['wishlist', `Wishlist (${wish.items.length})`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams(k === 'catalog' ? {} : { tab: k })}
            className="flex-1 py-2 rounded-full text-sm" style={{ background: tab === k ? BRAND.pink : 'transparent', color: '#fff' }} data-testid={`tab-${k}`}>{l}</button>
        ))}
      </div>

      {tab === 'wishlist' && (
        <div className="rounded-2xl p-3 mb-4 flex items-center gap-3" style={{ background: BRAND.surface, border: '1px solid rgba(255,255,255,0.08)' }} data-testid="wishlist-privacy">
          {wish.public ? <Users className="w-5 h-5 shrink-0" style={{ color: '#8FD3C9' }} /> : <Lock className="w-5 h-5 shrink-0" style={{ color: BRAND.lilac }} />}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm">{wish.public ? 'Public to partner' : 'Private'}</p>
            <p className="text-[11px]" style={{ color: BRAND.textMuted }}>{wish.public ? 'Your Attuned partner can see this list and shop it.' : 'Only you can see this list.'}</p>
          </div>
          <div className="flex rounded-full p-0.5" style={{ background: BRAND.bg }}>
            <button onClick={() => setPublic(true)} className="px-3 py-1 rounded-full text-xs text-white" style={{ background: wish.public ? '#5FB3A6' : 'transparent' }} data-testid="wishlist-public-btn">Public</button>
            <button onClick={() => setPublic(false)} className="px-3 py-1 rounded-full text-xs text-white" style={{ background: !wish.public ? '#7B5FB8' : 'transparent' }} data-testid="wishlist-private-btn">Private</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-center text-sm" style={{ color: BRAND.textMuted }}>Loading...</p> : tab === 'catalog' ? (
        catalog.length ? <Grid>{catalog.map((it, i) => <ProductCard key={it.id} item={it} idx={i} hearted={ids.has(it.id)} onHeart={toggle} />)}</Grid>
          : <p className="text-center text-sm py-10" style={{ color: BRAND.textMuted }}>New picks are on the way.</p>
      ) : (
        wish.items.length ? <Grid>{wish.items.map((it, i) => <ProductCard key={it.id} item={it} idx={i} hearted onHeart={toggle} />)}</Grid>
          : <p className="text-center text-sm py-10" style={{ color: BRAND.textMuted }}>Nothing saved yet. Tap the heart on anything in the Catalog.</p>
      )}
      <Disclosure />
    </div>
  );
}

// What an Attuned partner sees: the other person's wishlist, if shared.
export function PartnerWishlistPage() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get(`${API}/partner/wishlist`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setData(r.data)).catch(() => setData({ error: true }));
  }, [token]);
  const name = possessive(firstName(data?.name));
  return (
    <div className="min-h-screen px-4 pt-8 pb-28" style={{ background: BRAND.bg, fontFamily: BODY_FONT }} data-testid="partner-wishlist">
      <Link to="/attunement" className="inline-flex items-center gap-1 text-[#E6E0EE] mb-3"><ChevronLeft className="w-5 h-5" /> Back</Link>
      <h1 className="text-3xl text-white mb-1" style={{ fontFamily: HEADING_FONT }}>{data?.name ? `${name} Wishlist` : 'Wishlist'}</h1>
      {!data ? <p className="text-sm" style={{ color: BRAND.textMuted }}>Loading...</p>
        : data.error ? <p className="text-sm" style={{ color: BRAND.textMuted }}>Couldn't load right now.</p>
        : !data.is_linked ? <p className="text-sm" style={{ color: BRAND.textMuted }}>Connect in Attunement to see your partner's wishlist.</p>
        : !data.shared ? <p className="text-sm" style={{ color: BRAND.textMuted }}>{firstName(data.name)} is keeping this list private for now.</p>
        : (<>
          <p className="text-xs mb-5" style={{ color: BRAND.textMuted }}>Things {firstName(data.name)} would love. Tap any one to see it on Amazon.</p>
          {data.items.length ? <Grid>{data.items.map((it, i) => <ProductCard key={it.id} item={it} idx={i} />)}</Grid>
            : <p className="text-center text-sm py-10" style={{ color: BRAND.textMuted }}>Nothing saved yet.</p>}
        </>)}
      <Disclosure />
    </div>
  );
}
