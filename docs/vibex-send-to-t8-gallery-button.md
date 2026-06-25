# VibeX 线上页增加“发送到 T8 画布”按钮实现说明

> 目标：在 VibeX 线上页面的“我的作品库”视频卡片上，增加一个“发送到 T8 画布”按钮。用户在 T8 Electron/网页画布里嵌入 VibeX 时，点击该按钮后，把当前作品视频和提示词发送回 T8 画布，T8 会自动创建一个输出素材视频节点。

## 背景

T8 画布已经支持接收 VibeX 视频结果，不需要改 T8 接收端。VibeX 只需要向 `window.parent` 或 `window.opener` 发送如下 `postMessage`：

```ts
{
  type: "t8:vibex-result",
  source: "vibex-workbench",
  payload: {
    videoUrl: "https://.../xxx.mp4",
    prompt: "生成提示词",
    model: "seedance-2.0/...",
    taskId: "task-xxx",
    rhTaskId: "task-xxx",
    metadata: {
      resolution: "480p",
      duration: "4",
      ratio: "adaptive"
    }
  }
}
```

T8 会识别 `payload.videoUrl` / `payload.videoUrls`，并创建视频类型的“输出素材”节点。

## 如果线上代码里还没有桥接工具

新增或确认存在 `src/lib/t8CanvasBridge.ts`：

```ts
export const T8_VIBEX_MESSAGE_CONTRACT = {
  type: "t8:vibex-result",
  source: "vibex-workbench",
} as const

export interface T8VibeXResultPayload {
  messageId?: string
  prompt?: string
  model?: string
  taskId?: string
  rhTaskId?: string
  pageUrl?: string
  pageTitle?: string
  videoUrl?: string
  videoUrls?: string[]
  imageUrl?: string
  imageUrls?: string[]
  audioUrl?: string
  audioUrls?: string[]
  metadata?: Record<string, unknown>
}

function uniqueMessageId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `vibex-${Date.now()}-${random}`
}

function buildPayload(input: T8VibeXResultPayload): T8VibeXResultPayload {
  return {
    ...input,
    messageId: input.messageId || uniqueMessageId(),
    pageUrl: input.pageUrl || (typeof window !== "undefined" ? window.location.href : ""),
    pageTitle: input.pageTitle || (typeof document !== "undefined" ? document.title : "VibeX"),
    videoUrls: [
      ...(input.videoUrl ? [input.videoUrl] : []),
      ...(Array.isArray(input.videoUrls) ? input.videoUrls : []),
    ].filter(Boolean),
    imageUrls: [
      ...(input.imageUrl ? [input.imageUrl] : []),
      ...(Array.isArray(input.imageUrls) ? input.imageUrls : []),
    ].filter(Boolean),
    audioUrls: [
      ...(input.audioUrl ? [input.audioUrl] : []),
      ...(Array.isArray(input.audioUrls) ? input.audioUrls : []),
    ].filter(Boolean),
    metadata: {
      ...(input.metadata || {}),
      sentAt: new Date().toISOString(),
    },
  }
}

export function canPostVibeXResultToT8Canvas() {
  if (typeof window === "undefined") return false
  return window.parent !== window || !!window.opener
}

export function postVibeXResultToT8Canvas(input: T8VibeXResultPayload) {
  if (typeof window === "undefined") return false
  const payload = buildPayload(input)
  let posted = false

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ ...T8_VIBEX_MESSAGE_CONTRACT, payload }, "*")
    posted = true
  }

  if (window.opener && window.opener !== window) {
    window.opener.postMessage({ ...T8_VIBEX_MESSAGE_CONTRACT, payload }, "*")
    posted = true
  }

  return posted
}
```

## HomePage.tsx 改动

### 1. 引入桥接函数

```ts
import { postVibeXResultToT8Canvas } from "@/lib/t8CanvasBridge"
```

### 2. 增加作品库卡片发送函数

放在 `sendCurrentVideoToT8Canvas` 附近即可：

