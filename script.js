// ============================================================
// APARTMENT RANKER — script.js
// Personal-use tool. No backend required for v1.
// API keys may be embedded here for local-only use.
// ============================================================


// ============================================================
// SECTION 1 — API CONFIGURATION
//
// To connect a real API:
//   1. Set useMockData: false
//   2. Fill in the key + baseUrl for your chosen provider
//   3. Implement fetchLiveApartments() below
//
// CORS NOTE: Most rental APIs (RentCast, RapidAPI listings, etc.)
// block direct browser requests. If you hit a CORS error, spin up
// a tiny local proxy and route through it:
//
//   Option A — quick one-liner:
//     npx cors-anywhere          (listens on localhost:8080)
//     baseUrl: 'http://localhost:8080/https://api.rentcast.io/v1'
//
//   Option B — Express middleware stub:
//     app.get('/api/listings', (req, res) => {
//       // forward to real API, return JSON
//     });
//
// Providers worth exploring:
//   - RentCast      https://rentcast.io/api        (free tier, good data)
//   - RapidAPI      https://rapidapi.com/          (aggregates many listing APIs)
//   - Walk Score    https://www.walkscore.com/api/  (for locationScore)
// ============================================================

const API_CONFIG = {
  useMockData: true, // ← flip to false once a proxy is ready

  // rentcast: {
  //   key:     'YOUR_RENTCAST_API_KEY',
  //   baseUrl: 'https://api.rentcast.io/v1',
  //   // NOTE: CORS-blocked from browser — route through a local proxy (see above)
  // },

  googleMaps: {
    // Get a key at https://console.cloud.google.com
    // Enable: Maps JavaScript API + Geocoding API (same key for both)
    key: 'AIzaSyCmDmrlwKaVuh0POfPn8ESf28RtW6BrIFE',
  },
};


// ============================================================
// SECTION 2 — AMENITY SCORING TABLE
//
// Each amenity key must match what's used in apartment data.
// Adjust point values to match your own priorities.
// The sum is capped at 100 in scoreAmenities().
// ============================================================

const AMENITY_POINTS = {
  'In-unit Laundry': 20,
  'Parking':         18,
  'A/C':             15,
  'Gym':             12,
  'Pet Friendly':    12,
  'Pool':            10,
  'Dishwasher':       9,
  'Balcony':          9,
  'Rooftop':          8,
  'EV Charging':      7,
  'Doorman':          6,
  'Elevator':         5,
  'Storage':          4,
  'Bike Storage':     4,
};

// Any amenity string not found in the table gets this default score.
const AMENITY_UNKNOWN_POINTS = 3;


// ============================================================
// SECTION 3 — MOCK / SAMPLE DATA
//
// This is the canonical apartment schema. All data — whether
// from the mock set or a live API — must be normalized into
// this shape before reaching the scoring engine.
//
// Schema fields:
//   id            string   — unique identifier
//   name          string   — building or unit label
//   address       string   — street address
//   neighborhood  string   — area / district name
//   price         number   — monthly rent in USD
//   size          number   — square footage
//   beds          number   — bedroom count (0 = studio)
//   baths         number   — bathroom count (0.5 increments ok)
//   locationScore number   — 0–100 (walkability, transit, desirability)
//   lat           number?  — preset latitude (skips geocoding API call)
//   lng           number?  — preset longitude (skips geocoding API call)
//   amenities     string[] — amenity names matching AMENITY_POINTS keys
//   url           string   — listing URL (or '#' for mocks)
//   source        string   — 'mock' | 'rentcast' | 'user' | etc.
// ============================================================

const MOCK_APARTMENTS = [
  {
    id:            'mock-1',
    name:          'The Parkview',
    address:       '1023 NW 23rd Ave, Portland, OR',
    neighborhood:  'Pearl District',
    price:         1850,
    size:          780,
    beds:          1,
    baths:         1,
    locationScore: 88,
    lat:           45.5267, lng: -122.6937, // Pearl District
    amenities:     ['In-unit Laundry', 'Gym', 'Parking', 'Pet Friendly', 'Dishwasher'],
    url:           '#',
    source:        'mock',
  },
  {
    id:            'mock-2',
    name:          'Riverside Lofts',
    address:       '3750 SW Bond Ave, Portland, OR',
    neighborhood:  'South Waterfront',
    price:         2200,
    size:          1050,
    beds:          2,
    baths:         2,
    locationScore: 75,
    lat:           45.5019, lng: -122.6734, // South Waterfront
    amenities:     ['In-unit Laundry', 'Pool', 'Gym', 'Balcony', 'A/C', 'Doorman'],
    url:           '#',
    source:        'mock',
  },
  {
    id:            'mock-3',
    name:          'Studio 9 on Main',
    address:       '815 SW 2nd Ave, Portland, OR',
    neighborhood:  'Downtown',
    price:         1350,
    size:          450,
    beds:          0,
    baths:         1,
    locationScore: 95,
    lat:           45.5218, lng: -122.6742, // Downtown Portland
    amenities:     ['A/C', 'Dishwasher', 'Elevator'],
    url:           '#',
    source:        'mock',
  },
  {
    id:            'mock-4',
    name:          'Maple Gardens',
    address:       '2420 SE Hawthorne Blvd, Portland, OR',
    neighborhood:  'Eastside',
    price:         1600,
    size:          920,
    beds:          2,
    baths:         1,
    locationScore: 62,
    lat:           45.5115, lng: -122.6357, // SE Portland / Hawthorne
    amenities:     ['In-unit Laundry', 'Parking', 'Pet Friendly', 'Storage', 'Balcony'],
    url:           '#',
    source:        'mock',
  },
  {
    id:            'mock-5',
    name:          'City Heights Tower',
    address:       '1200 NE Broadway, Portland, OR',
    neighborhood:  'Midtown',
    price:         2800,
    size:          1200,
    beds:          2,
    baths:         2,
    locationScore: 91,
    lat:           45.5395, lng: -122.6571, // NE Broadway / Lloyd
    amenities:     ['In-unit Laundry', 'Gym', 'Pool', 'Doorman', 'Rooftop', 'A/C', 'EV Charging', 'Parking'],
    url:           '#',
    source:        'mock',
  },
  {
    id:            'mock-6',
    name:          'The Hawthorn',
    address:       '4012 NE Sandy Blvd, Portland, OR',
    neighborhood:  'North Hills',
    price:         1490,
    size:          680,
    beds:          1,
    baths:         1,
    locationScore: 55,
    lat:           45.5438, lng: -122.6189, // NE Sandy / Hollywood
    amenities:     ['Parking', 'Pet Friendly', 'Storage'],
    url:           '#',
    source:        'mock',
  },
  {
    id:            'mock-7',
    name:          'Union Square Flats',
    address:       '520 NW 23rd Ave, Portland, OR',
    neighborhood:  'Uptown',
    price:         2050,
    size:          860,
    beds:          2,
    baths:         1,
    locationScore: 83,
    lat:           45.5296, lng: -122.6929, // NW 23rd / Nob Hill
    amenities:     ['In-unit Laundry', 'A/C', 'Gym', 'Bike Storage', 'Dishwasher', 'Elevator'],
    url:           '#',
    source:        'mock',
  },
];


// ============================================================
// SECTION 4 — DATA NORMALIZATION
//
// When adding a new API, map its raw response shape here.
// The goal: one consistent object format before scoring.
// ============================================================

/**
 * Normalize a raw RentCast listing into the apartment schema.
 * TODO: Flesh this out once the RentCast proxy is set up.
 *
 * @param {Object} raw  Raw API response object
 * @returns {Object}    Normalized apartment
 */
function normalizeRentcastListing(raw) {
  return {
    id:            raw.id || `rc-${Math.random().toString(36).slice(2)}`,
    name:          raw.formattedAddress || raw.addressLine1 || 'Unknown',
    address:       raw.addressLine1 || '',
    neighborhood:  raw.city || '',
    price:         raw.price || 0,
    size:          raw.squareFootage || 0,
    beds:          raw.bedrooms ?? null,
    baths:         raw.bathrooms ?? null,
    locationScore: 50, // TODO: enrich with Walk Score API using raw.latitude / raw.longitude
    lat:           raw.latitude  || null,
    lng:           raw.longitude || null,
    amenities:     [],  // TODO: map raw.features[] strings to AMENITY_POINTS keys
    url:           '#',
    source:        'rentcast',
  };
}


// ============================================================
// SECTION 5 — INDIVIDUAL CATEGORY SCORERS
//
// Each function returns a number 0–100.
// Price and size are scored relative to the full dataset range
// so the spread between apartments is always meaningful.
// ============================================================

/**
 * Price score: lower rent = higher score.
 * Uses linear interpolation across the dataset range.
 *
 * @param {number} price
 * @param {number} minPrice  Cheapest apartment in the set
 * @param {number} maxPrice  Most expensive apartment in the set
 * @returns {number} 0–100
 */
function scorePrice(price, minPrice, maxPrice) {
  if (minPrice === maxPrice) return 100; // only one data point
  return Math.round(((maxPrice - price) / (maxPrice - minPrice)) * 100);
}

/**
 * Size score: larger = higher score.
 * Uses linear interpolation across the dataset range.
 *
 * @param {number} size
 * @param {number} minSize  Smallest apartment in the set
 * @param {number} maxSize  Largest apartment in the set
 * @returns {number} 0–100
 */
function scoreSize(size, minSize, maxSize) {
  if (minSize === maxSize) return 100;
  return Math.round(((size - minSize) / (maxSize - minSize)) * 100);
}

/**
 * Location score: passed through directly (already 0–100).
 * Source: manual entry, Walk Score API, or any 0–100 metric.
 *
 * @param {number} locationScore
 * @returns {number} 0–100
 */
