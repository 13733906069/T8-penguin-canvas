import type { NodeMeta } from '../types/canvas';

const DEV_NODE_REGISTRY: NodeMeta[] = import.meta.env?.DEV ? [
  { type: 'rh-toolbox-maker', label: 'RH工具箱制作器', category: 'rh', description: '维护者专用：在画布内制作 RH工具箱 manifest 模板，开发环境可见，用户包不打入', icon: 'FileJson', color: 'emerald' },
  { type: 'fal-toolbox-maker', label: 'FAL应用制作工具', category: 'fal', description: '维护者专用：从 fal.ai API 文档生成 Fal超市 manifest 草稿，开发环境可见，用户包不打入', icon: 'FileJson', color: 'violet' },
] : [];

/**
 * 节点元数据注册表
 * 严格对齐 features.json 中的 24 个保留节点
 * 图标使用 lucide-react 名称(运行时由 Sidebar 动态查找)
 */
export const NODE_REGISTRY: NodeMeta[] = [
  // ========== 国漫角色制作 ==========
  { type: 'guoman-char-1', label: '清风-国漫角色文生图', category: 'guoman', description: 'RunningHub 国漫角色文生图专用节点（清风），支持角色模型/外观/动作/背景自定义', icon: 'Palette', color: 'orange' },
  { type: 'guoman-char-2', label: '清风-国漫角色姿势复刻', category: 'guoman', description: 'RunningHub 国漫角色姿势复刻专用节点（清风），支持姿势图上传/角色模型/外观/背景自定义', icon: 'Wand2', color: 'violet' },
  { type: 'guoman-char-3', label: '清风-国漫角色放大', category: 'guoman', description: 'RunningHub 国漫角色放大专用节点（清风），支持图像上传和角色模型选择', icon: 'ZoomIn', color: 'cyan' },
  { type: 'guoman-model-selector', label: '清风-国漫角色模型选择器', category: 'guoman', description: '国漫角色模型选择器（清风），选择模型后可连接到任意国漫角色节点', icon: 'Crown', color: 'amber' },

  // ========== Input 素材资源 ==========
  { type: 'upload', label: '上传素材', category: 'input', description: '图像 / 视频 / 音频 三合一上传(自适应输出端口)', icon: 'Upload', color: 'emerald' },
  { type: 'model-3d-upload', label: '3D素材上传', category: 'input', description: '上传 glb/gltf/obj/stl/fbx/usdz/zip 3D 模型素材，并可一键生成 3D 模型预览节点', icon: 'Box', color: 'blue' },
  { type: 'model-3d-preview', label: '3D模型预览', category: 'input', description: '预览 glb/gltf/obj/stl/fbx/usdz 3D 模型，显示原始下载地址，并把当前角度快照输出为图像', icon: 'Box', color: 'blue' },
  { type: 'material-set', label: '素材集', category: 'input', description: '把多个同类型文本 / 图像 / 视频 / 音频打包成可排序素材集，可直接传给生成与 RH 节点', icon: 'Images', color: 'teal' },
  { type: 'generation-target', label: '生成目标框', category: 'input', description: '先在画布上摆好 AI 结果位置，再把图像生成、网页反推或标注改图结果替换到框内', icon: 'ScanLine', color: 'teal' },
  { type: 'output', label: '输出素材', category: 'input', description: '起于上游任意节点的 文本/图像/视频/音频/3D模型 结果预览(原始宽高比 + 文本双击编辑)', icon: 'MonitorPlay', color: 'teal' },

  // ========== Core 核心节点(6) ==========
  { type: 'text', label: '文本', category: 'core', description: '提示词文本节点', icon: 'Type', color: 'sky' },
  { type: 'image', label: '图像', category: 'core', description: 'GPT Image 2 / Nano Banana Pro / Nano Banana 2 (多 TAB 模型切换)', icon: 'Image', color: 'amber' },
  { type: 'video', label: '视频', category: 'core', description: 'Veo / Grok Video', icon: 'Video', color: 'rose' },
  { type: 'video-edit', label: '视频剪辑', category: 'core', description: '轻量视频拼接台：收集多个视频、裁短排序、转场滤镜并合成为标准视频素材', icon: 'Scissors', color: 'rose' },
  { type: 'seedance', label: 'SD2.0', category: 'core', description: 'Seedance 2.0 视频分镜', icon: 'Film', color: 'fuchsia' },
  { type: 'director-storyboard', label: '导演分镜台', category: 'core', description: '秒级长片分镜台：多镜头提示词、参考素材和 Seedance2.0 无限并发生成', icon: 'Clapperboard', color: 'fuchsia' },
  { type: 'audio', label: '音频', category: 'core', description: 'Suno V5.5 全模式(生成/翻唱/续写)', icon: 'Music', color: 'violet' },
  { type: 'llm', label: 'LLM', category: 'core', description: 'GPT-5 / Claude 4.5 / Gemini 2.5(独立 Key)', icon: 'Brain', color: 'emerald' },

  // ========== RH RunningHub 节点 ==========
  { type: 'runninghub', label: 'RunningHub', category: 'rh', description: 'RH 工作流主节点', icon: 'Workflow', color: 'cyan' },
  // RH 钱包应用：复用 RunningHubNode 实现。v1.2.9.16 起与普通 RunningHub 节点统一使用 settings.rhApiKey
  { type: 'runninghub-wallet', label: 'RH钱包应用', category: 'rh', description: 'RH 钱包应用工作流（与 RunningHub 节点共用 RunningHub APIKEY）', icon: 'Wallet', color: 'violet' },
  // RH 配置节点从 v1.1.x 起隐藏（参数注入已可由 RunningHub 节点内表单代替，hidden:true 仅从 Sidebar 隐藏，保留老画布节点越。需重启删除 hidden 即可）
  { type: 'rh-config', label: 'RH 配置', category: 'rh', description: 'RH 工作流参数注入', icon: 'Settings2', color: 'cyan', hidden: true },
  // RH 工具节点 (v1.2.10+, 显示名从 v1.2.10.4 起改为「RH 超市」): 启动器式包装多个 RunningHub AI 应用，在节点内直接运行
  { type: 'rh-tools', label: 'RH超市', category: 'rh', description: '启动器式包装多个 RunningHub AI 应用，在节点内分类浏览 / 拼音搜索 / 一键运行', icon: 'Sparkles', color: 'cyan' },
  { type: 'rh-toolbox', label: 'RH工具箱', category: 'rh', description: '维护者精选 RunningHub 工具箱，只读分类运行，可作为图像/视频/文本/音频辅助能力被其他节点复用', icon: 'Wrench', color: 'cyan' },
  { type: 'vibex', label: 'VibeX工作台', category: 'rh', description: '嵌入 VibeX 视频工作台，支持线上 / 本地页面并把视频、图片、音频和提示词发送回当前画布', icon: 'Clapperboard', color: 'cyan' },
  ...DEV_NODE_REGISTRY,

  // ========== FAL 工具箱节点 ==========
  { type: 'fal-toolbox', label: 'Fal超市', category: 'fal', description: '按分类复刻 Fal.ai 模型能力，接上游文本/图像/视频/音频后一键运行，不影响原有图像/视频 FAL 节点', icon: 'Store', color: 'violet' },

  // ========== GROK OAuth Agent ==========
  { type: 'grok-oauth-agent', label: 'Grok OAuth Agent', category: 'grok', description: '独立 Grok / xAI OAuth Agent 工作台：流式聊天、图像、视频、TTS、STT，多模态输入并输出四类素材', icon: 'Bot', color: 'emerald' },

  // ========== Codex CLI Agent ==========
  { type: 'codex-cli-agent', label: 'Codex CLI Agent', category: 'codex', description: '面向创作者的 Codex CLI 工作台：流式对话、图像生成提示词、Skill 调用、产物库和版本树', icon: 'TerminalSquare', color: 'sky' },
  { type: 'codex-image-conjure', label: 'Codex 生图工作台', category: 'codex', description: '基于 Codex CLI imagegen 的专用生图工作台：提示词模板、片段、参考图和公共图库', icon: 'ImagePlus', color: 'sky' },

  // ========== Inspiration 灵感之源 ==========
  { type: 'artist-style-master', label: '艺术风格大师', category: 'inspiration', description: '移植 qiaomu 艺术家风格库：按画家、中文名、流派和标签检索，输出风格提示词或参考图', icon: 'Palette', color: 'amber' },
  { type: 'anime-tag-master', label: '动漫标签大师', category: 'inspiration', description: '移植 comfyui-anima-t8 Danbooru / Gelbooru 懒加载图库：搜索动漫标签、参考图、保存自定义标签并输出标签或图像', icon: 'Tags', color: 'lime' },

  // ========== ComfyUI 本地工作流节点 ==========
  { type: 'comfyui-store', label: 'ComfyUI超市', category: 'comfyui', description: 'ComfyUI 应用库：导入制作好的工作流应用，接上游素材后一键运行', icon: 'Boxes', color: 'cyan' },
  { type: 'comfyui-app-maker', label: 'ComfyUI应用制作工具', category: 'comfyui', description: '上传 ComfyUI API Workflow JSON，自动识别参数并保存为可复用应用', icon: 'FileJson', color: 'emerald' },

  // ========== Special 特殊节点(5) ==========
  // 以下五个节点暂时隐藏不展示 (hidden: true) —— 需要重新启用时删除 hidden 即可。
  { type: 'multi-angle-3d', label: '多角度 3D', category: 'special', description: '3D 多视角生成', icon: 'Box', color: 'indigo', hidden: true },
  { type: 'panorama-720', label: '720 全景', category: 'special', description: '720° 全景图', icon: 'Globe', color: 'indigo', hidden: true },
  { type: 'penguin-portrait', label: '企鹅肖像', category: 'special', description: '肖像专用流程', icon: 'UserSquare2', color: 'indigo', hidden: true },
  { type: 'portrait-metadata', label: '肖像元数据', category: 'special', description: '肖像参数管理', icon: 'FileText', color: 'indigo', hidden: true },
  { type: 'storyboard-grid', label: '分镜网格', category: 'special', description: '分镜九宫格布局', icon: 'LayoutGrid', color: 'indigo', hidden: true },

  // ========== Utility 工具节点(13) ==========
  // 其中 4 个暂时隐藏: browser / frame-extractor / remove-bg / upscale
  { type: 'drawing-board', label: '画板', category: 'utility', description: '图层画板：接上游图片后手绘、标注、组合并输出图像', icon: 'Pencil', color: 'orange' },
  { type: 'browser', label: '浏览器', category: 'utility', description: '网页内嵌', icon: 'Globe2', color: 'orange', hidden: true },
  { type: 'image-compare', label: '图像对比', category: 'utility', description: '双图滑杆 / 并排 / 叠加 / 热力 / 聚焦对比', icon: 'GitCompare', color: 'orange' },
  { type: 'frame-extractor', label: '抽帧', category: 'utility', description: '视频抽帧', icon: 'Scissors', color: 'orange', hidden: true },
  // 首尾帧获取 (v1.2.7): 输入视频节点 → 运行后抽取首帧/尾帧 → 双 image 输出
  { type: 'frame-pair', label: '首尾帧获取', category: 'utility', description: '从视频抽取首帧与尾帧，双输出可分别接下游', icon: 'Film', color: 'orange' },
  // 循环器 (v1.2.8): 上游多素材 → 串联/并联驱动下游执行链
  { type: 'loop', label: '循环器', category: 'utility', description: '接多个同类型素材，串联逐个驱动或并联克隆子图同时跱发下游生成节点', icon: 'Repeat', color: 'orange' },
  // 从合集获取 (v1.2.8): 多素材 → 按序号取单个传给下游
  { type: 'pick-from-set', label: '从合集获取', category: 'utility', description: '从上游多素材中按序号取出单一素材，kind 可在节点内切换', icon: 'Filter', color: 'orange' },
  { type: 'text-split', label: '文本分割', category: 'utility', description: '将长提示词/分镜按段落、行、智能分镜、正则、自定义分隔符或字数切成多段文本，支持收藏与循环器链路', icon: 'SplitSquareVertical', color: 'orange' },
  { type: 'resize', label: '尺寸调整', category: 'utility', description: '图像尺寸调整', icon: 'Maximize2', color: 'orange' },
  { type: 'combine', label: '合并', category: 'utility', description: '图像合并', icon: 'Combine', color: 'orange' },
  { type: 'remove-bg', label: '抠图', category: 'utility', description: '去除背景', icon: 'Eraser', color: 'orange', hidden: true },
  { type: 'upscale', label: '放大', category: 'utility', description: '图像放大', icon: 'ZoomIn', color: 'orange', hidden: true },
  { type: 'grid-crop', label: '宫格剪裁', category: 'utility', description: '网格切图', icon: 'Grid3x3', color: 'orange' },
  { type: 'grid-editor', label: '宫格编辑', category: 'utility', description: '多图分镜宫格拼接与顺序拆分', icon: 'LayoutGrid', color: 'orange' },

  // ========== Auxiliary 辅助节点(6) ==========
  // 其中 2 个暂时隐藏: edit / video-output
  { type: 'edit', label: '编辑', category: 'auxiliary', description: '图像编辑/局部', icon: 'Edit3', color: 'slate', hidden: true },
  { type: 'idea', label: '灵感', category: 'auxiliary', description: '灵感记录', icon: 'Lightbulb', color: 'slate' },
  { type: 'bp', label: 'BP 蓝图', category: 'auxiliary', description: 'Blueprint 蓝图', icon: 'Map', color: 'slate' },
  { type: 'relay', label: '中继', category: 'auxiliary', description: '数据中转', icon: 'ArrowRightLeft', color: 'slate' },
  { type: 'remove-ai-watermark', label: '去AI水印', category: 'auxiliary', description: '基于 remove-ai-watermarks 的可见/隐形水印、局部擦除、元数据清理与鉴别', icon: 'ShieldOff', color: 'slate' },
  { type: 'video-output', label: '视频输出', category: 'auxiliary', description: '视频结果展示', icon: 'MonitorPlay', color: 'slate', hidden: true },

  // ========== Toolbox 工具箱(6) ==========
  { type: 'cinematic', label: '电影感', category: 'toolbox', description: '电影感组合器：风格 / 镜头 / 光影 / 调色 / 质感各 50 项，支持收藏与 JSON 导入/导出', icon: 'Clapperboard', color: 'pink' },
  { type: 'video-motion', label: '视频运镜', category: 'toolbox', description: '视频运镜组合器：场景 / 动作 / 路径 / 节奏 / 稳定 / 主体约束各 50 项，支持收藏与 JSON 导入/导出', icon: 'Camera', color: 'pink' },
  { type: 'multi-angle-visual', label: '可视化多角度', category: 'toolbox', description: '可视化调节方位 / 俯仰 / 远近，支持批量角度、Prompt 模式、前后缀、镜头收藏、JSON 导入/导出与紧凑双栏 UI', icon: 'Compass', color: 'pink' },
  { type: 'portrait-master', label: '肖像大师', category: 'toolbox', description: '捏人 Prompt 设计器：五官、发型、服饰、配饰、气质神情等 9 大类词库，支持随机、锁定、权重和运行输出文本', icon: 'UserRoundCog', color: 'pink' },
  { type: 'pose-master', label: '姿势大师', category: 'toolbox', description: '人体线稿姿态编辑器：支持多人姿势、抓取移动、OpenPose/COCO 预览输出、keypoints JSON 与中英文 prompt', icon: 'PersonStanding', color: 'pink' },
  { type: 'aggregate-parser', label: '聚合解析', category: 'toolbox', description: '基于 ParseHub 的轻量自媒体聚合解析：输入短链/分享码/分享文案，合规确认后默认保存到输出目录；远端地址解析作为高级模式保留', icon: 'Link2', color: 'pink' },
  { type: 'batch-processor', label: '批量素材处理', category: 'toolbox', description: '批量导入文件或文件夹，在节点内完成命名、去黑边、抠图、扩图、高清放大和进度反馈，不自动铺满画布输出节点', icon: 'Files', color: 'pink' },
  { type: 'topaz-image-upscale', label: 'Topaz图像高清化', category: 'toolbox', description: '调用本机 Topaz Gigapixel AI / Gigapixel 8，对上游图像做本地高清放大；需要用户已安装并登录软件', icon: 'Image', color: 'pink' },
  { type: 'topaz-video-upscale', label: 'Topaz视频高清化', category: 'toolbox', description: '调用本机 Topaz Video AI 自带 ffmpeg，对上游视频做放大与补帧；需要用户已安装并登录软件', icon: 'Video', color: 'pink' },

  // ========== 3D 节点 ==========
  { type: 'panorama-3d', label: '3D全景', category: '3d', description: 'Three.js 360 全景预览与取景导出，内置 GPT Image 2 文生/图生 21:9 全景贴图生成', icon: 'Globe2', color: 'sky' },
];

