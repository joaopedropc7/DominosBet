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
// All tiles are placed from board[0] to board[N] in chain order along
// a snake that starts at (row=0, col=GHOST_RESERVE, dir=LTR):
//
//   Row 0 LTR: col GHOST_RESERVE … colsPerRow−1
//   Row 1 RTL: col colsPerRow−1  … 0
//   Row 2 LTR: col 0             … colsPerRow−1
//   …
//
// Because the snake always starts at col=GHOST_RESERVE, board[0] is always
// at (row=0, col=GHOST_RESERVE).  The left ghost sits at (row=0, col=0),
// always immediately to the left of board[0], even as left-chain tiles are
// prepended (they become the new board[0], at the same starting position).
//
// Each chain row is ROW_STRIDE = 2×SLOT_PX tall so doubles (2 slots high)
// fit without overlapping the row above.  Normal tiles are vertically centred
// in the lower half of the stride.

function computeSerpentineLayout(
  board: { id: string; left: number; right: number }[],
  containerH: number,
  screenW: number,
): LinearBoardLayout {
  const S   = SLOT_PX;
  const PAD_H = 6;
  const PAD_V = 6;
  const GR    = GHOST_RESERVE;

  // Slots that fit across the screen (minimum GR+4 so there is meaningful space)
  const colsPerRow = Math.max(GR + 4, Math.floor((screenW - PAD_H * 2) / S));

  // Each visual row = 2 slots tall
  //   Normal tile (S tall) → top = PAD_V + row*ROW_STRIDE + S
  //   Double tile (2S tall) → top = PAD_V + row*ROW_STRIDE
  const ROW_STRIDE = 2 * S;

  const canvasWidth = colsPerRow * S + PAD_H * 2;

  const tilePositions: LinearTilePos[] = [];

  // Cursor state: chainCol = leftmost slot of the next tile
  let chainRow = 0;
  let chainCol = GR; // row 0 reserves GR slots for the left ghost
  let dir: 'ltr' | 'rtl' = 'ltr';

  for (const tile of board) {
    const isDouble = tile.left === tile.right;
    const tileW    = isDouble ? 1 : 2;

    // ── Wrap to next row if the tile doesn't fit ────────────────────────────
    if (dir === 'ltr' && chainCol + tileW > colsPerRow) {
      chainRow++;
      dir      = 'rtl';
      chainCol = colsPerRow - tileW;
    } else if (dir === 'rtl' && chainCol < 0) {
      chainRow++;
      dir      = 'ltr';
      chainCol = 0; // subsequent LTR rows use the full width (no GHOST_RESERVE)
    }

    tilePositions.push({
      tileId: tile.id,
      left: PAD_H + chainCol * S,
      top: isDouble
        ? PAD_V + chainRow * ROW_STRIDE          // double spans both slots
        : PAD_V + chainRow * ROW_STRIDE + S,     // normal sits in lower slot
      orientation: isDouble ? 'vertical' : 'horizontal',
      // RTL tiles: the connecting end is tile.left but must appear on the
      // physical RIGHT side — opposite the LTR convention.
      swapPips: dir === 'rtl',
    });

    chainCol += dir === 'ltr' ? tileW : -tileW;
  }

  // ── Ghost drop zones ────────────────────────────────────────────────────────
  const ghostW = 2 * S;
  const ghostH = S;
  const rowGhostTop = (r: number) => PAD_V + r * ROW_STRIDE + S;

  // Left ghost: the GHOST_RESERVE area is always at (row=0, col=0)
  const leftGhost: LinearGhostPos | null = board.length > 0
    ? { left: PAD_H, top: rowGhostTop(0), width: ghostW, height: ghostH }
    : null;

  // Right ghost: cursor position after the last tile, wrapping if needed
  let rRow = chainRow;
  let rCol = chainCol;
  let rDir = dir;

  if (rDir === 'ltr' && rCol + 2 > colsPerRow) {
    rRow++;
    rDir = 'rtl';
    rCol = colsPerRow - 2;
  } else if (rDir === 'rtl' && rCol < 0) {
    rRow++;
    rDir = 'ltr';
    rCol = 0;
  }

  const rightGhost: LinearGhostPos | null = board.length > 0
    ? { left: PAD_H + rCol * S, top: rowGhostTop(rRow), width: ghostW, height: ghostH }
    : null;

  // Canvas height: tall enough for all rows, but at least containerH
  const numRows    = Math.max(1, chainRow + 1);
  const computedH  = PAD_V * 2 + numRows * ROW_STRIDE + S;
  const canvasHeight = Math.max(containerH, computedH);

  // No horizontal scrolling needed — canvas fits within screen width
  return {
    canvasWidth,
    canvasHeight,
    tilePositions,
    leftGhost,
    rightGhost,
    anchorScrollX: 0,
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
