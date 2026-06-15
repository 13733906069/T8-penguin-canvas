import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  DEFAULT_CLOUD_UPLOAD_TARGETS,
  maskCloudUploadTargets,
  normalizeCloudUploadTargets,
  summarizeCloudUploadTargets,
} = require('../backend/src/cloudUploads/settings.js');

const {
  buildObjectKey,
  classifyCloudUploadError,
  testCloudTargetConnectivity,
  uploadCloudAsset,
  validateTargetConfig,
} = require('../backend/src/cloudUploads/uploader.js');

test('normalizeCloudUploadTargets creates disabled built-in targets', () => {
  const targets = normalizeCloudUploadTargets(undefined);

  assert.deepEqual(
    targets.map((target: any) => target.id),
    DEFAULT_CLOUD_UPLOAD_TARGETS.map((target: any) => target.id),
  );
  assert.ok(targets.every((target: any) => target.enabled === false));
  assert.equal(targets.find((target: any) => target.id === 'tencent-cos')?.tencentCos?.region, 'ap-guangzhou');
  assert.equal(targets.find((target: any) => target.id === 'aliyun-oss')?.aliyunOss?.endpoint, 'oss-cn-hangzhou.aliyuncs.com');
});

test('normalizeCloudUploadTargets preserves stored secrets when incoming values are blank or masked', () => {
  const current = normalizeCloudUploadTargets([
    {
      id: 'tencent-cos',
      provider: 'tencent-cos',
      tencentCos: {
        bucket: 'bucket-1250000000',
        region: 'ap-guangzhou',
        secretId: 'sid-secret-1234',
        secretKey: 'skey-secret-5678',
      },
    },
    {
      id: 'aliyun-oss',
      provider: 'aliyun-oss',
      aliyunOss: {
        bucket: 'bucket',
        endpoint: 'oss-cn-hangzhou.aliyuncs.com',
        accessKeyId: 'ak-secret-1111',
        accessKeySecret: 'sk-secret-2222',
      },
    },
  ]);

  const next = normalizeCloudUploadTargets(
    [
      {
        id: 'tencent-cos',
        provider: 'tencent-cos',
        tencentCos: {
          bucket: 'bucket-1250000000',
          region: 'ap-guangzhou',
          secretId: '****1234',
          secretKey: '',
        },
      },
      {
        id: 'aliyun-oss',
        provider: 'aliyun-oss',
        aliyunOss: {
          bucket: 'bucket',
          endpoint: 'https://oss-cn-shanghai.aliyuncs.com/',
          accessKeyId: '****1111',
          accessKeySecret: '',
        },
      },
    ],
    current,
  );

  const tencent = next.find((target: any) => target.id === 'tencent-cos');
  const aliyun = next.find((target: any) => target.id === 'aliyun-oss');

  assert.equal(tencent?.tencentCos?.secretId, 'sid-secret-1234');
  assert.equal(tencent?.tencentCos?.secretKey, 'skey-secret-5678');
  assert.equal(aliyun?.aliyunOss?.accessKeyId, 'ak-secret-1111');
  assert.equal(aliyun?.aliyunOss?.accessKeySecret, 'sk-secret-2222');
  assert.equal(aliyun?.aliyunOss?.endpoint, 'oss-cn-shanghai.aliyuncs.com');
});

test('normalizeCloudUploadTargets accepts Aliyun OSS region shorthand endpoints', () => {
  const targets = normalizeCloudUploadTargets([
    {
      id: 'aliyun-oss',
      provider: 'aliyun-oss',
      aliyunOss: {
        bucket: 'bucket',
        endpoint: 'oss-cn-beijing',
        accessKeyId: 'ak',
        accessKeySecret: 'sk',
      },
    },
  ]);

  const aliyun = targets.find((target: any) => target.id === 'aliyun-oss');
  assert.equal(aliyun?.aliyunOss?.endpoint, 'oss-cn-beijing.aliyuncs.com');
});

test('normalizeCloudUploadTargets accepts Aliyun OSS bare region ids', () => {
  const targets = normalizeCloudUploadTargets([
    {
      id: 'aliyun-oss',
      provider: 'aliyun-oss',
      aliyunOss: {
        bucket: 'bucket',
        endpoint: 'cn-beijing',
        accessKeyId: 'ak',
        accessKeySecret: 'sk',
      },
    },
  ]);

  const aliyun = targets.find((target: any) => target.id === 'aliyun-oss');
  assert.equal(aliyun?.aliyunOss?.endpoint, 'oss-cn-beijing.aliyuncs.com');
});

