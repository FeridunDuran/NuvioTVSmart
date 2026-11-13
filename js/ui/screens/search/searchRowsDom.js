// Preserve row and card identity across progressive catalog publications.
const stateByNode = new WeakMap();

export function rememberSearchRows(content, rows, watched, prefs, getKey) {
  const nodes = content?.querySelectorAll?.(".search-results-row") || [];
  Array.from(nodes).forEach((node, index) => {
    const row = rows?.[index];
    if (row && node.dataset.rowKey === getKey(row, index))
      stateByNode.set(node, { row, watched, prefs });
  });
}

export function patchSearchRows({
  content,
  header,
  rows,
  watched,
  prefs,
  getKey,
  renderRow,
  updateWatched = null,
  document: doc = globalThis.document
}) {
  if (!rows.length) return false;
  const existing = new Map(
    Array.from(content.querySelectorAll(".search-results-row"), (node) => [
      node.dataset.rowKey,
      node
    ])
  );
  const desired = rows.map((row, index) => {
    const key = getKey(row, index);
    let node = existing.get(key);
    const previous = node && stateByNode.get(node);
    if (
      !previous ||
      previous.row !== row ||
      previous.prefs !== prefs ||
      (previous.watched !== watched && !updateWatched)
    ) {
      const template = doc.createElement("template");
      template.innerHTML = renderRow(row, index);
      const replacement = template.content.firstElementChild;
      if (!replacement) throw new Error("Search row renderer returned no section");
      if (node) node.replaceWith(replacement);
      node = replacement;
      stateByNode.set(node, { row, watched, prefs });
    } else if (previous.watched !== watched) {
      updateWatched(node, row, watched);
      stateByNode.set(node, { row, watched, prefs });
    }
    existing.delete(key);
    return node;
  });
  const desiredSet = new Set(desired);
  let sibling = header.nextSibling;
  while (sibling) {
    const next = sibling.nextSibling;
    if (!desiredSet.has(sibling)) sibling.remove();
    sibling = next;
  }
  // Leave the focused branch in place when inserting earlier catalogs.
  let cursor = header.nextSibling;
  desired.forEach((node) => {
    if (node !== cursor) content.insertBefore(node, cursor);
    cursor = node.nextSibling;
  });
  return true;
}
