import { getHomeFocusIdentity } from "./homeFocusPolicy.js";
import { releaseHomeArtwork } from "../../images/tvPosterRescaler.js";

// Compare generated markup, rather than the live DOM: focus, image hydration,
// expansion and trailer playback all add state that a data refresh must retain.
// Stored on the node itself: Chromium 63's WeakMap rehashes on insert once the
// table is full of collected keys, and every hero update registers new nodes
// (measured on a 2019 Tizen: 55 ms per D-pad press spent in WeakMap.set).
const SOURCE_KEY = "__nuvioHomeSource";
const sourceByNode = {
  get: (node) => node?.[SOURCE_KEY],
  set: (node, value) => {
    node[SOURCE_KEY] = value;
  }
};
const mountedShells = new WeakMap();

// A row whose generated markup did not change is sent as this empty stand-in:
// parsing all the rows again on every data refresh was half of the refresh
// (152 of 304 ms on a 2025 webOS set). Only valid for a row that is mounted.
const UNCHANGED_ROW = "data-home-row-unchanged";
export function unchangedHomeRowMarkup(escapedRowKey) {
  return `<section data-row-key="${escapedRowKey}" ${UNCHANGED_ROW}></section>`;
}

export function hasMountedHomeDom(container) {
  const shell = mountedShells.get(container);
  return Boolean(shell && shell === container.querySelector(".home-shell"));
}

function children(node) {
  const result = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 3 || child.textContent.trim()) result.push(child);
  }
  return result;
}

function key(node) {
  if (node.nodeType !== 1) return `node:${node.nodeType}`;
  const identity = getHomeFocusIdentity(node);
  if (identity && node.classList.contains("home-content-card")) {
    return `card:${JSON.stringify(identity)}`;
  }
  if (node.id) return `id:${node.id}`;
  if (node.dataset.rowKey) return `row:${node.dataset.rowKey}`;
  if (node.dataset.trackRowKey) return `track:${node.dataset.trackRowKey}`;
  if (node.dataset.action && node.classList.contains("focusable"))
    return `action:${node.dataset.action}`;
  return `${node.tagName}:${node.classList.item(0) || ""}`;
}

function signature(node) {
  if (node.nodeType !== 1) return node.textContent;
  // Rows/cards are useful unchanged-subtree boundaries. Serializing every
  // wrapper and descendant repeats the same markup at each ancestor depth.
  // Other elements still reconcile attributes and children from source nodes.
  return node.dataset.rowKey || node.classList.contains("home-content-card")
    ? node.outerHTML
    : undefined;
}

class TokenSnapshot {
  constructor(tokens) {
    this.tokens = tokens;
  }
  contains(token) {
    return this.tokens.includes(token);
  }
  item(index) {
    return this.tokens[index] || null;
  }
  [Symbol.iterator]() {
    return this.tokens[Symbol.iterator]();
  }
}
class StyleSnapshot {
  constructor(style) {
    this.names = Array.from(style || []);
    this.values = Object.create(null);
    this.names.forEach((name) => {
      this.values[name] = [style.getPropertyValue(name), style.getPropertyPriority(name)];
    });
  }
  getPropertyValue(name) {
    return this.values[name]?.[0] || "";
  }
  getPropertyPriority(name) {
    return this.values[name]?.[1] || "";
  }
  [Symbol.iterator]() {
    return this.names[Symbol.iterator]();
  }
}
const emptyStyleSnapshot = new StyleSnapshot();
const tokenSnapshots = new Map();
function snapshotTokens(value) {
  if (!tokenSnapshots.has(value)) {
    if (tokenSnapshots.size >= 512) tokenSnapshots.delete(tokenSnapshots.keys().next().value);
    tokenSnapshots.set(value, new TokenSnapshot(value.split(/\s+/).filter(Boolean)));
  }
  return tokenSnapshots.get(value);
}
class AttributeSnapshot {
  constructor(source) {
    this.nodeType = source.nodeType;
    this.nodeName = source.nodeName;
    if (source.nodeType !== 1) return;
    this.tagName = source.tagName;
    this.id = source.id || "";
    this.dataset = { ...source.dataset };
    this.attributes = Array.from(source.attributes || [], ({ name, value }) => ({ name, value }));
    this.values = Object.create(null);
    this.attributes.forEach(({ name, value }) => {
      this.values[name] = value;
    });
    this.classList = snapshotTokens(this.values.class || "");
    this.style = source.style?.length ? new StyleSnapshot(source.style) : emptyStyleSnapshot;
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.values, name) ? this.values[name] : null;
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.values, name);
  }
}

