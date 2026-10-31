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
// catalog carries the line "Prices checked October 31, 2026."
// The backend validates wishlist picks against this same ASIN list.
// Picks that are still unidentified (B0FHWWCDJ2, B0H6J6LYLX,
// B09ZFP9XLC; her screenshots pending) are NOT in this list and must
// not be added until she names them.

export const AMAZON_TAG = 'hormoscope20-20';

export const amazonUrl = (asin) => `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;

export const CATALOG_PRICES_LINE = 'Prices checked October 31, 2026. Amazon shows the live price when you tap through.';

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
  // Added Oct 30, 2026 (v56): three picks she sent that day.
  // B0HF6S81XH could not be identified from outside Amazon (her
  // share link only); it goes in with the placeholder tile and no
  // price until she names it from her Amazon app.
  { asin: 'B0HF6S81XH', name: "Angelita's Pick", blurb: '', image: null, price: null, section: 'HORMOscope Picks' },
  { asin: 'B07GY22VLW', name: 'Live Conscious Collagen Peptides Powder', blurb: 'Hydrolyzed Type I and III collagen from grass fed, pasture raised sources. 16 oz, 41 servings.', image: 'https://m.media-amazon.com/images/I/719PP+XVu1L._AC_SL128_.jpg', price: 34.00, section: 'HORMOscope Picks' },
  { asin: 'B0D5FZGY8W', name: 'O Positiv URO Vaginal Probiotics for Women, 60 Count', blurb: 'Prebiotics and Lactobacillus for healthy vaginal pH balance, odor, and flora. 1 month supply.', image: 'https://m.media-amazon.com/images/I/41Bj7UNMcZL.jpg', price: 28.97, section: 'HORMOscope Picks' },
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
  // Added Oct 31, 2026 (prepared for the next build, held
  // at her word, not pushed): the fully identified products
  // from her Oct 30 to 31 batch (identification pass
  // Catalog-Identification-Oct31.md). Partial and
  // unidentified picks stay out until verified. Caveats:
  // the Godiva price is godiva.com's US price for the same
  // box (Amazon showed no featured offer for the ASIN), and
  // the Rael period underwear picture is its A+ banner shot.
  { asin: 'B0CPD78HL2', name: 'L. Cotton Tampons Regular/Super Multipack, 84 Count', blurb: 'Organic cotton core multipack, regular and super absorbency, made without synthetic pesticides or fragrances.', image: 'https://m.media-amazon.com/images/I/41BHbONOpRL.jpg', price: 26.99, section: 'HORMOscope Picks' },
  { asin: 'B018E6TE1C', name: 'Veeda 100% Natural Cotton Tampons, Super, 48 Count', blurb: '100% natural cotton, unscented and free from chlorine and toxins, with a BPA free compact applicator.', image: 'https://m.media-amazon.com/images/I/41oeZzmpZOL.jpg', price: 14.95, section: 'HORMOscope Picks' },
  { asin: 'B081CKP4SN', name: 'wegreeco Charcoal Reusable Menstrual Pads, 6 Pack', blurb: 'Reusable charcoal cloth pads and panty liners with a cloth mini wet bag. Medium, black.', image: 'https://image-cdn.ubuy.com/500_500_100/6aa5e9e3674e5e6a4c0b284c-wegreeco-charcoal-reusable-menstrual.jpg', price: 13.99, section: 'HORMOscope Picks' },
  { asin: 'B08L7NSWCX', name: 'Pixie Organic Cotton Cloth Reusable Pads, Overnight, 3 Count', blurb: 'Organic cotton reusable overnight pads, 3 count.', image: 'https://m.media-amazon.com/images/I/41S5vwTfRfL.jpg', price: 34.95, section: 'HORMOscope Picks' },
  { asin: 'B0CGQ3YW9M', name: 'Pixie Menstrual Disc Applicator', blurb: 'Inserts a period disc like a tampon, self sanitizing TPE. Made for long nails; disc not included.', image: 'https://m.media-amazon.com/images/I/71wsCQ8rqFL.jpg', price: 9.95, section: 'HORMOscope Picks' },
  { asin: 'B0F2J966QL', name: 'Eight Saints Firm Intentions Anti Aging Neck Cream, 2 oz', blurb: 'Natural and organic neck cream for firming skin and reducing wrinkles.', image: 'https://m.media-amazon.com/images/I/31dBLwcpiDL._AC_CX679_.jpg', price: 27.2, section: 'HORMOscope Picks' },
  { asin: 'B0DB9K83N3', name: 'Theraworx Relief for Muscle Cramps Foam, 7.1 oz, 2 Count', blurb: 'Fast acting foam with magnesium sulfate for muscle cramps, spasms and leg soreness.', image: 'https://m.media-amazon.com/images/I/71I8l-xNSGL._AC_SL128_.jpg', price: 33.98, section: 'HORMOscope Picks' },
  { asin: 'B0F1QHNFJP', name: 'Magnum Solace Nighttime Magnesium Lotion with Arnica', blurb: 'Highly concentrated magnesium lotion for muscles and joints; apply to legs or feet before bed.', image: 'https://m.media-amazon.com/images/I/71odD-7TWBL._SY355_.jpg', price: 14.99, section: 'HORMOscope Picks' },
  { asin: 'B0DJYXR31R', name: 'Mama Bear Oasis Magnesium Cream, Lavender', blurb: 'Magnesium lotion with arnica, vitamin B6, aloe vera and MSM, for feet, hands and legs.', image: 'https://m.media-amazon.com/images/I/61cJLs8LyvL.jpg', price: 34.99, section: 'HORMOscope Picks' },
  { asin: 'B0BZRJM2BG', name: 'Balm of Gilead Neuropathy Rubbing Oil, Frankincense & Sweet Myrrh, 2 fl oz', blurb: 'Therapeutic rubbing oil for dry skin relief and repair.', image: 'https://m.media-amazon.com/images/I/81DCdkhfJgL._AC_SL128_.jpg', price: 28.99, section: 'HORMOscope Picks' },
  { asin: 'B087258KHP', name: 'Balm of Gilead Manuka Eczema Honey Cream', blurb: 'Manuka honey moisturizer with grass fed tallow for sensitive skin, eczema, psoriasis and dermatitis.', image: 'https://m.media-amazon.com/images/I/81U6eeEd+DL.jpg', price: 24.99, section: 'HORMOscope Picks' },
  { asin: 'B0BNJRJP6M', name: 'Balm of Gilead Foot Healing Cream, Frankincense & Sweet Myrrh', blurb: 'Deeply nourishing foot moisturizer for sensitive and diabetic skin.', image: 'https://m.media-amazon.com/images/I/81tl2sBvnFL.jpg', price: 24.99, section: 'HORMOscope Picks' },
  { asin: 'B0FK5CJXRX', name: 'vilicert Heating Pad for Period Cramps, 12 x 24 in', blurb: 'Wrap heating pad with a 26 inch belt, 6 heat levels, 4 timers and auto shut off, for cramps and back pain.', image: 'https://m.media-amazon.com/images/I/412I3WyKOiL.jpg', price: 28.47, section: 'HORMOscope Picks' },
  { asin: 'B0DCLVWKVT', name: 'Genesis Wild Yam Cream for Women, Organic', blurb: 'Organic wild yam cream for women.', image: 'https://m.media-amazon.com/images/I/41FC417otZL.jpg', price: 23.97, section: 'HORMOscope Picks' },
  { asin: 'B09S2Y1G7B', name: 'Rael Herbal Heating Patches, Large, 8 Count', blurb: 'Herbal heating patches for period cramps, 8 count.', image: 'https://m.media-amazon.com/images/I/41VRs4zqCGL.jpg', price: 15.99, section: 'HORMOscope Picks' },
  { asin: 'B0FD771S38', name: 'Vevmon Cotton Underwear, High Waisted, 5 Pack', blurb: 'Soft high waisted full coverage cotton briefs, 5 pack in 5 colors. Medium.', image: 'https://static.slickdealscdn.com/attachment/6/2/0/0/0/9/450x450/20732811.thumb', price: 14.99, section: 'Clothing' },
  { asin: 'B09JKDWS6H', name: 'Molasus Women\'s Cotton Underwear, High Waisted', blurb: 'High waisted full coverage cotton panties, regular and plus size.', image: 'https://m.media-amazon.com/images/I/61JMK2+2WvL._AC_SX569_.jpg', price: 20.53, section: 'Clothing' },
  { asin: 'B0B836FZFB', name: 'Rael Disposable Period Underwear, Organic Cotton Cover, L-XL, 20 Count', blurb: 'Disposable period underwear with an organic cotton cover, size L-XL, 20 count.', image: 'https://m.media-amazon.com/images/S/aplus-media-library-service-media/ad11ae50-cbb9-42f1-99ba-9b68cdbcec0e.__CR0,0,1464,600_PT0_SX1464_V1___.jpg', price: 27.99, section: 'Clothing' },
  { asin: 'B0DT5M5DHD', name: 'C Classy Hanging Car Air Freshener, 2 Pack', blurb: 'Hotel inspired essential oil diffuser fresheners for the car, long lasting fragrance. Made in USA.', image: 'https://images.price.tools/images/c-classy-car-air-freshener-hanging-m-prCwcZpK2.jpg', price: 11.99, section: 'Candles & Smelly Stuff' },
  { asin: 'B09HT62WR4', name: 'HDCRYSTALGIFTS Crystal Suncatchers, Wind Chime Style', blurb: 'Handmade crystal suncatcher rainbow maker for windows and garden, gold plated.', image: 'https://m.media-amazon.com/images/I/516Kb1PPJML.jpg', price: 16.99, section: 'Decorations & Toys' },
  { asin: 'B0CNTSVB7Q', name: 'Biteyz Turkish Delight, Vegan Candy Gift Box, 36 Pieces', blurb: 'Assorted gourmet fruit flavors: lemon, apple, orange, pomegranate and raspberry. Handmade vegan treats.', image: 'https://m.media-amazon.com/images/I/71hdxt1ciDL._SX569_.jpg', price: 25.99, section: 'Gift Sets' },
  { asin: 'B0FDM3GC7M', name: 'Godiva Signature Truffle Gift Box, 8 Piece', blurb: 'Belgian dark and milk chocolate truffles with ganache centers. Kosher.', image: 'https://m.media-amazon.com/images/I/71RWc6tWanL._SX569_.jpg', price: 22.0, section: 'Gift Sets' },
];

export const PRODUCT_BY_ASIN = Object.fromEntries(CATALOG_PRODUCTS.map((p) => [p.asin, p]));
