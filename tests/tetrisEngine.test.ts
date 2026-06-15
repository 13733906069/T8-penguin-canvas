import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TETRIS_HEIGHT,
  TETRIS_PIECES,
  TETRIS_POWERS,
  TETRIS_WIDTH,
  TETRIS_CHAPTERS,
  canUseTetrisPower,
  createTetrisCheckpoint,
  createTetrisGame,
  getPiecePreviewCells,
  getTetrisChapter,
  getGhostY,
  getTetrisCheckpointLevel,
  getTetrisFallInterval,
  getTetrisPowerCost,
  getTetrisSpeedMultiplier,
  makeSevenBag,
  restoreTetrisCheckpoint,
  restoreTetrisGame,
  updateTetrisGame,
  type TetrisCell,
} from '../src/utils/tetrisEngine.ts';

function filledCell(type: TetrisCell['type'] = 'J'): TetrisCell {
  return { type, locked: true };
}

test('makeSevenBag returns one of every tetromino before repeating', () => {
  const bag = makeSevenBag(20260611);
  assert.equal(bag.length, TETRIS_PIECES.length);
  assert.deepEqual([...bag].sort(), [...TETRIS_PIECES].sort());
});

test('createTetrisGame creates a 10 x 20 board with next and hold state', () => {
  const game = createTetrisGame({ queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] });

  assert.equal(game.board.length, TETRIS_HEIGHT);
  assert.equal(game.board.every((row) => row.length === TETRIS_WIDTH), true);
  assert.equal(game.active.type, 'I');
  assert.equal(game.next[0], 'O');
  assert.equal(game.held, null);
  assert.equal(game.level, 1);
  assert.equal(game.status, 'playing');
});

test('piece preview cells are centered inside the 4 x 4 preview grid', () => {
  assert.deepEqual(getPiecePreviewCells('O'), [[1, 1], [2, 1], [1, 2], [2, 2]]);
  assert.deepEqual(getPiecePreviewCells('I'), [[0, 1], [1, 1], [2, 1], [3, 1]]);

  const tCells = getPiecePreviewCells('T');
  assert.equal(Math.min(...tCells.map(([x]) => x)), 0);
  assert.equal(Math.max(...tCells.map(([x]) => x)), 2);
  assert.equal(Math.min(...tCells.map(([, y]) => y)), 1);
  assert.equal(Math.max(...tCells.map(([, y]) => y)), 2);
});

test('custom sketch pieces join the falling piece pool with centered previews', () => {
  const sketchPieces = ['DOT', 'DOMINO', 'TRIO', 'BAR4', 'CORNER', 'PLUS', 'STAIR', 'HOOK'] as const;
  for (const piece of sketchPieces) {
    assert.equal(TETRIS_PIECES.includes(piece), true);
  }

  assert.deepEqual(getPiecePreviewCells('DOT'), [[1, 1]]);
  assert.deepEqual(getPiecePreviewCells('DOMINO'), [[1, 1], [1, 2]]);
  assert.deepEqual(getPiecePreviewCells('TRIO'), [[1, 0], [1, 1], [1, 2]]);
  assert.deepEqual(getPiecePreviewCells('BAR4'), [[1, 0], [1, 1], [1, 2], [1, 3]]);
  assert.deepEqual(getPiecePreviewCells('CORNER'), [[1, 1], [2, 1], [2, 2]]);
  assert.deepEqual(getPiecePreviewCells('PLUS'), [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]);
});

test('custom sketch pieces can spawn, rotate, and lock with their own cell count', () => {
  let game = createTetrisGame({ queue: ['DOT', 'DOMINO', 'TRIO', 'PLUS', 'I', 'O', 'T'] });
  const dotDrop = updateTetrisGame(game, { type: 'hardDrop' });
  assert.equal(dotDrop.board.flat().filter((cell) => cell?.type === 'DOT').length, 1);
  assert.equal(dotDrop.active.type, 'DOMINO');

  game = updateTetrisGame(dotDrop, { type: 'rotate', direction: 'clockwise' });
  const beforeDrop = game.active;
  const dominoDrop = updateTetrisGame(game, { type: 'hardDrop' });

  assert.equal(beforeDrop.rotation, 1);
  assert.equal(dominoDrop.board.flat().filter((cell) => cell?.type === 'DOMINO').length, 2);
});

