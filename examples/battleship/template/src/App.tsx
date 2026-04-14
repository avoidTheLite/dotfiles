import { useCallback, useEffect, useMemo, useState } from 'react';
import { BattleGrid } from './components/BattleGrid.tsx';
import type { CellMode } from './components/BattleGrid.tsx';
import type { GameModel } from './game/battleshipEngine.ts';
import {
  BOARD_SIZE,
  applyAiShot,
  applyPlayerShot,
  createInitialGame,
} from './game/battleshipEngine.ts';

function buildOwnCells(model: GameModel): CellMode[][] {
  const out: CellMode[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: CellMode[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push({
        kind: 'own',
        ship: model.player.ship[r][c],
        hit: model.player.hit[r][c],
        miss: model.player.miss[r][c],
      });
    }
    out.push(row);
  }
  return out;
}

function buildEnemyCells(model: GameModel): CellMode[][] {
  const out: CellMode[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: CellMode[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      let result: 'hit' | 'miss' | null = null;
      if (model.playerView.hit[r][c]) {
        result = 'hit';
      } else if (model.playerView.miss[r][c]) {
        result = 'miss';
      }
      row.push({ kind: 'enemy', result });
    }
    out.push(row);
  }
  return out;
}

const rng = () => Math.random();

const App = () => {
  const initial = useMemo(() => createInitialGame(rng), []);
  const [model, setModel] = useState<GameModel>(initial);

  useEffect(() => {
    if (model.winner !== null || model.turn !== 'ai') {
      return;
    }
    const id = window.setTimeout(() => {
      setModel((m) => applyAiShot(m, rng));
    }, 450);
    return () => window.clearTimeout(id);
  }, [model.turn, model.winner]);

  const onFire = useCallback((row: number, col: number) => {
    setModel((m) => applyPlayerShot(m, row, col));
  }, []);

  const reset = () => {
    setModel(createInitialGame(rng));
  };

  const own = buildOwnCells(model);
  const enemy = buildEnemyCells(model);

  let status = 'Your turn — click the enemy ocean to fire.';
  let statusClass = 'status';
  if (model.winner === 'player') {
    status = 'You sank the enemy fleet. You win.';
    statusClass = 'status won';
  } else if (model.winner === 'ai') {
    status = 'Your fleet is destroyed. You lose.';
    statusClass = 'status lost';
  } else if (model.turn === 'ai') {
    status = 'Enemy is firing…';
  }

  return (
    <main>
      <h1>Battleship</h1>
      <p className={statusClass}>{status}</p>
      <div className="boards">
        <BattleGrid title="Your fleet" cells={own} />
        <BattleGrid
          title="Enemy waters"
          cells={enemy}
          onFire={onFire}
          canFire={model.turn === 'player' && model.winner === null}
        />
      </div>
      <button type="button" className="reset" onClick={reset}>
        New game
      </button>
    </main>
  );
};

export default App;
