import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVideoEditTimelineControllerCommand,
  applyVideoEditTimelineControllerToTimeline,
  applyVideoEditTimelineInteractionCommand,
  buildVideoEditTimelineRenderPlan,
  createVideoEditTimelineControllerState,
  createVideoEditTimelineFromClips,
  detectVideoEditTimelineConflicts,
  insertVideoEditTimelineRange,
  keepVideoEditTimelineTimeInView,
  moveVideoEditTimelineItem,
  normalizeVideoEditAudioFade,
  normalizeVideoEditAudioVolumeCurve,
  normalizeVideoEditTimeline,
  normalizeVideoEditTimelineControllerState,
  overwriteVideoEditTimelineRange,
  resolveVideoEditTimelineSnap,
  resolveVideoEditTimelinePlayback,
  resizeVideoEditTimelineItem,
  snapVideoEditTimelineTime,
  splitVideoEditTimelineItem,
  syncVideoEditTimelineWithClips,
  timelineItemDuration,
  videoEditAudioEnvelopeMultiplier,
  videoEditTimelineTimeFromPlaybackSourceTime,
  videoEditTimelineTimeToX,
  videoEditTimelineXToTime,
  videoEditTimelineDuration,
  type VideoEditTimelineV2,
} from '../src/utils/videoTimeline.ts';

const clips = [
  {
    id: 'clip-a',
    assetId: 'asset-a',
    name: 'a.mp4',
    url: '/a.mp4',
    duration: 10,
    width: 1920,
    height: 1080,
    hasAudio: true,
    trimStart: 2,
    trimEnd: 8,
    muted: false,
  },
  {
    id: 'clip-b',
    assetId: 'asset-b',
    name: 'b.mp4',
    url: '/b.mp4',
    duration: 5,
    width: 1280,
    height: 720,
    hasAudio: false,
    trimStart: 0,
    trimEnd: 5,
    muted: true,
  },
];

test('creates a timeline v2 with reusable assets, video track items, and linked audio items', () => {
  const timeline = createVideoEditTimelineFromClips(clips);

  assert.equal(timeline.version, 2);
  assert.equal(timeline.assets.length, 2);
  assert.equal(timeline.tracks.filter((track) => track.kind === 'video').length, 1);
  assert.equal(timeline.tracks.filter((track) => track.kind === 'audio').length, 1);
  assert.equal(timeline.items.filter((item) => item.kind === 'video').length, 2);
  assert.equal(timeline.items.filter((item) => item.kind === 'audio').length, 1);

  const firstVideo = timeline.items.find((item) => item.id === 'item-clip-a-video');
  const firstAudio = timeline.items.find((item) => item.id === 'item-clip-a-audio');
  const secondVideo = timeline.items.find((item) => item.id === 'item-clip-b-video');

  assert.ok(firstVideo);
  assert.ok(firstAudio);
  assert.ok(secondVideo);
  assert.equal(firstVideo.timelineStart, 0);
  assert.equal(firstVideo.sourceIn, 2);
  assert.equal(firstVideo.sourceOut, 8);
  assert.equal(timelineItemDuration(firstVideo), 6);
  assert.equal(firstAudio.linkedItemId, firstVideo.id);
  assert.equal(secondVideo.timelineStart, 6);
  assert.equal(videoEditTimelineDuration(timeline), 11);
});

test('moves, resizes, splits, snaps, and detects same-track conflicts', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const moved = moveVideoEditTimelineItem(timeline, 'item-clip-b-video', { timelineStart: 5.95 }, { snapThreshold: 0.1 });
  assert.equal(moved.items.find((item) => item.id === 'item-clip-b-video')?.timelineStart, 6);

  const resized = resizeVideoEditTimelineItem(moved, 'item-clip-a-video', 'end', 4.5);
  const resizedA = resized.items.find((item) => item.id === 'item-clip-a-video');
  const resizedAudioA = resized.items.find((item) => item.id === 'item-clip-a-audio');
  assert.ok(resizedA);
  assert.ok(resizedAudioA);
  assert.equal(resizedA.sourceOut, 4.5);
  assert.equal(resizedAudioA.sourceOut, 4.5);
  assert.equal(timelineItemDuration(resizedA), 2.5);
  assert.equal(resized.items.find((item) => item.id === 'item-clip-b-video')?.timelineStart, 2.5);

  const split = splitVideoEditTimelineItem(resized, 'item-clip-b-video', 4.5);
  const splitParts = split.items
    .filter((item) => item.id === 'item-clip-b-video' || item.id === 'item-clip-b-video-split')
    .sort((a, b) => a.timelineStart - b.timelineStart);
  assert.equal(splitParts.length, 2);
  assert.equal(timelineItemDuration(splitParts[0]), 2);
  assert.equal(splitParts[1].timelineStart, 4.5);

  assert.equal(snapVideoEditTimelineTime(5.98, [0, 3, 6, 11], 0.05), 6);
  assert.equal(snapVideoEditTimelineTime(5.9, [0, 3, 6, 11], 0.05), 5.9);

  const snapDetail = resolveVideoEditTimelineSnap(timeline, 5.95, {
    threshold: 0.1,
    excludedItemIds: ['item-clip-b-video'],
  });
  assert.equal(snapDetail.snapped, true);
  assert.equal(snapDetail.time, 6);
  assert.equal(snapDetail.kind, 'item-end');
  assert.equal(snapDetail.sourceItemId, 'item-clip-a-video');
  assert.match(snapDetail.label, /片段终点/);

  const conflictTimeline: VideoEditTimelineV2 = {
    ...timeline,
    items: [
      ...timeline.items,
      {
        id: 'overlap',
        assetId: 'asset-a',
        trackId: 'track-video-main',
        kind: 'video',
        timelineStart: 1,
        sourceIn: 0,
        sourceOut: 3,
      },
    ],
  };

  const conflicts = detectVideoEditTimelineConflicts(conflictTimeline);
  assert.equal(conflicts.some((conflict) => conflict.kind === 'overlap' && conflict.trackId === 'track-video-main'), true);
});

