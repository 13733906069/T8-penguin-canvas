export const UNSUPPORTED_M4A_UPLOAD_MESSAGE =
  'M4A 音频格式当前所有模型均不支持，请先转换为 MP3、WAV、OGG、FLAC 或 AAC 后再上传。';

export const AUDIO_UPLOAD_ACCEPT = [
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.aac',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
].join(',');

type UploadFileLike = {
  name?: string;
  type?: string;
};

export function isUnsupportedUploadAudioFile(file: UploadFileLike): boolean {
  const name = String(file?.name || '').split(/[?#]/)[0].toLowerCase();
  const mime = String(file?.type || '').toLowerCase();
  return name.endsWith('.m4a') || mime === 'audio/mp4' || mime === 'audio/x-m4a' || mime === 'audio/m4a';
}

export function validateUploadMediaFile(file: UploadFileLike, kind: string | null | undefined): string | null {
  if (kind !== 'audio') return null;
  return isUnsupportedUploadAudioFile(file) ? UNSUPPORTED_M4A_UPLOAD_MESSAGE : null;
}
