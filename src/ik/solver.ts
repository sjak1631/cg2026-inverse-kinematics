import { IKMethod, IKResult, Vector2 } from './types';
import { solveCCD } from './ccd';
import { solveJacobian } from './jacobian';
import { solveJacobianTranspose } from './jacobianTranspose';
import { solveJacobianDamped } from './jacobianDamped';

export function solveIK(
  method: IKMethod,
  basePos: Vector2,
  baseAngle: number,
  lengths: number[],
  angles: number[],
  target: Vector2,
  lambda = 38,
): IKResult {
  switch (method) {
    case 'CCD':
      return solveCCD(basePos, baseAngle, lengths, angles, target);
    case 'Jacobian':
      return solveJacobian(basePos, baseAngle, lengths, angles, target);
    case 'JacobianTranspose':
      return solveJacobianTranspose(basePos, baseAngle, lengths, angles, target);
    case 'JacobianDamped':
      return solveJacobianDamped(basePos, baseAngle, lengths, angles, target, 100, 1, 0.01, lambda);
  }
}