function scoreLocation(locationScore) {
  return Math.round(Math.min(100, Math.max(0, locationScore)));
}

/**
 * Amenity score: sum points from AMENITY_POINTS, cap at 100.
 * Unknown amenity strings earn AMENITY_UNKNOWN_POINTS each.
 *
 * @param {string[]} amenities
 * @returns {number} 0–100
 */
function scoreAmenities(amenities) {
  const total = amenities.reduce(
    (sum, a) => sum + (AMENITY_POINTS[a] ?? AMENITY_UNKNOWN_POINTS),
    0
  );
  return Math.min(100, total);
}


// ============================================================
// SECTION 6 — CORE SCORING ENGINE
//
// computeScores() loops over the apartment list twice:
//   Pass 1: find dataset-wide min/max for relative scoring
//   Pass 2: compute all four category scores + weighted final
//
// Weights are normalized to sum to 1.0, so the final score
// always lands in 0–100 regardless of what the sliders show.
// ============================================================

/**
 * Compute individual category scores and a weighted final score
 * for every apartment in the list.
 *
 * @param {Object[]} apartments  Normalized apartment objects
 * @param {Object}   weights     { price, size, location, amenities } — each 0–100
 * @returns {Object[]} Apartments with .scores and .finalScore added
 */
function computeScores(apartments, weights) {
  // Normalize weights so they always sum to 1.0
  const totalW = weights.price + weights.size + weights.location + weights.amenities;
  const w = totalW === 0
    // If all sliders are at 0, fall back to equal weighting
    ? { price: 0.25, size: 0.25, location: 0.25, amenities: 0.25 }
    : {
        price:     weights.price     / totalW,
        size:      weights.size      / totalW,
        location:  weights.location  / totalW,
        amenities: weights.amenities / totalW,
      };

  // Pass 1: dataset-wide min/max for relative scoring
  const prices = apartments.map(a => a.price);
  const sizes  = apartments.map(a => a.size);
  const minPrice = Math.min(...prices), maxPrice = Math.max(...prices);
  const minSize  = Math.min(...sizes),  maxSize  = Math.max(...sizes);

  // Pass 2: score each apartment
  return apartments.map(apt => {
    const scores = {
      price:     scorePrice(apt.price, minPrice, maxPrice),
      size:      scoreSize(apt.size, minSize, maxSize),
      location:  scoreLocation(apt.locationScore),
      amenities: scoreAmenities(apt.amenities),
    };

    // Weighted average — result is already 0–100 because weights sum to 1
    const finalScore = Math.round(
      scores.price     * w.price     +
      scores.size      * w.size      +
      scores.location  * w.location  +
      scores.amenities * w.amenities
    );

    return { ...apt, scores, finalScore, _w: w };
  });
}


// ============================================================
// SECTION 7 — EXPLANATION GENERATOR
//
// Produces a plain-English sentence for each ranked apartment.
// Logic: find the highest-contributing category (weight × score)
// and the lowest-scoring category, then compose a short summary.
// ============================================================

const CATEGORY_META = {
  price:     { good: 'competitive pricing',     bad: 'higher rent' },
  size:      { good: 'spacious square footage', bad: 'smaller square footage' },
  location:  { good: 'great location',          bad: 'a lower location score' },
  amenities: { good: 'strong amenities',        bad: 'fewer amenities' },
};

/**
 * Generate a short explanation for why an apartment ranked where it did.
 *
 * @param {Object} apt   Apartment with .scores, .finalScore, ._w
 * @param {number} rank  1-based rank in the sorted list
 * @returns {string}
 */
function generateExplanation(apt, rank) {
  const { scores, _w } = apt;
  const keys = Object.keys(CATEGORY_META);

  // Sort categories by their effective contribution (weight × score) descending
  const byContrib = [...keys].sort(
    (a, b) => _w[b] * scores[b] - _w[a] * scores[a]
  );

  // Sort by raw score to find the weakest area
  const byScore = [...keys].sort((a, b) => scores[a] - scores[b]);

  const best  = byContrib[0];
  const worst = byScore[0];

  let text = `Ranks #${rank} mainly due to its ${CATEGORY_META[best].good} (${scores[best]}/100).`;

  // Only mention a weakness if it's genuinely low (< 40) and different from the strength
  if (worst !== best && scores[worst] < 40) {
    text += ` Held back by ${CATEGORY_META[worst].bad} (${scores[worst]}/100).`;
  }

  // Overall assessment
  if (apt.finalScore >= 80)      text += ' An excellent fit for your priorities.';
  else if (apt.finalScore >= 60) text += ' A solid all-around option.';
  else if (apt.finalScore >= 40) text += ' Reasonable, with some trade-offs.';
  else                           text += ' May not align well with your current priorities.';

  return text;
}


// ============================================================
// SECTION 8 — RANKING
// ============================================================

/**
 * Score, sort, and annotate a list of apartments.
 *
 * @param {Object[]} apartments
 * @param {Object}   weights    { price, size, location, amenities }
 * @returns {Object[]} Sorted array with .rank and .explanation added
 */
function rankApartments(apartments, weights) {
  const scored = computeScores(apartments, weights);
  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.map((apt, i) => ({
    ...apt,
    rank:        i + 1,
    explanation: generateExplanation(apt, i + 1),
  }));
}


// ============================================================
// SECTION 9 — API FETCH (STUB)
//
// This function is the single seam for swapping mock → live data.
// When useMockData is true it returns MOCK_APARTMENTS immediately.
// When false, fill in fetchLiveApartments() with your real call.
// ============================================================

/**
 * Fetch apartment listings for a location query.
 * Swap the body of fetchLiveApartments() for real API integration.
 *
 * @param {string} location  City name or zip code (unused in mock mode)
 * @returns {Promise<Object[]>} Normalized apartments
 */
async function fetchApartments(location) {
  if (API_CONFIG.useMockData) {
    return MOCK_APARTMENTS;
  }
  return fetchLiveApartments(location);
}

/**
 * TODO: Implement real API call here.
 * Replace the body below with your chosen provider.
 *
 * Example (RentCast via local proxy):
 *   const res = await fetch(
 *     `http://localhost:8080/${API_CONFIG.rentcast.baseUrl}/listings/rental/long-term` +
 *     `?city=${encodeURIComponent(location)}&limit=20`,
 *     { headers: { 'X-Api-Key': API_CONFIG.rentcast.key } }
 *   );
 *   if (!res.ok) throw new Error(`API error ${res.status}`);
 *   const data = await res.json();
 *   return (data.listings ?? data).map(normalizeRentcastListing);
 *
 * @param {string} location
 * @returns {Promise<Object[]>}
 */
async function fetchLiveApartments(location) {
  // Placeholder — replace with real fetch
  console.warn('fetchLiveApartments() not implemented. Falling back to mock data.');
  return MOCK_APARTMENTS;
}


// ============================================================
// SECTION 9.5 — URL IMPORT
//
// Fetches a listing page via a free CORS proxy, parses the HTML,
// and pre-fills the "Add an Apartment" form so the user can
// review and confirm before clicking "Add & Re-rank".
//
// CORS PROXY: allorigins.win — free, no key required.
//   It wraps the response as: { contents: "<html>…</html>" }
//   If allorigins goes down, swap CORS_PROXY for another:
//     https://corsproxy.io/?         (append encoded URL directly)
//     https://thingproxy.freeboard.io/fetch/
//
// SITE SUPPORT (best-effort — sites may serve bot-check pages):
//   ✓ Craigslist   — simple HTML, most reliable
//   ✓ Zillow        — parses __NEXT_DATA__ JSON blob
//   ✓ Apartments.com — JSON-LD structured data
//   ✓ Generic       — JSON-LD + regex fallback (works on many sites)
//   ✗ Facebook Marketplace — login-gated, will not work
// ============================================================

const CORS_PROXY = 'https://api.allorigins.win/get?url=';

/**
 * Fetch a listing URL via the CORS proxy and return parsed apartment data.
 * Throws on network errors or empty proxy responses.
 *
 * @param {string} url  Full listing URL
 * @returns {Promise<Object>}  Partial apartment object (missing fields are 0 / '')
 */