// 按分类分组,便于 Sidebar 渲染 (在这里过滤 hidden 节点 —— 它们仍在 NODE_REGISTRY 中保证节点类型注册)
export const NODE_GROUPS: Record<string, { label: string; nodes: NodeMeta[] }> = {
  guoman: { label: '国漫角色制作', nodes: NODE_REGISTRY.filter((n) => n.category === 'guoman' && !n.hidden) },
  input: { label: '素材资源', nodes: NODE_REGISTRY.filter((n) => n.category === 'input' && !n.hidden) },
  core: { label: '核心节点', nodes: NODE_REGISTRY.filter((n) => n.category === 'core' && !n.hidden) },
  rh: { label: 'RH', nodes: NODE_REGISTRY.filter((n) => n.category === 'rh' && !n.hidden) },
  fal: { label: 'FAL工具箱', nodes: NODE_REGISTRY.filter((n) => n.category === 'fal' && !n.hidden) },
  grok: { label: 'GROK OAuth', nodes: NODE_REGISTRY.filter((n) => n.category === 'grok' && !n.hidden) },
  codex: { label: 'CODEX CLI', nodes: NODE_REGISTRY.filter((n) => n.category === 'codex' && !n.hidden) },
  inspiration: { label: '灵感之源', nodes: NODE_REGISTRY.filter((n) => n.category === 'inspiration' && !n.hidden) },
  comfyui: { label: 'ComfyUI', nodes: NODE_REGISTRY.filter((n) => n.category === 'comfyui' && !n.hidden) },
  special: { label: '特殊节点', nodes: NODE_REGISTRY.filter((n) => n.category === 'special' && !n.hidden) },
  utility: { label: '工具节点', nodes: NODE_REGISTRY.filter((n) => n.category === 'utility' && !n.hidden) },
  auxiliary: { label: '辅助节点', nodes: NODE_REGISTRY.filter((n) => n.category === 'auxiliary' && !n.hidden) },
  toolbox: { label: '工具箱', nodes: NODE_REGISTRY.filter((n) => n.category === 'toolbox' && !n.hidden) },
  '3d': { label: '3D', nodes: NODE_REGISTRY.filter((n) => n.category === '3d' && !n.hidden) },
};

// 通过 type 反查 meta
export function getNodeMeta(type: string): NodeMeta | undefined {
  return NODE_REGISTRY.find((n) => n.type === type);
}
