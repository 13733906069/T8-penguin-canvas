'use strict';

const express = require('express');
const store = require('../achievements/store');
const { decryptAchievementMediaFile } = require('../achievements/media');

const router = express.Router();

function sendMediaBuffer(req, res, buffer, media) {
  const total = buffer.length;
  const mime = media.mime || 'application/octet-stream';
  const fileName = media.fileName || 'achievement-media.bin';
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const range = req.headers.range;
  if (!range) {
    res.setHeader('Content-Length', total);
    res.end(buffer);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(String(range));
  if (!match) {
    res.status(416).setHeader('Content-Range', `bytes */${total}`);
    res.end();
    return;
  }
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= total) {
    res.status(416).setHeader('Content-Range', `bytes */${total}`);
    res.end();
    return;
  }
  end = Math.min(end, total - 1);
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
  res.setHeader('Content-Length', end - start + 1);
  res.end(buffer.subarray(start, end + 1));
}

router.get('/profile', (_req, res) => {
  try {
    res.json({ success: true, data: store.getProfile() });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || '读取成就数据失败' });
  }
});

router.get('/films/:id/media', (req, res) => {
  try {
    const access = store.getFilmMediaAccess(req.params.id);
    if (!access.ok) {
      res.status(access.status || 404).json({ success: false, error: access.error || '奖励影片不可用' });
      return;
    }
    const decrypted = decryptAchievementMediaFile(access.media.path, access.film.id);
    sendMediaBuffer(req, res, decrypted.buffer, {
      mime: decrypted.header.mime || access.media.mime,
      fileName: decrypted.header.fileName || access.media.fileName,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || '读取奖励影片失败' });
  }
});

router.post('/event', express.json({ limit: '1mb' }), (req, res) => {
  try {
    res.json({ success: true, data: store.recordEvent(req.body || {}) });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || '记录成就事件失败' });
  }
});

router.post('/preferences', express.json({ limit: '1mb' }), (req, res) => {
  try {
    res.json({ success: true, data: store.setPreferences(req.body || {}) });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || '保存成就设置失败' });
  }
});

router.post('/reset', (_req, res) => {
  try {
    res.json({ success: true, data: store.resetData() });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || '重置成就数据失败' });
  }
});

router.get('/export', (_req, res) => {
  try {
    res.json({ success: true, data: store.exportData() });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || '导出成就数据失败' });
  }
});

router.post('/import', express.json({ limit: '10mb' }), (req, res) => {
  try {
    res.json({ success: true, data: store.importData(req.body || {}) });
  } catch (error) {
    res.status(400).json({ success: false, error: error?.message || '导入成就数据失败' });
  }
});

module.exports = router;
