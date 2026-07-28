/**
 * Game Panel Component
 *
 * Displays game status, current hole info, and score.
 */

import type { GameState } from '../../types/game';
import { getScoreText } from '../../types/game';
import './GamePanel.css';

interface GamePanelProps {
  gameState: GameState;
  onNextHole: () => void;
  onReset: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export function GamePanel({
  gameState,
  onNextHole,
  onReset,
  soundOn,
  onToggleSound,
}: GamePanelProps) {
  const {
    currentHole,
    currentStrokes,
    targetState,
    isHoleComplete,
    totalScore,
  } = gameState;

  const scoreClass = totalScore < 0 ? 'under-par' : totalScore > 0 ? 'over-par' : 'par';
  const totalText = totalScore === 0 ? 'E' : totalScore > 0 ? `+${totalScore}` : `${totalScore}`;

  return (
    <div className="game-panel">
      <div className="game-panel-header">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true"></span>
          <h2 className="game-title">Bloch Golf</h2>
        </div>
        <div className="hole-indicator">Hole {String(currentHole).padStart(2, '0')}</div>
      </div>

      <div className="target-info">
        <div className="target-label">Target</div>
        <div className="target-state">{targetState.displayName}</div>
        <div className="target-name">{targetState.name}</div>
        <div className="par-info">Par {targetState.par}</div>
      </div>

      <div className="score-section">
        <div className="current-strokes">
          <span className="strokes-label">Strokes</span>
          <span className="strokes-value">{currentStrokes}</span>
        </div>

        <div className="total-score">
          <span className="score-label">Total</span>
          <span className={`score-value ${scoreClass}`}>{totalText}</span>
        </div>
      </div>

      {isHoleComplete && (
        <div className="hole-complete">
          <div className="complete-message">
            {getScoreText(currentStrokes, targetState.par)}
          </div>
          <button className="next-hole-btn" onClick={onNextHole}>
            Next Hole →
          </button>
        </div>
      )}

      <div className="instructions">
        <h3>How to Play</h3>
        <ol>
          <li>Add quantum gates to the circuit</li>
          <li>Watch the ball roll in real-time</li>
          <li>Navigate to the target state</li>
          <li>Fewer gates = better score!</li>
        </ol>
      </div>

      <div className="game-actions">
        <button className="reset-btn" onClick={onReset}>
          Reset Game
        </button>
        <button
          className="sound-btn"
          onClick={onToggleSound}
          aria-pressed={soundOn}
          title={soundOn ? 'Mute impact sound' : 'Unmute impact sound'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  );
}
