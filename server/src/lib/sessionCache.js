// Short-lived in-memory cache of the user rows requireAuth checks on every
// request. The database may be a long network hop away, and without this
// every API call paid one extra round trip before doing any real work.
//
// Correctness: any write to the users collection (password change, "sign
// out everywhere", delete, role change...) clears the whole cache through
// hooks on the User model, so revocation still takes effect on the very
// next request. The TTL is only a backstop for writes made outside this
// process (e.g. by hand in the database). The app runs as a single
// instance; with several instances, a write on one would reach the others
// within TTL_MS.
const TTL_MS = 30 * 1000;
const MAX_ENTRIES = 5000;

const entries = new Map(); // userId -> { user, expires }
// Bumped on every clear. A lookup that started before a clear must not put
// its (possibly stale) result back afterwards.
let generation = 0;

function get(userId) {
  const hit = entries.get(userId);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    entries.delete(userId);
    return undefined;
  }
  return hit.user;
}

function currentGeneration() {
  return generation;
}

function set(userId, user, startedAt) {
  if (startedAt !== generation) return;
  if (entries.size >= MAX_ENTRIES) entries.clear();
  entries.set(userId, { user, expires: Date.now() + TTL_MS });
}

function clear() {
  generation += 1;
  entries.clear();
}

module.exports = { get, set, clear, currentGeneration };
