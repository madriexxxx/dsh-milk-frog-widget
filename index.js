/**
 * dsh-milk-frog-widget —— 宿主半端
 * ============================================================================
 * 只做三件事：
 *   1) 只读路由 GET /dsh-milk-frog/balance：把余额（含赠金 / 充值拆分）交给浏览器半端；
 *   2) 余额来源：优先 DSH 凭据里的 DEEPSEEK_API_KEY，没配或失败时退回 DSH 的
 *      deepseekAccount 登录态（与鲸鱼挂件同一套取数口径，不自己拼 HTTP 鉴权）；
 *   3) 「今日已用」：按余额观测的下降额累计（充值等上升额不冲掉消费），
 *      账本落在 $DSH_HOME/milk-frog/ledger.json，跨重启保留。
 *
 * 路由只读、只认本机回环的 Host 与同源请求；不写配置、不碰凭据内容。
 * ============================================================================
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROUTE_PATH = '/dsh-milk-frog/balance'
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const CACHE_MS = 15 * 1000
const FETCH_TIMEOUT_MS = 9 * 1000
const PARTIAL_GAP_MS = 10 * 60 * 1000
const KEEP_DAYS = 30
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const LEDGER_FILE = path.join(DSH_HOME, 'milk-frog', 'ledger.json')

export const inject = ['webServer', 'credentials']

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const round8 = (n) => Math.round(n * 1e8) / 1e8
const errorText = (v) => String((v && v.message) || v || 'unknown')

function beijingDay(ms = Date.now()) {
  return new Date(Number(ms) + 8 * 3600000).toISOString().slice(0, 10)
}

/* ---------------------------------------------------------------- ledger -- */

function loadLedger() {
  try {
    const raw = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'))
    if (raw && raw.version === 1 && raw.books && typeof raw.books === 'object') return raw
  } catch (err) {}
  return { version: 1, books: {} }
}

function saveLedger(ledger) {
  try {
    const cutoff = beijingDay(Date.now() - KEEP_DAYS * 86400000)
    for (const book of Object.values(ledger.books)) {
      if (!book || !book.days) continue
      for (const day of Object.keys(book.days)) if (day < cutoff) delete book.days[day]
    }
    fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true })
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger), 'utf8')
  } catch (err) {
    warnOnce('记账文件写入失败（不影响余额显示）：' + errorText(err))
  }
}

let warnedOnce = false
function warnOnce(text) {
  if (warnedOnce) return
  warnedOnce = true
  try {
    console.warn('[milk-frog] ' + text)
  } catch (err) {}
}

function observe(ledger, observation, at) {
  const day = beijingDay(at)
  const bookKey = observation.source + ':' + observation.currency
  let book = ledger.books[bookKey]
  if (!book || typeof book !== 'object') book = ledger.books[bookKey] = { currency: observation.currency, days: {} }
  if (!book.days || typeof book.days !== 'object') book.days = {}
  const balance = round8(observation.balance)
  let row = book.days[day]
  if (!row || typeof row !== 'object') {
    row = book.days[day] = { firstAt: at, lastAt: at, opening: balance, last: balance, spent: 0 }
  } else if (at > Number(row.lastAt)) {
    const delta = round8(Number(row.last) - balance)
    // 余额下降 = 消费；上升 = 充值 / 赠金，不能冲掉已经记下的消费。
    if (delta > 0) row.spent = round8(Number(row.spent) + delta)
    row.last = balance
    row.lastAt = at
  }
  saveLedger(ledger)
  const start = Date.parse(day + 'T00:00:00+08:00')
  const leadingGap = Number.isFinite(start) ? Math.max(0, Number(row.firstAt) - start) : 0
  return {
    day,
    todaySpent: round8(Number(row.spent) || 0),
    observedFrom: Number(row.firstAt),
    todayPartial: leadingGap > PARTIAL_GAP_MS,
  }
}

/* --------------------------------------------------------------- balance -- */

