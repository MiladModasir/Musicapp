// js/app.js — cleaned + home/search/library wired

// Imports (once)
import { searchTracks, getTrending } from "./search.js";
import {
  playSingle, onPlayerChange, togglePlay,
  next as nextTrack, prev as prevTrack, setQueue,
  seekRatio, setVolume
} from "./player.js";
import { toggleLike, getLikedTracks, getRecentPlays } from "./library.js";
import { db } from "./db.js";

// Mood chips
const MOOD_CHIPS = [
  "Podcasts", "Relax", "Sad", "Sleep", "Romance",
  "Feel good", "Energize", "Party", "Commute", "Workout", "Focus"
];

console.log("App initialized");

// Elements
const appEl = document.getElementById("app");
const input = document.getElementById("searchInput");
const nowTitleEl = document.getElementById("nowTitle");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const seekEl = document.getElementById("seek");
const currEl = document.getElementById("currTime")
const totEl = document.getElementById("totTime");
const volEl = document.getElementById("vol")
const nowCoverEl = document.getElementById("nowCover");
const nowArtistEl = document.getElementById("nowArtist")
// Footer controls
if (playPauseBtn && prevBtn && nextBtn) {
  playPauseBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", prevTrack);
  nextBtn.addEventListener("click", nextTrack);
}
// Seek by dragging (range 0–100)
seekEl?.addEventListener("input", e => {
  const pct = Number(e.target.value) / 100;
  seekRatio(pct);
});

// Volume: initialize from saved value, then update on input
const savedVol = parseFloat(localStorage.getItem("vol"));
if (volEl) volEl.value = Number.isFinite(savedVol) ? String(savedVol) : "1";
volEl?.addEventListener("input", e => {
  const v = parseFloat(e.target.value);
  setVolume(v);
});

const fmt = s => {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const sec = String (s % 60).padStart(2, "0");
  return `${m} : ${sec}`
}
const FALLBACK_COVER = 'http://www.w3.org/2000/svg width="96" height="96"><rect width="100%" height="100%" fill="%23222"/></svg>';
// Update footer on player state
onPlayerChange(({ track, playing,currentTime, duration }) => {
  if (seekEl && isFinite(duration) && duration > 0){
    seekEl.value = String((currentTime / duration) * 100);
  } else if (seekEl){
  seekEl.value = "0"
  }
  if (currEl) currEl.textContent = fmt(currentTime);
  if (totEl) totEl.textContent = isFinite(duration) ? fmt(duration) :"0:00"
  if (nowTitleEl) {
    nowTitleEl.textContent = track
      ? `${track.title} — ${track.artist || ""}`
      : "No track playing";
  }
  if (nowArtistEl) nowArtistEl.textContent = track?.artist || ""
  if (nowCoverEl) nowCoverEl.src = (track?.artwork_url && track.artwork_url.startsWith("http"))
    ? track.artwork_url : FALLBACK_COVER;
  if (playPauseBtn) playPauseBtn.textContent = playing ? "⏸" : "▶️";
});

// Utils
const debounce = (fn, ms = 350) => {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};



// -------- Search Results --------
async function renderResults(tracks) {
  const likedIds = new Set((await db.likes.toArray()).map(x => x.trackId));

  appEl.innerHTML = tracks.length
    ? `<div class="results">${tracks.map(t => `
        <div class="track">
          <img src="${t.artwork_url || ""}" width="56" height="56" />
          <div class="meta">
            <div class="title">${t.title}</div>
            <div class="artist">${t.artist || ""}</div>
            <a class="license" href="${t.license_url || "#"}" target="_blank">${t.license || ""}</a>
          </div>
          <div class="actions">
            <button class="like ${likedIds.has(t.id) ? "liked" : ""}" data-id="${t.id}" title="Like">
              ${likedIds.has(t.id) ? "❤️" : "🤍"}
            </button>
            <button class="play" data-id="${t.id}">Play</button>
          </div>
        </div>
      `).join("")}</div>`
    : `<p>No results yet. Try “lofi”, “afrobeats”, “bollywood”, “remix”.</p>`;

  // Play
  appEl.querySelectorAll(".play").forEach(btn => {
    btn.addEventListener("click", () => {
      const track = tracks.find(x => x.id === btn.dataset.id);
      if (track) playSingle(track);
    });
  });

  // Like
  appEl.querySelectorAll(".like").forEach(btn => {
    btn.addEventListener("click", async () => {
      const track = tracks.find(x => x.id === btn.dataset.id);
      const liked = await toggleLike(track);
      btn.textContent = liked ? "❤️" : "🤍";
      btn.classList.toggle("liked", liked);
    });
  });
}

const runSearch = debounce(async (term) => {
  const results = await searchTracks(term);
  console.log("results:", results.length);
  renderResults(results);
}, 400);

// Only search on the Search route
if (input) {
  input.addEventListener("input", (e) => {
    if (isSearch()) runSearch(e.target.value);
  });
}