async function importFromUrl(url) {
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;

  // Manual timeout — AbortSignal.timeout() isn't in older browsers
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 14000);

  try {
    const res = await fetch(proxyUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Proxy returned HTTP ${res.status}`);
    const json = await res.json();
    if (!json.contents) throw new Error('Proxy returned an empty body');
    return parseListingHtml(json.contents, url);
  } finally {
    clearTimeout(tid);
  }
}

// ── HTML parser dispatcher ────────────────────────────────────

/**
 * Parse raw listing HTML into a partial apartment object.
 * Dispatches to a site-specific parser, then falls back to generic.
 *
 * @param {string} html       Raw HTML string from proxy
 * @param {string} sourceUrl  Original listing URL (used for hostname detection)
 * @returns {Object}          Partial apartment — missing fields are 0 / ''
 */
function parseListingHtml(html, sourceUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let hostname = '';
  try { hostname = new URL(sourceUrl).hostname; } catch (_) {}

  let parsed = {};
  if (hostname.includes('craigslist.org'))  parsed = parseCraigslist(doc, html);
  else if (hostname.includes('zillow.com')) parsed = parseZillow(doc, html);
  else                                      parsed = parseGeneric(doc, html);

  // Fill any gaps with generic extractors
  return {
    name:          parsed.name          || extractTitle(doc)     || 'Imported Apartment',
    address:       parsed.address       || '',
    neighborhood:  parsed.neighborhood  || '',
    price:         parsed.price         || extractPrice(html)    || 0,
    size:          parsed.size          || extractSqft(html)     || 0,
    beds:          parsed.beds          ?? extractBeds(html)     ?? null,
    baths:         parsed.baths         ?? extractBaths(html)    ?? null,
    locationScore: parsed.locationScore || 50,
    amenities:     parsed.amenities     || extractAmenities(html),
  };
}

// ── Site-specific parsers ─────────────────────────────────────

function parseCraigslist(doc, html) {
  // Craigslist is plain HTML — easy to target by ID/class
  const titleEl   = doc.querySelector('#titletextonly, h2.postingtitle span.titletextonly');
  const priceEl   = doc.querySelector('span.price');
  const addressEl = doc.querySelector('div.mapaddress');

  return {
    name:      titleEl?.textContent?.trim(),
    address:   addressEl?.textContent?.trim(),
    price:     parseMoney(priceEl?.textContent),
    size:      extractSqft(html),
    beds:      extractBeds(html),
    baths:     extractBaths(html),
    amenities: extractAmenities(html),
  };
}

function parseZillow(doc, html) {
  // Zillow embeds all listing data in a <script id="__NEXT_DATA__"> JSON blob
  try {
    const script = doc.querySelector('script#__NEXT_DATA__');
    if (script) {
      const root  = JSON.parse(script.textContent);
      const pp    = root?.props?.pageProps ?? {};
      // Navigate two common Zillow page structures
      const cache = pp.gdpClientCache ?? {};
      const prop  = pp.initialReduxState?.gdp?.listing
                 ?? Object.values(cache)[0]?.property
                 ?? null;
      if (prop) {
        const addr = [prop.streetAddress, prop.city, prop.state]
          .filter(Boolean).join(', ');
        return {
          name:      prop.streetAddress || addr,
          address:   addr,
          price:     prop.price || prop.zestimate || 0,
          size:      prop.livingArea || 0,
          beds:      prop.bedrooms  ?? extractBeds(html),
          baths:     prop.bathrooms ?? extractBaths(html),
          amenities: extractAmenities(html),
        };
      }
    }
  } catch (_) { /* fall through to generic */ }
  return parseGeneric(doc, html);
}

function parseGeneric(doc, html) {
  // Try JSON-LD structured data (schema.org) — many sites include this
  const ld = extractJsonLd(doc);
  if (ld) {
    return {
      name:      ld.name || ld.alternateName || '',
      address:   formatLdAddress(ld.address),
      price:     Number(ld.offers?.price ?? ld.price) || 0,
      size:      Number(ld.floorSize?.value ?? ld.floorSize) || 0,
      beds:      Number(ld.numberOfRooms) || extractBeds(html),
      baths:     extractBaths(html),
      amenities: extractAmenities(html),
    };
  }
  // Pure regex fallback
  return {
    name:      extractTitle(doc),
    address:   '',
    price:     extractPrice(html),
    size:      extractSqft(html),
    beds:      extractBeds(html),
    baths:     extractBaths(html),
    amenities: extractAmenities(html),
  };
}

// ── Structured data helpers ───────────────────────────────────

/**
 * Find the first schema.org Apartment / RealEstateListing JSON-LD block.
 * @param {Document} doc
 * @returns {Object|null}
 */
function extractJsonLd(doc) {
  const TYPES = new Set(['Apartment', 'ApartmentComplex', 'RealEstateListing', 'SingleFamilyResidence']);
  for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw = JSON.parse(el.textContent);
      const items = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        if (TYPES.has(item['@type'])) return item;
      }
    } catch (_) {}
  }
  return null;
}

/** Format a schema.org PostalAddress object into a string. */
function formatLdAddress(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.streetAddress, addr.addressLocality, addr.addressRegion]
    .filter(Boolean).join(', ');
}

// ── Text / regex extractors ───────────────────────────────────

/** Extract the page <title> as a fallback apartment name. */
function extractTitle(doc) {
  return doc.querySelector('title')?.textContent?.trim() ?? '';
}

/**
 * Extract a monthly rent figure from raw HTML text.
 * Tries several common patterns; returns 0 if nothing found.
 */
function extractPrice(html) {
  const patterns = [
    /\$([\d,]+)\s*(?:\/mo|\/month|per\s+month)/i,  // $1,850/mo
    /rent[^$\d]{0,20}\$([\d,]+)/i,                  // rent: $1,850
    /price[^$\d]{0,20}\$([\d,]+)/i,                 // price: $1,850
    /"price"\s*:\s*"?([\d.]+)"?/,                   // JSON "price": 1850
    /\$([\d,]{4,})/,                                // bare $1850 (4+ digits)
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const v = parseInt(m[1].replace(/,/g, ''), 10);
      if (v > 200 && v < 50000) return v; // sanity-check rent range
    }
  }
  return 0;
}

/** Parse a money string like "$1,850/mo" into a number. */
function parseMoney(str) {
  if (!str) return 0;
  const v = parseInt(str.replace(/[^0-9]/g, ''), 10);
  return (v > 200 && v < 50000) ? v : 0;
}

/**
 * Extract square footage from raw HTML text.
 */
function extractSqft(html) {
  const patterns = [
    /([\d,]+)\s*sq\.?\s*ft/i,       // 780 sq ft
    /([\d,]+)\s*square\s*feet/i,    // 780 square feet
    /([\d,]+)\s*sqft/i,             // 780sqft
    /"livingArea"\s*:\s*([\d.]+)/,  // JSON "livingArea": 780
    /"squareFootage"\s*:\s*([\d.]+)/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const v = parseInt(m[1].replace(/,/g, ''), 10);
      if (v > 50 && v < 20000) return v; // sanity-check size range
    }
  }
  return 0;
}

/**
 * Extract bedroom count from raw HTML text.
 * Returns null if nothing found (don't default to 0 — that means studio).
 */
function extractBeds(html) {
  const patterns = [
    /(\d+)\s*(?:bedroom|bed(?:room)?s?|br|bd)\b/i,
    /"bedrooms?"\s*:\s*(\d+)/i,
    /(\d+)BR\b/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v >= 0 && v <= 10) return v;
    }
  }
  return null;
}

/**
 * Extract bathroom count from raw HTML text.
 * Returns null if nothing found.
 */
function extractBaths(html) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:bathroom|bath(?:room)?s?|ba)\b/i,
    /"bathrooms?"\s*:\s*([\d.]+)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const v = parseFloat(m[1]);
      if (v >= 0 && v <= 10) return v;
    }
  }
  return null;
}

/**
 * Scan the full page text for known amenity keywords.
 * Returns matching amenity names from AMENITY_POINTS.
 */
function extractAmenities(html) {
  const lower = html.toLowerCase();
  const KEYWORDS = {
    'In-unit Laundry': ['in-unit laundry', 'washer/dryer in unit', 'in unit washer', 'washer and dryer in'],
    'Parking':         ['parking', 'garage', 'covered parking'],
    'A/C':             ['air conditioning', 'central air', 'central a/c', ' a/c ', ' ac '],
    'Gym':             ['gym', 'fitness center', 'fitness room', 'workout room'],
    'Pet Friendly':    ['pet friendly', 'pets allowed', 'cats ok', 'dogs ok', 'pet-friendly'],
    'Pool':            ['swimming pool', ' pool '],
    'Dishwasher':      ['dishwasher'],
    'Balcony':         ['balcony', 'private patio', 'private deck'],
    'Rooftop':         ['rooftop', 'roof deck', 'roof top'],
    'EV Charging':     ['ev charging', 'electric vehicle charging', 'electric car charging'],
    'Doorman':         ['doorman', 'concierge'],
    'Elevator':        ['elevator'],
    'Storage':         ['storage unit', 'storage room', 'extra storage'],
    'Bike Storage':    ['bike storage', 'bicycle storage', 'bike room'],
  };
  return Object.entries(KEYWORDS)
    .filter(([, kws]) => kws.some(kw => lower.includes(kw)))
    .map(([name]) => name);
}

// ── Form filler ───────────────────────────────────────────────

/**
 * Pre-fill the "Add an Apartment" form with parsed data.
 * User reviews and clicks "Add & Re-rank" to confirm.
 *
 * @param {Object} data  Partial apartment from parseListingHtml()
 */
function fillForm(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== null && val !== undefined && val !== '') el.value = val;
  };
  set('f-name',      data.name);
  set('f-address',   data.address || data.neighborhood);
  set('f-price',     data.price || '');
  set('f-size',      data.size  || '');
  set('f-loc',       data.locationScore !== 50 ? data.locationScore : '');
  set('f-amenities', (data.amenities || []).join(', '));
  // beds=0 is valid (studio), so check explicitly for null
  if (data.beds  != null) document.getElementById('f-beds').value  = data.beds;
  if (data.baths != null) document.getElementById('f-baths').value = data.baths;
  // listing URL is set separately by wireImport after calling fillForm
}

// ── Import button wiring ──────────────────────────────────────

function wireImport() {
  const btn    = document.getElementById('btn-import');
  const urlIn  = document.getElementById('f-url');
  const status = document.getElementById('import-status');

  function setStatus(type, msg) {
    status.className = `import-status ${type}`;
    status.textContent = msg;
  }

  btn.addEventListener('click', async () => {
    const url = urlIn.value.trim();
    if (!url) { setStatus('error', 'Paste a listing URL first.'); return; }

    btn.disabled = true;
    btn.textContent = 'Importing…';
    setStatus('loading', 'Fetching listing via proxy…');

    try {
      const data = await importFromUrl(url);
      fillForm(data);
      document.getElementById('f-listing-url').value = url; // carry the source URL into the form

      const found = [
        data.price  ? `$${data.price.toLocaleString()}/mo` : null,
        data.size   ? `${data.size.toLocaleString()} sq ft` : null,
        data.amenities?.length ? `${data.amenities.length} amenities` : null,
      ].filter(Boolean);

      if (found.length) {
        setStatus('success', `Filled in: ${found.join(' · ')} — review below and click Add & Re-rank.`);
      } else {
        setStatus('warn', 'Could not auto-detect details. Fill in the form manually.');
      }

      // Scroll the add form into view
      document.getElementById('f-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
      urlIn.value = '';
    } catch (err) {
      console.error('URL import failed:', err);
      if (err.name === 'AbortError') {
        setStatus('error', 'Request timed out. The site may be blocking the proxy.');
      } else {
        setStatus('error', `Import failed: ${err.message}`);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Import from URL';
    }
  });

  // Also allow pressing Enter in the URL field
  urlIn.addEventListener('keydown', e => {
    if (e.key === 'Enter') btn.click();
  });
}


// ============================================================
// SECTION 10 — RENDER HELPERS
// ============================================================

const RANK_BADGE_CLASS = ['gold', 'silver', 'bronze'];

/** Map a 0–100 score to a CSS color for bars and numbers. */
function scoreColor(score) {
  if (score >= 72) return '#16a34a'; // green
  if (score >= 48) return '#d97706'; // amber
  return '#dc2626';                  // red
}

/** Render one horizontal score bar row. */
function renderBar(label, score) {
  return `
    <div class="srow">
      <span class="slabel">${label}</span>
      <div class="sbar-bg">
        <div class="sbar-fill" style="width:${score}%;background:${scoreColor(score)}"></div>
      </div>
      <span class="sval">${score}</span>
    </div>`;
}

/** Escape a string for safe embedding in an HTML attribute value. */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Render the inline edit form for a card (replaces card content when editing). */
function renderEditForm(apt) {
  const amenStr  = (apt.amenities || []).join(', ');
  const bedsVal  = apt.beds  != null ? apt.beds  : '';
  const bathsVal = apt.baths != null ? apt.baths : '';
  const urlVal   = apt.url && apt.url !== '#' ? apt.url : '';
  return `
    <div class="apt-edit-form">
      <div class="edit-form-title">Editing: ${escHtml(apt.name)}</div>
      <div class="edit-grid">
        <div class="edit-field edit-full">
          <label>Address / Neighborhood</label>
          <input type="text"   class="ef-address"  value="${escHtml(apt.address)}">
        </div>
        <div class="edit-field edit-full">
          <label>Name / Building <span style="font-weight:400;font-style:italic;font-size:0.65rem;">optional</span></label>
          <input type="text"   class="ef-name"     value="${escHtml(apt.name)}">
        </div>
        <div class="edit-field edit-full">
          <label>Listing URL (optional)</label>
          <input type="url"    class="ef-url"      value="${escHtml(urlVal)}">
        </div>
        <div class="edit-field edit-full">
          <label>Photo URL <span style="font-weight:400;font-style:italic;font-size:0.65rem;">optional — right-click listing photo → Copy image address</span></label>
          <input type="url"    class="ef-photo-url" value="${escHtml(apt.photoUrl ?? '')}">
        </div>
        <div class="edit-field">
          <label>Monthly Rent ($)</label>
          <input type="number" class="ef-price"    value="${apt.price}" min="0">
        </div>
        <div class="edit-field">
          <label>Additional Fees ($/mo)</label>
          <input type="number" class="ef-fees"     value="${apt.additionalFees ?? ''}" min="0" placeholder="optional">
        </div>
        <div class="edit-field">
          <label>Square Footage</label>
          <input type="number" class="ef-size"     value="${apt.size}"  min="0">
        </div>
        <div class="edit-field">
          <label>Location Score (0–100)</label>
          <input type="number" class="ef-loc"      value="${apt.locationScore}" min="0" max="100">
        </div>
        <div class="edit-field">
          <label>Bedrooms</label>
          <input type="number" class="ef-beds"     value="${bedsVal}"  min="0" step="1">
        </div>
        <div class="edit-field">
          <label>Bathrooms</label>
          <input type="number" class="ef-baths"    value="${bathsVal}" min="0" step="0.5">
        </div>
        <div class="edit-field edit-full">
          <label>Amenities (comma-separated)</label>
          <input type="text"   class="ef-amenities" value="${escHtml(amenStr)}">
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn btn-primary btn-save-edit" data-save-id="${apt.id}"
          style="width:auto;padding:0.45rem 1.1rem;font-size:0.82rem;">Save Changes</button>
        <button class="btn btn-ghost btn-cancel-edit" data-cancel-id="${apt.id}"
          style="width:auto;padding:0.45rem 0.9rem;font-size:0.82rem;margin-top:0;">Cancel</button>
      </div>
    </div>`;
}

/** Render one apartment card. */
function renderCard(apt, forExport = false) {
  const badgeClass  = RANK_BADGE_CLASS[apt.rank - 1] ?? '';
  const amenityHTML = apt.amenities
    .map(a => `<span class="amen-tag">${a}</span>`)
    .join('');
  const userBadge = apt.source === 'user'
    ? '<span class="chip user">added by you</span>'
    : '';

  return `
    <div class="apt-card" data-apt-id="${apt.id}" draggable="true">
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <div class="rank-badge ${badgeClass}">${apt.rank}</div>

      <div class="apt-info">
        <div class="apt-name">${apt.address}${apt.neighborhood ? ' &mdash; ' + apt.neighborhood : ''}</div>
        ${apt.name ? `<div class="apt-address">${apt.name}</div>` : ''}
        ${apt.url && apt.url !== '#' ? `
        <a class="listing-link" href="${apt.url}" target="_blank" rel="noopener">View listing ↗</a>` : ''}
        ${apt.photoUrl ? `
        <div class="listing-thumb-wrap">
          <a href="${apt.url && apt.url !== '#' ? apt.url : apt.photoUrl}" target="_blank" rel="noopener" tabindex="-1">
            <img class="listing-thumb"
                 src="${apt.photoUrl}"
                 alt="Listing preview"
                 loading="lazy"
                 onerror="this.closest('.listing-thumb-wrap').style.display='none'">
          </a>
        </div>` : ''}

        <div class="chips">
          <span class="chip price">$${apt.price.toLocaleString()}/mo</span>
          ${apt.additionalFees > 0 ? `<span class="chip fees">+$${apt.additionalFees.toLocaleString()} fees</span>` : ''}
          <span class="chip size">${apt.size.toLocaleString()} sq ft</span>
          ${apt.beds != null ? `<span class="chip beds">${apt.beds === 0 ? 'Studio' : apt.beds + ' bd'} · ${apt.baths} ba</span>` : ''}
          <span class="chip loc">Location ${apt.locationScore}/100</span>
          ${userBadge}
        </div>
        ${apt.additionalFees > 0 ? `<div class="apt-total">Total: <strong>$${(apt.price + apt.additionalFees).toLocaleString()}/mo</strong></div>` : ''}

        ${apt.amenities.length ? `<div class="amenities">${amenityHTML}</div>` : ''}

        <div class="score-bars">
          ${renderBar('Price',     apt.scores.price)}
          ${renderBar('Size',      apt.scores.size)}
          ${renderBar('Location',  apt.scores.location)}
          ${renderBar('Amenities', apt.scores.amenities)}
        </div>

        <div class="explanation">${apt.explanation}</div>
        ${!forExport ? `
        <label class="tour-row${apt.tourScheduled ? ' scheduled' : ''}">
          <input type="checkbox" data-tour-id="${apt.id}"${apt.tourScheduled ? ' checked' : ''}>
          Tour scheduled
        </label>
        <button class="btn-remove" data-remove-id="${apt.id}">✕ Remove</button>
        <button class="btn-edit"   data-edit-id="${apt.id}">✎ Edit</button>
        ` : `
        ${apt.tourScheduled ? '<div style="font-size:0.75rem;color:#16a34a;font-weight:600;margin-top:0.4rem;">✓ Tour scheduled</div>' : ''}
        `}
      </div>

      <div class="final-score">
        <div class="fs-number" style="color:${scoreColor(apt.finalScore)}">${apt.finalScore}</div>
        <div class="fs-denom">/ 100</div>
      </div>
    </div>`;
}

/** Render the full ranked list into #results. */
function renderResults(ranked) {
  document.getElementById('apt-count').textContent = ranked.length;
  const container = document.getElementById('results');

  if (ranked.length === 0) {
    container.innerHTML = '<div class="empty-state">No apartments to display. Add one using the form.</div>';
    return;
  }

  container.innerHTML = ranked.map(apt => renderCard(apt)).join('');
}


// ============================================================
// SECTION 10.5 — GOOGLE MAPS
//
// Lazy-loads the Maps JavaScript API on first map toggle.
// Uses the Geocoding API to convert plain addresses → lat/lng.
// Apartments with preset .lat / .lng (mock data) skip the
// Geocoding API call entirely.
//
// Setup:
//   1. Go to https://console.cloud.google.com
//   2. Create a project → enable "Maps JavaScript API" + "Geocoding API"
//   3. Create an API key and paste it into API_CONFIG.googleMaps.key
//
// Free tier: Google gives $200/month credit — enough for thousands
// of geocoding requests and map loads for personal use.
// ============================================================

let gMap        = null;   // google.maps.Map instance
let gMarkers    = [];     // active Marker instances
let gOpenIW     = null;   // currently open InfoWindow
let mapVisible  = false;
let gmapsLoaded = false;

const geocodeCache = new Map(); // address query → {lat, lng} | null

/** Inject the Maps JS script tag and resolve when the SDK is ready. */
function loadGoogleMaps() {
  if (gmapsLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.__gmInit = () => { gmapsLoaded = true; resolve(); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${API_CONFIG.googleMaps.key}&callback=__gmInit&v=weekly`;
    s.onerror = () => reject(new Error('Maps script failed to load — check your API key.'));
    document.head.appendChild(s);
  });
}

