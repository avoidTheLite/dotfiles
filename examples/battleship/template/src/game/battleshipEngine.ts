export const BOARD_SIZE = 10;
export const SHIP_LENGTHS: readonly number[] = [5, 4, 3, 3, 2];

export interface ShipBoard {
  ship: boolean[][];
  hit: boolean[][];
  miss: boolean[][];
}

export interface ShotBoard {
  hit: boolean[][];
  miss: boolean[][];
}

export type FireResult = 'miss' | 'hit';

function emptyGrid(): boolean[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
}

export function createEmptyShipBoard(): ShipBoard {
  return { ship: emptyGrid(), hit: emptyGrid(), miss: emptyGrid() };
}

export function createEmptyShotBoard(): ShotBoard {
  return { hit: emptyGrid(), miss: emptyGrid() };
}

export function cloneShipBoard(b: ShipBoard): ShipBoard {
  return {
    ship: b.ship.map((row) => [...row]),
    hit: b.hit.map((row) => [...row]),
    miss: b.miss.map((row) => [...row]),
  };
}

export function cloneShotBoard(b: ShotBoard): ShotBoard {
  return {
    hit: b.hit.map((row) => [...row]),
    miss: b.miss.map((row) => [...row]),
  };
}

function canPlace(ship: boolean[][], r: number, c: number, len: number, horizontal: boolean): boolean {
  for (let i = 0; i < len; i++) {
    const rr = horizontal ? r : r + i;
    const cc = horizontal ? c + i : c;
    if (rr >= BOARD_SIZE || cc >= BOARD_SIZE) {
      return false;
    }
    if (ship[rr][cc]) {
      return false;
    }
  }
  return true;
}

function placeShip(ship: boolean[][], r: number, c: number, len: number, horizontal: boolean): void {
  for (let i = 0; i < len; i++) {
    const rr = horizontal ? r : r + i;
    const cc = horizontal ? c + i : c;
    ship[rr][cc] = true;
  }
}

export function randomShipBoard(rng: () => number): ShipBoard {
  const ship = emptyGrid();
  for (const len of SHIP_LENGTHS) {
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      const horizontal = rng() < 0.5;
      const r = Math.floor(rng() * BOARD_SIZE);
      const c = Math.floor(rng() * BOARD_SIZE);
      if (canPlace(ship, r, c, len, horizontal)) {
        placeShip(ship, r, c, len, horizontal);
        placed = true;
      }
    }
    if (!placed) {
      return randomShipBoard(rng);
    }
  }
  return { ship, hit: emptyGrid(), miss: emptyGrid() };
}

export function receiveShot(board: ShipBoard, row: number, col: number): FireResult {
  if (board.hit[row][col] || board.miss[row][col]) {
    return board.hit[row][col] ? 'hit' : 'miss';
  }
  if (board.ship[row][col]) {
    board.hit[row][col] = true;
    return 'hit';
  }
  board.miss[row][col] = true;
  return 'miss';
}

export function recordOutgoingShot(view: ShotBoard, row: number, col: number, result: FireResult): void {
  if (result === 'hit') {
    view.hit[row][col] = true;
  } else {
    view.miss[row][col] = true;
  }
}

export function allShipsSunk(board: ShipBoard): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board.ship[r][c] && !board.hit[r][c]) {
        return false;
      }
    }
  }
  return true;
}

export function randomUntargetedCell(
  shotBoard: ShotBoard,
  rng: () => number,
): { row: number; col: number } | null {
  const candidates: { row: number; col: number }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!shotBoard.hit[r][c] && !shotBoard.miss[r][c]) {
        candidates.push({ row: r, col: c });
      }
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  const i = Math.floor(rng() * candidates.length);
  return candidates[i]!;
}

export type Winner = 'player' | 'ai';

export interface GameModel {
  player: ShipBoard;
  ai: ShipBoard;
  playerView: ShotBoard;
  aiView: ShotBoard;
  turn: 'player' | 'ai';
  winner: Winner | null;
}

export function createInitialGame(rng: () => number): GameModel {
  return {
    player: randomShipBoard(rng),
    ai: randomShipBoard(rng),
    playerView: createEmptyShotBoard(),
    aiView: createEmptyShotBoard(),
    turn: 'player',
    winner: null,
  };
}

export function applyPlayerShot(model: GameModel, row: number, col: number): GameModel {
  if (model.winner !== null || model.turn !== 'player') {
    return model;
  }
  if (model.playerView.hit[row][col] || model.playerView.miss[row][col]) {
    return model;
  }
  const ai = cloneShipBoard(model.ai);
  const result = receiveShot(ai, row, col);
  const playerView = cloneShotBoard(model.playerView);
  recordOutgoingShot(playerView, row, col, result);
  const winner = allShipsSunk(ai) ? 'player' : null;
  return {
    ...model,
    ai,
    playerView,
    turn: winner === null ? 'ai' : 'player',
    winner,
  };
}

export function applyAiShot(model: GameModel, rng: () => number): GameModel {
  if (model.winner !== null || model.turn !== 'ai') {
    return model;
  }
  const cell = randomUntargetedCell(model.aiView, rng);
  if (cell === null) {
    return { ...model, turn: 'player' };
  }
  const player = cloneShipBoard(model.player);
  const result = receiveShot(player, cell.row, cell.col);
  const aiView = cloneShotBoard(model.aiView);
  recordOutgoingShot(aiView, cell.row, cell.col, result);
  const winner = allShipsSunk(player) ? 'ai' : null;
  return {
    ...model,
    player,
    aiView,
    turn: 'player',
    winner,
  };
}
