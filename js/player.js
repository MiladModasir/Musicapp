// js/player.js
import { recordPlay } from "./library.js";

const APP_NAME = "milad_music_app";
const PERSIST_KEY = "player_state_v1";

// ---------- single audio element ----------
let audio = new Audio();
audio.crossOrigin = "anonymous";
const savedVol = parseFloat(localStorage.getItem("vol"));
audio.volume = Number.isFinite(savedVol) ? savedVol : 1;

// ---------- state ----------
let queue = [];
let index = -1;
let playing = false;
let loadSeq = 0; // guards overlapping loads

// ---------- listeners / emit ----------
const listeners = new Set();

function makeSnapshot(extra = {}) {
  return {
    queue: queue.slice(),
    index,
    track: queue[index] || null,
    playing: !audio.paused && playing,
    queueLength: queue.length,
    currentTime: audio.currentTime || 0,
    duration: audio.duration || 0,
    ...extra,
  };
}
function emit(extra = {}) {
  const s = makeSnapshot(extra);
  listeners.forEach((cb) => cb(s));
  saveState(true); // throttle while emitting often (e.g., timeupdate)
}

export function onPlayerChange(cb) {
  listeners.add(cb);
  try {
    cb(makeSnapshot());
  } catch {}
  return () => listeners.delete(cb);
}

export function getSnapshot() {
  return makeSnapshot();
}