test('normalizeCloudUploadTargets configures Baidu and Quark WebDAV targets', () => {
  const current = normalizeCloudUploadTargets([
    {
      id: 'baidu-netdisk',
      provider: 'baidu-netdisk',
      baiduNetdisk: {
        webdavUrl: 'http://127.0.0.1:5244/dav/百度网盘/',
        username: 'alice',
        password: 'old-secret',
        folder: '素材归档',
      },
    },
  ]);
  const next = normalizeCloudUploadTargets(
    [
      {
        id: 'baidu-netdisk',
        provider: 'baidu-netdisk',
        baiduNetdisk: {
          webdavUrl: 'http://127.0.0.1:5244/dav/百度网盘/',
          username: 'alice',
          password: '****cret',
          folder: '素材归档',
        },
      },
      {
        id: 'quark-netdisk',
        provider: 'quark-netdisk',
        quarkNetdisk: {
          webdavUrl: 'http://127.0.0.1:5244/dav/夸克网盘',
          username: 'bob',
          password: 'quark-secret',
          folder: '/T8素材',
        },
      },
    ],
    current,
  );

  const baidu = next.find((target: any) => target.id === 'baidu-netdisk');
  const quark = next.find((target: any) => target.id === 'quark-netdisk');

  assert.equal(baidu?.baiduNetdisk?.webdavUrl, 'http://127.0.0.1:5244/dav/%E7%99%BE%E5%BA%A6%E7%BD%91%E7%9B%98');
  assert.equal(baidu?.baiduNetdisk?.password, 'old-secret');
  assert.equal(baidu?.baiduNetdisk?.folder, '/素材归档');
  assert.equal(quark?.quarkNetdisk?.webdavUrl, 'http://127.0.0.1:5244/dav/%E5%A4%B8%E5%85%8B%E7%BD%91%E7%9B%98');
  assert.equal(quark?.quarkNetdisk?.folder, '/T8素材');
});

test('normalizeCloudUploadTargets treats password bullets as masked secrets', () => {
  const current = normalizeCloudUploadTargets([
    {
      id: 'tencent-cos',
      provider: 'tencent-cos',
      tencentCos: {
        bucket: 'bucket-1250000000',
        region: 'ap-guangzhou',
        secretId: 'sid-secret-1234',
        secretKey: 'skey-secret-5678',
      },
    },
  ]);

  const next = normalizeCloudUploadTargets(
    [
      {
        id: 'tencent-cos',
        provider: 'tencent-cos',
        tencentCos: {
          bucket: 'bucket-1250000000',
          region: 'ap-guangzhou',
          secretId: '••••••••',
          secretKey: '●●●●●●●●',
        },
      },
    ],
    current,
  );

  const tencent = next.find((target: any) => target.id === 'tencent-cos');
  assert.equal(tencent?.tencentCos?.secretId, 'sid-secret-1234');
  assert.equal(tencent?.tencentCos?.secretKey, 'skey-secret-5678');
});

test('maskCloudUploadTargets hides cloud secrets while keeping status flags', () => {
  const targets = normalizeCloudUploadTargets([
    {
      id: 'tencent-cos',
      provider: 'tencent-cos',
      tencentCos: {
        bucket: 'bucket-1250000000',
        region: 'ap-guangzhou',
        secretId: 'sid-secret-1234',
        secretKey: 'skey-secret-5678',
      },
    },
  ]);

  const masked = maskCloudUploadTargets(targets);
  const tencent = masked.find((target: any) => target.id === 'tencent-cos');

  assert.equal(tencent?.tencentCos?.secretId, '****1234');
  assert.equal(tencent?.tencentCos?.secretKey, '****5678');
  assert.equal(tencent?.tencentCos?.hasSecretId, true);
  assert.equal(tencent?.tencentCos?.hasSecretKey, true);
  assert.equal(JSON.stringify(masked).includes('sid-secret-1234'), false);
});

test('maskCloudUploadTargets hides WebDAV passwords', () => {
  const targets = normalizeCloudUploadTargets([
    {
      id: 'baidu-netdisk',
      provider: 'baidu-netdisk',
      baiduNetdisk: {
        webdavUrl: 'http://127.0.0.1:5244/dav/baidu',
        username: 'u',
        password: 'webdav-secret',
      },
    },
  ]);

  const masked = maskCloudUploadTargets(targets);
  const baidu = masked.find((target: any) => target.id === 'baidu-netdisk');

  assert.equal(baidu?.baiduNetdisk?.password, '****cret');
  assert.equal(baidu?.baiduNetdisk?.hasPassword, true);
  assert.equal(JSON.stringify(masked).includes('webdav-secret'), false);
});