function snapshot(source) {
  // Plain attribute state avoids retaining a second native DOM node per live node.
  return { node: new AttributeSnapshot(source), markup: signature(source) };
}

const VIRTUAL_CONTENT = "__nuvioVirtualHomeContent";

export function virtualizeHomeCard(node) {
  const previous = sourceByNode.get(node);
  if (
    !previous?.markup ||
    node.classList.contains("focused") ||
    node.querySelector("iframe, video")
  )
    return false;
  if (Object.prototype.hasOwnProperty.call(node, VIRTUAL_CONTENT)) return false;
  // Find the outer tag boundary without parsing a second native card tree.
  let quote = "";
  let start = -1;
  for (let i = 0; i < previous.markup.length; i++) {
    const char = previous.markup[i];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === ">") {
      start = i + 1;
      break;
    }
  }
  const end = previous.markup.lastIndexOf("</");
  if (start < 0 || end < start) return false;
  node[VIRTUAL_CONTENT] = previous.markup.slice(start, end);
  releasePosters(node);
  node.textContent = "";
  return true;
}

export function materializeHomeCard(node) {
  if (!Object.prototype.hasOwnProperty.call(node, VIRTUAL_CONTENT)) return false;
  const markup = node[VIRTUAL_CONTENT];
  delete node[VIRTUAL_CONTENT];
  node.innerHTML = markup;
  // The shell keeps its original snapshot; new descendants are generated source.
  children(node).forEach((child) => remember(child, child));
  return true;
}

function remember(node, source) {
  sourceByNode.set(node, snapshot(source));
  const liveChildren = children(node);
  const sourceChildren = source === node ? liveChildren : children(source);
  sourceChildren.forEach((child, index) => remember(liveChildren[index], child));
}

export function registerHomeDomNodes(nodes) {
  nodes.forEach((node) => remember(node, node));
}

function updateAttributes(node, previous, next) {
  if (
    node.tagName === "IMG" &&
    previous.getAttribute("data-src") !== next.getAttribute("data-src")
  ) {
    releasePoster(node);
  }
  const names = new Set(
    [...Array.from(previous.attributes), ...Array.from(next.attributes)].map((attr) => attr.name)
  );
  names.forEach((name) => {
    const oldValue = previous.getAttribute(name);
    const newValue = next.getAttribute(name);
    if (oldValue === newValue) return;
    if (name === "class") {
      Array.from(previous.classList).forEach((token) => {
        if (
          node.classList.contains("home-content-card") &&
          ["focused", "is-expanded", "is-trailer-active", "is-expanded-backdrop-ready"].includes(
            token
          )
        )
          return;
        if (!next.classList.contains(token)) node.classList.remove(token);
      });
      Array.from(next.classList).forEach((token) => {
        if (
          node.classList.contains("home-content-card") &&
          ["focused", "is-expanded", "is-trailer-active", "is-expanded-backdrop-ready"].includes(
            token
          )
        )
          return;
        if (!previous.classList.contains(token)) node.classList.add(token);
      });
    } else if (name === "style") {
      const properties = new Set([...Array.from(previous.style), ...Array.from(next.style)]);
      properties.forEach((property) => {
        if (previous.style.getPropertyValue(property) === next.style.getPropertyValue(property))
          return;
        const value = next.style.getPropertyValue(property);
        if (value)
          node.style.setProperty(property, value, next.style.getPropertyPriority(property));
        else node.style.removeProperty(property);
      });
    } else if (newValue === null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, newValue);
    }
  });
  // A hydrated deferred image must not keep showing its old URL after its
  // source changes. The existing Home hydration pass loads the new data-src.
  if (
    node.tagName === "IMG" &&
    previous.getAttribute("data-src") !== next.getAttribute("data-src") &&
    !next.hasAttribute("src")
  ) {
    node.removeAttribute("src");
  }
}

function releasePoster(image) {
  if (!image.dataset?.originalSrc) return;
  releaseHomeArtwork(image.getAttribute("src"));
  delete image.dataset.originalSrc;
}

