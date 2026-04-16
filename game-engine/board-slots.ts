/**
 * board-slots.ts
 *
 * Slot-based board layout system for a domino game.
 *
 * GRID MODEL
 * ──────────
 * The board is a 2D grid where every cell is a "slot".
 * Each slot has a coordinate (col, row) and holds the pip value of one
 * half of a domino tile.
 *
 *   • col  0 = leftmost column, increases to the right.
 *   • row  0 = bottommost chain-row, increases upward.
 *
 * PIECE PLACEMENT
 * ───────────────
 * Every domino occupies exactly 2 adjacent slots:
 *
 *   Normal  (left ≠ right): two horizontal slots in the same row.
 *     [A][B]  →  slotA at (col, row), slotB at (col±1, row)
 *
 *   Double / corner  (vertical): two vertical slots in the same column.
 *     [A]  →  slotA at (col, row)      ← lower slot
 *     [B]  →  slotB at (col, row+1)   ← upper slot
 *
 * CORNERS
 * ───────
 * When a horizontal row is exhausted the next 2 tiles are placed VERTICALLY
 * at the edge column(s), forming a "corner tower" before the board reverses
 * direction and continues horizontally in the new row.
 *
 *   LTR row ends →  V₁(colN, row R→R+1)  V₂(colN-1, row R→R+1)
 *   RTL row from cursor (colN-2, R)
 *
 * SERPENTINE FLOW
 * ───────────────
 * Even-numbered chain rows flow L→R (LTR).
 * Odd-numbered chain rows flow R→L (RTL).
 *
 * VISUAL NOTE
 * ───────────
 * RTL tiles and ALL vertical tiles carry swapPips=true so the renderer
 * passes { left: tile.right, right: tile.left } to DominoTileView (which
 * always draws tile.left at its own left/top side).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Grid coordinate: col 0 = leftmost, row 0 = bottom chain row. */
export type Coord = { col: number; row: number };

/** One half of a domino tile occupying a single grid slot. */
export type DominoSlot = {
  coord: Coord;
  value: number;       // pip count 0–6
  pieceId: string;
  half: 'a' | 'b';    // 'a' = tile.left half,  'b' = tile.right half
};

/**
 * The full placement record for one domino tile on the board.
 */
export type PiecePlacement = {
  pieceId: string;
  left: number;
  right: number;
  isDouble: boolean;
  orientation: 'horizontal' | 'vertical';
  rowDirection: 'ltr' | 'rtl';
  slotA: Coord;
  slotB: Coord;
  /**
   * true when the renderer should display { left: tile.right, right: tile.left }.
   * Set for RTL normal tiles, all vertical tiles (doubles + corner pieces).
   */
  swapPips: boolean;
};

