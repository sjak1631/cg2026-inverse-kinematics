import { Vector2, Chain, BodyState } from './types';

function rotateVec(v: Vector2, angle: number): Vector2 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: c * v.x - s * v.y, y: s * v.x + c * v.y };
}

export function getChainBaseWorld(chain: Chain, body: BodyState): Vector2 {
  const r = rotateVec(chain.baseOffset, body.rotation);
  return { x: body.position.x + r.x, y: body.position.y + r.y };
}

export function getChainBaseAngleWorld(chain: Chain, body: BodyState): number {
  return body.rotation + chain.baseAngle;
}

export function computeChainPositions(chain: Chain, body: BodyState): Vector2[] {
  const base = getChainBaseWorld(chain, body);
  const baseAngle = getChainBaseAngleWorld(chain, body);
  return computeFK(base, baseAngle, chain.segmentLengths, chain.jointAngles);
}

export function computeFK(
  basePos: Vector2,
  baseAngle: number,
  lengths: number[],
  angles: number[],
): Vector2[] {
  const positions: Vector2[] = [{ ...basePos }];
  let x = basePos.x, y = basePos.y;
  let angle = baseAngle;
  for (let i = 0; i < lengths.length; i++) {
    angle += angles[i] ?? 0;
    x += Math.cos(angle) * lengths[i];
    y += Math.sin(angle) * lengths[i];
    positions.push({ x, y });
  }
  return positions;
}
