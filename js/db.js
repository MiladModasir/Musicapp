// IndexedDB wrapper (for likes, playlists, history)

console.log("DB initialized");

// TODO: set up IndexedDB or Dexie
// js/db.js
export const db = new Dexie("musicAppDB");
db.version(1).stores({
  tracks: "id, title, artist, album, duration_ms, artwork_url, stream_url, license, license_url",
  likes: "++id, trackId",
  playlists: "++id, name, createdAt",
  playlistTracks: "++id, playlistId, trackId, orderIndex, addedAt",
  history: "++id, trackId, playedAt"
});

console.log("DB initialized");