// ---------- persistence ----------
let __lastPersistMs = 0;
function saveState(throttled = false) {
  try {
    const now = Date.now();
    if (throttled && now - __lastPersistMs < 1200) return;
    __lastPersistMs = now;

    const state = {
      queue,
      index,
      position: audio.currentTime || 0,
      wasPlaying: !audio.paused && playing,
      volume: audio.volume,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
    localStorage.setItem("vol", String(audio.volume));
  } catch {}
}

async function restoreFromStorage() {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null");
  } catch {}
  if (!parsed || !Array.isArray(parsed.queue) || parsed.queue.length === 0)
    return;

  queue = parsed.queue;
  index = Math.max(0, Math.min(parsed.index ?? 0, queue.length - 1));
  if (Number.isFinite(parsed.volume)) {
    audio.volume = Math.max(0, Math.min(1, parsed.volume));
    localStorage.setItem("vol", String(audio.volume));
  }

  // Prepare current track
  const t = queue[index];
  if (!t) {
    emit();
    return;
  }

  const url = await resolveStreamUrl(t);
  // a newer load may start while restoring
  const seq = ++loadSeq;

  try {
    audio.src = url;

    // When metadata is ready, seek to the saved position
    const seekTo = Math.max(0, Number(parsed.position) || 0);
    const onMeta = () => {
      if (seq !== loadSeq) return;
      if (isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(seekTo, audio.duration);
      } else {
        audio.currentTime = seekTo;
      }
      audio.removeEventListener("loadedmetadata", onMeta);
      emit();
    };
    audio.addEventListener("loadedmetadata", onMeta);

    // Try to resume playback if it was playing
    if (parsed.wasPlaying) {
      try {
        await audio.play();
        if (seq !== loadSeq) return;
        playing = true;
        emit();
        recordPlay(t).catch(() => {});
      } catch {
        // Autoplay blocked: wait for first user gesture to resume
        playing = false;
        emit({ autoplayBlocked: true });
        const resume = () => {
          togglePlay();
          window.removeEventListener("click", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("click", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      }
    } else {
      playing = false;
      emit();
    }
  } catch {
    emit();
  }
}

// ---------- Audius helpers ----------
let __audiusHostCache = null;
async function getAudiusHost() {
  if (__audiusHostCache) return __audiusHostCache;
  try {
    const r = await fetch("https://api.audius.co");
    const { data } = await r.json();
    __audiusHostCache =
      (Array.isArray(data) && data[0]) || "https://discoveryprovider.audius.co";
  } catch {
    __audiusHostCache = "https://discoveryprovider.audius.co";
  }
  return __audiusHostCache;
}

async function resolveStreamUrl(track) {
  if (!track) return "";
  if (track.stream_url) return track.stream_url;

  const looksAudius =
    track.source === "audius" || String(track.id || "").startsWith("audius:");
  if (looksAudius) {
    const host = await getAudiusHost();
    const id = track.source_id || String(track.id).replace(/^audius:/, "");
    return `${host}/v1/tracks/${id}/stream?app_name=${APP_NAME}`;
  }
  return "";
}

// ---------- core load+play with guard ----------
async function loadCurrentAndPlay() {
  const seq = ++loadSeq;
  const t = queue[index];

  if (!t) {
    try {
      audio.pause();
    } catch {}
    playing = false;
    emit();
    return;
  }

  try {
    audio.pause();
  } catch {}

  const url = await resolveStreamUrl(t);
  if (seq !== loadSeq) return;

  try {
    audio.src = url;
    await audio.play();
    if (seq !== loadSeq) return;

    playing = true;
    emit(); // update UI immediately
    recordPlay(t).catch(() => {}); // recents -> Home refresh via event
    saveState(false);
  } catch {
    playing = false;
    emit({ error: true });
    saveState(false);
  }
}

// ---------- controls ----------
export function setQueue(tracks, start = 0) {
  queue = Array.isArray(tracks) ? tracks.slice() : [];
  index = queue.length ? Math.max(0, Math.min(start, queue.length - 1)) : -1;

  if (index >= 0) {
    loadCurrentAndPlay();
  } else {
    try {
      audio.pause();
    } catch {}
    playing = false;
    emit();
    saveState(false);
  }
}

export function playSingle(track) {
  if (!track) return;
  setQueue([track], 0);
}

export function togglePlay() {
  if (!audio.src) {
    if (index >= 0) loadCurrentAndPlay();
    return;
  }
  if (audio.paused) {
    audio
      .play()
      .then(() => {
        playing = true;
        emit();
        saveState(false);
      })
      .catch(() => {
        /* ignore */
      });
  } else {
    audio.pause();
    playing = false;
    emit();
    saveState(false);
  }
}

export function next() {
  if (index < queue.length - 1) {
    index++;
    loadCurrentAndPlay();
  } else {
    try {
      audio.pause();
    } catch {}
    playing = false;
    emit();
    saveState(false);
  }
}

export function prev() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    emit();
    saveState(true);
    return;
  }
  if (index > 0) {
    index--;
    loadCurrentAndPlay();
  } else {
    audio.currentTime = 0;
    emit();
    saveState(true);
  }
}

// ---------- seek / volume ----------
export function setVolume(v) {
  const vol = Math.max(0, Math.min(1, Number(v) || 0));
  audio.volume = vol;
  localStorage.setItem("vol", String(vol));
  saveState(true);
}

export function seek(seconds) {
  if (!isFinite(seconds) || seconds < 0) return;
  if (isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = Math.min(seconds, audio.duration);
  } else {
    audio.currentTime = seconds;
  }
  emit();
  saveState(true);
}

export function seekRatio(r) {
  const ratio = Math.max(0, Math.min(1, Number(r) || 0));
  if (isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = ratio * audio.duration;
    emit();
    saveState(true);
  }
}

// ---------- audio events ----------
audio.addEventListener("ended", () => {
  next();
});
audio.addEventListener("timeupdate", () => {
  emit();
});
audio.addEventListener("durationchange", () => {
  emit();
});
audio.addEventListener("play", () => {
  playing = true;
  emit();
  saveState(true);
});
audio.addEventListener("pause", () => {
  playing = false;
  emit();
  saveState(true);
});
audio.addEventListener("error", () => {
  emit({ error: true });
  saveState(true);
});
// helpful when restoring before metadata
audio.addEventListener("loadedmetadata", () => {
  emit();
});

// ---------- boot: try to restore last session ----------
(async () => {
  try {
    await restoreFromStorage();
  } catch {}
})();
