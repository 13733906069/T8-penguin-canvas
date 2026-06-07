import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Palette } from 'lucide-react';

/**
 * GuomanCharNode1 - 国漫角色节点 1（占位）
 * 待用户确认具体功能后实现
 */
const COLOR = '#f97316';

const GuomanCharNode1 = (p: NodeProps) => {
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
        boxShadow: p.selected ? `0 0 0 1px ${COLOR}, 0 16px 32px rgba(249,115,22,.2)` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: COLOR, border: 0 }} />
      <Handle type="source" position={Position.Right} style={{ background: COLOR, border: 0 }} />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: 'rgba(249,115,22,.2)', color: '#fb923c', boxShadow: `inset 0 0 0 1px ${COLOR}` }}
        >
          <Palette size={13} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">国漫角色 1</div>
          <div className="text-[10px] text-white/40">待配置</div>
        </div>
      </div>

      <div className="px-3 py-3 text-[11px] text-white/50 text-center">
        功能待定义
      </div>
    </div>
  );
};

export default memo(GuomanCharNode1);
