/**
 * Bloch Golf - Main Application
 *
 * A quantum computing educational game where players use quantum gates
 * to navigate a golf ball on the Bloch sphere to target quantum states.
 *
 * The circuit is declarative: the ball position always reflects the circuit state.
 * - Gate added: animate from previous position
 * - Gate deleted: instantly move to correct position (no animation)
 * - Gate edited: animate from the state before the edited gate
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
  calculateBlochState,
  countGates,
  detectCircuitChange,
} from "./utils/quantum";
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

  // Animation state
  const [triggerAnimation, setTriggerAnimation] = useState(false);
  const [gatesToAnimate, setGatesToAnimate] = useState<Gate[] | null>(null);
  const [animationStartState, setAnimationStartState] =
    useState<BlochState | null>(null);

  // Display state (where the ball should be displayed)
  const [displayState, setDisplayState] =
    useState<BlochState>(INITIAL_BLOCH_STATE);

  // Track previous circuit for change detection
  const prevCircuitRef = useRef<Circuit>(INITIAL_CIRCUIT);
  const isAnimatingRef = useRef(false);

  // Handle circuit changes from QamposerMicro
  const handleCircuitChange = useCallback(
    (newCircuit: Circuit) => {
      if (isAnimatingRef.current) {
        // Don't process changes during animation
        return;
      }

      const prevCircuit = prevCircuitRef.current;
      const change = detectCircuitChange(prevCircuit, newCircuit);

      // Calculate the target state from the new circuit
      const targetBallState =
        newCircuit.gates.length > 0
          ? calculateBlochState(newCircuit)
          : INITIAL_BLOCH_STATE;

      // Handle based on change type
      switch (change.type) {
        case "none":
          // No change, do nothing
          break;

        case "add":
          // Gate added: animate the added gates
          setAnimationStartState(change.startState);
          setGatesToAnimate(change.addedGates);
          setDisplayState(targetBallState);
          isAnimatingRef.current = true;
          setTriggerAnimation(true);

          // Update strokes
          setGameState((prev) => ({
            ...prev,
            isAnimating: true,
            currentStrokes: prev.currentStrokes + change.addedGates.length,
            totalStrokes: prev.totalStrokes + change.addedGates.length,
          }));
          break;

        case "delete":
          // Gate deleted: instantly move to correct position
          setDisplayState(change.newState);
          setGatesToAnimate(null);
          setAnimationStartState(null);

          // Check if we're in the hole after deletion
          const inHoleAfterDelete = isInHole(
            change.newState,
            gameState.targetState.state,
          );
          setGameState((prev) => ({
            ...prev,
            currentState: change.newState,
            isHoleComplete: inHoleAfterDelete,
            totalScore:
              inHoleAfterDelete && !prev.isHoleComplete
                ? prev.totalScore +
                  (prev.currentStrokes - gameState.targetState.par)
                : prev.totalScore,
          }));
          break;

        case "edit":
          // Gate edited: animate from the state before the edited gate
          setAnimationStartState(change.startState);
          setGatesToAnimate(change.gatesFromEdit);
          setDisplayState(targetBallState);
          isAnimatingRef.current = true;
          setTriggerAnimation(true);

          setGameState((prev) => ({
            ...prev,
            isAnimating: true,
          }));
          break;
      }

      // Update refs
      prevCircuitRef.current = newCircuit;
      setCircuit(newCircuit);
    },
    [gameState.targetState],
  );

  // Handle animation completion
  const handleAnimationComplete = useCallback(() => {
    isAnimatingRef.current = false;
    setTriggerAnimation(false);
    setGatesToAnimate(null);
    setAnimationStartState(null);

    // Check if we're in the hole
    const inHole = isInHole(displayState, gameState.targetState.state);

    setGameState((prev) => ({
      ...prev,
      currentState: displayState,
      isAnimating: false,
      isHoleComplete: inHole,
      totalScore:
        inHole && !prev.isHoleComplete
          ? prev.totalScore + (prev.currentStrokes - gameState.targetState.par)
          : prev.totalScore,
    }));
  }, [displayState, gameState.targetState]);

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
    setGameState(createInitialGameState());
    setCircuit(INITIAL_CIRCUIT);
    prevCircuitRef.current = INITIAL_CIRCUIT;
    setDisplayState(INITIAL_BLOCH_STATE);
    setTriggerAnimation(false);
    setGatesToAnimate(null);
    setAnimationStartState(null);
    isAnimatingRef.current = false;
    setEditorKey((k) => k + 1);
  }, []);

  // Sync displayState with currentState when not animating
  useEffect(() => {
    if (!isAnimatingRef.current) {
      setDisplayState(gameState.currentState);
    }
  }, [gameState.currentState]);

  return (
    <div className="app">
      <div className="app-layout">
        {/* Left panel: Game info */}
        <aside className="sidebar">
          <GamePanel
            gameState={gameState}
            onNextHole={handleNextHole}
            onReset={handleReset}
          />
        </aside>

        {/* Center: Bloch sphere visualization */}
        <main className="main-content">
          <div className="bloch-container">
            <BlochScene
              displayState={displayState}
              targetState={gameState.targetState.state}
              gatesToAnimate={gatesToAnimate}
              animationStartState={animationStartState}
              triggerAnimation={triggerAnimation}
              isHoleComplete={gameState.isHoleComplete}
              onAnimationComplete={handleAnimationComplete}
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
                  const emptyCircuit = { ...INITIAL_CIRCUIT };
                  handleCircuitChange(emptyCircuit);
                }}
                disabled={gameState.isAnimating || circuit.gates.length === 0}
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