test('movement stops at the well wall instead of wrapping outside the board', () => {
  let game = createTetrisGame({ queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] });
  for (let i = 0; i < 20; i += 1) {
    game = updateTetrisGame(game, { type: 'move', dx: -1 });
  }
  const leftMost = game.active.x;
  game = updateTetrisGame(game, { type: 'move', dx: -1 });

  assert.equal(leftMost >= 0, true);
  assert.equal(game.active.x, leftMost);
});

test('rotation uses wall kicks so a piece can rotate beside the wall when space exists', () => {
  let game = createTetrisGame({ queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] });
  for (let i = 0; i < 20; i += 1) {
    game = updateTetrisGame(game, { type: 'move', dx: -1 });
  }

  const rotated = updateTetrisGame(game, { type: 'rotate', direction: 'clockwise' });

  assert.notEqual(rotated.active.rotation, game.active.rotation);
  assert.equal(rotated.active.x >= 0, true);
  assert.equal(getGhostY(rotated) >= rotated.active.y, true);
});

test('hard drop locks the active piece, clears lines, scores, and advances level', () => {
  let game = createTetrisGame({ queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'] });
  const board = game.board.map((row) => [...row]);
  for (const y of [TETRIS_HEIGHT - 2, TETRIS_HEIGHT - 1]) {
    for (let x = 0; x < TETRIS_WIDTH; x += 1) {
      board[y][x] = x === 4 || x === 5 ? null : filledCell('Z');
    }
  }
  game = {
    ...game,
    board,
    lines: 9,
    active: { ...game.active, x: 4, y: 0 },
  };

  const dropped = updateTetrisGame(game, { type: 'hardDrop' });

  assert.equal(dropped.lastClear.lines, 2);
  assert.equal(dropped.lines, 11);
  assert.equal(dropped.score, 300);
  assert.equal(dropped.level, 2);
  assert.equal(dropped.active.type, 'I');
});

test('hold swaps once per falling piece and resets after the piece locks', () => {
  let game = createTetrisGame({ queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] });

  const held = updateTetrisGame(game, { type: 'hold' });
  assert.equal(held.held, 'I');
  assert.equal(held.active.type, 'O');
  assert.equal(held.canHold, false);

  const ignored = updateTetrisGame(held, { type: 'hold' });
  assert.equal(ignored.active.type, 'O');
  assert.equal(ignored.held, 'I');

  const locked = updateTetrisGame(held, { type: 'hardDrop' });
  assert.equal(locked.canHold, true);

  const swapped = updateTetrisGame(locked, { type: 'hold' });
  assert.equal(swapped.active.type, 'I');
  assert.equal(swapped.held, 'T');
});

test('checkpoints are created only on five-level milestones and can be restored', () => {
  const base = createTetrisGame({ queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] });

  assert.equal(getTetrisCheckpointLevel(1), 0);
  assert.equal(getTetrisCheckpointLevel(5), 5);
  assert.equal(getTetrisCheckpointLevel(9), 5);
  assert.equal(createTetrisCheckpoint({ ...base, level: 4 }), null);
  assert.equal(createTetrisCheckpoint({ ...base, level: 6 }), null);

  const checkpoint = createTetrisCheckpoint({
    ...base,
    level: 10,
    lines: 92,
    score: 12340,
  }, 20260611);

  assert.ok(checkpoint);
  assert.equal(checkpoint.level, 10);
  assert.equal(checkpoint.lines, 92);
  assert.equal(checkpoint.score, 12340);
  assert.equal(checkpoint.savedAt, 20260611);
  assert.equal(checkpoint.state.status, 'paused');

  const restored = restoreTetrisCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
  assert.equal(restored?.level, 10);
  assert.equal(restored?.state.level, 10);
  assert.equal(restored?.state.lines, 92);
  assert.equal(restored?.state.score, 12340);
  assert.equal(restoreTetrisCheckpoint({ ...checkpoint, level: 7 }), null);
});

