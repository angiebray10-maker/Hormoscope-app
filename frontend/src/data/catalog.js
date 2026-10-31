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
  // Added Oct 30, 2026 (v56) as an unnamed placeholder tile;
  // identified by Angelita from her Amazon app on Oct 31, 2026:
  // Anomaly Daily Immunity Mix, $49.99. Real name, price and
  // picture filled in Oct 31, 2026.
  { asin: 'B0HF6S81XH', name: 'Anomaly Daily Immunity Mix, 28 Servings', blurb: 'Daily immunity powder with grass-fed colostrum, prebiotics and probiotics. Unflavored.', image: 'https://tryanomalyhealth.com/cdn/shop/files/1.Hero_UnflavoredAdult_c5253503-4af9-4674-acca-c3657d16a01f.webp?v=1781545171&width=1000', price: 49.99, section: 'HORMOscope Picks' },
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
  { asin: 'B0FDM3GC7M', name: 'Godiva Signature Truffle Gift Box, 8 Piece', blurb: 'Belgian dark and milk chocolate truffles with ganache centers. Kosher.', image: 'https://m.media-amazon.com/images/I/71RWc6tWanL._SX569_.jpg', price: 22.0, section: 'Gift Sets' },  // Added Oct 31, 2026 (v57 data completion, held for
  // her push word): the rest of her Oct 30 to 31 batch
  // whose name, price AND picture are all verified
  // (identification pass Catalog-Identification-Oct31.md
  // plus her own Amazon app screenshots). Batch picks
  // still missing a verified picture stay out rather
  // than ship with a borrowed or guessed image.
  { asin: 'B002D2JYYG', name: 'Integrative Therapeutics Cortisol Manager, 30 Tablets', blurb: 'Stress support tablets for balanced cortisol, 30 count.', image: 'https://cloudinary.images-iherb.com/image/upload/f_auto,q_auto:eco/images/itt/itt00381/v/8.jpg', price: 26.75, section: "HORMOscope Picks" },
  { asin: 'B0DGVVB8HW', name: 'EcoBlossom Menstrual Cup & Disc Applicator, Purple', blurb: 'Applicator and remover tool that fits most menstrual cups and discs. Easy insertion and removal, reusable and portable.', image: 'https://m.media-amazon.com/images/I/71KMzQlwi9L._AC_SX569_.jpg', price: 14.99, section: "HORMOscope Picks" },
  { asin: 'B0GT1LQD2Q', name: 'Gentle Patches Cortisol Support Patches, 30 Pack', blurb: 'Pure ashwagandha transdermal patches for natural stress relief and calm mood.', image: 'https://gentlepatches.com/cdn/shop/files/GentlePatches-Dopamine-50.jpg?v=1760017728', price: 19.5, section: "HORMOscope Picks" },
  { asin: 'B0CVG37WJH', name: 'Basic Vigor Migraine Stick Super Bundle, 3 Pack', blurb: 'Original, Extra Strength and Magnesium migraine sticks in one bundle.', image: 'https://migrastil.com/cdn/shop/files/3MigraineStickBundle.jpg?v=1761851439&width=1200', price: 29.87, section: "HORMOscope Picks" },
  { asin: 'B0D1H31PRY', name: 'Genesis Wild Yam Roll On Oil for Women, Organic', blurb: 'Organic wild yam roll on with chaste tree and red clover. Vegan friendly, unscented, made in USA.', image: 'https://genesisholistichealth.net/cdn/shop/files/Frame_2147223831_9.jpg?v=1744398409&width=750', price: 19.99, section: "HORMOscope Picks" },
  { asin: 'B0DY9Z9FTZ', name: 'Rael Roll-On Cream for Feminine Care, 1.7 oz', blurb: 'Camphor and menthol roll on with ginger and turmeric; fast absorbing with a cooling sensation for period care.', image: 'https://www.getrael.com/cdn/shop/files/SITE_GetRael_Cramp-Roll-On_Main-Image_1.png?v=1774890854', price: 9.79, section: "HORMOscope Picks" },
  { asin: 'B0FTGKQZT6', name: 'Eva Naturals Peptide Serum + Derma Roller Kit, 2 oz', blurb: 'Collagen peptide serum with a 0.25mm titanium derma roller microneedling kit, for face and scalp.', image: 'https://cdn.shopify.com/s/files/1/0677/2405/0712/files/71wsjggjB-L._SL1500_300x300.jpg?v=1779150316', price: 25.99, section: "HORMOscope Picks" },
  { asin: 'B0GX7X6ZKL', name: 'CHOOSE-US Neck Massager with Heat, Cordless', blurb: '4D bionic kneading massager for neck, shoulders, back, calves and legs, 3 intensities.', image: 'https://chooseus-shop.com/__l5e/assets-v1/a34f0252-3f79-4ee0-8122-f9d30f5337c3/product-hero.webp', price: 29.99, section: "HORMOscope Picks" },
  { asin: 'B0FR24YSSM', name: 'PretiHom Automatic Rotating Curling Iron, 1.1 in Barrel', blurb: 'Auto rotating curling wand for long hair; heats to 410 degrees F, ceramic barrel, dual voltage.', image: 'https://m.media-amazon.com/images/I/31TAG5h0PyL._SL500_.jpg', price: 21.99, section: "HORMOscope Picks" },
  { asin: 'B06W5PD1KY', name: 'Pure Daily Care NuDerma Skin Therapy Wand', blurb: 'Handheld neon skin therapy wand for anti-aging, skin tightening, dark circles and scalp stimulation.', image: 'https://m.media-amazon.com/images/I/41DoH3XBrjL._AC_CX679_.jpg', price: 79.95, section: "HORMOscope Picks" },
  { asin: 'B07YNL9VWM', name: 'Joellyne Naturals Wild Yam & Dong Quai Cream, 3.4 oz', blurb: 'Wild yam and dong quai cream, 3000 mg.', image: 'https://m.media-amazon.com/images/I/71KXFdoo7xL._AC_SX569_.jpg', price: 28.01, section: "HORMOscope Picks" },
  { asin: 'B0CMDJNG4L', name: 'Rael Hormone Balance Inositol Powder, 30 Servings', blurb: 'Inositol powder with a 40:1 myo to D-chiro ratio and folic acid, for ovarian function.', image: 'https://cdn1.tilga.com/md/prod/2/925/57424166.27348.jpg', price: 22.49, section: "HORMOscope Picks" },
  { asin: 'B0F517J8JR', name: 'NEESHI Hormone Balancing Dark Cacao Spread', blurb: 'Low sugar, vegan, gluten free superfood chocolate spread for bloating relief and menopause support. 7 servings.', image: 'https://neeshi.com/cdn/shop/files/The_Spoonful_of_Daily_Calm_Neeshi_Dark_Cacao_Spread.png?v=1787674984&width=130', price: 24, section: "HORMOscope Picks" },
  { asin: 'B0DHWFWSVF', name: 'Olay Super Cream with Sunscreen SPF 30, 1.7 oz', blurb: '5-in-1 face moisturizer with niacinamide, vitamin C and collagen peptide: hydrating, brightening, firming.', image: 'https://m.media-amazon.com/images/I/71RR9Gj9iEL._SL1500_.jpg', price: 34.94, section: "HORMOscope Picks" },
  { asin: 'B0GD6R7CFJ', name: 'BIODANCE Hydrogel Eye Patches, Collagen Peptide, 60 Count', blurb: 'Hydrogel under eye patches with collagen peptide for wrinkles and fine lines.', image: 'https://koreanskincarepicks.com/wp-content/uploads/2026/09/99.jpg.jpeg', price: 23, section: "HORMOscope Picks" },
  { asin: 'B0DYJMQKLJ', name: 'Lifnatty Tulip Night Light in Glass Dome', blurb: 'Light up pink tulips in a glass dome; a bedside lamp and cute home decor gift.', image: 'https://i.justbid-media.com/uNON2J0YtF1HnDH5I636kfEIT97p0D1fw3uFMHYeSng/rs:fit:1080:1080/quality:75/plain/s3://goldrush-app-media-production/item_images/4225925/06ede8b7-6271-48d1-a281-7f36aa7fd0d4.jpg', price: 19.99, section: 'Flowers' },
  { asin: 'B0CC5R3S9V', name: 'Mikasol Gold Dipped Real 24K Gold Rose', blurb: 'A real rose hand dipped in 24K gold, an infinity flower decor gift. 1 pack.', image: 'https://m.media-amazon.com/images/I/41BlY16XKTL._SL500_.jpg', price: 100.37, section: 'Flowers' },
  { asin: 'B0DPWYG9Y8', name: 'ECO PERIOD Seamless Period Panties, Heavy Flow', blurb: 'Leakproof seamless menstrual underwear with overnight protection; also postpartum and incontinence friendly.', image: 'https://m.media-amazon.com/images/I/711ow1lFEWL.jpg', price: 32.99, section: 'Clothing' },
  { asin: 'B0CRDH79BK', name: 'Kvitko Period Underwear, 3 Layers Breathable', blurb: 'Breathable 3 layer menstrual period panties.', image: 'https://image-cdn.ubuy.com/500_500_100/6ab7ce96cfbb8a06e70afee6-period-underwear-for-women-3-layers.jpg', price: 19.99, section: 'Clothing' },
  { asin: 'B0H1GBWV98', name: 'Pixie Organic Cotton Gusset Period Underwear, Black', blurb: 'Leakproof panties with BloatFit technology and an organic cotton gusset. Ultra soft.', image: 'https://cdn.shopify.com/s/files/1/0530/6692/4190/files/seamless-underwear.jpg', price: 32.95, section: 'Clothing' },
  { asin: 'B0FG1QTBGL', name: 'Flygo Girls Fuzzy Pants Set, Fleece', blurb: 'Winter flannel fluffy pullover sweatshirt top and pants sweatsuit set.', image: 'https://m.media-amazon.com/images/I/81ZQWGezEFL._AC_SX569_.jpg', price: 34.27, section: 'Clothing' },
  { asin: 'B01N0RSCBI', name: 'Chesapeake Bay Balance + Harmony Candle, Water Lily Pear', blurb: 'Soy wax blend scented candle with a 50 hour burn time, warm and decorative.', image: 'https://m.media-amazon.com/images/I/31tH8haFOpL._SL500_.jpg', price: 14.99, section: 'Candles & Smelly Stuff' },
  { asin: 'B0D8HQHXK1', name: 'CULACEE Obsidian Crystal Energy Candle, HEAL', blurb: 'Soy and coconut wax candle with obsidian and Baltic amber; an encouragement and affirmation gift.', image: 'https://m.media-amazon.com/images/I/41TzRka9a4L._SL500_.jpg', price: 16.99, section: 'Candles & Smelly Stuff' },
  { asin: 'B0CLDN4BRM', name: 'SWCANDY Shower Steamers Aromatherapy, 8 Pcs', blurb: 'Aromatherapy shower steamers for a home spa ritual, 8 pieces.', image: 'https://image-cdn.ubuy.com/500_500_100/6abdf616343f27cf5a016963-swcandy-shower-steamers-aromatherapy.jpg', price: 9.99, section: 'Candles & Smelly Stuff' },
  { asin: 'B07TT5RQ2P', name: 'Benatu Essential Oil Blends Roll On Set, 3 Bottles', blurb: 'Breathe, Focus On and Happiness natural aromatherapy roll ons for massage, body skin care and home.', image: 'https://m.media-amazon.com/images/I/71QqKIY-jVL._AC_SL1500_.jpg', price: 16.58, section: 'Candles & Smelly Stuff' },
  { asin: 'B0D7MRCJRL', name: 'Touchat Faux Rabbit Fur Throw Blanket, Cream White, 50 x 60', blurb: 'Soft fluffy plush striped throw; thick winter luxury for couch, bed and sofa.', image: 'https://m.media-amazon.com/images/I/81xPqU+MDmL._AC_SX569_.jpg', price: 30.99, section: 'Decorations & Toys' },
  { asin: 'B0DBLLK8YG', name: 'Rislobx Bling Car Vent Clip Fresheners, 4 Pcs, Gold', blurb: 'Crystal diamond vent clip diffusers in high heel, bag, crown and perfume bottle designs.', image: 'https://cdn1.tilga.com/md/prod/3/4767/137999243.6148.jpg', price: 11.54, section: 'Decorations & Toys' },
  { asin: 'B08ZJJ3BVV', name: 'Sea Turtle Lava Bead Car Mirror Charm', blurb: 'Handmade beach diffuser charm with lava beads, for the rear view mirror.', image: 'https://m.media-amazon.com/images/I/61L2gKGyKgL._AC_SL128_.jpg', price: 23.99, section: 'Decorations & Toys' },
  { asin: 'B0HDQK47F9', name: 'LAKRIDS BY BÜLOW Advent Calendar, Chocolate-Covered Licorice', blurb: 'A Christmas countdown of Danish chocolate covered licorice, 12.17 oz.', image: 'https://media.zenobuilder.com/upload/cezbjtktbc/2025-winter-adventcalendar-94882626.png', price: 69.99, section: 'Advent Calendars' },
  { asin: 'B0CX7FDWCC', name: 'Lindt Holiday Teddy Bear Chocolate Advent Calendar, 4.5 oz', blurb: 'A teddy bear advent calendar filled with Lindt chocolate candy.', image: 'https://m.media-amazon.com/images/I/51EwtMMddZL.jpg', price: 13.97, section: 'Advent Calendars' },
  { asin: 'B0FJ2V6K2G', name: 'Pukka Organic Tea Advent Calendar 2025', blurb: '24 organic black and green tea infusions in a Christmas countdown for tea lovers.', image: 'https://image-cdn.ubuy.com/500_500_100/6abf011b6b5b3c33420de4b9-pukka-christmas-tea-sampler-selection.jpg', price: 28.18, section: 'Advent Calendars' },
  { asin: 'B0HBXM4173', name: 'GODIVA Limited Edition Luxury Chocolate Advent Calendar 2026, 24 pc', blurb: '24 doors of milk, dark and white chocolate in a gift ready holiday countdown.', image: 'https://www.godiva.com/cdn/shop/files/HOL26_24pc_City_AdventCalendar_16355_03_1000px_with_Copy.jpg?v=1787258170&width=800', price: 46.4, section: 'Advent Calendars' },
  { asin: 'B0H5KMGWR6', name: 'The Body Shop Advent Calendar Gift Set, Set of 24', blurb: '24 days of shower and body creams and gels, hand balms and more.', image: 'https://m.media-amazon.com/images/I/81s2MS8KpmL._AC_SX679_.jpg', price: 111, section: 'Advent Calendars' },
  { asin: 'B0G616FHRW', name: 'LAKRIDS BY BÜLOW Love Selection Box', blurb: 'Heart shaped gift box of chocolate covered gourmet black licorice, a premium Danish candy gift.', image: 'https://cdn11.bigcommerce.com/s-tnw7k0ssup/images/stencil/1280w/products/227/949/PR1328BI963_501365_clone_SELECTION_BOX_LOVE_2026_COLOR_SZ7__94387.1783323174.png?c=1', price: 49.99, section: 'Gift Sets' },
  { asin: 'B081ZG4898', name: 'Ethel M Taste of Las Vegas Collection, 16-Piece Gift Box', blurb: 'Caramels, nut clusters and satin crèmes in milk and dark chocolate, small batch handcrafted.', image: 'https://cdn.media.amplience.net/i/marsethelm/collection-taste-of-las-vegas-tin_img_01_170288?%24i%24=&w=1152&fmt=auto&qlt=default', price: 45, section: 'Gift Sets' },
  { asin: 'B0CLT9Y2ZK', name: 'GuyLian Belgian Dark Chocolate Seashells, 20 pc', blurb: 'Dark chocolate praliné seashells in a gift box, 7.94 oz.', image: 'https://m.media-amazon.com/images/I/91TIHEkctuL._SX342_.jpg', price: 18.99, section: 'Gift Sets' },
  { asin: 'B07WT6GP2F', name: 'Lindt Mini Pralines Gift Box, 6.2 oz', blurb: 'Assorted chocolate candy pralines with premium filling, made for gift giving.', image: 'https://www.candystore.com/cdn/shop/products/lindt-mini-pralines-chocolates-1q23-wmark.jpg?v=1677494783&width=196', price: 14.62, section: 'Gift Sets' },
  { asin: 'B0G4S8JJRS', name: 'Estée Lauder Favorites Gift Set, 3 Piece', blurb: 'Amazon exclusive set: full size Advanced Night Repair serum, Sumptuous Extreme mascara and Beautiful Magnolia fragrance.', image: 'https://5thave-img-cdn.santasmartnetwork.com/pf/dc83aeba-f736-3206-b87f-f97bfd6adae2.jpg?x-oss-process=image/resize,w_1080/quality,q_75/format,webp', price: 62.69, section: 'Gift Sets' },
  { asin: 'B0GM36TY3S', name: 'MAÏA Ceremonial Cacao, High Flavanol, 30 Servings', blurb: 'Super cacao with theobromine; supports healthy blood pressure and cardiovascular wellness.', image: 'https://cdn.shopify.com/s/files/1/0643/8279/5984/files/front_2_0c4b595f-fb55-4059-946d-d22e5e5e7536.webp?v=1732722195', price: 32.95, section: 'Snacks' },
  { asin: 'B0G1S4KBS6', name: 'Beforeyouspeak Period Coffee, 7 Count', blurb: 'Instant Colombian coffee with iron, goji berry and milk thistle, white peony root, rehmannia and MCT oil. Keto and vegan friendly.', image: 'https://cdn.shopify.com/s/files/1/0589/3292/0484/products/beforeyouspeack-period-coffee-1_700x700_crop_center.jpg.webp?v=1659409617', price: 14.99, section: 'Snacks' },
];

export const PRODUCT_BY_ASIN = Object.fromEntries(CATALOG_PRODUCTS.map((p) => [p.asin, p]));
