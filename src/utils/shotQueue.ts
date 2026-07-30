/**
 * Shot Queue
 *
 * A "shot" is one gate the ball still has to be hit through. The app owns a
 * queue of them so that gates can be dropped onto the circuit while an earlier
 * swing is still playing, and so that a gate deleted before its swing starts
 * simply never gets played.
 *
 * Reconciliation is driven by matching the gates the ball has already played
 * against the current circuit — see `findDivergence`.
 */

import type { Gate } from '@qamposer/react';
import type { BlochState } from '../types/game';
import { calculateIntermediateState, gatesEqual } from './quantum';
import { gateToRotation } from './gateRotation';

export interface Shot {
  /** The gate being played */
  gate: Gate;
  /** Ball position at the moment of impact */
  startState: BlochState;
  /** Ball position once the shot comes to rest */
  endState: BlochState;
  /** Index of `gate` within the sorted circuit — how far the ball has progressed */
  gateIndex: number;
}

/**
 * Build the shots for `gates[fromIndex..]`, chained so each starts where the
 * previous one ended.
 *
 * Gates with no Bloch-sphere rotation (CNOT and friends) are skipped: they
 * can't move a single-qubit state, so there's nothing to swing at. Their
 * effect on the chained states is still accounted for, because start/end are
 * derived from `calculateIntermediateState` over the full gate list.
 */
export function buildShots(gates: Gate[], fromIndex: number): Shot[] {
  const shots: Shot[] = [];

  for (let i = Math.max(0, fromIndex); i < gates.length; i++) {
    if (!gateToRotation(gates[i])) continue;

    shots.push({
      gate: gates[i],
      startState: calculateIntermediateState(gates, i),
      endState: calculateIntermediateState(gates, i + 1),
      gateIndex: i,
    });
  }

  return shots;
}

/**
 * Index of the first played gate that no longer matches the circuit, or `null`
 * if the played gates are still an intact prefix of it.
 *
 * `null` means the ball's history is still valid, so only the not-yet-played
 * tail needs rebuilding — that's the case where added gates get queued and
 * deleted-but-unplayed gates quietly disappear.
 *
 * A number means a gate the ball already went through was deleted or edited,
 * so the ball has to be rewound to that point.
 */
export function findDivergence(playedGates: Gate[], newGates: Gate[]): number | null {
  for (let i = 0; i < playedGates.length; i++) {
    if (i >= newGates.length || !gatesEqual(playedGates[i], newGates[i])) {
      return i;
    }
  }
  return null;
}
