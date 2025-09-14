import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs";

export const db = new Dexie("music_app_db");
db.version(2).stores({
  likes: "trackId, ts",
  recents: "id, ts",
  // simple embedded tracks to avoid joins
  playlists: "++id, name, createdAt",
});