test('summarizeCloudUploadTargets reports enabled and configured targets', () => {
  const targets = normalizeCloudUploadTargets([
    {
      id: 'tencent-cos',
      provider: 'tencent-cos',
      enabled: true,
      isDefault: true,
      label: 'COS 主桶',
      tencentCos: {
        bucket: 'bucket-1250000000',
        region: 'ap-guangzhou',
        secretId: 'sid',
        secretKey: 'skey',
      },
    },
  ]);

  const summary = summarizeCloudUploadTargets(targets);

  assert.equal(summary.enabledCount, 1);
  assert.equal(summary.configuredCount, 1);
  assert.equal(summary.defaultLabel, 'COS 主桶');
  assert.equal(summary.supportedUploadCount, 4);
});

test('buildObjectKey applies date and kind tokens while keeping extension', () => {
  const objectKey = buildObjectKey(
    { prefix: 't8/{kind}/{yyyy-mm}' },
    path.join('C:', 'tmp', 'image.png'),
    { kind: 'image', title: 'demo.png' },
  );

  assert.match(objectKey, /^t8\/image\/\d{4}-\d{2}\/demo_\d+\.png$/);
});

test('validateTargetConfig accepts WebDAV netdisk targets', () => {
  assert.equal(
    validateTargetConfig({
      provider: 'baidu-netdisk',
      baiduNetdisk: { webdavUrl: 'http://127.0.0.1:5244/dav/baidu' },
    }).supported,
    true,
  );
  assert.equal(
    validateTargetConfig({
      provider: 'quark-netdisk',
      quarkNetdisk: { webdavUrl: 'http://127.0.0.1:5244/dav/quark' },
    }).supported,
    true,
  );
  assert.throws(
    () => validateTargetConfig({ provider: 'baidu-netdisk', baiduNetdisk: {} }),
    /百度网盘缺少 WebDAV 地址/,
  );
  assert.throws(
    () => validateTargetConfig({ provider: 'quark-netdisk', quarkNetdisk: {} }),
    /夸克网盘缺少 WebDAV 地址/,
  );
});

test('classifyCloudUploadError turns storage provider failures into actionable hints', () => {
  const signature = classifyCloudUploadError(
    { provider: 'tencent-cos' },
    Object.assign(new Error('上传失败 HTTP 403：SignatureDoesNotMatch'), {
      statusCode: 403,
      responseText: '<Code>SignatureDoesNotMatch</Code>',
    }),
  );
  assert.equal(signature.code, 'signature');
  assert.match(signature.message, /腾讯云 COS 上传签名校验失败/);
  assert.match(signature.hint, /Region/);

  const bucket = classifyCloudUploadError(
    { provider: 'aliyun-oss' },
    Object.assign(new Error('上传失败 HTTP 404：NoSuchBucket'), {
      statusCode: 404,
      responseText: '<Code>NoSuchBucket</Code>',
    }),
  );
  assert.equal(bucket.code, 'bucket');
  assert.match(bucket.message, /阿里云 OSS Bucket 无法访问/);

  const network = classifyCloudUploadError(
    { provider: 'aliyun-oss' },
    Object.assign(new Error('fetch failed'), { code: 'ENOTFOUND' }),
  );
  assert.equal(network.code, 'network');
  assert.match(network.message, /连接失败/);

  const webdavAuth = classifyCloudUploadError(
    { provider: 'baidu-netdisk' },
    Object.assign(new Error('HTTP 401 Unauthorized'), { statusCode: 401 }),
  );
  assert.equal(webdavAuth.code, 'credential');
  assert.match(webdavAuth.message, /百度网盘 WebDAV/);
});

