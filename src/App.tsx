import { useState, useRef, useCallback, useEffect } from 'react';
import { IKCanvas } from './components/IKCanvas';
import { ChainCanvas } from './components/ChainCanvas';
import { Controls } from './components/Controls';
import { IKResult, PoseMode, CharacterState } from './ik/types';
import { createRandomTargetPose, computeMatchRate } from './ik/challenge';
import './styles.css';

type Phase = 'idle' | 'active';
type AppMode = 'test' | 'analyze';
type Mechanism = 'humanoid' | 'chain';

function AppTabs({ appMode, setAppMode }: { appMode: AppMode; setAppMode: (m: AppMode) => void }) {
  const base: React.CSSProperties = {
    padding: '5px 16px', border: 'none', borderRadius: 4,
    fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold',
    cursor: 'pointer', letterSpacing: 0.5,
  };
  const active: React.CSSProperties   = { ...base, background: '#4fc3f7', color: '#111' };
  const inactive: React.CSSProperties = { ...base, background: 'rgba(255,255,255,0.12)', color: '#ccc' };
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 20,
      display: 'flex', gap: 4,
      background: 'rgba(30,30,50,0.75)', padding: 4, borderRadius: 6,
      backdropFilter: 'blur(6px)',
    }}>
      <button style={appMode === 'test'    ? active : inactive} onClick={() => setAppMode('test')}>Test</button>
      <button style={appMode === 'analyze' ? active : inactive} onClick={() => setAppMode('analyze')}>Analyze</button>
    </div>
  );
}

export default function App() {
  const [appMode, setAppMode]               = useState<AppMode>('test');
  const [mechanism, setMechanism]           = useState<Mechanism>('humanoid');
  const [linkCount, setLinkCount]           = useState(5);
  const [lambda, setLambda]                 = useState(38);
  const [threshold, setThreshold]           = useState(95);
  const [mode, setMode]                     = useState<PoseMode>('FK');
  const [phase, setPhase]                   = useState<Phase>('idle');
  const [targetPose, setTargetPose]         = useState<CharacterState | null>(null);
  const [matchRate, setMatchRate]           = useState(0);
  const [elapsed, setElapsed]               = useState(0);
  const [lastSuccessTime, setLastSuccessTime] = useState<number | null>(null);
  const [resetKey, setResetKey]             = useState(0);
  const [ikStats, setIkStats]               = useState<IKResult | null>(null);

  const startTimeRef    = useRef<number | null>(null);
  const successFiredRef = useRef(false);

  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => {
      if (startTimeRef.current !== null)
        setElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  function startChallenge() {
    startTimeRef.current    = Date.now();
    successFiredRef.current = false;
    setResetKey(k => k + 1);
    setTargetPose(createRandomTargetPose());
    setMatchRate(0);
    setElapsed(0);
    setPhase('active');
  }

  function handleFinish() {
    setPhase('idle');
    setTargetPose(null);
  }

  function handleRestart() {
    startTimeRef.current    = Date.now();
    successFiredRef.current = false;
    setResetKey(k => k + 1);
    setTargetPose(createRandomTargetPose());
    setMatchRate(0);
    setElapsed(0);
  }

  const onMatchRate = useCallback((rate: number) => {
    setMatchRate(rate);
    if (
      rate >= threshold &&
      startTimeRef.current !== null &&
      !successFiredRef.current
    ) {
      successFiredRef.current = true;
      const t = (Date.now() - startTimeRef.current) / 1000;
      setLastSuccessTime(t);
      setPhase('idle');
      setTargetPose(null);
    }
  }, [threshold]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <AppTabs appMode={appMode} setAppMode={setAppMode} />
      {appMode === 'analyze' ? (
        <iframe
          src="/benchmark.html"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="Analyze"
        />
      ) : (
        <>
          {mechanism === 'chain'
            ? <ChainCanvas mode={mode} linkCount={linkCount} lambda={lambda} onStats={setIkStats} />
            : <IKCanvas mode={mode} lambda={lambda} targetPose={targetPose} onMatchRate={onMatchRate} onStats={setIkStats} resetKey={resetKey} />
          }
          <Controls
            mode={mode}
            onChange={setMode}
            mechanism={mechanism}
            onMechanism={setMechanism}
            linkCount={linkCount}
            onLinkCount={setLinkCount}
            lambda={lambda}
            onLambda={setLambda}
            threshold={threshold}
            onThreshold={setThreshold}
            phase={phase}
            onStart={startChallenge}
            onFinish={handleFinish}
            onRestart={handleRestart}
            targetPose={targetPose}
            matchRate={matchRate}
            elapsed={elapsed}
            lastSuccessTime={lastSuccessTime}
            ikStats={ikStats}
          />
        </>
      )}
    </div>
  );
}