test('chapters split all 99 levels into five-level gameplay variants', () => {
  assert.equal(TETRIS_CHAPTERS.length, 20);
  assert.deepEqual(TETRIS_CHAPTERS.slice(0, 6).map((chapter) => chapter.levelStart), [1, 6, 11, 16, 21, 26]);
  assert.equal(getTetrisChapter(1).id, 'classic-warmup');
  assert.equal(getTetrisChapter(7).id, 'energy-workshop');
  assert.equal(getTetrisChapter(24).id, 'fault-scan');
  assert.equal(getTetrisChapter(50).id, 'rapid-orders');
  assert.equal(getTetrisChapter(99).id, 'finale');
  assert.equal(new Set(TETRIS_CHAPTERS.map((chapter) => chapter.modifier)).size >= 12, true);
});

test('every five-level chapter exposes a distinct stage effect after warmup', () => {
  const effectIds = TETRIS_CHAPTERS.map((chapter) => chapter.effect?.id);

  assert.equal(effectIds.every(Boolean), true);
  assert.equal(new Set(effectIds).size, TETRIS_CHAPTERS.length);
  assert.equal(TETRIS_CHAPTERS.slice(1).every((chapter) => chapter.effect.cellModifier), true);
  assert.equal(TETRIS_CHAPTERS.slice(1).every((chapter) => chapter.effect.cue.length > 6), true);
});

test('non-warmup chapters stamp visible stage modifiers on locked pieces', () => {
  for (const chapter of TETRIS_CHAPTERS.slice(1)) {
    const game = createTetrisGame({
      level: chapter.levelStart,
      queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'],
    });

    const dropped = updateTetrisGame(game, { type: 'hardDrop' });
    const modifiers = dropped.board.flat().map((cell) => cell?.modifier).filter(Boolean);

    assert.ok(modifiers.includes(chapter.effect.cellModifier), `${chapter.id} should show ${chapter.effect.cellModifier}`);
  }
});

test('creating and restoring games carries chapter, mission, energy, and unlocked powers', () => {
  const opener = createTetrisGame({ level: 1 });
  assert.deepEqual([...opener.unlockedPowers].sort(), ['clear-bottom', 'reroll', 'shield', 'slow'].sort());

  const game = createTetrisGame({
    level: 21,
    seed: 20260611,
    queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
  });

  assert.equal(game.chapter.id, 'fault-scan');
  assert.equal(game.mission.chapterId, 'fault-scan');
  assert.equal(game.mission.completed, false);
  assert.ok(game.activeHazards.includes('cracked-row'));
  assert.ok(game.unlockedPowers.includes('slow'));
  assert.ok(game.unlockedPowers.includes('clear-bottom'));
  assert.equal(game.powerEffects.slowTicks, 0);

  const restored = restoreTetrisGame(JSON.parse(JSON.stringify(game)));
  assert.equal(restored?.chapter.id, 'fault-scan');
  assert.equal(restored?.mission.chapterId, 'fault-scan');
  assert.deepEqual(restored?.unlockedPowers, game.unlockedPowers);

  const legacy = restoreTetrisGame({
    ...game,
    chapter: undefined,
    mission: undefined,
    energy: undefined,
    combo: undefined,
    activeHazards: undefined,
    unlockedPowers: undefined,
    powerEffects: undefined,
  });
  assert.equal(legacy?.chapter.id, 'fault-scan');
  assert.equal(legacy?.mission.chapterId, 'fault-scan');
});

