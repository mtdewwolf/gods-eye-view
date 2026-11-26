/**
 * @module testSupport/drawHit
 * @description A pick of a draw-set item, as the contract's `Hit`. No
 * imports, so the click dispatcher can use it without the draw port.
 */

/**
 * A pick as the contract's `Hit`, when what it picked is a draw-set item
 * (its pick id is `{set, id, meta}`); else null.
 * @param {object|null|undefined} picked
 */
export function drawHitOf(picked) {
  const id = picked?.id;
  if (!id || typeof id.set !== 'string' || typeof id.id !== 'string')
    return null;
  return {
    set: id.set,
    id: id.id,
    ...(id.meta === undefined ? {} : { meta: id.meta }),
    surface: false,
  };
}
