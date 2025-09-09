// Single global Audio() + queue

let audio = new Audio();
let queue = [];
let currentIndex = 0;

export function playTrack(track) {
  console.log("Playing track:", track);
  // TODO: set audio.src = track.stream_url; audio.play()
}
