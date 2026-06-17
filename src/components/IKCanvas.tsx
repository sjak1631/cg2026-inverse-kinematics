import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CharacterState, ChainId, IKResult, PoseMode, Vector2 } from '../ik/types';
import { computeChainPositions, getChainBaseWorld, getChainBaseAngleWorld } from '../ik/forwardKinematics';
import { solveIK } from '../ik/solver';
import { computeMatchRate } from '../ik/challenge';

// ---- Character dimensions ----
const BODY_HW = 30;
const BODY_HH = 40;

// ---- Segment widths per chain ----
const SEG_WIDTH: Record<ChainId, number> = {
  head:    20,
  leftArm: 13, rightArm: 13,
  leftLeg: 17, rightLeg: 17,
};

// ---- Z-depth per chain ----
const SEG_Z: Record<ChainId, number> = {
  head:    0.25,
  leftArm: 0.20, rightArm: 0.20,
  leftLeg: 0.10, rightLeg: 0.10,
};

const CHAIN_IDS: ChainId[] = ['head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

// ---- Colors ----
const C_BODY_FILL   = 0x90a4ae;
const C_BODY_BORDER = 0x546e7a;
const C_LIMB_FILL   = 0x90a4ae;
const C_LIMB_BORDER = 0x546e7a;
const C_JOINT       = 0xe53935;
const C_END         = 0xe53935;
const C_DRAG        = 0xb71c1c;
const C_BODY_CTR    = 0x2196f3;

// ---- Helpers ----
function v2dist(a: Vector2, b: Vector2) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function hitRect(
  p: Vector2,
  center: Vector2,
  angle: number,
  halfLen: number,
  halfW: number,
  pad = 5,
): boolean {
  const dx = p.x - center.x, dy = p.y - center.y;
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const lx = c * dx - s * dy;
  const ly = s * dx + c * dy;
  return Math.abs(lx) <= halfLen + pad && Math.abs(ly) <= halfW + pad;
}

// ---- Initial character (T-pose) ----
function createInitialCharacter(): CharacterState {
  return {
    body: { position: { x: 0, y: 0 }, rotation: 0 },
    head: {
      id: 'head', baseOffset: { x: 0, y: BODY_HH },
      baseAngle: Math.PI / 2, jointAngles: [0], segmentLengths: [30],
    },
    leftArm: {
      id: 'leftArm', baseOffset: { x: -BODY_HW, y: BODY_HH - 12 },
      baseAngle: Math.PI, jointAngles: [-0.2, 0.2], segmentLengths: [60, 50],
    },
    rightArm: {
      id: 'rightArm', baseOffset: { x: BODY_HW, y: BODY_HH - 12 },
      baseAngle: 0, jointAngles: [0.2, -0.2], segmentLengths: [60, 50],
    },
    leftLeg: {
      id: 'leftLeg', baseOffset: { x: -BODY_HW / 2, y: -BODY_HH },
      baseAngle: -Math.PI / 2, jointAngles: [-0.35, 0.2], segmentLengths: [70, 60],
    },
    rightLeg: {
      id: 'rightLeg', baseOffset: { x: BODY_HW / 2, y: -BODY_HH },
      baseAngle: -Math.PI / 2, jointAngles: [0.35, -0.2], segmentLengths: [70, 60],
    },
  };
}

// ---- Per-segment info (updated every frame for hit testing) ----
type SegInfo = {
  mesh: THREE.Mesh;
  halfLen: number;
  halfW: number;
  center: Vector2;
  angle: number;
};

/**
 * Per-chain Three.js objects.
 *
 * draggableMeshes[i]  = circle at positions[i+1]  (the endpoint of segment i)
 *   i < n-1 → intermediate joint (red, small)
 *   i = n-1 → final end effector (orange, larger)
 *
 * Dragging mesh/segment i triggers IK for sub-chain 0..i,
 * treating positions[i+1] as the target end effector.
 */
type ChainObjs = {
  segments: SegInfo[];
  draggableMeshes: THREE.Mesh[];
  draggableMats: THREE.MeshBasicMaterial[];
  draggableColors: number[];  // idle color per draggable point
};

interface Props {
  mode: PoseMode;
  lambda: number;
  targetPose: CharacterState | null;
  onMatchRate: (rate: number) => void;
  onStats: (stats: IKResult) => void;
  resetKey: number;
}

export function IKCanvas({ mode, lambda, targetPose, onMatchRate, onStats, resetKey }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const characterRef    = useRef<CharacterState>(createInitialCharacter());
  const modeRef         = useRef<PoseMode>(mode);
  const lambdaRef       = useRef(lambda);
  const targetPoseRef   = useRef<CharacterState | null>(targetPose);
  const onMatchRateRef  = useRef(onMatchRate);
  const onStatsRef      = useRef(onStats);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { lambdaRef.current = lambda; }, [lambda]);
  useEffect(() => { targetPoseRef.current = targetPose; }, [targetPose]);
  useEffect(() => { onMatchRateRef.current = onMatchRate; }, [onMatchRate]);
  useEffect(() => { onStatsRef.current = onStats; }, [onStats]);
  useEffect(() => { characterRef.current = createInitialCharacter(); }, [resetKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ---- Bootstrap ----
    const VIEW_H = 350;
    const scene  = new THREE.Scene();
    scene.background = new THREE.Color(0xeceff1);

    const camera = new THREE.OrthographicCamera(0, 0, VIEW_H, -VIEW_H, 0.1, 100);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    function syncCamera() {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      const hw = VIEW_H * (w / h);
      camera.left = -hw; camera.right = hw;
      camera.top = VIEW_H; camera.bottom = -VIEW_H;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    syncCamera();

    // ---- Body ----
    const bodyFillGeo  = new THREE.PlaneGeometry(BODY_HW * 2, BODY_HH * 2);
    const bodyFillMesh = new THREE.Mesh(
      bodyFillGeo,
      new THREE.MeshBasicMaterial({ color: C_BODY_FILL }),
    );
    const bodyEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(bodyFillGeo),
      new THREE.LineBasicMaterial({ color: C_BODY_BORDER }),
    );
    bodyEdge.position.z = 0.01;
    bodyFillMesh.add(bodyEdge);
    scene.add(bodyFillMesh);

    const bodyCtrMesh = new THREE.Mesh(
      new THREE.CircleGeometry(7, 20),
      new THREE.MeshBasicMaterial({ color: C_BODY_CTR }),
    );
    scene.add(bodyCtrMesh);

    // ---- Chain objects ----
    const chainObjs: Record<ChainId, ChainObjs> = {} as Record<ChainId, ChainObjs>;

    for (const id of CHAIN_IDS) {
      const chain = characterRef.current[id];
      const n     = chain.segmentLengths.length;
      const segW  = SEG_WIDTH[id];
      const z     = SEG_Z[id];

      // Segment rectangles
      const segments: SegInfo[] = [];
      for (let i = 0; i < n; i++) {
        const len  = chain.segmentLengths[i];
        const geo  = new THREE.PlaneGeometry(len, segW);
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({ color: C_LIMB_FILL }),
        );
        mesh.position.z = z;
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: C_LIMB_BORDER }),
        );
        edge.position.z = 0.01;
        mesh.add(edge);
        scene.add(mesh);
        segments.push({ mesh, halfLen: len / 2, halfW: segW / 2, center: { x: 0, y: 0 }, angle: 0 });
      }

      // Draggable circles: one per segment endpoint (positions[1..n])
      const draggableMeshes: THREE.Mesh[] = [];
      const draggableMats: THREE.MeshBasicMaterial[] = [];
      const draggableColors: number[] = [];

      for (let i = 0; i < n; i++) {
        const isFinal  = i === n - 1;
        const radius   = isFinal ? 8 : 5;
        const color    = isFinal ? C_END : C_JOINT;
        const mat      = new THREE.MeshBasicMaterial({ color });
        const mesh     = new THREE.Mesh(new THREE.CircleGeometry(radius, 14), mat);
        scene.add(mesh);
        draggableMeshes.push(mesh);
        draggableMats.push(mat);
        draggableColors.push(color);
      }

      chainObjs[id] = { segments, draggableMeshes, draggableMats, draggableColors };
    }

    // ---- Drag state ----
    type DragBody = { type: 'body'; startMouse: Vector2; startPos: Vector2 };
    type DragEnd  = { type: 'end'; chainId: ChainId; segIdx: number };
    let dragging: DragBody | DragEnd | null = null;
    let panning: { lastX: number; lastY: number } | null = null;

    function toWorld(e: MouseEvent): Vector2 {
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      const ny = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      const v  = new THREE.Vector3(nx, ny, 0).unproject(camera);
      return { x: v.x, y: v.y };
    }

    function startEndDrag(chainId: ChainId, segIdx: number) {
      // Restore previous drag color if needed
      if (dragging?.type === 'end') {
        const d = dragging;
        chainObjs[d.chainId].draggableMats[d.segIdx]
          .color.setHex(chainObjs[d.chainId].draggableColors[d.segIdx]);
      }
      dragging = { type: 'end', chainId, segIdx };
      chainObjs[chainId].draggableMats[segIdx].color.setHex(C_DRAG);
    }

    // ---- Scene update ----
    function updateScene() {
      const char = characterRef.current;
      const body = char.body;

      bodyFillMesh.position.set(body.position.x, body.position.y, 0);
      bodyFillMesh.rotation.z = body.rotation;
      bodyCtrMesh.position.set(body.position.x, body.position.y, 0.35);

      for (const id of CHAIN_IDS) {
        const positions = computeChainPositions(char[id], body);
        const objs      = chainObjs[id];

        // Segment rectangles: midpoint + angle
        for (let i = 0; i < objs.segments.length; i++) {
          const p0 = positions[i], p1 = positions[i + 1];
          const cx    = (p0.x + p1.x) / 2;
          const cy    = (p0.y + p1.y) / 2;
          const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          const seg   = objs.segments[i];
          seg.mesh.position.set(cx, cy, SEG_Z[id]);
          seg.mesh.rotation.z = angle;
          seg.center = { x: cx, y: cy };
          seg.angle  = angle;
        }

        // Draggable circles: at positions[1..n]
        for (let i = 0; i < objs.draggableMeshes.length; i++) {
          const p = positions[i + 1];
          objs.draggableMeshes[i].position.set(p.x, p.y, 0.40);
        }
      }

    }

    // ---- Mouse events ----
    const canvas = renderer.domElement;

    function onMouseDown(e: MouseEvent) {
      if (e.button === 2) {
        panning = { lastX: e.clientX, lastY: e.clientY };
        return;
      }
      const w    = toWorld(e);
      const char = characterRef.current;

      // 1. Draggable circles — positions[1..n] for each chain
      for (const id of CHAIN_IDS) {
        const positions = computeChainPositions(char[id], char.body);
        const n = char[id].segmentLengths.length;
        for (let i = 0; i < n; i++) {
          const p      = positions[i + 1];
          const radius = i === n - 1 ? 16 : 12; // end effector slightly larger hit radius
          if (v2dist(w, p) < radius) { startEndDrag(id, i); return; }
        }
      }

      // 2. Segment rectangles — clicking segment i activates sub-chain 0..i
      for (const id of CHAIN_IDS) {
        const segs = chainObjs[id].segments;
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          if (hitRect(w, seg.center, seg.angle, seg.halfLen, seg.halfW)) {
            startEndDrag(id, i);
            return;
          }
        }
      }

      // 3. Body rectangle
      if (hitRect(w, char.body.position, char.body.rotation, BODY_HW, BODY_HH)) {
        dragging = { type: 'body', startMouse: w, startPos: { ...char.body.position } };
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (panning) {
        const el = containerRef.current;
        if (!el) return;
        const dx = e.clientX - panning.lastX;
        const dy = e.clientY - panning.lastY;
        panning.lastX = e.clientX;
        panning.lastY = e.clientY;
        const worldW = camera.right - camera.left;
        const worldH = camera.top - camera.bottom;
        camera.position.x -= dx * (worldW / el.clientWidth);
        camera.position.y += dy * (worldH / el.clientHeight);
        return;
      }
      if (!dragging) return;
      const w    = toWorld(e);
      const char = characterRef.current;

      if (dragging.type === 'body') {
        char.body.position = {
          x: dragging.startPos.x + w.x - dragging.startMouse.x,
          y: dragging.startPos.y + w.y - dragging.startMouse.y,
        };
        return;
      }

      const { chainId, segIdx } = dragging;
      const chain = char[chainId];

      if (modeRef.current === 'FK') {
        // FK: セグメント segIdx をマウス方向へ直接回転
        // positions[segIdx] がセグメントの根本（親関節）
        const positions = computeChainPositions(chain, char.body);
        const parentPos = positions[segIdx];

        // セグメント segIdx より手前の累積角度
        const chainBaseAngle = getChainBaseAngleWorld(chain, char.body);
        let prevCumAngle = chainBaseAngle;
        for (let k = 0; k < segIdx; k++) prevCumAngle += chain.jointAngles[k];

        // 親関節からマウスへの方向角 → その分だけ相対角度を設定
        const targetCumAngle = Math.atan2(w.y - parentPos.y, w.x - parentPos.x);
        chain.jointAngles[segIdx] = targetCumAngle - prevCumAngle;
      } else {
        // IK: サブチェーン 0..segIdx を解く
        const subLengths = chain.segmentLengths.slice(0, segIdx + 1);
        const subAngles  = chain.jointAngles.slice(0, segIdx + 1);
        const result = solveIK(
          modeRef.current as import('../ik/types').IKMethod,
          getChainBaseWorld(chain, char.body),
          getChainBaseAngleWorld(chain, char.body),
          subLengths,
          subAngles,
          w,
          lambdaRef.current,
        );
        onStatsRef.current(result);
        for (let i = 0; i <= segIdx; i++) {
          chain.jointAngles[i] = result.angles[i];
        }
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (e.button === 2) { panning = null; return; }
      if (dragging?.type === 'end') {
        const { chainId, segIdx } = dragging;
        chainObjs[chainId].draggableMats[segIdx]
          .color.setHex(chainObjs[chainId].draggableColors[segIdx]);
      }
      dragging = null;
    }

    function onContextMenu(e: Event) { e.preventDefault(); }

    canvas.addEventListener('mousedown',   onMouseDown);
    canvas.addEventListener('mousemove',   onMouseMove);
    canvas.addEventListener('mouseup',     onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mouseup',     onMouseUp);

    // ---- Animate ----
    updateScene();
    let animId: number;
    let frameCount = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      updateScene();
      renderer.render(scene, camera);
      if (++frameCount >= 6) {
        frameCount = 0;
        const tgt = targetPoseRef.current;
        if (tgt) onMatchRateRef.current(computeMatchRate(characterRef.current, tgt));
      }
    }
    animate();

    const ro = new ResizeObserver(syncCamera);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      canvas.removeEventListener('mousedown',   onMouseDown);
      canvas.removeEventListener('mousemove',   onMouseMove);
      canvas.removeEventListener('mouseup',     onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('mouseup',     onMouseUp);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []); // run once — all Three.js state is in refs

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
