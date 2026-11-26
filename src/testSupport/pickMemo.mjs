/**
 * @module testSupport/pickMemo
 * @description Each scene's `pick` passes made in the task running now, so
 * a click's own picks reuse the query port's pick of the same pixel and
 * window rather than draw the pick buffer again. No imports.
 */

let taskPicks = new WeakMap();
let clearing = false;

const keyOf = (x, y, width, height) => `${x},${y},${width},${height}`;

/** Note a `pick` pass just made, for `recentPick`. */
export function rememberPick(scene, x, y, width, height, picked) {
  let picks = taskPicks.get(scene);
  if (!picks) {
    picks = new Map();
    taskPicks.set(scene, picks);
  }
  picks.set(keyOf(x, y, width, height), picked);
  if (!clearing) {
    clearing = true;
    queueMicrotask(() => {
      clearing = false;
      taskPicks = new WeakMap();
    });
  }
}

/** What the query port's `pick` on `scene` found at this pixel and window. */
export function recentPick(scene, x, y, width = 3, height = 3) {
  const picks = taskPicks.get(scene);
  const key = keyOf(x, y, width, height);
  return picks?.has(key) ? { picked: picks.get(key) } : undefined;
}