function releasePosters(node) {
  if (node.nodeType !== 1) return;
  if (node.matches("img.content-poster")) releasePoster(node);
  node.querySelectorAll("img.content-poster").forEach(releasePoster);
}

function updateNode(node, source, protectedNode) {
  if (source.nodeType === 1 && source.hasAttribute(UNCHANGED_ROW)) return;
  const previous = sourceByNode.get(node);
  const markup = signature(source);
  if (markup !== undefined && previous.markup === markup) return;
  if (node.nodeType === 1) {
    updateAttributes(node, previous.node, source);
    if (Object.prototype.hasOwnProperty.call(node, VIRTUAL_CONTENT)) {
      node[VIRTUAL_CONTENT] = source.innerHTML;
      sourceByNode.set(node, snapshot(source));
      return;
    }
    updateChildren(node, source, protectedNode);
  } else {
    node.textContent = source.textContent;
  }
  sourceByNode.set(node, snapshot(source));
}

function updateChildren(parent, source, protectedNode) {
  const available = new Map();
  children(parent).forEach((node) => {
    const previous = sourceByNode.get(node);
    if (!previous) return; // Runtime-owned trailer/GIF/transition nodes.
    const nodeKey = key(previous.node);
    if (!available.has(nodeKey)) available.set(nodeKey, []);
    available.get(nodeKey).push(node);
  });
  const desired = children(source).map((child) => {
    const candidates = available.get(key(child));
    const existing = candidates?.find(
      (node) => node.nodeType === child.nodeType && node.nodeName === child.nodeName
    );
    if (existing) {
      candidates.splice(candidates.indexOf(existing), 1);
      updateNode(existing, child, protectedNode);
      return existing;
    }
    const inserted = child.cloneNode(true);
    remember(inserted, child);
    return inserted;
  });
  available.forEach((nodes) =>
    nodes.forEach((node) => {
      releasePosters(node);
      node.remove();
    })
  );

  const desiredSet = new Set(desired);
  const nextManagedSibling = (node) => {
    let sibling = node.nextSibling;
    while (sibling && !desiredSet.has(sibling)) sibling = sibling.nextSibling;
    return sibling;
  };

  // insertBefore() detaches an existing node and can blur its descendants.
  // Keep the branch containing focus anchored and reorder its siblings around it.
  const anchorIndex = desired.findIndex(
    (node) => node === protectedNode || node.contains(protectedNode)
  );
  let before = anchorIndex >= 0 ? desired[anchorIndex] : null;
  for (let index = (anchorIndex >= 0 ? anchorIndex : desired.length) - 1; index >= 0; index -= 1) {
    const node = desired[index];
    if (node.parentNode !== parent || nextManagedSibling(node) !== before)
      parent.insertBefore(node, before);
    before = node;
  }
  if (anchorIndex >= 0) {
    let after = desired[anchorIndex];
    for (let index = anchorIndex + 1; index < desired.length; index += 1) {
      const node = desired[index];
      if (node.parentNode !== parent || nextManagedSibling(after) !== node)
        parent.insertBefore(node, after.nextSibling);
      after = node;
    }
  }
}

let inertDocument = null;

// The comparison tree is parsed in a document without a browsing context, so its
// <img> nodes never start fetching or decoding; inserted clones load once adopted.
function getInertDocument(ownerDocument) {
  if (!inertDocument) {
    inertDocument = ownerDocument.implementation?.createHTMLDocument?.("") || ownerDocument;
  }
  return inertDocument;
}

export function updateHomeDom(container, markup, { incremental = false, focusedNode = null } = {}) {
  const source = getInertDocument(container.ownerDocument).createElement("div");
  source.innerHTML = markup;
  const canUpdate = incremental && hasMountedHomeDom(container);
  if (canUpdate) {
    updateChildren(container, source, focusedNode);
  } else {
    releasePosters(container);
    // Parse once in the inert document, then adopt that same tree. Attributes
    // are plain snapshots, so no parallel native DOM tree needs to be retained.
    remember(source, source);
    sourceByNode.set(container, snapshot(source));
    container.textContent = "";
    while (source.firstChild) container.appendChild(source.firstChild);
  }
  mountedShells.set(container, container.querySelector(".home-shell"));
  return Boolean(canUpdate);
}
