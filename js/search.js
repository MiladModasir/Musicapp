// js/search.js
// If you later add a Jamendo key, set it here and the code will use Jamendo first.
const JAMENDO_CLIENT_ID = "YOUR_JAMENDO_CLIENT_ID"; 
const APP_NAME = "milad_music_app";

function hasJamendoKey() {
  return JAMENDO_CLIENT_ID &&
         !/YOUR_JAMENDO_CLIENT_ID|YOUR_REAL_CLIENT_ID|paste/i.test(JAMENDO_CLIENT_ID);
}

async function getAudiusHost() {
  try {
    const r = await fetch("https://api.audius.co");
    const { data } = await r.json();
    return (Array.isArray(data) && data[0]) || "https://discoveryprovider.audius.co";
  } catch {
    return "https://discoveryprovider.audius.co";
  }
}

export async function searchTracks(term, limit = 20) {
  term = (term || "").trim();
  if (term.length < 2) return [];

  // ---- Use Jamendo if you paste a real key later ----
  if (hasJamendoKey()) {
    const params = new URLSearchParams({
      client_id: JAMENDO_CLIENT_ID,
      format: "json",
      limit: String(limit),
      search: term,
      include: "musicinfo+licenses",
      fuzzysearch: "1",
      audioformat: "mp31",
    });
    const url = `https://api.jamendo.com/v3.0/tracks/?${params.toString()}`;
    console.log("Using Jamendo:", url);
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.results || [];
    return items.map(t => ({
      id: `jamendo:${t.id}`,
      source: "jamendo",
      source_id: String(t.id),
      title: t.name,
      artist: t.artist_name,
      album: t.album_name,
      duration_ms: (t.duration || 0) * 1000,
      artwork_url: t.image || "",
      stream_url: t.audio, // direct
      license: t.license || "",
      license_url: t.license_ccurl || ""
    }));
  }

  // ---- Audius fallback (no key needed) ----
  const host = await getAudiusHost();
  const url = `${host}/v1/tracks/search?query=${encodeURIComponent(term)}&limit=${limit}&app_name=${APP_NAME}`;
  console.log("Using Audius:", url);
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const items = json.data || [];

  // IMPORTANT: build a guaranteed playable stream URL yourself
  return items.map(t => {
    const artwork =
      t.artwork?.["150x150"] ||
      t.artwork?.["480x480"] ||
      t.user?.profile_picture?.["150x150"] ||
      "";

    return {
      id: `audius:${t.id}`,
      source: "audius",
      source_id: String(t.id),
      title: t.title,
      artist: t.user?.name || "",
      album: "",
      duration_ms: (t.duration || 0) * 1000,
      artwork_url: (typeof artwork === "string" && artwork.startsWith("http")) ? artwork : "",
      // This endpoint is the correct way to stream from Audius:
      stream_url: `${host}/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`,
      license: "",
      license_url: ""
    };
  });
}
