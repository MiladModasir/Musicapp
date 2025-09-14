# Milad Music (Web Player)

A lightweight, hackable music web app: search, play, like, queue, playlists, and a slick “Now Playing” view — all in vanilla JS + IndexedDB. Works fully offline for your library & playlists (data stored locally), streams audio from public APIs.


live DEMO :(https://miladmodasir.github.io/Musicapp/)

Features

Home

“Continue listening” (recents)

“Quick picks” (Audius trending)

Horizontal carousels with smooth scroll

Search

Jamendo (optional key) + Audius

Larger cover art with graceful fallbacks

Player

Footer mini-player (seek, volume, prev/next, play/pause)

Full “Now Playing” page (big artwork, title/artist, Up Next)

State persists on refresh (track, position, volume)

Keyboard shortcuts (YouTube-style)

Library

Like/Unlike tracks (❤️)

Shuffle/Play all

Playlists

Create, rename, delete

Add from Home/Search/Library via ➕ picker

Play/Shuffle playlist

Storage

Likes, recents, playlists in IndexedDB (via Dexie)

UI

Modern dark theme, chip filters, drawer nav (hamburger → slide-in)

Tech Stack

Vanilla JS (ES modules)

IndexedDB via Dexie

HTML/CSS (no framework)

External APIs: Audius (no key) + Jamendo (optional)

Project Structure
/assets            # icons, images, etc.
  icon.svg
/css
  styles.css       # global theme + components
/index.html        # entry
/js
  app.js           # routing, views, UI wiring
  player.js        # audio element, queue, persistence
  search.js        # Audius/Jamendo fetch + normalization
  library.js       # likes, recents, playlists APIs (Dexie)
  db.js            # Dexie init & stores