/** Create the map instance inside #map (call once after loadGoogleMaps). */
function initGMap() {
  if (gMap) return;
  gMap = new google.maps.Map(document.getElementById('map'), {
    zoom:               4,
    center:             { lat: 39.5, lng: -98.35 }, // continental US
    mapTypeControl:     false,
    streetViewControl:  false,
    fullscreenControl:  true,
  });
}

/**
 * Build a numbered circular SVG marker icon for a given rank.
 * Uses an SVG data URI so no external assets are required.
 */
function makeGMapIcon(rank) {
  const rankColors = { 1: '#f59e0b', 2: '#9ca3af', 3: '#b45309' };
  const bg = rankColors[rank] ?? '#4f6ef7';
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34">` +
    `<circle cx="17" cy="17" r="15" fill="${bg}" stroke="white" stroke-width="2.5"/>` +
    `<text x="17" y="22" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="white" text-anchor="middle">${rank}</text>` +
    `</svg>`
  );
  return {
    url:        `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new google.maps.Size(34, 34),
    anchor:     new google.maps.Point(17, 17),
  };
}

/**
 * Geocode an address string via the Google Maps Geocoder.
 * Results are cached for the lifetime of the page session.
 *
 * @param {string} query
 * @returns {Promise<{lat:number,lng:number}|null>}
 */
function geocodeWithGoogle(query) {
  if (geocodeCache.has(query)) return Promise.resolve(geocodeCache.get(query));
  return new Promise(resolve => {
    new google.maps.Geocoder().geocode({ address: query }, (results, status) => {
      const coords = status === 'OK'
        ? { lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() }
        : null;
      geocodeCache.set(query, coords);
      resolve(coords);
    });
  });
}

/**
 * Place ranked markers on the map for all apartments.
 * Apartments with preset .lat/.lng skip the Geocoding API.
 *
 * @param {Object[]} ranked  Sorted apartment list from rankApartments()
 */
async function updateMap(ranked) {
  if (!mapVisible || !gMap) return;

  // Clear previous markers and info windows
  gMarkers.forEach(m => m.setMap(null));
  gMarkers = [];
  if (gOpenIW) { gOpenIW.close(); gOpenIW = null; }

  const bounds = new google.maps.LatLngBounds();
  let placed = 0;

  for (const apt of ranked) {
    let coords;

    // Prefer preset coordinates (mock data) — no API call needed
    if (apt.lat && apt.lng) {
      coords = { lat: apt.lat, lng: apt.lng };
    } else {
      const query = [apt.address, apt.neighborhood].filter(Boolean).join(', ');
      if (!query.trim()) continue;
      coords = await geocodeWithGoogle(query);
    }

    if (!coords) continue;

    const bedBathLine = apt.beds != null
      ? `<br>${apt.beds === 0 ? 'Studio' : apt.beds + ' bd'} · ${apt.baths} ba`
      : '';

    const iw = new google.maps.InfoWindow({
      content:
        `<div style="font-family:-apple-system,sans-serif;max-width:200px;line-height:1.5">` +
        `<strong style="font-size:0.9rem">#${apt.rank} ${apt.name}</strong><br>` +
        `<span style="color:#6b7280;font-size:0.78rem">${apt.address || apt.neighborhood}</span>` +
        bedBathLine +
        `<br><span style="color:#1d4ed8;font-weight:700">$${apt.price.toLocaleString()}/mo</span>` +
        (apt.size ? ` · ${apt.size.toLocaleString()} sq&nbsp;ft` : '') +
        `<br><em style="color:#6b7280;font-size:0.78rem">Score: ${apt.finalScore}/100</em>` +
        `</div>`,
    });

    const marker = new google.maps.Marker({
      position: coords,
      map:      gMap,
      icon:     makeGMapIcon(apt.rank),
      title:    apt.name,
      zIndex:   1000 - apt.rank, // top-ranked marker renders on top
    });

    marker.addListener('click', () => {
      if (gOpenIW) gOpenIW.close();
      iw.open({ map: gMap, anchor: marker });
      gOpenIW = iw;
    });

    gMarkers.push(marker);
    bounds.extend(coords);
    placed++;
  }

  if (placed === 1) {
    gMap.setCenter(bounds.getCenter());
    gMap.setZoom(14);
  } else if (placed > 1) {
    gMap.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }
}

