// Gift Catalog, her gift catalog (Angelita's picks).
// ONE catalog (Angelita, Oct 26, 2026), shown grouped under her
// section headings in her order (v50, Oct 26, 2026): HORMOscope
// Picks first (renamed from Women's Essentials in v54, Oct 29, 2026,
// her word: that name was not hers), then flowers, clothing, jewelry, candles and
// smelly stuff, decorations and toys, advent calendars, gift sets,
// snacks, and Luxe last (v54: her diamond tennis bracelet lives
// there alone for now; it still has no verified price or image, so
// both stay null until real data exists). A section with no
// products simply does not show.
// Every link carries her Amazon Associates tag.
// v50 (Angelita, Oct 26, 2026): every row shows the product's picture
// and its price UP FRONT. Images and prices come from the Oct 27,
// 2026 research pass (catalog-data.json): where no image could be
// verified the row uses a soft peach placeholder tile, and where no
// price could be verified the row shows no price at all. We never
// invent either. Prices are checked again each catalog update; the
// catalog carries the line "Prices checked October 27, 2026."
// The backend validates wishlist picks against this same ASIN list.
// Picks that are still unidentified (B0FHWWCDJ2, B0H6J6LYLX,
// B09ZFP9XLC; her screenshots pending) are NOT in this list and must
// not be added until she names them.

export const AMAZON_TAG = 'hormoscope20-20';

