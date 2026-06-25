import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  AUDIO_UPLOAD_ACCEPT,
  UNSUPPORTED_M4A_UPLOAD_MESSAGE,
  isUnsupportedUploadAudioFile,
  validateUploadMediaFile,
} from '../src/utils/uploadMediaValidation.ts';

const fileLike = (name: string, type = '') => ({ name, type });

test('upload media validation blocks M4A audio before material upload', () => {
  assert.equal(isUnsupportedUploadAudioFile(fileLike('voice.M4a', 'audio/mp4')), true);
  assert.equal(isUnsupportedUploadAudioFile(fileLike('voice.m4a', '')), true);
  assert.equal(isUnsupportedUploadAudioFile(fileLike('voice.wav', 'audio/wav')), false);

  assert.equal(validateUploadMediaFile(fileLike('voice.M4a', 'audio/mp4'), 'audio'), UNSUPPORTED_M4A_UPLOAD_MESSAGE);
  assert.equal(validateUploadMediaFile(fileLike('voice.wav', 'audio/wav'), 'audio'), null);
  assert.equal(validateUploadMediaFile(fileLike('clip.mp4', 'video/mp4'), 'video'), null);

  assert.equal(AUDIO_UPLOAD_ACCEPT.includes('.m4a'), false);
  assert.equal(AUDIO_UPLOAD_ACCEPT.includes('.mp3'), true);
  assert.equal(AUDIO_UPLOAD_ACCEPT.includes('.wav'), true);
});

test('upload material paths use shared M4A validation before posting files', () => {
  const uploadNode = fs.readFileSync(new URL('../src/components/nodes/UploadNode.tsx', import.meta.url), 'utf8');
  const canvas = fs.readFileSync(new URL('../src/components/Canvas.tsx', import.meta.url), 'utf8');

  assert.match(uploadNode, /isUnsupportedUploadAudioFile/);
  assert.match(uploadNode, /UNSUPPORTED_M4A_UPLOAD_MESSAGE/);
  assert.match(uploadNode, /validateUploadMediaFile\(file, kind\)/);
  assert.match(uploadNode, /AUDIO_UPLOAD_ACCEPT/);
  assert.match(canvas, /validateUploadMediaFile\(file, kind\)/);
});