/** Wire the Show/Hide Map toggle button. */
function wireMap() {
  const btn  = document.getElementById('btn-map');
  const wrap = document.getElementById('map-wrap');

  btn.addEventListener('click', async () => {
    mapVisible = !mapVisible;

    if (mapVisible) {
      // Show a helpful error if the key is still the placeholder
      if (!API_CONFIG.googleMaps?.key || API_CONFIG.googleMaps.key === 'YOUR_GOOGLE_MAPS_API_KEY') {
        wrap.innerHTML =
          `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius);padding:1rem;font-size:0.82rem;color:#dc2626;margin-bottom:0.85rem">` +
          `<strong>Google Maps API key required.</strong><br>` +
          `Open <code>script.js</code> and set <code>API_CONFIG.googleMaps.key</code>.<br>` +
          `<a href="https://console.cloud.google.com" target="_blank" style="color:#4f6ef7">Get a key → console.cloud.google.com</a>` +
          ` — enable <em>Maps JavaScript API</em> and <em>Geocoding API</em>.` +
          `</div>`;
        wrap.style.display = 'block';
        btn.textContent = 'Hide Map';
        return;
      }

      wrap.style.display = 'block';
      btn.textContent = 'Hide Map';

      try {
        btn.disabled = true;
        await loadGoogleMaps();
        initGMap();
        const ranked = rankApartments(apartments, getWeights());
        await updateMap(ranked);
      } catch (err) {
        console.error('Google Maps error:', err);
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.innerHTML =
          `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#dc2626;font-size:0.85rem;padding:1rem;text-align:center">` +
          `Failed to load Google Maps:<br>${err.message}</div>`;
      } finally {
        btn.disabled = false;
      }
    } else {
      wrap.style.display = 'none';
      btn.textContent = 'Show Map';
    }
  });
}


// ============================================================
// SECTION 11 — STATE & EVENT WIRING
// ============================================================

/** Mutable apartment list — grows as the user adds entries. */
let apartments = [];

/**
 * Manual ordering — null means use score-based rank.
 * When set, this is an array of apartment IDs in the user's preferred order.
 * Stored in localStorage so it survives page refresh.
 */
let manualOrder = null;

/** Read current weight values from the four sliders. */
function getWeights() {
  return {
    price:     parseInt(document.getElementById('w-price').value, 10),
    size:      parseInt(document.getElementById('w-size').value, 10),
    location:  parseInt(document.getElementById('w-location').value, 10),
    amenities: parseInt(document.getElementById('w-amenities').value, 10),
  };
}

