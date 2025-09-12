// js/player.js
const APP_NAME = "milad_music_app";
import { recordPlay } from "./library.js";

// ---- single audio element
let audio = new Audio();
audio.crossOrigin = "anonymous";
const savedVol = parseFloat(localStorage.getItem("vol"));
audio.volume = Number.isFinite(savedVol) ? savedVol : 1;

// ---- state
let queue = [];
let index = -1;
let playing = false;
let loadSeq = 0;              // guards overlapping loads

// ---- listeners/emit
const listeners = new Set();
function emit(extra = {}) {
  const state = {
    queue,
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
  cb(getSnapshot());          // push initial snapshot
  return () => listeners.delete(cb);
}

export function getSnapshot() {
  return {
    queue: queue.slice(),
    index,
    track: queue[index] || null,
    playing: !audio.paused && playing,
    currentTime: audio.currentTime || 0,
    duration: audio.duration || 0,
  };
}

// ---- stream URL helpers
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
    const id = track.source_id || String(track.id).replace(/^audius:/, "");
    return `${host}/v1/tracks/${id}/stream?app_name=${APP_NAME}`;
  }
  // Jamendo (etc.) already provides direct mp3 url
  return track.stream_url;
}

// ---- core load+play with guard
async function loadCurrentAndPlay() {
  const seq = ++loadSeq;
  const t = queue[index];
  if (!t) { try { audio.pause(); } catch {}; playing = false; emit(); return; }

  try { audio.pause(); } catch {}
  const url = await resolveStreamUrl(t);
  if (seq !== loadSeq) return;

  audio.src = url;
  try {
    await audio.play();  
    recordPlay(t).catch(() => {});                // ← when this resolves, the track actually started
    if (seq !== loadSeq) return;    
    playing = true;
    emit();
  } catch (e) {
    // handle aborted/failed play
    playing = false;
    emit({ error: true });
  }
}


// ---- controls
export function setQueue(tracks, start = 0) {
  queue = Array.isArray(tracks) ? tracks.slice() : [];
  index = queue.length ? Math.max(0, Math.min(start, queue.length - 1)) : -1;
  if (index >= 0) loadCurrentAndPlay();
  else {
    try { audio.pause(); } catch {}
    playing = false;
    emit();
  }
}

export function playSingle(track) {
  if (!track) return;
  setQueue([track], 0);
}

export function togglePlay() {
  if (!audio.src) { if (index >= 0) loadCurrentAndPlay(); return; }
  if (audio.paused) {
    audio.play().then(() => { playing = true; emit(); })
                .catch(e => console.warn("play err:", e));
  } else {
    audio.pause();
    playing = false;
    emit();
  }
}

export function next() {
  if (index < queue.length - 1) { index++; loadCurrentAndPlay(); }
  else { try { audio.pause(); } catch {}; playing = false; emit(); }
}

export function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; emit(); return; }
  if (index > 0) { index--; loadCurrentAndPlay(); }
  else { audio.currentTime = 0; emit(); }
}

// ---- seek / volume
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

// ---- events
audio.addEventListener("ended", () => next());
audio.addEventListener("timeupdate", () => emit());
audio.addEventListener("durationchange", () => emit());
audio.addEventListener("play",  () => { playing = true;  emit(); });
audio.addEventListener("pause", () => { playing = false; emit(); });
audio.addEventListener("error", () => {
  console.warn("Audio error:", audio.error, "src:", audio.src);
  emit({ error: true });
});
