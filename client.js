/**
 * dsh-milk-frog-widget —— 浏览器半端
 * ============================================================================
 * 常驻角落的奶蛙：
 *   · 不点的时候：小只、板着一张严肃脸；
 *   · 点一下：奶蛙大笑（笑眼 + 张嘴 + 腮红 + 小星星），头顶弹出钱包面板 ——
 *     余额、赠金、充值余额、今日已用；
 *   · 再点一下（或点别处 / Esc）：收起，奶蛙恢复严肃脸。
 * 奶蛙可以按住拖动，位置记在 localStorage 里。
 *
 * 数据来自宿主半端的只读路由 GET /dsh-milk-frog/balance。
 * ============================================================================
 */
window.__ModuleLoader__.load({
  id: 'dsh-milk-frog-widget',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'milk-frog'
    const ENDPOINT = '/dsh-milk-frog/balance'
    const POS_KEY = 'dsh-milk-frog:position'
    const POLL_MS = 60000

    /* ------------------------------------------------------------- 文案 -- */

    const ZH = {
      brand: '奶蛙',
      panelTitle: '奶蛙的钱包',
      expand: '点我笑一个',
      collapse: '收起钱包',
      close: '收起',
      balance: '余额',
      today: '今日已用',
      bonus: '赠金',
      topup: '充值余额',
      updatedAt: '更新于 {time}',
      staleAt: '上次读数 · {time}',
      loading: '奶蛙去看了…',
      refresh: '刷新',
      refreshing: '刷新中',
      retry: '重试',
      error: '读不到余额',
      hint: '去「设置 → 模型」配上 DeepSeek API Key，或登录 DeepSeek 账号后再试。',
      sourceApi: 'API Key',
      sourceAccount: '账号登录',
      partial: '今日已用从 {time} 起观测，之前的消费没算进来。',
      staleNote: '接口这会儿读不到，先显示上一次的读数。',
      empty: '今天还没有读数。',
    }

    const EN = {
      brand: 'Milk Frog',
      panelTitle: "Frog's wallet",
      expand: 'Tap to make me laugh',
      collapse: 'Collapse wallet',
      close: 'Collapse',
      balance: 'Balance',
      today: 'Spent today',
      bonus: 'Bonus',
      topup: 'Topped up',
      updatedAt: 'Updated {time}',
      staleAt: 'Last reading · {time}',
      loading: 'Checking…',
      refresh: 'Refresh',
      refreshing: 'Refreshing',
      retry: 'Retry',
      error: 'Balance unavailable',
      hint: 'Add a DeepSeek API key in Settings → Models, or sign in to your DeepSeek account, then try again.',
      sourceApi: 'API key',
      sourceAccount: 'Account',
      partial: 'Observed since {time}; earlier spending is not counted.',
      staleNote: 'The API is unreachable right now, showing the last reading.',
      empty: 'No reading yet today.',
    }

    /* ------------------------------------------------------------- 样式 -- */

    const CSS = `
.mf-root{position:fixed;z-index:80;display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none;font-family:var(--dsw-font-family,system-ui,-apple-system,"Segoe UI",sans-serif);color:var(--dsw-alias-label-primary);}
.mf-panel{pointer-events:auto;box-sizing:border-box;width:252px;padding:12px 14px 11px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,#d8d8d8);background:var(--dsw-alias-bg-overlay,#fff);box-shadow:0 14px 32px rgba(20,40,25,.18);animation:mf-panel-in .18s ease-out;position:relative;}
.mf-panel:after{content:"";position:absolute;right:27px;bottom:-6px;width:10px;height:10px;background:var(--dsw-alias-bg-overlay,#fff);border-right:1px solid var(--dsw-alias-border-l1,#d8d8d8);border-bottom:1px solid var(--dsw-alias-border-l1,#d8d8d8);transform:rotate(45deg);}
@keyframes mf-panel-in{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
.mf-head{display:flex;align-items:center;gap:7px;font-size:11.5px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);}
.mf-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary,#9aa);}
.mf-dot[data-state=ok]{background:var(--dsw-alias-state-success-primary,#2fa36b)}
.mf-dot[data-state=warn]{background:var(--dsw-alias-state-warn-primary,#d79a26)}
.mf-dot[data-state=err]{background:var(--dsw-alias-state-error-primary,#d0453b)}
.mf-close{margin-left:auto;width:20px;height:20px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:1;cursor:pointer;padding:0;}
.mf-close:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.06))}
.mf-amount{display:flex;align-items:baseline;gap:3px;margin-top:6px;}
.mf-sym{font-size:14px;opacity:.75}
.mf-amount b{font-size:27px;font-weight:650;letter-spacing:-.6px;line-height:1.15;font-variant-numeric:tabular-nums;}
.mf-src{margin-left:auto;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#d8d8d8);color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.mf-sub{font-size:10.5px;color:var(--dsw-alias-label-secondary);margin-top:2px;line-height:1.4}
.mf-rows{margin-top:10px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l1,#d8d8d8);display:flex;flex-direction:column;gap:6px;}
.mf-row{display:flex;align-items:center;gap:8px;font-size:12px;}
.mf-row>span{color:var(--dsw-alias-label-secondary)}
.mf-row b{margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums;}
.mf-note{font-size:10px;color:var(--dsw-alias-label-secondary);margin-top:6px;line-height:1.45}
.mf-foot{display:flex;align-items:center;gap:8px;margin-top:10px}
.mf-btn{margin-left:auto;padding:3px 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1,#d8d8d8);background:transparent;color:var(--dsw-alias-label-primary);font-size:11.5px;cursor:pointer;}
.mf-btn:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.06))}
.mf-btn[disabled]{opacity:.55;cursor:default}
.mf-err{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);margin-top:8px;word-break:break-word}
.mf-frog{pointer-events:auto;width:82px;height:82px;padding:0;border:0;background:transparent;cursor:grab;transition:transform .18s ease;filter:drop-shadow(0 7px 12px rgba(24,52,28,.22));touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;}
.mf-frog[data-drag="1"]{cursor:grabbing;transform:scale(1.03)}
.mf-frog[data-laugh="1"] .mf-laugh{animation:mf-laugh .55s ease-in-out 1}
@keyframes mf-laugh{0%,100%{transform:translateY(0) rotate(0)}22%{transform:translateY(-3.5px) rotate(-2.2deg)}52%{transform:translateY(-1px) rotate(1.8deg)}78%{transform:translateY(-2px) rotate(-.8deg)}}
.mf-frog:hover{transform:translateY(-2px)}
.mf-frog:active{transform:scale(.97)}
.mf-frog svg{display:block;width:100%;height:100%;overflow:visible}
.mf-bob{animation:mf-bob 4.8s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 90%;}
.mf-laugh{transform-box:fill-box;transform-origin:50% 85%}
@keyframes mf-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2.2px) rotate(-.7deg)}}
@media (prefers-reduced-motion: reduce){.mf-bob{animation:none}.mf-laugh{animation:none}.mf-panel{animation:none}.mf-frog{transition:none}}
`

    /* ------------------------------------------------------------- 工具 -- */

    function moneyText(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      try {
        return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      } catch (err) {
        return n.toFixed(2)
      }
    }

    function symbolOf(currency) {
      const code = String(currency || '').toUpperCase()
      if (code === 'CNY' || code === 'RMB') return '¥'
      if (code === 'USD') return '$'
      return code ? code + ' ' : ''
    }

    function timeText(ms) {
      const n = Number(ms)
      if (!Number.isFinite(n)) return '--:--'
      try {
        return new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } catch (err) {
        return '--:--'
      }
    }

    function clampPosition(position) {
      const vw = (typeof window !== 'undefined' && window.innerWidth) || 1200
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 900
      const clamp = (v, min, max) => Math.min(Math.max(min, Number(v) || 0), max)
      return {
        right: clamp(position && position.right, 6, Math.max(6, vw - 112)),
        bottom: clamp(position && position.bottom, 6, Math.max(6, vh - 142)),
      }
    }

    function defaultPosition() {
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 900
      // 默认落在右下角、让小鲸鱼露出来：比鲸鱼高一截。
      return { right: 20, bottom: Math.max(96, Math.min(244, vh - 330)) }
    }

    function readPosition() {
      try {
        const raw = JSON.parse((typeof window !== 'undefined' && window.localStorage.getItem(POS_KEY)) || 'null')
        if (raw && Number.isFinite(Number(raw.right)) && Number.isFinite(Number(raw.bottom))) {
          return clampPosition(raw)
        }
      } catch (err) {}
      return defaultPosition()
    }

    function savePosition(position) {
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(position))
      } catch (err) {}
    }

    /* ------------------------------------------------------------- 文案钩子 */

    function useTranslate(ctx) {
      const locale = typeof ctx.get === 'function' ? ctx.get('locale') : null
      const [, bump] = React.useReducer((n) => n + 1, 0)
      React.useEffect(() => {
        if (!locale || typeof locale.subscribe !== 'function') return undefined
        return locale.subscribe(() => bump())
      }, [locale])
      let active = ''
      let bound = null
      try {
        if (locale && typeof locale.getSnapshot === 'function') active = String(locale.getSnapshot().active || '')
        if (locale && typeof locale.bind === 'function') bound = locale.bind(NS)
      } catch (err) {}
      const dict = !active || active.toLowerCase().indexOf('zh') === 0 ? ZH : EN
      return (key, vars) => {
        let text = ''
        if (bound) {
          try {
            const value = bound(key)
            if (value && value !== key) text = value
          } catch (err) {}
        }
        if (!text) text = dict[key] || ZH[key] || key
        if (vars) {
          for (const name of Object.keys(vars)) text = text.split('{' + name + '}').join(String(vars[name]))
        }
        return text
      }
    }

    /* ------------------------------------------------------------- 奶蛙 -- */

    const LAUGH_MOUTH = 'M45 77 Q60 79.5 75 77 Q73.5 95 60 97 Q46.5 95 45 77 Z'

    function Star(props) {
      const x = props.x
      const y = props.y
      const r = props.r
      const s = r * 0.26
      return h('path', {
        d:
          'M' + x + ' ' + (y - r) +
          ' L' + (x + s) + ' ' + (y - s) +
          ' L' + (x + r) + ' ' + y +
          ' L' + (x + s) + ' ' + (y + s) +
          ' L' + x + ' ' + (y + r) +
          ' L' + (x - s) + ' ' + (y + s) +
          ' L' + (x - r) + ' ' + y +
          ' L' + (x - s) + ' ' + (y - s) + ' Z',
        fill: '#ffd25e',
        opacity: 0.95,
      })
    }

    function Eye(props) {
      const cx = props.cx
      if (props.laughing) {
        // 大笑：眼睛笑成两道弯弯的缝。
        return h('path', {
          d: 'M' + (cx - 9.5) + ' 40.5 Q' + cx + ' 30.5 ' + (cx + 9.5) + ' 40.5',
          fill: 'none',
          stroke: '#31402e',
          strokeWidth: 2.9,
          strokeLinecap: 'round',
        })
      }
      return h(
        'g',
        null,
        h('path', {
          d: 'M' + (cx - 11) + ' 38 Q' + cx + ' 29 ' + (cx + 11) + ' 38 Q' + cx + ' 45 ' + (cx - 11) + ' 38 Z',
          fill: '#ffffff',
          stroke: '#7fbe79',
          strokeWidth: 1,
        }),
        h('circle', { cx: cx, cy: 38.4, r: 3.6, fill: '#31402e' }),
        h('path', {
          d: 'M' + (cx - 11) + ' 38 Q' + cx + ' 29 ' + (cx + 11) + ' 38',
          fill: 'none',
          stroke: '#3e6b45',
          strokeWidth: 2.1,
          strokeLinecap: 'round',
        }),
      )
    }

    function Frog(props) {
      const laughing = !!props.laughing
      const blush = laughing ? 0.72 : 0.38
      return h(
        'svg',
        { viewBox: '0 0 120 120', 'aria-hidden': 'true', focusable: 'false' },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'mf-skin-grad', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0%', stopColor: '#d7f2cc' }),
            h('stop', { offset: '100%', stopColor: '#9bd58f' }),
          ),
          h('clipPath', { id: 'mf-mouth-clip' }, h('path', { d: LAUGH_MOUTH })),
        ),
        h('ellipse', { cx: 60, cy: 113, rx: 26, ry: 5, fill: 'rgba(31,61,40,.16)' }),
        h('g', { className: 'mf-bob' },
          h('g', { className: laughing ? 'mf-laugh' : undefined },
            h('ellipse', { cx: 36, cy: 108, rx: 10, ry: 5, fill: '#8ecb86' }),
            h('ellipse', { cx: 84, cy: 108, rx: 10, ry: 5, fill: '#8ecb86' }),
            h('ellipse', { cx: 60, cy: 101, rx: 29, ry: 14, fill: '#a7db9b' }),
            h('ellipse', { cx: 28, cy: 96, rx: 8, ry: 5.5, fill: '#9cd490' }),
            h('ellipse', { cx: 92, cy: 96, rx: 8, ry: 5.5, fill: '#9cd490' }),
            h('circle', { cx: 32, cy: 37, r: 17, fill: 'url(#mf-skin-grad)', stroke: '#7fbe79', strokeWidth: 1.2 }),
            h('circle', { cx: 88, cy: 37, r: 17, fill: 'url(#mf-skin-grad)', stroke: '#7fbe79', strokeWidth: 1.2 }),
            h('path', {
              d: 'M60 21 C83 21 99 41 99 67 C99 93 81 107 60 107 C39 107 21 93 21 67 C21 41 37 21 60 21 Z',
              fill: 'url(#mf-skin-grad)',
              stroke: '#7fbe79',
              strokeWidth: 1.2,
            }),
            h('ellipse', { cx: 30, cy: 78, rx: 8, ry: 5, fill: '#f2a2b4', opacity: blush }),
            h('ellipse', { cx: 90, cy: 78, rx: 8, ry: 5, fill: '#f2a2b4', opacity: blush }),
            h(Eye, { cx: 32, laughing: laughing }),
            h(Eye, { cx: 88, laughing: laughing }),
            h('circle', { cx: 55, cy: 73.5, r: 1.1, fill: '#6fae6b', opacity: 0.7 }),
            h('circle', { cx: 65, cy: 73.5, r: 1.1, fill: '#6fae6b', opacity: 0.7 }),
            laughing
              ? h(
                  'g',
                  null,
                  h('path', { d: LAUGH_MOUTH, fill: '#4a2f2a' }),
                  h(
                    'g',
                    { clipPath: 'url(#mf-mouth-clip)' },
                    h('ellipse', { cx: 60, cy: 94.5, rx: 11, ry: 5.6, fill: '#ef8fa2' }),
                    h('path', { d: 'M47 77.6 Q60 80.6 73 77.6 L72.2 82 Q60 85 47.8 82 Z', fill: '#fffdf4' }),
                  ),
                  h('path', {
                    d: LAUGH_MOUTH,
                    fill: 'none',
                    stroke: '#3e6b45',
                    strokeWidth: 1.4,
                    strokeLinejoin: 'round',
                  }),
                )
              : h('path', {
                  d: 'M50 85 Q60 86 70 85',
                  fill: 'none',
                  stroke: '#3e6b45',
                  strokeWidth: 2.6,
                  strokeLinecap: 'round',
                }),
            h('path', {
              d: 'M60 5 C63.5 10.4 66.2 13.7 66.2 16.8 C66.2 20.2 63.4 22.6 60 22.6 C56.6 22.6 53.8 20.2 53.8 16.8 C53.8 13.7 56.5 10.4 60 5 Z',
              fill: '#fffdf3',
              stroke: '#8fc98b',
              strokeWidth: 1.4,
            }),
            laughing ? h(Star, { x: 11, y: 30, r: 5 }) : null,
            laughing ? h(Star, { x: 109, y: 47, r: 4 }) : null,
            laughing ? h(Star, { x: 13, y: 55, r: 2.8 }) : null,
          ),
        ),
      )
    }

    /* ------------------------------------------------------------- 挂件 -- */

    function useBalanceFeed() {
      const [state, setState] = React.useState({ data: null, error: '', loading: true, refreshing: false })
      const alive = React.useRef(true)
      const inflight = React.useRef(false)
      React.useEffect(() => {
        return () => {
          alive.current = false
        }
      }, [])
      const load = React.useCallback(async (force) => {
        if (inflight.current) return
        inflight.current = true
        setState((prev) => ({ ...prev, loading: !prev.data, refreshing: !!force }))
        try {
          const response = await fetch(ENDPOINT + (force ? '?refresh=1' : ''), {
            headers: { accept: 'application/json' },
            credentials: 'same-origin',
          })
          if (!response.ok) throw new Error('HTTP ' + response.status)
          const data = await response.json()
          if (!alive.current) return
          setState({ data: data, error: '', loading: false, refreshing: false })
        } catch (err) {
          if (!alive.current) return
          setState((prev) => ({
            ...prev,
            error: String((err && err.message) || err || 'request failed'),
            loading: false,
            refreshing: false,
          }))
        } finally {
          inflight.current = false
        }
      }, [])
      return { state, load }
    }

    function MilkFrog(props) {
      const ctx = props.ctx
      const t = useTranslate(ctx)
      const [opened, setOpened] = React.useState(false)
      const [dragging, setDragging] = React.useState(false)
      const [position, setPosition] = React.useState(readPosition)
      const positionRef = React.useRef(position)
      const rootRef = React.useRef(null)
      const dragRef = React.useRef(null)
      const suppressClick = React.useRef(false)
      const { state, load } = useBalanceFeed()

      React.useEffect(() => {
        positionRef.current = position
      }, [position])

      React.useEffect(() => {
        load(false)
      }, [load])

      React.useEffect(() => {
        if (!opened) return undefined
        load(false)
        const timer = setInterval(() => load(false), POLL_MS)
        return () => clearInterval(timer)
      }, [opened, load])

      React.useEffect(() => {
        if (!opened) return undefined
        const onPointerDown = (event) => {
          if (rootRef.current && rootRef.current.contains(event.target)) return
          setOpened(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpened(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [opened])

      function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return
        dragRef.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          right: position.right,
          bottom: position.bottom,
          moved: false,
        }
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch (err) {}
      }

      function onPointerMove(event) {
        const drag = dragRef.current
        if (!drag || (drag.id !== undefined && event.pointerId !== drag.id)) return
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        if (!drag.moved && Math.hypot(dx, dy) < 6) return
        drag.moved = true
        setDragging(true)
        const next = clampPosition({ right: drag.right - dx, bottom: drag.bottom - dy })
        positionRef.current = next
        setPosition(next)
      }

      function finishDrag() {
        const drag = dragRef.current
        if (!drag) return
        dragRef.current = null
        setDragging(false)
        if (drag.moved) {
          suppressClick.current = true
          savePosition(positionRef.current)
        }
      }

      function onPointerUp() {
        finishDrag()
      }

      function onPointerCancel() {
        finishDrag()
      }

      function onClick() {
        if (suppressClick.current) {
          suppressClick.current = false
          return
        }
        setOpened((value) => !value)
      }

      const data = state.data
      const ok = !!(data && data.ok)
      const stale = !!(data && data.stale)
      const dotState = !data ? (state.error ? 'err' : 'idle') : !data.ok ? 'err' : stale ? 'warn' : 'ok'
      const currency = (data && data.currency) || 'CNY'
      const symbol = symbolOf(currency)
      const amountText = (value) => (Number.isFinite(Number(value)) ? symbol + moneyText(value) : '—')
      const sourceLabel = data && data.source === 'account' ? t('sourceAccount') : t('sourceApi')
      const updatedAt = data && typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()

      const panel = opened
        ? h(
            'div',
            { className: 'mf-panel', role: 'dialog', 'aria-label': t('panelTitle') },
            h(
              'div',
              { className: 'mf-head' },
              h('span', { className: 'mf-dot', 'data-state': dotState, 'aria-hidden': 'true' }),
              h('span', null, t('panelTitle')),
              h(
                'button',
                { className: 'mf-close', type: 'button', onClick: () => setOpened(false), 'aria-label': t('close') },
                '×',
              ),
            ),
            state.loading && !data
              ? h('div', { className: 'mf-err' }, t('loading'))
              : ok
              ? h(
                  React.Fragment,
                  null,
                  h(
                    'div',
                    { className: 'mf-amount' },
                    h('span', { className: 'mf-sym' }, symbol),
                    h('b', null, moneyText(data.balance)),
                    h('span', { className: 'mf-src' }, sourceLabel),
                  ),
                  h('div', { className: 'mf-sub' }, t(stale ? 'staleAt' : 'updatedAt', { time: timeText(updatedAt) })),
                  h(
                    'div',
                    { className: 'mf-rows' },
                    h(
                      'div',
                      { className: 'mf-row' },
                      h('span', null, t('today')),
                      h('b', null, amountText(data.todaySpent)),
                    ),
                    data.granted !== null && data.granted !== undefined
                      ? h(
                          'div',
                          { className: 'mf-row' },
                          h('span', null, t('bonus')),
                          h('b', null, amountText(data.granted)),
                        )
                      : null,
                    data.toppedUp !== null && data.toppedUp !== undefined
                      ? h(
                          'div',
                          { className: 'mf-row' },
                          h('span', null, t('topup')),
                          h('b', null, amountText(data.toppedUp)),
                        )
                      : null,
                  ),
                  data.todayPartial && data.observedFrom
                    ? h('div', { className: 'mf-note' }, t('partial', { time: timeText(data.observedFrom) }))
                    : null,
                  stale
                    ? h('div', { className: 'mf-note' }, t('staleNote'))
                    : state.error
                    ? h('div', { className: 'mf-note' }, state.error)
                    : null,
                )
              : h(
                  React.Fragment,
                  null,
                  h('div', { className: 'mf-err' }, (data && data.error) || state.error || t('error')),
                  h('div', { className: 'mf-note' }, t('hint')),
                ),
            h(
              'div',
              { className: 'mf-foot' },
              h(
                'button',
                {
                  className: 'mf-btn',
                  type: 'button',
                  disabled: !!state.refreshing,
                  onClick: () => load(true),
                },
                state.refreshing ? t('refreshing') : t('refresh'),
              ),
            ),
          )
        : null

      return h(
        'div',
        {
          ref: rootRef,
          className: 'mf-root',
          style: { right: position.right + 'px', bottom: position.bottom + 'px' },
        },
        h('style', null, CSS),
        panel,
        h(
          'button',
          {
            type: 'button',
            className: 'mf-frog',
            'data-laugh': opened ? '1' : '0',
            'data-drag': dragging ? '1' : undefined,
            title: opened ? t('collapse') : t('expand'),
            'aria-label': opened ? t('collapse') : t('expand'),
            'aria-expanded': opened,
            onPointerDown: onPointerDown,
            onPointerMove: onPointerMove,
            onPointerUp: onPointerUp,
            onPointerCancel: onPointerCancel,
            onClick: onClick,
          },
          h(Frog, { laughing: opened }),
        ),
      )
    }

    /* ------------------------------------------------------------- apply -- */

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : null
        if (locale && typeof locale.register === 'function') {
          ctx.effect(() => {
            const disposers = []
            const pairs = [
              ['zh', ZH],
              ['zh-CN', ZH],
              ['en', EN],
              ['en-US', EN],
            ]
            for (const pair of pairs) {
              try {
                disposers.push(locale.register(NS, pair[0], pair[1]))
              } catch (err) {}
            }
            return () => {
              for (const dispose of disposers) {
                try {
                  dispose()
                } catch (err) {}
              }
            }
          })
        }
        const Widget = function MilkFrogEntry(props) {
          return h(MilkFrog, Object.assign({}, props, { ctx: ctx }))
        }
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'dsh-milk-frog-widget', order: 12 }, Widget),
        )
      },
    }
  },
})