```ts
function sendGalleryVideoToT8Canvas(item: GalleryItem) {
  if (!item.result_url) return false

  return postVibeXResultToT8Canvas({
    videoUrl: item.result_url,
    prompt: item.prompt || "",
    model: item.model_name || "",
    taskId: item.task_id || "",
    rhTaskId: item.task_id || "",
    metadata: {
      resolution: item.resolution || "",
      duration: item.duration || "",
      ratio: item.ratio || "",
      source: "vibex-gallery",
      galleryItemId: item.id,
      createdAt: item.created,
    },
  })
}
```

如果 `GalleryItem` 类型不在 `HomePage.tsx` 作用域内，需要从 `useHome.ts` 导出并引入，或者把参数类型临时写成当前项目已有的作品类型。

### 3. 给 GalleryCard 增加 props

原来大概是：

```ts
function GalleryCard({
  item,
  onUpdate,
  onDelete,
  onReuse,
  onDownload,
}: {
  item: GalleryItem
  onUpdate: ...
  onDelete: ...
  onReuse: ...
  onDownload: ...
}) {
```

改成：

```ts
function GalleryCard({
  item,
  onUpdate,
  onDelete,
  onReuse,
  onDownload,
  onSendToT8,
}: {
  item: GalleryItem
  onUpdate: ...
  onDelete: ...
  onReuse: ...
  onDownload: ...
  onSendToT8: (item: GalleryItem) => void
}) {
```

### 4. 在作品卡 hover 操作区加按钮

在作品卡视频预览 hover overlay 里，目前已有“复用提示词”和“下载”。增加一个按钮：

```tsx
<button
  type="button"
  onClick={() => onSendToT8(item)}
  className="flex items-center gap-1 px-2 py-1 rounded-sm bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
  title="把这个视频发送到 T8 画布"
>
  <ExternalLink className="w-3 h-3" />
  发送到画布
</button>
```

如果页面没有引入 `ExternalLink`，从 `lucide-react` 加上：

```ts
import { ExternalLink } from "lucide-react"
```

为了移动端/触屏也能用，建议在卡片下方 meta 区域也加一个常驻小按钮，不只依赖 hover：

```tsx
<button
  type="button"
  onClick={() => onSendToT8(item)}
  className="w-full inline-flex items-center justify-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
  title="把这个视频发送到 T8 画布"
>
  <ExternalLink className="w-3 h-3" />
  发送到 T8 画布
</button>
```

### 5. GalleryCard 调用处传入函数

在 `filteredGallery.map` 里：

```tsx
<GalleryCard
  key={item.id}
  item={item}
  onUpdate={p.updateGalleryItem}
  onDelete={p.deleteGalleryItem}
  onReuse={p.reusePrompt}
  onDownload={p.handleDownload}
  onSendToT8={(item) => {
    const ok = sendGalleryVideoToT8Canvas(item)
    // 可选：这里接项目自己的 toast/notice。没有 toast 就先不弹。
    // if (ok) toast.success("已发送到 T8 画布")
    // else toast.error("当前不是嵌入在 T8 画布中，无法发送")
  }}
/>
```

## 推荐 UI 位置

1. 作品卡视频封面 hover 操作区：`复用提示词 / 下载 / 发送到画布`
2. 卡片信息区底部常驻一行小按钮：`发送到 T8 画布`

这样桌面端和触屏端都能发现，不会藏在 hover 里。

## 验收标准

1. 在 T8 画布的 VibeX 节点内，打开“我的作品库”。
2. 点击某个作品卡片的“发送到 T8 画布”。
3. T8 画布出现一个新的“输出素材”节点，素材类型为视频。
4. 输出素材节点里包含该视频 URL，并保留提示词、模型、任务 ID、分辨率、时长、比例等元数据。
5. 在 VibeX 独立浏览器页面中点击该按钮时，不报错；如果没有父窗口或 opener，可以静默无操作，或用项目 toast 提示“请在 T8 画布嵌入页中使用”。

## 注意事项

- 不需要调用 T8 后端接口，直接 `postMessage` 即可。
- 不要只发任务 ID，必须带 `result_url` 对应的视频 URL。
- 支持 iframe 和新窗口两种场景，所以桥接函数要同时尝试 `window.parent` 和 `window.opener`。
- `postMessage` 的 `type` 必须是 `"t8:vibex-result"`，`source` 必须是 `"vibex-workbench"`。
- payload 字段名优先用 `videoUrl` 或 `videoUrls`，T8 已经按这两个字段接收。
