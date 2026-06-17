import { Vector2 } from "./types";

export const sub = (a: Vector2, b: Vector2): Vector2 => ({
    x: a.x - b.x,
    y: a.y - b.y,

});

export const length = (v: Vector2): number => Math.hypot(v.x, v.y);