test('splits linked video and audio items as one professional timeline edit', () => {
  const timeline = createVideoEditTimelineFromClips([clips[0]]);
  const split = splitVideoEditTimelineItem(timeline, 'item-clip-a-video', 3);

  const leftVideo = split.items.find((item) => item.id === 'item-clip-a-video');
  const rightVideo = split.items.find((item) => item.id === 'item-clip-a-video-split');
  const leftAudio = split.items.find((item) => item.id === 'item-clip-a-audio');
  const rightAudio = split.items.find((item) => item.id === 'item-clip-a-audio-split');

  assert.ok(leftVideo);
  assert.ok(rightVideo);
  assert.ok(leftAudio);
  assert.ok(rightAudio);

  assert.equal(leftVideo.timelineStart, 0);
  assert.equal(leftVideo.sourceIn, 2);
  assert.equal(leftVideo.sourceOut, 5);
  assert.equal(rightVideo.timelineStart, 3);
  assert.equal(rightVideo.sourceIn, 5);
  assert.equal(rightVideo.sourceOut, 8);

  assert.equal(leftAudio.timelineStart, 0);
  assert.equal(leftAudio.sourceIn, 2);
  assert.equal(leftAudio.sourceOut, 5);
  assert.equal(rightAudio.timelineStart, 3);
  assert.equal(rightAudio.sourceIn, 5);
  assert.equal(rightAudio.sourceOut, 8);

  assert.equal(leftVideo.linkedItemId, leftAudio.id);
  assert.equal(leftAudio.linkedItemId, leftVideo.id);
  assert.equal(rightVideo.linkedItemId, rightAudio.id);
  assert.equal(rightAudio.linkedItemId, rightVideo.id);
  assert.deepEqual(new Set(split.selectedItemIds), new Set([rightVideo.id, rightAudio.id]));
});

test('inserts a timeline range by splitting crossing clips and rippling later linked items', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const inserted = insertVideoEditTimelineRange(timeline, 3, 2, { stamp: 'range-insert' });

  const leftVideo = inserted.items.find((item) => item.id === 'item-clip-a-video');
  const rightVideo = inserted.items.find((item) => item.id === 'item-clip-a-video-range-insert');
  const leftAudio = inserted.items.find((item) => item.id === 'item-clip-a-audio');
  const rightAudio = inserted.items.find((item) => item.id === 'item-clip-a-audio-range-insert');
  const secondVideo = inserted.items.find((item) => item.id === 'item-clip-b-video');

  assert.ok(leftVideo);
  assert.ok(rightVideo);
  assert.ok(leftAudio);
  assert.ok(rightAudio);
  assert.ok(secondVideo);

  assert.equal(leftVideo.timelineStart, 0);
  assert.equal(leftVideo.sourceIn, 2);
  assert.equal(leftVideo.sourceOut, 5);
  assert.equal(rightVideo.timelineStart, 5);
  assert.equal(rightVideo.sourceIn, 5);
  assert.equal(rightVideo.sourceOut, 8);
  assert.equal(secondVideo.timelineStart, 8);

  assert.equal(leftVideo.linkedItemId, leftAudio.id);
  assert.equal(leftAudio.linkedItemId, leftVideo.id);
  assert.equal(rightVideo.linkedItemId, rightAudio.id);
  assert.equal(rightAudio.linkedItemId, rightVideo.id);
});

test('overwrites a timeline range without deleting full crossing clips', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const overwritten = overwriteVideoEditTimelineRange(timeline, 3, 2, {
    stamp: 'range-overwrite',
    targetTrackIds: ['track-video-main', 'track-audio-main'],
  });

  const leftVideo = overwritten.items.find((item) => item.id === 'item-clip-a-video');
  const rightVideo = overwritten.items.find((item) => item.id === 'item-clip-a-video-range-overwrite');
  const leftAudio = overwritten.items.find((item) => item.id === 'item-clip-a-audio');
  const rightAudio = overwritten.items.find((item) => item.id === 'item-clip-a-audio-range-overwrite');
  const secondVideo = overwritten.items.find((item) => item.id === 'item-clip-b-video');

  assert.ok(leftVideo);
  assert.ok(rightVideo);
  assert.ok(leftAudio);
  assert.ok(rightAudio);
  assert.ok(secondVideo);

  assert.equal(leftVideo.timelineStart, 0);
  assert.equal(leftVideo.sourceIn, 2);
  assert.equal(leftVideo.sourceOut, 5);
  assert.equal(rightVideo.timelineStart, 5);
  assert.equal(rightVideo.sourceIn, 7);
  assert.equal(rightVideo.sourceOut, 8);
  assert.equal(secondVideo.timelineStart, 6);

  assert.equal(leftVideo.linkedItemId, leftAudio.id);
  assert.equal(leftAudio.linkedItemId, leftVideo.id);
  assert.equal(rightVideo.linkedItemId, rightAudio.id);
  assert.equal(rightAudio.linkedItemId, rightVideo.id);
});

