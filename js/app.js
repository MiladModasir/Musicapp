import { searchTracks, getTrending } from "./search.js";
import {
  playSingle,
  onPlayerChange,
  togglePlay,
  next as nextTrack,
  prev as prevTrack,
  setQueue,
  seekRatio,
  setVolume, getSnapshot
} from "./player.js";
import {
  createPlaylist, getPlaylists, getPlaylist, addToPlaylist,
  removeFromPlaylist, renamePlaylist, deletePlaylist,
  toggleLike, getLikedTracks, getRecentPlays
} from "./library.js";
import { db } from "./db.js";

/* ---------- constants ---------- */
const MOOD_CHIPS = [
  "Podcasts",
  "Relax",
  "Sad",
  "Sleep",
  "Romance",
  "Feel good",
  "Energize",
  "Party",
  "Commute",
  "Workout",
  "Focus",
];
const FALLBACK_COVER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="%23222"/></svg>';

console.log("App initialized");

/* ---------- elements ---------- */
const appEl = document.getElementById("app");
const input = document.getElementById("searchInput");

const nowTitleEl = document.getElementById("nowTitle");
const nowArtistEl = document.getElementById("nowArtist");
const nowCoverEl = document.getElementById("nowCover");

const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const seekEl = document.getElementById("seek");
const currEl = document.getElementById("currTime");
const totEl = document.getElementById("totTime");
const volEl = document.getElementById("vol");

/* ---------- footer controls ---------- */
playPauseBtn?.addEventListener("click", togglePlay);
prevBtn?.addEventListener("click", prevTrack);
nextBtn?.addEventListener("click", nextTrack);

seekEl?.addEventListener("input", (e) => {
  const pct = Number(e.target.value) / 100;
  seekRatio(pct);
});

const savedVol = parseFloat(localStorage.getItem("vol"));
if (volEl) volEl.value = Number.isFinite(savedVol) ? String(savedVol) : "1";
volEl?.addEventListener("input", (e) => setVolume(parseFloat(e.target.value)));

nowCoverEl?.addEventListener("click", () => {
  location.hash = "#now";
});

