// UI helpers (toasts, modals, etc.)

export function showToast(msg) {
  console.log("Toast:", msg);
  // TODO: render a little popup
}

// Tiny DOM helpers
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function")
      n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of Array.isArray(children) ? children : [children]) {
    n.append(c?.nodeType ? c : document.createTextNode(String(c ?? "")));
  }
  return n;
}
export function on(root, evt, sel, handler) {
  root.addEventListener(evt, (e) => {
    const match = e.target.closest(sel);
    if (match && root.contains(match)) handler(e, match);
  });
}
export function toast(msg, ms = 2000) {
  let t = document.getElementById("toast");
  if (!t) {
    t = el("div", { id: "toast", class: "toast" });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), ms);
}
