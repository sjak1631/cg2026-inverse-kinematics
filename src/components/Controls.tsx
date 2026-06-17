import React from 'react';
import { IKResult, PoseMode, CharacterState } from '../ik/types';
import { PosePreview } from './PosePreview';

const MODES: { id: PoseMode; label: string }[] = [
  { id: 'FK',                label: 'Forward Kinematics' },
  { id: 'CCD',               label: 'CCD' },
  { id: 'Jacobian',          label: 'Jacobian (疑似逆行列)' },
  { id: 'JacobianTranspose', label: 'Jacobian 転置' },
  { id: 'JacobianDamped',    label: 'Jacobian (DLS)' },
];

function Btn({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: color,
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        padding: '6px 0',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
      }}
    >
      {label}
    </button>
  );
}

type Mechanism = 'humanoid' | 'chain';

interface Props {
  mode: PoseMode;
  onChange: (m: PoseMode) => void;
  mechanism: Mechanism;
  onMechanism: (m: Mechanism) => void;
  linkCount: number;
  onLinkCount: (n: number) => void;
  lambda: number;
  onLambda: (v: number) => void;
  threshold: number;
  onThreshold: (v: number) => void;
  phase: 'idle' | 'active';
  onStart: () => void;
  onFinish: () => void;
  onRestart: () => void;
  targetPose: CharacterState | null;
  matchRate: number;
  elapsed: number;
  lastSuccessTime: number | null;
  ikStats: IKResult | null;
}

