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


