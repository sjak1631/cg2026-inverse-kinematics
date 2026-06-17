import { Vector2, IKResult } from './types';
import { computeFK } from './forwardKinematics';
import { sub, length } from './utils';
import { zeros, subset, index, transpose, multiply, inv, Matrix } from 'mathjs';

export function solveJacobian(
  basePos: Vector2,
  baseAngle: number,
  lengths: number[],
  angles: number[],
  target: Vector2,
  iters = 100,
  step = 1,
  threshold = 0.01,
): IKResult {
  const t0 = performance.now();
  let result = [...angles];
  const n = lengths.length;
  let actualIters = 0;
  let converged = false;

  // 以下をeが十分小さくなるまで計算 or iters回やる
  for (let i = 0; i < iters; i++) {
    actualIters++;

    // FKでcurrent計算
    const current = computeFK(basePos, baseAngle, lengths, result);
    // 末端取得 current[n]
    const p_end = current[n];
    // e = target - current
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

    // 疑似逆行列でdelta theta計算
    let delta_theta;
    try {
      if (n >= 2) {
        delta_theta = multiply(Jt, multiply(inv(multiply(J, Jt) as Matrix), e_mat));
      } else {
        delta_theta = multiply(inv(multiply(Jt, J) as Matrix), Jt, e_mat);
      }
    } catch {
      break;
    }

    // theta <- theta + delta thetaで更新
    const dt = (multiply(step, delta_theta) as Matrix).toArray() as number[][];
    if (!dt.every(row => isFinite(row[0]))) break;
    result = result.map((r, i) => r + dt[i][0]);
  }

  return { angles: result, iters: actualIters, converged, elapsed: performance.now() - t0 };
}
