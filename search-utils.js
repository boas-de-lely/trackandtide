/**
 * Track & Tide — Shared Search Utilities
 * Provides normalized, fuzzy, and city-grouped search across all pages.
 */

/**
 * Normalize text for search: strip diacritics, handle special letters, lowercase.
 * "München" → "munchen", "Gdańsk" → "gdansk", "Århus" → "arhus"
 */
function normalizeForSearch(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip combining diacritics
    .replace(/ø/g, 'o').replace(/Ø/g, 'O')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/ð/g, 'd').replace(/Ð/g, 'D')
    .replace(/þ/g, 'th').replace(/Þ/g, 'TH')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/ħ/g, 'h').replace(/Ħ/g, 'H')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ĳ/g, 'ij').replace(/Ĳ/g, 'IJ')
    .toLowerCase();
}

/**
 * Levenshtein edit distance between two strings.
 * Returns the minimum number of single-character edits (insert, delete, substitute).
 */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Optimize: use shorter string as inner dimension
  if (a.length > b.length) { var t = a; a = b; b = t; }

  var aLen = a.length, bLen = b.length;
  // Single-row optimization
  var row = new Array(aLen + 1);
  for (var i = 0; i <= aLen; i++) row[i] = i;

  for (var j = 1; j <= bLen; j++) {
    var prev = row[0];
    row[0] = j;
    var bChar = b.charAt(j - 1);
    for (var i = 1; i <= aLen; i++) {
      var substCost = a.charAt(i - 1) === bChar ? prev : prev + 1;
      prev = row[i];
      row[i] = Math.min(row[i] + 1, row[i - 1] + 1, substCost);
    }
  }
  return row[aLen];
}

/**
 * Score how well a query matches a target string (both pre-normalized).
 * Returns 0-100, higher = better match. Useful for ranking fuzzy results.
 */
function fuzzyMatchScore(normQuery, normTarget) {
  if (!normQuery || !normTarget) return 0;

  // Exact match
  if (normTarget === normQuery) return 100;

  // Starts with query
  if (normTarget.startsWith(normQuery)) return 90;

  // Contains query as substring
  if (normTarget.includes(normQuery)) return 80;

  // Token-based matching
  var qWords = normQuery.split(/\s+/).filter(function(w) { return w.length >= 2; });
  var tWords = normTarget.split(/\s+/).filter(Boolean);

  if (!qWords.length || !tWords.length) return 0;

  var bestScore = 0;
  for (var qi = 0; qi < qWords.length; qi++) {
    var qw = qWords[qi];
    for (var ti = 0; ti < tWords.length; ti++) {
      var tw = tWords[ti];
      if (tw === qw) { bestScore = Math.max(bestScore, 70); continue; }
      if (tw.startsWith(qw)) { bestScore = Math.max(bestScore, 60); continue; }
      if (tw.includes(qw)) { bestScore = Math.max(bestScore, 50); continue; }

      // Levenshtein for typo tolerance (only for words ≥ 3 chars)
      if (qw.length >= 3 && tw.length >= 3 && Math.abs(qw.length - tw.length) <= 2) {
        var dist = levenshtein(qw, tw);
        if (dist === 1) bestScore = Math.max(bestScore, 40);
        else if (dist === 2) bestScore = Math.max(bestScore, 30);
      }
    }
  }
  return bestScore;
}

/**
 * Smart search over a list of items. Supports diacritic normalization, 
 * substring matching, and fuzzy/typo-tolerant matching.
 *
 * @param {string} query - Raw user input
 * @param {Array} items - Array of items to search
 * @param {Function} getHaystack - Function(item) → string to search in
 * @param {Object} options
 * @param {number} options.maxResults - Max results (default 500)
 * @param {number} options.minQueryLength - Min query chars to trigger fuzzy (default 3)
 * @param {number} options.fuzzyThreshold - Only enable fuzzy if substring results < this (default 5)
 * @returns {Array} Filtered & scored items, best matches first
 */
function smartSearch(query, items, getHaystack, options) {
  options = options || {};
  var maxResults = options.maxResults || 500;
  var minQueryLength = options.minQueryLength || 2;
  var fuzzyThreshold = options.fuzzyThreshold || 5;

  if (!query || query.length < minQueryLength) return items.slice(0, maxResults);

  var q = normalizeForSearch(query);

  // Pass 1: fast normalized substring match
  var substringMatches = [];
  var seen = {};
  for (var i = 0; i < items.length; i++) {
    var h = normalizeForSearch(getHaystack(items[i]));
    if (h.indexOf(q) !== -1) {
      var key = getHaystack(items[i]);
      if (!seen[key]) { seen[key] = true; substringMatches.push({ item: items[i], score: h === q ? 100 : (h.startsWith(q) ? 90 : 80) }); }
    }
  }

  // If we have enough substring matches, just return them sorted
  if (substringMatches.length >= fuzzyThreshold) {
    return substringMatches
      .sort(function(a, b) { return b.score - a.score; })
      .slice(0, maxResults)
      .map(function(m) { return m.item; });
  }

  // Pass 2: fuzzy matching for remaining items
  var qWords = q.split(/\s+/).filter(function(w) { return w.length >= 3; });
  var fuzzyMatches = [];

  for (var i = 0; i < items.length; i++) {
    var h = normalizeForSearch(getHaystack(items[i]));
    var key = getHaystack(items[i]);
    if (seen[key]) continue; // Already matched

    var score = fuzzyMatchScore(q, h);
    if (score >= 30) {
      fuzzyMatches.push({ item: items[i], score: score });
      seen[key] = true;
    }
  }

  // Combine and sort by score
  return substringMatches.concat(fuzzyMatches)
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, maxResults)
    .map(function(m) { return m.item; });
}

