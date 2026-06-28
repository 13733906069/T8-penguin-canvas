const express = require('express');
const router = express.Router();

// RunningHub 资源列表 API 配置
const RH_API_URL = 'https://www.runninghub.cn/api/resource/list';
const RH_USER_ID = '1886690989611085825';

const RH_HEADERS = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'authorization': 'Bearer null',
  'content-type': 'application/json',
  'origin': 'https://www.runninghub.cn',
  'referer': `https://www.runninghub.cn/user-center/${RH_USER_ID}`,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'user-language': 'zh_CN',
};

/**
 * 精简模型字段，减少传输量
 */
function slimItem(item) {
  return {
    id: item.id,
    resourceName: item.resourceName,
    resourceType: item.resourceType,
    thumbnailUrl: item.thumbnailUrl,
    posterUrl: item.posterUrl,
    version: item.version,
    imageSize: item.imageSize,
    createTime: item.createTime,
    owner: item.owner ? { name: item.owner.name } : null,
    // 顶层 desc（角色外观描述），空或 "1.0" 表示未填写具体外观
    desc: item.desc ?? null,
    versions: (item.versions || []).map((v) => ({
      id: v.id,
      version: v.version,
      versionResourceName: v.versionResourceName,
      resourceStorageName: v.resourceStorageName,
      baseModel: v.baseModel,
      triggerWords: v.triggerWords,
      desc: v.desc,
    })),
  };
}

/**
 * GET /api/guoman-models
 * 代理调用 RunningHub 资源列表 API，返回当前用户的国漫 LORA 模型
 * 查询参数：
 *   page - 页码（默认 1）
 *   size - 每页数量（默认 30）
 *   search - 搜索关键词（按 resourceName 过滤）
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const size = Math.min(60, Math.max(1, parseInt(req.query.size) || 30));
    const resourceName = (req.query.search || '').trim();

    const payload = {
      size,
      current: page,
      systemResource: false,
      resourceType: 'LORA',
      userId: RH_USER_ID,
      resourceName,
      reloadData: false,
      sort: '',
      communityOnly: true,
    };

    const response = await fetch(RH_API_URL, {
      method: 'POST',
      headers: RH_HEADERS,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `RunningHub API 返回 HTTP ${response.status}`,
      });
    }

    const data = await response.json();

    if (data.code !== 0) {
      return res.status(502).json({
        success: false,
        error: data.msg || 'RunningHub API 返回错误',
      });
    }

    // 调试：打印原始数据的第一个 item 的完整字段
    const rawRecords = data.data?.records || [];
    if (rawRecords.length > 0) {
      const sample = rawRecords[0];
      console.log('[guoman-models][DEBUG] 原始 item 字段:', Object.keys(sample).join(', '));
      console.log('[guoman-models][DEBUG] versions[0] 完整字段:', sample.versions?.[0] ? JSON.stringify(sample.versions[0], null, 2) : '无 versions');
    }
    const records = rawRecords.map(slimItem);
    const total = parseInt(data.data?.total) || 0;
    const totalPages = parseInt(data.data?.pages) || Math.ceil(total / size);

    res.json({
      success: true,
      data: { records, total, page, size, totalPages },
    });
  } catch (error) {
    const msg = error?.name === 'TimeoutError'
      ? '调用 RunningHub API 超时'
      : error?.message || '获取国漫模型失败';
    res.status(500).json({ success: false, error: msg });
  }
});

module.exports = router;
