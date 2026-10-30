import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Loader2, X, Heart } from 'lucide-react';
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
                background: active ? HOT : 'rgba(255,255,255,0.05)',
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
          {/* v50: grouped under her section headings, in her order.
              A section with no products does not show. */}
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
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium" style={{ ...poppins, color: '#9fd8b4', border: '1px solid rgba(159,216,180,0.45)' }} data-testid={`in-boutique-${p.asin}`}>
                          <Heart className="w-3.5 h-3.5" fill="currentColor" /> In your wishlist
                        </span>
                      ) : (
                        <button
                          onClick={() => addPick(p.asin)}
                          disabled={busyAsin === p.asin}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-white disabled:opacity-50"
                          style={{ ...poppins, background: HOT }}
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
        </div>
      )}
    </div>
  );
}
