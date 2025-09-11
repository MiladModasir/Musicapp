// js/library.js
import { db } from "./db.js";

/* ---------- Likes ---------- */
export async function isLiked(trackId) {
  return !!(await db.likes.where("trackId").equals(trackId).first());
}

export async function toggleLike(track) {
  // ensure we cache the track metadata so Library can render later
  await db.tracks.put(track);

  const existing = await db.likes.where("trackId").equals(track.id).first();
  if (existing) {
    await db.likes.delete(existing.id);
    return false; // now unliked
  } else {
    await db.likes.add({ trackId: track.id, addedAt: Date.now() });
    return true; // now liked
  }
}

export async function getLikedTracks() {
  const likes = await db.likes.orderBy("id").reverse().toArray();
  const ids = likes.map(l => l.trackId);
  const recs = await db.tracks.bulkGet(ids);
  // keep same order, drop nulls
  return ids.map(id => recs.find(r => r?.id === id)).filter(Boolean);
}

/* ---------- Play history (for Home / Continue listening) ---------- */
export async function recordPlay(track) {
  await db.tracks.put(track); // cache metadata
  await db.history.add({ trackId: track.id, playedAt: Date.now() });
}

export async function getRecentPlays(limit = 10) {
  const rows = await db.history.orderBy("id").reverse().limit(limit).toArray();
  const ids = rows.map(r => r.trackId);
  const recs = await db.tracks.bulkGet(ids);
  return ids.map(id => recs.find(r => r?.id === id)).filter(Boolean);
}
