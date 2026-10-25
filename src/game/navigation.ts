import type { Bounds, Point } from "./types";

export const WALK_SPEED = 120;

export function withinFloor(point: Point, floor: Bounds): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= floor.x && point.x <= floor.x + floor.width
    && point.y >= floor.y && point.y <= floor.y + floor.height;
}

export function clampToFloor(point: Point, floor: Bounds): Point {
  return {
    x: Math.max(floor.x, Math.min(floor.x + floor.width, point.x)),
    y: Math.max(floor.y, Math.min(floor.y + floor.height, point.y)),
  };
}

export function moveToward(actor: Point, destination: Point, elapsedMs: number): Point {
  const distance = Math.hypot(destination.x - actor.x, destination.y - actor.y);
  const travel = WALK_SPEED * elapsedMs / 1000;
  if (distance <= travel) return { ...destination };
  return {
    x: actor.x + (destination.x - actor.x) * travel / distance,
    y: actor.y + (destination.y - actor.y) * travel / distance,
  };
}
