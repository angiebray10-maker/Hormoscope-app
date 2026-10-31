import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Loader2, X, Heart, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';
import { PartnerAvatar } from '../pages/AttunementPage';
import { CATALOG_PRODUCTS, PRODUCT_BY_ASIN, amazonUrl, CATALOG_SECTIONS, CATALOG_PRICES_LINE, formatPrice } from '../data/catalog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PINK = '#f4a7b9';
const HOT = '#FF4F9A';
const poppins = { fontFamily: 'Poppins, sans-serif' };
const script = { fontFamily: "'Poiret One', sans-serif" };

// Attuned Gifts (Angelita, Oct 25, 2026): inside Attunement, a section
// headed with the short line "Make your wishlist" (Angelita, Oct 26,
// 2026: the long explanation is gone) with a
// tab menu. FIRST tab is the user's own wishlist (with her name and
// picture on it), LAST tab is "Gift Catalog" (her gift catalog,
// renamed Oct 26, 2026 from its earlier name). The catalog is ONE
// catalog (Angelita, Oct 26, 2026), grouped under her section
// headings in her order since v50: no collections, no phase baskets.
// Since Oct 26, 2026 the wishlist is always
// part of the partner experience: a linked partner (and anyone with
// her partner view link) always sees it, so there is no visibility
// switch here anymore. Her control is the contents of the list.
// Amazon links open OUTSIDE the WebView (Amazon's rule): the Capacitor
// shell treats window.open(url, '_system') as an external browser open.

function wishlistTitle(name, fallback) {
  const first = (name || '').trim().split(/\s+/)[0];
  if (!first) return fallback;
  return first.endsWith('s') || first.endsWith('S') ? `${first}' Wishlist` : `${first}'s Wishlist`;
}

function openAmazon(asin) {
  window.open(amazonUrl(asin), '_system');
}

function fmtCommentDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// v50 (Angelita, Oct 26, 2026): every row shows the product's
// picture and its price UP FRONT, no tap needed. The picture sits at
// the left (about 64px, rounded); where research could not verify an
// image, a soft placeholder tile carries our peach logo at low
// opacity. The price sits under the name; where no price could be
// verified, no price shows at all. The same row serves the catalog
// and both wishlists.
function ProductCard({ product, children }) {
  const price = formatPrice(product.price);
  return (
    <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }} data-testid={`product-${product.asin}`}>
      <div className="flex gap-3">
        {product.image ? (
          <img
            src={product.image}
            alt=""
            loading="lazy"
            className="rounded-xl shrink-0"
            style={{ width: 64, height: 64, objectFit: 'cover', background: 'rgba(255,255,255,0.05)' }}
            data-testid={`image-${product.asin}`}
          />
        ) : (
          <div
            className="rounded-xl shrink-0 flex items-center justify-center"
            style={{ width: 64, height: 64, background: 'rgba(255,79,154,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}
            data-testid={`image-placeholder-${product.asin}`}
            aria-hidden="true"
          >
            <img src="/images/logo.png" alt="" style={{ width: 40, height: 40, objectFit: 'contain', opacity: 0.35 }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {/* Founder's personal favorite banner (Angelita, Oct 31,
              2026): the two wild yam creams carry founder: true in the
              catalog and show this small pink-outlined label above
              the product name, in the catalog and in wishlists alike,
              since the same row serves both. Exact words are hers. */}
          {product.founder && (
            <span
              className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium mb-2"
              style={{ ...poppins, color: HOT, background: 'transparent', border: '1.5px solid #FF4F9A' }}
              data-testid={`founder-favorite-${product.asin}`}
            >
              HORMOscope's founder's personal favorite
            </span>
          )}
          {/* The product NAME is the Amazon link (Angelita, Oct 26, 2026):
              no buy wording, no view wording, no button label at all
              until she picks a word she likes. Same tagged link, same
              outside-the-WebView open as before. */}
          <h4 className="text-white text-sm font-medium leading-snug mb-1" style={poppins}>
            <a
              href={amazonUrl(product.asin)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.preventDefault(); openAmazon(product.asin); }}
              className="underline decoration-[rgba(244,167,185,0.55)] underline-offset-2"
              data-testid={`amazon-${product.asin}`}
            >
              {product.name}
            </a>
          </h4>
          {price && (
            <p className="text-sm font-medium mb-1" style={{ ...poppins, color: PINK }} data-testid={`price-${product.asin}`}>{price}</p>
          )}
          <p className="text-[#b8b8d1] text-xs leading-relaxed mb-3" style={poppins}>{product.blurb}</p>
          {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// The community wall (Angelita, Oct 31, 2026): ONE public comment
// area at the bottom of the Gift Catalog, instead of a review on
// every product. The women write which items they tried and liked
// and what they would like to see, and Angelita finds the suggested
// items. Every signed-in user sees the wall; a woman can delete
// only her own comments. Angelita's own comments (she writes them
// herself, from her account) come pinned at the top from the API,
// with her picture and a Founder label. Her life-stages progression
// artwork sits faded behind it, the same treatment as the Journal
// note; per her word those are the only two places that artwork
// belongs.
function CommunityWall({ token, user }) {
  const [comments, setComments] = useState(null); // null while loading
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [wallMsg, setWallMsg] = useState('');
  const auth = { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 };

  const fetchComments = useCallback(async () => {
    if (!token) { setComments([]); return; }
    try {
      const res = await axios.get(`${API}/catalog/comments`, auth);
      setComments(Array.isArray(res.data?.comments) ? res.data.comments : []);
    } catch (err) {
      logger.error('Catalog comments load error:', err);
      setComments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const postComment = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true); setWallMsg('');
    try {
      await axios.post(`${API}/catalog/comments`, { text }, auth);
      setDraft('');
      await fetchComments();
    } catch (err) {
      setWallMsg("Couldn't post that just now. Please try again.");
      logger.error('Catalog comment post error:', err);
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await axios.delete(`${API}/catalog/comments/${id}`, auth);
      setComments((prev) => (prev || []).filter((c) => c.id !== id));
    } catch (err) {
      setWallMsg("Couldn't delete that just now. Please try again.");
      logger.error('Catalog comment delete error:', err);
    }
  };

  return (
    <div className="relative rounded-2xl mt-6 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }} data-testid="catalog-community">
      <img src="/images/life-stages-silhouettes.webp" alt="" aria-hidden="true" className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[72%] object-contain pointer-events-none" style={{ opacity: 0.15 }} />
      <div className="relative z-10 p-4">
        <h3 className="text-white text-lg mb-1" style={script}>Community</h3>
        <p className="text-[#CFC3CC] text-xs leading-relaxed mb-2" style={poppins}>
          Leave a comment. Show off the gifts you got and say how much you liked them. If you have any suggestions, or if you did not like them, say it here. Leave a comment.
        </p>
        {comments === null ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#f4a7b9] animate-spin" /></div>
        ) : comments.length === 0 ? (
          <p className="text-[#b8b8d1] text-sm leading-relaxed py-2" style={poppins}>No comments yet. Be the first to share what you tried.</p>
        ) : (
          <div>
            {comments.map((c) => (
              <div key={c.id} className="py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} data-testid={`catalog-comment-${c.id}`}>
                <div className="flex items-start justify-between gap-2">
                  {/* The founder's comments come pinned first from
                      the API and read as hers: her picture (or her
                      initial when she has none), her name, and a
                      small Founder label. */}
                  <div className="flex items-center gap-2 min-w-0">
                    {c.is_founder && <PartnerAvatar photo={c.photo} name={c.name} size={26} />}
                    <p className="text-xs" style={poppins}>
                      <span style={{ color: PINK }}>{c.name}</span>{' '}
                      {c.is_founder && (
                        <span className="inline-block align-middle rounded-full px-2 py-px text-[9px] font-semibold uppercase tracking-wider mr-1" style={{ color: HOT, border: '1px solid rgba(255,79,154,0.55)' }} data-testid={`founder-label-${c.id}`}>Founder</span>
                      )}
                      <span className="text-white/30">{fmtCommentDate(c.created_at)}</span>
                    </p>
                  </div>
                  {user && c.user_id === user.id && (
                    <button onClick={() => deleteComment(c.id)} className="text-white/30 hover:text-red-400 p-1 shrink-0" title="Delete this comment" data-testid={`delete-catalog-comment-${c.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[#FDF8FA] text-sm leading-relaxed whitespace-pre-wrap mt-1" style={poppins}>{c.text}</p>
              </div>
            ))}
          </div>
        )}
        {wallMsg && <p className="text-red-400 text-xs mt-2 mb-1" style={poppins}>{wallMsg}</p>}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share what you tried, or ask for something you are looking for..."
          rows={3}
          maxLength={500}
          className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none mt-3 mb-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'Poppins, sans-serif' }}
          data-testid="catalog-comment-input"
          aria-label="Write a comment"
        />
        <button
          onClick={postComment}
          disabled={posting || !draft.trim()}
          className="px-5 py-2 rounded-full text-xs font-medium text-white disabled:opacity-50"
          style={{ ...poppins, background: 'transparent', border: '1.5px solid #FF4F9A' }}
          data-testid="catalog-comment-post"
        >
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}

export default function AttunementGifts() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('boutique');
  const [myPicks, setMyPicks] = useState(null); // array of ASINs, null while loading
  const [partnerBoutique, setPartnerBoutique] = useState(null);
  const [busyAsin, setBusyAsin] = useState(null);
  const [msg, setMsg] = useState('');

  const auth = { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 };

  useEffect(() => {
    if (!token) { setMyPicks([]); return; }
    axios.get(`${API}/wishlist`, auth)
      .then((res) => setMyPicks((res.data.items || []).map((i) => i.product_id)))
      .catch(() => setMyPicks([]));
    axios.get(`${API}/partner/wishlist`, auth)
      .then((res) => setPartnerBoutique({
        name: res.data.partner_name,
        photo: res.data.partner_photo,
        items: (res.data.items || []).map((i) => i.product_id).filter((a) => PRODUCT_BY_ASIN[a]),
      }))
      .catch(() => setPartnerBoutique(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addPick = useCallback(async (asin) => {
    if (busyAsin) return;
    setBusyAsin(asin); setMsg('');
    try {
      await axios.post(`${API}/wishlist`, { product_id: asin }, auth);
      setMyPicks((prev) => (prev && prev.includes(asin) ? prev : [...(prev || []), asin]));
    } catch (err) {
      setMsg("Couldn't add that just now. Please try again.");
      logger.error('Wishlist add error:', err);
    } finally {
      setBusyAsin(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyAsin, token]);

  const removePick = useCallback(async (asin) => {
    if (busyAsin) return;
    setBusyAsin(asin); setMsg('');
    try {
      await axios.delete(`${API}/wishlist/${asin}`, auth);
      setMyPicks((prev) => (prev || []).filter((a) => a !== asin));
    } catch (err) {
      setMsg("Couldn't remove that just now. Please try again.");
      logger.error('Wishlist remove error:', err);
    } finally {
      setBusyAsin(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyAsin, token]);

  const tabs = [
    { id: 'boutique', label: wishlistTitle(user?.name, 'My Wishlist') },
    ...(partnerBoutique ? [{ id: 'partner', label: wishlistTitle(partnerBoutique.name, 'Their Wishlist') }] : []),
    { id: 'catalog', label: 'Gift Catalog' },
  ];

  return (
    <div className="card p-5 mb-4" data-testid="attunement-gifts">
      <div className="flex items-center gap-2 mb-2">
        <Gift className="w-5 h-5" style={{ color: PINK }} />
        <h2 className="text-white text-xl" style={script}>Attuned gifts</h2>
      </div>
      <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
        Make your wishlist
      </p>

      {/* Tab menu: her wishlist first, Gift Catalog last (her spec). */}
      <div className="flex gap-2 mb-5 flex-wrap" role="tablist" data-testid="gift-tabs">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              className="px-3.5 py-2 rounded-full text-xs font-medium transition-colors"
              style={{
                ...poppins,
                background: active ? 'transparent' : 'rgba(255,255,255,0.05)',
                color: active ? '#fff' : '#CFC3CC',
                border: `1px solid ${active ? HOT : 'rgba(255,255,255,0.12)'}`,
              }}
              data-testid={`gift-tab-${t.id}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {msg && <p className="text-red-400 text-xs text-center mb-3" style={poppins}>{msg}</p>}

      {activeTab === 'boutique' && (
        <div data-testid="boutique-tab">
          <div className="flex items-center gap-3 mb-2">
            <PartnerAvatar photo={user?.profile_photo} name={user?.name} size={44} />
            <div>
              <h3 className="text-white text-lg leading-tight" style={script}>{wishlistTitle(user?.name, 'My Wishlist')}</h3>
              <p className="text-[#B4B0C8] text-[11px]" style={poppins}>The pieces you picked, gathered in one place.</p>
            </div>
          </div>
          <p className="text-[#CFC3CC] text-xs mb-4" style={poppins}>
            The Gift Catalog is in the last tab.
          </p>

          {myPicks === null ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#f4a7b9] animate-spin" /></div>
          ) : myPicks.length === 0 ? (
            <div className="py-2" data-testid="boutique-empty" />
          ) : (
            myPicks.filter((a) => PRODUCT_BY_ASIN[a]).map((asin) => {
              const product = PRODUCT_BY_ASIN[asin];
              return (
                <ProductCard key={asin} product={product}>
                  <button
                    onClick={() => removePick(asin)}
                    disabled={busyAsin === asin}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs disabled:opacity-50"
                    style={{ ...poppins, color: '#CFC3CC', border: '1px solid rgba(255,255,255,0.18)' }}
                    data-testid={`remove-${asin}`}
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </ProductCard>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'partner' && partnerBoutique && (
        <div data-testid="partner-boutique-tab">
          <p className="text-[#CFC3CC] text-xs mb-3" style={poppins}>Your partner's wishlist</p>
          <div className="flex items-center gap-3 mb-4">
            <PartnerAvatar photo={partnerBoutique.photo} name={partnerBoutique.name} size={44} />
            <h3 className="text-white text-lg leading-tight" style={script}>{wishlistTitle(partnerBoutique.name, 'Their Wishlist')}</h3>
          </div>
          {partnerBoutique.items.length === 0 ? (
            <p className="text-[#b8b8d1] text-sm leading-relaxed" style={poppins}>
              They have not picked anything yet. When they do, their pieces will show up here.
            </p>
          ) : (
            partnerBoutique.items.map((asin) => {
              const product = PRODUCT_BY_ASIN[asin];
              return (
                <ProductCard key={asin} product={product} />
              );
            })
          )}
        </div>
      )}

      {activeTab === 'catalog' && (
        <div data-testid="catalog-tab">
          {/* Grouped under her section headings, in her order (the
              eleven sections of Oct 31, 2026, plus the end hold for
              the ten products awaiting her ruling). A section with
              no products does not show. */}
          {CATALOG_SECTIONS.map((section) => {
            const items = CATALOG_PRODUCTS.filter((p) => p.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} data-testid={`catalog-section-${section}`}>
                <h3 className="text-base mt-5 mb-3" style={{ ...script, color: HOT }}>{section}</h3>
                {items.map((p) => {
                  const inBoutique = (myPicks || []).includes(p.asin);
                  return (
                    <ProductCard key={p.asin} product={p}>
                      {inBoutique ? (
                        // The "In your wishlist" pill is a TOGGLE, not a
                        // label (Angelita, Oct 31, 2026): tapping it again
                        // takes the item back out of the wishlist. It used
                        // to be a plain span with no onClick, so tapping it
                        // did nothing.
                        <button
                          onClick={() => removePick(p.asin)}
                          disabled={busyAsin === p.asin}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium disabled:opacity-50"
                          style={{ ...poppins, color: '#9fd8b4', background: 'transparent', border: '1px solid rgba(159,216,180,0.45)' }}
                          data-testid={`in-boutique-${p.asin}`}
                          aria-label={`Remove ${p.name} from my wishlist`}
                          title="Tap to remove from your wishlist"
                        >
                          <Heart className="w-3.5 h-3.5" fill="currentColor" /> In your wishlist
                        </button>
                      ) : (
                        <button
                          onClick={() => addPick(p.asin)}
                          disabled={busyAsin === p.asin}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-white disabled:opacity-50"
                          style={{ ...poppins, background: 'transparent', border: '1.5px solid #FF4F9A' }}
                          data-testid={`add-${p.asin}`}
                        >
                          <Heart className="w-3.5 h-3.5" /> Add to my wishlist
                        </button>
                      )}
                    </ProductCard>
                  );
                })}
              </div>
            );
          })}
          <p className="text-[#B4B0C8] text-[11px] leading-relaxed mt-4" style={poppins}>{CATALOG_PRICES_LINE}</p>
          <CommunityWall token={token} user={user} />
        </div>
      )}
    </div>
  );
}
