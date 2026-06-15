import { useEffect, useState } from 'react';
import type { MediaKind } from '../utils/mediaCollection';
import {
  formatMediaMetadataSummary,
  type MediaMetadata,
} from '../utils/mediaMetadata';

type SupportedKind = Extract<MediaKind, 'image' | 'video' | 'audio'>;

const metadataCache = new Map<string, MediaMetadata>();

function cacheKey(kind: SupportedKind, url: string) {
  return `${kind}:${url}`;
}

function remember(kind: SupportedKind, url: string, metadata: MediaMetadata) {
  metadataCache.set(cacheKey(kind, url), metadata);
  return metadata;
}

export default function MediaMetadataBadge({
  kind,
  url,
  className = '',
}: {
  kind: SupportedKind;
  url: string;
  className?: string;
}) {
  const [metadata, setMetadata] = useState<MediaMetadata | null>(() => metadataCache.get(cacheKey(kind, url)) || null);

  useEffect(() => {
    const key = cacheKey(kind, url);
    const cached = metadataCache.get(key);
    if (cached) {
      setMetadata(cached);
      return;
    }
    setMetadata(null);
    let cancelled = false;

    if (kind === 'image') {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setMetadata(remember(kind, url, {
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        }));
      };
      img.src = url;
      return () => {
        cancelled = true;
        img.onload = null;
        img.onerror = null;
      };
    }

    const media = document.createElement(kind);
    media.preload = 'metadata';
    media.onloadedmetadata = () => {
      if (cancelled) return;
      setMetadata(remember(kind, url, {
        width: kind === 'video' ? (media as HTMLVideoElement).videoWidth : undefined,
        height: kind === 'video' ? (media as HTMLVideoElement).videoHeight : undefined,
        duration: media.duration,
      }));
    };
    media.src = url;
    media.load();
    return () => {
      cancelled = true;
      media.onloadedmetadata = null;
      media.onerror = null;
      media.removeAttribute('src');
      media.load();
    };
  }, [kind, url]);

  const label = formatMediaMetadataSummary(kind, metadata);
  if (!label) return null;
  return (
    <span
      className={`shrink-0 whitespace-nowrap tabular-nums opacity-75 ${className}`}
      title={label}
    >
      {label}
    </span>
  );
}
