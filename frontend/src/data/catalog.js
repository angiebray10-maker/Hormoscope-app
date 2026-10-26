// The Gift Edit, her gift catalog (Angelita's picks).
// ONE single flat list (Angelita, Oct 26, 2026): no collections, no
// phase baskets. A partner looking at her wishlist just sees the list.
// The original 16 picks keep their order; the Oct 26, 2026 additions
// follow in the order she sent them.
// Every link carries her Amazon Associates tag. NO PRICES live here or
// anywhere in the app by her rule and Amazon's: prices are checked on
// Amazon itself. NO product images either; we never hotlink Amazon's.
// The backend validates wishlist picks against this same ASIN list.
// Picks that are still unidentified (her screenshots pending) are NOT
// in this list and must not be added until she names them.

export const AMAZON_TAG = 'hormoscope20-20';

export const amazonUrl = (asin) => `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;

export const CATALOG_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

export const CATALOG_PRODUCTS = [
  { asin: 'B0FHBXCCLM', name: 'Dona Tea Library', blurb: '18 premium blended teas, 36 sachets in an elegant case.' },
  { asin: 'B0C1YG33PD', name: 'BouZaFoFa Portable Heating Pad for Cramps', blurb: 'Cordless heating belt with 6 heat levels and 6 massage modes.' },
  { asin: 'B0C9LCM3HW', name: 'FLEX Reusable Menstrual Disc Starter Bundle', blurb: 'Silicone reusable disc with foaming wash and biodegradable wipes.' },
  { asin: 'B07NLSLP9K', name: 'Always Radiant Pads, Size 5 Extra Heavy Overnight, 54 Count', blurb: 'FlexFoam pads with wings for extra heavy overnight protection.' },
  { asin: 'B093LVS21D', name: 'Tampax Pearl Tampons, Regular, 50 Count x 2', blurb: 'LeakGuard Braid, unscented. 100 tampons total.' },
  { asin: 'B083C6BYG9', name: 'Rael Slim Applicator Tampons, Organic Cotton, 40 Count', blurb: 'Organic cotton core with a slim, BPA free applicator.' },
  { asin: 'B0FGB2NS3C', name: 'Philips Lumea 9000 Series IPL Hair Removal Device', blurb: 'SenseIQ IPL with 4 attachments for body, face, bikini and underarms.' },
  { asin: 'B07M5X4D3P', name: 'iRESTORE Professional Laser Hair Growth System', blurb: 'Red light therapy cap with 282 lasers and LEDs.' },
  { asin: 'B0CNC67C8B', name: 'Diamond Tennis Bracelet, 20 Carat Lab Grown, Platinum, 7 Inch', blurb: 'EGL certified lab grown diamonds in an oval line bracelet.' },
  { asin: 'B07VTDXFDC', name: 'Aromatherapy Associates Ultimate Wellbeing Bath & Shower Oil Set', blurb: '10 premium oils in a gift box, for dry skin and deep relaxation.' },
  { asin: 'B0D7N2KWLH', name: 'iRestore LED Face Mask', blurb: 'Red light therapy with 360 LEDs, for wrinkles, fine lines and dark spots.' },
  { asin: 'B09Y8SV5RY', name: 'KARMAPLEDGE Chakra Tree of Life', blurb: 'Handmade crystal tree, 300 beads on a wooden base. Home and desk decor.' },
  { asin: 'B0F8J3GJDQ', name: 'Survival Kit Advent Calendar for Men', blurb: 'A 24 day countdown with 24 survival tools. A partner gift pick.' },
  { asin: 'B0FY7R1TQ3', name: 'LOVERY Luxury Perfume Advent Calendar for Women', blurb: '24 mini fragrances in a gold gift box.' },
  { asin: 'B0FQFMDMDC', name: 'Evvy Vaginal Health Test, 2 Pack', blurb: 'At home vaginal microbiome test with a clinician reviewed report.' },
  { asin: 'B0B75T46L8', name: 'Viome Full Body Intelligence Test', blurb: '3 in 1 kit (blood, saliva, stool) with 50+ health scores, gut microbiome and biological age.' },
  { asin: 'B0BX78DC84', name: 'Pixie Menstrual Cup & Disc Boiler Sterilizer', blurb: 'Electric boiler sterilizer that cleans cups and discs in 3 minutes, no chemicals.' },
  { asin: 'B0BLSVBMVY', name: 'Pixie Menstrual Disc Kit', blurb: 'Two medical grade silicone discs with wash, wipes, lube and a sterilizing carry cup.' },
  { asin: 'B0DS1MRGBY', name: 'Pixie Disc + Applicator Bundle (2 discs)', blurb: 'Two reusable silicone discs with a tampon style applicator. Holds 5 to 7 tampons worth.' },
  { asin: 'B00LWE69NU', name: 'Flex Reusable Disc', blurb: 'Medical grade silicone disc, holds up to 6 super tampons, reusable for years.' },
  { asin: 'B07YQBWVGF', name: 'Cora Overnight Pads, 72 count', blurb: '100% organic cotton topsheet overnight pads with wings.' },
  { asin: 'B06XKP5Z1X', name: 'Cora Organic Tampons, 36 Super', blurb: '100% organic cotton tampons, super absorbency, with a compact applicator.' },
  { asin: 'B07JK78TM7', name: 'Cora Organic Tampons Multipack, 36 count', blurb: 'Organic cotton tampons in light, regular and super, one multipack.' },
  { asin: 'B0DZ2J1GS1', name: 'Comfytemp Cordless Heating Belt', blurb: 'Dual zone heating belt for belly and back, 3 heat levels with a timer.' },
  { asin: 'B09PTGQ4CK', name: 'Menstruation Crustacean Lobster Heating Plush', blurb: 'Lavender scented lobster plush with a microwavable heating pouch for cramp days.' },
  { asin: 'B0CFPRZHYM', name: 'OQQ 3 Piece Bodysuits', blurb: 'Ribbed strappy tummy control bodysuits, a 3 piece set.' },
  { asin: 'B005F1ATJQ', name: 'Ancient Minerals Magnesium Bath Flakes', blurb: 'Pure magnesium chloride bath flakes for a relaxing soak, 1.65 lb bag.' },
];

export const PRODUCT_BY_ASIN = Object.fromEntries(CATALOG_PRODUCTS.map((p) => [p.asin, p]));
