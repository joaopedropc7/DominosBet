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

// ─── Board layout ─────────────────────────────────────────────────────────────
//
// DESKTOP  (screenW ≥ 700 px) — wide horizontal-scroll canvas
//   200 slots × 28 px.  Anchor at slot 100.  Left plays grow leftward,
//   right plays grow rightward.  The ScrollView is scrolled so the anchor
//   tile starts centred on screen.
//
// MOBILE   (screenW < 700 px) — serpentine / snake layout
//   Tiles are laid out in a compact snake that wraps at the screen edge:
//     Row 0 (LTR) → Row 1 (RTL) → Row 2 (LTR) → …
//   Two slots (GHOST_RESERVE) are always kept empty at the start of row 0 so
//   the left-chain ghost drop-zone fits immediately to the left of board[0].
//
//   RTL tiles get swapPips=true: orientTile() ensures board[i].right ===
//   board[i+1].left, so in an RTL row the connecting end (tile.left) must be
//   shown on the physical RIGHT of the tile — opposite of the normal LTR
//   convention — to stay visually adjacent to the previous tile.
//
// ─────────────────────────────────────────────────────────────────────────────

export const LINEAR_TOTAL_SLOTS = 200;
export const LINEAR_ANCHOR_SLOT = 100;

/** px threshold below which the serpentine layout is used. */
const MOBILE_BREAKPOINT = 700;
/** Slots reserved at the start of serpentine row 0 for the left ghost. */
const GHOST_RESERVE = 2;

export type LinearTilePos = {
  tileId: string;
  left: number;
  top: number;
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
  /** x offset to scroll so the anchor tile is centred on screen (desktop). */
  anchorScrollX: number;
};

/**
 * Compute the board layout.
 * Desktop (≥ 700 px wide): single wide horizontal-scroll canvas.
 * Mobile  (<  700 px wide): compact serpentine that wraps within screen width.
 *
 * @param board      Chain-ordered tile array: board[0] = leftmost tile.
 * @param containerH Available pixel height of the board view.
 * @param screenW    Visible screen / viewport width in pixels.
 */
export function computeLinearLayout(
  board: { id: string; left: number; right: number }[],
  containerH: number,
  screenW: number,
): LinearBoardLayout {
  return screenW >= MOBILE_BREAKPOINT
    ? computeHorizontalLayout(board, containerH, screenW)
    : computeSerpentineLayout(board, containerH, screenW);
}

// ── Desktop: single infinite horizontal canvas ───────────────────────────────

function computeHorizontalLayout(
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

  // 3 visual rows: row 0 = above chain (double top), row 1 = chain, row 2 = below
  const CHAIN_ROW = 1;
  const ROWS = 3;
  const padV = Math.max(4, (containerH - ROWS * S) / 2);
  const chainTop = padV + CHAIN_ROW * S;

  const anchorIdx = board.findIndex(
    (t) => !t.id.endsWith('-l') && !t.id.endsWith('-r'),
  );
  const anchorIdxEff = anchorIdx === -1 ? 0 : anchorIdx;

  const slotCol = new Map<string, number>();

  let col = ANCHOR;
  for (let i = anchorIdxEff; i < board.length; i++) {
    const tile = board[i];
    slotCol.set(tile.id, col);
    col += tile.left === tile.right ? 1 : 2;
  }

  col = ANCHOR;
  for (let i = anchorIdxEff - 1; i >= 0; i--) {
    const tile = board[i];
    const w = tile.left === tile.right ? 1 : 2;
    col -= w;
    slotCol.set(tile.id, col);
  }

  const colToX = (c: number) => PAD_H + c * S;

  const tilePositions: LinearTilePos[] = board.map((tile) => {
    const c = slotCol.get(tile.id) ?? ANCHOR;
    const isDouble = tile.left === tile.right;
    return {
      tileId: tile.id,
      left: colToX(c),
      top: isDouble ? chainTop - S : chainTop,
      orientation: isDouble ? 'vertical' : 'horizontal',
      swapPips: false, // orientTile() already handles left/right orientation
    };
  });

  const ghostW   = 2 * S;
  const ghostH   = S;
  const ghostTop = chainTop;

  let rightGhost: LinearGhostPos | null = null;
  let leftGhost:  LinearGhostPos | null = null;

  if (board.length > 0) {
    const rt = board[board.length - 1];
    const rc = slotCol.get(rt.id) ?? ANCHOR;
    const rw = rt.left === rt.right ? 1 : 2;
    rightGhost = { left: colToX(rc + rw), top: ghostTop, width: ghostW, height: ghostH };

    const lt = board[0];
    const lc = slotCol.get(lt.id) ?? ANCHOR;
    leftGhost  = { left: colToX(lc - 2), top: ghostTop, width: ghostW, height: ghostH };
  }

  const anchorScrollX = Math.max(0, colToX(ANCHOR) - screenW / 2 + S);
  return { canvasWidth, canvasHeight, tilePositions, rightGhost, leftGhost, anchorScrollX };
}

