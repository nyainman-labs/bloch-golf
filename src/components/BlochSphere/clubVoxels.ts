/**
 * Voxel Golf Club
 *
 * The club is a few dozen cubes on an integer grid, rendered as a single
 * InstancedMesh. Coordinates are in the club's local frame:
 *
 *   origin = ball centre
 *   +Y     = sphere surface normal (up)
 *   +Z     = the direction the ball will travel — the club face points this way
 *   +X     = right (the swing rotates about this axis)
 *
 * At a shaft angle of 0 the head sits on the ball, so the head voxels straddle
 * y = 0 with their striking face on the z = -1 row (GolfClub offsets the whole
 * club back from there so the face meets the ball's surface, not its centre).
 *
 * Since the swing rotates about X, a voxel's x never affects where it lands at
 * impact — that's why the shaft can sit off to one side like a real iron.
 */

/** Grip, head steel, shaft chrome, face insert (matches --grass-1) */
export const CLUB_PALETTE = ['#2a2e2a', '#8f948c', '#d6d9d2', '#4ea355'] as const;

const GRIP = 0;
const STEEL = 1;
const CHROME = 2;
const FACE = 3;

/** [x, y, z, paletteIndex] */
export type ClubVoxel = readonly [number, number, number, number];

/** Grid height of the butt of the grip — the club pivots around this point */
export const CLUB_PIVOT_Y = 12;

/** Size of one voxel, relative to the ball's radius */
export const CLUB_VOXEL_SCALE = 0.46;

function build(): ClubVoxel[] {
  const voxels: ClubVoxel[] = [];

  // Shaft and grip are 2x2 in cross-section so they read as a club at a
  // distance rather than as a hairline.
  const addColumn = (yFrom: number, yTo: number, palette: number) => {
    for (let y = yFrom; y <= yTo; y++) {
      for (let x = -1; x <= 0; x++) {
        for (let z = -2; z <= -1; z++) {
          voxels.push([x, y, z, palette]);
        }
      }
    }
  };

  addColumn(10, CLUB_PIVOT_Y, GRIP);
  addColumn(2, 9, CHROME);
  addColumn(1, 1, STEEL); // hosel, joining the shaft to the head

  // Head: a blade spanning x = -2..2, two voxels tall and two deep.
  // The z = -1 row is the striking face; its middle three columns are the
  // sweet spot and get the green insert.
  for (let x = -2; x <= 2; x++) {
    for (let y = -1; y <= 0; y++) {
      const isSweetSpot = x >= -1 && x <= 1;
      voxels.push([x, y, -1, isSweetSpot ? FACE : STEEL]);
      voxels.push([x, y, -2, STEEL]);
    }
  }

  return voxels;
}

export const CLUB_VOXELS: readonly ClubVoxel[] = build();