test('line clears advance missions, award energy, and build combo', () => {
  let game = createTetrisGame({
    level: 16,
    queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'],
  });
  const board = game.board.map((row) => [...row]);
  for (const y of [TETRIS_HEIGHT - 2, TETRIS_HEIGHT - 1]) {
    for (let x = 0; x < TETRIS_WIDTH; x += 1) {
      board[y][x] = x === 4 || x === 5 ? null : filledCell('Z');
    }
  }
  game = {
    ...game,
    board,
    lines: 150,
    active: { ...game.active, x: 4, y: 0 },
  };

  const dropped = updateTetrisGame(game, { type: 'hardDrop' });

  assert.equal(dropped.lastClear.lines, 2);
  assert.equal(dropped.combo, 1);
  assert.equal(dropped.energy > game.energy, true);
  assert.equal(dropped.mission.progress >= 1, true);
  assert.equal(dropped.lastFeedback?.type, 'line-clear');
  assert.equal(dropped.lastFeedback?.lines, 2);
});

test('early specialty chapters increase obstacle pressure before level 20', () => {
  const energyReady = {
    ...createTetrisGame({ level: 6, queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'] }),
    eventSeq: 1,
  };
  const energyDrop = updateTetrisGame(energyReady, { type: 'hardDrop' });
  assert.equal(energyDrop.board.flat().some((cell) => cell?.modifier === 'energy'), true);
  assert.equal(energyDrop.lastFeedback?.type, 'hazard');

  const orderReady = {
    ...createTetrisGame({ level: 11, queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'] }),
    eventSeq: 2,
  };
  const orderDrop = updateTetrisGame(orderReady, { type: 'hardDrop' });
  assert.equal(orderDrop.board.flat().some((cell) => cell?.modifier === 'order'), true);

  const comboReady = {
    ...createTetrisGame({ level: 16, queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'] }),
    eventSeq: 1,
  };
  const comboDrop = updateTetrisGame(comboReady, { type: 'hardDrop' });
  const comboCells = comboDrop.board.flat().filter((cell) => cell?.modifier === 'combo');
  assert.equal(comboCells.length >= 3, true);
  assert.equal(comboDrop.lastFeedback?.type, 'hazard');
});

test('fall speed ramps evenly by five-level checkpoints and caps at 2x', () => {
  assert.equal(getTetrisSpeedMultiplier(1), 1);
  assert.equal(getTetrisSpeedMultiplier(5), 1);
  assert.equal(getTetrisFallInterval(1), 880);
  assert.equal(getTetrisFallInterval(5), 880);

  assert.equal(getTetrisSpeedMultiplier(10), 1.05);
  assert.equal(getTetrisSpeedMultiplier(15), 1.11);
  assert.equal(getTetrisFallInterval(10) < getTetrisFallInterval(5), true);
  assert.equal(getTetrisFallInterval(15) < getTetrisFallInterval(10), true);

  assert.equal(getTetrisSpeedMultiplier(94), 1.95);
  assert.equal(getTetrisSpeedMultiplier(95), 2);
  assert.equal(getTetrisSpeedMultiplier(99), 2);
  assert.equal(getTetrisFallInterval(95), 440);
  assert.equal(getTetrisFallInterval(99), 440);
});

test('power costs ramp evenly by five-level checkpoints and cap at 1.5x', () => {
  assert.equal(getTetrisPowerCost('slow', 1), TETRIS_POWERS.slow.cost);
  assert.equal(getTetrisPowerCost('slow', 5), TETRIS_POWERS.slow.cost);
  assert.equal(getTetrisPowerCost('reroll', 50), 56);
  assert.equal(getTetrisPowerCost('shield', 95), 105);
  assert.equal(getTetrisPowerCost('clear-bottom', 99), 135);

  const lateGame = {
    ...createTetrisGame({ level: 95, queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] }),
    energy: getTetrisPowerCost('shield', 95) - 1,
  };
  assert.equal(canUseTetrisPower(lateGame, 'shield'), false);
  assert.equal(canUseTetrisPower({ ...lateGame, energy: getTetrisPowerCost('shield', 95) }, 'shield'), true);
});

test('post level 20 hazard chapters add denser obstacle pressure', () => {
  const crackedReady = {
    ...createTetrisGame({ level: 21, queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'] }),
    eventSeq: 1,
  };
  const crackedDrop = updateTetrisGame(crackedReady, { type: 'hardDrop' });
  assert.equal(crackedDrop.board.flat().filter((cell) => cell?.modifier === 'cracked').length >= 4, true);

  const sideReady = {
    ...createTetrisGame({ level: 36, queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'] }),
    eventSeq: 3,
  };
  const sideDrop = updateTetrisGame(sideReady, { type: 'hardDrop' });
  assert.equal(sideDrop.board.flat().filter((cell) => cell?.modifier === 'side').length >= 2, true);

  const furnaceReady = {
    ...createTetrisGame({ level: 56, queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'] }),
    eventSeq: 1,
  };
  const furnaceDrop = updateTetrisGame(furnaceReady, { type: 'hardDrop' });
  assert.equal(furnaceDrop.board.flat().filter((cell) => cell?.modifier === 'furnace').length >= 4, true);
});

test('every post-warmup chapter creates visible punishment by the second lock', () => {
  for (const chapter of TETRIS_CHAPTERS.slice(1)) {
    const game = {
      ...createTetrisGame({
        level: chapter.levelStart,
        queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'],
      }),
      eventSeq: 1,
    };

    const dropped = updateTetrisGame(game, { type: 'hardDrop' });
    const pressureCells = dropped.board.flat().filter((cell) => cell?.modifier).length;

    assert.equal(pressureCells >= 3, true, `${chapter.id} should punish early with visible modifier cells`);
    assert.notEqual(dropped.lastFeedback?.type, 'drop', `${chapter.id} should not feel idle after warmup`);
  }
});

test('hazard cells avoid filling a one-cell line gap into a reward', () => {
  const base = createTetrisGame({
    level: 16,
    queue: ['O', 'I', 'T', 'S', 'Z', 'J', 'L'],
  });
  const board = base.board.map((row) => [...row]);
  for (let x = 0; x < TETRIS_WIDTH; x += 1) {
    board[TETRIS_HEIGHT - 1][x] = x === 2 ? null : filledCell('J');
  }
  const game = {
    ...base,
    board,
    eventSeq: 1,
    active: { ...base.active, x: 4, y: 0 },
  };

  const dropped = updateTetrisGame(game, { type: 'hardDrop' });

  assert.equal(dropped.board.some((row) => row.every(Boolean)), false);
  assert.equal(dropped.board[TETRIS_HEIGHT - 1][2], null);
  assert.equal(dropped.board.flat().some((cell) => cell?.modifier === 'combo'), true);
  assert.equal(dropped.lastFeedback?.type, 'hazard');
});

test('power skills consume energy and change gameplay state', () => {
  const fullyChargedOpener = {
    ...createTetrisGame({ level: 1, queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] }),
    energy: 999,
  };
  for (const power of Object.keys(TETRIS_POWERS) as Array<keyof typeof TETRIS_POWERS>) {
    assert.equal(canUseTetrisPower(fullyChargedOpener, power), true);
  }

  const slowReady = {
    ...createTetrisGame({ level: 6, queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] }),
    energy: getTetrisPowerCost('slow', 6),
  };
  assert.equal(canUseTetrisPower(slowReady, 'slow'), true);
  const slowed = updateTetrisGame(slowReady, { type: 'usePower', power: 'slow' });
  assert.equal(slowed.energy, 0);
  assert.equal(slowed.powerEffects.slowTicks > 0, true);
  assert.equal(getTetrisFallInterval(slowed.level, slowed) > getTetrisFallInterval(slowed.level), true);
  assert.equal(slowed.lastFeedback?.type, 'power');
  assert.equal(slowed.lastFeedback?.power, 'slow');

  const board = createTetrisGame().board.map((row) => [...row]);
  for (let x = 0; x < TETRIS_WIDTH; x += 1) board[TETRIS_HEIGHT - 1][x] = filledCell('J');
  const clearReady = {
    ...createTetrisGame({ level: 21, queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] }),
    board,
    energy: getTetrisPowerCost('clear-bottom', 21),
  };
  const clearBottom = updateTetrisGame(clearReady, { type: 'usePower', power: 'clear-bottom' });
  assert.equal(clearBottom.energy, 0);
  assert.equal(clearBottom.board[TETRIS_HEIGHT - 1].every(Boolean), false);
  assert.equal(clearBottom.powerEffects.clearBottomUsedInChapter, 1);
  assert.equal(clearBottom.lastFeedback?.type, 'power');

  const rerollReady = {
    ...createTetrisGame({ level: 31, queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] }),
    energy: getTetrisPowerCost('reroll', 31),
  };
  const rerolled = updateTetrisGame(rerollReady, { type: 'usePower', power: 'reroll' });
  assert.notEqual(rerolled.active.type, rerollReady.active.type);
  assert.equal(rerolled.powerEffects.rerollsUsedInChapter, 1);
  assert.equal(rerolled.lastFeedback?.type, 'power');
});

test('guard power randomly clears only added hazard cells', () => {
  const base = createTetrisGame({ level: 96, seed: 20260613, queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] });
  const board = base.board.map((row) => [...row]);
  const hazardPositions = [
    [18, 0], [18, 2], [18, 4], [18, 6], [18, 8], [17, 1],
    [17, 3], [17, 5], [17, 7], [17, 9], [16, 2], [16, 6],
  ];
  for (const [y, x] of hazardPositions) {
    board[y][x] = { type: 'Z', locked: true, modifier: 'combo', hazard: true };
  }
  board[19][1] = { type: 'T', locked: true, modifier: 'combo' };
  board[19][5] = filledCell('O');
  const ready = {
    ...base,
    board,
    energy: getTetrisPowerCost('shield', base.level),
  };

  const guarded = updateTetrisGame(ready, { type: 'usePower', power: 'shield' });
  const beforeHazards = ready.board.flat().filter((cell) => cell?.hazard).length;
  const afterHazards = guarded.board.flat().filter((cell) => cell?.hazard).length;

  assert.equal(beforeHazards, 12);
  assert.equal(beforeHazards - afterHazards >= 5, true);
  assert.equal(beforeHazards - afterHazards <= 10, true);
  assert.equal(guarded.board[19][1]?.modifier, 'combo');
  assert.equal(guarded.board[19][1]?.hazard, undefined);
  assert.equal(guarded.board[19][5]?.type, 'O');
  assert.equal(guarded.powerEffects.shieldCharges, 0);
  assert.equal(guarded.energy, 0);
});

test('finale mission completion opens a persistent victory state', () => {
  const game = createTetrisGame({
    level: 99,
    lines: 990,
    queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
  });
  const ready = {
    ...game,
    energy: 999,
    mission: {
      ...game.mission,
      progress: game.mission.target - 1,
      completed: false,
      rewardClaimed: false,
    },
  };

  const won = updateTetrisGame(ready, { type: 'usePower', power: 'slow' });

  assert.equal(won.status, 'victory');
  assert.equal(won.mission.completed, true);
  assert.equal(won.lastFeedback?.type, 'victory');
  assert.equal(won.lastFeedback?.intensity, 'legendary');

  const ignoredMove = updateTetrisGame(won, { type: 'move', dx: -1 });
  assert.equal(ignoredMove.active.x, won.active.x);
  assert.equal(restoreTetrisGame(JSON.parse(JSON.stringify(won)))?.status, 'victory');
});

test('finale mission cannot trigger victory before level 99 is completed', () => {
  const level96Game = createTetrisGame({
    level: 96,
    lines: 954,
    queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
  });
  const earlyReady = {
    ...level96Game,
    energy: 999,
    mission: {
      ...level96Game.mission,
      progress: level96Game.mission.target - 1,
      completed: false,
      rewardClaimed: false,
    },
  };

  const earlyCompleted = updateTetrisGame(earlyReady, { type: 'usePower', power: 'slow' });

  assert.equal(earlyCompleted.mission.completed, true);
  assert.equal(earlyCompleted.status, 'playing');
  assert.notEqual(earlyCompleted.lastFeedback?.type, 'victory');

  const level99AlmostDone = {
    ...earlyCompleted,
    level: 99,
    lines: 989,
    status: 'playing' as const,
  };
  const stillPlaying = restoreTetrisGame(JSON.parse(JSON.stringify(level99AlmostDone)));

  assert.equal(stillPlaying?.status, 'playing');

  const level99Done = {
    ...level99AlmostDone,
    lines: 990,
  };
  const won = restoreTetrisGame(JSON.parse(JSON.stringify(level99Done)));

  assert.equal(won?.status, 'victory');
});

test('tetris clears and combo chains emit arcade feedback events', () => {
  let game = createTetrisGame({ queue: ['I', 'I', 'O', 'T', 'S', 'Z', 'J'] });
  let board = game.board.map((row) => [...row]);
  for (let x = 0; x < TETRIS_WIDTH; x += 1) {
    for (const y of [TETRIS_HEIGHT - 4, TETRIS_HEIGHT - 3, TETRIS_HEIGHT - 2, TETRIS_HEIGHT - 1]) {
      board[y][x] = x === 6 ? null : filledCell('Z');
    }
  }
  game = { ...game, board, active: { ...game.active, x: 4, y: 0, rotation: 1 } };

  const tetris = updateTetrisGame(game, { type: 'hardDrop' });
  assert.equal(tetris.lastClear.lines, 4);
  assert.equal(tetris.lastFeedback?.type, 'tetris');
  assert.equal(tetris.lastFeedback?.intensity, 'legendary');

  board = tetris.board.map((row) => [...row]);
  for (let x = 0; x < TETRIS_WIDTH; x += 1) {
    board[TETRIS_HEIGHT - 1][x] = x === 4 || x === 5 ? null : filledCell('J');
  }
  const comboReady = { ...tetris, board, active: { type: 'O' as const, x: 4, y: 0, rotation: 0 as const } };
  const combo = updateTetrisGame(comboReady, { type: 'hardDrop' });

  assert.equal(combo.combo >= 2, true);
  assert.equal(combo.lastFeedback?.type, 'combo');
  assert.equal(combo.lastFeedback?.combo, combo.combo);
});

test('checkpoints preserve chapter progress and power state', () => {
  const game = {
    ...createTetrisGame({ level: 10, queue: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] }),
    energy: 135,
    combo: 2,
    powerEffects: { slowTicks: 8, shieldCharges: 1, rerollsUsedInChapter: 0 },
  };
  const checkpoint = createTetrisCheckpoint(game, 20260611);

  assert.ok(checkpoint);
  assert.equal(checkpoint.state.chapter.id, 'energy-workshop');
  assert.equal(checkpoint.state.energy, 135);
  assert.equal(checkpoint.state.combo, 2);
  assert.equal(checkpoint.state.powerEffects.slowTicks, 8);

  const restored = restoreTetrisCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
  assert.equal(restored?.state.chapter.id, 'energy-workshop');
  assert.equal(restored?.state.energy, 135);
  assert.equal(restored?.state.powerEffects.shieldCharges, 1);
});