// -------- Library (Liked) --------
async function renderLibrary() {
  const tracks = await getLikedTracks();

  appEl.innerHTML = tracks.length
    ? `<h2>Liked Songs</h2>
       <div class="actions" style="margin:8px 0;display:flex;gap:8px;">
         <button id="playAll">Play All</button>
         <button id="shuffleAll">Shuffle</button>
       </div>
       <div class="results">
         ${tracks.map(t => `
           <div class="track">
             <img src="${t.artwork_url || ""}" width="56" height="56" />
             <div class="meta">
               <div class="title">${t.title}</div>
               <div class="artist">${t.artist || ""}</div>
             </div>
             <div class="actions">
               <button class="unlike" data-id="${t.id}" title="Remove">💔</button>
               <button class="play" data-id="${t.id}">Play</button>
             </div>
           </div>
         `).join("")}
       </div>`
    : `<p>No liked songs yet. Hit 🤍 on any track to save it here.</p>`;

  // Play single
  appEl.querySelectorAll(".play").forEach(btn => {
    const track = tracks.find(x => x.id === btn.dataset.id);
    btn.addEventListener("click", () => playSingle(track));
  });

  // Un-like (remove)
  appEl.querySelectorAll(".unlike").forEach(btn => {
    const track = tracks.find(x => x.id === btn.dataset.id);
    btn.addEventListener("click", async () => {
      await toggleLike(track);
      renderLibrary();
    });
  });

  // Batch
  document.getElementById("playAll")?.addEventListener("click", () => setQueue(tracks, 0));
  document.getElementById("shuffleAll")?.addEventListener("click", () => {
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setQueue(shuffled, 0);
  });
}

// -------- Home (chips + carousels) --------
const MOOD_CONTAINER_ID = "chips";
function renderChips() {
  const chipsEl = document.getElementById(MOOD_CONTAINER_ID);
  if (!chipsEl) return;
  chipsEl.innerHTML = MOOD_CHIPS.map(t => `<span class="chip" data-term="${t}">${t}</span>`).join("");
  chipsEl.querySelectorAll(".chip").forEach(ch => {
    ch.addEventListener("click", () => {
      location.hash = "#search";
      if (input) input.value = ch.dataset.term;
      runSearch(ch.dataset.term);
    });
  });
}

function renderCarousel(title, tracks, idPrefix){
  if (!tracks.length) return "";
  return `
    <div class="section">
      <h2>${title}</h2>
      <div class="row-actions">
        <button class="arrow" data-left="${idPrefix}">◀</button>
        <button class="arrow" data-right="${idPrefix}">▶</button>
      </div>
    </div>
    <div class="carousel" id="${idPrefix}">
      ${tracks.map(t => `
        <div class="card">
          <img src="${t.artwork_url || ""}" alt="">
          <div class="title">${t.title}</div>
          <div class="sub">${t.artist || ""}</div>
          <div class="actions" style="margin-top:8px">
            <button class="play" data-id="${t.id}">Play</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function renderHome() {
  const [recent, trending] = await Promise.all([ getRecentPlays(12), getTrending(18) ]);
  appEl.innerHTML = `
    ${renderCarousel("Listen again", recent, "carousel-recent")}
    ${renderCarousel("Quick picks", trending, "carousel-trend")}
  `;

  // Play from cards
  appEl.querySelectorAll(".play").forEach(btn => {
    const id = btn.dataset.id;
    const all = [...recent, ...trending];
    const track = all.find(x => x.id === id);
    btn.addEventListener("click", () => track && playSingle(track));
  });

  // Carousel arrows
  const scrollBy = (id, dir=1) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollBy({ left: dir * 360, behavior: "smooth" });
  };
  appEl.querySelectorAll("[data-left]").forEach(b => b.addEventListener("click", () => scrollBy(b.dataset.left, -1)));
  appEl.querySelectorAll("[data-right]").forEach(b => b.addEventListener("click", () => scrollBy(b.dataset.right, 1)));
}

// -------- Router --------
// Router helpers
const currentRoute = () => (location.hash || "#home").toLowerCase();
const isHome    = () => currentRoute() === "#home";
const isSearch  = () => currentRoute().startsWith("#search");
const isLibrary = () => currentRoute().startsWith("#library");

function renderRoute(){
  if (isLibrary()) { renderLibrary(); return; }
  if (currentRoute().startsWith("#search")) {
    const term = (input?.value || "").trim();
    term.length >= 2 ? runSearch(term) : (appEl.innerHTML = `<p>Type to search…</p>`);
    return;
  }
  renderHome(); // default -> Home
}

window.addEventListener("hashchange", renderRoute);
renderRoute();      // boot
renderChips();  


/* ---------- Keyboard shortcuts (add below this line) ---------- */
let lastState = { currentTime: 0, duration: 0 };
onPlayerChange(s => { lastState = s; });

const seekBy = (sec) => {
  if (lastState.duration > 0) {
    const next = Math.max(0, Math.min(lastState.currentTime + sec, lastState.duration));
    const ratio = next / lastState.duration;
    seekRatio(ratio);
  }
};

const setVolBoth = (v) => {
  v = Math.max(0, Math.min(1, v));
  setVolume(v);
  if (volEl) volEl.value = String(v);
};

window.addEventListener("keydown", (e) => {
  // don’t hijack typing in inputs
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  switch (e.key) {
    case " ": case "k": case "K":
      e.preventDefault();
      togglePlay();
      break;
    case "j": case "J": seekBy(-5); break;
    case "l": case "L": seekBy(+5); break;
    case "ArrowLeft":  seekBy(-2); break;
    case "ArrowRight": seekBy(+2); break;
    case "ArrowUp":    setVolBoth((parseFloat(volEl?.value || "1") || 1) + 0.05); break;
    case "ArrowDown":  setVolBoth((parseFloat(volEl?.value || "1") || 1) - 0.05); break;
  }
});
