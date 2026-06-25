const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const express = require('express');
const config = require('../backend/src/config');
const videoOpsRouter = require('../backend/src/routes/videoOps');
const { resolveBundledFfmpeg } = require('../backend/src/providers/llmMedia');

function runFfmpeg(args) {
  const ffmpeg = resolveBundledFfmpeg();
  const result = spawnSync(ffmpeg, args, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listenVideoOps() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use('/api/video-ops', videoOpsRouter);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

test('videoOps composes real clips through bundled ffmpeg even when audio tracks differ', async () => {
  fs.mkdirSync(config.INPUT_DIR, { recursive: true });
  fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const clipA = path.join(config.INPUT_DIR, `video_edit_test_a_${stamp}.mp4`);
  const clipB = path.join(config.INPUT_DIR, `video_edit_test_b_${stamp}.mp4`);

  runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=12:d=0.5',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5',
    '-shortest',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    clipA,
  ]);
  runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=12:d=0.5',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    clipB,
  ]);

  try {
    const result = await videoOpsRouter._test.composeVideoEdit(
      [
        { url: `/files/input/${path.basename(clipA)}`, trimStart: 0 },
        { url: `/files/input/${path.basename(clipB)}`, trimStart: 0 },
      ],
      {
        aspect: '16:9',
        resolution: 'first',
        transition: 'black',
        transitionDuration: 0.1,
        filter: 'warm',
        audio: 'keep',
      },
    );

    assert.match(result.videoUrl, /^\/files\/output\/video_edit_/);
    assert.equal(result.mime, 'video/mp4');
    assert.ok(result.size > 1000);
    assert.ok(result.duration >= 1);
    assert.equal(result.width, 160);
    assert.equal(result.height, 90);
    const outputFile = path.join(config.OUTPUT_DIR, path.basename(result.videoUrl));
    assert.ok(fs.existsSync(outputFile));
    try { fs.unlinkSync(outputFile); } catch (_) {}
  } finally {
    for (const file of [clipA, clipB]) {
      try { fs.unlinkSync(file); } catch (_) {}
    }
  }
});

test('videoOps target size supports creator aspect presets without 4:5', () => {
  const { targetSize } = videoOpsRouter._test;
  assert.deepEqual(targetSize({ aspect: '3:4', resolution: '1080p' }, { width: 1920, height: 1080 }), { width: 1440, height: 1920 });
  assert.deepEqual(targetSize({ aspect: '4:3', resolution: '1080p' }, { width: 1920, height: 1080 }), { width: 1920, height: 1440 });
  assert.deepEqual(targetSize({ aspect: '21:9', resolution: '1080p' }, { width: 1920, height: 1080 }), { width: 1920, height: 824 });
  assert.deepEqual(targetSize({ aspect: '2:1', resolution: '1080p' }, { width: 1920, height: 1080 }), { width: 1920, height: 960 });
  assert.deepEqual(targetSize({ aspect: '4:5', resolution: '1080p' }, { width: 640, height: 360 }), { width: 1920, height: 1080 });
});

test('videoOps async compose starts a cancellable job and exposes final result for polling clients', async () => {
  fs.mkdirSync(config.INPUT_DIR, { recursive: true });
  fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const clip = path.join(config.INPUT_DIR, `video_edit_async_${stamp}.mp4`);
  runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', 'color=c=green:s=90x120:r=12:d=0.4',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    clip,
  ]);

  const { server, baseUrl } = await listenVideoOps();
  let outputFile = '';
  try {
    const startRes = await fetch(`${baseUrl}/api/video-ops/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        async: true,
        clips: [{ url: `/files/input/${path.basename(clip)}`, trimStart: 0 }],
        settings: {
          aspect: '3:4',
          resolution: '720p',
          transition: 'none',
          transitionDuration: 0.3,
          filter: 'bright',
          audio: 'mute',
        },
      }),
    });
    const startJson = await startRes.json();
    assert.equal(startRes.status, 200);
    assert.equal(startJson.success, true);
    assert.match(startJson.data.id, /^video-edit-/);
    assert.equal(startJson.data.status, 'running');

    let job = startJson.data;
    for (let i = 0; i < 40 && job.status === 'running'; i += 1) {
      await delay(250);
      const jobRes = await fetch(`${baseUrl}/api/video-ops/jobs/${encodeURIComponent(job.id)}`);
      const jobJson = await jobRes.json();
      assert.equal(jobJson.success, true);
      job = jobJson.data;
    }

    assert.equal(job.status, 'done', job.error || job.message);
    assert.match(job.result.videoUrl, /^\/files\/output\/video_edit_/);
    assert.equal(job.result.width, 960);
    assert.equal(job.result.height, 1280);
    outputFile = path.join(config.OUTPUT_DIR, path.basename(job.result.videoUrl));
    assert.ok(fs.existsSync(outputFile));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try { fs.unlinkSync(clip); } catch (_) {}
    if (outputFile) {
      try { fs.unlinkSync(outputFile); } catch (_) {}
    }
  }
});