/** Re-rank and re-render using current apartments and weights. */
function rerank() {
  let ranked = rankApartments(apartments, getWeights());

  // Apply manual ordering if the user has dragged cards
  if (manualOrder?.length) {
    ranked.sort((a, b) => {
      const ia = manualOrder.indexOf(a.id);
      const ib = manualOrder.indexOf(b.id);
      // New apartments not yet in manualOrder go to the end by score
      if (ia === -1 && ib === -1) return a.rank - b.rank;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    // Re-assign rank numbers and explanations to match visual order
    ranked.forEach((apt, i) => {
      apt.rank = i + 1;
      apt.explanation = generateExplanation(apt, i + 1);
    });
  }

  // Show "Reset Order" button only while a manual order is active
  const resetBtn = document.getElementById('btn-reset-order');
  if (resetBtn) resetBtn.style.display = manualOrder?.length ? '' : 'none';

  renderResults(ranked);
  if (mapVisible) updateMap(ranked); // refresh markers when map is open
  saveState();                       // persist after every re-rank
}

/**
 * Wire HTML5 drag-and-drop on the #results card list.
 * Uses event delegation so it works after every renderResults() call.
 * On drop, reads the current DOM card order, saves it as manualOrder,
 * persists to localStorage, then calls rerank() to re-assign rank badges.
 */
function wireDrag() {
  const container = document.getElementById('results');
  let dragSrcId   = null;

  // Helper: find nearest .apt-card ancestor (or self) of an event target
  function cardOf(el) {
    return el.closest?.('.apt-card') ?? null;
  }

  // ── dragstart ──────────────────────────────────────────────
  container.addEventListener('dragstart', e => {
    const card = cardOf(e.target);
    if (!card) return;
    dragSrcId = card.dataset.aptId;
    // Small delay so the ghost image renders before opacity drops
    requestAnimationFrame(() => card.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
  });

  // ── dragover ───────────────────────────────────────────────
  container.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = cardOf(e.target);
    if (!card || card.dataset.aptId === dragSrcId) return;
    // Remove highlight from all cards, then highlight target
    container.querySelectorAll('.apt-card.drag-over')
      .forEach(c => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });

  // ── dragleave ──────────────────────────────────────────────
  container.addEventListener('dragleave', e => {
    const card = cardOf(e.target);
    if (card) card.classList.remove('drag-over');
  });

  // ── dragend ────────────────────────────────────────────────
  container.addEventListener('dragend', () => {
    container.querySelectorAll('.apt-card')
      .forEach(c => c.classList.remove('dragging', 'drag-over'));
    dragSrcId = null;
  });

  // ── drop ───────────────────────────────────────────────────
  container.addEventListener('drop', e => {
    e.preventDefault();
    const targetCard = cardOf(e.target);
    if (!targetCard || !dragSrcId || targetCard.dataset.aptId === dragSrcId) return;

    // Read current DOM card order
    const cards = [...container.querySelectorAll('.apt-card')];
    const ids   = cards.map(c => c.dataset.aptId);

    // Move dragSrcId to the position of targetCard
    const srcIdx    = ids.indexOf(dragSrcId);
    const targetIdx = ids.indexOf(targetCard.dataset.aptId);
    if (srcIdx === -1 || targetIdx === -1) return;
    ids.splice(srcIdx, 1);
    ids.splice(targetIdx, 0, dragSrcId);

    // Persist and re-render
    manualOrder = ids;
    localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(manualOrder));
    rerank();
  });

  // ── Reset Order button ─────────────────────────────────────
  document.getElementById('btn-reset-order').addEventListener('click', () => {
    manualOrder = null;
    localStorage.removeItem(STORAGE_KEY_ORDER);
    rerank();
  });
}

/** Wire all four range sliders to update their labels and trigger a re-rank. */
function wireSliders() {
  [
    { id: 'w-price',     lbl: 'lbl-price'     },
    { id: 'w-size',      lbl: 'lbl-size'      },
    { id: 'w-location',  lbl: 'lbl-location'  },
    { id: 'w-amenities', lbl: 'lbl-amenities' },
  ].forEach(({ id, lbl }) => {
    const slider = document.getElementById(id);
    const label  = document.getElementById(lbl);
    slider.addEventListener('input', () => {
      label.textContent = slider.value;
      rerank();
    });
  });
}

/** Wire the "Add & Re-rank" button. */
function wireAddForm() {
  document.getElementById('btn-add').addEventListener('click', () => {
    const name     = document.getElementById('f-name').value.trim();
    const address  = document.getElementById('f-address').value.trim();
    const price    = parseFloat(document.getElementById('f-price').value);
    const size     = parseFloat(document.getElementById('f-size').value);
    const locRaw     = document.getElementById('f-loc').value;
    const amenRaw    = document.getElementById('f-amenities').value;
    const bedsRaw    = document.getElementById('f-beds').value;
    const bathsRaw   = document.getElementById('f-baths').value;
    const feesRaw    = document.getElementById('f-fees').value;
    const listingUrl = document.getElementById('f-listing-url').value.trim();
    const photoUrl   = document.getElementById('f-photo-url').value.trim();

    if (!address || isNaN(price) || isNaN(size)) {
      alert('Address, Monthly Rent, and Square Footage are required.');
      return;
    }

    const locScore      = locRaw  === '' ? 50 : Math.min(100, Math.max(0, parseFloat(locRaw)));
    const beds          = bedsRaw  === '' ? null : parseInt(bedsRaw, 10);
    const baths         = bathsRaw === '' ? null : parseFloat(bathsRaw);
    const additionalFees = feesRaw === '' ? null : Math.max(0, parseFloat(feesRaw));
    const amenities = amenRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    apartments.push({
      id:            `user-${Date.now()}`,
      name,
      address,
      neighborhood:  '',
      price,
      additionalFees,
      size,
      beds,
      baths,
      locationScore: locScore,
      amenities,
      url:           listingUrl || '#',
      photoUrl:      photoUrl || null,
      source:        'user',
    });

    // Clear the form
    ['f-name', 'f-address', 'f-listing-url', 'f-photo-url', 'f-price', 'f-fees', 'f-size', 'f-loc', 'f-amenities', 'f-beds', 'f-baths']
      .forEach(id => { document.getElementById(id).value = ''; });

    rerank();
  });

  document.getElementById('btn-rank').addEventListener('click', rerank);
}


// ============================================================
// SECTION 12 — INIT
// ============================================================

async function init() {
  try {
    const savedApts    = loadSavedApartments();
    const savedWeights = loadSavedWeights();

    if (savedApts) {
      apartments = savedApts;
      document.getElementById('data-source').textContent  = `${savedApts.length} saved`;
      document.getElementById('source-label').textContent = `${savedApts.length} saved apartments`;
      const badge = document.getElementById('save-status');
      if (badge) badge.style.display = 'block';
    } else {
      apartments = await fetchApartments('');
      const sourceLabel = API_CONFIG.useMockData ? 'sample data' : 'live API';
      document.getElementById('data-source').textContent  = sourceLabel;
      document.getElementById('source-label').textContent = sourceLabel;
    }

    wireSliders();
    if (savedWeights) applySavedWeights(savedWeights);  // restore weights before first rerank

    // Load persisted manual order (null = score-based order)
    try {
      manualOrder = JSON.parse(localStorage.getItem(STORAGE_KEY_ORDER) ?? 'null');
    } catch (_) { manualOrder = null; }

    wireAddForm();
    wireImport();
    wireMap();
    wireExport();
    wireRemove();
    wireEdit();
    wireCsvImport();
    wireDarkMode();
    wireDrag();
    wireDrive();
    rerank();
  } catch (err) {
    console.error('Failed to initialize apartment ranker:', err);
    document.getElementById('results').innerHTML =
      '<div class="empty-state">Failed to load data. Check the browser console for details.</div>';
  }
}

// ============================================================
// SECTION 13 — PERSISTENCE (localStorage)
//
// apartments[] and weights are saved after every re-rank.
// On next load, saved data is restored automatically so
// manually-added apartments survive page refreshes.
//
// Keys are versioned (v1_) so a future schema change won't
// silently load corrupt data.
//
// NOTE: these consts MUST be declared before init() is called
// so they are initialized (not in TDZ) when saveState() and
// loadSavedApartments() run during startup.
// ============================================================

const STORAGE_KEY_APTS    = 'aptRanker_v1_apartments';
const STORAGE_KEY_WEIGHTS = 'aptRanker_v1_weights';
const STORAGE_KEY_ORDER   = 'aptRanker_v1_order';

init();

/**
 * Serialize current apartments (raw, no computed scores) and
 * weights to localStorage. Called automatically by rerank().
 */
function saveState() {
  try {
    // Strip computed fields — only persist raw apartment data
    const clean = apartments.map(({ scores, finalScore, rank, explanation, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY_APTS,    JSON.stringify(clean));
    localStorage.setItem(STORAGE_KEY_WEIGHTS, JSON.stringify(getWeights()));

    // Flash the "Saved" indicator for 1.5 s
    const ind = document.getElementById('save-indicator');
    if (ind) {
      ind.style.display = 'flex';
      clearTimeout(ind._fadeTimer);
      ind._fadeTimer = setTimeout(() => { ind.style.display = 'none'; }, 1500);
    }
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

/** Load saved apartments from localStorage. Returns null if none found. */
function loadSavedApartments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_APTS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch (_) { return null; }
}

/** Load saved weights from localStorage. Returns null if none found. */
function loadSavedWeights() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WEIGHTS);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

/** Apply a weights object to the four sliders and their labels. */
function applySavedWeights(weights) {
  const map = {
    price:     { slider: 'w-price',     label: 'lbl-price'     },
    size:      { slider: 'w-size',      label: 'lbl-size'      },
    location:  { slider: 'w-location',  label: 'lbl-location'  },
    amenities: { slider: 'w-amenities', label: 'lbl-amenities' },
  };
  for (const [key, { slider, label }] of Object.entries(map)) {
    if (weights[key] != null) {
      document.getElementById(slider).value      = weights[key];
      document.getElementById(label).textContent = weights[key];
    }
  }
}

/** Remove all saved data and reload with sample data. */
function clearSavedState() {
  localStorage.removeItem(STORAGE_KEY_APTS);
  localStorage.removeItem(STORAGE_KEY_WEIGHTS);
  localStorage.removeItem(STORAGE_KEY_ORDER);
  manualOrder = null;
}


// ============================================================
// SECTION 14 — EXPORT
//
// Two export formats:
//   CSV  — flat spreadsheet, opens in Excel / Google Sheets
//   HTML — self-contained styled report, shareable as a file
//          or printable to PDF via the browser's Print dialog
// ============================================================

/** Trigger a browser file download. */
function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

/** Export the ranked list as a CSV file. */
function exportCSV(ranked) {
  const headers = [
    'Rank', 'Name', 'Address', 'Neighborhood',
    'Beds', 'Baths', 'Price ($/mo)', 'Additional Fees ($/mo)', 'Size (sq ft)',
    'Location Score', 'Amenities', 'Final Score',
    'Score: Price', 'Score: Size', 'Score: Location', 'Score: Amenities',
    'Listing URL', 'Photo URL', 'Tour Scheduled',
  ];

  const rows = ranked.map(apt => [
    apt.rank,
    apt.name,
    apt.address,
    apt.neighborhood,
    apt.beds  ?? '',
    apt.baths ?? '',
    apt.price,
    apt.additionalFees ?? '',
    apt.size,
    apt.locationScore,
    apt.amenities.join('; '),
    apt.finalScore,
    apt.scores.price,
    apt.scores.size,
    apt.scores.location,
    apt.scores.amenities,
    apt.url !== '#' ? apt.url : '',
    apt.photoUrl ?? '',
    apt.tourScheduled ? 'Yes' : 'No',
  ]);

  const esc = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(`apartment-rankings-${date}.csv`, csv, 'text/csv;charset=utf-8;');
}

/** Inline CSS for the standalone HTML report. */
function reportCSS() {
  return `
    :root{--primary:#4f6ef7;--bg:#f4f6fb;--surface:#fff;--border:#e2e7ef;
          --text:#1a1f2e;--muted:#6b7280;--green:#16a34a;--amber:#d97706;
          --red:#dc2626;--radius:10px}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:var(--bg);color:var(--text);line-height:1.5;font-size:15px;padding:1.5rem 2rem}
    h1{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin-bottom:.2rem}
    .report-meta{font-size:.82rem;color:var(--muted);margin-bottom:1rem}
    .weights-row{background:var(--surface);border:1px solid var(--border);
                 border-radius:var(--radius);padding:.75rem 1.2rem;
                 margin-bottom:1.25rem;font-size:.8rem;
                 display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center}
    .weights-row span{color:var(--muted)}
    .weights-row strong{color:var(--primary)}
    .apt-card{background:var(--surface);border:1px solid var(--border);
              border-radius:var(--radius);padding:1.1rem 1.2rem;
              display:grid;grid-template-columns:44px 1fr 72px;
              gap:1rem;align-items:start;margin-bottom:.85rem}
    .rank-badge{width:36px;height:36px;border-radius:50%;background:var(--primary);
                color:#fff;display:flex;align-items:center;justify-content:center;
                font-weight:800;font-size:.95rem;flex-shrink:0;margin-top:2px}
    .rank-badge.gold{background:#f59e0b}
    .rank-badge.silver{background:#9ca3af}
    .rank-badge.bronze{background:#b45309}
    .apt-info{min-width:0}
    .apt-name{font-size:1rem;font-weight:700}
    .apt-address{font-size:.78rem;color:var(--muted);margin-top:1px}
    .listing-link{display:inline-flex;align-items:center;gap:.2rem;font-size:.72rem;
                  color:var(--primary);text-decoration:none;margin-top:.25rem}
    .listing-thumb-wrap{margin-top:.5rem;line-height:0}
    .listing-thumb{display:block;width:240px;height:140px;object-fit:cover;
                   object-position:top;border-radius:8px;border:1px solid var(--border)}
    .chips{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}
    .chip{font-size:.72rem;border-radius:100px;padding:.2rem .55rem;
          border:1px solid var(--border);color:var(--muted);background:var(--bg)}
    .chip.price{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;font-weight:700}
    .chip.size{background:#f0fdf4;border-color:#bbf7d0;color:#15803d;font-weight:600}
    .chip.loc{background:#fefce8;border-color:#fde68a;color:#92400e}
    .chip.beds{background:#faf5ff;border-color:#e9d5ff;color:#6d28d9}
    .chip.fees{background:#fff7ed;border-color:#fed7aa;color:#c2410c;font-weight:600}
    .chip.user{background:#fdf4ff;border-color:#e9d5ff;color:#7e22ce;font-size:.68rem}
    .apt-total{font-size:.72rem;color:var(--muted);margin-top:.3rem}
    .apt-total strong{color:var(--text);font-variant-numeric:tabular-nums}
    .amenities{display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.55rem}
    .amen-tag{font-size:.68rem;background:#f0fdf4;border:1px solid #bbf7d0;
              color:#15803d;border-radius:4px;padding:.1rem .4rem}
    .score-bars{margin-top:.75rem;display:flex;flex-direction:column;gap:.32rem}
    .srow{display:flex;align-items:center;gap:.5rem;font-size:.72rem}
    .slabel{width:62px;color:var(--muted);flex-shrink:0}
    .sbar-bg{flex:1;height:5px;background:#e9ecef;border-radius:100px;overflow:hidden}
    .sbar-fill{height:100%;border-radius:100px}
    .sval{width:26px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
    .explanation{margin-top:.7rem;padding-top:.65rem;border-top:1px solid var(--border);
                 font-size:.78rem;color:var(--muted);font-style:italic}
    .final-score{text-align:right;padding-top:2px}
    .fs-number{font-size:2.1rem;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
    .fs-denom{font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
    @media print{.apt-card{break-inside:avoid}}
  `;
}

/** Export the current ranked list as a self-contained HTML file. */
function exportHTML(ranked) {
  const weights  = getWeights();
  const dateStr  = new Date().toLocaleString();
  const dateSlug = new Date().toISOString().slice(0, 10);

  const weightsRow = `
    <div class="weights-row">
      <span>Weights:</span>
      <span>Price <strong>${weights.price}</strong></span>
      <span>Size <strong>${weights.size}</strong></span>
      <span>Location <strong>${weights.location}</strong></span>
      <span>Amenities <strong>${weights.amenities}</strong></span>
    </div>`;

  const cards = ranked.map(apt => renderCard(apt, true)).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Apartment Rankings \u2014 ${dateSlug}</title>
  <style>${reportCSS()}</style>
</head>
<body>
  <h1>Apartment Rankings</h1>
  <p class="report-meta">Generated ${dateStr} &mdash; ${ranked.length} apartment${ranked.length !== 1 ? 's' : ''}</p>
  ${weightsRow}
  ${cards}
</body>
</html>`;

  triggerDownload(`apartment-rankings-${dateSlug}.html`, html, 'text/html;charset=utf-8;');
}

/** Wire the remove buttons on apartment cards via event delegation. */
function wireRemove() {
  document.getElementById('results').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-id]');
    if (!btn) return;
    apartments = apartments.filter(a => a.id !== btn.dataset.removeId);
    rerank();
  });
}

/** Wire inline edit, save, and cancel actions on apartment cards. */
function wireEdit() {
  document.getElementById('results').addEventListener('click', e => {

    // ── Edit button: enter edit mode ──────────────────────────
    const editBtn = e.target.closest('[data-edit-id]');
    if (editBtn) {
      const id  = editBtn.dataset.editId;
      const apt = apartments.find(a => a.id === id);
      if (!apt) return;
      const card = editBtn.closest('[data-apt-id]');
      if (!card) return;
      card.innerHTML = renderEditForm(apt);
      card.querySelector('.ef-name')?.focus();
      return;
    }

    // ── Save button: commit edits ─────────────────────────────
    const saveBtn = e.target.closest('[data-save-id]');
    if (saveBtn) {
      const id  = saveBtn.dataset.saveId;
      const idx = apartments.findIndex(a => a.id === id);
      if (idx === -1) return;
      const card = saveBtn.closest('[data-apt-id]');
      const get  = cls => card.querySelector(`.${cls}`)?.value ?? '';

      const name     = get('ef-name').trim();
      const priceVal = parseFloat(get('ef-price'));
      const sizeVal  = parseFloat(get('ef-size'));

      if (!get('ef-address').trim() || isNaN(priceVal) || isNaN(sizeVal)) {
        alert('Address, Monthly Rent, and Square Footage are required.');
        return;
      }

      const locRaw      = get('ef-loc');
      const bedsRaw     = get('ef-beds');
      const bathsRaw    = get('ef-baths');
      const urlRaw      = get('ef-url').trim();
      const photoUrlRaw = get('ef-photo-url').trim();
      const amenRaw     = get('ef-amenities');
      const feesRaw     = get('ef-fees');

      apartments[idx] = {
        ...apartments[idx],
        name,
        address:        get('ef-address').trim(),
        url:            urlRaw || '#',
        photoUrl:       photoUrlRaw || null,
        price:          priceVal,
        additionalFees: feesRaw === '' ? null : Math.max(0, parseFloat(feesRaw)),
        size:           sizeVal,
        locationScore:  locRaw   === '' ? 50 : Math.min(100, Math.max(0, parseFloat(locRaw))),
        beds:           bedsRaw  === '' ? null : parseInt(bedsRaw,  10),
        baths:          bathsRaw === '' ? null : parseFloat(bathsRaw),
        amenities:      amenRaw.split(',').map(s => s.trim()).filter(Boolean),
      };
      rerank();
      return;
    }

    // ── Cancel button: discard edits ─────────────────────────
    const cancelBtn = e.target.closest('[data-cancel-id]');
    if (cancelBtn) {
      rerank();
    }
  });

  // Tour-scheduled checkbox — update apartment in place without full re-render
  document.getElementById('results').addEventListener('change', e => {
    const cb = e.target.closest('[data-tour-id]');
    if (!cb) return;
    const apt = apartments.find(a => a.id === cb.dataset.tourId);
    if (!apt) return;
    apt.tourScheduled = cb.checked;
    // Update label styling in place (no full re-render needed)
    const label = cb.closest('.tour-row');
    if (label) label.classList.toggle('scheduled', cb.checked);
    saveState(); // persist the change
  });
}

// ── CSV Import ────────────────────────────────────────────────

/**
 * Parse a CSV string (RFC-4180) into an array of row arrays.
 * Handles quoted fields, embedded commas, and escaped double-quotes.
 */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuote = false;
  // Normalize line endings
  const chars = (text.replace(/\r\n/g, '\n').replace(/\r/g, '\n') + '\n').split('');
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (inQuote) {
      if (c === '"') {
        if (chars[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuote = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"')  { inQuote = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
  }
  return rows;
}

/**
 * Convert a parsed CSV row array (from the exported format) into an apartment object.
 * Columns: Rank,Name,Address,Neighborhood,Beds,Baths,Price,Size,LocationScore,
 *          Amenities,FinalScore,ScorePrice,ScoreSize,ScoreLoc,ScoreAmenities,URL,TourScheduled
 * Score columns are ignored — they're recomputed on load.
 */
function csvRowToApartment(headers, row) {
  const col = name => {
    const idx = headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
    return idx >= 0 ? (row[idx] ?? '').trim() : '';
  };
  const name  = col('Name');
  const price = parseFloat(col('Price ($/mo)'));
  const size  = parseFloat(col('Size (sq ft)'));
  if (isNaN(price) || isNaN(size)) return null; // skip invalid rows

  const bedsRaw     = col('Beds');
  const bathsRaw    = col('Baths');
  const feesRaw     = col('Additional Fees ($/mo)');
  const locRaw      = col('Location Score');
  const amenRaw     = col('Amenities');
  const urlRaw      = col('Listing URL');
  const photoUrlRaw = col('Photo URL');
  const tour        = col('Tour Scheduled');

  return {
    id:             `csv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    address:        col('Address'),
    neighborhood:   col('Neighborhood'),
    price,
    additionalFees: feesRaw === '' ? null : Math.max(0, parseFloat(feesRaw)),
    size,
    beds:           bedsRaw  === '' ? null : parseInt(bedsRaw,  10),
    baths:          bathsRaw === '' ? null : parseFloat(bathsRaw),
    locationScore:  locRaw   === '' ? 50   : Math.min(100, Math.max(0, parseFloat(locRaw))),
    amenities:      amenRaw ? amenRaw.split(';').map(s => s.trim()).filter(Boolean) : [],
    url:            urlRaw || '#',
    photoUrl:       photoUrlRaw || null,
    source:         'csv',
    tourScheduled:  tour.toLowerCase() === 'yes',
  };
}

/** Wire the CSV import file-upload button. */
function wireCsvImport() {
  const btn    = document.getElementById('btn-csv-import');
  const fileIn = document.getElementById('f-csv-upload');
  const status = document.getElementById('csv-import-status');

  function setStatus(type, msg) {
    status.className = `import-status ${type}`;
    status.textContent = msg;
  }

  btn.addEventListener('click', () => {
    const file = fileIn.files[0];
    if (!file) { setStatus('error', 'Choose a CSV file first.'); return; }

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows    = parseCSV(ev.target.result).filter(r => r.some(c => c.trim()));
        if (rows.length < 2) { setStatus('error', 'CSV appears empty or has no data rows.'); return; }

        const headers = rows[0];
        const parsed  = rows.slice(1).map(r => csvRowToApartment(headers, r)).filter(Boolean);
        if (parsed.length === 0) { setStatus('error', 'No valid apartment rows found. Check the file format.'); return; }

        apartments.push(...parsed);
        rerank();
        fileIn.value = '';
        setStatus('success', `Imported ${parsed.length} apartment${parsed.length !== 1 ? 's' : ''} — review below.`);
      } catch (err) {
        console.error('CSV import error:', err);
        setStatus('error', `Import failed: ${err.message}`);
      }
    };
    reader.onerror = () => setStatus('error', 'Could not read the file.');
    reader.readAsText(file);
  });
}

