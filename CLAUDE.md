# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

T8-penguin-canvas（贞贞的无限画布）是一个基于节点的 AI 工作流画布工具，支持拖拽节点、连线、执行 AI 生成任务（图片/视频/音频/LLM）。同时提供 Web 应用和 Windows Electron 桌面应用两种形态。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 同时启动前端（Vite, port 11422）和后端（Express, port 18766） |
| `npm run build` | TypeScript 编译 + Vite 生产构建 |
| `npm run type-check` | 仅类型检查，不生成文件 |
| `npm run electron:dev` | Electron 开发模式（需先 `npm install` 在 `backend/` 下） |
| `npm run encrypt` | 将后端 JS 编译加密为 `.t8c` 文件（需 Electron 内置 Node） |
| `npm run dist` | 完整打包：构建 + 加密 + electron-builder NSIS 安装包 |
| `node --test tests/` | 运行所有测试（Node.js 内置 test runner） |

Windows 用户可用 `start-dev.bat` 一键启动开发环境。

## 架构概览

### 前后端分离

- **前端**：React 19 + TypeScript SPA，通过 Vite dev proxy（port 11422 → 18766）与后端通信
- **后端**：Express 4（port 18766），9 组路由处理画布 CRUD、设置、代理上游 AI 服务、文件管理等
- **路径别名**：`@` → `./src`，在 `tsconfig.json` 和 `vite.config.ts` 中配置

### 状态管理（Zustand）

所有全局状态使用 Zustand stores（`src/stores/`），不使用 Redux 或 Context API：
- `canvas.ts` — 画布 CRUD 和激活画布选择
- `apiKeys.ts` — API 密钥管理（真真/RH/LLM 等多组密钥）
- `theme.ts` — 主题切换（7 套内置主题，含亮/暗模式 + 主题音乐）
- `runBus.ts` — 批量执行总线
- `logs.ts` — 终端日志面板

### 节点系统

- 节点注册表：`src/config/nodeRegistry.ts`，注册 39 种节点类型（7 个分类）
- 节点组件：`src/components/nodes/` 下，每种节点类型一个文件
- 批量执行：`src/utils/topologicalSort.ts` 使用 Kahn 拓扑排序算法串行执行可执行节点
- 画布引擎：`@xyflow/react` 12，支持对齐辅助线、GroupBox 分组、minimap

### 关键目录

```
src/
├── components/nodes/    # ~40 个节点组件（核心开发区域）
├── stores/              # Zustand 状态管理
├── services/api.ts      # 后端 REST 客户端（类型化封装）
├── config/nodeRegistry.ts  # 节点类型注册表
├── types/canvas.ts      # 核心类型定义（NodeType, NodeMeta, CanvasData）
├── utils/topologicalSort.ts  # 拓扑排序（批量执行核心）
├── theme/               # 主题引擎
└── styles/              # CSS（含 6 个主题专用样式文件）

backend/src/
├── server.js            # 入口，挂载 9 组路由
├── config.js            # 端口、目录、上游服务地址
├── routes/proxy.js      # AI 服务代理层（自动保存生成物到本地）
└── routes/              # 其余 8 组路由

electron/
├── main.cjs             # Electron 主进程
├── encrypt.cjs          # T8ENC1 AES-256-CBC 加密脚本
├── loader.cjs           # bytenode .jsc 加载器 + T8ENC1 解密
└── _post_build.cjs      # 打包后验证（12 个加密路由文件完整性）
```

## 开发注意事项

### 添加新节点类型

1. 在 `src/config/nodeRegistry.ts` 中注册节点元信息（type, label, category, icon, color）
2. 在 `src/components/nodes/` 创建对应的节点组件
3. 在 `src/types/canvas.ts` 的 `NodeType` 联合类型中添加新类型
4. 如果节点可执行，在批量运行逻辑中确保其被拓扑排序覆盖

### 主题系统

主题通过 CSS 变量注入 document root 实现。主题文件在 `src/styles/`（`theme-core.css` + 6 个主题文件）。新增主题需在 `src/theme/` 中注册模板并添加对应 CSS。

### Electron 打包流程

1. `npm run build` → 前端静态资源到 `dist/`
2. `npm run encrypt` → 后端 JS → `.jsc`（bytenode）→ `.t8c`（AES-256-CBC 加密）
3. `electron-builder --win --x64` → NSIS 安装包到 `dist_electron/`
4. `node electron/_post_build.cjs` → 验证打包完整性

加密必须使用 Electron 内置的 Node.js（确保 V8 字节码版本匹配）。

### 安全设计

- API 密钥仅存储在后端，前端只接收脱敏值（`****xxxx`）
- 后端源码通过 T8ENC1 加密后分发，防止源码泄露
- CORS 限制为 localhost 来源

### 测试

使用 Node.js 内置 `node:test` 和 `node:assert/strict`，测试文件在 `tests/` 目录。运行：`node --test tests/`。
