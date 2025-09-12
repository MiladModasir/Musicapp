// js/search.js
// If you later add a Jamendo key, set it here and the code will use Jamendo first.
const JAMENDO_CLIENT_ID = "YOUR_JAMENDO_CLIENT_ID"; 
// js/search.js
const APP_NAME = "milad_music_app";

async function getAudiusHost() {
  try {
    const r = await fetch("https://api.audius.co");
    const { data } = await r.json();
    return (Array.isArray(data) && data[0]) || "https://discoveryprovider.audius.co";
  } catch {
    return "https://discoveryprovider.audius.co";
  }
}

function normalizeAudius(track, host) {
  const art =
    track.artwork?.["150x150"] ||
    track.artwork?.["480x480"] ||
    track.user?.profile_picture?.["150x150"] ||
    "";
  return {
    id: `audius:${track.id}`,
    source: "audius",
    source_id: String(track.id),
    title: track.title,
    artist: track.user?.name || "",
    album: "",
    duration_ms: (track.duration || 0) * 1000,
    artwork_url: typeof art === "string" && art.startsWith("http") ? art : "",
    // guaranteed playable stream on same host
    stream_url: `${host}/v1/tracks/${track.id}/stream?app_name=${APP_NAME}`,
    license: "",
    license_url: ""
  };
}

/** Search tracks by text */
export async function searchTracks(term, limit = 20) {
  term = (term || "").trim();
  if (term.length < 2) return [];
  const host = await getAudiusHost();
  const url = `${host}/v1/tracks/search?query=${encodeURIComponent(term)}&limit=${limit}&app_name=${APP_NAME}`;
  console.log("Using Audius:", url);
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const items = json.data || [];
  return items.map(t => normalizeAudius(t, host));
}

/** Trending feed for Home */
export async function getTrending(limit = 12) {
  const host = await getAudiusHost();
  const url = `${host}/v1/tracks/trending?limit=${limit}&app_name=${APP_NAME}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const { data } = await res.json();
  return (data || []).map(t => normalizeAudius(t, host));
}