async function readApiKeyBalance(ctx, errors) {
  let cred = null
  try {
    cred = await ctx.credentials.resolve('DEEPSEEK_API_KEY')
  } catch (err) {
    // 冷启动时凭据服务可能尚未就绪，与「确实没配置」区分开：短延迟重试一次。
    await new Promise((resolve) => setTimeout(resolve, 400))
    try {
      cred = await ctx.credentials.resolve('DEEPSEEK_API_KEY')
    } catch (err2) {
      errors.push('凭据读取失败：' + errorText(err2))
      return null
    }
  }
  if (!cred || !cred.value) {
    errors.push('未配置 DEEPSEEK_API_KEY')
    return null
  }
  let res
  try {
    res = await fetch(BALANCE_URL, {
      headers: { authorization: 'Bearer ' + cred.value, accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    errors.push('余额请求失败：' + errorText(err))
    return null
  }
  if (!res.ok) {
    errors.push('余额接口 HTTP ' + res.status)
    return null
  }
  let data = null
  try {
    data = await res.json()
  } catch (err) {
    errors.push('余额接口返回的不是 JSON')
    return null
  }
  const infos = data && Array.isArray(data.balance_infos) ? data.balance_infos : []
  if (!infos.length) {
    errors.push('余额接口没有返回币种信息')
    return null
  }
  const pick =
    infos.find((x) => x && String(x.currency).toUpperCase() === 'CNY' && num(x.total_balance) !== null) ||
    infos.find((x) => x && num(x.total_balance) !== null) ||
    infos[0]
  const total = num(pick && pick.total_balance)
  if (total === null) {
    errors.push('余额字段不可用')
    return null
  }
  return {
    ok: true,
    balance: total,
    granted: num(pick.granted_balance),
    toppedUp: num(pick.topped_up_balance),
    currency: String((pick && pick.currency) || 'CNY').toUpperCase(),
    source: 'api-key',
  }
}

async function readAccountBalance(ctx, errors) {
  let account = null
  try {
    account = typeof ctx.get === 'function' ? ctx.get('deepseekAccount') : null
  } catch (err) {
    account = null
  }
  if (!account || typeof account.getBalance !== 'function') {
    errors.push('当前 DSH 没有账号服务')
    return null
  }
  let result
  try {
    result = await account.getBalance({
      version: String(process.env.DSH_CLIENT_VERSION || process.env.DSH_VERSION || '') || 'unknown',
      locale: String(process.env.DSH_LOCALE || '') || 'zh_CN',
      timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    })
  } catch (err) {
    errors.push('账号余额接口失败：' + errorText(err))
    return null
  }
  if (!result) {
    errors.push('未登录 DeepSeek 账号')
    return null
  }
  if (result.status !== 'ready') {
    errors.push('账号余额未就绪（' + String(result.status || 'unknown') + '）')
    return null
  }
  const wallets = (list) => (Array.isArray(list) ? list : []).filter((w) => w && num(w.balance) !== null)
  const normal = wallets(result.value)
  const bonus = wallets(result.bonusWallets)
  const all = normal.concat(bonus)
  if (!all.length) {
    errors.push('账号没有可读的余额钱包')
    return null
  }
  const curOf = (w) => String((w && w.currency) || 'CNY').toUpperCase()
  const curPick =
    all.find((w) => curOf(w) === 'CNY' && Number(w.balance) > 0) ||
    all.find((w) => Number(w.balance) > 0) ||
    all.find((w) => curOf(w) === 'CNY') ||
    all[0]
  const currency = curOf(curPick)
  const sumOf = (list) =>
    round8(
      list
        .filter((w) => curOf(w) === currency && num(w.balance) !== null)
        .reduce((sum, w) => sum + Number(w.balance), 0),
    )
  const toppedUp = sumOf(normal)
  const granted = sumOf(bonus)
  return {
    ok: true,
    balance: round8(toppedUp + granted),
    granted,
    toppedUp,
    currency,
    source: 'account',
  }
}

/* ----------------------------------------------------------------- apply -- */

export function apply(ctx) {
  const ledger = loadLedger()
  let cache = null // { at, value }

  async function readBalance(force) {
    const now = Date.now()
    if (!force && cache && now - cache.at < CACHE_MS) return cache.value

    const errors = []
    let result = await readApiKeyBalance(ctx, errors)
    if (!result) result = await readAccountBalance(ctx, errors)

    if (!result) {
      if (cache) {
        return { ...cache.value, stale: true, error: errors.join('；') }
      }
      return { ok: false, error: errors.join('；') || '读取余额失败', updatedAt: now }
    }

    const observed = observe(ledger, result, now)
    const payload = { ok: true, ...result, ...observed, updatedAt: now }
    cache = { at: now, value: payload }
    return payload
  }

  function isTrusted(req) {
    try {
      const headers = (req && req.headers) || {}
      const host = String(headers.host || '')
      const hostUrl = new URL('http://' + host)
      const hostname = hostUrl.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
      const loopback =
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '::1' ||
        /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
      if (!loopback) return false
      if (String(headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false
      const origin = headers.origin
      if (typeof origin === 'string' && origin && origin !== 'null') {
        if (new URL(origin).host.toLowerCase() !== hostUrl.host.toLowerCase()) return false
      }
      return true
    } catch (err) {
      return false
    }
  }

  function sendJson(res, payload) {
    try {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(JSON.stringify(payload))
    } catch (err) {}
  }

  async function handler(req, res) {
    if (!isTrusted(req)) {
      try {
        res.statusCode = 403
        res.end()
      } catch (err) {}
      return
    }
    if (String((req && req.method) || 'GET').toUpperCase() !== 'GET') {
      try {
        res.statusCode = 405
        res.setHeader('allow', 'GET')
        res.end()
      } catch (err) {}
      return
    }
    const refresh = /[?&]refresh=1(?:&|$)/.test(String((req && req.url) || ''))
    try {
      sendJson(res, await readBalance(refresh))
    } catch (err) {
      sendJson(res, { ok: false, error: '读取余额失败：' + errorText(err), updatedAt: Date.now() })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: ROUTE_PATH, handler }))
}
