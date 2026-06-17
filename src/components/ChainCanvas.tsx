import { useEffect, useRef } from 'react';
import { IKMethod, IKResult, PoseMode, Vector2 } from '../ik/types';
import { computeFK } from '../ik/forwardKinematics';
import { solveIK } from '../ik/solver';

interface Props {
  mode: PoseMode;
  linkCount: number;
  lambda: number;
  onStats: (stats: IKResult) => void;
}

const BASE_ANGLE = 0;

function makeLinkLen(cssW: number, cssH: number, n: number) {
  return Math.min(cssW * 0.38, cssH * 0.42) / n;
}

function initAngles(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 0.15 : -0.15));
}

function dist(a: Vector2, b: Vector2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function ChainCanvas({ mode, linkCount, lambda, onStats }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const modeRef    = useRef(mode);
  const lambdaRef  = useRef(lambda);
  const onStatsRef = useRef(onStats);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { lambdaRef.current = lambda; }, [lambda]);
  useEffect(() => { onStatsRef.current = onStats; }, [onStats]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const dpr    = window.devicePixelRatio || 1;

    let cssW = canvas.getBoundingClientRect().width  || 800;
    let cssH = canvas.getBoundingClientRect().height || 600;

    let linkLen  = makeLinkLen(cssW, cssH, linkCount);
    const base: Vector2 = { x: cssW / 2, y: cssH / 2 };
    let angles   = initAngles(linkCount);
    let target: Vector2 = { x: base.x + linkLen * linkCount * 0.75, y: base.y };
    let dragging: 'target' | number | null = null;

    function setCanvasSize() {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      canvas.width  = cssW * dpr;
      canvas.height = cssH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base.x = cssW / 2;
      base.y = cssH / 2;
      linkLen = makeLinkLen(cssW, cssH, linkCount);
    }
    setCanvasSize();

    function lengths() { return Array<number>(linkCount).fill(linkLen); }
    function positions() { return computeFK(base, BASE_ANGLE, lengths(), angles); }

    function draw() {
      ctx.clearRect(0, 0, cssW, cssH);
      const pts = positions();

      // Links
      ctx.lineCap = 'round';
      for (let i = 0; i < linkCount; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = '#78909c';
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.strokeStyle = '#455a64';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Joints
      for (let i = 0; i <= linkCount; i++) {
        const p = pts[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, i === 0 ? 10 : 6, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#2196f3' : i === linkCount ? '#e53935' : '#90a4ae';
        ctx.fill();
      }

      // Target (IK modes)
      if (modeRef.current !== 'FK') {
        const tx = target.x, ty = target.y;
        ctx.beginPath();
        ctx.arc(tx, ty, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef5350';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(tx - 7, ty); ctx.lineTo(tx + 7, ty);
        ctx.moveTo(tx, ty - 7); ctx.lineTo(tx, ty + 7);
        ctx.strokeStyle = '#ef5350';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    function toCSS(e: MouseEvent): Vector2 {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      const p = toCSS(e);
      const pts = positions();

      if (modeRef.current === 'FK') {
        for (let i = linkCount; i >= 1; i--) {
          if (dist(p, pts[i]) < 16) { dragging = i - 1; return; }
        }
      } else {
        if (dist(p, target) < 20) dragging = 'target';
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (dragging === null) return;
      const p = toCSS(e);

      if (dragging === 'target') {
        target = p;
      } else {
        const idx = dragging as number;
        const pts = positions();
        const parentPos = pts[idx];
        let cumAngle = BASE_ANGLE;
        for (let k = 0; k < idx; k++) cumAngle += angles[k];
        angles[idx] = Math.atan2(p.y - parentPos.y, p.x - parentPos.x) - cumAngle;
      }
    }

    function onMouseUp() { dragging = null; }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      const m = modeRef.current;
      if (m !== 'FK') {
        const result = solveIK(m as IKMethod, base, BASE_ANGLE, lengths(), angles, target, lambdaRef.current);
        angles = result.angles;
        onStatsRef.current(result);
      }
      draw();
    }
    animate();

    const ro = new ResizeObserver(setCanvasSize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [linkCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: '#eceff1' }}
    />
  );
}
