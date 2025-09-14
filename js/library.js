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
  return rows.map((r) => r.track);
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
  return rows.map((r) => r.track);
}

export async function createPlaylist(name) {
  const id = await db.playlists.add({
    name,
    createdAt: Date.now(),
    tracks: [],
  });
  return id;
}
export async function getPlaylists() {
  return db.playlists.orderBy("createdAt").reverse().toArray();
}
export async function getPlaylist(id) {
  return db.playlists.get(id);
}
export async function renamePlaylist(id, name) {
  await db.playlists.update(id, { name });
}
export async function deletePlaylist(id) {
  await db.playlists.delete(id);
}
export async function addToPlaylist(plId, track) {
  plId = Number(plId);
  const pl = await db.playlists.get(plId);
  if (!pl) throw new Error("Playlist not found");

  const tracks = Array.isArray(pl.tracks) ? [...pl.tracks] : [];

  // de-dupe by stable id
  const exists = tracks.some((t) => t.id === track.id);
  if (exists) return false;

  tracks.push(track);
  await db.playlists.update(plId, { tracks, updated_at: Date.now() });
  return true;
}

export async function removeFromPlaylist(id, trackId) {
  const pl = await db.playlists.get(id);
  if (!pl) return;
  pl.tracks = pl.tracks.filter((t) => t.id !== trackId);
  await db.playlists.put(pl);
}
