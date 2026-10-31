// Gift Catalog, her gift catalog (Angelita's picks).
// ONE catalog (Angelita, Oct 26, 2026). Oct 31, 2026 restructure
// (her order): exactly two groups, "Food & Drink" first and
// "Non Food & Drink" second, and inside each group the products
// are ordered by price, cheapest first. Food & Drink is anything
// eaten or drunk, including ingestible supplements; everything
// else is Non Food & Drink. Products whose price is not verified
// yet sit at the end of their group and show no price; the
// Diamond Tennis Bracelet (B0CNC67C8B) is priced at $10,000
// (confirmed by Angelita, Oct 31, 2026) and always sits last.
// Oct 31, 2026 (her order): every product photo is a LOCAL file
// inside the app under /images/catalog/<ASIN>.jpg, so no tile
// ever waits on a remote image host. One product still shows
// the placeholder because no verified photo of it could be
// sourced: the Diamond Tennis Bracelet (B0CNC67C8B). We never invent an image or
// a price. Prices are checked again each catalog update; the
// catalog carries the line "Prices checked October 31, 2026."
// The backend validates wishlist picks against this same ASIN list.
// Picks that are still unidentified (B0FHWWCDJ2, B0H6J6LYLX,
// B09ZFP9XLC; her screenshots pending) are NOT in this list and must
// not be added until she names them.

export const AMAZON_TAG = 'hormoscope20-20';

