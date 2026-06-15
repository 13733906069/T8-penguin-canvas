import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

function extractCssVar(css: string, name: string) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  assert.ok(match, `missing --${name}`);
  return match[1].toLowerCase();
}

test('Tetris theme is registered as a strong built-in visual style', () => {
  const types = read('../src/theme/types.ts');
  const defaults = read('../src/theme/defaultTemplates.ts');
  const manager = read('../src/components/ThemeTemplateManager.tsx');
  const manifest = read('../shared/achievementManifest.json');

  assert.match(types, /'tetris'/);
  assert.match(types, /'tetris-stack'/);
  assert.match(types, /'tetromino-well'/);
  assert.match(types, /'arcade-cabinet-card'/);
  assert.match(types, /'block-drop'/);
  assert.match(defaults, /TETRIS_TEMPLATE_ID/);
  assert.match(defaults, /name:\s*'俄罗斯方块主题'/);
  assert.match(defaults, /tetrisThemeMusicUrl = new URL\('\.\.\/assets\/theme-music\/tetris-korobeiniki\.mp3'/);
  assert.match(defaults, /style:\s*'tetris'/);
  assert.match(defaults, /canvasPattern:\s*'tetris-stack'/);
  assert.match(defaults, /nodeFrame:\s*'arcade-cabinet-card'/);
  assert.match(defaults, /id: TETRIS_TEMPLATE_ID[\s\S]*source:\s*'url'[\s\S]*url:\s*tetrisThemeMusicUrl/);
  assert.equal(existsSync(new URL('../src/assets/theme-music/tetris-korobeiniki.mp3', import.meta.url)), true);
  assert.match(manager, /value:\s*'tetris'[\s\S]*label:\s*'俄罗斯方块'/);
  assert.match(manager, /visualStyle === 'tetris'[\s\S]*preset:\s*'block-drop'/);
  assert.match(manifest, /"style":\s*"tetris"/);
  assert.match(manifest, /"metric":\s*"tetrisTetrises"/);
});

test('Tetris theme files are imported and mounted in the toolbar without covering core controls', () => {
  const cssIndex = read('../src/styles/index.css');
  const css = read('../src/styles/theme-tetris.css');
  const canvas = read('../src/components/Canvas.tsx');
  const edge = read('../src/components/edges/DeletableEdge.tsx');
  const panel = read('../src/components/TetrisPanel.tsx');

  assert.match(cssIndex, /theme-tetris\.css/);
  assert.match(canvas, /import TetrisPanel from '\.\/TetrisPanel'/);
  assert.match(canvas, /<CanvasToolbar[\s\S]*<TetrisPanel[\s\S]*visualStyle=\{visualStyle\}/);
  assert.match(canvas, /t8:tetris-energy-bonus/);
  assert.match(panel, /TETRIS_PANEL_COLLAPSED_STORAGE_KEY/);
  assert.match(panel, /TETRIS_PANEL_STATE_STORAGE_KEY/);
  assert.match(panel, /TETRIS_PANEL_CHECKPOINT_STORAGE_KEY/);
  assert.match(panel, /createTetrisCheckpoint/);
  assert.match(panel, /restoreTetrisCheckpoint/);
  assert.match(panel, /TETRIS_DEV_CHECKPOINTS_ENABLED/);
  assert.match(panel, /TETRIS_DEV_CHECKPOINT_LEVELS/);
  assert.match(panel, /TETRIS_CHAPTERS[\s\S]*\.map\(\(chapter\) => chapter\.levelEnd\)/);
  assert.match(panel, /getTetrisCheckpointOptions/);
  assert.match(panel, /checkpointOptions\.map/);
  assert.match(panel, /TETRIS_POWERS/);
  assert.match(panel, /getTetrisChapter/);
  assert.match(panel, /canUseTetrisPower/);
  assert.match(panel, /lastFeedback/);
  assert.match(panel, /t8-tetris-panel__feedback/);
  assert.match(panel, /t8-tetris-panel__feedback-slot/);
  assert.match(panel, /t8-tetris-panel__feedback t8-tetris-panel__feedback--side/);
  assert.match(panel, /t8-tetris-panel__stage-chip/);
  assert.match(panel, /data-stage-effect=\{chapter\.effect\.id\}/);
  assert.match(panel, /has-feedback-\$\{game\.lastFeedback\?\.type/);
  assert.match(panel, /type:\s*'usePower'/);
  assert.match(panel, /applyCanvasEnergyBonus/);
  assert.match(panel, /addEventListener\('t8:tetris-energy-bonus'/);
  assert.match(panel, /selectedCheckpointLevel/);
  assert.match(panel, /t8-tetris-panel__mission/);
  assert.match(panel, /t8-tetris-panel__mechanic/);
  assert.match(panel, /Lv\{chapter\.levelStart\}-\{chapter\.levelEnd\}/);
  assert.match(panel, /5关机制/);
  assert.match(panel, /chapter\.effect\.cue/);
  assert.match(panel, /t8-tetris-panel__play/);
  assert.match(panel, /t8-tetris-panel__mission-clear/);
  assert.match(panel, /missionFlash/);
  assert.match(panel, /game\.status === 'victory'/);
  assert.match(panel, /is-victory/);
  assert.match(panel, /t8-tetris-panel__victory-menu/);
  assert.match(panel, /ALL CLEAR/);
  assert.match(panel, /startFreshGame/);
  assert.match(panel, /t8-tetris-panel__power/);
  assert.match(panel, /t8-tetris-panel__power-note/);
  assert.match(panel, /t8-tetris-panel__power-cost/);
  assert.match(panel, /getTetrisPowerCost/);
  assert.match(panel, /powerCostSummary/);
  assert.match(panel, /随机清除 5-10 个障碍/);
  assert.match(panel, /\$\{powerCost\} POWER/);
  assert.match(panel, /key:\s*'1'/);
  assert.match(panel, /key:\s*'2'/);
  assert.match(panel, /key:\s*'3'/);
  assert.match(panel, /key:\s*'4'/);
  assert.match(panel, /t8-tetris-panel__power-hotkey/);
  assert.match(panel, /usePower\(powerButton\.id\)/);
  assert.match(panel, /Maximize2/);
  assert.match(panel, /Minimize2/);
  assert.match(panel, /createPortal/);
  assert.match(panel, /isStageMode/);
  assert.match(panel, /t8-tetris-stage-open/);
  assert.match(panel, /event\.key === 'Escape'/);
  assert.match(panel, /setIsStageMode\(false\)/);
  assert.doesNotMatch(panel, /requestFullscreen/);
  assert.doesNotMatch(panel, /fullscreenchange/);
  assert.match(panel, /createPortal\(panelMarkup,\s*document\.body\)/);
  assert.match(panel, /isStageMode \? 'is-stage-mode' : ''/);
  assert.match(panel, /\(!collapsed \|\| isStageMode\)/);
  assert.match(panel, /t8-tetris-panel__stage-mode/);
  assert.match(panel, /大屏/);
  assert.match(panel, /退出大屏/);
  assert.match(panel, /t8-tetris-panel__checkpoint/);
  assert.match(panel, /t8-tetris-panel__help/);
  assert.match(panel, /Space[\s\S]*硬降/);
  assert.match(panel, /target\.closest\('input, textarea, select, \[contenteditable="true"\]'\)/);
  assert.match(panel, /hasBlockingModalOpen/);
  assert.match(panel, /\.px-modal-mask/);
  assert.match(panel, /弹窗打开，游戏已暂停/);
  assert.match(panel, /MutationObserver/);
  assert.match(panel, /const keyboardActive = isStageMode \|\| hovered \|\| focused/);
  assert.match(panel, /const externalNodeDragging = nodeDragging && !keyboardActive/);
  assert.match(panel, /autoPauseReason && keyboardActive/);
  assert.match(panel, /data-tetris-interaction-surface="true"/);
  assert.match(panel, /isTetrisInteractiveTarget/);
  assert.match(panel, /target\.closest\('button, a, input, textarea, select, \[role="button"\], \[contenteditable="true"\]'\)/);
  assert.match(panel, /if \(isTetrisInteractiveTarget\(event\.target\)\) return/);
  assert.match(panel, /onPointerDownCapture=\{stopTetrisCanvasGesture\}/);
  assert.match(panel, /onPointerMoveCapture=\{stopTetrisCanvasGesture\}/);
  assert.match(panel, /onWheelCapture=\{stopTetrisCanvasGesture\}/);
  assert.match(panel, /autoPauseReason/);
  assert.match(edge, /getSmoothStepPath/);
  assert.match(edge, /visualStyle === 'tetris'[\s\S]*getSmoothStepPath/);
  assert.match(edge, /borderRadius:\s*0/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-app-shell/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-sidebar/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-sidebar::before/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-sidebar::before \{[\s\S]*opacity:\s*0\.12/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-sidebar::before \{[\s\S]*background-position:[\s\S]*calc\(100% -/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-sidebar \.px-group-title \{[\s\S]*padding-right:\s*32px/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-sidebar \.px-group-title \{[\s\S]*var\(--tt-cyan\) calc\(100% - 32px\)/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-sidebar-node::before \{[\s\S]*opacity:\s*0\.46/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-sidebar-node::before/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-canvas-shell/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__pane::before/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__pane::before \{[\s\S]*opacity:\s*0\.12/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__pane::after \{[\s\S]*content:\s*"TETRIS"/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__pane::after \{[\s\S]*pointer-events:\s*none/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) > div::before/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) > div::after/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node\.dragging:not\(\.react-flow__node-groupBox\) > div::before/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-canvas-shell\.t8-node-dragging \.react-flow__node:not\(\.react-flow__node-groupBox\) > div::before/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node\.dragging:not\(\.react-flow__node-groupBox\) \.t8-node::before/);
  assert.match(css, /html\[data-theme-style="pixel"\]\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) > div:first-child/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) > div > :not\(\.react-flow__handle\)/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) > div > :not\(\.react-flow__handle\):not\(\.react-flow__resize-control\):not\(\.t8-resize-handle\)/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) \.react-flow__resize-control[\s\S]*position:\s*absolute\s*!important/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) \.t8-resize-handle[\s\S]*position:\s*absolute\s*!important/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) \[class\*="border-white\/10"\]/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__node:not\(\.react-flow__node-groupBox\) \[data-drag-source\]/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__handle::before/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__handle.source::after/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-node-action-bar--tetris/);
  assert.match(css, /--t8-cut-cursor:[\s\S]*svg/);
  assert.match(css, /--t8-cut-button-mask:[\s\S]*M3 3h6v6H3z/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__connection-path/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__edge-textbg/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-edge-theme-marker \{[\s\S]*display:\s*block/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-edge-yyh-red-segment\.t8-edge-theme-active \{[\s\S]*animation:\s*tetris-edge-block-flow/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__edge\.cut-marked \.react-flow__edge-path/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.cut-overlay-svg \.cut-overlay-path/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-edge-cut-button \{[\s\S]*border-radius:\s*4px/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.t8-edge-cut-glyph \{[\s\S]*-webkit-mask:\s*none/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__minimap/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__minimap svg/);
  assert.match(css, /html\[data-theme-visual="tetris"\] \.react-flow__minimap-node:nth-of-type/);
  assert.match(css, /\.t8-tetris-panel \{/);
  assert.match(css, /--tetris-cell-size:\s*15px/);
  assert.match(css, /\.t8-tetris-panel__panel \{[\s\S]*top:\s*calc\(100% \+ 8px\)/);
  assert.match(css, /\.t8-tetris-panel__panel \{[\s\S]*overflow:\s*visible/);
  assert.doesNotMatch(css, /\.t8-tetris-panel__panel \{[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.t8-tetris-panel__body \{[\s\S]*grid-template-columns:\s*calc\(var\(--tetris-cell-size\) \* 10 \+ 8px\) minmax\(0,\s*104px\)/);
  assert.match(css, /\.t8-tetris-panel__body \{[\s\S]*grid-template-areas:\s*"play side"[\s\S]*"mission mechanic"[\s\S]*"power power"/);
  assert.match(css, /\.t8-tetris-panel__play \{/);
  assert.match(css, /\.t8-tetris-panel__play \{[\s\S]*grid-area:\s*play/);
  assert.match(css, /\.t8-tetris-panel__side \{[\s\S]*grid-template-rows:\s*54px 54px minmax\(72px,\s*auto\) minmax\(38px,\s*1fr\)/);
  assert.match(css, /\.t8-tetris-panel__mission small \{[\s\S]*white-space:\s*normal/);
  assert.match(css, /\.t8-tetris-panel__mechanic \{[\s\S]*grid-area:\s*mechanic/);
  assert.match(css, /\.t8-tetris-panel__mechanic small \{[\s\S]*white-space:\s*normal/);
  assert.match(css, /\.t8-tetris-panel__power-note \{[\s\S]*white-space:\s*normal/);
  assert.match(css, /\.t8-tetris-panel__mission \{[\s\S]*grid-area:\s*mission/);
  assert.match(css, /\.t8-tetris-panel__mission\.is-complete/);
  assert.match(css, /\.t8-tetris-panel__mission-clear/);
  assert.match(css, /\.t8-tetris-panel__mission-flash/);
  assert.match(css, /\.t8-tetris-panel__power \{[\s\S]*grid-area:\s*power/);
  assert.match(css, /\.t8-tetris-panel__power-grid \{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.t8-tetris-panel__power-button/);
  assert.match(css, /\.t8-tetris-panel__power-hotkey/);
  assert.match(css, /\.t8-tetris-panel__power-cost/);
  assert.match(css, /\.t8-tetris-panel__power-note/);
  assert.match(css, /\.t8-tetris-panel__stage-chip/);
  assert.match(css, /\.t8-tetris-panel__feedback/);
  assert.match(css, /\.t8-tetris-panel__feedback-slot/);
  assert.match(css, /\.t8-tetris-panel__feedback--side \{[\s\S]*position:\s*relative/);
  assert.match(css, /\.t8-tetris-panel__feedback--side strong \{[\s\S]*white-space:\s*normal/);
  assert.doesNotMatch(css, /\.t8-tetris-panel__feedback \{[^}]*position:\s*absolute/);
  assert.match(css, /\.t8-tetris-panel__panel\.has-feedback-tetris/);
  assert.match(css, /\.t8-tetris-panel__panel\.has-feedback-combo/);
  assert.match(css, /\.t8-tetris-panel__panel\.has-feedback-hard-drop/);
  assert.match(css, /\.t8-tetris-panel__panel\.has-feedback-power/);
  assert.match(css, /\.t8-tetris-panel__panel\.has-feedback-victory/);
  assert.match(css, /\.t8-tetris-panel__panel\.is-victory/);
  assert.match(css, /@keyframes tetris-victory-burst/);
  assert.match(css, /\.t8-tetris-panel__victory-menu/);
  assert.match(css, /\.t8-tetris-cell\.is-dot/);
  assert.match(css, /--tt-dot:\s*#/);
  assert.match(css, /\.t8-tetris-cell\.is-domino/);
  assert.match(css, /--tt-domino:\s*#/);
  assert.match(css, /\.t8-tetris-cell\.is-trio/);
  assert.match(css, /--tt-trio:\s*#/);
  assert.match(css, /\.t8-tetris-cell\.is-bar4/);
  assert.match(css, /--tt-bar4:\s*#/);
  assert.match(css, /\.t8-tetris-cell\.is-corner/);
  assert.match(css, /--tt-corner:\s*#/);
  assert.match(css, /\.t8-tetris-cell\.is-plus/);
  assert.match(css, /--tt-plus:\s*#/);
  assert.match(css, /\.t8-tetris-cell\.is-stair/);
  assert.match(css, /--tt-stair:\s*#/);
  assert.match(css, /\.t8-tetris-cell\.is-hook/);
  assert.match(css, /--tt-hook:\s*#/);
  const classicBlockColors = [
    'tt-cyan',
    'tt-yellow',
    'tt-purple',
    'tt-green',
    'tt-red',
    'tt-blue',
    'tt-orange',
  ].map((name) => extractCssVar(css, name));
  const newSketchColors = [
    'tt-dot',
    'tt-domino',
    'tt-trio',
    'tt-bar4',
    'tt-corner',
    'tt-plus',
    'tt-stair',
    'tt-hook',
  ].map((name) => extractCssVar(css, name));
  assert.equal(new Set(newSketchColors).size, newSketchColors.length);
  for (const color of newSketchColors) {
    assert.equal(classicBlockColors.includes(color), false, `${color} should not duplicate classic piece colors`);
  }
  assert.doesNotMatch(css, /--tt-dot:\s*#f7f4e8/i);
  assert.doesNotMatch(css, /--tt-dot:\s*#ffffff/i);
  assert.match(css, /\.t8-tetris-cell\.is-hazard-added/);
  assert.doesNotMatch(css, /\.t8-tetris-cell\.is-order \{[\s\S]*linear-gradient\(90deg,\s*transparent 0 36%,\s*#07131f/);
  assert.match(css, /\.t8-tetris-cell\.is-order \{[\s\S]*radial-gradient\(circle at calc\(100% - 4px\) 4px/);
  assert.match(css, /\.t8-tetris-panel__panel\[data-stage-effect="energy-surge"\]/);
  assert.match(css, /\.t8-tetris-panel__panel\[data-stage-effect="finale-rainbow"\]/);
  assert.match(css, /\.t8-tetris-panel__panel\[data-stage-effect/);
  assert.match(css, /\.t8-tetris-panel__help \{/);
  assert.match(css, /\.t8-tetris-panel__checkpoint \{[\s\S]*margin-top:\s*5px/);
  assert.match(css, /\.t8-tetris-panel__power-button \{[\s\S]*height:\s*28px/);
  assert.match(css, /body\.t8-tetris-stage-open/);
  assert.match(css, /\.t8-tetris-panel\.is-stage-mode/);
  assert.match(css, /BLOCK STAGE/);
  assert.match(css, /\.t8-tetris-panel\.is-stage-mode::after/);
  assert.match(css, /\.t8-tetris-panel\.is-stage-mode \.t8-tetris-panel__panel/);
  assert.match(css, /--tetris-cell-size:\s*clamp\(24px,\s*4vh,\s*44px\)/);
  assert.match(css, /grid-template-areas:\s*[\s\S]*"play side"[\s\S]*"play power"/);
  assert.match(css, /\.t8-tetris-panel\.is-stage-mode \{[\s\S]*position:\s*fixed/);
  assert.doesNotMatch(css, /\.t8-tetris-panel:fullscreen/);
  assert.doesNotMatch(css, /\.t8-tetris-panel:-webkit-full-screen/);
  assert.match(css, /\.t8-tetris-panel__actions \{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.t8-tetris-panel__stage-mode/);
  assert.match(css, /\.t8-tetris-panel__actions button \{[\s\S]*height:\s*26px/);
  assert.match(css, /\.t8-tetris-panel__well \{[\s\S]*grid-template-columns:\s*repeat\(10,\s*var\(--tetris-cell-size\)\)/);
  assert.match(css, /\.t8-tetris-panel__well \{[\s\S]*grid-template-rows:\s*repeat\(20,\s*var\(--tetris-cell-size\)\)/);
  assert.match(css, /\.t8-tetris-panel__well \{[\s\S]*padding:\s*4px/);
  assert.match(css, /\.t8-tetris-panel__panel \{[\s\S]*right:\s*0/);
  assert.doesNotMatch(css, /\.t8-tetris-panel__panel \{[\s\S]*position:\s*fixed/);
});
