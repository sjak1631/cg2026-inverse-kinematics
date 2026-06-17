export interface Vector2 {
  x: number;
  y: number;
}

export type IKMethod = 'CCD' | 'Jacobian' | 'JacobianTranspose' | 'JacobianDamped';

export type PoseMode = 'FK' | IKMethod;

export interface Chain {
  id: string;
  baseOffset: Vector2;
  baseAngle: number;
  jointAngles: number[];
  segmentLengths: number[];
}

export interface BodyState {
  position: Vector2;
  rotation: number;
}

export interface CharacterState {
  body: BodyState;
  head: Chain;
  leftArm: Chain;
  rightArm: Chain;
  leftLeg: Chain;
  rightLeg: Chain;
}

export type ChainId = keyof Omit<CharacterState, 'body'>;

export interface IKResult {
  angles: number[];
  iters: number;
  converged: boolean;
  elapsed: number;
}
