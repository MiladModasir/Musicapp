// js/search.js
// --------------------------------------------
// Feeds: Audius (primary), Jamendo (optional)
// Exports: searchTracks(term), getTrending(limit)
// --------------------------------------------

const APP_NAME = "milad_music_app";

// If you have a Jamendo key, put it here; else leave "" and we’ll skip Jamendo.
const JAMENDO_CLIENT_ID = ""; // e.g. "YOUR_REAL_KEY_HERE"

// ---- helpers -------------------------------------------------

let __audiusHostCache = null;
async function getAudiusHost() {
  if (__audiusHostCache) return __audiusHostCache;
  try {
    const r = await fetch("https://api.audius.co");
    const { data } = await r.json();
    __audiusHostCache = (Array.isArray(data) && data[0]) || "https://discoveryprovider.audius.co";
  } catch {
    __audiusHostCache = "https://discoveryprovider.audius.co";
  }
  return __audiusHostCache;
}

const pickAudiusArt = (artObj, userPicObj) =>
  (artObj?.["1000x1000"] || artObj?.["480x480"] || artObj?.["150x150"] ||
   userPicObj?.["1000x1000"] || userPicObj?.["480x480"] || userPicObj?.["150x150"] || "");

// Basic safe fetch with small timeout (avoids hanging UIs)
async function safeFetchJson(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- normalizers --------------------------------------------

function normalizeAudius(track, host) {
  const art = pickAudiusArt(track.artwork, track.user?.profile_picture);
  return {
    id: `audius:${track.id}`,
    source: "audius",
    source_id: String(track.id),
    title: track.title || "",
    artist: track.user?.name || "",
    album: "",
    duration_ms: (Number(track.duration) || 0) * 1000,
    artwork_url: typeof art === "string" && art.startsWith("http") ? art : "",
    // we provide a stream so play works even if player.js doesn't resolve
    stream_url: `${host}/v1/tracks/${track.id}/stream?app_name=${APP_NAME}`,
    license: "",
    license_url: ""
  };
}

function normalizeJamendo(item) {
  return {
    id: `jamendo:${item.id}`,
    source: "jamendo",
    source_id: String(item.id),
    title: item.name || "",
    artist: item.artist_name || "",
    album: item.album_name || "",
    duration_ms: (Number(item.duration) || 0) * 1000,
    // Jamendo lets us request larger images via imagesize=600 in the query
    artwork_url: item.image || "",
    stream_url: item.audio || "",
    license: item.license || "",
    license_url: item.license_ccurl || ""
  };
}

// ---- Audius API wrappers ------------------------------------

async function audiusTrending(limit = 12) {
  const host = await getAudiusHost();
  const url = `${host}/v1/tracks/trending?limit=${encodeURIComponent(limit)}&app_name=${APP_NAME}`;
  const json = await safeFetchJson(url);
  const data = json?.data || [];
  return data.map(t => normalizeAudius(t, host));
}

async function audiusSearch(query, limit = 20) {
  const host = await getAudiusHost();
  const url = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}&app_name=${APP_NAME}`;
  const json = await safeFetchJson(url);
  const data = json?.data || [];
  return data.map(t => normalizeAudius(t, host));
}

// ---- Jamendo API wrapper (optional) --------------------------

async function jamendoSearch(query, limit = 20) {
  if (!JAMENDO_CLIENT_ID) return []; // no key → skip
  const url =
    `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(JAMENDO_CLIENT_ID)}` +
    `&format=json&limit=${encodeURIComponent(limit)}&search=${encodeURIComponent(query)}` +
    `&include=musicinfo+licenses&fuzzysearch=1&audioformat=mp31&imagesize=600`;
  const json = await safeFetchJson(url);
  const items = json?.results || [];
  return items.map(normalizeJamendo);
}

// ---- Public API ---------------------------------------------

/**
 * searchTracks(term): returns a combined, de-duped list from Audius (+ Jamendo if key set)
 */
export async function searchTracks(term, limit = 20) {
  const q = String(term || "").trim();
  if (!q) return [];

  // run both in parallel (Jamendo may be disabled and return [])
  const [audius, jamendo] = await Promise.all([
    audiusSearch(q, limit).catch(() => []),
    jamendoSearch(q, Math.max(0, Math.floor(limit / 2))).catch(() => [])
  ]);

  // de-dupe by id
  const map = new Map();
  [...audius, ...jamendo].forEach(t => { if (t?.id) map.set(t.id, t); });
  return Array.from(map.values());
}

/**
 * getTrending(limit): Audius trending feed
 */
export async function getTrending(limit = 18) {
  return await audiusTrending(limit).catch(() => []);
}
