/**
 * 算力充值系统
 * 从 gpt-image-2-web 的充值协议迁移而来:
 * - 本地只保存绑定账号与订单状态
 * - 支付链接、查单、转额度都走 VPS agent
 * - 付款后本地通过主动轮询确认,避免依赖公网回调
 */
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');

const apiRouter = express.Router();
const payRouter = express.Router();

// Public repository default must stay empty. User builds must never ship a
// global agent HMAC; recharge now uses the public VPS order API.
const RECHARGE_DEFAULT_ENC = '';
const DEFAULT_PUBLIC_BASE_URL = 'https://pay.t8star.org';

const QUOTA_PER_POWER = 500000;
const POWER_TIERS = [20, 30, 50, 100, 200, 300, 500];
let rechargeConfigCache = null;
let deviceIdCache = null;

function nowText() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeRechargeConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(
    ['PUBLIC_BASE_URL', 'WEBSITE_URL']
      .map((key) => [key, String(cfg[key] || '').trim()])
      .filter(([, value]) => value)
  );
}

function loadPrivateRechargeConfig() {
  try {
    if (!fs.existsSync(config.RECHARGE_PRIVATE_FILE)) return {};
    return normalizeRechargeConfig(JSON.parse(fs.readFileSync(config.RECHARGE_PRIVATE_FILE, 'utf-8')));
  } catch (e) {
    console.warn('[recharge] load private config failed:', e?.message || e);
    return {};
  }
}

function loadRechargeConfig() {
  if (rechargeConfigCache) return rechargeConfigCache;
  const envOverrides = normalizeRechargeConfig({
    PUBLIC_BASE_URL: String(process.env.RECHARGE_PUBLIC_BASE_URL || '').trim(),
    WEBSITE_URL: String(process.env.RECHARGE_WEBSITE_URL || '').trim(),
  });
  const privateConfig = loadPrivateRechargeConfig();
  try {
    const magic = 'ZZENC1\n';
    if (!RECHARGE_DEFAULT_ENC.startsWith(magic)) {
      rechargeConfigCache = { PUBLIC_BASE_URL: DEFAULT_PUBLIC_BASE_URL, WEBSITE_URL: 'https://ai.t8star.org', ...privateConfig, ...envOverrides };
      return rechargeConfigCache;
    }
    const key = crypto.createHash('sha256').update('ZhenzhenAI-Studio-T8star-2026').digest();
    const payload = Buffer.from(RECHARGE_DEFAULT_ENC.slice(magic.length), 'base64');
    const decoded = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i += 1) decoded[i] = payload[i] ^ key[i % key.length];
    rechargeConfigCache = { PUBLIC_BASE_URL: DEFAULT_PUBLIC_BASE_URL, WEBSITE_URL: 'https://ai.t8star.org', ...normalizeRechargeConfig(JSON.parse(decoded.toString('utf-8'))), ...privateConfig, ...envOverrides };
  } catch (e) {
    console.warn('[recharge] load config failed:', e?.message || e);
    rechargeConfigCache = { PUBLIC_BASE_URL: DEFAULT_PUBLIC_BASE_URL, WEBSITE_URL: 'https://ai.t8star.org', ...privateConfig, ...envOverrides };
  }
  return rechargeConfigCache;
}

function ensureDataDir() {
  if (!fs.existsSync(config.DATA_DIR)) fs.mkdirSync(config.DATA_DIR, { recursive: true });
}

function defaultStore() {
  return { binding: null, orders: [] };
}

function loadStore() {
  ensureDataDir();
  if (!fs.existsSync(config.RECHARGE_FILE)) return defaultStore();
  try {
    const data = JSON.parse(fs.readFileSync(config.RECHARGE_FILE, 'utf-8'));
    return {
      binding: data?.binding || null,
      orders: Array.isArray(data?.orders) ? data.orders : [],
    };
  } catch (e) {
    console.warn('[recharge] load store failed:', e?.message || e);
    return defaultStore();
  }
}