/** Live board state passed through placePiece calls. */
export type BoardSlotState = {
  /** Total number of slot columns in the grid. */
  cols: number;
  /** Maximum number of rows allowed (hard visual limit). */
  rowLimit: number;
  /** Placed pieces in chain order. */
  placements: PiecePlacement[];
  /** Registry of occupied slots: key = "col,row". */
  occupied: Map<string, DominoSlot>;
  /** Next position where slotA of the incoming tile goes. */
  cursor: Coord;
  /** Current traversal direction. */
  direction: 'ltr' | 'rtl';
  /** Pip value at the open chain end (must match next tile's left value). */
  chainEndValue: number | null;
  /** Grid coord of the open chain end (used to compute wrap destination). */
  chainEndCoord: Coord | null;
  /** Highest row index occupied so far (for canvas-height calculation). */
  maxRow: number;
  /**
   * Number of corner (forced-vertical) pieces still to be placed before
   * returning to normal horizontal flow.  Set to 2 by wrap().
   */
  cornerPending: number;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function key(c: Coord): string {
  return `${c.col},${c.row}`;
}

function isOccupied(b: BoardSlotState, c: Coord): boolean {
  return b.occupied.has(key(c));
}

function occupy(b: BoardSlotState, c: Coord, slot: DominoSlot): void {
  b.occupied.set(key(c), slot);
  if (c.row > b.maxRow) b.maxRow = c.row;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create an empty board.
 * @param cols     Number of slot columns (horizontal limit).
 * @param rowLimit Maximum number of rows (vertical limit). Defaults to 100.
 */
export function initBoardSlots(cols: number, rowLimit = 100, startCursor?: Coord): BoardSlotState {
  const cursor = startCursor ?? { col: 0, row: 0 };
  return {
    cols,
    rowLimit,
    placements: [],
    occupied: new Map(),
    cursor,
    direction: 'ltr',
    chainEndValue: null,
    chainEndCoord: null,
    maxRow: cursor.row,
    cornerPending: 0,
  };
}

/**
 * Check whether a normal (horizontal) tile fits at the current cursor.
 */
function canFit(b: BoardSlotState, isDouble: boolean): boolean {
  const { cursor: c, direction, cols, rowLimit } = b;

  if (c.col < 0 || c.col >= cols) return false;
  if (isOccupied(b, c)) return false;

  if (isDouble) {
    // Needs (col, row) and (col, row+1)
    if (c.row + 1 >= rowLimit) return false;
    return !isOccupied(b, { col: c.col, row: c.row + 1 });
  }

  // Normal horizontal: needs one adjacent slot
  const next = direction === 'ltr'
    ? { col: c.col + 1, row: c.row }
    : { col: c.col - 1, row: c.row };

  return next.col >= 0 && next.col < cols && !isOccupied(b, next);
}

/**
 * Check whether a vertical (corner) piece fits at the current cursor:
 * needs cursor slot and the slot one row above it.
 */
function canFitVertical(b: BoardSlotState): boolean {
  const { cursor: c, cols, rowLimit } = b;
  if (c.col < 0 || c.col >= cols) return false;
  if (isOccupied(b, c)) return false;
  if (c.row + 1 >= rowLimit) return false;
  return !isOccupied(b, { col: c.col, row: c.row + 1 });
}

/**
 * Advance to the next row, flip direction, and mark that 2 corner pieces
 * must be placed before horizontal flow resumes.
 */
function wrap(b: BoardSlotState): void {
  const end = b.chainEndCoord ?? b.cursor;
  const newRow = end.row + 1;

  // Hard vertical limit — leave cursor OOB so placePiece returns null
  if (newRow >= b.rowLimit) return;

  b.direction = b.direction === 'ltr' ? 'rtl' : 'ltr';

  let col = end.col;
  const shift = b.direction === 'ltr' ? 1 : -1;
  // Skip slots that may already be occupied (e.g. a double's upper half)
  while (isOccupied(b, { col, row: newRow })) {
    col += shift;
    if (col < 0 || col >= b.cols) break;
  }
  b.cursor = { col, row: newRow };

  // Signal that the next 2 pieces must be placed as vertical corner pieces
  b.cornerPending = 2;
}

/**
 * Place one tile on the board.
 *
 * The tile's `left` value must equal the current `chainEndValue`
 * (or `chainEndValue` must be null for the very first piece).
 *
 * Corner logic:
 *   • When a row fills and wrap() is triggered, the next 2 non-double tiles
 *     are placed VERTICALLY at the edge column(s) before horizontal flow
 *     continues in the new row.
 *   • A double tile placed during corner mode counts as one corner piece
 *     (it is already vertical).
 *
 * Returns the PiecePlacement on success, or null if the tile cannot be
 * placed (grid full).
 */
export function placePiece(
  board: BoardSlotState,
  tile: { id: string; left: number; right: number },
): PiecePlacement | null {
  const isDouble = tile.left === tile.right;

  // ── Ensure we can place; wrap if not ───────────────────────────────────────
  if (!canFit(board, isDouble)) {
    wrap(board);

    // After wrap, check fit according to the (possibly new) corner mode
    const fitsAfterWrap = (board.cornerPending > 0 && !isDouble)
      ? canFitVertical(board)
      : canFit(board, isDouble);

    if (!fitsAfterWrap) return null; // grid full
  }

  const { cursor, direction } = board;
  let slotA: Coord;
  let slotB: Coord;
  let chainEndCoord: Coord;
  let orientation: 'horizontal' | 'vertical';
  let swapPips: boolean;

  // ── Determine placement type ────────────────────────────────────────────────
  const isCorner = board.cornerPending > 0 && !isDouble;

  if (isDouble) {
    // ── Double: always vertical ───────────────────────────────────────────────
    slotA = { col: cursor.col, row: cursor.row };
    slotB = { col: cursor.col, row: cursor.row + 1 };
    orientation = 'vertical';
    // Chain end stays at the lower slot so the cursor stays on the same row
    chainEndCoord = { col: cursor.col, row: cursor.row };
    board.cursor = {
      col: cursor.col + (direction === 'ltr' ? 1 : -1),
      row: cursor.row,
    };
    swapPips = true;
    // A double counts as one corner piece if we're in corner mode
    if (board.cornerPending > 0) board.cornerPending--;

  } else if (isCorner) {
    // ── Corner: forced vertical non-double ────────────────────────────────────
    slotA = { col: cursor.col, row: cursor.row };
    slotB = { col: cursor.col, row: cursor.row + 1 };
    orientation = 'vertical';
    // Chain end is at the TOP slot
    chainEndCoord = slotB;
    swapPips = true;
    board.cornerPending--;

    if (board.cornerPending > 0) {
      // V1 (first corner): keep same column, jump 2 rows up so V2 stacks
      // directly on top of V1 with no visual gap.
      //   V1 occupies (col, row) and (col, row+1).
      //   V2 must start at (col, row+2) so its bottom pixel == V1's top pixel.
      board.cursor = { col: cursor.col, row: cursor.row + 2 };
    } else {
      // V2 (second corner): cursor moves to the adjacent column at V2's slotB
      // row (= cursor.row + 1) so horizontal flow continues at V2's top level.
      // This makes the trail visually connect to V2, not to V1.
      board.cursor = {
        col: cursor.col + (direction === 'ltr' ? 1 : -1),
        row: cursor.row + 1,
      };
    }

  } else if (direction === 'ltr') {
    // ── Normal LTR horizontal ─────────────────────────────────────────────────
    slotA = { col: cursor.col,     row: cursor.row };
    slotB = { col: cursor.col + 1, row: cursor.row };
    orientation = 'horizontal';
    chainEndCoord = slotB;
    board.cursor = { col: cursor.col + 2, row: cursor.row };
    swapPips = false;

  } else {
    // ── Normal RTL horizontal ─────────────────────────────────────────────────
    slotA = { col: cursor.col,     row: cursor.row };
    slotB = { col: cursor.col - 1, row: cursor.row };
    orientation = 'horizontal';
    chainEndCoord = slotB;
    board.cursor = { col: cursor.col - 2, row: cursor.row };
    swapPips = true;
  }

  // Mark slots as occupied
  occupy(board, slotA, { coord: slotA, value: tile.left,  pieceId: tile.id, half: 'a' });
  occupy(board, slotB, { coord: slotB, value: tile.right, pieceId: tile.id, half: 'b' });

  const placement: PiecePlacement = {
    pieceId: tile.id,
    left: tile.left,
    right: tile.right,
    isDouble,
    orientation,
    rowDirection: direction,
    slotA,
    slotB,
    swapPips,
  };
  board.placements.push(placement);
  board.chainEndValue = tile.right;
  board.chainEndCoord = chainEndCoord;

  return placement;
}

/**
 * Return a 2D grid snapshot: grid[row][col] = pip value or null.
 * Row 0 is the bottommost chain row (printed last when displayed top-to-bottom).
 */
export function getBoardGrid(board: BoardSlotState): (number | null)[][] {
  const rows = board.maxRow + 1;
  const grid: (number | null)[][] = Array.from(
    { length: rows },
    () => Array<number | null>(board.cols).fill(null),
  );
  for (const slot of board.occupied.values()) {
    const { col, row } = slot.coord;
    if (row < rows && col < board.cols) grid[row][col] = slot.value;
  }
  return grid;
}

/**
 * Size (in pixels) of one slot.
 * A normal xs tile is 56×28 px  = 2 slots wide × 1 slot tall.
 * A double xs tile is 28×56 px  = 1 slot wide  × 2 slots tall.
 */
export const SLOT_PX = 28;

// ─── Linear horizontal board layout ──────────────────────────────────────────
//
// Simple matrix model for mobile:
//   • The board is a single horizontal chain in a ScrollView.
//   • Each slot is SLOT_PX × SLOT_PX (28 × 28 px).
//   • Normal tile  (left ≠ right): 2 slots wide, 1 slot tall — horizontal.
//   • Double tile  (left = right):  1 slot wide, 2 slots tall — vertical,
//                                   centered on the chain row (sticks upward).
//   • The first tile played is the ANCHOR at slot column LINEAR_ANCHOR_SLOT.
//     Left-side plays grow leftward; right-side plays grow rightward.
//     Once placed, a tile's column NEVER changes — no reorganization.
//   • The canvas is LINEAR_TOTAL_SLOTS wide, wrapped in a horizontal ScrollView.
//
// Tile ID convention (from the game engine):
//   First tile:   original ID  (e.g. "3-5")
//   Left plays:   "${id}-l"
//   Right plays:  "${id}-r"
// ─────────────────────────────────────────────────────────────────────────────

export const LINEAR_TOTAL_SLOTS = 200; // slots in the full canvas (100 left + 100 right)
export const LINEAR_ANCHOR_SLOT = 100; // column where the first tile is placed

export type LinearTilePos = {
  tileId: string;
  left: number;        // pixel x on the canvas
  top: number;         // pixel y on the canvas
  orientation: 'horizontal' | 'vertical';
  swapPips: boolean;
};

export type LinearGhostPos = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type LinearBoardLayout = {
  canvasWidth: number;
  canvasHeight: number;
  tilePositions: LinearTilePos[];
  rightGhost: LinearGhostPos | null;
  leftGhost: LinearGhostPos | null;
  /** x offset to scroll so the first tile is centered on screen */
  anchorScrollX: number;
};

/**
 * Compute a stable, linear horizontal layout for the domino board.
 *
 * @param board       The board array in chain order: board[0] = leftmost tile.
 * @param containerH  Available height of the board view in pixels.
 * @param screenW     Width of the visible screen/viewport in pixels.
 */
export function computeLinearLayout(
  board: { id: string; left: number; right: number }[],
  containerH: number,
  screenW: number,
): LinearBoardLayout {
  const S = SLOT_PX;
  const TOTAL = LINEAR_TOTAL_SLOTS;
  const ANCHOR = LINEAR_ANCHOR_SLOT;
  const PAD_H = 8;

  const canvasWidth  = TOTAL * S + PAD_H * 2;
  const canvasHeight = containerH;

  // 3 visual rows: row 0 = above chain (double top), row 1 = chain, row 2 = below chain
  const CHAIN_ROW = 1;
  const ROWS = 3;
  const padV = Math.max(4, (containerH - ROWS * S) / 2);
  const chainTop = padV + CHAIN_ROW * S; // pixel y of the chain row top

  // ── Assign absolute slot columns ────────────────────────────────────────────
  // The anchor tile is the first one played (no "-l" or "-r" suffix).
  // Left tiles are prepended to board[] — they have negative distance from ANCHOR.
  // Right tiles are appended to board[] — they have positive distance from ANCHOR.

  const anchorIdx = board.findIndex(
    (t) => !t.id.endsWith('-l') && !t.id.endsWith('-r'),
  );
  const anchorIdxEff = anchorIdx === -1 ? 0 : anchorIdx;

  const slotCol = new Map<string, number>();

  // Anchor + right-of-anchor → grow rightward
  let col = ANCHOR;
  for (let i = anchorIdxEff; i < board.length; i++) {
    const tile = board[i];
    slotCol.set(tile.id, col);
    col += tile.left === tile.right ? 1 : 2;
  }

  // Left-of-anchor → grow leftward
  col = ANCHOR;
  for (let i = anchorIdxEff - 1; i >= 0; i--) {
    const tile = board[i];
    const w = tile.left === tile.right ? 1 : 2;
    col -= w;
    slotCol.set(tile.id, col);
  }

  const colToX = (c: number) => PAD_H + c * S;

  // ── Tile pixel positions ────────────────────────────────────────────────────
  const tilePositions: LinearTilePos[] = board.map((tile) => {
    const c = slotCol.get(tile.id) ?? ANCHOR;
    const isDouble = tile.left === tile.right;
    return {
      tileId: tile.id,
      left: colToX(c),
      // Doubles stick UPWARD from the chain row (top = chainTop - S)
      // Normal tiles sit ON the chain row (top = chainTop)
      top: isDouble ? chainTop - S : chainTop,
      orientation: isDouble ? 'vertical' : 'horizontal',
      swapPips: false, // orientTileForBoard already handles orientation
    };
  });

  // ── Ghost positions (drop zones) ────────────────────────────────────────────
  const ghostW   = 2 * S;
  const ghostH   = S;
  const ghostTop = chainTop;

  let rightGhost: LinearGhostPos | null = null;
  let leftGhost:  LinearGhostPos | null = null;

  if (board.length > 0) {
    const rt  = board[board.length - 1];
    const rc  = slotCol.get(rt.id) ?? ANCHOR;
    const rw  = rt.left === rt.right ? 1 : 2;
    rightGhost = { left: colToX(rc + rw), top: ghostTop, width: ghostW, height: ghostH };

    const lt  = board[0];
    const lc  = slotCol.get(lt.id) ?? ANCHOR;
    leftGhost  = { left: colToX(lc - 2), top: ghostTop, width: ghostW, height: ghostH };
  }

  // ── Scroll offset to center the anchor (first tile) on screen ───────────────
  const anchorScrollX = Math.max(0, colToX(ANCHOR) - screenW / 2 + S);

  return { canvasWidth, canvasHeight, tilePositions, rightGhost, leftGhost, anchorScrollX };
}

/**
 * Convert a PiecePlacement to absolute pixel coordinates for React Native
 * rendering (absolutely positioned inside the board canvas).
 *
 * @param placement  The placement to convert.
 * @param totalRows  board.maxRow + 1  (needed to flip the Y axis).
 * @param padH       Horizontal canvas padding in pixels (default 4).
 * @param padV       Vertical   canvas padding in pixels (default 10).
 *
 * Returns { left, top } — the top-left corner of the tile on the canvas.
 * Width and height are implicit from orientation × SLOT_PX.
 */
export function placementToPixels(
  placement: PiecePlacement,
  totalRows: number,
  padH = 4,
  padV = 10,
): { left: number; top: number } {
  const S = SLOT_PX;

  if (placement.orientation === 'vertical') {
    // Portrait: top-left corner is at the UPPER slot (higher row index = visually higher)
    const col = placement.slotA.col;
    const topRow = Math.max(placement.slotA.row, placement.slotB.row);
    return {
      left: padH + col * S,
      top:  padV + (totalRows - 1 - topRow) * S,
    };
  }

  // Landscape: use the lower column for the tile's left edge
  const leftCol = Math.min(placement.slotA.col, placement.slotB.col);
  const row = placement.slotA.row;
  return {
    left: padH + leftCol * S,
    top:  padV + (totalRows - 1 - row) * S,
  };
}