/* ---------- utils ---------- */
const debounce = (fn, ms = 350) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};
const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
};
async function showPlaylistPicker(anchorEl, track) {
  // shell
  const box = document.createElement("div");
  box.className = "pl-picker";
  Object.assign(box.style, {
    position: "fixed", zIndex: 10000, width: "260px",
    background: "#101014", border: "1px solid #2a2a2a", borderRadius: "12px",
    boxShadow: "0 12px 30px rgba(0,0,0,.45)", padding: "10px"
  });
  const r = anchorEl.getBoundingClientRect();
  const left = Math.min(r.left, window.innerWidth - 270);
  box.style.top = `${Math.min(r.bottom + 6, window.innerHeight - 220)}px`;
  box.style.left = `${left}px`;

  box.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px">Add to playlist</div>
    <div id="plpList" style="display:grid;gap:6px;max-height:140px;overflow:auto">Loading…</div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <input id="plpNewName" placeholder="New playlist" style="flex:1;padding:6px 8px;border:1px solid #333;border-radius:8px;background:#0b0b0f;color:#fff"/>
      <button id="plpCreate" style="padding:6px 10px;border-radius:8px;background:#2d5cff;color:#fff;border:0">Create</button>
    </div>
  `;
  document.body.appendChild(box);

  // load lists
  const lists = await getPlaylists().catch(() => []);
  const listEl = box.querySelector("#plpList");
  listEl.innerHTML = lists.length
    ? lists.map(p => `<button class="plp-item" data-id="${p.id}"
         style="text-align:left;border:1px solid #2a2a2a;background:#14141a;color:#fff;padding:8px;border-radius:8px">
         ${p.name}</button>`).join("")
    : `<div style="opacity:.7">No playlists yet — create one below.</div>`;

  listEl.querySelectorAll(".plp-item").forEach(b => {
    b.addEventListener("click", async () => {
      await addToPlaylist(b.dataset.id, track);
      toast(`Added to ${b.textContent.trim()}`);
      window.dispatchEvent(new CustomEvent("playlist-updated", { detail: { plId: Number(b.dataset.id) } }));
      close();
    });
  });

  box.querySelector("#plpCreate").addEventListener("click", async () => {
    const name = box.querySelector("#plpNewName").value.trim();
    if (!name) return;
    const id = await createPlaylist(name);
    await addToPlaylist(Number(id), track);
    toast(`Created “${name}” & added`);
    window.dispatchEvent(new CustomEvent("playlist-updated", { detail: { plId: Number(id) } }));
    close();
  });

  function close() {
    document.removeEventListener("mousedown", onDoc);
    document.removeEventListener("keydown", onKey);
    box.remove();
  }
  function onDoc(e) { if (!box.contains(e.target) && e.target !== anchorEl) close(); }
  function onKey(e) { if (e.key === "Escape") close(); }
  setTimeout(() => {
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
  }, 0);
}
window.addEventListener("playlist-updated", async (e) => {
  if (!isPlaylists()) return;
  const id = e.detail?.plId;
  if (!id) return;
  const pl = await getPlaylist(id);
  // Update the count list AND the detail pane without losing your place
  const box = document.getElementById("plDetail");
  if (box) renderPlaylistDetail(pl);
  // also refresh the grid so the “X tracks” counter updates
  const lists = await getPlaylists();
  // quick redraw of the header grid only:
  // easiest: re-run renderPlaylists()
  renderPlaylists();
});

/* ---------- footer: reflect player state ---------- */
onPlayerChange(({ track, playing, currentTime, duration }) => {
  if (seekEl && isFinite(duration) && duration > 0) {
    seekEl.value = String((currentTime / duration) * 100);
  } else if (seekEl) {
    seekEl.value = "0";
  }
  if (currEl) currEl.textContent = fmt(currentTime);
  if (totEl) totEl.textContent = isFinite(duration) ? fmt(duration) : "0:00";

  if (nowTitleEl)
    nowTitleEl.textContent = track ? track.title : "No track playing";
  if (nowArtistEl) nowArtistEl.textContent = track?.artist || "";
  if (nowCoverEl)
    nowCoverEl.src =
      track?.artwork_url && track.artwork_url.startsWith("http")
        ? track.artwork_url
        : FALLBACK_COVER;

  if (playPauseBtn) playPauseBtn.textContent = playing ? "⏸" : "▶️";
});
// Re-render #now when track/queue/playing changes (ignore timeupdates)
let __nowKey = "";
onPlayerChange((s) => {
  if (!location.hash.toLowerCase().startsWith("#now")) return;
  const qlen = (s.queueLength ?? s.queue?.length ?? 0);
  const key = `${s.track?.id || ""}|${s.index}|${qlen}|${s.playing ? 1 : 0}`;
  if (key !== __nowKey) { __nowKey = key; renderNow(); }
});





/* ---------- views ---------- */
function renderNow() {
  const snap = getSnapshot();
  const t = snap.track;
  const rest = snap.queue.slice(snap.index + 1);

  if (!t) {
    appEl.innerHTML = `<p>Nothing playing yet. Pick a song.</p>`;
    return;
  }

  appEl.innerHTML = `
    <div class="nowpage">
      <div class="now-hero">
        <img class="hero-art" src="${(t.artwork_url && t.artwork_url.startsWith('http')) ? t.artwork_url : FALLBACK_COVER}" alt="">
        <div class="hero-meta">
          <h1 class="hero-title">${t.title}</h1>
          <div class="hero-sub">${t.artist || ""}</div>
          <div class="hero-actions">
            <button id="npPlay">${snap.playing ? "Pause" : "Play"}</button>
            <button id="npNext">Next</button>
          </div>
        </div>
      </div>

      <h2 class="upnext-title">Up next</h2>
      <div class="results">
        ${rest
      .map(
        (r) => `
          <div class="track">
            <img src="${r.artwork_url || ""}" width="56" height="56" />
            <div class="meta">
              <div class="title">${r.title}</div>
              <div class="artist">${r.artist || ""}</div>
            </div>
            <div class="actions">
              <button class="play" data-id="${r.id}">Play</button>
            </div>
          </div>
        `
      )
      .join("")}
      </div>
    </div>
  `;

  document.getElementById("npPlay")?.addEventListener("click", togglePlay);
  document.getElementById("npNext")?.addEventListener("click", nextTrack);

  // jump within current queue
  appEl.querySelectorAll(".play").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const all = getSnapshot().queue;
      const start = all.findIndex((x) => x.id === id);
      if (start >= 0) setQueue(all, start);
    });
  });
}

async function renderResults(tracks) {
  const likedIds = new Set((await db.likes.toArray()).map((x) => x.trackId));

  appEl.innerHTML = tracks.length
    ? `<div class="results">${tracks
      .map(
        (t) => `
        <div class="track">
          <img src="${t.artwork_url || ""}" width="56" height="56" />
          <div class="meta">
            <div class="title">${t.title}</div>
            <div class="artist">${t.artist || ""}</div>
            <a class="license" href="${t.license_url || "#"}" target="_blank">${t.license || ""
          }</a>
          </div>
          <div class="actions">
            <button class="like ${likedIds.has(t.id) ? "liked" : ""
          }" data-id="${t.id}" title="Like">
              ${likedIds.has(t.id) ? "❤️" : "🤍"}
            </button>
            <button class="play" data-id="${t.id}">Play</button>
            <button class="add" data-id="${t.id}" title="add to playlist">➕</button>
          </div>
        </div>
      `
      )
      .join("")}</div>`
    : `<p>No results yet. Try “lofi”, “afrobeats”, “bollywood”, “remix”.</p>`;

  // queue all results, start at clicked
  appEl.querySelectorAll(".play").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const start = tracks.findIndex((x) => x.id === id);
      if (start >= 0) setQueue(tracks, start);
    });
  });
  // add to playlist
  appEl.querySelectorAll(".add").forEach(btn => {
    btn.addEventListener("click", () => {
      const track = tracks.find(x => x.id === btn.dataset.id);
      if (track) showPlaylistPicker(btn, track)
    })
  })
  // like toggles
  appEl.querySelectorAll(".like").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const track = tracks.find((x) => x.id === btn.dataset.id);
      const liked = await toggleLike(track);
      btn.textContent = liked ? "❤️" : "🤍";
      btn.classList.toggle("liked", liked);
    });
  });
}


const runSearch = debounce(async (term) => {
  const results = await searchTracks(term);
  renderResults(results);
}, 400);

if (input) {
  input.addEventListener("input", (e) => {
    if (isSearch()) runSearch(e.target.value);
  });
}

async function renderLibrary() {
  const tracks = await getLikedTracks();

  appEl.innerHTML = tracks.length
    ? `<h2>Liked Songs</h2>
       <div class="actions" style="margin:8px 0;display:flex;gap:8px;">
         <button id="playAll">Play All</button>
         <button id="shuffleAll">Shuffle</button>
       </div>
       <div class="results">
         ${tracks
      .map(
        (t) => `
           <div class="track">
             <img src="${t.artwork_url || ""}" width="56" height="56" />
             <div class="meta">
               <div class="title">${t.title}</div>
               <div class="artist">${t.artist || ""}</div>
             </div>
             <div class="actions">
               <button class="unlike" data-id="${t.id
          }" title="Remove">💔</button>
               <button class="play" data-id="${t.id}">Play</button>
                 <button class="add"  data-id="${t.id}" title="Add">➕</button>
             </div>
           </div>
         `
      )
      .join("")}
       </div>`
    : `<p>No liked songs yet. Hit 🤍 on any track to save it here.</p>`;

  appEl.querySelectorAll(".play").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const start = tracks.findIndex((x) => x.id === id);
      if (start >= 0) setQueue(tracks, start);
    });
  });

  appEl.querySelectorAll(".unlike").forEach((btn) => {
    const id = btn.dataset.id;
    const t = tracks.find((x) => x.id === id);
    btn.addEventListener("click", async () => {
      await toggleLike(t);
      renderLibrary();
    });
  });

  appEl.querySelectorAll(".add").forEach(btn => {
    const track = tracks.find(x => x.id === btn.dataset.id);
    if (!track) return;
    btn.addEventListener("click", () => showPlaylistPicker(btn, track));
  });


  document
    .getElementById("playAll")
    ?.addEventListener("click", () => setQueue(tracks, 0));
  document.getElementById("shuffleAll")?.addEventListener("click", () => {
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setQueue(shuffled, 0);
  });
}

// --- tiny DOM helpers + toast ---
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function toast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed", bottom: "18px", left: "50%", transform: "translateX(-50%)",
    background: "#222", color: "#fff", padding: "8px 12px", borderRadius: "10px",
    zIndex: 9999, fontSize: "14px", opacity: 0.95
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1400);
}



// playlist
async function renderPlaylists() {
  const lists = await getPlaylists();
  appEl.innerHTML = `
    <div class="pl-head">
      <h2>Playlists</h2>
      <div class="row" style="display:flex;gap:8px">
        <input id="newPlName" placeholder="New playlist name" />
        <button id="newPlBtn">Create</button>
      </div>
    </div>
    <div class="pl-grid">
      ${lists.length ? lists.map(p => `
          <div class="pl-card" data-id="${p.id}">
            <div class="pl-title">${p.name}</div>
            <div class="pl-sub">${p.tracks?.length || 0} tracks</div>
            <div class="pl-actions">
              <button class="open">Open</button>
              <button class="del">Delete</button>
            </div>
          </div>
        `).join("") : `<p>No playlists yet.</p>`
    }
    </div>
    <div id="plDetail"></div>
  `;

  document.getElementById("newPlBtn")?.addEventListener("click", async () => {
    const name = (document.getElementById("newPlName")?.value || "").trim();
    if (!name) return;
    await createPlaylist(name);
    toast("Playlist created");
    renderPlaylists();
  });

  // open/delete cards
  $$(".pl-card .open", appEl).forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.closest(".pl-card").dataset.id);
      const pl = await getPlaylist(id);
      renderPlaylistDetail(pl);
    });
  });
  $$(".pl-card .del", appEl).forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.closest(".pl-card").dataset.id);
      await deletePlaylist(id);
      toast("Deleted");
      renderPlaylists();
    });
  });
}

function renderPlaylistDetail(pl) {
  const box = document.getElementById("plDetail");
  if (!pl) { box.innerHTML = ""; return; }
  box.innerHTML = `
    <div class="pl-detail">
      <div class="row" style="display:flex;align-items:center;gap:8px">
        <input id="plName" value="${pl.name}" />
        <button id="saveName">Rename</button>
        <button id="plPlayAll">Play All</button>
        <button id="plShuffle">Shuffle</button>
      </div>
      <div class="results">
        ${(pl.tracks || []).map(t => `
            <div class="track">
              <img src="${t.artwork_url || ""}" width="56" height="56" />
              <div class="meta">
                <div class="title">${t.title}</div>
                <div class="artist">${t.artist || ""}</div>
              </div>
              <div class="actions">
                <button class="play" data-id="${t.id}">Play</button>
                <button class="remove" data-id="${t.id}">Remove</button>
              </div>
            </div>
          `).join("")
    }
      </div>
    </div>
  `;

  document.getElementById("saveName")?.addEventListener("click", async () => {
    const name = (document.getElementById("plName")?.value || "").trim();
    await renamePlaylist(pl.id, name);
    toast("Renamed");
    renderPlaylists(); // re-list + detail
  });

  document.getElementById("plPlayAll")?.addEventListener("click", () => {
    setQueue(pl.tracks || [], 0);
  });
  document.getElementById("plShuffle")?.addEventListener("click", () => {
    const shuffled = [...(pl.tracks || [])].sort(() => Math.random() - 0.5);
    setQueue(shuffled, 0);
  });

  // per-track actions
  $$(".play", box).forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const start = (pl.tracks || []).findIndex(x => x.id === id);
      if (start >= 0) setQueue(pl.tracks, start);
    });
  });
  $$(".remove", box).forEach(btn => {
    btn.addEventListener("click", async () => {
      await removeFromPlaylist(pl.id, btn.dataset.id);
      const fresh = await getPlaylist(pl.id);
      renderPlaylistDetail(fresh);
    });
  });
}


/* ---------- Home ---------- */
const MOOD_CONTAINER_ID = "chips";
function renderChips() {
  const chipsEl = document.getElementById(MOOD_CONTAINER_ID);
  if (!chipsEl) return;
  chipsEl.innerHTML = MOOD_CHIPS.map(
    (t) => `<span class="chip" data-term="${t}">${t}</span>`
  ).join("");
  chipsEl.querySelectorAll(".chip").forEach((ch) => {
    ch.addEventListener("click", () => {
      location.hash = "#search";
      if (input) input.value = ch.dataset.term;
      runSearch(ch.dataset.term);
    });
  });
}

function renderCarousel(title, tracks, idPrefix) {
  const hasItems = Array.isArray(tracks) && tracks.length > 0;
  return `
    <div class="section">
      <h2>${title}</h2>
      <div class="row-actions">
        <button class="arrow" data-left="${idPrefix}">◀</button>
        <button class="arrow" data-right="${idPrefix}">▶</button>
      </div>
    </div>
    <div class="carousel" id="${idPrefix}">
      ${hasItems
      ? tracks.map(t => `
              <div class="card">
                <img src="${t.artwork_url || ""}" alt="">
                <div class="title">${t.title}</div>
                <div class="sub">${t.artist || ""}</div>
                <div class="actions" style="margin-top:8px; display:flex; gap:8px;">
                  <button class="play" data-id="${t.id}">Play</button>
                  <button class="add"  data-id="${t.id}" title="Add">➕</button>
                  <button class="like" data-id="${t.id}" title="Like">🤍</button>
                </div>
              </div>
            `).join("")
      : `<div style="opacity:.7;padding:16px">Nothing to show right now.</div>`
    }
    </div>
  `;
}



async function renderHome() {
  let recent = [], trending = [];
  try {
    [recent, trending] = await Promise.all([
      getRecentPlays(12).catch(() => []),
      getTrending(18).catch(() => []),
    ]);
  } catch (_) {
    recent = []; trending = [];
  }

  appEl.innerHTML = `
    ${renderCarousel("Continue listening", recent, "carousel-recent")}
    ${renderCarousel("Quick picks", trending, "carousel-trend")}
  `;
  const all = [...recent, ...trending];

  // PLAY from cards 
  appEl.querySelectorAll(".play").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const start = all.findIndex(x => x.id === id);
      if (start >= 0) setQueue(all, start);
    });
  });

  // LIKE from cards
  appEl.querySelectorAll(".like").forEach(btn => {
    const id = btn.dataset.id;
    const track = all.find(x => x.id === id);
    if (!track) return;

    btn.addEventListener("click", async () => {
      const liked = await toggleLike(track);      // uses your library.js
      btn.textContent = liked ? "❤️" : "🤍";
      btn.classList.toggle("liked", liked);
      window.dispatchEvent(new Event("likes-updated"));
    });
  });

  // Add to playlist from cards
  appEl.querySelectorAll(".add").forEach(btn => {
    const track = all.find(x => x.id === btn.dataset.id);
    if (!track) return;
    btn.addEventListener("click", () => showPlaylistPicker(btn, track));
  });



  // Carousel arrows
  const scrollBy = (id, dir = 1) => {
    const el = document.getElementById(id);
    if (el) el.scrollBy({ left: dir * 360, behavior: "smooth" });
  };
  appEl.querySelectorAll("[data-left]").forEach(b =>
    b.addEventListener("click", () => scrollBy(b.dataset.left, -1)));
  appEl.querySelectorAll("[data-right]").forEach(b =>
    b.addEventListener("click", () => scrollBy(b.dataset.right, 1)));
}


/* ---------- Router ---------- */
const currentRoute = () => (location.hash || "#home").toLowerCase();
const isHome = () => currentRoute() === "#home";
const isSearch = () => currentRoute().startsWith("#search");
const isLibrary = () => currentRoute().startsWith("#library");
const isPlaylists = () => currentRoute().startsWith("#playlists");
const isNow = () => currentRoute().startsWith("#now");
window.addEventListener("recents-updated", () => {
  const route = (location.hash || "#home").toLowerCase();
  if (route === "#home") renderHome();
  if (route === "#library") renderLibrary();
});


function renderRoute() {
  if (isLibrary()) {
    renderLibrary();
    return;
  }
  if (isSearch()) {
    const term = (input?.value || "").trim();
    term.length >= 2
      ? runSearch(term)
      : (appEl.innerHTML = `<p>Type to search…</p>`);
    return;
  }
  if (isNow()) {
    renderNow();
    return;
  }
  if (isPlaylists()) return renderPlaylists();
  renderHome(); // default
}

window.addEventListener("hashchange", renderRoute);
renderRoute();
renderChips();

/* ---------- Keyboard shortcuts ---------- */
let lastState = { currentTime: 0, duration: 0 };
onPlayerChange((s) => {
  lastState = s;
});

const seekBy = (sec) => {
  if (lastState.duration > 0) {
    const next = Math.max(
      0,
      Math.min(lastState.currentTime + sec, lastState.duration)
    );
    seekRatio(next / lastState.duration);
  }
};
const setVolBoth = (v) => {
  v = Math.max(0, Math.min(1, v));
  setVolume(v);
  if (volEl) volEl.value = String(v);
};

window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  switch (e.key) {
    case " ":
    case "k":
    case "K":
      e.preventDefault();
      togglePlay();
      break;
    case "j":
    case "J":
      seekBy(-5);
      break;
    case "l":
    case "L":
      seekBy(+5);
      break;
    case "ArrowLeft":
      seekBy(-2);
      break;
    case "ArrowRight":
      seekBy(+2);
      break;
    case "ArrowUp":
      setVolBoth((parseFloat(volEl?.value || "1") || 1) + 0.05);
      break;
    case "ArrowDown":
      setVolBoth((parseFloat(volEl?.value || "1") || 1) - 0.05);
      break;
  }
});

// Slide-out nav toggle
const navToggle = document.getElementById('navToggle');
const sideNav = document.getElementById('sideNav');
const navBackdrop = document.getElementById('navBackdrop');

function setNavOpen(open) {
  document.body.classList.toggle('nav-open', !!open);
  navToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  navBackdrop?.toggleAttribute('hidden', !open);
}

navToggle?.addEventListener('click', () => {
  setNavOpen(!document.body.classList.contains('nav-open'));
});
navBackdrop?.addEventListener('click', () => setNavOpen(false));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNavOpen(false); });

// close drawer when a nav link is clicked
document.querySelectorAll('#sideNav a').forEach(a =>
  a.addEventListener('click', () => setNavOpen(false))
);
