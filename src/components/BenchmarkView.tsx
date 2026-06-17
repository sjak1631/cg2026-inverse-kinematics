import { useState, useRef, useEffect, useCallback } from 'react';
import { computeFK } from '../ik/forwardKinematics';
import { solveJacobian } from '../ik/jacobian';
import { solveJacobianTranspose } from '../ik/jacobianTranspose';
import { solveJacobianDamped } from '../ik/jacobianDamped';
import type { Vector2 } from '../ik/types';

const BASE_POS: Vector2 = { x: 0, y: 0 };
const BASE_ANGLE = Math.PI / 2;
const INIT_ANGLES = [0.3, -0.3];
const THRESHOLD = 0.5;
const COLORS = { pseudo: '#4fc3f7', transpose: '#81c784', damped: '#ffb74d' };

interface Params {
  l1: number; l2: number; radius: number;
  lambda: number; maxIters: number; nSamples: number;
}

interface SolverResult { iters: number; converged: boolean; angles: number[] }
interface DataPoint {
  angle: number; target: Vector2;
  pseudo: SolverResult; transpose: SolverResult; damped: SolverResult;
}

function runExperiment(params: Params): DataPoint[] {
  const lengths = [params.l1, params.l2];
  return Array.from({ length: params.nSamples }, (_, i) => {
    const a = (i / params.nSamples) * 2 * Math.PI;
    const target: Vector2 = { x: Math.cos(a) * params.radius, y: Math.sin(a) * params.radius };
    const pseudo    = solveJacobian(BASE_POS, BASE_ANGLE, lengths, INIT_ANGLES, target, params.maxIters, 1, THRESHOLD);
    const transpose = solveJacobianTranspose(BASE_POS, BASE_ANGLE, lengths, INIT_ANGLES, target, params.maxIters, THRESHOLD);
    const damped    = solveJacobianDamped(BASE_POS, BASE_ANGLE, lengths, INIT_ANGLES, target, params.maxIters, 1, THRESHOLD, params.lambda);
    return { angle: (i / params.nSamples) * 360, target, pseudo, transpose, damped };
  });
}

