// library.js
import { db } from "./db.js";

/**
 * Like/unlike a track.
 * Returns true if now liked, false if unliked.
 */
export async function toggleLike(track) {
  if (!track?.id) return false;
  const id = track.id;

  // primary key is trackId (see db.js schema)
  const existing = await db.likes.get(id);
  if (existing) {
    await db.likes.delete(id);
    return false;
  } else {
    await db.likes.put({ trackId: id, ts: Date.now(), track });
    return true;
  }
}

/**
 * Get liked tracks (newest first)
 */
export async function getLikedTracks() {
  const rows = await db.likes.orderBy("ts").reverse().toArray();
  return rows.map(r => r.track);
}

/**
 * Record a play so Home → Continue listening updates.
 */
export async function recordPlay(track) {
  if (!track?.id) return;
  await db.recents.put({ id: track.id, ts: Date.now(), track });
  // tell Home to refresh if user is on it
  window.dispatchEvent(new Event("recents-updated"));
}

/**
 * Get recent plays (newest first)
 */
export async function getRecentPlays(limit = 12) {
  const rows = await db.recents.orderBy("ts").reverse().limit(limit).toArray();
  return rows.map(r => r.track);
}
