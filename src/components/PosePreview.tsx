import React, { useRef, useEffect } from 'react';
import { CharacterState, ChainId } from '../ik/types';
import { computeChainPositions } from '../ik/forwardKinematics';

const W = 190;
const H = 155;
const BODY_HW = 30;
const BODY_HH = 40;

const SEG_WIDTHS: Record<ChainId, number> = {
  head: 20, leftArm: 13, rightArm: 13, leftLeg: 17, rightLeg: 17,
};
const CHAIN_IDS: ChainId[] = ['head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

function fitTransform(character: CharacterState): { scale: number; ox: number; oy: number } {
  const body = character.body;
  const pts: Array<[number, number]> = [];

  // Body corners (rotated)
  const c = Math.cos(body.rotation), s = Math.sin(body.rotation);
  for (const [lx, ly] of [[-BODY_HW, -BODY_HH], [BODY_HW, -BODY_HH], [BODY_HW, BODY_HH], [-BODY_HW, BODY_HH]]) {
    pts.push([body.position.x + lx * c - ly * s, body.position.y + lx * s + ly * c]);
  }

  // All joint positions
  for (const id of CHAIN_IDS) {
    for (const p of computeChainPositions(character[id], body)) {
      pts.push([p.x, p.y]);
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }

  const PAD = 10;
  minX -= PAD; maxX += PAD; minY -= PAD; maxY += PAD;

  const scale = Math.min(W / (maxX - minX), H / (maxY - minY));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { scale, ox: W / 2 - cx * scale, oy: H / 2 + cy * scale };
}

export function PosePreview({ character }: { character: CharacterState }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    const { scale, ox, oy } = fitTransform(character);
    const wToC = (wx: number, wy: number): [number, number] =>
      [ox + wx * scale, oy - wy * scale];

    const body = character.body;
    const [bcx, bcy] = wToC(body.position.x, body.position.y);

    // Body rectangle
    ctx.save();
    ctx.translate(bcx, bcy);
    ctx.rotate(-body.rotation);
    ctx.fillStyle = '#90a4ae';
    ctx.fillRect(-BODY_HW * scale, -BODY_HH * scale, BODY_HW * 2 * scale, BODY_HH * 2 * scale);
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 1;
    ctx.strokeRect(-BODY_HW * scale, -BODY_HH * scale, BODY_HW * 2 * scale, BODY_HH * 2 * scale);
    ctx.restore();

    // Limb segments and joints
    for (const id of CHAIN_IDS) {
      const positions = computeChainPositions(character[id], body);
      const halfW = (SEG_WIDTHS[id] * scale) / 2;

      for (let i = 0; i < positions.length - 1; i++) {
        const [x0, y0] = wToC(positions[i].x, positions[i].y);
        const [x1, y1] = wToC(positions[i + 1].x, positions[i + 1].y);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const len = Math.hypot(x1 - x0, y1 - y0);
        const angle = Math.atan2(y1 - y0, x1 - x0);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(-len / 2, -halfW, len, halfW * 2);
        ctx.strokeStyle = '#546e7a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-len / 2, -halfW, len, halfW * 2);
        ctx.restore();
      }

      for (let i = 1; i < positions.length; i++) {
        const [px, py] = wToC(positions[i].x, positions[i].y);
        ctx.beginPath();
        ctx.arc(px, py, i === positions.length - 1 ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#e53935';
        ctx.fill();
      }
    }

    // Body center dot
    ctx.beginPath();
    ctx.arc(bcx, bcy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2196f3';
    ctx.fill();
  }, [character]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{ width: '100%', borderRadius: 4, display: 'block', background: '#ffffff' }}
    />
  );
}