test('builds compose render plan from timeline order instead of stale clip order', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const reordered: VideoEditTimelineV2 = {
    ...timeline,
    tracks: timeline.tracks.map((track) => track.kind === 'audio' ? { ...track, muted: true } : track),
    items: timeline.items.map((item) => {
      if (item.id === 'item-clip-a-video' || item.id === 'item-clip-a-audio') {
        return { ...item, timelineStart: 5 };
      }
      if (item.id === 'item-clip-b-video') {
        return { ...item, timelineStart: 0, muted: false };
      }
      return item;
    }),
  };

  const plan = buildVideoEditTimelineRenderPlan(reordered);

  assert.equal(plan.version, 1);
  assert.equal(plan.duration, 11);
  assert.deepEqual(plan.clips.map((clip) => clip.name), ['b.mp4', 'a.mp4']);
  assert.equal(plan.clips[0].trimStart, 0);
  assert.equal(plan.clips[0].trimEnd, 5);
  assert.equal(plan.clips[0].sourceItemId, 'item-clip-b-video');
  assert.equal(plan.clips[1].trimStart, 2);
  assert.equal(plan.clips[1].trimEnd, 8);
  assert.equal(plan.clips[1].muted, true);
  assert.equal(plan.clips[1].hasAudio, true);
});

test('builds render plan tracks and audio lanes for future multitrack export', () => {
  const timeline = createVideoEditTimelineFromClips([
    { id: 'a', name: 'A.mp4', url: 'a.mp4', duration: 10, hasAudio: true },
  ]);

  timeline.tracks = timeline.tracks.map((track) => (
    track.kind === 'audio' ? { ...track, order: 2 } : track
  ));
  timeline.tracks.push(
    { id: 'track-video-overlay', kind: 'video', name: '叠加视频', order: 1 },
    { id: 'track-audio-music', kind: 'audio', name: '配乐', order: 3, muted: true },
  );
  timeline.assets.push({ id: 'asset-b', kind: 'video', name: 'B.mp4', url: 'b.mp4', duration: 5, hasAudio: false });
  timeline.assets.push({ id: 'asset-music', kind: 'audio', name: 'Music.mp3', url: 'music.mp3', duration: 12 });
  timeline.items.push({
    id: 'item-b-video',
    assetId: 'asset-b',
    trackId: 'track-video-overlay',
    kind: 'video',
    timelineStart: 1,
    sourceIn: 0,
    sourceOut: 4,
  });
  timeline.items.push({
    id: 'item-music-audio',
    assetId: 'asset-music',
    trackId: 'track-audio-music',
    kind: 'audio',
    timelineStart: 0,
    sourceIn: 2,
    sourceOut: 9,
    volume: 0.4,
  });

  const plan = buildVideoEditTimelineRenderPlan(timeline);

  assert.deepEqual(plan.tracks.map((track) => `${track.kind}:${track.id}:${track.order}`), [
    'video:track-video-main:0',
    'video:track-video-overlay:1',
    'audio:track-audio-main:2',
    'audio:track-audio-music:3',
  ]);
  assert.equal(plan.clips.find((clip) => clip.sourceItemId === 'item-b-video')?.trackOrder, 1);
  assert.equal(plan.clips.find((clip) => clip.sourceItemId === 'item-b-video')?.layerIndex, 1);
  assert.deepEqual(plan.audio.map((audio) => ({
    id: audio.sourceItemId,
    start: audio.timelineStart,
    trim: [audio.trimStart, audio.trimEnd],
    muted: audio.muted,
    volume: audio.volume,
  })), [
    { id: 'item-a-audio', start: 0, trim: [0, 10], muted: false, volume: 1 },
    { id: 'item-music-audio', start: 0, trim: [2, 9], muted: true, volume: 0.4 },
  ]);
  assert.equal(plan.capabilities.timelineLayerCompose, true);
  assert.equal(plan.capabilities.timelineLayerCount, 2);
  assert.equal(plan.capabilities.timelineAudioMix, true);
  assert.equal(plan.capabilities.subtitleBurnIn, false);
  assert.deepEqual(plan.unsupported, []);
});

test('audio fades and volume curves survive normalization, render plan, and preview math', () => {
  const timeline = createVideoEditTimelineFromClips([
    { id: 'a', name: 'A.mp4', url: 'a.mp4', duration: 10, hasAudio: true },
  ]);
  const normalized = normalizeVideoEditTimeline({
    ...timeline,
    items: timeline.items.map((item) => {
      if (item.kind === 'audio') {
        return {
          ...item,
          audioFadeIn: 1.25,
          audioFadeOut: 2.5,
          volumeCurve: 'linear-up',
        };
      }
      return {
        ...item,
        audioFadeIn: 0.5,
        audioFadeOut: 0.75,
        volumeCurve: 'duck',
      };
    }),
  }, clips);

  const audioItem = normalized.items.find((item) => item.kind === 'audio');
  const videoItem = normalized.items.find((item) => item.kind === 'video');
  assert.ok(audioItem);
  assert.ok(videoItem);
  assert.equal(audioItem.audioFadeIn, 1.25);
  assert.equal(audioItem.audioFadeOut, 2.5);
  assert.equal(audioItem.volumeCurve, 'linear-up');
  assert.equal(videoItem.audioFadeIn, 0.5);
  assert.equal(videoItem.audioFadeOut, 0.75);
  assert.equal(videoItem.volumeCurve, 'duck');

  const plan = buildVideoEditTimelineRenderPlan(normalized);
  const audio = plan.audio.find((segment) => segment.sourceItemId === audioItem.id);
  const clip = plan.clips.find((segment) => segment.sourceItemId === videoItem.id);
  assert.ok(audio);
  assert.ok(clip);
  assert.equal(audio.audioFadeIn, 1.25);
  assert.equal(audio.audioFadeOut, 2.5);
  assert.equal(audio.volumeCurve, 'linear-up');
  assert.equal(clip.audioFadeIn, 0.5);
  assert.equal(clip.audioFadeOut, 0.75);
  assert.equal(clip.volumeCurve, 'duck');

  assert.equal(normalizeVideoEditAudioVolumeCurve('not-a-curve'), 'flat');
  assert.equal(normalizeVideoEditAudioFade(99, 6), 6);
  assert.equal(normalizeVideoEditAudioFade(-1, 6), 0);
  assert.equal(videoEditAudioEnvelopeMultiplier({
    timelineStart: 1,
    timelineEnd: 5,
    audioFadeIn: 1,
    audioFadeOut: 1,
    volumeCurve: 'linear-up',
  }, 1), 0);
  assert.ok(videoEditAudioEnvelopeMultiplier({
    timelineStart: 1,
    timelineEnd: 5,
    audioFadeIn: 1,
    audioFadeOut: 1,
    volumeCurve: 'linear-up',
  }, 3) > 0.4);
  assert.equal(videoEditAudioEnvelopeMultiplier({
    timelineStart: 0,
    timelineEnd: 4,
    volumeCurve: 'duck',
  }, 2), 0.55);
});