function saveStore(store) {
  ensureDataDir();
  const next = {
    binding: store?.binding || null,
    orders: Array.isArray(store?.orders) ? store.orders : [],
  };
  const tmp = `${config.RECHARGE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8');
  fs.renameSync(tmp, config.RECHARGE_FILE);
}

function getPlans() {
  const testPlan = {
    id: 'test_1cny',
    power: 1,
    price: 1.0,
    quota: QUOTA_PER_POWER,
    name: '测试1CP-1.00CNY',
    test: true,
  };
  return [
    testPlan,
    ...POWER_TIERS.map((power) => {
      const price = Number((power * 1.35).toFixed(2));
      return {
        id: `cp_${power}`,
        power,
        price,
        quota: power * QUOTA_PER_POWER,
        name: `${power}CP-${price.toFixed(2)}CNY`,
      };
    }),
  ];
}

function genOrderId() {
  return `L${Date.now()}${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

function getDeviceId() {
  if (deviceIdCache) return deviceIdCache;
  ensureDataDir();
  try {
    if (fs.existsSync(config.RECHARGE_DEVICE_FILE)) {
      const existing = fs.readFileSync(config.RECHARGE_DEVICE_FILE, 'utf-8').trim();
      if (existing && existing.length <= 128) {
        deviceIdCache = existing;
        return deviceIdCache;
      }
    }
    const seed = `${Date.now()}-${process.cwd()}-${crypto.randomBytes(16).toString('hex')}`;
    const id = crypto.createHash('sha256').update(seed).digest('hex');
    fs.writeFileSync(config.RECHARGE_DEVICE_FILE, id, 'utf-8');
    deviceIdCache = id;
    return deviceIdCache;
  } catch (e) {
    console.warn('[recharge] device id failed:', e?.message || e);
    return 'unknown-device';
  }
}

async function publicCall(method, publicPath, body, timeout = 20000) {
  const cfg = loadRechargeConfig();
  const base = String(cfg.PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL).replace(/\/+$/, '');
  if (!base) return { success: false, message: 'public recharge server not configured' };
  if (typeof fetch !== 'function') return { success: false, message: 'fetch is not available in this Node runtime' };

  const upper = method.toUpperCase();
  const bodyText = body == null ? '' : JSON.stringify(body);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(`${base}${publicPath}`, {
      method: upper,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'T8-PenguinCanvas/1.0',
      },
      body: upper === 'GET' ? undefined : bodyText,
      signal: ac.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { success: false, message: `non-json response: ${text.slice(0, 200)}` };
    }
    if (!res.ok) {
      return { ...json, success: false, http_status: res.status, message: json?.message || `HTTP ${res.status}` };
    }
    return json;
  } catch (e) {
    return { success: false, message: e?.name === 'AbortError' ? 'agent call timeout' : `agent call error: ${e?.message || e}` };
  } finally {
    clearTimeout(timer);
  }
}

async function createPublicOrder(order, plan, payType) {
  const payload = {
    website_user_id: Number(order.website_user_id),
    plan_id: plan.id,
    pay_type: payType,
    client_app: 't8-penguin-canvas',
    device_id: getDeviceId(),
  };
  const r = await publicCall('POST', '/public/recharge/orders', payload, 20000);
  if (r?.success && r?.pay_url && r?.order_id && r?.order_token) return r;
  console.warn('[recharge] create public order failed:', r);
  return null;
}

async function queryPublicOrder(order) {
  if (!order?.order_token) return { success: false, message: 'missing order token' };
  const q = new URLSearchParams({ token: String(order.order_token) });
  return publicCall('GET', `/public/recharge/orders/${encodeURIComponent(order.order_id)}?${q}`, null, 20000);
}

async function retryPublicOrder(order) {
  if (!order?.order_token) return { success: false, message: 'missing order token' };
  return publicCall('POST', `/public/recharge/orders/${encodeURIComponent(order.order_id)}/retry`, {
    token: order.order_token,
  }, 30000);
}

function orderPublic(order, extra = {}) {
  return {
    success: true,
    status: order.status,
    order_id: order.order_id,
    plan_name: order.plan_name,
    amount: order.amount,
    quota: order.quota,
    power: order.power,
    pay_time: order.pay_time || '',
    transfer_message: extra.transfer_message || order.transfer_message || '',
  };
}

function orderSummary(order) {
  return {
    order_id: order.order_id,
    website_user_id: order.website_user_id,
    plan_id: order.plan_id,
    plan_name: order.plan_name,
    power: order.power,
    amount: order.amount,
    quota: order.quota,
    pay_type: order.pay_type,
    status: order.status,
    create_time: order.create_time || '',
    pay_time: order.pay_time || '',
    transfer_message: order.transfer_message || '',
  };
}

function asyncRoute(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    console.error('[recharge] route error:', e);
    res.status(500).json({ success: false, message: e?.message || String(e) });
  });
}

apiRouter.get('/binding', (_req, res) => {
  const store = loadStore();
  if (!store.binding) return res.json({ bound: false });
  res.json({ bound: true, website_user_id: store.binding.website_user_id, bind_time: store.binding.bind_time });
});

apiRouter.post('/binding', (req, res) => {
  const userId = Number(req.body?.website_user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: 'User ID must be a positive integer' });
  }
  const store = loadStore();
  store.binding = { website_user_id: userId, bind_time: nowText() };
  saveStore(store);
  res.json({ success: true, website_user_id: userId });
});

apiRouter.delete('/binding', (_req, res) => {
  const store = loadStore();
  store.binding = null;
  saveStore(store);
  res.json({ success: true });
});

apiRouter.get('/plans', (_req, res) => {
  res.json(getPlans());
});

