// db.js  (browser ESM, no bundler)
import Dexie from "https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs";

export const db = new Dexie("music_app_v2"); // fresh name avoids old schema conflicts
db.version(1).stores({
  likes:   "trackId, ts",   // primary key = trackId
  recents: "id, ts"         // primary key = id
});

console.log("DB initialized:", db.name);

if (typeof window !== 'undefined') {
  window.db = db; // dev-only helper so you can run: await db.likes.toArray()
}
