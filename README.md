# 🐧 T8-penguin-canvas

> AI 节点画布 · Web 端轻量化重构版 ｜ v1.0.0
>
> 仓库：<https://github.com/T8mars/T8-penguin-canvas>

 **纯浏览器节点画布** 的核心：拖拽节点、连线、生成图像/视频/音频、调用 LLM、串接 RunningHub 工作流，并叠加批量执行与智能对齐能力。

---

## ✨ 功能亮点

- 🎨 **24 个节点** 全部业务化：文本 / 图像 / 视频 / 音频 / LLM / RunningHub / 画板 / 浏览器 / 抽帧 / 工具箱 …
- 🧩 **xyflow 12** 画布引擎：缩放、平移、连线、迷你地图、控制条
- 🔑 **三套独立 API Key**：贞贞工坊 / RunningHub / LLM 额度隔离，后端代理隐藏 Key
- 🚀 **一键批量运行**：拓扑排序串行触发可执行节点，进度可视化、可中断
- 🧲 **智能对齐辅助线 + snap-to-grid**：拖动时自动检测同列/同行/居中对齐并弱吸附
- ⏪ **Undo / Redo / 复制粘贴 / 导入导出 / 工作流模板**：完整画布交互
- 🌗 浅色 / 深色主题双模
- 🛡️ **防空数据覆盖**：双层防护（前端 + 后端）保护已保存画布

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Windows / macOS / Linux 浏览器（推荐 Chromium 内核）

### 安装

```powershell
git clone https://github.com/T8mars/T8-penguin-canvas.git
cd T8-penguin-canvas
npm install
cd backend; npm install; cd ..
```

### 启动开发模式

```powershell
npm run dev
```

`concurrently` 会同时拉起：

- 后端：`http://127.0.0.1:18766`
- 前端：`http://127.0.0.1:11422`

打开浏览器访问前端地址即可。Windows 下也可以双击 `start-dev.bat`。

### 配置 API Key

首次进入点击右上角 ⚙️ 打开设置弹窗，填入：

| Key | 用途 | BaseUrl |
|---|---|---|
| 贞贞工坊 API Key | image / video / audio | `https://ai.t8star.org`（固定） |
| LLM 独立 API Key | llm / vision（额度隔离） | `https://ai.t8star.org`（固定） |
| RunningHub API Key | runninghub 工作流 | `https://www.runninghub.cn`（可调） |

Key 保存到 `data/settings.json`；GET 接口仅返回 `****xxxx` 脱敏，明文仅供后端代理调用。

---

## 🧱 技术栈

- **前端**：React 19 · TypeScript · Vite 6 · Tailwind CSS 3 · @xyflow/react 12 · zustand 5 · lucide-react
- **后端**：Node.js · Express · sharp（图像处理）· multer（上传）
- **AI 上游**：贞贞工坊（图像/视频/Suno）· RunningHub · LLM(OpenAI 兼容协议)

---

## 📁 目录结构

```
T8-penguin-canvas/
├── backend/                 # Express 后端（端口 18766）
│   └── src/
│       ├── server.js
│       ├── config.js
│       └── routes/          # canvas / settings / files / imageOps / proxy
├── src/                     # 前端
│   ├── App.tsx
│   ├── components/
│   │   ├── Canvas.tsx       # 画布主体 + 批量运行 + 对齐辅助
│   │   ├── CanvasToolbar.tsx
│   │   ├── CanvasManager.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ApiSettings.tsx
│   │   └── nodes/           # 27 个节点组件
│   ├── stores/              # canvas / apiKeys / theme / runBus
│   ├── hooks/               # useCanvasHistory / useRunTrigger
│   ├── services/            # api / generation / imageOps
│   ├── config/              # nodeRegistry / canvasTemplates
│   ├── utils/               # topologicalSort
│   └── providers/           # 模型注册表
├── features.json            # 节点防丢失锁 + 接口快照
├── skill.md                 # 项目能力 / 接口 / 文件用途速查
├── vite.config.ts           # 前端 11422 + /api → 18766 代理
└── package.json
```

详细字段见 [skill.md](./skill.md)。

---

## 🎛️ 画布快捷键