/** Wire the export and clear-saved buttons. */
function wireExport() {
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    exportCSV(rankApartments(apartments, getWeights()));
  });

  document.getElementById('btn-export-html').addEventListener('click', () => {
    exportHTML(rankApartments(apartments, getWeights()));
  });

  document.getElementById('btn-clear-saved').addEventListener('click', () => {
    if (!confirm('Clear all saved apartments and weights? The page will reload with sample data.')) return;
    clearSavedState();
    location.reload();
  });

  document.getElementById('btn-remove-sample').addEventListener('click', () => {
    const mockCount = apartments.filter(a => a.source === 'mock').length;
    if (mockCount === 0) { alert('No sample data found in the current list.'); return; }
    if (!confirm(`Remove ${mockCount} sample apartment${mockCount !== 1 ? 's' : ''}?`)) return;
    apartments = apartments.filter(a => a.source !== 'mock');
    rerank();
  });
}

/**
 * Dark / light mode toggle.
 * Preference is persisted to localStorage so it survives refreshes.
 * An inline <script> in <head> reads this key before paint to avoid FOUC.
 */
function wireDarkMode() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    btn.textContent = dark ? '☀ Light Mode' : '◑ Dark Mode';
    localStorage.setItem('aptRanker_darkMode', dark ? '1' : '0');
  }

  // Sync button label to whatever the FOUC script already applied
  applyTheme(document.documentElement.classList.contains('dark'));

  btn.addEventListener('click', () => {
    applyTheme(!document.documentElement.classList.contains('dark'));
  });
}


