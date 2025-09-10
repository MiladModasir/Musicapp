// Single global Audio() + queue

// Single global player with a tiny queue
let audio = new Audio();
audio.crossOrigin = "anonymous";
audio.addEventListener("error", () => {
  console.warn("Audio error:", audio.error, "src", audio.src)
});
let queue = [];
let index = -1;
let playing = false;
const listeners = new Set();

function emit() {
  const state = { index, track: queue[index] || null, playing, queueLength: queue.length };
  listeners.forEach(cb => cb(state));
}

export function onPlayerChange(cb) {
  listeners.add(cb);
  // push initial state to the subscriber
  cb({ index, track: queue[index] || null, playing, queueLength: queue.length });
  return () => listeners.delete(cb);
}

function loadCurrentAndPlay() {
  const t = queue[index];
  if (!t) return;
  audio.src = t.stream_url;
  audio.play()
    .then(() => { playing = true; emit(); })
    .catch(err => { console.warn("play failed:", err); playing = false; emit(); });

  // Nice touch: OS/lock-screen controls
  if ("mediaSession" in navigator && t) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist || "",
      album: t.album || "",
      artwork: t.artwork_url ? [{ src: t.artwork_url, sizes: "96x96", type: "image/png" }] : []
    });
  }
}

export function setQueue(tracks, start = 0) {
  queue = tracks.slice();
  index = Math.max(0, Math.min(start, queue.length - 1));
  if (queue.length) loadCurrentAndPlay();
  else { audio.pause(); playing = false; emit(); }
}

export function playSingle(track) {
  setQueue([track], 0);
}

export function togglePlay() {
  if (!audio.src) {
    if (queue[index]) loadCurrentAndPlay();
    return;
  }
  if (audio.paused) { audio.play(); playing = true; }
  else { audio.pause(); playing = false; }
  emit();
}

export function next() {
  if (index < queue.length - 1) { index++; loadCurrentAndPlay(); }
  else { audio.pause(); playing = false; emit(); } // repeat-off minimal
}

export function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (index > 0) { index--; loadCurrentAndPlay(); }
  else { audio.currentTime = 0; }
  emit();
}

// Autoadvance
audio.addEventListener("ended", () => next());