apiRouter.get('/config', (_req, res) => {
  const cfg = loadRechargeConfig();
  res.json({
    website_url: cfg.WEBSITE_URL || 'https://ai.t8star.org',
    agent_base_url: cfg.PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL,
    configured: !!(cfg.PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL),
    device_id: `${getDeviceId().slice(0, 16)}...`,
  });
});

apiRouter.post('/order/create', asyncRoute(async (req, res) => {
  const planId = String(req.body?.plan_id || '');
  const payType = String(req.body?.pay_type || 'alipay');
  if (!['alipay', 'wxpay'].includes(payType)) {
    return res.status(400).json({ success: false, message: 'Pay type must be alipay or wxpay' });
  }
  const plan = getPlans().find((p) => p.id === planId);
  if (!plan) return res.status(400).json({ success: false, message: 'Invalid plan ID' });

  const store = loadStore();
  if (!store.binding) {
    return res.status(400).json({ success: false, message: 'Please bind Website User ID first' });
  }

  const order = {
    order_id: '',
    order_token: '',
    website_user_id: store.binding.website_user_id,
    plan_id: plan.id,
    plan_name: plan.name,
    power: plan.power,
    amount: plan.price,
    quota: plan.quota,
    pay_type: payType,
    status: 'pending',
    trade_no: '',
    create_time: nowText(),
    pay_time: '',
    transfer_message: '',
  };
  const created = await createPublicOrder(order, plan, payType);
  if (!created) {
    return res.status(502).json({ success: false, message: 'Failed to generate payment link' });
  }
  order.order_id = String(created.order_id);
  order.order_token = String(created.order_token);
  order.plan_id = String(created.plan_id || plan.id);
  order.plan_name = String(created.plan_name || plan.name);
  order.power = Number(created.power || plan.power);
  order.amount = Number(created.amount || plan.price);
  order.quota = Number(created.quota || plan.quota);

  store.orders.unshift(order);
  saveStore(store);

  res.json({
    success: true,
    order_id: order.order_id,
    pay_url: created.pay_url,
    amount: order.amount,
    power: order.power,
    quota: order.quota,
    plan_name: order.plan_name,
    pay_type: payType,
  });
}));

apiRouter.get('/order/:orderId', (req, res) => {
  const store = loadStore();
  const order = store.orders.find((o) => o.order_id === req.params.orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, order: orderSummary(order) });
});

apiRouter.get('/order/:orderId/check', asyncRoute(async (req, res) => {
  const orderId = String(req.params.orderId || '');
  let store = loadStore();
  let order = store.orders.find((o) => o.order_id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (['success', 'transfer_failed', 'transferring'].includes(order.status)) {
    return res.json(orderPublic(order, {
      transfer_message: order.status === 'transferring' ? '正在处理中，请稍候' : order.transfer_message,
    }));
  }
  const query = await queryPublicOrder(order);
  if (!query?.success) return res.json(orderPublic(order, { transfer_message: query?.message || '' }));

  store = loadStore();
  order = store.orders.find((o) => o.order_id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  order.status = query.status || order.status;
  order.pay_time = query.pay_time || order.pay_time || '';
  order.transfer_message = query.transfer_message || '';
  saveStore(store);
  res.json(orderPublic(order));
}));

apiRouter.post('/order/:orderId/retry', asyncRoute(async (req, res) => {
  const orderId = String(req.params.orderId || '');
  let store = loadStore();
  let order = store.orders.find((o) => o.order_id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.status !== 'transfer_failed') {
    return res.status(400).json({ success: false, message: `Only transfer_failed orders can retry (current: ${order.status})` });
  }
  const retry = await retryPublicOrder(order);
  if (!retry?.success) {
    return res.status(502).json({ success: false, message: retry?.message || 'retry failed' });
  }
  store = loadStore();
  order = store.orders.find((o) => o.order_id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  order.status = retry.status || order.status;
  order.pay_time = retry.pay_time || order.pay_time || '';
  order.transfer_message = retry.transfer_message || '';
  saveStore(store);
  res.json(orderPublic(order));
}));

apiRouter.get('/orders', (req, res) => {
  const n = Number(req.query?.limit || 20);
  const limit = Number.isFinite(n) ? Math.max(1, Math.min(100, Math.floor(n))) : 20;
  const store = loadStore();
  res.json(store.orders.slice(0, limit).map(orderSummary));
});

async function processNotify(params, res) {
  console.warn('[recharge] local pay notify ignored; public VPS handles payment callbacks', params?.out_trade_no || '');
  res.status(200).send('fail');
}

payRouter.post('/notify', asyncRoute(async (req, res) => {
  await processNotify(req.body || {}, res);
}));

payRouter.get('/notify', asyncRoute(async (req, res) => {
  await processNotify(req.query || {}, res);
}));

payRouter.get('/return', (req, res) => {
  const orderId = String(req.query?.out_trade_no || '');
  res.redirect(`/?paid_order=${encodeURIComponent(orderId)}`);
});

module.exports = { apiRouter, payRouter };
