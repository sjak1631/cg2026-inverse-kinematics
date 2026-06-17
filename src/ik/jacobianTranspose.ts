import { Vector2, IKResult } from './types';
import { computeFK } from './forwardKinematics';
import { sub, length } from './utils';
import { zeros, subset, index, transpose, multiply, Matrix } from 'mathjs';

export function solveJacobianTranspose(
  basePos: Vector2,
  baseAngle: number,
  lengths: number[],
  angles: number[],
  target: Vector2,
  iters = 100,
  threshold = 0.01,
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

    if (length(e) < threshold) {
      converged = true;
      break;
    }

    // theta -> J(theta)の計算、初期化
    let J = zeros(2, n) as Matrix;
    // 幾何学的ヤコビ行列で計算↓

    // 以下をすべてのリンクで繰り返す
    for (let j = 0; j < n; j++) {
      // d = positions[n-1] - positions[i]
      const d = sub(p_end, current[j]);
      // J_col = [-d[1],d[0]] (90度回転)
      const J_col = [[-d.y], [d.x]]
      // Jに列として追加
      J = subset(J, index([0, 1], j), J_col) as Matrix;
    }

    const e_mat = [[e.x], [e.y]];
    const Jt = transpose(J) as Matrix;

    const Jte = multiply(Jt, e_mat) as Matrix;
    const JJte = multiply(J, Jte) as Matrix;

    const num = ((multiply(transpose(e_mat), JJte) as Matrix).toArray() as number[][])[0][0];
    const den = ((multiply(transpose(JJte), JJte) as Matrix).toArray() as number[][])[0][0];
    if (den < 1e-12) break;
    const alpha = num / den;

    const delta = (multiply(alpha, Jte) as Matrix).toArray() as number[][];
    for (let j = 0; j < n; j++) {
      result[j] += delta[j][0];
    }
  }

  return { angles: result, iters: actualIters, converged, elapsed: performance.now() - t0 };
}
