// Boot + simple router

console.log("App initialized");

// Handle basic routing (hash-based)
window.addEventListener("hashchange", () => {
  const route = location.hash || "#home";
  console.log("Route changed:", route);
  // TODO: Load view based on route
});
// js/app.js
import { db } from "./db.js";

console.log("App initialized");

(async () => {
  await db.likes.add({ trackId: "jamendo:123" });
  const rows = await db.likes.toArray();
  console.log("likes:", rows);
})();
