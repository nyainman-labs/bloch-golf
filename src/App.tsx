/**
 * Bloch Golf - Main Application
 *
 * A quantum computing educational game where players use quantum gates
 * to navigate a golf ball on the Bloch sphere to target quantum states.
 *
 * Each gate is one golf shot: the club winds up at the ball, strikes it, and
 * the ball rolls along that gate's rotation. Shots are queued here rather than
 * in the 3D layer so the circuit stays editable while a swing is playing:
 * - Gate added: queued, and played once the shots ahead of it finish
 * - Gate deleted before its swing starts: dropped from the queue, never played
 * - Gate deleted or edited after the ball has played it: the ball rewinds to
 *   that point and the remaining gates are played again
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { QamposerMicro } from "@qamposer/react";
import type { Circuit, Gate } from "@qamposer/react";
import { BlochScene } from "./components/BlochSphere";
import { GamePanel } from "./components/GamePanel";
import {
  createInitialGameState,
  getNextTarget,
  isInHole,
  type GameState,
  type BlochState,
} from "./types/game";
import {
  calculateIntermediateState,
  countGates,
  getSortedGates,
} from "./utils/quantum";
import { buildShots, findDivergence, type Shot } from "./utils/shotQueue";
import { primeAudio, playImpact, isMuted, setMuted } from "./utils/audio";
import "./App.css";

// Initial circuit with single qubit
const INITIAL_CIRCUIT: Circuit = {
  qubits: 1,
  gates: [],
};

// Initial Bloch state |0⟩
const INITIAL_BLOCH_STATE: BlochState = { theta: 0, phi: 0 };

function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [circuit, setCircuit] = useState<Circuit>(INITIAL_CIRCUIT);
  // Bumped on Reset Game to force-remount QamposerMicro (it's uncontrolled via defaultCircuit).
  const [editorKey, setEditorKey] = useState(0);
  const [soundOn, setSoundOn] = useState(() => !isMuted());

  // Where the ball rests once every queued shot has been played
  const [restState, setRestState] = useState<BlochState>(INITIAL_BLOCH_STATE);
  // The shot being played right now
  const [activeShot, setActiveShot] = useState<Shot | null>(null);
  // Bumped to teleport the ball to restState without animating
  const [snapToken, setSnapToken] = useState(0);

  // Mirrors of the above, so the useFrame-driven callbacks below can read and
  // advance the queue without waiting for a React render.
  const shotQueueRef = useRef<Shot[]>([]);
  const activeShotRef = useRef<Shot | null>(null);
  const restStateRef = useRef<BlochState>(INITIAL_BLOCH_STATE);
  /** Gates the ball has already been hit through, including the one in flight */
  const playedGatesRef = useRef<Gate[]>([]);
  /** The circuit's gates in play order, as of the last change */
  const sortedGatesRef = useRef<Gate[]>([]);

  // Browsers only allow an AudioContext to start from a user gesture. Listen
  // broadly and keep retrying until it is actually running, rather than
  // spending a single `once` listener on an event that may not be enough.
  useEffect(() => {
    const events = ["pointerdown", "mousedown", "touchstart", "keydown"] as const;
    const onInput = () => {
      if (primeAudio()) {
        events.forEach((e) => document.removeEventListener(e, onInput));
      }
    };

    events.forEach((e) => document.addEventListener(e, onInput));
    return () => events.forEach((e) => document.removeEventListener(e, onInput));
  }, []);

  // The ball has come to rest with nothing left to play — score the hole.
  const settle = useCallback(
    (finalState: BlochState) => {
      const inHole = isInHole(finalState, gameState.targetState.state);
      const par = gameState.targetState.par;

      setGameState((prev) => ({
        ...prev,
        currentState: finalState,
        isAnimating: false,
        isHoleComplete: inHole,
        totalScore:
          inHole && !prev.isHoleComplete
            ? prev.totalScore + (prev.currentStrokes - par)
            : prev.totalScore,
      }));
    },
    [gameState.targetState],
  );

  // Hand the next queued shot to the 3D layer, or settle if the queue is empty.
  const pumpQueue = useCallback(() => {
    if (activeShotRef.current) return;

    const next = shotQueueRef.current.shift();

    if (!next) {
      setActiveShot(null);
      settle(restStateRef.current);
      return;
    }

    activeShotRef.current = next;
    // Everything up to and including this gate now counts as played, so a
    // later edit to any of it rewinds the ball rather than queueing a shot.
    playedGatesRef.current = sortedGatesRef.current.slice(0, next.gateIndex + 1);
    setActiveShot(next);
    setGameState((prev) => (prev.isAnimating ? prev : { ...prev, isAnimating: true }));
  }, [settle]);

  // Handle circuit changes from QamposerMicro
  const handleCircuitChange = useCallback(
    (newCircuit: Circuit) => {
      // Runs inside the drop/keypress that placed the gate — the most reliable
      // user gesture we get, and always ahead of the impact it will sound.
      primeAudio();

      const newGates = getSortedGates(newCircuit);
      const prevCount = sortedGatesRef.current.length;
      sortedGatesRef.current = newGates;

      const divergence = findDivergence(playedGatesRef.current, newGates);

      if (divergence === null) {
        // The ball's history still matches the circuit, so only the tail it
        // hasn't reached yet needs rebuilding. Added gates land in the queue;
        // gates deleted before their swing started simply drop out of it.
        shotQueueRef.current = buildShots(newGates, playedGatesRef.current.length);
      } else {
        // A gate the ball already played was removed or edited — rewind to just
        // before it and replay everything from there.
        const rewound = calculateIntermediateState(newGates, divergence);

        activeShotRef.current = null;
        playedGatesRef.current = newGates.slice(0, divergence);
        shotQueueRef.current = buildShots(newGates, divergence);
        restStateRef.current = rewound;

        setRestState(rewound);
        setSnapToken((t) => t + 1);
      }

      // Strokes count gates added; deleting one has never refunded a stroke.
      const added = Math.max(0, newGates.length - prevCount);
      if (added > 0) {
        setGameState((prev) => ({
          ...prev,
          currentStrokes: prev.currentStrokes + added,
          totalStrokes: prev.totalStrokes + added,
        }));
      }

      setCircuit(newCircuit);
      pumpQueue();
    },
    [pumpQueue],
  );

  // The current shot has come to rest — commit it and start the next one.
  const handleShotComplete = useCallback(() => {
    const finished = activeShotRef.current;
    activeShotRef.current = null;

    if (finished) {
      restStateRef.current = finished.endState;
      setRestState(finished.endState);
    }

    pumpQueue();
  }, [pumpQueue]);

  const handleImpact = useCallback((strength: number) => {
    playImpact(strength);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundOn((on) => {
      setMuted(on);
      if (!on) primeAudio();
      return !on;
    });
  }, []);

  // Handle next hole — keep the circuit and ball position; only swap the target.
  // The ball stays where the previous hole's flag was, so circuit ↔ ball remain consistent.
  const handleNextHole = useCallback(() => {
    const nextTarget = getNextTarget(gameState.targetState.id);

    setGameState((prev) => ({
      ...prev,
      currentHole: prev.currentHole + 1,
      currentStrokes: 0,
      targetState: nextTarget,
      isHoleComplete: false,
      completedHoles: [...prev.completedHoles, prev.currentHole],
    }));
  }, [gameState.targetState.id]);

  // Handle game reset — also clear QamposerMicro's visible gates via key bump.
  const handleReset = useCallback(() => {
    shotQueueRef.current = [];
    activeShotRef.current = null;
    playedGatesRef.current = [];
    sortedGatesRef.current = [];
    restStateRef.current = INITIAL_BLOCH_STATE;

    setGameState(createInitialGameState());
    setCircuit(INITIAL_CIRCUIT);
    setActiveShot(null);
    setRestState(INITIAL_BLOCH_STATE);
    setSnapToken((t) => t + 1);
    setEditorKey((k) => k + 1);
  }, []);

  return (
    <div className="app">
      <div className="app-layout">
        {/* Left panel: Game info */}
        <aside className="sidebar">
          <GamePanel
            gameState={gameState}
            onNextHole={handleNextHole}
            onReset={handleReset}
            soundOn={soundOn}
            onToggleSound={handleToggleSound}
          />
        </aside>

        {/* Center: Bloch sphere visualization */}
        <main className="main-content">
          <div className="bloch-container">
            <BlochScene
              restState={restState}
              snapToken={snapToken}
              activeShot={activeShot}
              targetState={gameState.targetState.state}
              isHoleComplete={gameState.isHoleComplete}
              onShotComplete={handleShotComplete}
              onImpact={handleImpact}
            />
          </div>

          {/* Circuit editor */}
          <div className="circuit-section">
            <div className="circuit-header">
              <h3>Build Your Shot</h3>
              <div className="gate-count">
                Gates: <span>{countGates(circuit)}</span>
              </div>
            </div>

            <div className="circuit-editor-container">
              <QamposerMicro
                key={editorKey}
                defaultCircuit={circuit}
                onCircuitChange={handleCircuitChange}
                config={{
                  maxQubits: 1,
                  maxGates: 32,
                }}
                showHeader={false}
              />
            </div>

            <div className="circuit-actions">
              <button
                className="clear-btn"
                onClick={() => {
                  handleCircuitChange({ qubits: 1, gates: [] });
                  // QamposerMicro is uncontrolled, so it needs a remount to
                  // drop the gates it is still showing.
                  setEditorKey((k) => k + 1);
                }}
                disabled={circuit.gates.length === 0}
              >
                Clear Circuit
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
