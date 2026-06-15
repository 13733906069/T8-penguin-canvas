import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Loader2, Maximize2, Scissors, Sparkles } from 'lucide-react';
import {
  runRhImageCapabilityBatch,
  type RunRhImageCapabilityBatchResult,
} from '../services/rhToolboxCapabilities';
import {
  RH_IMAGE_CAPABILITY_PRESETS,
  resolveRhImageCapabilityPreset,
  type RhImageCapabilityPreset,
  type RhImageCapabilityPresetId,
} from '../utils/rhToolboxCapabilities';

interface RhImageCapabilityButtonProps {
  sourceUrl?: string;
  sourceUrls?: string[];
  accent: string;
  isDark: boolean;
  isPixel?: boolean;
  preset?: RhImageCapabilityPresetId | RhImageCapabilityPreset | string;
  capability?: string;
  preferredToolId?: string;
  label?: string;
  title?: string;
  retryCount?: number;
  retryDelayMs?: number;
  continueOnError?: boolean;
  onComplete: (result: RunRhImageCapabilityBatchResult) => void;
  onError?: (message: string) => void;
  style?: CSSProperties;
}

const BUTTON_HEIGHT = 26;

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error || 'RH 工具箱处理失败');
};

export default function RhImageCapabilityButton({
  sourceUrl,
  sourceUrls,
  accent,
  isDark,
  isPixel = false,
  preset = 'cutout',
  capability: capabilityOverride,
  preferredToolId,
  label,
  title,
  retryCount = 2,
  retryDelayMs = 1200,
  continueOnError = true,
  onComplete,
  onError,
  style,
}: RhImageCapabilityButtonProps) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const cleanSourceUrls = useMemo(() => {
    const seen = new Set<string>();
    const urls = [...(sourceUrls || []), sourceUrl].filter(Boolean) as string[];
    return urls
      .map((url) => url.trim())
      .filter((url) => {
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      });
  }, [sourceUrl, sourceUrls]);
  const resolvedPreset = useMemo(() => resolveRhImageCapabilityPreset(preset), [preset]);
  const capability = capabilityOverride || resolvedPreset.capability || RH_IMAGE_CAPABILITY_PRESETS.cutout.capability;
  const resolvedPreferredToolId = preferredToolId || resolvedPreset.preferredToolId;
  const buttonLabel = label || resolvedPreset.label || RH_IMAGE_CAPABILITY_PRESETS.cutout.label;
  const idleTitle = title || resolvedPreset.title || `调用 RH工具箱 ${buttonLabel}，并把结果输出为新素材节点`;
  const iconName = resolvedPreset.icon;
  const IdleIcon = iconName === 'sparkles' ? Sparkles : iconName === 'expand' ? Maximize2 : Scissors;

  useEffect(() => () => abortRef.current?.abort(), []);

  const runCapability = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (running) {
      abortRef.current?.abort();
      setMessage('正在取消');
      return;
    }
    if (cleanSourceUrls.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError('');
    setMessage(cleanSourceUrls.length > 1 ? `准备批量${buttonLabel} 1/${cleanSourceUrls.length}` : `提交 RH ${buttonLabel}`);
    try {
      const result = await runRhImageCapabilityBatch({
        capability,
        preferredToolId: resolvedPreferredToolId,
        imageUrls: cleanSourceUrls,
        signal: controller.signal,
        retryCount,
        retryDelayMs,
        continueOnError,
        onProgress: (progress) => setMessage(progress.message),
        onItemProgress: ({ index, total, attempt, maxAttempts, status, error: itemError }) => {
          const retryText = maxAttempts > 1 ? ` · 第 ${attempt}/${maxAttempts} 次` : '';
          if (status === 'retry') {
            setMessage(`第 ${index + 1}/${total} 张重试中${retryText}`);
          } else if (status === 'error') {
            setMessage(`第 ${index + 1}/${total} 张失败：${itemError || '未知错误'}`);
          } else if (status === 'success') {
            setMessage(`第 ${index + 1}/${total} 张完成`);
          } else {
            setMessage(`准备第 ${index + 1}/${total} 张${retryText}`);
          }
        },
      });
      onComplete(result);
      if (result.cancelled) {
        setMessage(`已取消，保留 ${result.imageUrls.length} 张结果`);
      } else if (result.failedItems.length > 0) {
        const warning = `${result.failedItems.length} 张失败，已输出 ${result.imageUrls.length} 张`;
        setMessage(warning);
        setError(warning);
        onError?.(warning);
      } else {
        setMessage(result.imageUrls.length > 1 ? `已输出 ${result.imageUrls.length} 张` : '已输出');
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setMessage('已取消');
        return;
      }
      const nextError = formatError(err);
      setError(nextError);
      onError?.(nextError);
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  return (
    <button
      type="button"
      className="nodrag nopan"
      data-rh-capability={capability}
      data-rh-running={running ? 'true' : 'false'}
      onClick={runCapability}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={cleanSourceUrls.length === 0}
      title={error || message || (running ? 'RH 工具箱处理中，点击取消' : idleTitle)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        height: BUTTON_HEIGHT,
        background: isDark ? 'rgba(28,28,32,0.92)' : 'rgba(255,255,255,0.95)',
        color: accent,
        border: `1px solid ${accent}66`,
        borderRadius: isPixel ? 0 : 6,
        boxShadow: isPixel
          ? `2px 2px 0 ${accent}`
          : isDark
            ? '0 6px 24px rgba(0,0,0,0.4)'
            : '0 6px 24px rgba(0,0,0,0.12)',
        cursor: cleanSourceUrls.length === 0 ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 600,
        opacity: cleanSourceUrls.length === 0 ? 0.56 : running ? 0.82 : 1,
        ...style,
      }}
    >
      {running ? <Loader2 size={12} className="animate-spin" /> : <IdleIcon size={12} />}
      <span>{running ? '取消' : buttonLabel}</span>
    </button>
  );
}
