/**
 * T8-penguin-canvas 节点类型定义
 * 与 features.json 节点清单严格对齐(24 节点 + 4 已弃)
 */

// 节点类型(25 种保留 = 24 + upload)
export type NodeType =
  // Core (8)
  | 'text'
  | 'image'
  | 'video'
  | 'seedance'
  | 'audio'
  | 'llm'
  | 'runninghub'
  | 'rh-config'
  // Special (5)
  | 'multi-angle-3d'
  | 'panorama-720'
  | 'penguin-portrait'
  | 'portrait-metadata'
  | 'storyboard-grid'
  // Utility (9)
  | 'drawing-board'
  | 'browser'
  | 'image-compare'
  | 'frame-extractor'
  | 'resize'
  | 'combine'
  | 'remove-bg'
  | 'upscale'
  | 'grid-crop'
  // Auxiliary (5)
  | 'edit'
  | 'idea'
  | 'bp'
  | 'relay'
  | 'video-output'
  // Toolbox (2)
  | 'cinematic'
  | 'video-motion'
  // Input/Output 素材 (2) - 上传素材(图像/视频/音频三合一) + 输出素材(文本/图像/视频/音频预览)
  | 'upload'
  | 'output';

// 节点分类
export type NodeCategory =
  | 'core'
  | 'rh'
  | 'special'
  | 'utility'
  | 'auxiliary'
  | 'toolbox'
  | 'input';

// 节点元数据(用于 Sidebar 展示)
export interface NodeMeta {
  type: NodeType;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string; // lucide-react 图标名
  color: string; // tailwind 色阶
}

// 画布节点数据(xyflow Node.data)
export interface CanvasNodeData {
  label?: string;
  prompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  model?: string;
  status?: 'idle' | 'generating' | 'success' | 'error';
  error?: string;
  // 通用扩展字段
  [key: string]: any;
}

// 画布列表项(后端返回)
export interface CanvasListItem {
  id: string;
  name: string;
  nodeCount: number;
  createdAt: number;
  updatedAt: number;
}

// 画布完整数据
export interface CanvasData {
  nodes: any[];
  edges: any[];
  viewport: { x: number; y: number; zoom: number };
}

// API Key 设置(对应后端 settings)
export interface ApiSettings {
  zhenzhenApiKey: string;
  zhenzhenBaseUrl: string; // 锁定 https://ai.t8star.org
  rhApiKey: string;
  rhBaseUrl: string; // https://www.runninghub.cn
  llmApiKey: string;
  llmBaseUrl: string; // 锁定 https://ai.t8star.org
  preferences?: {
    theme?: 'dark' | 'light';
    language?: string;
  };
}
