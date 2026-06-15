import { ChevronDown, ChevronUp, Grid3x3 } from 'lucide-react';
import type { TetrisStatus } from '../utils/tetrisEngine';

interface TetrisThemeButtonProps {
  collapsed: boolean;
  score: number;
  level: number;
  status: TetrisStatus;
  onToggle: () => void;
}

export default function TetrisThemeButton({
  collapsed,
  score,
  level,
  status,
  onToggle,
}: TetrisThemeButtonProps) {
  return (
    <button
      type="button"
      className={`t8-tetris-panel__toggle ${collapsed ? 'is-collapsed' : 'is-expanded'} ${status === 'game-over' ? 'is-game-over' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      title={collapsed ? '展开俄罗斯方块' : '折叠俄罗斯方块'}
      aria-label={collapsed ? '展开俄罗斯方块' : '折叠俄罗斯方块'}
      aria-expanded={!collapsed}
      aria-controls="t8-tetris-panel"
    >
      <Grid3x3 size={14} />
      <span className="t8-tetris-panel__toggle-blocks" aria-hidden="true">
        <i data-block="I" />
        <i data-block="O" />
        <i data-block="T" />
      </span>
      <strong>Lv{level}</strong>
      <em>{score}</em>
      {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
    </button>
  );
}
