import { Vector2, IKResult } from './types';
import { computeFK } from './forwardKinematics';

export function solveCCD(
  basePos: Vector2,
  baseAngle: number,
  lengths: number[],
  angles: number[],
  target: Vector2,
  iters = 10,
  threshold = 0.01,
): IKResult {
  const t0 = performance.now();
  const result = [...angles];
  const n = lengths.length;
  let actualIters = 0;
  let converged = false;

  for (let i = 0; i < iters; i++) {
    actualIters++;
    for (let j = n - 1; j >= 0; j--) {
      const positions = computeFK(basePos, baseAngle, lengths, result);
      const targetAngle  = Math.atan2(target.y - positions[j].y, target.x - positions[j].x);
      const currentAngle = Math.atan2(positions[n].y - positions[j].y, positions[n].x - positions[j].x);
      result[j] += targetAngle - currentAngle;
    }
    const p_end = computeFK(basePos, baseAngle, lengths, result)[n];
    if (Math.hypot(target.x - p_end.x, target.y - p_end.y) < threshold) {
      converged = true;
      break;
    }
  }

  return { angles: result, iters: actualIters, converged, elapsed: performance.now() - t0 };
}