test('render plan honors solo tracks before export', () => {
  const timeline = createVideoEditTimelineFromClips([
    { id: 'a', name: 'A.mp4', url: 'a.mp4', duration: 10, hasAudio: true },
  ]);

  timeline.tracks.push(
    { id: 'track-video-overlay', kind: 'video', name: '叠加视频', order: 1, solo: true },
    { id: 'track-audio-music', kind: 'audio', name: '配乐', order: 3, solo: true },
    { id: 'track-text-subtitle', kind: 'text', name: '字幕轨', order: 4, solo: true },
  );
  timeline.assets.push({ id: 'asset-b', kind: 'video', name: 'B.mp4', url: 'b.mp4', duration: 5, hasAudio: false });
  timeline.assets.push({ id: 'asset-music', kind: 'audio', name: 'Music.mp3', url: 'music.mp3', duration: 12 });
  timeline.assets.push({ id: 'asset-subtitle', kind: 'text', name: '字幕', url: '', text: '只导出独奏轨' });
  timeline.items.push({
    id: 'item-b-video',
    assetId: 'asset-b',
    trackId: 'track-video-overlay',
    kind: 'video',
    timelineStart: 0,
    sourceIn: 0,
    sourceOut: 5,
  });
  timeline.items.push({
    id: 'item-music-audio',
    assetId: 'asset-music',
    trackId: 'track-audio-music',
    kind: 'audio',
    timelineStart: 0,
    sourceIn: 0,
    sourceOut: 5,
  });
  timeline.items.push({
    id: 'item-subtitle',
    assetId: 'asset-subtitle',
    trackId: 'track-text-subtitle',
    kind: 'text',
    timelineStart: 0,
    sourceIn: 0,
    sourceOut: 5,
  });

  const plan = buildVideoEditTimelineRenderPlan(timeline);

  assert.equal(plan.tracks.find((track) => track.id === 'track-video-overlay')?.solo, true);
  assert.deepEqual(plan.clips.map((clip) => clip.sourceItemId), ['item-b-video']);
  assert.deepEqual(plan.audio.map((audio) => audio.sourceItemId), ['item-music-audio']);
  assert.deepEqual(plan.text.map((text) => text.sourceItemId), ['item-subtitle']);
  assert.equal(plan.duration, 5);
  assert.equal(plan.capabilities.timelineGaps, false);
});

test('render plan duration ignores hidden timeline tracks', () => {
  const timeline = createVideoEditTimelineFromClips([
    { id: 'a', name: 'A.mp4', url: 'a.mp4', duration: 10, hasAudio: true },
  ]);

  timeline.tracks.push(
    { id: 'track-video-hidden', kind: 'video', name: '隐藏叠加', order: 1, hidden: true },
    { id: 'track-audio-hidden', kind: 'audio', name: '隐藏音频', order: 3, hidden: true },
    { id: 'track-text-hidden', kind: 'text', name: '隐藏字幕', order: 4, hidden: true },
  );
  timeline.assets.push({ id: 'asset-hidden-video', kind: 'video', name: 'Hidden.mp4', url: 'hidden.mp4', duration: 30, hasAudio: false });
  timeline.assets.push({ id: 'asset-hidden-audio', kind: 'audio', name: 'Hidden.mp3', url: 'hidden.mp3', duration: 30 });
  timeline.assets.push({ id: 'asset-hidden-text', kind: 'text', name: '隐藏字幕', url: '', text: '不应导出' });
  timeline.items.push({
    id: 'item-hidden-video',
    assetId: 'asset-hidden-video',
    trackId: 'track-video-hidden',
    kind: 'video',
    timelineStart: 0,
    sourceIn: 0,
    sourceOut: 30,
  });
  timeline.items.push({
    id: 'item-hidden-audio',
    assetId: 'asset-hidden-audio',
    trackId: 'track-audio-hidden',
    kind: 'audio',
    timelineStart: 0,
    sourceIn: 0,
    sourceOut: 30,
  });
  timeline.items.push({
    id: 'item-hidden-text',
    assetId: 'asset-hidden-text',
    trackId: 'track-text-hidden',
    kind: 'text',
    timelineStart: 0,
    sourceIn: 0,
    sourceOut: 30,
  });

  const plan = buildVideoEditTimelineRenderPlan(timeline);

  assert.equal(plan.duration, 10);
  assert.deepEqual(plan.clips.map((clip) => clip.sourceItemId), ['item-a-video']);
  assert.deepEqual(plan.audio.map((audio) => audio.sourceItemId), ['item-a-audio']);
  assert.deepEqual(plan.text, []);
  assert.equal(plan.capabilities.timelineGaps, false);
});