// ── Mobile: serpentine (snake) layout ────────────────────────────────────────
//
// STABLE POSITIONS: each tile is assigned a snake-position based on its
// distance from the ANCHOR tile (the first tile ever played), not from
// board[0].  This means positions never shift when tiles are added to either
// chain end — only the new tile itself appears; all others are frozen.
//
// Snake model
// ───────────
//   Snake positions 0, 1, 2, … increase continuously.
//   Row r contains positions [r*colsPerRow … (r+1)*colsPerRow − 1].
//   Even rows (r%2=0) go LTR: pos p → physical col  p % colsPerRow.
//   Odd  rows (r%2=1) go RTL: pos p → physical col  colsPerRow−1 − p%colsPerRow.
//
//   A 2-wide normal tile occupies positions [p, p+1]; both must be in the
//   same row (no straddling).  snapForward / snapBackward skip one slot when
//   a tile would straddle a row boundary.
//
// Anchor placement
// ────────────────
//   LEFT_RESERVE = ceil(MAX_LEFT_SLOTS/colsPerRow)*colsPerRow + 2
//   where MAX_LEFT_SLOTS = 32 (≥ worst-case left chain + boundary skips).
//   This makes LEFT_RESERVE = N*colsPerRow + 2, so the anchor always starts
//   at posInRow=2 in its row, with the left ghost filling posInRow 0–1 of
//   the SAME row — always visually adjacent, never with gaps.
//
// swapPips for RTL tiles
// ──────────────────────
//   orientTile() guarantees board[i].right === board[i+1].left.  In an RTL
//   row the "outgoing" end (tile.left) occupies the higher-numbered snake
//   position → physical LEFT column, but DominoTileView draws tile.left on
//   the left by default.  So for RTL we set swapPips=true to render
//   tile.right on the physical left (connection end) and tile.left on the
//   physical right (outgoing end), keeping the chain visually consistent.

/** Max slots reserved before the anchor for the left chain + ghost. */
const MAX_LEFT_SLOTS = 32;

