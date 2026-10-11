// Tiny event bus shared by all modules.
// Events in use (see docs/ARCHITECTURE.md): 'screen', 'caption', 'settings', 'album'.
const handlers = new Map();

export const bus = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => handlers.get(event)?.delete(fn);
  },
  off(event, fn) {
    handlers.get(event)?.delete(fn);
  },
  emit(event, payload) {
    for (const fn of [...(handlers.get(event) ?? [])]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] handler for "${event}" failed`, err);
      }
    }
  },
};