test('render plan exports pip transform fields but still blocks future timeline effects', () => {
  const timeline = createVideoEditTimelineFromClips([
    { id: 'a', name: 'A.mp4', url: 'a.mp4', duration: 8, hasAudio: true },
  ]);

  const videoItem = timeline.items.find((item) => item.kind === 'video');
  assert.ok(videoItem);
  Object.assign(videoItem as any, {
    x: 72,
    y: 24,
    scale: 0.72,
    opacity: 0.8,
    speed: 1.5,
    keyframes: [{ at: 0, x: 0 }, { at: 2, x: 80 }],
  });

  const plan = buildVideoEditTimelineRenderPlan(timeline);

  assert.equal(plan.clips[0].x, 72);
  assert.equal(plan.clips[0].y, 24);
  assert.equal(plan.clips[0].scale, 0.72);
  assert.equal(plan.clips[0].opacity, 0.8);
  assert.equal(plan.capabilities.timelineLayerCompose, true);
  assert.deepEqual(plan.unsupported, [
    '变速',
    '关键帧动画',
  ]);
});

test('normalizes timeline items without dropping pip transform fields', () => {
  const timeline = createVideoEditTimelineFromClips([
    { id: 'a', name: 'A.mp4', url: 'a.mp4', duration: 8, hasAudio: true },
  ]);
  const videoItem = timeline.items.find((item) => item.kind === 'video');
  assert.ok(videoItem);

  const normalized = normalizeVideoEditTimeline({
    ...timeline,
    items: timeline.items.map((item) => (
      item.id === videoItem.id
        ? {
          ...item,
          x: 68.48,
          y: 31.52,
          scale: 0.42,
          opacity: 0.73,
        }
        : item
    )),
  }, clips);
  const normalizedItem = normalized.items.find((item) => item.id === videoItem.id);
  assert.ok(normalizedItem);
  assert.equal(normalizedItem.x, 68.48);
  assert.equal(normalizedItem.y, 31.52);
  assert.equal(normalizedItem.scale, 0.42);
  assert.equal(normalizedItem.opacity, 0.73);
});

test('builds render plan text lanes for subtitle burn-in export', () => {
  const timeline = createVideoEditTimelineFromClips([
    { id: 'a', name: 'A.mp4', url: 'a.mp4', duration: 8, hasAudio: true },
  ]);

  timeline.tracks.push({ id: 'track-text-subtitle', kind: 'text', name: '字幕轨', order: 2 });
  timeline.assets.push({
    id: 'asset-subtitle-1',
    kind: 'text',
    name: '字幕 1',
    url: '',
    text: '第一句字幕',
    textPosition: 'bottom',
    textColor: '#ffffff',
    textFontSize: 42,
  });
  timeline.items.push({
    id: 'item-subtitle-1',
    assetId: 'asset-subtitle-1',
    trackId: 'track-text-subtitle',
    kind: 'text',
    timelineStart: 1.25,
    sourceIn: 0,
    sourceOut: 3.5,
    label: '第一句字幕',
  });

  const plan = buildVideoEditTimelineRenderPlan(timeline);

  assert.equal(plan.text.length, 1);
  assert.deepEqual(plan.text[0], {
    id: 'render-item-subtitle-1',
    sourceItemId: 'item-subtitle-1',
    assetId: 'asset-subtitle-1',
    trackId: 'track-text-subtitle',
    kind: 'text',
    trackOrder: 2,
    timelineStart: 1.25,
    timelineEnd: 4.75,
    text: '第一句字幕',
    name: '第一句字幕',
    position: 'bottom',
    color: '#ffffff',
    fontSize: 42,
    background: 'rgba(0,0,0,0.45)',
  });
});

test('syncs legacy clips into timeline without flattening custom multitrack items', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  timeline.tracks.push({ id: 'track-video-overlay', kind: 'video', name: '叠加视频', order: 1 });
  timeline.assets.push({
    id: 'asset-overlay',
    kind: 'video',
    name: 'overlay.mp4',
    url: '/overlay.mp4',
    duration: 3,
    width: 640,
    height: 640,
  });
  timeline.items.push({
    id: 'overlay-free-item',
    assetId: 'asset-overlay',
    trackId: 'track-video-overlay',
    kind: 'video',
    timelineStart: 1,
    sourceIn: 0,
    sourceOut: 3,
  });

  const synced = syncVideoEditTimelineWithClips(timeline, [
    {
      ...clips[0],
      duration: 12,
      width: 2048,
      thumbnailUrl: '/updated-thumb.jpg',
    },
  ]);

  assert.equal(synced.tracks.some((track) => track.id === 'track-video-overlay'), true);
  assert.equal(synced.items.some((item) => item.id === 'overlay-free-item'), true);
  assert.equal(synced.items.some((item) => item.id === 'item-clip-b-video'), false);
  assert.equal(synced.items.some((item) => item.id === 'item-clip-b-audio'), false);
  assert.equal(synced.assets.some((asset) => asset.id === 'asset-b'), false);
  const assetA = synced.assets.find((asset) => asset.id === 'asset-a');
  assert.ok(assetA);
  assert.equal(assetA.duration, 12);
  assert.equal(assetA.width, 2048);
  assert.equal(assetA.thumbnailUrl, '/updated-thumb.jpg');
  assert.equal(synced.items.find((item) => item.id === 'item-clip-a-video')?.sourceOut, 8);
});

