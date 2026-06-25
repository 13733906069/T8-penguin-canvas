/**
 * Lightweight video editing operations.
 *
 * The frontend owns clip ordering / trimming UI. This route uses the bundled
 * ffmpeg runtime to probe sources and stitch normalized MP4 segments.
 */
const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const config = require('../config');
const { resolveBundledFfmpeg } = require('../providers/llmMedia');

const router = express.Router();
const jobs = new Map();
const MAX_CLIPS = 80;
const MAX_REMOTE_VIDEO_BYTES = Math.max(20 * 1024 * 1024, Number(process.env.T8_VIDEO_OPS_MAX_REMOTE_BYTES || 512 * 1024 * 1024));
const FFMPEG_TIMEOUT_MS = Math.max(30_000, Number(process.env.T8_VIDEO_OPS_TIMEOUT_MS || 15 * 60 * 1000));

function makeJob(action) {
  const job = {
    id: `video-edit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    action,
    status: 'running',
    progress: 0,
    message: '准备处理',
    createdAt: Date.now(),
    child: null,
    cancelled: false,
  };
  jobs.set(job.id, job);
  return job;
}

function publicJob(job) {
  if (!job) return null;
  const { child, ...rest } = job;
  return rest;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeOutputName(prefix, ext = '.mp4') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function stripQuery(value) {
  return String(value || '').split('?')[0].split('#')[0];
}

function resolveMountedPath(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  let clean = url.trim();
  if (isHttpUrl(clean)) {
    try {
      const parsed = new URL(clean);
      const host = parsed.hostname.toLowerCase();
      if (host !== '127.0.0.1' && host !== 'localhost') return null;
      clean = parsed.pathname;
    } catch {
      return null;
    }
  }
  clean = stripQuery(clean);
  const mounts = [
    { prefixes: ['/files/input/', '/input/'], dir: config.INPUT_DIR },
    { prefixes: ['/files/output/', '/output/'], dir: config.OUTPUT_DIR },
    { prefixes: ['/files/thumbnails/'], dir: config.THUMBNAILS_DIR },
  ];
  for (const mount of mounts) {
    const prefix = mount.prefixes.find((item) => clean.startsWith(item));
    if (!prefix) continue;
    const rel = decodeURIComponent(clean.slice(prefix.length));
    const base = path.resolve(mount.dir);
    const resolved = path.resolve(base, rel);
    if (resolved === base || !resolved.startsWith(base + path.sep)) return null;
    return resolved;
  }
  return null;
}

async function downloadRemoteVideo(url, targetDir) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`远程视频下载失败: HTTP ${res.status}`);
  const contentType = String(res.headers.get('content-type') || '');
  if (contentType && !/^video\//i.test(contentType) && !/octet-stream/i.test(contentType)) {
    throw new Error(`远程地址不是视频文件: ${contentType}`);
  }
  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_REMOTE_VIDEO_BYTES) {
    throw new Error(`远程视频超过 ${Math.round(MAX_REMOTE_VIDEO_BYTES / 1024 / 1024)}MB 限制`);
  }
  const parsed = new URL(url);
  const ext = path.extname(stripQuery(parsed.pathname)) || '.mp4';
  const target = path.join(targetDir, safeOutputName('remote_video', ext));
  const reader = res.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_REMOTE_VIDEO_BYTES) throw new Error('远程视频过大');
    await fsp.writeFile(target, buf);
    return target;
  }
  const file = fs.createWriteStream(target);
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REMOTE_VIDEO_BYTES) throw new Error('远程视频过大');
      file.write(Buffer.from(value));
    }
  } finally {
    await new Promise((resolve) => file.end(resolve));
  }
  return target;
}

async function resolveVideoSource(url, targetDir) {
  const local = resolveMountedPath(url);
  if (local) {
    if (!fs.existsSync(local)) throw new Error(`本地视频不存在: ${path.basename(local)}`);
    return local;
  }
  if (isHttpUrl(url)) return downloadRemoteVideo(url, targetDir);
  throw new Error('不支持的视频地址');
}

function runFfmpeg(args, job, options = {}) {
  const ffmpeg = resolveBundledFfmpeg();
  const timeoutMs = options.timeoutMs || FFMPEG_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    if (job?.cancelled) {
      reject(new Error('任务已取消'));
      return;
    }
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';
    let stdout = '';
    let settled = false;
    if (job) job.child = child;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (_) {}
      if (job) job.child = null;
      reject(new Error('ffmpeg 处理超时'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 80_000) stderr = stderr.slice(-80_000);
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (job) job.child = null;
      reject(error);
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (job) job.child = null;
      if (job?.cancelled) {
        reject(new Error('任务已取消'));
        return;
      }
      if (options.allowFailure || code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        const lastLine = stderr.trim().split(/\r?\n/).slice(-3).join('\n');
        reject(new Error(lastLine || `ffmpeg 失败: ${code}`));
      }
    });
  });
}

function parseProbe(stderr) {
  const text = String(stderr || '');
  const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const duration = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : undefined;
  const videoMatch = text.match(/Video:\s*[^,\n]+(?:,[^,\n]+)*,\s*(\d{2,5})x(\d{2,5})/i);
  const audio = /Audio:\s*/i.test(text);
  return {
    duration: Number.isFinite(duration) ? duration : undefined,
    width: videoMatch ? Number(videoMatch[1]) : undefined,
    height: videoMatch ? Number(videoMatch[2]) : undefined,
    hasAudio: audio,
  };
}

async function probeFile(file, job) {
  const result = await runFfmpeg(['-hide_banner', '-i', file], job, {
    allowFailure: true,
    timeoutMs: 45_000,
  });
  return parseProbe(result.stderr);
}

function even(value) {
  const n = Math.max(2, Math.round(Number(value) || 2));
  return n % 2 === 0 ? n : n + 1;
}

function aspectRatio(settings, firstProbe) {
  const raw = settings?.aspect || 'first';
  if (raw === '9:16') return { w: 9, h: 16 };
  if (raw === '1:1') return { w: 1, h: 1 };
  if (raw === '16:9') return { w: 16, h: 9 };
  if (raw === '3:4') return { w: 3, h: 4 };
  if (raw === '4:3') return { w: 4, h: 3 };
  if (raw === '21:9') return { w: 21, h: 9 };
  if (raw === '2:1') return { w: 2, h: 1 };
  const w = Number(firstProbe?.width) || 16;
  const h = Number(firstProbe?.height) || 9;
  return { w, h };
}

function targetSize(settings, firstProbe) {
  const ratio = aspectRatio(settings, firstProbe);
  const resolution = settings?.resolution || 'first';
  if (resolution === 'first' || resolution === 'source') {
    return {
      width: even(Number(firstProbe?.width) || 1280),
      height: even(Number(firstProbe?.height) || 720),
    };
  }
  const longEdge = {
    '720p': 1280,
    '1080p': 1920,
    '2k': 2560,
    '4k': 3840,
  }[resolution] || 1280;
  if (ratio.w === ratio.h) return { width: even(Math.min(longEdge, 2160)), height: even(Math.min(longEdge, 2160)) };
  if (ratio.w >= ratio.h) {
    return { width: even(longEdge), height: even(longEdge * ratio.h / ratio.w) };
  }
  return { width: even(longEdge * ratio.w / ratio.h), height: even(longEdge) };
}

function filterChain(settings, width, height, duration) {
  const base = [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    'setsar=1',
    'format=yuv420p',
  ];
  const filter = settings?.filter || 'none';
  if (filter === 'bright') base.push('eq=brightness=0.05:saturation=1.04');
  if (filter === 'contrast') base.push('eq=contrast=1.18:saturation=1.05');
  if (filter === 'warm') base.push('colorbalance=rs=0.04:gs=0.015:bs=-0.035');
  if (filter === 'cool') base.push('colorbalance=rs=-0.035:gs=0.005:bs=0.045');
  if (filter === 'mono') base.push('hue=s=0');
  if (filter === 'cinematic') base.push('eq=contrast=1.12:saturation=0.95:gamma=0.96');
  const transition = settings?.transition || 'none';
  const d = Math.max(0.1, Math.min(1.2, Number(settings?.transitionDuration) || 0.5));
  if (duration > d * 2 && (transition === 'fade' || transition === 'crossfade' || transition === 'slide')) {
    base.push(`fade=t=in:st=0:d=${d.toFixed(2)}`);
    base.push(`fade=t=out:st=${Math.max(0, duration - d).toFixed(2)}:d=${d.toFixed(2)}`);
  }
  return base.join(',');
}

function shouldKeepAudio(settings, clip, index, probe) {
  if (clip?.muted || !probe?.hasAudio) return false;
  const audio = settings?.audio || 'keep';
  if (audio === 'mute') return false;
  if (audio === 'first' && index > 0) return false;
  return true;
}

async function makeSegment({ source, clip, index, probe, settings, width, height, targetDir, job }) {
  const start = Math.max(0, Number(clip.trimStart) || 0);
  const rawEnd = Number(clip.trimEnd);
  const sourceDuration = Number(probe.duration) || 0;
  const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : sourceDuration;
  const duration = Math.max(0.1, (end || start + 1) - start);
  const keepAudio = shouldKeepAudio(settings, clip, index, probe);
  const output = path.join(targetDir, `segment_${String(index).padStart(3, '0')}.mp4`);
  const args = ['-y'];
  if (start > 0) args.push('-ss', start.toFixed(3));
  args.push('-i', source);
  if (!keepAudio) {
    args.push('-f', 'lavfi', '-t', duration.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  }
  args.push('-t', duration.toFixed(3));
  args.push('-map', '0:v:0');
  args.push('-map', keepAudio ? '0:a:0' : '1:a:0');
  args.push('-vf', filterChain(settings, width, height, duration));
  args.push('-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20');
  args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2');
  args.push('-shortest', '-movflags', '+faststart', output);
  await runFfmpeg(args, job);
  return { file: output, duration };
}

async function makeColorTransition({ color, duration, width, height, targetDir, index, job }) {
  const output = path.join(targetDir, `transition_${String(index).padStart(3, '0')}.mp4`);
  await runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', `color=c=${color}:s=${width}x${height}:r=30:d=${duration.toFixed(3)}`,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', duration.toFixed(3),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
    '-shortest', '-movflags', '+faststart',
    output,
  ], job);
  return output;
}

async function concatSegments(files, output, job) {
  const listFile = path.join(path.dirname(output), 'concat.txt');
  const body = files
    .map((file) => file.replace(/\\/g, '/'))
    .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await fsp.writeFile(listFile, body, 'utf8');
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    '-movflags', '+faststart',
    output,
  ], job);
}

async function createThumbnail(source, probe, prefix = 'video_edit_thumb') {
  const filename = safeOutputName(prefix, '.jpg');
  const target = path.join(config.THUMBNAILS_DIR, filename);
  const seek = Math.max(0, Math.min(1, (Number(probe?.duration) || 2) / 2));
  await runFfmpeg([
    '-y',
    '-ss', seek.toFixed(2),
    '-i', source,
    '-frames:v', '1',
    '-vf', 'scale=320:-1',
    '-q:v', '4',
    target,
  ], null, { timeoutMs: 45_000 });
  return `/files/thumbnails/${filename}`;
}

async function probeVideoUrl(url, job) {
  const tmp = ensureDir(path.join(os.tmpdir(), `t8-video-probe-${crypto.randomBytes(4).toString('hex')}`));
  try {
    const source = await resolveVideoSource(url, tmp);
    const probe = await probeFile(source, job);
    let thumbnailUrl = '';
    try {
      thumbnailUrl = await createThumbnail(source, probe);
    } catch (error) {
      console.warn('[videoOps] thumbnail failed:', error?.message || error);
    }
    const stat = fs.existsSync(source) ? fs.statSync(source) : null;
    return {
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      hasAudio: probe.hasAudio,
      size: stat?.size,
      mime: 'video/mp4',
      thumbnailUrl,
    };
  } finally {
    fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

async function composeVideoEdit(clips, settings, job = makeJob('compose')) {
  if (!Array.isArray(clips) || clips.length === 0) throw new Error('至少需要 1 段视频');
  const normalizedClips = clips
    .filter((clip) => clip && typeof clip.url === 'string' && clip.url.trim())
    .slice(0, MAX_CLIPS);
  if (normalizedClips.length === 0) throw new Error('没有可用的视频片段');

  const workDir = ensureDir(path.join(os.tmpdir(), `t8-video-compose-${job.id}`));
  try {
    job.message = '读取视频素材';
    const sources = [];
    for (let i = 0; i < normalizedClips.length; i += 1) {
      job.progress = Math.round((i / normalizedClips.length) * 15);
      const clip = normalizedClips[i];
      const source = await resolveVideoSource(clip.directUrl || clip.url, workDir);
      const probe = await probeFile(source, job);
      sources.push({ clip, source, probe });
    }
    const size = targetSize(settings, sources[0]?.probe);
    const segmentFiles = [];
    for (let i = 0; i < sources.length; i += 1) {
      job.message = `标准化片段 ${i + 1}/${sources.length}`;
      job.progress = 15 + Math.round((i / Math.max(1, sources.length)) * 55);
      const segment = await makeSegment({
        ...sources[i],
        index: i,
        settings,
        width: size.width,
        height: size.height,
        targetDir: workDir,
        job,
      });
      segmentFiles.push(segment.file);
      const transition = settings?.transition || 'none';
      if ((transition === 'black' || transition === 'white') && i < sources.length - 1) {
        const color = transition === 'white' ? 'white' : 'black';
        const duration = Math.max(0.1, Math.min(1.2, Number(settings?.transitionDuration) || 0.5));
        segmentFiles.push(await makeColorTransition({
          color,
          duration,
          width: size.width,
          height: size.height,
          targetDir: workDir,
          index: i,
          job,
        }));
      }
    }

    job.message = '合成最终视频';
    job.progress = 78;
    const filename = safeOutputName('video_edit', '.mp4');
    const output = path.join(config.OUTPUT_DIR, filename);
    await concatSegments(segmentFiles, output, job);
    const finalProbe = await probeFile(output, job);
    const stat = fs.statSync(output);
    const result = {
      jobId: job.id,
      videoUrl: `/files/output/${filename}`,
      directVideoUrl: `/files/output/${filename}`,
      fileName: filename,
      duration: finalProbe.duration,
      width: finalProbe.width || size.width,
      height: finalProbe.height || size.height,
      size: stat.size,
      mime: 'video/mp4',
    };
    job.status = 'done';
    job.progress = 100;
    job.message = '合成完成';
    job.result = result;
    return result;
  } catch (error) {
    job.status = job.cancelled ? 'cancelled' : 'failed';
    job.message = error?.message || '视频合成失败';
    job.error = job.message;
    throw error;
  } finally {
    fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

router.post('/probe', async (req, res) => {
  const job = makeJob('probe');
  try {
    const url = req.body?.videoUrl || req.body?.url;
    const data = await probeVideoUrl(url, job);
    job.status = 'done';
    job.progress = 100;
    job.message = '探测完成';
    res.json({ success: true, data });
  } catch (error) {
    job.status = 'failed';
    job.error = error?.message || '读取视频信息失败';
    res.status(400).json({ success: false, error: job.error });
  }
});

router.post('/compose', async (req, res) => {
  const job = makeJob('compose');
  if (req.body?.async === true) {
    setImmediate(async () => {
      try {
        await composeVideoEdit(req.body?.clips, req.body?.settings || {}, job);
      } catch (_) {
        // composeVideoEdit records failure details on the job for polling clients.
      }
    });
    return res.json({ success: true, data: publicJob(job) });
  }
  try {
    const data = await composeVideoEdit(req.body?.clips, req.body?.settings || {}, job);
    res.json({ success: true, data });
  } catch (error) {
    const status = job.cancelled ? 499 : 500;
    res.status(status).json({ success: false, error: error?.message || '视频合成失败', job: publicJob(job) });
  }
});

router.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: '任务不存在' });
  return res.json({ success: true, data: publicJob(job) });
});

router.post('/jobs/:id/cancel', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: '任务不存在' });
  job.cancelled = true;
  job.status = 'cancelled';
  job.message = '已取消';
  try { job.child?.kill('SIGKILL'); } catch (_) {}
  return res.json({ success: true, data: publicJob(job) });
});

router._test = {
  parseProbe,
  targetSize,
  filterChain,
  resolveMountedPath,
  composeVideoEdit,
  probeVideoUrl,
};

module.exports = router;