/**
 * Extract the city name from a station name.
 * e.g. "Paris Nord" → "paris", "Amsterdam Centraal" → "amsterdam",
 * "Frankfurt (Main) Hbf" → "frankfurt", "Köln Messe/Deutz" → "koln"
 */
function extractCityFromStation(name) {
  var n = normalizeForSearch(name);
  // Remove common station suffixes first
  n = n.replace(/\s+(hauptbahnhof|hbf|central|centraal|centrale|termini|terminus|centralstation|sentrum|stasjon|station|gare|bahnhof|estacio|estacao|stazione|halt|haltepunkt|railway|train|spoorwegstation|treinstation|jernbanestation|bergstation|talstation|turiststation)(\s|$)/gi, ' ');
  // Remove parentheticals
  n = n.replace(/\([^)]*\)/g, ' ');
  // Remove "st.", "s.", "sankt" prefixes
  n = n.replace(/^(st|s|sankt|san)\s+/i, '');
  // Take the first meaningful word(s) before any comma, slash, or dash
  n = n.split(/[,/–—-]/)[0];
  // Take first 2 words max for compound city names
  var words = n.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return normalizeForSearch(name);
  // For compound names like "Frankfurt am Main", take up to 3 words
  if (words.length >= 3 && ['am','an','im','in','de','da','di','del','della','delle','sur','en','ob','van','der','den'].indexOf(words[1].toLowerCase()) !== -1) {
    return words.slice(0, 3).join(' ');
  }
  if (words.length >= 2 && ['am','an','im','in','de','da','di','del','della','delle','sur','en','ob','van','der','den'].indexOf(words[1].toLowerCase()) !== -1) {
    return words.slice(0, 3).join(' ');
  }
  return words[0];
}

/**
 * Group stations by city. Returns an array where stations from the same city
 * are nested under a city group. Cities with only 1 station are kept as flat entries.
 *
 * @param {Array} stations - Array of station objects with at least { name, id }
 * @param {number} maxPerGroup - Max individual stations to show under a group before "show all" (default 8)
 * @returns {Array} - Mixed array of { type:'group', city, stations, count } and station objects
 */
function groupStationsByCity(stations, maxPerGroup) {
  maxPerGroup = maxPerGroup || 8;
  if (!stations || !stations.length) return [];

  var groups = {};
  var order = [];

  for (var i = 0; i < stations.length; i++) {
    var s = stations[i];
    var city = extractCityFromStation(s.name);
    if (!groups[city]) {
      groups[city] = { city: city, stations: [], displayName: '' };
      order.push(city);
    }
    groups[city].stations.push(s);
  }

  var result = [];
  for (var j = 0; j < order.length; j++) {
    var g = groups[order[j]];
    if (g.stations.length === 1) {
      result.push(g.stations[0]);
    } else {
      // Find the prettiest display name from the stations
      var names = g.stations.map(function(s) { return s.name; });
      // Use the shortest clean name as city display
      var displayName = names.reduce(function(a, b) { return a.length <= b.length ? a : b; });
      // Clean it further
      displayName = cleanStationName(displayName);
      result.push({
        type: 'group',
        city: g.city,
        displayName: displayName,
        stations: g.stations.slice(0, maxPerGroup),
        totalCount: g.stations.length,
        collapsed: true
      });
    }
  }
  return result;
}
// Dummy escapeHTML (pages that define their own will keep theirs)
if (typeof escapeHTML === 'undefined') {
  escapeHTML = function(text) {
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  };
}
// Dummy cleanStationName (pages that define their own will override this)
if (typeof cleanStationName === 'undefined') {
  cleanStationName = function(name) {
    return String(name)
      .replace(/hauptbahnhof$/i, '').replace(/treinstation$/i, '')
      .replace(/spoorwegstation$/i, '').replace(/turiststation$/i, '')
      .replace(/jernbanestation$/i, '').replace(/bahnhof$/i, '')
      .replace(/bergstation$/i, '').replace(/talstation$/i, '')
      .replace(/haltepunkt$/i, '')
      .replace(/\s+Railway\s+Station$/i, '')
      .replace(/\s+Train\s+Station$/i, '')
      .replace(/\s+Railway$/i, '').replace(/\s+Station$/i, '')
      .replace(/\s+Halt$/i, '').replace(/\s+Gare$/i, '')
      .replace(/\s+Estaci[oó]n$/i, '').replace(/\s+Stazione$/i, '')
      .replace(/\s+Esta[cç][aã]o$/i, '')
      .replace(/駅$/g, '').replace(/站$/g, '').replace(/火车站$/g, '')
      .replace(/\s+/g, ' ').trim();
  };
}

/**
 * Boolean fuzzy match: returns true if query approximately matches target.
 * Wraps fuzzyMatchScore — uses the same tolerant matching (subsequence, edit distance).
 *
 * Examples:
 *   fuzzyMatch("amstrdam", "amsterdam")   → true
 *   fuzzyMatch("amstrdem", "amsterdam")   → true (edit distance 2)
 *   fuzzyMatch("munchen", "münchen")       → true (after normalization)
 *   fuzzyMatch("rotterdam", "rotterdam")   → true (exact)
 */
function fuzzyMatch(query, target) {
  return fuzzyMatchScore(query, target) >= 30;
}

/**
 * Check if a normalized query appears in a normalized haystack.
 * Uses exact match first, then fuzzy match as fallback.
 * The haystack can be a long joined string ("name country operators ...").
 */
function matchInHaystack(query, haystack) {
  if (!query || !haystack) return false;
  // Fast path: exact substring
  if (haystack.indexOf(query) !== -1) return true;
  // Fallback: fuzzy match via fuzzyMatchScore
  return fuzzyMatchScore(query, haystack) >= 30;
}