export const amazonUrl = (asin) => `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;

export const CATALOG_PRICES_LINE = 'Prices checked October 31, 2026. Amazon shows the live price when you tap through.';

// Her two groups, in display order. A group with no products is skipped.
export const CATALOG_SECTIONS = [
  'Food & Drink',
  'Non Food & Drink',
];

export const formatPrice = (price) =>
  typeof price === 'number' ? `$${price.toFixed(2)}` : null;

export const CATALOG_PRODUCTS = [
  { asin: 'B0CX7FDWCC', name: 'Lindt Holiday Teddy Bear Chocolate Advent Calendar, 4.5 oz', blurb: 'A teddy bear advent calendar filled with Lindt chocolate candy.', image: '/images/catalog/B0CX7FDWCC.jpg', price: 13.97, section: 'Food & Drink' },
  { asin: 'B07WT6GP2F', name: 'Lindt Mini Pralines Gift Box, 6.2 oz', blurb: 'Assorted chocolate candy pralines with premium filling, made for gift giving.', image: '/images/catalog/B07WT6GP2F.jpg', price: 14.62, section: 'Food & Drink' },
  { asin: 'B0G1S4KBS6', name: 'Beforeyouspeak Period Coffee, 7 Count', blurb: 'Instant Colombian coffee with iron, goji berry and milk thistle, white peony root, rehmannia and MCT oil. Keto and vegan friendly.', image: '/images/catalog/B0G1S4KBS6.jpg', price: 14.99, section: 'Food & Drink' },
  { asin: 'B000LQJKI6', name: 'GuyLian Belgian Chocolate Seashells, 8.82 oz, 22 pc', blurb: 'Belgian chocolate seashells with hazelnut praline filling.', image: '/images/catalog/B000LQJKI6.jpg', price: 17.99, section: 'Food & Drink' },
  { asin: 'B0CP48QKPS', name: "Sarah's Candy Factory Belgian Chocolate Gift Box", blurb: 'Assorted milk, dark and white Belgian chocolate pralines in an elegant gift box, 4.23 oz.', image: '/images/catalog/B0CP48QKPS.jpg', price: 17.99, section: 'Food & Drink' },
  { asin: 'B0CLT9Y2ZK', name: 'GuyLian Belgian Dark Chocolate Seashells, 20 pc', blurb: 'Dark chocolate praliné seashells in a gift box, 7.94 oz.', image: '/images/catalog/B0CLT9Y2ZK.jpg', price: 18.99, section: 'Food & Drink' },
  { asin: 'B0FDM3GC7M', name: 'Godiva Signature Truffle Gift Box, 8 Piece', blurb: 'Belgian dark and milk chocolate truffles with ganache centers. Kosher.', image: '/images/catalog/B0FDM3GC7M.jpg', price: 22, section: 'Food & Drink' },
  { asin: 'B0CMDJNG4L', name: 'Rael Hormone Balance Inositol Powder, 30 Servings', blurb: 'Inositol powder with a 40:1 myo to D-chiro ratio and folic acid, for ovarian function.', image: '/images/catalog/B0CMDJNG4L.jpg', price: 22.49, section: 'Food & Drink' },
  { asin: 'B0F517J8JR', name: 'NEESHI Hormone Balancing Dark Cacao Spread', blurb: 'Low sugar, vegan, gluten free superfood chocolate spread for bloating relief and menopause support. 7 servings.', image: '/images/catalog/B0F517J8JR.jpg', price: 24, section: 'Food & Drink' },
  { asin: 'B0H7K1RTY1', name: 'Tilz Hot Chocolate Station', blurb: 'Original and white hot chocolate with mini candy canes, marshmallows and chocolate sprinkles, in a Christmas gift hamper.', image: '/images/catalog/B0H7K1RTY1.jpg', price: 24.99, section: 'Food & Drink' },
  { asin: 'B0CNTSVB7Q', name: 'Biteyz Turkish Delight, Vegan Candy Gift Box, 36 Pieces', blurb: 'Assorted gourmet fruit flavors: lemon, apple, orange, pomegranate and raspberry. Handmade vegan treats.', image: '/images/catalog/B0CNTSVB7Q.jpg', price: 25.99, section: 'Food & Drink' },
  { asin: 'B002D2JYYG', name: 'Integrative Therapeutics Cortisol Manager, 30 Tablets', blurb: 'Stress support tablets for balanced cortisol, 30 count.', image: '/images/catalog/B002D2JYYG.jpg', price: 26.75, section: 'Food & Drink' },
  { asin: 'B0FJ2V6K2G', name: 'Pukka Organic Tea Advent Calendar 2025', blurb: '24 organic black and green tea infusions in a Christmas countdown for tea lovers.', image: '/images/catalog/B0FJ2V6K2G.jpg', price: 28.18, section: 'Food & Drink' },
  { asin: 'B0D5FZGY8W', name: 'O Positiv URO Vaginal Probiotics for Women, 60 Count', blurb: 'Prebiotics and Lactobacillus for healthy vaginal pH balance, odor, and flora. 1 month supply.', image: '/images/catalog/B0D5FZGY8W.jpg', price: 28.97, section: 'Food & Drink' },
  { asin: 'B0GM36TY3S', name: 'MAÏA Ceremonial Cacao, High Flavanol, 30 Servings', blurb: 'Super cacao with theobromine; supports healthy blood pressure and cardiovascular wellness.', image: '/images/catalog/B0GM36TY3S.jpg', price: 32.95, section: 'Food & Drink' },
  { asin: 'B07GY22VLW', name: 'Live Conscious Collagen Peptides Powder', blurb: 'Hydrolyzed Type I and III collagen from grass fed, pasture raised sources. 16 oz, 41 servings.', image: '/images/catalog/B07GY22VLW.jpg', price: 34, section: 'Food & Drink' },
  { asin: 'B081ZG4898', name: 'Ethel M Taste of Las Vegas Collection, 16-Piece Gift Box', blurb: 'Caramels, nut clusters and satin crèmes in milk and dark chocolate, small batch handcrafted.', image: '/images/catalog/B081ZG4898.jpg', price: 45, section: 'Food & Drink' },
  { asin: 'B0HBXM4173', name: 'GODIVA Limited Edition Luxury Chocolate Advent Calendar 2026, 24 pc', blurb: '24 doors of milk, dark and white chocolate in a gift ready holiday countdown.', image: '/images/catalog/B0HBXM4173.jpg', price: 46.4, section: 'Food & Drink' },
  { asin: 'B0HF6S81XH', name: 'Anomaly Daily Immunity Mix, 28 Servings', blurb: 'Daily immunity powder with grass-fed colostrum, prebiotics and probiotics. Unflavored.', image: '/images/catalog/B0HF6S81XH.jpg', price: 49.99, section: 'Food & Drink' },
  { asin: 'B0G616FHRW', name: 'LAKRIDS BY BÜLOW Love Selection Box', blurb: 'Heart shaped gift box of chocolate covered gourmet black licorice, a premium Danish candy gift.', image: '/images/catalog/B0G616FHRW.jpg', price: 49.99, section: 'Food & Drink' },
  { asin: 'B0HDQK47F9', name: 'LAKRIDS BY BÜLOW Advent Calendar, Chocolate-Covered Licorice', blurb: 'A Christmas countdown of Danish chocolate covered licorice, 12.17 oz.', image: '/images/catalog/B0HDQK47F9.jpg', price: 69.99, section: 'Food & Drink' },
  { asin: 'B0FHBXCCLM', name: 'Dona Tea Library', blurb: '18 premium blended teas, 36 sachets in an elegant case.', image: '/images/catalog/B0FHBXCCLM.jpg', price: 79, section: 'Food & Drink' },
  { asin: 'B0DY9Z9FTZ', name: 'Rael Roll-On Cream for Feminine Care, 1.7 oz', blurb: 'Camphor and menthol roll on with ginger and turmeric; fast absorbing with a cooling sensation for period care.', image: '/images/catalog/B0DY9Z9FTZ.jpg', price: 9.79, section: 'Non Food & Drink' },
  { asin: 'B0CGQ3YW9M', name: 'Pixie Menstrual Disc Applicator', blurb: 'Inserts a period disc like a tampon, self sanitizing TPE. Made for long nails; disc not included.', image: '/images/catalog/B0CGQ3YW9M.jpg', price: 9.95, section: 'Non Food & Drink' },
  { asin: 'B0DBLLK8YG', name: 'Rislobx Bling Car Vent Clip Fresheners, 4 Pcs, Gold', blurb: 'Crystal diamond vent clip diffusers in high heel, bag, crown and perfume bottle designs.', image: '/images/catalog/B0DBLLK8YG.jpg', price: 11.54, section: 'Non Food & Drink' },
  { asin: 'B005F1ATJQ', name: 'Ancient Minerals Magnesium Bath Flakes', blurb: 'Pure magnesium chloride bath flakes for a relaxing soak, 1.65 lb bag.', image: '/images/catalog/B005F1ATJQ.jpg', price: 13, section: 'Non Food & Drink' },
  { asin: 'B0GGNN6PK4', name: 'Atsidexa 4-in-1 Beaded Charging Cable, Pure Pearl', blurb: 'MFi certified 60W fast charger cord, 3.3 ft, beaded pearl finish.', image: '/images/catalog/B0GGNN6PK4.jpg', price: 13.99, section: 'Non Food & Drink' },
  { asin: 'B018E6TE1C', name: 'Veeda 100% Natural Cotton Tampons, Super, 48 Count', blurb: '100% natural cotton, unscented and free from chlorine and toxins, with a BPA free compact applicator.', image: '/images/catalog/B018E6TE1C.jpg', price: 14.95, section: 'Non Food & Drink' },
  { asin: 'B07QTFTCV2', name: 'PAVOI Crystal Solitaire CZ Choker Necklace', blurb: '14K gold plated dainty choker with a 1.5 carat cubic zirconia solitaire pendant.', image: '/images/catalog/B07QTFTCV2.jpg', price: 14.95, section: 'Non Food & Drink' },
  { asin: 'B0FD771S38', name: 'Vevmon Cotton Underwear, High Waisted, 5 Pack', blurb: 'Soft high waisted full coverage cotton briefs, 5 pack in 5 colors. Medium.', image: '/images/catalog/B0FD771S38.jpg', price: 14.99, section: 'Non Food & Drink' },
  { asin: 'B0DGVVB8HW', name: 'EcoBlossom Menstrual Cup & Disc Applicator, Purple', blurb: 'Applicator and remover tool that fits most menstrual cups and discs. Easy insertion and removal, reusable and portable.', image: '/images/catalog/B0DGVVB8HW.jpg', price: 14.99, section: 'Non Food & Drink' },
  { asin: 'B01N0RSCBI', name: 'Chesapeake Bay Balance + Harmony Candle, Water Lily Pear', blurb: 'Soy wax blend scented candle with a 50 hour burn time, warm and decorative.', image: '/images/catalog/B01N0RSCBI.jpg', price: 14.99, section: 'Non Food & Drink' },
  { asin: 'B06XKP5Z1X', name: 'Cora Organic Tampons, 36 Super', blurb: '100% organic cotton tampons, super absorbency, with a compact applicator.', image: '/images/catalog/B06XKP5Z1X.jpg', price: 15.72, section: 'Non Food & Drink' },
  { asin: 'B09S2Y1G7B', name: 'Rael Herbal Heating Patches, Large, 8 Count', blurb: 'Herbal heating patches for period cramps, 8 count.', image: '/images/catalog/B09S2Y1G7B.jpg', price: 15.99, section: 'Non Food & Drink' },
  { asin: 'B0GXC53GZ8', name: 'AIFUFAND Cyperus Rotundus Oil', blurb: 'Plant based hair removal oil with a rose quartz roll on, 60 mL.', image: '/images/catalog/B0GXC53GZ8.jpg', price: 15.99, section: 'Non Food & Drink' },
  { asin: 'B07TT5RQ2P', name: 'Benatu Essential Oil Blends Roll On Set, 3 Bottles', blurb: 'Breathe, Focus On and Happiness natural aromatherapy roll ons for massage, body skin care and home.', image: '/images/catalog/B07TT5RQ2P.jpg', price: 16.58, section: 'Non Food & Drink' },
  { asin: 'B09HT62WR4', name: 'HDCRYSTALGIFTS Crystal Suncatchers, Wind Chime Style', blurb: 'Handmade crystal suncatcher rainbow maker for windows and garden, gold plated.', image: '/images/catalog/B09HT62WR4.jpg', price: 16.99, section: 'Non Food & Drink' },
  { asin: 'B0D8HQHXK1', name: 'CULACEE Obsidian Crystal Energy Candle, HEAL', blurb: 'Soy and coconut wax candle with obsidian and Baltic amber; an encouragement and affirmation gift.', image: '/images/catalog/B0D8HQHXK1.jpg', price: 16.99, section: 'Non Food & Drink' },
  { asin: 'B07KY49QSD', name: 'Naisture 15 Min Pamper Me Kit', blurb: 'Korean spa skincare gift set with hair, face, eye, hand and foot masks, 7 pieces.', image: '/images/catalog/B07KY49QSD.jpg', price: 16.99, section: 'Non Food & Drink' },
  { asin: 'B0DVQ8W9SH', name: 'Ammoya Naturals Turmeric & Kojic Acid Soap 2 Bars', blurb: 'Turmeric and kojic acid cleansing soap for face and body, 2 bars.', image: '/images/catalog/B0DVQ8W9SH.jpg', price: 17.99, section: 'Non Food & Drink' },
  { asin: 'B07JK78TM7', name: 'Cora Organic Tampons Multipack, 36 count', blurb: 'Organic cotton tampons in light, regular and super, one multipack.', image: '/images/catalog/B07JK78TM7.jpg', price: 18.49, section: 'Non Food & Drink' },
  { asin: 'B083C6BYG9', name: 'Rael Slim Applicator Tampons, Organic Cotton, 40 Count', blurb: 'Organic cotton core with a slim, BPA free applicator.', image: '/images/catalog/B083C6BYG9.jpg', price: 18.99, section: 'Non Food & Drink' },
  { asin: 'B0GT1LQD2Q', name: 'Gentle Patches Cortisol Support Patches, 30 Pack', blurb: 'Pure ashwagandha transdermal patches for natural stress relief and calm mood.', image: '/images/catalog/B0GT1LQD2Q.jpg', price: 19.5, section: 'Non Food & Drink' },
  { asin: 'B0C1YG33PD', name: 'BouZaFoFa Portable Heating Pad for Cramps', blurb: 'Cordless heating belt with 6 heat levels and 6 massage modes.', image: '/images/catalog/B0C1YG33PD.jpg', price: 19.99, section: 'Non Food & Drink' },
  { asin: 'B0D1H31PRY', name: 'Genesis Wild Yam Roll On Oil for Women, Organic', blurb: 'Organic wild yam roll on with chaste tree and red clover. Vegan friendly, unscented, made in USA.', image: '/images/catalog/B0D1H31PRY.jpg', price: 19.99, section: 'Non Food & Drink' },
  { asin: 'B0DYJMQKLJ', name: 'Lifnatty Tulip Night Light in Glass Dome', blurb: 'Light up pink tulips in a glass dome; a bedside lamp and cute home decor gift.', image: '/images/catalog/B0DYJMQKLJ.jpg', price: 19.99, section: 'Non Food & Drink' },
  { asin: 'B0CRDH79BK', name: 'Kvitko Period Underwear, 3 Layers Breathable', blurb: 'Breathable 3 layer menstrual period panties.', image: '/images/catalog/B0CRDH79BK.jpg', price: 19.99, section: 'Non Food & Drink' },
  { asin: 'B08T7DSZYD', name: 'e.l.f. SKIN Holy Hydration Skincare Mini Kit', blurb: 'Travel size hydrating skincare minis with makeup remover, cleanser, moisturizer and eye cream.', image: '/images/catalog/B08T7DSZYD.jpg', price: 20, section: 'Non Food & Drink' },
  { asin: 'B09JKDWS6H', name: "Molasus Women's Cotton Underwear, High Waisted", blurb: 'High waisted full coverage cotton panties, regular and plus size.', image: '/images/catalog/B09JKDWS6H.jpg', price: 20.53, section: 'Non Food & Drink' },
  { asin: 'B07T9N5T79', name: 'PAVOI 14K Gold Plated CZ Tennis Bracelet', blurb: '14K gold plated tennis bracelet with cubic zirconia stones.', image: '/images/catalog/B07T9N5T79.jpg', price: 20.95, section: 'Non Food & Drink' },
  { asin: 'B0H4NM3DC1', name: 'WoodWick Cherry Blossom & Vanilla Candle', blurb: 'Crackling wick soy candle, 9.7 oz, up to 60 hour burn time.', image: '/images/catalog/B0H4NM3DC1.jpg', price: 20.99, section: 'Non Food & Drink' },
  { asin: 'B0FR24YSSM', name: 'PretiHom Automatic Rotating Curling Iron, 1.1 in Barrel', blurb: 'Auto rotating curling wand for long hair; heats to 410 degrees F, ceramic barrel, dual voltage.', image: '/images/catalog/B0FR24YSSM.jpg', price: 21.99, section: 'Non Food & Drink' },
  { asin: 'B09PTGQ4CK', name: 'Menstruation Crustacean Lobster Heating Plush', blurb: 'Lavender scented lobster plush with a microwavable heating pouch for cramp days.', image: '/images/catalog/B09PTGQ4CK.jpg', price: 22.96, section: 'Non Food & Drink' },
  { asin: 'B0GD6R7CFJ', name: 'BIODANCE Hydrogel Eye Patches, Collagen Peptide, 60 Count', blurb: 'Hydrogel under eye patches with collagen peptide for wrinkles and fine lines.', image: '/images/catalog/B0GD6R7CFJ.jpg', price: 23, section: 'Non Food & Drink' },
  { asin: 'B0DCLVWKVT', name: 'Genesis Wild Yam Cream for Women, Organic', blurb: 'Organic wild yam cream for women.', image: '/images/catalog/B0DCLVWKVT.jpg', price: 23.97, section: 'Non Food & Drink' },
  { asin: 'B08ZJJ3BVV', name: 'Sea Turtle Lava Bead Car Mirror Charm', blurb: 'Handmade beach diffuser charm with lava beads, for the rear view mirror.', image: '/images/catalog/B08ZJJ3BVV.jpg', price: 23.99, section: 'Non Food & Drink' },
  { asin: 'B0DNZF4ZL4', name: 'Mewaii Strawberry Cow Plush', blurb: 'Microwavable weighted plush for cramps, heatable and coolable, 10 inch.', image: '/images/catalog/B0DNZF4ZL4.jpg', price: 23.99, section: 'Non Food & Drink' },
  { asin: 'B0BLT5XT9R', name: 'New Miuz Moon Milk Bath Soak', blurb: 'Cleansing sage milk bath soak with lavender and chamomile, for a relaxing soak.', image: '/images/catalog/B0BLT5XT9R.jpg', price: 23.99, section: 'Non Food & Drink' },
  { asin: 'B0CFPRZHYM', name: 'OQQ 3 Piece Bodysuits', blurb: 'Ribbed strappy tummy control bodysuits, a 3 piece set.', image: '/images/catalog/B0CFPRZHYM.jpg', price: 24.85, section: 'Non Food & Drink' },
  { asin: 'B087258KHP', name: 'Balm of Gilead Manuka Eczema Honey Cream', blurb: 'Manuka honey moisturizer with grass fed tallow for sensitive skin, eczema, psoriasis and dermatitis.', image: '/images/catalog/B087258KHP.jpg', price: 24.99, section: 'Non Food & Drink' },
  { asin: 'B0BNJRJP6M', name: 'Balm of Gilead Foot Healing Cream, Frankincense & Sweet Myrrh', blurb: 'Deeply nourishing foot moisturizer for sensitive and diabetic skin.', image: '/images/catalog/B0BNJRJP6M.jpg', price: 24.99, section: 'Non Food & Drink' },
  { asin: 'B0FTGKQZT6', name: 'Eva Naturals Peptide Serum + Derma Roller Kit, 2 oz', blurb: 'Collagen peptide serum with a 0.25mm titanium derma roller microneedling kit, for face and scalp.', image: '/images/catalog/B0FTGKQZT6.jpg', price: 25.99, section: 'Non Food & Drink' },
  { asin: 'B0CPD78HL2', name: 'L. Cotton Tampons Regular/Super Multipack, 84 Count', blurb: 'Organic cotton core multipack, regular and super absorbency, made without synthetic pesticides or fragrances.', image: '/images/catalog/B0CPD78HL2.jpg', price: 26.99, section: 'Non Food & Drink' },
  { asin: 'B0G5Q443HD', name: 'LXTMMRLJQ Cat Stained Glass Suncatcher', blurb: 'Hanging stained glass window suncatcher, black cat.', image: '/images/catalog/B0G5Q443HD.jpg', price: 26.99, section: 'Non Food & Drink' },
  { asin: 'B0H714TLPH', name: 'Sakura Cat Plush USB Heating Pad', blurb: 'A 22 inch pink cat heated plush with a USB controller, for period cramps.', image: '/images/catalog/B0H714TLPH.jpg', price: 26.99, section: 'Non Food & Drink' },
  { asin: 'B0F2J966QL', name: 'Eight Saints Firm Intentions Anti Aging Neck Cream, 2 oz', blurb: 'Natural and organic neck cream for firming skin and reducing wrinkles.', image: '/images/catalog/B0F2J966QL.jpg', price: 27.2, section: 'Non Food & Drink' },
  { asin: 'B0B836FZFB', name: 'Rael Disposable Period Underwear, Organic Cotton Cover, L-XL, 20 Count', blurb: 'Disposable period underwear with an organic cotton cover, size L-XL, 20 count.', image: '/images/catalog/B0B836FZFB.jpg', price: 27.99, section: 'Non Food & Drink' },
  { asin: 'B0GK2PMLW1', name: 'Blooskim GHK-Cu Tallow Honey Balm', blurb: 'Grass fed beef tallow blue balm with Manuka honey and vitamin E, 4 oz.', image: '/images/catalog/B0GK2PMLW1.jpg', price: 27.99, section: 'Non Food & Drink' },
  { asin: 'B07YNL9VWM', name: 'Joellyne Naturals Wild Yam & Dong Quai Cream, 3.4 oz', blurb: 'Wild yam and dong quai cream, 3000 mg.', image: '/images/catalog/B07YNL9VWM.jpg', price: 28.01, section: 'Non Food & Drink' },
  { asin: 'B0FK5CJXRX', name: 'vilicert Heating Pad for Period Cramps, 12 x 24 in', blurb: 'Wrap heating pad with a 26 inch belt, 6 heat levels, 4 timers and auto shut off, for cramps and back pain.', image: '/images/catalog/B0FK5CJXRX.jpg', price: 28.47, section: 'Non Food & Drink' },
  { asin: 'B0BZRJM2BG', name: 'Balm of Gilead Neuropathy Rubbing Oil, Frankincense & Sweet Myrrh, 2 fl oz', blurb: 'Therapeutic rubbing oil for dry skin relief and repair.', image: '/images/catalog/B0BZRJM2BG.jpg', price: 28.99, section: 'Non Food & Drink' },
  { asin: 'B0CVG37WJH', name: 'Basic Vigor Migraine Stick Super Bundle, 3 Pack', blurb: 'Original, Extra Strength and Magnesium migraine sticks in one bundle.', image: '/images/catalog/B0CVG37WJH.jpg', price: 29.87, section: 'Non Food & Drink' },
  { asin: 'B0GX7X6ZKL', name: 'CHOOSE-US Neck Massager with Heat, Cordless', blurb: '4D bionic kneading massager for neck, shoulders, back, calves and legs, 3 intensities.', image: '/images/catalog/B0GX7X6ZKL.jpg', price: 29.99, section: 'Non Food & Drink' },
  { asin: 'B0F1K99T6R', name: 'FOLKOR LIFE Rose Quartz Crystal Tree', blurb: 'Gemstone money tree with a built in night lamp, heart hands base.', image: '/images/catalog/B0F1K99T6R.jpg', price: 29.99, section: 'Non Food & Drink' },
  { asin: 'B0HHN2N9DL', name: 'Quibark Epsom Bath Salts Gift Set', blurb: 'Six scented bath soaks, 120 g each, with a wooden scoop, in a gift box.', image: '/images/catalog/B0HHN2N9DL.jpg', price: 29.99, section: 'Non Food & Drink' },
  { asin: 'B07YMKC6NF', name: 'Stargazer Barn 15 Stem Rainbow Tulips Bouquet', blurb: 'Fresh cut rainbow tulips, hand tied, 15 stems. Vase not included.', image: '/images/catalog/B07YMKC6NF.jpg', price: 29.99, section: 'Non Food & Drink' },
  { asin: 'B07H15GPZG', name: 'Stargazer Barn 10 Stem Sunflower Bouquet', blurb: 'Fresh cut sunflowers, hand tied, 10 stems. Vase not included.', image: '/images/catalog/B07H15GPZG.jpg', price: 30.04, section: 'Non Food & Drink' },
  { asin: 'B07GZXM7X7', name: 'Stargazer Barn 15 Stem Pink Tulips Bouquet', blurb: 'Fresh cut pink tulips, hand tied, 15 stems. Vase not included.', image: '/images/catalog/B07GZXM7X7.jpg', price: 30.06, section: 'Non Food & Drink' },
  { asin: 'B0D7MRCJRL', name: 'Touchat Faux Rabbit Fur Throw Blanket, Cream White, 50 x 60', blurb: 'Soft fluffy plush striped throw; thick winter luxury for couch, bed and sofa.', image: '/images/catalog/B0D7MRCJRL.jpg', price: 30.99, section: 'Non Food & Drink' },
  { asin: 'B09Y8SV5RY', name: 'KARMAPLEDGE Chakra Tree of Life', blurb: 'Handmade crystal tree, 300 beads on a wooden base. Home and desk decor.', image: '/images/catalog/B09Y8SV5RY.jpg', price: 32.65, section: 'Non Food & Drink' },
  { asin: 'B0H1GBWV98', name: 'Pixie Organic Cotton Gusset Period Underwear, Black', blurb: 'Leakproof panties with BloatFit technology and an organic cotton gusset. Ultra soft.', image: '/images/catalog/B0H1GBWV98.jpg', price: 32.95, section: 'Non Food & Drink' },
  { asin: 'B0GYCTJZ65', name: 'Drawelry Rose Flower Tree Lamp', blurb: 'LED rose bonsai night light, USB or battery powered, red.', image: '/images/catalog/B0GYCTJZ65.jpg', price: 32.95, section: 'Non Food & Drink' },
  { asin: 'B0DPWYG9Y8', name: 'ECO PERIOD Seamless Period Panties, Heavy Flow', blurb: 'Leakproof seamless menstrual underwear with overnight protection; also postpartum and incontinence friendly.', image: '/images/catalog/B0DPWYG9Y8.jpg', price: 32.99, section: 'Non Food & Drink' },
  { asin: 'B0DB9K83N3', name: 'Theraworx Relief for Muscle Cramps Foam, 7.1 oz, 2 Count', blurb: 'Fast acting foam with magnesium sulfate for muscle cramps, spasms and leg soreness.', image: '/images/catalog/B0DB9K83N3.jpg', price: 33.98, section: 'Non Food & Drink' },
  { asin: 'B0GQ2BT3WG', name: 'Flex Plant Plus Disc, 24 Count', blurb: 'Plant based disposable period discs, capacity of 5 super tampons.', image: '/images/catalog/B0GQ2BT3WG.jpg', price: 33.99, section: 'Non Food & Drink' },
  { asin: 'B0FG1QTBGL', name: 'Flygo Girls Fuzzy Pants Set, Fleece', blurb: 'Winter flannel fluffy pullover sweatshirt top and pants sweatsuit set.', image: '/images/catalog/B0FG1QTBGL.jpg', price: 34.27, section: 'Non Food & Drink' },
  { asin: 'B0DHWFWSVF', name: 'Olay Super Cream with Sunscreen SPF 30, 1.7 oz', blurb: '5-in-1 face moisturizer with niacinamide, vitamin C and collagen peptide: hydrating, brightening, firming.', image: '/images/catalog/B0DHWFWSVF.jpg', price: 34.94, section: 'Non Food & Drink' },
  { asin: 'B00LWE69NU', name: 'Flex Reusable Disc', blurb: 'Medical grade silicone disc, holds up to 6 super tampons, reusable for years.', image: '/images/catalog/B00LWE69NU.jpg', price: 34.95, section: 'Non Food & Drink' },
  { asin: 'B08L7NSWCX', name: 'Pixie Organic Cotton Cloth Reusable Pads, Overnight, 3 Count', blurb: 'Organic cotton reusable overnight pads, 3 count.', image: '/images/catalog/B08L7NSWCX.jpg', price: 34.95, section: 'Non Food & Drink' },
  { asin: 'B0DJYXR31R', name: 'Mama Bear Oasis Magnesium Cream, Lavender', blurb: 'Magnesium lotion with arnica, vitamin B6, aloe vera and MSM, for feet, hands and legs.', image: '/images/catalog/B0DJYXR31R.jpg', price: 34.99, section: 'Non Food & Drink' },
  { asin: 'B07NF7XG17', name: 'ART BLAZE Carved Candle, Purple', blurb: 'Handmade decorative tall spiral candle for home decor.', image: '/images/catalog/B07NF7XG17.jpg', price: 35.97, section: 'Non Food & Drink' },
  { asin: 'B081FHFN4C', name: 'Oscar Candles Swan Candle', blurb: 'Hand carved multicolor swan candle, handmade home decor.', image: '/images/catalog/B081FHFN4C.jpg', price: 36.95, section: 'Non Food & Drink' },
  { asin: 'B0D7P58742', name: 'Anthonic Teddy Bear with Preserved Rose', blurb: 'A red teddy bear holding a preserved rose, with an elegant gift box.', image: '/images/catalog/B0D7P58742.jpg', price: 36.99, section: 'Non Food & Drink' },
  { asin: 'B0BLSVBMVY', name: 'Pixie Menstrual Disc Kit', blurb: 'Two medical grade silicone discs with wash, wipes, lube and a sterilizing carry cup.', image: '/images/catalog/B0BLSVBMVY.jpg', price: 39.95, section: 'Non Food & Drink' },
  { asin: 'B0DS1MRGBY', name: 'Pixie Disc + Applicator Bundle (2 discs)', blurb: 'Two reusable silicone discs with a tampon style applicator. Holds 5 to 7 tampons worth.', image: '/images/catalog/B0DS1MRGBY.jpg', price: 39.95, section: 'Non Food & Drink' },
  { asin: 'B0HHJB27VJ', name: 'blunique Faux Fur Throw Blanket', blurb: 'Ultra soft fuzzy bubble blanket, 50 x 60 inches, dark brown leopard.', image: '/images/catalog/B0HHJB27VJ.jpg', price: 39.99, section: 'Non Food & Drink' },
  { asin: 'B0CJLXNGX6', name: 'GLAMOUR BOUTIQUE 16 Forever Purple Roses in Heart Box', blurb: '16 preserved purple roses in a black heart shaped box with a ribbon.', image: '/images/catalog/B0CJLXNGX6.jpg', price: 41.36, section: 'Non Food & Drink' },
  { asin: 'B0DNM83ZK7', name: 'Benchmark Bouquets Tulips with Glass Vase', blurb: 'Fresh fall tulips in red and orange, arranged in a glass vase.', image: '/images/catalog/B0DNM83ZK7.jpg', price: 44.92, section: 'Non Food & Drink' },
  { asin: 'B00KWX688S', name: 'Benchmark Bouquets Flowering Fields, With Vase (Fresh Cut Flowers)', blurb: 'A mixed fresh cut bouquet in a glass vase, ready to give.', image: '/images/catalog/B00KWX688S.jpg', price: 44.95, section: 'Non Food & Drink' },
  { asin: 'B0C9LCM3HW', name: 'FLEX Reusable Menstrual Disc Starter Bundle', blurb: 'Silicone reusable disc with foaming wash and biodegradable wipes.', image: '/images/catalog/B0C9LCM3HW.jpg', price: 49.97, section: 'Non Food & Drink' },
  { asin: 'B0DX852TG1', name: 'FLOWER TODAY USA 24 Roses Bouquet', blurb: 'Fresh cut long stem roses and lilies, glass vase included.', image: '/images/catalog/B0DX852TG1.jpg', price: 49.99, section: 'Non Food & Drink' },
  { asin: 'B0H9471ZVK', name: 'ZSP Electric Gua Sha & Red Light Face Massager', blurb: 'Heated facial massager with 3 heat and vibration settings, pink.', image: '/images/catalog/B0H9471ZVK.jpg', price: 49.99, section: 'Non Food & Drink' },
  { asin: 'B0G4S8JJRS', name: 'Estée Lauder Favorites Gift Set, 3 Piece', blurb: 'Amazon exclusive set: full size Advanced Night Repair serum, Sumptuous Extreme mascara and Beautiful Magnolia fragrance.', image: '/images/catalog/B0G4S8JJRS.jpg', price: 62.69, section: 'Non Food & Drink' },
  { asin: 'B0BG5KDYMC', name: 'NATROSES 27 Preserved Roses in a Box', blurb: '27 preserved roses in a round black gift box, ready to give.', image: '/images/catalog/B0BG5KDYMC.jpg', price: 62.72, section: 'Non Food & Drink' },
  { asin: 'B06W5PD1KY', name: 'Pure Daily Care NuDerma Skin Therapy Wand', blurb: 'Handheld neon skin therapy wand for anti-aging, skin tightening, dark circles and scalp stimulation.', image: '/images/catalog/B06W5PD1KY.jpg', price: 79.95, section: 'Non Food & Drink' },
  { asin: 'B0CC5R3S9V', name: 'Mikasol Gold Dipped Real 24K Gold Rose', blurb: 'A real rose hand dipped in 24K gold, an infinity flower decor gift. 1 pack.', image: '/images/catalog/B0CC5R3S9V.jpg', price: 100.37, section: 'Non Food & Drink' },
  { asin: 'B0H5KMGWR6', name: 'The Body Shop Advent Calendar Gift Set, Set of 24', blurb: '24 days of shower and body creams and gels, hand balms and more.', image: '/images/catalog/B0H5KMGWR6.jpg', price: 111, section: 'Non Food & Drink' },
  { asin: 'B07VTDXFDC', name: 'Aromatherapy Associates Ultimate Wellbeing Bath & Shower Oil Set', blurb: '10 premium oils in a gift box, for dry skin and deep relaxation.', image: '/images/catalog/B07VTDXFDC.jpg', price: 199.99, section: 'Non Food & Drink' },
  { asin: 'B0B75T46L8', name: 'Viome Full Body Intelligence Test', blurb: '3 in 1 kit (blood, saliva, stool) with 50+ health scores, gut microbiome and biological age.', image: '/images/catalog/B0B75T46L8.jpg', price: 299, section: 'Non Food & Drink' },
  { asin: 'B0FGB2NS3C', name: 'Philips Lumea 9000 Series IPL Hair Removal Device', blurb: 'SenseIQ IPL with 4 attachments for body, face, bikini and underarms.', image: '/images/catalog/B0FGB2NS3C.jpg', price: 579.95, section: 'Non Food & Drink' },
  { asin: 'B07M5X4D3P', name: 'iRESTORE Professional Laser Hair Growth System', blurb: 'Red light therapy cap with 282 lasers and LEDs.', image: '/images/catalog/B07M5X4D3P.jpg', price: 899, section: 'Non Food & Drink' },
  { asin: 'B0F8J3GJDQ', name: 'Survival Kit Advent Calendar for Men', blurb: 'A 24 day countdown with 24 survival tools. A partner gift pick.', image: '/images/catalog/B0F8J3GJDQ.jpg', price: null, section: 'Non Food & Drink' },
  { asin: 'B0FY7R1TQ3', name: 'LOVERY Luxury Perfume Advent Calendar for Women', blurb: '24 mini fragrances in a gold gift box.', image: '/images/catalog/B0FY7R1TQ3.jpg', price: null, section: 'Non Food & Drink' },
  { asin: 'B0FQFMDMDC', name: 'Evvy Vaginal Health Test, 2 Pack', blurb: 'At home vaginal microbiome test with a clinician reviewed report.', image: '/images/catalog/B0FQFMDMDC.jpg', price: null, section: 'Non Food & Drink' },
  { asin: 'B0BX78DC84', name: 'Pixie Menstrual Cup & Disc Boiler Sterilizer', blurb: 'Electric boiler sterilizer that cleans cups and discs in 3 minutes, no chemicals.', image: '/images/catalog/B0BX78DC84.jpg', price: null, section: 'Non Food & Drink' },
  { asin: 'B07YQBWVGF', name: 'Cora Overnight Pads, 72 count', blurb: '100% organic cotton topsheet overnight pads with wings.', image: '/images/catalog/B07YQBWVGF.jpg', price: null, section: 'Non Food & Drink' },
  { asin: 'B0DZ2J1GS1', name: 'Comfytemp Cordless Heating Belt', blurb: 'Dual zone heating belt for belly and back, 3 heat levels with a timer.', image: '/images/catalog/B0DZ2J1GS1.jpg', price: null, section: 'Non Food & Drink' },
  { asin: 'B098TV9THH', name: 'Arabella Bouquets, 25 Pink Roses, Fresh Flowers for Delivery', blurb: '25 fresh pink roses, delivered to her door.', image: '/images/catalog/B098TV9THH.jpg', price: null, section: 'Non Food & Drink' },
  { asin: 'B0CNC67C8B', name: 'Diamond Tennis Bracelet, 20 Carat Lab Grown, Platinum, 7 Inch', blurb: 'EGL certified lab grown diamonds in an oval line bracelet.', image: null, price: 10000, section: 'Non Food & Drink' },
];

export const PRODUCT_BY_ASIN = Object.fromEntries(CATALOG_PRODUCTS.map((p) => [p.asin, p]));