export const amazonUrl = (asin) => `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;

export const CATALOG_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

export const CATALOG_PRICES_LINE = 'Prices checked October 27, 2026. Amazon shows the live price when you tap through.';

// Her section order. Sections with no products are skipped.
export const CATALOG_SECTIONS = [
  "HORMOscope Picks",
  'Flowers',
  'Clothing',
  'Jewelry',
  'Candles & Smelly Stuff',
  'Decorations & Toys',
  'Advent Calendars',
  'Gift Sets',
  'Snacks',
  'Luxe',
];

export const formatPrice = (price) =>
  typeof price === 'number' ? `$${price.toFixed(2)}` : null;

export const CATALOG_PRODUCTS = [
  { asin: 'B0FHBXCCLM', name: 'Dona Tea Library', blurb: '18 premium blended teas, 36 sachets in an elegant case.', image: 'https://m.media-amazon.com/images/I/718HP8ZB13L._SX569_.jpg', price: 79, section: 'Snacks' },
  { asin: 'B0C1YG33PD', name: 'BouZaFoFa Portable Heating Pad for Cramps', blurb: 'Cordless heating belt with 6 heat levels and 6 massage modes.', image: 'https://m.media-amazon.com/images/I/41iqdbVzm+L.jpg', price: 19.99, section: "HORMOscope Picks" },
  { asin: 'B0C9LCM3HW', name: 'FLEX Reusable Menstrual Disc Starter Bundle', blurb: 'Silicone reusable disc with foaming wash and biodegradable wipes.', image: null, price: 49.97, section: "HORMOscope Picks" },
  { asin: 'B07NLSLP9K', name: 'Always Radiant Pads, Size 5 Extra Heavy Overnight, 54 Count', blurb: 'FlexFoam pads with wings for extra heavy overnight protection.', image: 'https://m.media-amazon.com/images/I/51YQCkH1eWL.jpg', price: 24.84, section: "HORMOscope Picks" },
  { asin: 'B093LVS21D', name: 'Tampax Pearl Tampons, Regular, 50 Count x 2', blurb: 'LeakGuard Braid, unscented. 100 tampons total.', image: 'https://m.media-amazon.com/images/I/51Jh8uiyKsL.jpg', price: 22.71, section: "HORMOscope Picks" },
  { asin: 'B083C6BYG9', name: 'Rael Slim Applicator Tampons, Organic Cotton, 40 Count', blurb: 'Organic cotton core with a slim, BPA free applicator.', image: 'https://m.media-amazon.com/images/I/41LOZTBQoKL.jpg', price: 18.99, section: "HORMOscope Picks" },
  { asin: 'B0FGB2NS3C', name: 'Philips Lumea 9000 Series IPL Hair Removal Device', blurb: 'SenseIQ IPL with 4 attachments for body, face, bikini and underarms.', image: null, price: 579.95, section: "HORMOscope Picks" },
  { asin: 'B07M5X4D3P', name: 'iRESTORE Professional Laser Hair Growth System', blurb: 'Red light therapy cap with 282 lasers and LEDs.', image: 'https://m.media-amazon.com/images/I/31nSdU7iWZL.jpg', price: 899, section: "HORMOscope Picks" },
  { asin: 'B0CNC67C8B', name: 'Diamond Tennis Bracelet, 20 Carat Lab Grown, Platinum, 7 Inch', blurb: 'EGL certified lab grown diamonds in an oval line bracelet.', image: null, price: null, section: 'Luxe' },
  { asin: 'B07VTDXFDC', name: 'Aromatherapy Associates Ultimate Wellbeing Bath & Shower Oil Set', blurb: '10 premium oils in a gift box, for dry skin and deep relaxation.', image: null, price: 199.99, section: 'Gift Sets' },
  { asin: 'B0D7N2KWLH', name: 'iRestore LED Face Mask', blurb: 'Red light therapy with 360 LEDs, for wrinkles, fine lines and dark spots.', image: 'https://m.media-amazon.com/images/I/41N6YT4V+xL.jpg', price: 379, section: "HORMOscope Picks" },
  { asin: 'B09Y8SV5RY', name: 'KARMAPLEDGE Chakra Tree of Life', blurb: 'Handmade crystal tree, 300 beads on a wooden base. Home and desk decor.', image: null, price: 32.65, section: 'Decorations & Toys' },
  { asin: 'B0F8J3GJDQ', name: 'Survival Kit Advent Calendar for Men', blurb: 'A 24 day countdown with 24 survival tools. A partner gift pick.', image: null, price: null, section: 'Advent Calendars' },
  { asin: 'B0FY7R1TQ3', name: 'LOVERY Luxury Perfume Advent Calendar for Women', blurb: '24 mini fragrances in a gold gift box.', image: null, price: null, section: 'Advent Calendars' },
  { asin: 'B0FQFMDMDC', name: 'Evvy Vaginal Health Test, 2 Pack', blurb: 'At home vaginal microbiome test with a clinician reviewed report.', image: null, price: null, section: "HORMOscope Picks" },
  { asin: 'B0B75T46L8', name: 'Viome Full Body Intelligence Test', blurb: '3 in 1 kit (blood, saliva, stool) with 50+ health scores, gut microbiome and biological age.', image: null, price: 299, section: "HORMOscope Picks" },
  { asin: 'B0BX78DC84', name: 'Pixie Menstrual Cup & Disc Boiler Sterilizer', blurb: 'Electric boiler sterilizer that cleans cups and discs in 3 minutes, no chemicals.', image: null, price: null, section: "HORMOscope Picks" },
  { asin: 'B0BLSVBMVY', name: 'Pixie Menstrual Disc Kit', blurb: 'Two medical grade silicone discs with wash, wipes, lube and a sterilizing carry cup.', image: null, price: 39.95, section: "HORMOscope Picks" },
  { asin: 'B0DS1MRGBY', name: 'Pixie Disc + Applicator Bundle (2 discs)', blurb: 'Two reusable silicone discs with a tampon style applicator. Holds 5 to 7 tampons worth.', image: 'https://m.media-amazon.com/images/I/41q9jytlCRL.jpg', price: 39.95, section: "HORMOscope Picks" },
  { asin: 'B00LWE69NU', name: 'Flex Reusable Disc', blurb: 'Medical grade silicone disc, holds up to 6 super tampons, reusable for years.', image: null, price: 34.95, section: "HORMOscope Picks" },
  { asin: 'B07YQBWVGF', name: 'Cora Overnight Pads, 72 count', blurb: '100% organic cotton topsheet overnight pads with wings.', image: null, price: null, section: "HORMOscope Picks" },
  { asin: 'B06XKP5Z1X', name: 'Cora Organic Tampons, 36 Super', blurb: '100% organic cotton tampons, super absorbency, with a compact applicator.', image: 'https://m.media-amazon.com/images/I/513g9-iXWuL.jpg', price: 15.72, section: "HORMOscope Picks" },
  { asin: 'B07JK78TM7', name: 'Cora Organic Tampons Multipack, 36 count', blurb: 'Organic cotton tampons in light, regular and super, one multipack.', image: 'https://m.media-amazon.com/images/I/51xnyUNlRLL.jpg', price: 18.49, section: "HORMOscope Picks" },
  { asin: 'B0DZ2J1GS1', name: 'Comfytemp Cordless Heating Belt', blurb: 'Dual zone heating belt for belly and back, 3 heat levels with a timer.', image: null, price: null, section: "HORMOscope Picks" },
  { asin: 'B09PTGQ4CK', name: 'Menstruation Crustacean Lobster Heating Plush', blurb: 'Lavender scented lobster plush with a microwavable heating pouch for cramp days.', image: 'https://m.media-amazon.com/images/I/415wJ3X6BsL.jpg', price: 22.96, section: 'Decorations & Toys' },
  { asin: 'B0CFPRZHYM', name: 'OQQ 3 Piece Bodysuits', blurb: 'Ribbed strappy tummy control bodysuits, a 3 piece set.', image: null, price: 24.85, section: 'Clothing' },
  { asin: 'B005F1ATJQ', name: 'Ancient Minerals Magnesium Bath Flakes', blurb: 'Pure magnesium chloride bath flakes for a relaxing soak, 1.65 lb bag.', image: 'https://m.media-amazon.com/images/I/81iSrDwN9zL.jpg', price: 13, section: "HORMOscope Picks" },
  // Her late-night picks, Oct 26, 2026, identified by research Oct 27.
  { asin: 'B098TV9THH', name: 'Arabella Bouquets, 25 Pink Roses, Fresh Flowers for Delivery', blurb: '25 fresh pink roses, delivered to her door.', image: null, price: null, section: 'Flowers' },
  { asin: 'B000LQJKI6', name: 'GuyLian Belgian Chocolate Seashells, 8.82 oz, 22 pc', blurb: 'Belgian chocolate seashells with hazelnut praline filling.', image: null, price: 17.99, section: 'Snacks' },
  { asin: 'B00KWX688S', name: 'Benchmark Bouquets Flowering Fields, With Vase (Fresh Cut Flowers)', blurb: 'A mixed fresh cut bouquet in a glass vase, ready to give.', image: 'https://m.media-amazon.com/images/I/51qWQlCf7DL.jpg', price: 44.95, section: 'Flowers' },
];

export const PRODUCT_BY_ASIN = Object.fromEntries(CATALOG_PRODUCTS.map((p) => [p.asin, p]));