function drawGraph(canvas: HTMLCanvasElement, data: DataPoint[], maxIters: number, selectedIdx: number) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 20, right: 20, bottom: 40, left: 50 };
  const gW = W - PAD.left - PAD.right;
  const gH = H - PAD.top - PAD.bottom;
  const n = data.length;

  ctx.clearRect(0, 0, W, H);
  if (!n) return;

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = PAD.top + gH - (i / 5) * gH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + gW, y); ctx.stroke();
    ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(String(Math.round((i / 5) * maxIters)), PAD.left - 6, y + 3);
  }

  ctx.textAlign = 'center'; ctx.fillStyle = '#888'; ctx.font = '10px monospace';
  const xStep = Math.ceil(n / 6);
  for (let i = 0; i < n; i += xStep) {
    const x = PAD.left + (i / (n - 1)) * gW;
    ctx.fillText(Math.round(data[i].angle) + '°', x, H - PAD.bottom + 14);
  }

  ctx.save(); ctx.translate(12, PAD.top + gH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.fillStyle = '#aaa'; ctx.font = '11px monospace';
  ctx.fillText('反復回数', 0, 0); ctx.restore();
  ctx.textAlign = 'center'; ctx.fillStyle = '#aaa';
  ctx.fillText('目標角度', PAD.left + gW / 2, H - 4);

  function drawLine(key: 'pseudo' | 'transpose' | 'damped', color: string) {
    data.forEach((d, i) => {
      if (d[key].converged) return;
      const x = PAD.left + (i / (n - 1)) * gW;
      const y = PAD.top + gH - (d[key].iters / maxIters) * gH;
      ctx.save(); ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(100,100,100,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, y); ctx.stroke();
      ctx.restore();
    });

    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    data.forEach((d, i) => {
      const x = PAD.left + (i / (n - 1)) * gW;
      const y = PAD.top + gH - (d[key].iters / maxIters) * gH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    data.forEach((d, i) => {
      const x = PAD.left + (i / (n - 1)) * gW;
      const y = PAD.top + gH - (d[key].iters / maxIters) * gH;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = d[key].converged ? color : '#555'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    });
  }

  drawLine('damped', COLORS.damped);
  drawLine('transpose', COLORS.transpose);
  drawLine('pseudo', COLORS.pseudo);

  const sx = PAD.left + (selectedIdx / (n - 1)) * gW;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(sx, PAD.top); ctx.lineTo(sx, PAD.top + gH); ctx.stroke();
  ctx.setLineDash([]);
}

function drawChain(canvas: HTMLCanvasElement, data: DataPoint[], params: Params, selectedIdx: number) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;
  const maxLen = params.l1 + params.l2;
  const scale = (Math.min(W, H) / 2 - 16) / (maxLen || 1);
  const lengths = [params.l1, params.l2];

  ctx.clearRect(0, 0, W, H);

  ctx.beginPath(); ctx.arc(CX, CY, maxLen * scale, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.beginPath(); ctx.arc(CX, CY, params.radius * scale, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.setLineDash([4, 4]); ctx.stroke();
  ctx.setLineDash([]);

  if (!data.length) return;

  const d = data[selectedIdx];

  function drawArm(angles: number[], color: string, alpha: number) {
    const pos = computeFK(BASE_POS, BASE_ANGLE, lengths, angles);
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    pos.forEach((p, i) => {
      const sx = CX + p.x * scale, sy = CY - p.y * scale;
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    });
    ctx.stroke();
    pos.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(CX + p.x * scale, CY - p.y * scale, i === 0 ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#fff' : color; ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  drawArm(INIT_ANGLES, '#555', 0.5);
  drawArm(d.damped.angles, COLORS.damped, 0.85);
  drawArm(d.transpose.angles, COLORS.transpose, 0.85);
  drawArm(d.pseudo.angles, COLORS.pseudo, 0.85);

  const tx = CX + d.target.x * scale, ty = CY - d.target.y * scale;
  ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#e53935'; ctx.fill();

  ctx.font = '9px monospace'; ctx.textAlign = 'left';
  ([
    [COLORS.pseudo,    `疑似逆行列 (${d.pseudo.iters}回${d.pseudo.converged ? '' : ' ✗'})`],
    [COLORS.transpose, `転置 (${d.transpose.iters}回${d.transpose.converged ? '' : ' ✗'})`],
    [COLORS.damped,    `DLS (${d.damped.iters}回${d.damped.converged ? '' : ' ✗'})`],
  ] as [string, string][]).forEach(([c, label], i) => {
    ctx.fillStyle = c; ctx.fillRect(6, 6 + i * 14, 10, 10);
    ctx.fillStyle = '#ddd'; ctx.fillText(label, 20, 15 + i * 14);
  });
}

function SummaryTable({ data }: { data: DataPoint[] }) {
  if (!data.length) return null;
  const methods: { key: 'pseudo' | 'transpose' | 'damped'; label: string; color: string }[] = [
    { key: 'pseudo',    label: '疑似逆行列',   color: COLORS.pseudo },
    { key: 'transpose', label: 'Jacobian転置', color: COLORS.transpose },
    { key: 'damped',    label: 'DLS',          color: COLORS.damped },
  ];
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, marginTop: 12 }}>
      <thead>
        <tr>
          {['手法','平均','中央値','最大','収束率'].map(h => (
            <th key={h} style={{ color:'#aaa', borderBottom:'1px solid rgba(255,255,255,0.15)', padding:'4px 8px', textAlign: h==='手法' ? 'left' : 'right', fontWeight:'normal' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {methods.map(({ key, label, color }) => {
          const iters = data.map(d => d[key].iters);
          const convRate = Math.round(data.filter(d => d[key].converged).length / data.length * 100);
          const sorted = [...iters].sort((a, b) => a - b);
          const mean = (iters.reduce((s, x) => s + x, 0) / iters.length).toFixed(1);
          const median = sorted[Math.floor(sorted.length / 2)];
          const max = sorted[sorted.length - 1];
          return (
            <tr key={key}>
              <td style={{ padding:'4px 8px', borderBottom:'1px solid rgba(255,255,255,0.06)', color }}>{label}</td>
              {[mean, median, max].map((v, i) => (
                <td key={i} style={{ padding:'4px 8px', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'right' }}>{v}</td>
              ))}
              <td style={{ padding:'4px 8px', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'right', color: convRate === 100 ? '#4caf50' : '#ef5350' }}>{convRate}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Slider({ label, id, min, max, step = 1, value, onChange }: {
  label: string; id: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <label htmlFor={id} style={{ width:130, fontSize:11, color:'#bbb' }}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        style={{ width:120, accentColor:'#4fc3f7' }}
        onChange={e => onChange(+e.target.value)} />
      <span style={{ fontSize:11, width:36, textAlign:'right', color:'#fff' }}>{value}</span>
    </div>
  );
}

export function BenchmarkView() {
  const [params, setParams] = useState<Params>({ l1:100, l2:80, radius:130, lambda:50, maxIters:100, nSamples:36 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [data, setData] = useState<DataPoint[]>([]);

  const graphRef = useRef<HTMLCanvasElement>(null);
  const chainRef = useRef<HTMLCanvasElement>(null);

  const set = useCallback(<K extends keyof Params>(key: K, val: number) => {
    setParams(p => ({ ...p, [key]: val }));
  }, []);

  useEffect(() => {
    setData(runExperiment(params));
    setSelectedIdx(0);
  }, [params]);

  useEffect(() => {
    if (graphRef.current) drawGraph(graphRef.current, data, params.maxIters, selectedIdx);
    if (chainRef.current) drawChain(chainRef.current, data, params, selectedIdx);
  }, [data, selectedIdx, params]);

  function handleGraphClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const PAD_LEFT = 50;
    const gW = canvas.width - PAD_LEFT - 20;
    const frac = Math.max(0, Math.min(1, (x - PAD_LEFT) / gW));
    setSelectedIdx(Math.round(frac * (data.length - 1)));
  }

  const panel: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: 16,
  };

  return (
    <div style={{ fontFamily:'monospace', background:'#1a1a2e', color:'#e0e0e0', padding:20, minHeight:'100vh', overflowY:'auto' }}>
      <h1 style={{ fontSize:18, marginBottom:16, color:'#fff' }}>IK Solver 収束速度比較</h1>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start' }}>

        <div style={{ ...panel, width:280 }}>
          <h2 style={{ fontSize:12, fontWeight:'bold', color:'#aaa', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>パラメータ</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            <Slider label="リンク1 長さ" id="l1" min={40} max={150} value={params.l1} onChange={v => set('l1', v)} />
            <Slider label="リンク2 長さ" id="l2" min={40} max={150} value={params.l2} onChange={v => set('l2', v)} />
            <Slider label="目標半径"     id="r"  min={30} max={220} value={params.radius} onChange={v => set('radius', v)} />
            <Slider label="DLS λ"       id="lam" min={1} max={100} value={params.lambda} onChange={v => set('lambda', v)} />
            <Slider label="最大反復回数" id="mi" min={10} max={500} value={params.maxIters} onChange={v => set('maxIters', v)} />
            <Slider label="サンプル数"   id="ns" min={8} max={100} step={4} value={params.nSamples} onChange={v => set('nSamples', v)} />
          </div>

          <hr style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.12)', margin:'12px 0' }} />
          <h2 style={{ fontSize:12, fontWeight:'bold', color:'#aaa', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>チェーン可視化（選択目標）</h2>
          <canvas ref={chainRef} width={248} height={248} style={{ display:'block', background:'#0f0f23', borderRadius:4 }} />
          <div style={{ fontSize:10, color:'#888', marginTop:6 }}>グラフ上の点をクリックして目標を選択</div>

          <hr style={{ border:'none', borderTop:'1px solid rgba(255,255,255,0.12)', margin:'12px 0' }} />
          <h2 style={{ fontSize:12, fontWeight:'bold', color:'#aaa', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>統計サマリ</h2>
          <SummaryTable data={data} />
        </div>

        <div style={{ ...panel, flex:1, minWidth:420 }}>
          <h2 style={{ fontSize:12, fontWeight:'bold', color:'#aaa', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>反復回数 vs 目標角度</h2>
          <div style={{ display:'flex', gap:14, marginBottom:8, flexWrap:'wrap' }}>
            {([['#4fc3f7','疑似逆行列'], ['#81c784','Jacobian転置'], ['#ffb74d','DLS']] as [string,string][]).map(([c, label]) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#ccc' }}>
                <div style={{ width:14, height:14, borderRadius:3, background:c }} />{label}
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#ccc' }}>
              <div style={{ width:14, height:14, borderRadius:3, background:'#555', border:'1px dashed #888' }} />非収束
            </div>
          </div>
          <canvas ref={graphRef} width={600} height={380}
            style={{ display:'block', background:'#0f0f23', borderRadius:4, cursor:'crosshair', maxWidth:'100%' }}
            onClick={handleGraphClick} />
          <div style={{ fontSize:10, color:'#888', marginTop:6, textAlign:'center' }}>
            ▲ 非収束の場合は最大反復回数に達したことを示す
          </div>
        </div>

      </div>
    </div>
  );
}
