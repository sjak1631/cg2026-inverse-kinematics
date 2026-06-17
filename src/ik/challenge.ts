import { CharacterState, ChainId } from './types';

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createRandomTargetPose(): CharacterState {
  return {
    body: { position: { x: 0, y: 0 }, rotation: 0 },
    head: {
      id: 'head',
      baseOffset: { x: 0, y: 40 },
      baseAngle: Math.PI / 2,
      jointAngles: [rand(-Math.PI / 3, Math.PI / 3)],
      segmentLengths: [30],
    },
    leftArm: {
      id: 'leftArm',
      baseOffset: { x: -30, y: 28 },
      baseAngle: Math.PI,
      jointAngles: [rand(-Math.PI * 0.8, Math.PI * 0.8), rand(-Math.PI * 0.6, 0.1)],
      segmentLengths: [60, 50],
    },
    rightArm: {
      id: 'rightArm',
      baseOffset: { x: 30, y: 28 },
      baseAngle: 0,
      jointAngles: [rand(-Math.PI * 0.8, Math.PI * 0.8), rand(-0.1, Math.PI * 0.6)],
      segmentLengths: [60, 50],
    },
    leftLeg: {
      id: 'leftLeg',
      baseOffset: { x: -15, y: -40 },
      baseAngle: -Math.PI / 2,
      jointAngles: [rand(-Math.PI * 0.5, Math.PI * 0.5), rand(-Math.PI * 0.5, 0.1)],
      segmentLengths: [70, 60],
    },
    rightLeg: {
      id: 'rightLeg',
      baseOffset: { x: 15, y: -40 },
      baseAngle: -Math.PI / 2,
      jointAngles: [rand(-Math.PI * 0.5, Math.PI * 0.5), rand(-0.1, Math.PI * 0.5)],
      segmentLengths: [70, 60],
    },
  };
}

function angleDiff(a: number, b: number): number {
  let d = ((a - b) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  return Math.abs(d);
}

const CHAIN_IDS: ChainId[] = ['head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

export function computeMatchRate(current: CharacterState, target: CharacterState): number {
  let totalError = 0;
  let totalDOF = 0;
  for (const id of CHAIN_IDS) {
    const currAngles = current[id].jointAngles;
    const tgtAngles  = target[id].jointAngles;
    for (let i = 0; i < currAngles.length; i++) {
      totalError += Math.min(angleDiff(currAngles[i], tgtAngles[i]) / Math.PI, 1);
      totalDOF++;
    }
  }
  return Math.max(0, (1 - totalError / totalDOF)) * 100;
}

export const SUCCESS_THRESHOLD = 95;
