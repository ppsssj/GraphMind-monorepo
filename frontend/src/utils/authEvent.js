// src/utils/authEvent.js
const listeners = new Set();

export function onAuthed(cb) {
  if (typeof cb !== "function") return () => {};
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitAuthed(payload) {
  for (const cb of listeners) {
    try {
      cb(payload);
    } catch (e) {
      console.error("[authEvent] listener error", e);
    }
  }
}
