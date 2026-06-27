// onHand is DERIVED, not a stored column: it is the sum of every
// LotLocation.quantity across an item's lots (the SOURCE OF TRUTH).
// Use this when the item's lots/locations have already been fetched via
// a Prisma `include`/`select`, to avoid extra per-item queries.
export const sumLotsOnHand = (
  lots: { locations: { quantity: number }[] }[],
): number =>
  lots.reduce(
    (total, lot) =>
      total + lot.locations.reduce((sum, loc) => sum + loc.quantity, 0),
    0,
  );
