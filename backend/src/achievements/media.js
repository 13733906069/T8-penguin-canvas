'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const MAGIC = Buffer.from('T8MEDIA1');
const KEY_SEED = 't8-penguin-canvas-achievement-media-v1';

const MEDIA_BY_FILM_ID = {
  'film-tech-01': {
    encryptedFile: 'film-tech-01.mp4.t8media',
    mime: 'video/mp4',
    fileName: 'tech-hidden-reward.mp4',
  },
  'film-rh-01': {
    encryptedFile: 'film-rh-01.mp4.t8media',
    mime: 'video/mp4',
    fileName: 'rh-hidden-reward.mp4',
  },
  'film-yyh-01': {
    encryptedFile: 'film-yyh-01.mp4.t8media',
    mime: 'video/mp4',
    fileName: 'yyh-hidden-reward.mp4',
  },
  'film-dragon-ball-01': {
    encryptedFile: 'film-dragon-ball-01.mp4.t8media',
    mime: 'video/mp4',
    fileName: 'dragon-ball-hidden-reward.mp4',
  },
  'film-saint-seiya-01': {
    encryptedFile: 'film-saint-seiya-01.mp4.t8media',
    mime: 'video/mp4',
    fileName: 'saint-seiya-hades-reward.mp4',
  },
  'film-tetris-01': {
    encryptedFile: 'film-tetris-01.mp4.t8media',
    mime: 'video/mp4',
    fileName: 'tetris-hidden-reward.mp4',
  },
};

function deriveKey(filmId, salt) {
  return crypto.createHash('sha256')
    .update(KEY_SEED)
    .update(String(filmId || ''))
    .update(Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt || ''), 'base64'))
    .digest();
}

function candidateResourceRoots() {
  const roots = [];
  if (process.env.T8PC_RES) roots.push(process.env.T8PC_RES);
  if (config.BASE_DIR) roots.push(config.BASE_DIR);
  roots.push(path.resolve(__dirname, '..', '..', '..'));
  roots.push(process.cwd());
  return [...new Set(roots.filter(Boolean).map((root) => path.resolve(root)))];
}

function resolveAchievementMediaPath(fileName) {
  const safeName = path.basename(String(fileName || ''));
  for (const root of candidateResourceRoots()) {
    const candidate = path.join(root, 'resources', 'achievement-media', safeName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(candidateResourceRoots()[0], 'resources', 'achievement-media', safeName);
}

function mediaStatusForFilm(film) {
  const id = film && film.id;
  const media = MEDIA_BY_FILM_ID[id];
  if (!media) {
    return { hasMedia: false, status: 'awaiting-media' };
  }
  const filePath = resolveAchievementMediaPath(media.encryptedFile);
  const hasMedia = fs.existsSync(filePath);
  return {
    ...media,
    path: filePath,
    hasMedia,
    status: hasMedia ? 'ready' : 'awaiting-media',
    mediaUrl: hasMedia ? `/api/achievements/films/${encodeURIComponent(id)}/media` : '',
  };
}

function encryptAchievementMediaBuffer(input, options = {}) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  const filmId = String(options.filmId || '').trim();
  if (!filmId) throw new Error('filmId is required');
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(filmId, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const header = {
    filmId,
    mime: options.mime || 'application/octet-stream',
    fileName: path.basename(options.fileName || 'achievement-media.bin'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
  const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(headerBuffer.length, 0);
  return Buffer.concat([MAGIC, lengthBuffer, headerBuffer, ciphertext]);
}

function decryptAchievementMediaFile(filePath, expectedFilmId) {
  const input = fs.readFileSync(filePath);
  if (input.length < MAGIC.length + 4 || !input.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('奖励影片文件格式不正确');
  }
  const headerLength = input.readUInt32BE(MAGIC.length);
  const headerStart = MAGIC.length + 4;
  const headerEnd = headerStart + headerLength;
  if (headerLength <= 0 || headerEnd > input.length) throw new Error('奖励影片头信息损坏');
  const header = JSON.parse(input.subarray(headerStart, headerEnd).toString('utf8'));
  if (expectedFilmId && header.filmId !== expectedFilmId) throw new Error('奖励影片 ID 不匹配');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(header.filmId, Buffer.from(header.salt, 'base64')),
    Buffer.from(header.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(header.tag, 'base64'));
  const buffer = Buffer.concat([decipher.update(input.subarray(headerEnd)), decipher.final()]);
  return { buffer, header };
}

module.exports = {
  MEDIA_BY_FILM_ID,
  decryptAchievementMediaFile,
  encryptAchievementMediaBuffer,
  mediaStatusForFilm,
  resolveAchievementMediaPath,
};
