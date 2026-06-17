import { Vector2, IKResult } from './types';
import { computeFK } from './forwardKinematics';
import { sub, length } from './utils';
import { zeros, subset, index, transpose, multiply, inv, add, identity, Matrix } from 'mathjs';

export function solveJacobianDamped(
  basePos: Vector2,
  baseAngle: number,
  lengths: number[],
  angles: number[],
  target: Vector2,
  iters = 100,
  step = 1,
  threshold = 0.01,
  lambda = 30,
): IKResult {
  const t0 = performance.now();
  let result = [...angles];
  const n = lengths.length;
  let actualIters = 0;
  let converged = false;

  for (let i = 0; i < iters; i++) {
    actualIters++;
    const current = computeFK(basePos, baseAngle, lengths, result);
    const p_end = current[n];
    const e = sub(target, p_end);

    if (length(e) < threshold) { converged = true; break; }

    // 幾何学的ヤコビ行列 J (2 x n) を構築
    let J = zeros(2, n) as Matrix;
    for (let j = 0; j < n; j++) {
      const d = sub(p_end, current[j]);
      J = subset(J, index([0, 1], j), [[-d.y], [d.x]]) as Matrix;
    }

    const e_mat = [[e.x], [e.y]];
    const Jt = transpose(J) as Matrix; // (n x 2)

    // DLS: J^T (J J^T + λ²I)^-1 e
    const JJt = multiply(J, Jt) as Matrix;                                    // (2 x 2)
    const damped = add(JJt, multiply(lambda ** 2, identity(2) as Matrix)) as Matrix; // (2 x 2)
    const delta_theta = multiply(Jt, multiply(inv(damped), e_mat)) as Matrix; // (n x 1)

    // theta <- theta + delta theta
    const dt = (multiply(step, delta_theta) as Matrix).toArray() as number[][];
    result = result.map((r, k) => r + dt[k][0]);
  }

  return { angles: result, iters: actualIters, converged, elapsed: performance.now() - t0 };
}