function computeSerpentineLayout(
  board: { id: string; left: number; right: number }[],
  containerH: number,
  screenW: number,
): LinearBoardLayout {
  const S         = SLOT_PX;
  const PAD_H     = 6;
  const PAD_V     = 6;
  const ROW_STRIDE = 2 * S;

  const colsPerRow = Math.max(6, Math.floor((screenW - PAD_H * 2) / S));

  // LEFT_RESERVE is always N*colsPerRow + 2, guaranteeing:
  //   • anchor starts at posInRow=2 in its row
  //   • left ghost fills posInRow 0–1 of the same row (gap-free adjacency)
  const leftRows   = Math.ceil(MAX_LEFT_SLOTS / colsPerRow);
  const LEFT_RESERVE = leftRows * colsPerRow + 2;

  // ── Find anchor (first tile played; no -l / -r suffix) ───────────────────
  const anchorIdx    = board.findIndex(t => !t.id.endsWith('-l') && !t.id.endsWith('-r'));
  const anchorIdxEff = anchorIdx === -1 ? 0 : anchorIdx;

  // Map tile.id → its snake start-position (stable)
  const snakePos    = new Map<string, number>();
  // Map tile.id → true when the tile is a forced-vertical corner piece
  const isCornerMap = new Map<string, boolean>();

  // ── Right chain: advance forward from LEFT_RESERVE (corner-aware) ─────────
  let rightCursorFinal = LEFT_RESERVE; // exposed for ghost calculation below
  {
    let cursor          = LEFT_RESERVE;
    let cornerPending   = 0;

    for (let i = anchorIdxEff; i < board.length; i++) {
      const tile     = board[i];
      const isDouble = tile.left === tile.right;
      const tileW    = isDouble ? 1 : 2;

      // Check overflow only when not already in corner mode
      if (cornerPending === 0) {
        const posInRow = cursor % colsPerRow;
        if (posInRow + tileW > colsPerRow) {
          // Overflow → jump to corner start (posInRow = colsPerRow−2) in THIS row
          cornerPending      = 2;
          const rowStart     = Math.floor(cursor / colsPerRow) * colsPerRow;
          cursor             = rowStart + (colsPerRow - 2); // V1 position
        }
      }

      snakePos.set(tile.id, cursor);
      const isCorner = cornerPending > 0 && !isDouble;
      isCornerMap.set(tile.id, isCorner);

      if (cornerPending > 0) {
        cornerPending--;
        if (cornerPending > 0) {
          cursor += 1; // V1 → V2 (step one posInRow toward the edge)
        } else {
          // V2 done → move to next row, skip the 2 occupied corner cols (posInRow 0 & 1)
          const nextRowStart = (Math.floor(cursor / colsPerRow) + 1) * colsPerRow;
          cursor             = nextRowStart + 2;
        }
      } else {
        cursor += tileW;
      }
    }
    rightCursorFinal = cursor;
  }

  // ── Left chain: go backward from LEFT_RESERVE − 1 ────────────────────────
  let leftCursor = LEFT_RESERVE - 1; // rightmost available pos for left chain
  for (let i = anchorIdxEff - 1; i >= 0; i--) {
    const tile  = board[i];
    const tileW = tile.left === tile.right ? 1 : 2;
    const start = snakeSnapBackward(leftCursor, tileW, colsPerRow);
    snakePos.set(tile.id, start);
    isCornerMap.set(tile.id, false);
    leftCursor = start - 1;
  }

  // ── Pixel positions ───────────────────────────────────────────────────────
  const tilePositions: LinearTilePos[] = board.map(tile => {
    const sp       = snakePos.get(tile.id) ?? LEFT_RESERVE;
    const isDouble = tile.left === tile.right;
    const isCorner = isCornerMap.get(tile.id) ?? false;
    const layout   = snakePosToLayout(sp, isDouble, isCorner, colsPerRow, PAD_H, PAD_V, ROW_STRIDE, S);
    return { ...layout, tileId: tile.id };
  });

  // ── Ghost drop zones ──────────────────────────────────────────────────────
  const ghostW = 2 * S;
  const ghostH = S;

  // Right ghost: where the next right tile would go.
  // If the cursor is at a corner-overflow position, show ghost at the corner start.
  const rgGhostCursor = (() => {
    const posInRow = rightCursorFinal % colsPerRow;
    if (posInRow + 2 > colsPerRow) {
      // Would trigger corners — show ghost at V1 column
      return Math.floor(rightCursorFinal / colsPerRow) * colsPerRow + (colsPerRow - 2);
    }
    return rightCursorFinal;
  })();
  const rightGhost: LinearGhostPos | null = board.length > 0
    ? snakePosToGhost(rgGhostCursor, colsPerRow, PAD_H, PAD_V, ROW_STRIDE, S, ghostW, ghostH)
    : null;

  // Left ghost: where the next left tile would go (always in posInRow 0–1
  // of the anchor's row before any left tiles are added, and steps
  // backward as left tiles fill in)
  const lgStart = snakeSnapBackward(leftCursor, 2, colsPerRow);
  const leftGhost: LinearGhostPos | null = board.length > 0
    ? snakePosToGhost(lgStart, colsPerRow, PAD_H, PAD_V, ROW_STRIDE, S, ghostW, ghostH)
    : null;

  // ── Canvas dimensions ─────────────────────────────────────────────────────
  const maxSp   = board.length > 0 ? Math.max(...snakePos.values()) + 1 : LEFT_RESERVE + 2;
  const maxRow  = Math.floor(maxSp / colsPerRow);
  const numRows = maxRow + 1;
  const canvasHeight = Math.max(containerH, PAD_V * 2 + numRows * ROW_STRIDE + S);

  return {
    canvasWidth: colsPerRow * S + PAD_H * 2,
    canvasHeight,
    tilePositions,
    leftGhost,
    rightGhost,
    anchorScrollX: 0,
  };
}