test('timeline controller keeps playhead, viewport, selection, and drag state pure', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const knownItemIds = timeline.items.map((item) => item.id);
  const options = {
    duration: videoEditTimelineDuration(timeline),
    knownItemIds,
    maxScrollLeft: 120,
    maxScrollTop: 40,
    maxZoom: 4,
  };

  const controller = createVideoEditTimelineControllerState(timeline, {
    playhead: 999,
    zoom: 10,
    scrollLeft: 999,
    scrollTop: -20,
    selectedItemIds: ['item-clip-a-video', 'missing', 'item-clip-a-video'],
    activeTool: 'trim',
  }, options);

  assert.equal(controller.playhead, 11);
  assert.equal(controller.zoom, 4);
  assert.equal(controller.scrollLeft, 120);
  assert.equal(controller.scrollTop, 0);
  assert.deepEqual(controller.selectedItemIds, ['item-clip-a-video']);
  assert.equal(controller.activeTool, 'trim');

  const selected = applyVideoEditTimelineControllerCommand(controller, {
    type: 'select',
    mode: 'add',
    itemIds: ['item-clip-b-video', 'missing'],
  }, options);
  assert.deepEqual(selected.selectedItemIds, ['item-clip-a-video', 'item-clip-b-video']);

  const toggled = applyVideoEditTimelineControllerCommand(selected, {
    type: 'select',
    mode: 'toggle',
    itemIds: ['item-clip-a-video', 'item-clip-a-audio'],
  }, options);
  assert.deepEqual(toggled.selectedItemIds, ['item-clip-b-video', 'item-clip-a-audio']);

  const dragging = applyVideoEditTimelineControllerCommand(toggled, {
    type: 'begin-drag',
    drag: {
      kind: 'trim',
      itemId: 'item-clip-b-video',
      edge: 'end',
      pointerId: 9,
      startedAt: 12,
    },
  }, options);
  assert.equal(dragging.drag?.kind, 'trim');
  assert.equal(dragging.drag?.edge, 'end');

  const movedDrag = applyVideoEditTimelineControllerCommand(dragging, { type: 'update-drag', currentAt: 18 }, options);
  assert.equal(movedDrag.drag?.currentAt, 18);
  assert.equal(applyVideoEditTimelineControllerCommand(movedDrag, { type: 'end-drag' }, options).drag, null);

  const timelineFromController = applyVideoEditTimelineControllerToTimeline(timeline, {
    ...movedDrag,
    playhead: 4.25,
    scrollLeft: 80,
    snapEnabled: false,
  });
  assert.equal(timelineFromController.playhead, 4.25);
  assert.equal(timelineFromController.scrollLeft, 80);
  assert.equal(timelineFromController.snapEnabled, false);
  assert.deepEqual(timelineFromController.selectedItemIds, ['item-clip-b-video', 'item-clip-a-audio']);
});

test('timeline controller ignores invalid tools and malformed drag payloads', () => {
  const normalized = normalizeVideoEditTimelineControllerState({
    playhead: -10,
    zoom: 0,
    activeTool: 'teleport',
    selectedItemIds: ['a', 'a', ''],
    drag: {
      kind: 'unknown',
      startedAt: 1,
    },
  } as any, {
    duration: 8,
    knownItemIds: ['a'],
  });

  assert.equal(normalized.playhead, 0);
  assert.equal(normalized.zoom, 0.25);
  assert.equal(normalized.activeTool, 'select');
  assert.deepEqual(normalized.selectedItemIds, ['a']);
  assert.equal(normalized.drag, null);
});

test('timeline interaction command commits move, trim, split, and seek as one synced state', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const controller = createVideoEditTimelineControllerState(timeline, {
    selectedItemIds: ['item-clip-a-video'],
    drag: {
      kind: 'move',
      itemId: 'item-clip-a-video',
      startedAt: 0,
      currentAt: 1,
    },
  });

  const moved = applyVideoEditTimelineInteractionCommand(timeline, controller, {
    type: 'move-item',
    itemId: 'item-clip-a-video',
    timelineStart: 1.25,
  });

  assert.equal(moved.timeline.items.find((item) => item.id === 'item-clip-a-video')?.timelineStart, 1.25);
  assert.equal(moved.timeline.items.find((item) => item.id === 'item-clip-a-audio')?.timelineStart, 1.25);
  assert.deepEqual(moved.timeline.selectedItemIds, ['item-clip-a-video']);
  assert.deepEqual(moved.controller.selectedItemIds, ['item-clip-a-video']);
  assert.equal(moved.controller.drag, null);

  const trimmed = applyVideoEditTimelineInteractionCommand(timeline, controller, {
    type: 'trim-item',
    itemId: 'item-clip-a-video',
    edge: 'end',
    sourceTime: 4.5,
  });

  assert.equal(trimmed.timeline.items.find((item) => item.id === 'item-clip-a-video')?.sourceOut, 4.5);
  assert.equal(trimmed.timeline.items.find((item) => item.id === 'item-clip-a-audio')?.sourceOut, 4.5);
  assert.equal(trimmed.timeline.items.find((item) => item.id === 'item-clip-b-video')?.timelineStart, 2.5);

  const seeked = applyVideoEditTimelineInteractionCommand(trimmed.timeline, trimmed.controller, {
    type: 'seek',
    time: 4.25,
  });
  assert.equal(seeked.timeline.playhead, 4.25);
  assert.equal(seeked.controller.playhead, 4.25);

  const split = applyVideoEditTimelineInteractionCommand(seeked.timeline, {
    ...seeked.controller,
    selectedItemIds: ['item-clip-b-video'],
  }, {
    type: 'split-item',
  });

  assert.equal(split.timeline.items.some((item) => item.id === 'item-clip-b-video-split'), true);
  assert.deepEqual(split.timeline.selectedItemIds, ['item-clip-b-video-split']);
  assert.deepEqual(split.controller.selectedItemIds, ['item-clip-b-video-split']);
});