test('testCloudTargetConnectivity checks Tencent COS with signed location request', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedAuth = '';
  globalThis.fetch = (async (url: any, init: any) => {
    capturedUrl = String(url);
    capturedAuth = String(init?.headers?.Authorization || '');
    return new Response('<LocationConstraint>ap-nanjing</LocationConstraint>', { status: 200 });
  }) as any;
  try {
    const result = await testCloudTargetConnectivity({
      id: 'tencent-cos',
      provider: 'tencent-cos',
      label: 'COS',
      tencentCos: {
        bucket: 'bucket-1250000000',
        region: 'ap-nanjing',
        secretId: 'AKID-demo',
        secretKey: 'secret-demo',
      },
    });

    assert.equal(result.ok, true);
    assert.equal(capturedUrl, 'https://bucket-1250000000.cos.ap-nanjing.myqcloud.com/?location=');
    assert.match(capturedAuth, /q-sign-algorithm=sha1/);
    assert.match(capturedAuth, /q-url-param-list=location/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testCloudTargetConnectivity surfaces Tencent COS XML errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    '<Error><Code>SignatureDoesNotMatch</Code><Message>signature not match</Message><RequestId>req-1</RequestId></Error>',
    { status: 403 },
  )) as any;
  try {
    await assert.rejects(
      () => testCloudTargetConnectivity({
        id: 'tencent-cos',
        provider: 'tencent-cos',
        label: 'COS',
        tencentCos: {
          bucket: 'bucket-1250000000',
          region: 'ap-nanjing',
          secretId: 'AKID-demo',
          secretKey: 'secret-demo',
        },
      }),
      (error: any) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.providerCode, 'SignatureDoesNotMatch');
        assert.equal(error.requestId, 'req-1');
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testCloudTargetConnectivity checks Aliyun OSS with canonical endpoint host', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedAuth = '';
  globalThis.fetch = (async (url: any, init: any) => {
    capturedUrl = String(url);
    capturedAuth = String(init?.headers?.Authorization || '');
    return new Response('<LocationConstraint>oss-cn-beijing</LocationConstraint>', { status: 200 });
  }) as any;
  try {
    const result = await testCloudTargetConnectivity({
      id: 'aliyun-oss',
      provider: 'aliyun-oss',
      label: 'OSS',
      aliyunOss: {
        bucket: 'bucket',
        endpoint: 'oss-cn-beijing',
        accessKeyId: 'ak-demo',
        accessKeySecret: 'secret-demo',
      },
    });

    assert.equal(result.ok, true);
    assert.match(capturedUrl, /^https:\/\/bucket\.oss-cn-beijing\.aliyuncs\.com\/\?location=/);
    assert.doesNotMatch(capturedUrl, /OSSAccessKeyId=/);
    assert.match(capturedAuth, /^OSS ak-demo:/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testCloudTargetConnectivity checks Baidu WebDAV by creating and deleting a probe file', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; auth: string }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({
      url: String(url),
      method: String(init?.method || 'GET'),
      auth: String(init?.headers?.Authorization || ''),
    });
    return new Response('', { status: init?.method === 'MKCOL' ? 201 : 200 });
  }) as any;
  try {
    const result = await testCloudTargetConnectivity({
      id: 'baidu-netdisk',
      provider: 'baidu-netdisk',
      label: '百度',
      baiduNetdisk: {
        webdavUrl: 'http://127.0.0.1:5244/dav/百度网盘',
        username: 'user',
        password: 'pass',
        folder: '/T8素材',
      },
    });

    assert.equal(result.ok, true);
    assert.ok(calls.some((call) => call.method === 'MKCOL' && call.url.includes('/T8%E7%B4%A0%E6%9D%90/')));
    assert.ok(calls.some((call) => call.method === 'PUT' && call.url.endsWith('/connection.txt')));
    assert.ok(calls.some((call) => call.method === 'DELETE'));
    assert.ok(calls.every((call) => call.auth === `Basic ${Buffer.from('user:pass').toString('base64')}`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uploadCloudAsset uploads files to Quark WebDAV target', async () => {
  const originalFetch = globalThis.fetch;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 't8-cloud-upload-'));
  const filePath = path.join(tempDir, 'demo.png');
  fs.writeFileSync(filePath, Buffer.from('png-data'));
  const calls: Array<{ url: string; method: string; auth: string; contentType: string }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    if (init?.body && typeof init.body.on === 'function') {
      await new Promise<void>((resolve, reject) => {
        init.body.on('end', resolve);
        init.body.on('error', reject);
        init.body.resume();
      });
    }
    calls.push({
      url: String(url),
      method: String(init?.method || 'GET'),
      auth: String(init?.headers?.Authorization || ''),
      contentType: String(init?.headers?.['Content-Type'] || ''),
    });
    return new Response('', { status: init?.method === 'MKCOL' ? 201 : 200 });
  }) as any;
  try {
    const result = await uploadCloudAsset({
      id: 'quark-netdisk',
      provider: 'quark-netdisk',
      label: '夸克',
      prefix: 'archive/{kind}/{yyyy-mm}',
      quarkNetdisk: {
        webdavUrl: 'http://127.0.0.1:5244/dav/quark',
        username: 'quark-user',
        password: 'quark-pass',
        folder: '/Canvas',
      },
    }, {
      url: filePath,
      kind: 'image',
      title: 'demo.png',
    });

    const put = calls.find((call) => call.method === 'PUT');
    assert.ok(put);
    assert.match(put!.url, /^http:\/\/127\.0\.0\.1:5244\/dav\/quark\/Canvas\/archive\/image\/\d{4}-\d{2}\/demo_\d+\.png$/);
    assert.equal(put!.auth, `Basic ${Buffer.from('quark-user:quark-pass').toString('base64')}`);
    assert.equal(put!.contentType, 'image/png');
    assert.equal(result.provider, 'quark-netdisk');
    assert.match(result.path, /^quark-netdisk:\/Canvas\/archive\/image\//);
    assert.match(result.url || '', /\/Canvas\/archive\/image\//);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
