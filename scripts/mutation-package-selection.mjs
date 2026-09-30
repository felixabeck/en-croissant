/** Select mutation package records by their stable package ids. */
export function selectMutationPackages(
  packages,
  requestedIds = undefined,
  selectorName = "package id",
) {
  const entries = Array.isArray(packages)
    ? packages.map((entry) => [entry.id, entry])
    : Object.entries(packages);
  const byId = new Map(entries);
  if (byId.size !== entries.length) throw new Error("Mutation package ids must be unique");

  if (requestedIds === undefined) return entries.map(([, entry]) => entry);

  const requested = [...new Set(requestedIds)];
  for (const id of requested) {
    if (!byId.has(id)) throw new Error(`Unknown ${selectorName}: ${id}`);
  }
  const selected = new Set(requested);
  return entries.filter(([id]) => selected.has(id)).map(([, entry]) => entry);
}