// ── Serpentine helpers ────────────────────────────────────────────────────────

/**
 * Snap a forward cursor to the next row start if a tileW-wide tile would
 * straddle the current row boundary.
 */
function snakeSnapForward(cursor: number, tileW: number, colsPerRow: number): number {
  if (tileW <= 1) return cursor;
  const posInRow = cursor % colsPerRow;
  if (posInRow + tileW > colsPerRow) {
    return (Math.floor(cursor / colsPerRow) + 1) * colsPerRow;
  }
  return cursor;
}

/**
 * Given that we want to place a tileW-wide tile with its last slot AT OR
 * BEFORE `cursor`, return the start snake-pos (first slot), snapping to the
 * end of the previous row if the tile would straddle.
 */
function snakeSnapBackward(cursor: number, tileW: number, colsPerRow: number): number {
  if (tileW <= 1) return cursor;
  const start    = cursor - tileW + 1;
  const startRow = Math.floor(start / colsPerRow);
  const endRow   = Math.floor(cursor / colsPerRow);
  if (startRow !== endRow) {
    // Straddles: place at end of the row BEFORE cursor's row
    const prevRowEnd = endRow * colsPerRow - 1;
    return prevRowEnd - tileW + 1;
  }
  return start;
}

/**
 * Convert a snake start-position to pixel layout props for one tile.
 *
 * In RTL rows the snake position maps to the RIGHTMOST physical slot of the
 * tile, so the tile's pixel-left is shifted by (tileW−1) slots to the left.
 *
 * Corner tiles (isCorner=true) are forced-vertical non-doubles placed at the
 * row edge when the chain wraps.  They render identically to doubles: 1 slot
 * wide, 2×S tall, vertical orientation.
 */
function snakePosToLayout(
  sp: number,
  isDouble: boolean,
  isCorner: boolean,
  colsPerRow: number,
  PAD_H: number,
  PAD_V: number,
  ROW_STRIDE: number,
  S: number,
): LinearTilePos {
  const row        = Math.floor(sp / colsPerRow);
  const posInRow   = sp % colsPerRow;
  const isLTR      = row % 2 === 0;
  const isVertical = isDouble || isCorner; // both render as 1-wide, 2S tall
  const tileW      = isVertical ? 1 : 2;

  // LTR: posInRow is the leftmost slot of the tile.
  // RTL: posInRow is the rightmost slot; leftmost = colsPerRow−1−posInRow − (tileW−1).
  const pixelLeft = PAD_H + S * (isLTR
    ? posInRow
    : colsPerRow - 1 - posInRow - (tileW - 1));

  return {
    tileId: '',   // caller overwrites via board.map
    left:    pixelLeft,
    top:     isVertical
      ? PAD_V + row * ROW_STRIDE        // spans full 2×S height (doubles & corners)
      : PAD_V + row * ROW_STRIDE + S,  // normal tile occupies lower half
    orientation: isVertical ? 'vertical' : 'horizontal',
    swapPips: !isLTR,
  };
}

/** Pixel bounding box for a 2-wide ghost drop zone at a given snake position. */
function snakePosToGhost(
  sp: number,
  colsPerRow: number,
  PAD_H: number,
  PAD_V: number,
  ROW_STRIDE: number,
  S: number,
  ghostW: number,
  ghostH: number,
): LinearGhostPos {
  const row      = Math.floor(sp / colsPerRow);
  const posInRow = sp % colsPerRow;
  const isLTR    = row % 2 === 0;

  const pixelLeft = PAD_H + S * (isLTR
    ? posInRow
    : colsPerRow - 2 - posInRow);   // 2-wide ghost; same formula as 2-wide tile

  return {
    left:   pixelLeft,
    top:    PAD_V + row * ROW_STRIDE + S,
    width:  ghostW,
    height: ghostH,
  };
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