| 快捷键 | 作用 |
|---|---|
| `Ctrl + Z` | 撤销 |
| `Ctrl + Shift + Z` / `Ctrl + Y` | 重做 |
| `Ctrl + C` / `Ctrl + V` / `Ctrl + D` | 复制 / 粘贴 / 快速复制 |
| `Delete` / `Backspace` | 删除选中节点或连线 |
| `Ctrl + A` | 全选节点 |
| `空格 + 拖拽` | 平移画布 |
| `滚轮 / 触控板` | 缩放画布 |

工具栏图标：▶ 批量运行 · 🧲 网格吸附 · ↶↷ 历史 · ⧉ 复制 · 📋 粘贴 · 🗑️ 删除 · ⬆️ 导入 · ⬇️ 导出 · ✨ 模板 · ❓ 帮助

---

## ⚙️ 批量执行（拓扑串行）

工具栏 ▶ 按钮一键运行画布上所有 **可执行节点**：

1. `topologicalSort()` 在「仅含可执行节点」的子图上做 Kahn 排序
2. 串行 `triggerRun(id)` → 等待运行总线 `lastDone.id === id` 推进
3. 进度徽标 `done/total` 实时显示，再次点击（■）中断

可执行节点（16 类）：image / edit / multi-angle-3d / panorama-720 / penguin-portrait / video / seedance / audio / llm / runninghub / resize / upscale / grid-crop / remove-bg / combine / frame-extractor。

---

## 🧲 节点对齐辅助

- **snap-to-grid**：xyflow 原生 20×20 网格吸附
- **智能辅助线**：拖动时检测每对节点的 6 条边（左/中/右、上/中/下），距离 < 6px 触发：
  - SVG 橙色虚线在世界坐标系（随视口缩放）渲染
  - 自动取差值最小者做弱吸附

工具栏「磁铁」按钮统一控制开关。

---

## 🛠️ 后端接口速览

完整接口表见 [skill.md §3](./skill.md#3-后端接口http1270018766)。

| 分组 | 主要路径 |
|---|---|
| 健康 | `GET /api/status` |
| 画布 | `GET/POST /api/canvas`、`GET/PUT/DELETE /api/canvas/:id`、`PATCH /api/canvas/:id/name` |
| 设置 | `GET/POST /api/settings`、`GET /api/settings/raw`（内部） |
| 文件 | `POST /api/files/upload`、`GET /api/files/list`、`POST /api/files/upload-base64` |
| 图像处理 | `/api/image/{resize,upscale,grid-crop,combine,remove-bg}` |
| 上游代理 | `/api/proxy/image`、`/api/proxy/llm`、`/api/proxy/video/{submit,query}`、`/api/proxy/audio/{submit,query}`、`/api/proxy/runninghub/{submit,query,app-info}` |

代理层会 **自动转存** 上游图像 / 视频 / 音频到 `output/`，前端永远拿到稳定的本地 `/files/output/*` URL。

---

## 📦 构建 / 部署

```powershell
npm run type-check    # tsc --noEmit
npm run build         # tsc -b && vite build
npm run preview       # 本地预览构建产物
```

后端为纯 Node 服务，部署时直接 `node backend/src/server.js` 即可，注意：

- `data/` 持久化设置和画布
- `input/ output/ thumbnails/` 持久化用户素材与生成产物（首次自动创建）

---

## 📋 节点清单（24 个）

| 分组 | 节点 |
|---|---|
| 核心 (8) | text · image · video · seedance · audio · llm · runninghub · rh-config |
| 特殊 (5) | multi-angle-3d · panorama-720 · penguin-portrait · portrait-metadata · storyboard-grid |
| 工具 (9) | drawing-board · browser · image-compare · frame-extractor · resize · combine · remove-bg · upscale · grid-crop |
| 辅助 (5) | edit · idea · bp · relay · video-output |
| 工具箱 (2) | cinematic · video-motion |

> 任何节点的删减都需在 [features.json](./features.json) 中说明。

---

## 📜 License

私有项目，仅限授权使用。

---

## 🐧 Credits

T8 企鹅画布 · 部分代码参考PenguinPravite以及infinite canvas以及zhenzhen-web项目。
