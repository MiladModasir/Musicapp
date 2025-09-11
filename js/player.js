// js/player.js — single global player + retry + history + seek/volume
import { recordPlay } from "./library.js";

const APP_NAME = "milad_music_app";

// ---- Audio + initial volume
let audio = new Audio();
audio.crossOrigin = "anonymous";
const savedVol = parseFloat(localStorage.getItem("vol"));
audio.volume = Number.isFinite(savedVol) ? savedVol : 1;

// ---- State
let queue = [];
let index = -1;
let playing = false;

const listeners = new Set();
function emit(extra = {}) {
  const state = {
    index,
    track: queue[index] || null,
    playing: !audio.paused && playing,
    queueLength: queue.length,
    currentTime: audio.currentTime || 0,
    duration: audio.duration || 0,
    ...extra,
  };
  listeners.forEach(cb => cb(state));
}

export function onPlayerChange(cb) {
  listeners.add(cb);
  cb({
    index,
    track: queue[index] || null,
    playing: !audio.paused && playing,
    queueLength: queue.length,
    currentTime: audio.currentTime || 0,
    duration: audio.duration || 0,
  });
  return () => listeners.delete(cb);
}

async function getAudiusHost() {
  try {
    const r = await fetch("https://api.audius.co");
    const { data } = await r.json();
    if (Array.isArray(data) && data.length) {
      return data[Math.floor(Math.random() * data.length)];
    }
  } catch {}
  return "https://discoveryprovider.audius.co";
}

async function resolveStreamUrl(track) {
  if (!track) return "";
  if (track.source === "audius") {
    const host = await getAudiusHost();
    const id = track.source_id || String(track.id).replace("audius:", "");
    return `${host}/v1/tracks/${id}/stream?app_name=${APP_NAME}`;
  }
  return track.stream_url; // Jamendo etc.
}

async function loadCurrentAndPlay() {
  const t = queue[index];
  if (!t) { audio.pause(); playing = false; emit(); return; }

  // Media Session metadata
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist || "",
        album: t.album || "",
        artwork: t.artwork_url ? [{ src: t.artwork_url, sizes: "96x96", type: "image/png" }] : [],
      });
    } catch {}
  }

  // Try 1
  audio.src = await resolveStreamUrl(t);
  try {
    await audio.play();
    playing = true;
    emit();
    recordPlay(t).catch(() => {});
    return;
  } catch (e1) {
    console.warn("play failed on first host, retrying…", e1);
  }

  // Retry once for Audius
  if (t.source === "audius") {
    audio.src = await resolveStreamUrl(t);
    try {
      await audio.play();
      playing = true;
      emit();
      recordPlay(t).catch(() => {});
      return;
    } catch (e2) {
      console.warn("retry failed:", e2);
    }
  }

  playing = false;
  emit();
}

export function setQueue(tracks, start = 0) {
  queue = Array.isArray(tracks) ? tracks.slice() : [];
  index = queue.length ? Math.max(0, Math.min(start, queue.length - 1)) : -1;
  if (index >= 0) loadCurrentAndPlay();
  else { audio.pause(); playing = false; emit(); }
}

export function playSingle(track) {
  if (!track) return;
  setQueue([track], 0);
}

export function togglePlay() {
  if (!audio.src) { if (index >= 0) loadCurrentAndPlay(); return; }
  if (audio.paused) {
    audio.play().then(() => { playing = true; emit(); }).catch(e => console.warn("play err:", e));
  } else {
    audio.pause(); playing = false; emit();
  }
}

export function next() {
  if (index < queue.length - 1) { index++; loadCurrentAndPlay(); }
  else { audio.pause(); playing = false; emit(); } // no repeat (MVP)
}

export function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; emit(); return; }
  if (index > 0) { index--; loadCurrentAndPlay(); }
  else { audio.currentTime = 0; emit(); }
}

// ---- Seek / Volume helpers
export function setVolume(v) {
  const vol = Math.max(0, Math.min(1, Number(v) || 0));
  audio.volume = vol;
  localStorage.setItem("vol", String(vol));
}

export function seek(seconds) {
  if (!isFinite(seconds) || seconds < 0) return;
  if (isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = Math.min(seconds, audio.duration);
  } else {
    audio.currentTime = seconds;
  }
}

export function seekRatio(r) {
  const ratio = Math.max(0, Math.min(1, Number(r) || 0));
  if (isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = ratio * audio.duration;
  }
}

// ---- Events
audio.addEventListener("ended", () => next());
audio.addEventListener("timeupdate", () => emit());
audio.addEventListener("durationchange", () => emit());
audio.addEventListener("play", () => { playing = true; emit(); });
audio.addEventListener("pause", () => { playing = false; emit(); });
audio.addEventListener("error", () => {
  console.warn("Audio error:", audio.error, "src:", audio.src);
  emit({ error: true });
});
