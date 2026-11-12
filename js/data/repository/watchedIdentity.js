function addIdentityValue(set, value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return;
  }
  set.add(normalized);
  set.add(normalized.toLowerCase());
}

// Personal build: the prefix regexes are compiled once instead of on every call.
const PREFIX_PATTERNS = {};

function addPrefixedIdentityValue(set, prefix, value) {
  const pattern =
    PREFIX_PATTERNS[prefix] || (PREFIX_PATTERNS[prefix] = new RegExp(`^${prefix}:`, "i"));
  const normalized = String(value ?? "")
    .trim()
    .replace(pattern, "");
  if (!normalized) {
    return;
  }
  addIdentityValue(set, `${prefix}:${normalized}`);
}

/**
 * Returns every stable catalog identity carried by a watched item or a catalog item.
 * The tracker payload and the catalog are allowed to choose different primary IDs;
 * callers must therefore compare this set instead of comparing only contentId.
 */
export function watchedItemIdentityValues(item = {}) {
  const values = new Set();
  const ids = item.ids || item.externalIds || item.external_ids || {};
  addIdentityValue(values, item.contentId);
  addIdentityValue(values, item.id);

  const imdbId = String(item.imdbId ?? "")
    .trim()
    .replace(/^imdb:/i, "");
  addIdentityValue(values, imdbId || item.imdb_id || ids.imdb);
  addPrefixedIdentityValue(values, "tmdb", item.tmdbId ?? item.tmdb_id ?? ids.tmdb);
  addPrefixedIdentityValue(values, "trakt", item.traktId ?? item.trakt_id ?? ids.trakt);
  addPrefixedIdentityValue(values, "tvdb", item.tvdbId ?? item.tvdb_id ?? ids.tvdb);
  addPrefixedIdentityValue(values, "mdblist", item.mdblistId ?? ids.mdblist);
  addIdentityValue(values, item.slug || item.ids?.slug || ids.slug);
  return values;
}

// Personal build: identity sets are cached per object. Watched/progress records are compared
// against every card on each focus move; rebuilding both sets per comparison froze navigation
// for up to 1.3 s on a Tizen 5.5 TV. Records are replaced, not mutated, when they change.
const identityCache = typeof WeakMap === "function" ? new WeakMap() : null;

function cachedIdentityValues(item) {
  if (!identityCache || !item || typeof item !== "object") {
    return watchedItemIdentityValues(item || {});
  }
  let values = identityCache.get(item);
  if (!values) {
    values = watchedItemIdentityValues(item);
    identityCache.set(item, values);
  }
  return values;
}

export function watchedItemsShareIdentity(left = {}, right = {}) {
  const rightIds = cachedIdentityValues(right);
  for (const id of cachedIdentityValues(left)) {
    if (rightIds.has(id)) {
      return true;
    }
  }
  return false;
}
