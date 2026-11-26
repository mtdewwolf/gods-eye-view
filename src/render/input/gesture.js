/** Track the distance traveled during a pointer press, including its release. */
export function beginGesture(position, time, button = 0) {
  return { x: position.x, y: position.y, time, button, travelPx: 0 };
}

export function moveGesture(gesture, position) {
  gesture.travelPx += Math.hypot(
    position.x - gesture.x,
    position.y - gesture.y,
  );
  gesture.x = position.x;
  gesture.y = position.y;
}

export function endGesture(gesture, position, time) {
  moveGesture(gesture, position);
  return {
    travelPx: gesture.travelPx,
    durationMs: Math.max(0, time - gesture.time),
  };
}