test('timeline interaction command keeps locked tracks safe and clears stale controller references', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const locked: VideoEditTimelineV2 = {
    ...timeline,
    tracks: timeline.tracks.map((track) => (
      track.id === 'track-video-main' ? { ...track, locked: true } : track
    )),
  };
  const controller = createVideoEditTimelineControllerState(locked, {
    selectedItemIds: ['item-clip-a-video', 'missing'],
    drag: {
      kind: 'move',
      itemId: 'missing',
      startedAt: 0,
      currentAt: 2,
    },
  }, {
    knownItemIds: [...locked.items.map((item) => item.id), 'missing'],
  });

  const moved = applyVideoEditTimelineInteractionCommand(locked, controller, {
    type: 'move-item',
    itemId: 'item-clip-a-video',
    timelineStart: 4,
  });

  assert.equal(moved.timeline.items.find((item) => item.id === 'item-clip-a-video')?.timelineStart, 0);
  assert.deepEqual(moved.controller.selectedItemIds, ['item-clip-a-video']);
  assert.equal(moved.controller.drag, null);

  const staleKnownIds = applyVideoEditTimelineInteractionCommand(locked, controller, {
    type: 'seek',
    time: 1,
  }, {
    knownItemIds: [...locked.items.map((item) => item.id), 'missing'],
  });
  assert.deepEqual(staleKnownIds.controller.selectedItemIds, ['item-clip-a-video']);
});

test('timeline edit commands keep linked locked audio tracks safe', () => {
  const timeline = createVideoEditTimelineFromClips([clips[0]]);
  const lockedAudio: VideoEditTimelineV2 = {
    ...timeline,
    tracks: timeline.tracks.map((track) => (
      track.id === 'track-audio-main' ? { ...track, locked: true } : track
    )),
  };

  const moved = moveVideoEditTimelineItem(lockedAudio, 'item-clip-a-video', { timelineStart: 4 });
  assert.equal(moved.items.find((item) => item.id === 'item-clip-a-video')?.timelineStart, 0);
  assert.equal(moved.items.find((item) => item.id === 'item-clip-a-audio')?.timelineStart, 0);

  const trimmed = resizeVideoEditTimelineItem(lockedAudio, 'item-clip-a-video', 'end', 4.5);
  assert.equal(trimmed.items.find((item) => item.id === 'item-clip-a-video')?.sourceOut, 8);
  assert.equal(trimmed.items.find((item) => item.id === 'item-clip-a-audio')?.sourceOut, 8);
});

test('timeline move rejects missing or mismatched target tracks before render can lose clips', () => {
  const timeline = createVideoEditTimelineFromClips([clips[0]]);
  const toMissingTrack = moveVideoEditTimelineItem(timeline, 'item-clip-a-video', { trackId: 'missing-track', timelineStart: 4 });
  assert.equal(toMissingTrack.items.find((item) => item.id === 'item-clip-a-video')?.trackId, 'track-video-main');
  assert.equal(toMissingTrack.items.find((item) => item.id === 'item-clip-a-video')?.timelineStart, 0);

  const toAudioTrack = moveVideoEditTimelineItem(timeline, 'item-clip-a-video', { trackId: 'track-audio-main', timelineStart: 4 });
  assert.equal(toAudioTrack.items.find((item) => item.id === 'item-clip-a-video')?.trackId, 'track-video-main');
  assert.equal(toAudioTrack.items.find((item) => item.id === 'item-clip-a-video')?.timelineStart, 0);
});

test('render plan reports missing tracks and assets instead of silently filtering them', () => {
  const timeline = createVideoEditTimelineFromClips([clips[0]]);
  const broken: VideoEditTimelineV2 = {
    ...timeline,
    items: timeline.items.map((item) => {
      if (item.id === 'item-clip-a-video') return { ...item, trackId: 'missing-track' };
      if (item.id === 'item-clip-a-audio') return { ...item, assetId: 'missing-asset' };
      return item;
    }),
  };

  const plan = buildVideoEditTimelineRenderPlan(broken);
  assert.equal(plan.clips.length, 0);
  assert.equal(plan.audio.length, 0);
  assert.equal(plan.warnings.some((warning) => warning.includes('item-clip-a-video')), true);
  assert.equal(plan.warnings.some((warning) => warning.includes('item-clip-a-audio')), true);
});

test('timeline coordinate helpers round-trip time, x position, and keep playhead visible', () => {
  const options = { pixelsPerSecond: 50, zoom: 2, scrollLeft: 20 };
  assert.equal(videoEditTimelineTimeToX(2, options), 180);
  assert.equal(videoEditTimelineXToTime(180, options), 2);

  const timeline = createVideoEditTimelineFromClips(clips);
  const controller = createVideoEditTimelineControllerState(timeline, {
    zoom: 2,
    scrollLeft: 0,
  }, {
    maxScrollLeft: 1000,
  });

  const visible = keepVideoEditTimelineTimeInView(controller, 8, 300, {
    pixelsPerSecond: 50,
    duration: videoEditTimelineDuration(timeline),
    maxScrollLeft: 1000,
  });

  assert.equal(visible.scrollLeft, 520);
  assert.equal(visible.playhead, 8);

  const clamped = keepVideoEditTimelineTimeInView(controller, 100, 300, {
    pixelsPerSecond: 50,
    duration: videoEditTimelineDuration(timeline),
    maxScrollLeft: 1000,
  });
  assert.equal(clamped.playhead, 11);
  assert.equal(clamped.scrollLeft, 820);
});