// ============================================================
// SECTION 15 — GOOGLE DRIVE SYNC
//
// Uses Google Identity Services (GIS) OAuth 2.0 token flow
// (client-side only, no backend required).
//
// One-time setup:
//   1. Go to https://console.cloud.google.com
//   2. Create a project → Enable "Google Drive API"
//   3. Create OAuth 2.0 Client ID (type: Web application)
//   4. Add your hosted URL as an Authorized JavaScript Origin
//   5. Paste the Client ID below as GOOGLE_CLIENT_ID
//
// IMPORTANT: OAuth will NOT work on file:// — host on GitHub Pages,
// Netlify, or any static host first.
//
// Data file: "apartment-ranker-data.json" in the user's Drive root
// Schema: { apartments: [...rawFields], weights: {...} }
// ============================================================

const GOOGLE_CLIENT_ID = '189076340424-0skekif1m4lo1e4f6targ0kskrmk5vtr.apps.googleusercontent.com';
const DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILENAME   = 'apartment-ranker-data.json';

let driveToken     = null;  // current GIS access token string
let driveFileId    = null;  // Drive file ID once located/created

/**
 * Show a status message in the Drive import-status banner.
 * @param {string} msg   - Text to display
 * @param {'loading'|'success'|'error'|'warn'|''} type - CSS class suffix
 */
function setDriveStatus(msg, type = '') {
  const el = document.getElementById('drive-import-status');
  if (!el) return;
  el.className = `import-status${type ? ' ' + type : ''}`;
  el.textContent = msg;
}

/**
 * Build the payload object that gets saved to Google Drive.
 * Strips computed fields (scores, rank, explanation) — only raw data persists.
 */
function buildDrivePayload() {
  return {
    apartments: apartments.map(({ scores, finalScore, rank, explanation, ...rest }) => rest),
    weights:    getWeights(),
  };
}

/**
 * Upload (create or update) the data file on Google Drive.
 * Uses multipart upload to set both metadata and content in one request.
 * @param {object} payload
 */
async function uploadToDrive(payload) {
  const body      = JSON.stringify(payload);
  const boundary  = '-------ApartmentRankerBoundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close     = `\r\n--${boundary}--`;

  const metadata  = JSON.stringify({
    name:     DRIVE_FILENAME,
    mimeType: 'application/json',
  });

  const multipartBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    metadata +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    body +
    close;

  let url, method;
  if (driveFileId) {
    // Update existing file
    url    = `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=multipart`;
    method = 'PATCH';
  } else {
    // Create new file
    url    = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    method = 'POST';
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${driveToken}`,
      'Content-Type':  `multipart/related; boundary="${boundary}"`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  driveFileId = data.id; // cache the file ID for future updates
  return data;
}

/**
 * Search Drive for the data file and return its content.
 * Returns null if no file is found.
 */
async function loadFromDrive() {
  // Search for the file by name (within files this app created)
  const q   = encodeURIComponent(`name='${DRIVE_FILENAME}' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: { 'Authorization': `Bearer ${driveToken}` } }
  );

  if (!res.ok) throw new Error(`Drive list failed (${res.status})`);

  const list = await res.json();
  if (!list.files?.length) return null;

  const fileId = list.files[0].id;
  driveFileId  = fileId;

  // Download file content
  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { 'Authorization': `Bearer ${driveToken}` } }
  );

  if (!fileRes.ok) throw new Error(`Drive download failed (${fileRes.status})`);
  return fileRes.json();
}

/**
 * Wire the Google Drive Sync UI card.
 * Initializes GIS tokenClient and hooks up Connect / Save / Load buttons.
 */
function wireDrive() {
  const btnConnect = document.getElementById('btn-drive-connect');
  const btnSave    = document.getElementById('btn-drive-save');
  const btnLoad    = document.getElementById('btn-drive-load');
  const statusEl   = document.getElementById('drive-status');

  if (!btnConnect) return; // card not present in DOM

  // If no Client ID configured, show a setup note instead
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    if (statusEl) statusEl.textContent = '⚠ Set GOOGLE_CLIENT_ID in script.js to enable sync.';
    btnConnect.disabled = true;
    btnConnect.title    = 'Paste your Google Cloud OAuth Client ID into GOOGLE_CLIENT_ID in script.js';
    return;
  }

  // Wait for GIS library to load, then create the token client
  function initTokenClient() {
    if (!window.google?.accounts?.oauth2) {
      // GIS not loaded yet — retry in 200 ms
      setTimeout(initTokenClient, 200);
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope:     DRIVE_SCOPE,
      callback:  async (resp) => {
        if (resp.error) {
          setDriveStatus(`Auth error: ${resp.error}`, 'error');
          return;
        }
        driveToken = resp.access_token;

        // Show connected state
        if (statusEl) statusEl.textContent = '✓ Connected';
        btnConnect.style.display = 'none';
        btnSave.style.display    = '';
        btnLoad.style.display    = '';
        setDriveStatus('Connected — use Save or Load below.', 'success');
      },
    });

    btnConnect.addEventListener('click', () => {
      driveToken = null; // force fresh token request
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  initTokenClient();

  // ── Save to Drive ────────────────────────────────────────────
  btnSave.addEventListener('click', async () => {
    if (!driveToken) { setDriveStatus('Not connected.', 'error'); return; }
    setDriveStatus('Saving…', 'loading');
    btnSave.disabled = true;
    try {
      await uploadToDrive(buildDrivePayload());
      setDriveStatus(`✓ Saved to Drive as "${DRIVE_FILENAME}"`, 'success');
    } catch (err) {
      console.error('Drive save error:', err);
      setDriveStatus(`Save failed: ${err.message}`, 'error');
    } finally {
      btnSave.disabled = false;
    }
  });

  // ── Load from Drive ──────────────────────────────────────────
  btnLoad.addEventListener('click', async () => {
    if (!driveToken) { setDriveStatus('Not connected.', 'error'); return; }
    setDriveStatus('Loading…', 'loading');
    btnLoad.disabled = true;
    try {
      const payload = await loadFromDrive();
      if (!payload) {
        setDriveStatus(`No file named "${DRIVE_FILENAME}" found in Drive.`, 'warn');
        return;
      }

      // Restore apartments
      if (Array.isArray(payload.apartments) && payload.apartments.length) {
        apartments = payload.apartments;
      }

      // Restore weights
      if (payload.weights) applySavedWeights(payload.weights);

      // Reset manual order (Drive file doesn't include it — use score order)
      manualOrder = null;
      localStorage.removeItem(STORAGE_KEY_ORDER);

      rerank();
      setDriveStatus(`✓ Loaded ${apartments.length} apartment(s) from Drive.`, 'success');
    } catch (err) {
      console.error('Drive load error:', err);
      setDriveStatus(`Load failed: ${err.message}`, 'error');
    } finally {
      btnLoad.disabled = false;
    }
  });
}
