/**
 * GuomanModelSelectorNode - 清风-国漫角色模型选择器
 *
 * 独立的模型选择节点，选择模型后可连接到任意国漫角色节点
 * 输出选中的模型名称（文本），供下游国漫节点自动填充
 */
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Crown, ChevronDown, X } from 'lucide-react';
import { useUpdateNodeData } from './useUpdateNodeData';
import { useThemeStore } from '../../stores/theme';
import GuomanModelPickerModal from '../GuomanModelPickerModal';

// ========== 固定配置 ==========
const APP_NAME = '清风-国漫角色模型选择器';
const COLOR = '#f59e0b'; // amber-500

// ========== 主组件 ==========
const GuomanModelSelectorNode = ({ id, data, selected }: NodeProps) => {
  const update = useUpdateNodeData(id);
  const { theme } = useThemeStore();

  const modelName: string = (data as any).modelName || '';
  const modelDisplayName: string = (data as any).modelDisplayName || '';
  const thumbnailUrl: string = (data as any).thumbnailUrl || '';

  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  // ========== 主题 ==========
  const isDark = theme === 'dark';
  const bg = isDark ? 'rgba(20,20,22,.95)' : 'rgba(255,255,255,.97)';
  const textColor = isDark ? '#f4f4f5' : '#18181b';
  const mutedColor = isDark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)';
  const inputBg = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
  const borderColor = selected ? COLOR : isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';

  // ========== 模型选择回调 ==========
  const handleModelSelect = (selectedModelName: string, displayName?: string, thumb?: string) => {
    update({
      modelName: selectedModelName,
      modelDisplayName: displayName || selectedModelName,
      thumbnailUrl: thumb || '',
      // 同时更新 text 字段，让 useUpstreamMaterials 能识别这个文本输出
      text: selectedModelName,
      prompt: selectedModelName,
    });
  };

  // ========== 清除模型 ==========
  const handleClearModel = () => {
    update({
      modelName: '',
      modelDisplayName: '',
      thumbnailUrl: '',
      text: '',
      prompt: '',
    });
  };

  return (
    <div
      style={{
        background: bg,
        backdropFilter: 'blur(12px)',
        width: 260,
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        boxShadow: selected ? `0 0 0 1px ${COLOR}, 0 16px 40px rgba(245,158,11,.18)` : undefined,
        overflow: 'hidden',
        transition: 'border-color .2s, box-shadow .2s',
      }}
    >
      {/* 只有右侧输出 handle */}
      <Handle type="source" position={Position.Right} style={{ background: COLOR, border: 0, zIndex: 10 }} />

      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
        background: 'linear-gradient(135deg, rgba(245,158,11,.12), transparent)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(245,158,11,.2)', color: '#fbbf24', boxShadow: `inset 0 0 0 1px ${COLOR}`,
        }}>
          <Crown size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: textColor, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {APP_NAME}
          </div>
          <div style={{ fontSize: 10, color: mutedColor, lineHeight: 1.3 }}>
            {modelName ? '已选择模型' : '请选择模型'}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ padding: '10px 12px' }}>
        {/* 模型预览区 */}
        {modelName ? (
          <div style={{ marginBottom: 8 }}>
            {/* 缩略图 */}
            {thumbnailUrl && (
              <div style={{
                width: '100%', height: 120, borderRadius: 8, overflow: 'hidden',
                marginBottom: 8, background: isDark ? '#1a1a1f' : '#f0f0f0',
                border: `1px solid ${inputBorder}`,
              }}>
                <img
                  src={thumbnailUrl}
                  alt={modelDisplayName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            {/* 模型名称 */}
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              background: isDark ? 'rgba(245,158,11,.08)' : 'rgba(245,158,11,.06)',
              border: `1px solid ${isDark ? 'rgba(245,158,11,.2)' : 'rgba(245,158,11,.15)'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24', marginBottom: 2 }}>
                {modelDisplayName || modelName}
              </div>
              {modelDisplayName !== modelName && (
                <div style={{ fontSize: 10, color: mutedColor, wordBreak: 'break-all' }}>
                  {modelName}
                </div>
              )}
            </div>

            {/* 清除按钮 */}
            <button
              onClick={handleClearModel}
              style={{
                width: '100%', height: 28, marginTop: 6, borderRadius: 6,
                border: `1px solid ${inputBorder}`, background: 'transparent',
                color: mutedColor, fontSize: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <X size={12} /> 清除选择
            </button>
          </div>
        ) : (
          /* 未选择状态 */
          <button
            onClick={() => setModelPickerOpen(true)}
            style={{
              width: '100%', height: 80, borderRadius: 8,
              border: `2px dashed ${inputBorder}`,
              background: inputBg, color: mutedColor, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <ChevronDown size={20} />
            <span style={{ fontSize: 11 }}>点击选择模型</span>
          </button>
        )}

        {/* 选择/更换模型按钮 */}
        {modelName && (
          <button
            onClick={() => setModelPickerOpen(true)}
            style={{
              width: '100%', height: 32, borderRadius: 8, border: 'none',
              background: `linear-gradient(135deg, ${COLOR}, #fbbf24)`,
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxShadow: '0 2px 8px rgba(245,158,11,.3)',
            }}
          >
            <ChevronDown size={14} /> 更换模型
          </button>
        )}
      </div>

      {/* 模型选择弹窗 */}
      <GuomanModelPickerModal
        open={modelPickerOpen}
        onClose={() => setModelPickerOpen(false)}
        onSelect={(name) => handleModelSelect(name)}
        currentModel={modelName}
      />
    </div>
  );
};

export default memo(GuomanModelSelectorNode);