test('timeline playback resolver follows the playhead and maps back to source time', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const trimmed: VideoEditTimelineV2 = {
    ...timeline,
    playhead: 7.5,
    selectedItemIds: ['item-clip-a-video'],
    items: timeline.items.map((item) => {
      if (item.id === 'item-clip-b-video') {
        return { ...item, timelineStart: 6, sourceIn: 1, sourceOut: 5 };
      }
      return item;
    }),
  };

  const playback = resolveVideoEditTimelinePlayback(trimmed);

  assert.equal(playback.item?.id, 'item-clip-b-video');
  assert.equal(playback.asset?.id, 'asset-b');
  assert.equal(playback.timelineTime, 7.5);
  assert.equal(playback.sourceTime, 2.5);
  assert.equal(playback.trimStart, 1);
  assert.equal(playback.trimEnd, 5);
});

test('timeline playback resolver honors preferred overlapping video item at the playhead', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const overlayTrackId = 'track-video-overlay-1';
  const overlayTimeline: VideoEditTimelineV2 = {
    ...timeline,
    playhead: 1.5,
    selectedItemIds: ['overlay-video'],
    tracks: [
      ...timeline.tracks,
      { id: overlayTrackId, kind: 'video', name: '叠加轨', order: -1 },
    ],
    items: [
      ...timeline.items,
      {
        id: 'overlay-video',
        assetId: 'asset-b',
        trackId: overlayTrackId,
        kind: 'video',
        timelineStart: 1,
        sourceIn: 0.5,
        sourceOut: 3,
        label: '画中画',
      },
    ],
  };

  const playback = resolveVideoEditTimelinePlayback(overlayTimeline, 'overlay-video');

  assert.equal(playback.item?.id, 'overlay-video');
  assert.equal(playback.asset?.id, 'asset-b');
  assert.equal(playback.timelineTime, 1.5);
  assert.equal(playback.sourceTime, 1);
});

test('timeline playback resolver keeps primary track preview when selecting normal overlay at the playhead', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const overlayTrackId = 'track-video-overlay-1';
  const overlayTimeline: VideoEditTimelineV2 = {
    ...timeline,
    playhead: 1.5,
    selectedItemIds: ['overlay-video'],
    tracks: [
      ...timeline.tracks,
      { id: overlayTrackId, kind: 'video', name: '叠加轨', order: 1 },
    ],
    items: [
      ...timeline.items,
      {
        id: 'overlay-video',
        assetId: 'asset-b',
        trackId: overlayTrackId,
        kind: 'video',
        timelineStart: 1,
        sourceIn: 0.5,
        sourceOut: 3,
        label: '画中画',
      },
    ],
  };

  const playback = resolveVideoEditTimelinePlayback(overlayTimeline, 'overlay-video');

  assert.equal(playback.item?.id, 'item-clip-a-video');
  assert.equal(playback.asset?.id, 'asset-a');
  assert.equal(playback.timelineTime, 1.5);
  assert.equal(playback.sourceTime, 3.5);
});

test('timeline playback source time maps back to timeline playhead time', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const trimmed: VideoEditTimelineV2 = {
    ...timeline,
    playhead: 6.25,
    items: timeline.items.map((item) => {
      if (item.id === 'item-clip-b-video') {
        return { ...item, timelineStart: 6, sourceIn: 1, sourceOut: 5 };
      }
      return item;
    }),
  };

  const playback = resolveVideoEditTimelinePlayback(trimmed);

  assert.equal(videoEditTimelineTimeFromPlaybackSourceTime(playback, 1), 6);
  assert.equal(videoEditTimelineTimeFromPlaybackSourceTime(playback, 2.5), 7.5);
  assert.equal(videoEditTimelineTimeFromPlaybackSourceTime(playback, 99), 10);
});

test('timeline playback resolver stays empty when playhead is in empty space', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const spaced: VideoEditTimelineV2 = {
    ...timeline,
    playhead: 6.5,
    selectedItemIds: ['item-clip-a-audio', 'item-clip-b-video'],
    items: timeline.items.map((item) => {
      if (item.id === 'item-clip-b-video') return { ...item, timelineStart: 9 };
      return item;
    }),
  };

  const playback = resolveVideoEditTimelinePlayback(spaced, 'item-clip-a-video');

  assert.equal(playback.item, null);
  assert.equal(playback.asset, null);
  assert.equal(playback.sourceTime, 0);
  assert.equal(playback.timelineTime, 6.5);
});

test('timeline playback resolver chooses the right-hand item at a cut boundary', () => {
  const timeline = createVideoEditTimelineFromClips(clips);
  const split = splitVideoEditTimelineItem(timeline, 'item-clip-a-video', 4);
  const boundary: VideoEditTimelineV2 = {
    ...split,
    playhead: 4,
    selectedItemIds: ['item-clip-a-video-split'],
  };

  const playback = resolveVideoEditTimelinePlayback(boundary, 'item-clip-a-video-split');

  assert.equal(playback.item?.id, 'item-clip-a-video-split');
  assert.equal(playback.sourceTime, 6);
  assert.equal(playback.trimStart, 6);
  assert.equal(playback.trimEnd, 8);
});
