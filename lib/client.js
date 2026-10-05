// dsh-everything-search —— Client 半端（静态 web 插件形态，ModuleLoader bundle）
// 经 /plugins/dsh-everything-search/client.js 加载。RPC 通过 fetch POST /evs/api/<name>。
window.__ModuleLoader__.load({
  id: 'dsh-everything-search',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var React = require('react')
    // react-dom 属平台基础模块（本机 dsh-context 同样直接 require("react-dom")）。
    // 面板要 portal 到 document.body 才能拿到真正的视口坐标系，见 SearchOverlay。
    var ReactDOM = require('react-dom')

    async function apiCall(name, args) {
      const res = await fetch('/evs/api/' + name, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args || {}),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return await res.json()
    }

    function insertStyles(css) {
      try {
        const style = document.createElement('style')
        style.textContent = css
        document.head.appendChild(style)
        return () => { try { style.remove() } catch (e) { /* ignore */ } }
      } catch (e) { return () => {} }
    }

    // ---- 开合状态：按会话共享（按钮与面板）—— 照 dsh-github-connect 的实现 ----
    var listeners = new Set()
    var openSessionId = null
    var commitHandler = null
    function subscribe(fn) {
      listeners.add(fn)
      return function () { listeners.delete(fn) }
    }
    function getOpenSession() { return openSessionId }
    function setOpen(sessionId, open) {
      var next = open ? sessionId : null
      if (next === openSessionId) return
      openSessionId = next
      listeners.forEach(function (fn) { fn() })
    }
    function useOpenSession() {
      return React.useSyncExternalStore(subscribe, getOpenSession, function () { return null })
    }
    function setCommitHandler(fn) { commitHandler = fn }
    function commit(paths) { if (commitHandler) commitHandler(paths) }

    // ---- 插件设置（localStorage 落盘） ----
    var settings = { limit: 50, kind: 'all', path: '', prefer: true }
    var settingsListeners = new Set()
    function getSettings() { return settings }
    function updateSettings(patch) {
      settings = Object.assign({}, settings, patch)
      settingsListeners.forEach(function (fn) { fn() })
    }
    function subscribeSettings(fn) { settingsListeners.add(fn); return function () { settingsListeners.delete(fn) } }
    function loadStorage() {
      try {
        if (typeof localStorage === 'undefined') return null
        const raw = localStorage.getItem('evsr-settings')
        if (!raw) return null
        const p = JSON.parse(raw)
        return {
          limit: Number(p.limit) > 0 ? Math.min(Number(p.limit), 200) : 50,
          kind: (p.kind === 'folder' || p.kind === 'file' || p.kind === 'all') ? p.kind : 'all',
          path: (typeof p.path === 'string' && p.path.trim()) ? p.path : '',
          prefer: p.prefer !== false,
        }
      } catch (e) { return null }
    }
    function saveStorage() {
      try {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem('evsr-settings', JSON.stringify({ limit: settings.limit, kind: settings.kind, path: settings.path, prefer: settings.prefer }))
      } catch (e) { /* ignore */ }
    }
    function reloadSettings() { const p = loadStorage(); if (p) updateSettings(p) }
    function saveSettings(patch) { updateSettings(patch); saveStorage() }

    // 优先开关：保存到本地 + 同步到 Host（Host 据此加/移除系统提示）
    function setPrefer(v) {
      saveSettings({ prefer: Boolean(v) })
      try { apiCall('set-preference', { prefer: Boolean(v) }) } catch (e) { /* ignore */ }
    }

    // 拉取插件默认 es.exe 路径（打包在插件 lib 里的），作为路径默认值
    apiCall('default-path').then(function (p) {
      if (typeof p === 'string' && p.trim()) { if (!getSettings().path) saveSettings({ path: p }) }
    }, function () { /* ignore */ })

    // 加载本地设置并同步"优先开关"到 Host（Host 据此加/移除系统提示）
    reloadSettings()
    try { apiCall('set-preference', { prefer: getSettings().prefer }) } catch (e) { /* ignore */ }

    function toMention(path) {
      const p = String(path || '').replace(/\\/g, '/')
      if (/[\u0000-\u001f\u007f-\u009f"]/.test(p)) return null
      if (/\s/.test(p)) return '@"' + p + '"'
      return '@' + p
    }

    // Cordis 靠这份清单等待服务就绪；官方文档 docs/subsystems/client-modules.md：
    // "`inject` names package rows whose factories must arrive before this row
    // materializes, while Cordis separately uses the same package edges to
    // compose entries." 1.0.3 这里是空数组 → apply() 早于
    // @deepseek-ai/dsh-client-ui-slots 运行 → ctx.get('slots') 为 undefined →
    // 🔍 按钮与设置页**静默消失**（无任何报错）。1.0.4 起声明 'slots'。
    var inject = ['slots']

    function apply(ctx) {
      insertStyles(
        // 按钮的盒模型与鼠标反馈 1:1 照 dsh-github-connect 的 .ghc-trigger（同一行的邻居）：
        // 胶囊形 28px、1px 描边、hover 同时改背景与文字色、focus-visible 外描边、120ms 过渡；
        // 图标 14px（与它的 .ghc-icon 一致）——1.0.7 及以前是 18px 无边框方块，明显大一圈。
        '.evs-trigger { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 28px; padding: 0 10px 0 8px; border-radius: 14px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3)); background: transparent; color: var(--dsw-alias-label-secondary, #888); cursor: pointer; font-family: inherit; font-size: 12px; line-height: 1; transition: background 120ms ease, color 120ms ease, border-color 120ms ease; }\n' +
        '.evs-trigger:hover { background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.12)); color: var(--dsw-alias-label-primary, #eee); }\n' +
        '.evs-trigger.evs-open { border-color: var(--dsw-alias-brand-primary, #4d6bfe); color: var(--dsw-alias-label-primary, #eee); }\n' +
        '.evs-trigger:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 1px; }\n' +
        '.evs-trigger .evs-icon { width: 14px; height: 14px; flex: none; }\n' +
        '.evs-backdrop { position: fixed; inset: 0; z-index: 1000; background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,.45)); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }\n' +
        '.evs-modal { box-sizing: border-box; width: 760px; max-width: calc(100vw - 48px); max-height: min(88vh, 800px); overflow-y: auto; background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, #1c1c1f)); border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.25)); border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,.4); color: var(--dsw-alias-label-primary, #eee); display: flex; flex-direction: column; }\n' +
        '.evs-titlebar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1); }\n' +
        '.evs-tb-title { font-size: 14px; font-weight: 600; }\n' +
        '.evs-tb-close { background: transparent; border: none; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 6px; }\n' +
        '.evs-tb-close:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }\n' +
        '.evs-body { padding: 12px 16px 0; display: flex; flex-direction: column; gap: 12px; flex: 1; overflow: hidden; }\n' +
        '.evs-desc { font-size: 13px; color: var(--dsw-alias-label-secondary); }\n' +
        '.evs-search-row { display: flex; gap: 8px; align-items: center; }\n' +
        '.evs-input { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; }\n' +
        '.evs-input:focus { outline: 2px solid var(--dsw-alias-brand-primary); }\n' +
        '.evs-filter-row { display: flex; align-items: center; gap: 10px; }\n' +
        '.evs-scope-row { display: flex; align-items: center; gap: 10px; }\n' +
        '.evs-filter-label { font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }\n' +
        '.evs-seg { display: flex; gap: 4px; background: var(--dsw-alias-bg-layer-2); padding: 3px; border-radius: 8px; }\n' +
        '.evs-seg-btn { padding: 4px 14px; border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; border-radius: 6px; font-size: 12px; }\n' +
        '.evs-seg-btn.active { background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 3px rgba(0,0,0,.25); }\n' +
        '.evs-results { flex: 1; overflow: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; }\n' +
        '.evs-results-head { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 12px; color: var(--dsw-alias-label-secondary); border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }\n' +
        '.evs-row { display: flex; gap: 8px; align-items: center; padding: 6px 10px; cursor: pointer; font-family: monospace; font-size: 12px; }\n' +
        '.evs-row:hover { background: var(--dsw-alias-bg-layer-2); }\n' +
        '.evs-row.checked { background: var(--dsw-alias-bg-layer-2); }\n' +
        '.evs-row input { flex-shrink: 0; }\n' +
        '.evs-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n' +
        '.evs-empty { padding: 16px 10px; color: var(--dsw-alias-label-secondary); font-size: 12px; text-align: center; }\n' +
        '.evs-foot { display: flex; gap: 8px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--dsw-alias-border-l1); }\n' +
        '.evs-count { margin-right: auto; font-size: 12px; color: var(--dsw-alias-label-secondary); }\n' +
        '.evs-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; white-space: nowrap; font-size: 13px; }\n' +
        '.evs-btn:hover { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }\n' +
        '.evs-btn:disabled { opacity: .5; cursor: default; }\n' +
        '.evs-btn.primary { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); border-color: transparent; }\n' +
        '.evs-btn.primary:hover { opacity: .9; }\n' +
        '.evs-err { padding: 6px 10px; color: var(--dsw-alias-state-error-primary); font-size: 12px; }\n' +
        '.evs-set { padding: 10px 4px 24px; display: flex; flex-direction: column; gap: 0; max-width: 620px; }\n' +
        '.evs-set-intro { font-size: 13px; color: var(--dsw-alias-label-secondary); opacity: .8; padding-bottom: 16px; }\n' +
        '.evs-set-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }\n' +
        '.evs-set-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }\n' +
        '.evs-set-label { font-size: 14px; color: var(--dsw-alias-label-primary); font-weight: 500; }\n' +
        '.evs-set-desc { font-size: 12px; color: var(--dsw-alias-label-secondary); opacity: .8; }\n' +
        '.evs-set-ctl { padding: 7px 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; }\n' +
        '.evs-set-input { flex: 1; min-width: 0; padding: 7px 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-family: monospace; font-size: 12px; margin-left: 12px; }\n'
      )

      const slots = ctx.get('slots')
      if (slots === undefined || typeof slots.inject !== 'function') {
        console.warn('[everything-search:client] slots 服务不可用——🔍 按钮与设置页未挂载；请检查 package.json 的 dsh.client.inject 与本文件导出的 inject 是否都声明了 slots')
        return
      }

      function SearchOverlay(props) {
        const open = useOpenSession() === props.sessionId
        const [query, setQuery] = React.useState('')
        const [kind, setKind] = React.useState(getSettings().kind)
        const [scope, setScope] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [results, setResults] = React.useState([])
        const [selected, setSelected] = React.useState([])
        const [err, setErr] = React.useState('')

        React.useEffect(function () {
          if (!open) return
          reloadSettings()
          setKind(getSettings().kind)
        }, [open])

        if (!open) return null

        function close() { setOpen(props.sessionId, false) }

        async function runSearch(q, k) {
          const qq = (q !== undefined ? q : String(query || '')).trim()
          const kk = k !== undefined ? k : kind
          if (!qq) { setResults([]); setErr(''); return }
          setBusy(true); setErr('')
          try {
            const a = { query: qq, limit: getSettings().limit, foldersOnly: kk === 'folder', filesOnly: kk === 'file' }
            const pth = getSettings().path
            if (pth) a.path = pth
            const sc = String(scope || '').trim()
            if (sc) a.scope = sc
            const r = await apiCall('search', a)
            if (r && r.ok) { setResults(r.results || []) } else { setResults([]); setErr(r && r.error ? r.error : '搜索失败') }
          } catch (e) {
            setResults([]); setErr(String(e && e.message ? e.message : e))
          }
          setBusy(false)
        }

        function chooseKind(k) {
          setKind(k)
          const q = String(query || '').trim()
          if (q) runSearch(q, k)
        }

        function toggle(p) {
          setSelected(function (prev) {
            return prev.indexOf(p) >= 0 ? prev.filter(function (x) { return x !== p }) : prev.concat([p])
          })
        }
        function toggleAll() {
          setSelected(function (prev) {
            if (prev.length === results.length) return []
            return results.slice()
          })
        }
        function addToContext() {
          if (selected.length === 0) return
          commit(selected)
          close()
        }

        const rows = results.map(function (p, i) {
          const checked = selected.indexOf(p) >= 0
          return React.createElement('label', { className: checked ? 'evs-row checked' : 'evs-row', key: i },
            React.createElement('input', { type: 'checkbox', checked: checked, onChange: function () { toggle(p) } }),
            React.createElement('span', { className: 'evs-path' }, p),
          )
        })

        const segs = [
          { key: 'all', label: '全部' },
          { key: 'folder', label: '文件夹' },
          { key: 'file', label: '文件' },
        ]

        // portal 到 document.body：conversation.input.overlay 的宿主是输入框卡片里一个
        // `height:0; position:absolute` 的锚点（.uV2eYG_overlayAnchor），该子树里的
        // position:fixed **不是视口坐标系**（祖先的 contain/transform 会把它变成包含块），
        // 面板因此会贴在屏幕底部。本机 dsh-context 的附件灯箱同样用
        // require("react-dom") + createPortal(…, document.body) 解决。
        return ReactDOM.createPortal(
          React.createElement('div', {
            className: 'evs-backdrop',
            onClick: function (event) { if (event.target === event.currentTarget) setOpen(props.sessionId, false) },
          },
            React.createElement('div', { className: 'evs-modal' },
            React.createElement('div', { className: 'evs-titlebar' },
              React.createElement('span', { className: 'evs-tb-title' }, 'Everything 全盘搜索'),
              React.createElement('button', { className: 'evs-tb-close', onClick: close }, '✕ 关闭'),
            ),
            React.createElement('div', { className: 'evs-body' },
              React.createElement('div', { className: 'evs-desc' }, '在全盘快速搜索文件 / 文件夹，勾选后可加入对话上下文'),
              React.createElement('div', { className: 'evs-search-row' },
                React.createElement('input', {
                  className: 'evs-input',
                  placeholder: '输入关键词，回车搜索（支持 *.pdf、ext:ini 等语法）',
                  value: query,
                  onChange: function (e) { setQuery(e.target.value) },
                  onKeyDown: function (e) { if (e.key === 'Enter') runSearch() },
                }),
                React.createElement('button', { className: 'evs-btn', onClick: function () { runSearch() }, disabled: busy }, busy ? '…' : '搜索'),
              ),
              React.createElement('div', { className: 'evs-filter-row' },
                React.createElement('span', { className: 'evs-filter-label' }, '类型'),
                React.createElement('div', { className: 'evs-seg' },
                  segs.map(function (s) {
                    return React.createElement('button', {
                      key: s.key,
                      className: kind === s.key ? 'evs-seg-btn active' : 'evs-seg-btn',
                      onClick: function () { chooseKind(s.key) },
                    }, s.label)
                  }),
                ),
              ),
              React.createElement('div', { className: 'evs-scope-row' },
                React.createElement('span', { className: 'evs-filter-label' }, '范围'),
                React.createElement('input', {
                  className: 'evs-input',
                  placeholder: '可选：限定文件夹，如 C:/Project（留空搜全盘）',
                  value: scope,
                  onChange: function (e) { setScope(e.target.value) },
                  onKeyDown: function (e) { if (e.key === 'Enter') runSearch() },
                }),
              ),
              err ? React.createElement('div', { className: 'evs-err' }, err) : null,
              React.createElement('div', { className: 'evs-results' },
                React.createElement('div', { className: 'evs-results-head' },
                  React.createElement('span', null, '结果'),
                  React.createElement('span', null, String(results.length) + ' 条'),
                ),
                rows.length > 0 ? rows : React.createElement('div', { className: 'evs-empty' }, '无匹配结果'),
              ),
            ),
            React.createElement('div', { className: 'evs-foot' },
              React.createElement('span', { className: 'evs-count' }, '已选 ' + selected.length),
              React.createElement('button', { className: 'evs-btn', onClick: toggleAll }, '全选/清空'),
              React.createElement('button', { className: 'evs-btn primary', onClick: addToContext, disabled: selected.length === 0 }, '加入上下文'),
            ),
          ),
          ),
          document.body
        )
      }

      function SettingsPage() {
        const [s, setS] = React.useState(getSettings())
        const [pathEdit, setPathEdit] = React.useState(getSettings().path)
        const [health, setHealth] = React.useState(null)
        const [fixing, setFixing] = React.useState(false)
        React.useEffect(function () {
          reloadSettings()
          apiCall('health').then(function (h) { setHealth(h) }, function () { /* ignore */ })
          return subscribeSettings(function () { setS(getSettings()); setPathEdit(getSettings().path) })
        }, [])
        function runFix() {
          setFixing(true)
          apiCall('fix').then(function () {
            return apiCall('health').then(function (h) { setHealth(h); setFixing(false) }, function () { setFixing(false) })
          }, function () { setFixing(false) })
        }
        function commitPath() {
          const p = String(pathEdit || '').trim()
          if (p) { saveSettings({ path: p }) } else { setPathEdit(getSettings().path) }
        }
        const segs = [
          { key: 'all', label: '全部' },
          { key: 'folder', label: '文件夹' },
          { key: 'file', label: '文件' },
        ]
        return React.createElement('div', { className: 'evs-set' },
          React.createElement('div', { className: 'evs-set-intro' }, 'Everything 全盘搜索插件配置'),
          (health && health.healthy)
            ? React.createElement('div', { className: 'evs-set-row' },
                React.createElement('div', { className: 'evs-set-info' },
                  React.createElement('div', { className: 'evs-set-label' }, '✅ 索引监控正常'),
                  React.createElement('div', { className: 'evs-set-desc' }, 'Everything 服务运行中，新文件可实时搜到'),
                ),
              )
            : (health && !health.healthy)
              ? React.createElement('div', { className: 'evs-set-row' },
                  React.createElement('div', { className: 'evs-set-info' },
                    React.createElement('div', { className: 'evs-set-label' }, '⚠️ 索引可能陈旧（新文件搜不到）'),
                    React.createElement('div', { className: 'evs-set-desc' }, health.everythingExe
                      ? (health.everythingRunning ? 'Everything 在跑，但服务未安装 → 新文件不会自动进索引' : '未检测到 Everything 进程')
                      : '本机未安装 Everything，请先安装：https://www.voidtools.com'),
                  ),
                  health.everythingExe
                    ? React.createElement('button', { className: 'evs-btn primary', onClick: runFix, disabled: fixing }, fixing ? '修复中…' : '一键修复')
                    : null,
                )
              : null,
          React.createElement('div', { className: 'evs-set-row' },
            React.createElement('div', { className: 'evs-set-info' },
              React.createElement('div', { className: 'evs-set-label' }, '默认结果数量'),
              React.createElement('div', { className: 'evs-set-desc' }, '搜索面板每次最多返回的条数'),
            ),
            React.createElement('select', {
              className: 'evs-set-ctl',
              value: String(s.limit),
              onChange: function (e) { saveSettings({ limit: Number(e.target.value) }) },
            },
              [20, 50, 100, 200].map(function (v) {
                return React.createElement('option', { key: v, value: String(v) }, String(v) + ' 条')
              }),
            ),
          ),
          React.createElement('div', { className: 'evs-set-row' },
            React.createElement('div', { className: 'evs-set-info' },
              React.createElement('div', { className: 'evs-set-label' }, '默认类型'),
              React.createElement('div', { className: 'evs-set-desc' }, '打开面板时默认筛选的类型'),
            ),
            React.createElement('div', { className: 'evs-seg' },
              segs.map(function (seg) {
                return React.createElement('button', {
                  key: seg.key,
                  className: s.kind === seg.key ? 'evs-seg-btn active' : 'evs-seg-btn',
                  onClick: function () { saveSettings({ kind: seg.key }) },
                }, seg.label)
              }),
            ),
          ),
          React.createElement('div', { className: 'evs-set-row' },
            React.createElement('div', { className: 'evs-set-info' },
              React.createElement('div', { className: 'evs-set-label' }, '默认用 Everything 优先搜索'),
              React.createElement('div', { className: 'evs-set-desc' }, '开启后 AI 找文件时优先用全盘索引搜索（推荐）'),
            ),
            React.createElement('div', { className: 'evs-seg' },
              React.createElement('button', {
                className: s.prefer ? 'evs-seg-btn active' : 'evs-seg-btn',
                onClick: function () { setPrefer(true) },
              }, '开启'),
              React.createElement('button', {
                className: !s.prefer ? 'evs-seg-btn active' : 'evs-seg-btn',
                onClick: function () { setPrefer(false) },
              }, '关闭'),
            ),
          ),
          React.createElement('div', { className: 'evs-set-row' },
            React.createElement('div', { className: 'evs-set-info' },
              React.createElement('div', { className: 'evs-set-label' }, '搜索引擎路径'),
              React.createElement('div', { className: 'evs-set-desc' }, 'Everything 官方命令行工具（随插件打包，可修改）'),
            ),
            React.createElement('input', {
              className: 'evs-set-input',
              type: 'text',
              value: pathEdit,
              onChange: function (e) { setPathEdit(e.target.value) },
              onBlur: commitPath,
              onKeyDown: function (e) { if (e.key === 'Enter') commitPath() },
              placeholder: getSettings().path || 'es.exe 路径',
            }),
          ),
        )
      }

      function SearchButton(props) {
        const isOpen = useOpenSession() === props.sessionId
        React.useEffect(function () {
          if (!props.inputActions) return
          setCommitHandler(function (paths) {
            const mentions = paths.map(toMention).filter(Boolean)
            if (mentions.length === 0) return
            const current = (props.input && props.input.draft) || ''
            const next = current.trim() ? current.trim() + ' ' + mentions.join(' ') : mentions.join(' ')
            props.inputActions.setDraft(next)
          })
        }, [props.inputActions, props.input])
        return React.createElement('button', {
          type: 'button',
          className: 'evs-trigger' + (isOpen ? ' evs-open' : ''),
          onClick: function () { setOpen(props.sessionId, !isOpen) },
          title: 'Everything 全盘搜索并加入上下文',
          'aria-label': 'Everything 全盘搜索',
        },
          React.createElement('svg', { className: 'evs-icon', viewBox: '0 0 1024 1024', fill: 'currentColor', 'aria-hidden': 'true' },
            React.createElement('path', { d: 'M975.648 975.648c-36 36-94.336 36-130.336 0L682.656 812.992c-66.88 42.88-145.952 68.448-231.264 68.448-237.536 0-430.08-192.512-430.08-430.048S213.856 21.344 451.392 21.344 881.44 213.888 881.44 451.392c0 85.344-25.568 164.384-68.448 231.296l162.656 162.656c36 36 36 94.368 0 130.336zM451.424 144.224c-169.664 0-307.2 137.536-307.2 307.168S281.76 758.56 451.424 758.56c169.632 0 307.168-137.536 307.168-307.168 0.064-169.632-137.536-307.168-307.168-307.168z' }),
          ),
        )
      }

      slots.inject('conversation.input.left', function () {
        return slots.register(
          { name: 'conversation.input.left', id: 'everything-search-btn', order: 91, label: function () { return 'Everything 搜索' } },
          function (props) { return React.createElement(SearchButton, props) }
        )
      })
      // 面板坐席 = conversation.input.overlay（官方契约：list / session，
      // "Floating entries rendered inside the resident composer card"）——与本地同版本的
      // dsh-github-connect 完全一致：按钮/面板共用会话级开合 store，面板是自带遮罩的
      // 居中对话框（点空白关闭、✕ 关闭、再点按钮收起）。
      // 沿革：1.0.3 挂 shell.overlay 且手量 textarea（量不到→底部正中）；1.0.5 改挂
      // conversation.input.dock；1.0.6 按 github-connect 的写法定为 input.overlay。
      slots.inject('conversation.input.overlay', function () {
        return slots.register(
          { name: 'conversation.input.overlay', id: 'everything-search-panel', order: 25, label: function () { return 'Everything 全盘搜索' } },
          function (props) { return React.createElement(SearchOverlay, props) }
        )
      })
      slots.inject('settings.section', function () {
        return slots.register(
          { name: 'settings.section', id: 'everything-search', order: 90, label: 'Everything 搜索' },
          function () { return React.createElement(SettingsPage) }
        )
      })
    }

    exports.name = 'dsh-everything-search'
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
