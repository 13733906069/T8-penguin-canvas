import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('app exposes a themed sidebar collapse toggle and H shortcut', () => {
  const app = read('../src/App.tsx');
  const css = read('../src/styles/index.css');

  assert.match(app, /SIDEBAR_COLLAPSED_STORAGE_KEY\s*=\s*'t8-sidebar-collapsed'/);
  assert.match(app, /readSidebarCollapsedPreference/);
  assert.match(app, /matchesAnyShortcut\(shortcuts\['global\.sidebar-toggle'\],\s*e\)/);
  assert.match(app, /isShortcutTypingTarget\(e\.target\)/);
  assert.match(app, /setSidebarCollapsed\(\(collapsed\)\s*=>\s*!collapsed\)/);
  assert.match(app, /\{!sidebarCollapsed && <Sidebar onAddNode=\{handleAddNode\} \/>\}/);
  assert.match(app, /className=\{`t8-main-layout flex-1 flex overflow-hidden relative\$\{sidebarCollapsed \? ' t8-main-layout--sidebar-collapsed' : ''\}`\}/);
  assert.match(app, /aria-label=\{sidebarCollapsed \? '显示侧边栏' : '隐藏侧边栏'\}/);
  assert.match(app, /title=\{sidebarCollapsed \? '显示侧边栏 \(H\)' : '隐藏侧边栏 \(H\)'\}/);
  assert.match(app, /PanelLeftOpen/);
  assert.match(app, /PanelLeftClose/);

  assert.match(css, /\.t8-main-layout\s*\{[\s\S]*--t8-sidebar-width:\s*256px/);
  assert.match(css, /\.t8-main-layout\s*\{[\s\S]*--t8-sidebar-toggle-top:\s*62px/);
  assert.match(css, /\.t8-main-layout--sidebar-collapsed\s*\{[\s\S]*--t8-sidebar-toggle-left:\s*10px/);
  assert.match(css, /\.t8-main-layout--sidebar-collapsed\s*\{[\s\S]*--t8-sidebar-toggle-top:\s*10px/);
  assert.match(css, /\.t8-main-layout > \.t8-canvas-shell\s*\{[\s\S]*min-width:\s*0/);
  assert.match(css, /\.t8-sidebar-toggle\s*\{[\s\S]*left:\s*var\(--t8-sidebar-toggle-left\)/);
  assert.match(css, /\.t8-sidebar-toggle\s*\{[\s\S]*top:\s*var\(--t8-sidebar-toggle-top\)/);
  assert.match(css, /\.t8-sidebar-toggle\s*\{[\s\S]*color:\s*var\(--t8-text-main/);
  assert.match(css, /\.t8-sidebar-toggle:hover,\s*\.t8-sidebar-toggle\.is-collapsed/);
});