export function Controls({
  mode, onChange, mechanism, onMechanism, linkCount, onLinkCount, lambda, onLambda,
  threshold, onThreshold,
  phase, onStart, onFinish, onRestart,
  targetPose, matchRate, elapsed, lastSuccessTime, ikStats,
}: Props) {
  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: 10,
      background: 'rgba(80, 80, 80, 0.82)',
      border: '1px solid rgba(50, 50, 50, 0.5)',
      borderRadius: 6,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      fontFamily: 'monospace',
      color: '#ffffff',
      minWidth: 200,
      backdropFilter: 'blur(6px)',
    }}>

      {/* Mechanism toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['humanoid', 'chain'] as Mechanism[]).map(m => (
          <button
            key={m}
            onClick={() => onMechanism(m)}
            style={{
              flex: 1, border: 'none', borderRadius: 4, padding: '5px 0',
              fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', cursor: 'pointer',
              background: mechanism === m ? '#4fc3f7' : 'rgba(255,255,255,0.12)',
              color: mechanism === m ? '#111' : '#ccc',
            }}
          >
            {m === 'humanoid' ? '人型' : 'チェーン'}
          </button>
        ))}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', margin: 0 }} />

      {/* Mode selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 'bold' }}>モード選択</label>
        <div style={{ position: 'relative' }}>
          <select
            value={mode}
            onChange={e => onChange(e.target.value as PoseMode)}
            disabled={phase === 'active'}
            style={{
              width: '100%',
              padding: '5px 24px 5px 8px',
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 4,
              fontFamily: 'monospace',
              fontSize: 12,
              cursor: phase === 'active' ? 'not-allowed' : 'pointer',
              outline: 'none',
              appearance: 'none' as const,
            }}
          >
            {MODES.map(m => (
              <option key={m.id} value={m.id} style={{ background: '#555', color: '#fff' }}>
                {m.label}
              </option>
            ))}
          </select>
          <span style={{
            position: 'absolute', right: 7, top: '50%',
            transform: 'translateY(-50%)',
            color: '#ddd', pointerEvents: 'none', fontSize: 9,
          }}>▼</span>
        </div>
      </div>

      {/* DLS lambda (JacobianDamped only) */}
      {mode === 'JacobianDamped' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <label style={{ fontWeight: 'bold' }}>λ (DLS)</label>
            <span style={{ color: '#ffb74d' }}>{lambda}</span>
          </div>
          <input
            type="range" min={1} max={200} value={lambda}
            onChange={e => onLambda(+e.target.value)}
            style={{ width: '100%', accentColor: '#ffb74d' }}
          />
        </div>
      )}

      {/* Link count (chain only) */}
      {mechanism === 'chain' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <label style={{ fontWeight: 'bold' }}>リンク数</label>
            <span style={{ color: '#4fc3f7' }}>{linkCount}</span>
          </div>
          <input
            type="range" min={1} max={20} value={linkCount}
            onChange={e => onLinkCount(+e.target.value)}
            style={{ width: '100%', accentColor: '#4fc3f7' }}
          />
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', margin: 0 }} />

      {/* Challenge section (humanoid only) */}
      {mechanism === 'humanoid' && (phase === 'idle' ? (
        /* ---- Idle ---- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={onStart}
            style={{
              width: '100%',
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '7px 0',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 'bold',
              letterSpacing: 1,
            }}
          >
            START
          </button>

          {lastSuccessTime !== null && (
            <div style={{ fontSize: 11, color: '#e0e0e0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#4caf50', fontWeight: 'bold' }}>前回</span>
              <span>{lastSuccessTime.toFixed(2)} 秒</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <label>許容一致率</label>
              <span style={{ color: '#4caf50' }}>{threshold}%</span>
            </div>
            <input
              type="range" min={50} max={100} value={threshold}
              onChange={e => onThreshold(+e.target.value)}
              style={{ width: '100%', accentColor: '#4caf50' }}
            />
          </div>
        </div>
      ) : (
        /* ---- Active ---- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn label="FINISH"  onClick={onFinish}  color="#ef5350" />
            <Btn label="RESTART" onClick={onRestart} color="#546e7a" />
          </div>

          {/* Target preview */}
          {targetPose && (
            <>
              <div style={{ fontSize: 10, color: '#ccc' }}>ターゲット姿勢</div>
              <PosePreview character={targetPose} />
            </>
          )}

          {/* Match rate bar */}
          <div style={{ fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>一致率</span>
              <span style={{ color: matchRate >= threshold ? '#4caf50' : matchRate >= threshold * 0.7 ? '#ff9800' : '#fff' }}>
                {matchRate.toFixed(1)}%
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 3, height: 6 }}>
              <div style={{
                width: `${Math.min(matchRate, 100)}%`,
                height: '100%',
                borderRadius: 3,
                background: matchRate >= threshold ? '#4caf50' : matchRate >= threshold * 0.7 ? '#ff9800' : '#e0e0e0',
                transition: 'width 0.15s, background 0.3s',
              }} />
            </div>
          </div>

          {/* Timer */}
          <div style={{ textAlign: 'right', fontSize: 11, color: '#ccc' }}>
            {elapsed.toFixed(1)} 秒
          </div>
        </div>
      ))}

      {/* IK Stats */}
      {ikStats && mode !== 'FK' && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', margin: 0 }} />
          <div style={{ fontSize: 11, color: '#e0e0e0', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 1 }}>直近の統計</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#aaa' }}>反復回数</span>
              <span>{ikStats.iters}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#aaa' }}>収束</span>
              <span style={{ color: ikStats.converged ? '#4caf50' : '#ef5350' }}>
                {ikStats.converged ? '✓' : '✗'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#aaa' }}>処理時間</span>
              <span>{ikStats.elapsed.toFixed(2)} ms</span>
            </div>
          </div>
        </>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', margin: 0 }} />

      {/* Legend */}
      <div style={{ fontSize: 11, color: '#e0e0e0', lineHeight: 1.9 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 2 }}>操作方法</div>
        <div><span style={{ color: '#2196f3' }}>●</span> 胴体 — ドラッグで移動</div>
        <div><span style={{ color: '#e53935' }}>●</span> 関節 — ドラッグで操作</div>
        <div style={{ color: '#cccccc' }}>各長方形をつかんでも操作可能</div>
      </div>
    </div>
  );
}
