import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Wand2 } from 'lucide-react';

/**
 * GuomanCharNode2 - 国漫角色节点 2（占位）
 * 待用户确认具体功能后实现
 */
const COLOR = '#8b5cf6';

const GuomanCharNode2 = (p: NodeProps) => {
  const d = p.data as any;

  return (
    <div
      className={`relative rounded-xl border-2 transition-all ${
        p.selected ? 'shadow-2xl' : 'border-white/15 hover:border-white/30'
      }`}
      style={{
        background: 'rgba(20,20,22,.92)',
        backdropFilter: 'blur(8px)',
        width: 240,
        borderColor: p.selected ? COLOR : undefined,
        boxShadow: p.selected ? `0 0 0 1px ${COLOR}, 0 16px 32px rgba(139,92,246,.2)` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: COLOR, border: 0 }} />
      <Handle type="source" position={Position.Right} style={{ background: COLOR, border: 0 }} />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(139,92,246,.2)', color: '#a78bfa', boxShadow: `inset 0 0 0 1px ${COLOR}` }}
        >
          <Wand2 size={13} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">国漫角色 2</div>
          <div className="text-[10px] text-white/40">待配置</div>
        </div>
      </div>

      <div className="px-3 py-3 text-[11px] text-white/50 text-center">
        功能待定义
      </div>
    </div>
  );
};

export default memo(GuomanCharNode2);
