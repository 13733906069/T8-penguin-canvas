import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiledRoot = join(tmpdir(), `t8-saint-seiya-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function compileSource(sourceRel: string, outputRel: string, rewrite?: (source: string) => string) {
  const sourcePath = resolve(repoRoot, sourceRel);
  const outputPath = join(compiledRoot, outputRel);
  mkdirSync(dirname(outputPath), { recursive: true });
  const source = rewrite ? rewrite(readFileSync(sourcePath, 'utf8')) : readFileSync(sourcePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: sourcePath,
  }).outputText;
  writeFileSync(outputPath, compiled);
}

compileSource('src/data/saintSeiyaCloths.ts', 'src/data/saintSeiyaCloths.js');
compileSource('src/utils/saintSeiyaBattle.ts', 'src/utils/saintSeiyaBattle.js', (source) =>
  source.replace("from '../data/saintSeiyaCloths';", "from '../data/saintSeiyaCloths.js';"),
);

const cloths = await import(pathToFileURL(join(compiledRoot, 'src/data/saintSeiyaCloths.js')).href);
const battle = await import(pathToFileURL(join(compiledRoot, 'src/utils/saintSeiyaBattle.js')).href);

const { SAINT_SEIYA_CLOTHS, SAINT_SEIYA_GOLD_CLOTHS, SAINT_SEIYA_CLOTH_BY_ID, SAINT_GOLD_CLOTH_UI } = cloths;
const {
  buildEnemyStats,
  buildPlayerStats,
  chooseChestCloth,
  enemyLevelRange,
  hasAllGoldCloths,
  goldTempleProgress,
  rankWeightsForLevel,
  rewardExpForRank,
  saintLevelFromExp,
  simulateSaintBattle,
  buildSaintEnemy,
  saintMoveEffectStyle,
  saintMoveSoundCue,
} = battle;

test('Saint Seiya battle math follows roadmap level and reward rules', () => {
  assert.equal(saintLevelFromExp(0), 1);
  assert.equal(saintLevelFromExp(9), 1);
  assert.equal(saintLevelFromExp(10), 2);
  assert.equal(saintLevelFromExp(980), 99);
  assert.equal(saintLevelFromExp(9999), 99);

  assert.equal(rewardExpForRank('bronze', true), 9);
  assert.equal(rewardExpForRank('silver', true), 12);
  assert.equal(rewardExpForRank('gold', true), 15);
  assert.equal(rewardExpForRank('bronze', false), 5);
  assert.equal(rewardExpForRank('silver', false), 7);
  assert.equal(rewardExpForRank('gold', false), 9);

  assert.deepEqual(enemyLevelRange('bronze'), [1, 33]);
  assert.deepEqual(enemyLevelRange('silver'), [34, 66]);
  assert.deepEqual(enemyLevelRange('gold'), [67, 99]);
});

test('Saint Seiya stats scale by cloth rank and enemy tier', () => {
  const bare = buildPlayerStats(10, null);
  const bronze = buildPlayerStats(10, 'bronze');
  const silver = buildPlayerStats(10, 'silver');
  const gold = buildPlayerStats(10, 'gold');

  assert.ok(bronze.hp > bare.hp);
  assert.ok(silver.atk > bronze.atk);
  assert.ok(gold.def > silver.def);
  assert.equal(gold.cosmoRegen, 8);

  const bronzeEnemy = buildEnemyStats('bronze', 20);
  const goldEnemy = buildEnemyStats('gold', 80);
  assert.ok(goldEnemy.hp > bronzeEnemy.hp);
  assert.ok(goldEnemy.atk > bronzeEnemy.atk);
});

test('Saint Seiya chest selection excludes collected cloths and unlocks Hades after twelve gold cloths', () => {
  const collected: Record<string, unknown> = {};
  for (const cloth of SAINT_SEIYA_GOLD_CLOTHS.slice(0, 11)) {
    collected[cloth.id] = { clothId: cloth.id };
  }
  assert.equal(hasAllGoldCloths(collected), false);
  collected[SAINT_SEIYA_GOLD_CLOTHS[11].id] = { clothId: SAINT_SEIYA_GOLD_CLOTHS[11].id };
  assert.equal(hasAllGoldCloths(collected), true);

  const allGoldCollected = { ...collected };
  const chosen = chooseChestCloth(990, allGoldCollected, () => 0.99);
  assert.notEqual(chosen?.rank, 'gold');

  const highLevelWeights = rankWeightsForLevel(80);
  assert.equal(highLevelWeights.find((item) => item.rank === 'gold')?.weight, 60);
});

test('Saint Seiya gold temples progress in zodiac order from Aries to Pisces', () => {
  const collected: Record<string, unknown> = {};
  assert.equal(goldTempleProgress(collected).next.id, 'aries');
  assert.equal(chooseChestCloth(980, collected, () => 0.92)?.id, 'aries');

  collected.aries = { clothId: 'aries' };
  assert.equal(goldTempleProgress(collected).next.id, 'taurus');
  assert.equal(chooseChestCloth(980, collected, () => 0.92)?.id, 'taurus');

  for (const cloth of SAINT_SEIYA_GOLD_CLOTHS) {
    collected[cloth.id] = { clothId: cloth.id };
  }
  assert.equal(goldTempleProgress(collected).completed, 12);
  assert.equal(goldTempleProgress(collected).next, null);
});

test('Saint Seiya twelve gold cloths have distinct UI effects', () => {
  assert.equal(Object.keys(SAINT_GOLD_CLOTH_UI).length, SAINT_SEIYA_GOLD_CLOTHS.length);
  const effects = new Set<string>();
  const patterns = new Set<string>();
  for (const cloth of SAINT_SEIYA_GOLD_CLOTHS) {
    const ui = SAINT_GOLD_CLOTH_UI[cloth.id];
    assert.ok(ui, `${cloth.id} needs a gold cloth UI config`);
    assert.equal(ui.temple, SAINT_SEIYA_GOLD_CLOTHS.findIndex((item: any) => item.id === cloth.id) + 1);
    assert.ok(ui.glyph.length >= 1);
    assert.ok(ui.sigil.length >= 3);
    assert.ok(ui.effect.length >= 3);
    assert.ok(ui.unlockText.includes('。'));
    effects.add(ui.effect);
    patterns.add(ui.pattern);
  }
  assert.equal(effects.size, 12);
  assert.equal(patterns.size, 12);
});

test('Saint Seiya battle simulation can resolve a collected gold user against a gold saint', () => {
  const collected = {
    aries: { clothId: 'aries' },
    leo: { clothId: 'leo' },
  };
  const enemy = buildSaintEnemy('taurus', 99, () => 0.4);
  const report = simulateSaintBattle({
    totalExp: 980,
    collected,
    enemy,
    strategy: 'cosmo',
    rng: () => 0.8,
  });

  assert.equal(enemy.rank, 'gold');
  assert.equal(SAINT_SEIYA_CLOTH_BY_ID[enemy.clothId].constellation, '金牛座');
  assert.equal(typeof report.victory, 'boolean');
  assert.ok(report.expGain === 15 || report.expGain === 9);
  assert.equal(report.usedCosmoBurst, true);
  assert.ok(report.log.some((line) => line.includes('小宇宙') || line.includes('星光灭绝') || line.includes('星屑旋转功')));
  assert.equal(report.events.length, report.log.length);
  assert.equal(report.events[0].kind, 'intro');
  assert.ok(report.events.some((event) => event.kind === 'player-attack'));
  assert.ok(report.events.some((event) => event.kind === 'enemy-attack'));
  assert.ok(report.events.some((event) => event.kind === 'clash'));
  assert.ok(report.events.some((event) => event.kind === (report.victory ? 'victory' : 'defeat')));
  assert.ok(report.events.every((event) => event.playerMaxHp > 0 && event.enemyMaxHp > 0));
  assert.ok(report.events.every((event) => event.text.length >= 8));
});

test('Saint Seiya battle events target a 20-30 second automatic duel rhythm', () => {
  const collected = {
    aries: { clothId: 'aries' },
    leo: { clothId: 'leo' },
    sagittarius: { clothId: 'sagittarius' },
  };
  const enemy = buildSaintEnemy('pisces', 99, () => 0.4);
  const report = simulateSaintBattle({
    totalExp: 980,
    collected,
    enemy,
    strategy: 'auto',
    rng: () => 0.8,
  });
  const projectedDurationMs = report.events.length * 820;
  assert.equal(report.turns, 10);
  assert.ok(report.events.length >= 30, `expected a cinematic queue, got ${report.events.length}`);
  assert.ok(projectedDurationMs >= 20_000, `battle too short: ${projectedDurationMs}ms`);
  assert.ok(projectedDurationMs <= 30_000, `battle too long: ${projectedDurationMs}ms`);
  assert.ok(report.events.filter((event) => event.kind === 'clash').length >= 10);
  assert.ok(report.events.filter((event) => event.kind === 'player-attack').length >= 8);
  assert.ok(report.events.filter((event) => event.kind === 'enemy-attack').length >= 8);
});

test('Saint Seiya moves expose unique visual effect and sound cues for battle playback', () => {
  const styles = new Set<string>();
  const moveEffectIds = new Set<string>();
  for (const cloth of SAINT_SEIYA_CLOTHS) {
    for (const move of cloth.moves) {
      const style = saintMoveEffectStyle(move, cloth);
      const sound = saintMoveSoundCue(move, cloth);
      assert.ok(style, `${cloth.id}/${move.id} needs an effect style`);
      assert.ok(sound, `${cloth.id}/${move.id} needs a sound cue`);
      styles.add(style);
      moveEffectIds.add(`${cloth.id}-${move.id}-${style}`);
    }
  }
  assert.ok(styles.size >= 14, `expected many effect families, got ${styles.size}`);
  assert.ok(moveEffectIds.has('pegasus-pegasus-ryuseiken-meteor'));
  assert.ok(moveEffectIds.has('dragon-rozanshoryuha-dragon'));
  assert.ok(moveEffectIds.has('aquarius-aurora-execution-aurora'));
  assert.ok(moveEffectIds.has('pisces-bloody-rose-rose'));
});

test('Saint Seiya auto battle prefers unlocked skills and ultimate moves', () => {
  const collected = {
    aries: { clothId: 'aries' },
  };
  const enemy = buildSaintEnemy('taurus', 99, () => 0.4);
  const report = simulateSaintBattle({
    totalExp: 980,
    collected,
    enemy,
    strategy: 'auto',
    rng: () => 0.8,
  });

  assert.equal(report.usedCosmoBurst, true);
  assert.ok(report.log.some((line) => line.includes('星屑旋转功')));
  const attackEvents = report.events.filter((event) => event.kind === 'player-attack' || event.kind === 'enemy-attack');
  assert.ok(attackEvents.every((event) => event.effectId && event.effectStyle && event.soundCue));
});

test('Saint Seiya Hades radar keeps chest ping inside the minimap frame', () => {
  const component = readFileSync(resolve(repoRoot, 'src/components/SaintSeiyaSanctuary.tsx'), 'utf8');
  const css = readFileSync(resolve(repoRoot, 'src/styles/theme-saintseiya.css'), 'utf8');

  assert.match(component, /\? 18 \+ activeChest\.mapX \* 0\.64/);
  assert.match(component, /\? 24 \+ activeChest\.mapY \* 0\.48/);
  assert.match(component, /Math\.max\(18, Math\.min\(82, minimapPingLeftRaw\)\)/);
  assert.match(component, /Math\.max\(24, Math\.min\(72, minimapPingTopRaw\)\)/);
  assert.match(css, /minimap-ping-layer[\s\S]*contain:\s*paint/);
  assert.match(css, /minimap-ping-layer[\s\S]*clip-path:\s*inset\(0 round 14px\)/);
  assert.match(css, /minimap-ping-layer\.is-hades \.t8-saint-sanctuary__ping[\s\S]*width:\s*30px/);
  assert.match(css, /transform:\s*translate\(-50%, -50%\) scale\(0\.92\)/);
  assert.match(css, /minimap-ping-layer\.is-hades \.t8-saint-sanctuary__ping\.is-opening[\s\S]*scale\(1\)/);
});

test('Saint Seiya node ports stay visible inside cloth box frames', () => {
  const css = readFileSync(resolve(repoRoot, 'src/styles/theme-saintseiya.css'), 'utf8');

  assert.match(css, /react-flow__node:not\(\.react-flow__node-groupBox\)[\s\S]*overflow:\s*visible !important/);
  assert.match(css, /react-flow__node:not\(\.react-flow__node-groupBox\) > div,[\s\S]*overflow:\s*visible !important/);
  assert.match(css, /react-flow__handle[\s\S]*z-index:\s*80 !important/);
  assert.match(css, /react-flow__handle-left[\s\S]*left:\s*8px !important/);
  assert.match(css, /react-flow__handle-right[\s\S]*right:\s*8px !important/);
});
