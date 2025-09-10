// js/app.js — CLEAN VERSION

// Imports (only once)
import { db } from "./db.js";
import { searchTracks } from "./search.js";
import {
  playSingle,
  onPlayerChange,
  togglePlay,
  next as nextTrack,
  prev as prevTrack,
} from "./player.js";

// ---- Dev boot log
console.log("App initialized");

// ---- Elements
const appEl = document.getElementById("app");
const input = document.getElementById("searchInput");

// Footer controls (make sure these exist in index.html footer)
const nowTitleEl = document.getElementById("nowTitle");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// Guard in case footer not wired yet
if (playPauseBtn && prevBtn && nextBtn) {
  playPauseBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", prevTrack);
  nextBtn.addEventListener("click", nextTrack);
}

// Update footer when player state changes
onPlayerChange(({ track, playing }) => {
  if (nowTitleEl) {
    nowTitleEl.textContent = track
      ? `${track.title} — ${track.artist || ""}`
      : "No track playing";
  }
  if (playPauseBtn) playPauseBtn.textContent = playing ? "⏸" : "▶️";
});

// ---- Small utilities
const debounce = (fn, ms = 350) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// ---- Rendering
function renderResults(tracks) {
  appEl.innerHTML = tracks.length
    ? `<div class="results">${tracks
        .map(
          (t) => `
        <div class="track">
          <img src="${t.artwork_url || ""}" width="56" height="56" />
          <div class="meta">
            <div class="title">${t.title}</div>
            <div class="artist">${t.artist || ""}</div>
            <a class="license" href="${t.license_url || "#"}" target="_blank">
              ${t.license || ""}
            </a>
          </div>
          <button class="play" data-id="${t.id}">Play</button>
        </div>`
        )
        .join("")}</div>`
    : `<p>No results yet. Try “lofi”, “afrobeats”, “bollywood”, “remix”.</p>`;

  // Wire play buttons
  appEl.querySelectorAll(".play").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const track = tracks.find((x) => x.id === id);
      if (track) playSingle(track);
    });
  });
}

// ---- Search flow
const runSearch = debounce(async (term) => {
  const results = await searchTracks(term);
  console.log("results:", results.length);
  renderResults(results);
}, 400);

// Hook input once
if (input) {
  input.addEventListener("input", (e) => runSearch(e.target.value));
}

// ---- Minimal hash router (optional: can expand later)
function renderRoute() {
  const route = location.hash || "#home";
  // For now we keep it simple; you can switch views here later
  // Example: if (route.startsWith("#library")) { ... }
  console.log("Route:", route);
}
window.addEventListener("hashchange", renderRoute);
renderRoute();

// ---- Dev test for IndexedDB (safe to remove later)
(async () => {
  await db.likes.add({ trackId: "jamendo:123" });
  const rows = await db.likes.toArray();
  console.log("likes:", rows);
})();
