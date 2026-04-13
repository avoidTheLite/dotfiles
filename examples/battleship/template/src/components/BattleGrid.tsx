import type { FireResult } from '../game/battleshipEngine.ts';
import { BOARD_SIZE } from '../game/battleshipEngine.ts';

export type CellMode =
  | { kind: 'own'; ship: boolean; hit: boolean; miss: boolean }
  | { kind: 'enemy'; result: FireResult | null };

interface BattleGridProps {
  title: string;
  cells: CellMode[][];
  onFire?: (row: number, col: number) => void;
  canFire?: boolean;
}

const flat = (cells: CellMode[][]) => cells.flat();

function classForCell(cell: CellMode, canFire: boolean): string {
  if (cell.kind === 'own') {
    if (cell.miss) {
      return 'cell miss';
    }
    if (cell.hit) {
      return 'cell hit';
    }
    if (cell.ship) {
      return 'cell ship';
    }
    return 'cell water';
  }
  if (cell.result === 'hit') {
    return 'cell hit';
  }
  if (cell.result === 'miss') {
    return 'cell miss';
  }
  return canFire ? 'cell water target' : 'cell water';
}

export const BattleGrid = ({ title, cells, onFire, canFire = false }: BattleGridProps) => {
  const rows = flat(cells);
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="grid" role="grid" aria-label={title}>
        {rows.map((cell, idx) => {
          const row = Math.floor(idx / BOARD_SIZE);
          const col = idx % BOARD_SIZE;
          const isButton = cell.kind === 'enemy' && cell.result === null && canFire && onFire;
          const cls = classForCell(cell, Boolean(canFire && onFire));
          if (isButton) {
            return (
              <button
                type="button"
                key={`${row}-${col}`}
                className={cls}
                aria-label={`Fire at row ${row + 1} column ${col + 1}`}
                onClick={() => onFire(row, col)}
              />
            );
          }
          return <div key={`${row}-${col}`} className={cls} role="gridcell" />;
        })}
      </div>
    </div>
  );
};
