globalThis.ThreadmarkStyles = `
:host { all:initial; color-scheme:light dark; font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; --surface:#fafafa; --border:#e4e4e4; --text:#262626; --muted:#8a8a8a; --line:#b9b9b9; --line-active:#242424; --hover:#ededed; --field:#f3f3f3; --rail-left:12px; --card-left:62px; --card-top:28vh; }
* { box-sizing:border-box; }
[hidden] { display:none !important; }
button,input { font:inherit; }
button { border:0; background:none; color:inherit; cursor:pointer; }
button:focus-visible,input:focus-visible { outline:2px solid var(--muted); outline-offset:3px; }
button:disabled { cursor:default; opacity:.4; }
svg { width:17px; height:17px; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
.rail { position:fixed; left:var(--rail-left); top:50%; transform:translateY(-50%); width:42px; max-height:64vh; overflow:auto; scrollbar-width:none; display:flex; flex-direction:column; align-items:flex-start; z-index:2147483500; padding:8px 0; overscroll-behavior:contain; }
.rail::-webkit-scrollbar { display:none; }
.rail-turn { display:flex; align-items:center; justify-content:flex-start; width:42px; min-height:14px; height:14px; flex-shrink:0; padding:0 10px 0 4px; border-radius:3px; }
.rail-line { height:2px; width:var(--line-width,16px); border-radius:1px; background:var(--line); transition:width .15s,background .15s; pointer-events:none; }
.rail-turn:hover .rail-line,.rail-turn:focus-visible .rail-line { width:30px; background:var(--text); }
.rail-turn.active .rail-line { width:32px; background:var(--line-active); }
.rail-turn:focus-visible { outline:0; }
.rail-turn:focus-visible .rail-line { height:3px; }
.rail-turn.previewed:not(.active) .rail-line { background:var(--muted); }
.rail-empty { width:36px; height:36px; border-radius:7px; color:var(--muted); background:var(--surface); border:1px solid var(--border); }
.panel { position:fixed; top:var(--card-top); left:var(--card-left); width:380px; max-width:calc(100vw - var(--card-left) - 18px); max-height:calc(100vh - var(--card-top) - 18px); display:flex; flex-direction:column; color:var(--text); background:var(--surface); border:1px solid var(--border); border-radius:16px; box-shadow:0 6px 28px #00000012; overflow:hidden; z-index:2147483501; }
.preview-head { display:flex; align-items:center; gap:7px; padding:11px 13px 0 16px; color:var(--muted); font-size:10px; }
.preview-round { padding:0; color:var(--muted); font-size:10px; font-variant-numeric:tabular-nums; }
.count { color:var(--muted); font-size:10px; }
.spacer { flex:1; }
.icon { display:inline-flex; justify-content:center; align-items:center; width:25px; height:25px; padding:5px; border-radius:6px; color:var(--muted); }
.icon svg { width:15px; height:15px; }
.icon:hover { background:var(--hover); color:var(--text); }
.pin[aria-pressed="true"] { color:var(--text); }
.pin[aria-pressed="true"] svg { fill:var(--line); }
.preview-title { text-align:left; margin:4px 16px 0; padding:0; color:var(--text); font-size:14px; line-height:1.65; font-weight:650; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
.preview-excerpt { color:var(--muted); font-size:13px; line-height:1.8; font-weight:550; padding:0; margin:5px 16px 9px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
.directory-toggle { display:flex; align-items:center; gap:7px; width:100%; color:var(--muted); padding:9px 16px 11px; font-size:11px; text-align:left; }
.directory-toggle:hover { color:var(--text); }
.directory-toggle svg { width:12px; height:12px; margin-left:auto; transition:transform .15s; }
.directory-toggle[aria-expanded="true"] svg { transform:rotate(90deg); }
.directory { min-height:0; display:flex; flex-direction:column; border-top:1px solid var(--border); }
.search { display:flex; align-items:center; gap:7px; margin:11px 13px 0; padding:0 9px; min-height:32px; border:1px solid var(--border); border-radius:7px; color:var(--muted); background:var(--field); }
.search:focus-within { border-color:var(--muted); }
.search svg { width:14px; height:14px; }
.search input { min-width:0; width:100%; outline:0; border:0; background:transparent; color:var(--text); font-size:11px; }
.search input:focus-visible { outline:0; }
.search input::placeholder { color:var(--muted); }
.clear { padding:0; width:18px; color:var(--muted); font-size:17px; }
.toolbar { display:flex; gap:7px; align-items:center; padding:8px 15px 5px; }
.toolbar .caption { color:var(--muted); font-size:10px; }
.text-button { font-size:10px; color:var(--muted); padding:3px 1px; }
.text-button:hover { color:var(--text); }
.separator { width:1px; height:9px; background:var(--border); }
.tree { overflow:auto; overscroll-behavior:contain; min-height:40px; max-height:340px; padding:0 11px 7px; scrollbar-width:thin; scrollbar-color:var(--line) transparent; }
.turn { margin:0 0 3px; }
.turn-row { display:flex; align-items:stretch; border-radius:7px; padding:4px 1px; }
.turn-row:hover { background:var(--hover); }
.turn.active>.turn-row { background:var(--field); }
.disclosure { align-self:flex-start; display:grid; place-items:center; padding:8px 2px; width:21px; height:30px; color:var(--muted); flex-shrink:0; }
.disclosure svg { width:11px; height:11px; transition:transform .15s; }
.disclosure[aria-expanded="true"] svg { transform:rotate(90deg); }
.turn-link { flex:1; min-width:0; text-align:left; padding:3px 7px 3px 0; }
.turn-top { display:flex; align-items:center; gap:7px; }
.turn-number { color:var(--muted); font-size:10px; font-variant-numeric:tabular-nums; }
.section-count { color:var(--muted); font-size:9px; }
.turn-title { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; color:var(--text); font-size:12px; line-height:1.7; }
.children { margin:0 0 4px 11px; padding:0 0 0 10px; border-left:1px solid var(--border); }
.tree.single .children { margin-left:4px; padding-left:7px; }
.section { display:flex; align-items:baseline; gap:9px; width:100%; text-align:left; padding:6px 8px; margin:1px 0; border-radius:6px; color:var(--muted); font-size:11.5px; line-height:1.7; }
.section:hover { background:var(--hover); color:var(--text); }
.section.active { color:var(--text); background:var(--hover); font-weight:600; }
.section-no { color:var(--muted); min-width:19px; flex-shrink:0; font-size:10px; font-variant-numeric:tabular-nums; }
.section-title { overflow-wrap:anywhere; }
.dot { width:4px; height:4px; border-radius:50%; background:var(--line); flex-shrink:0; align-self:center; margin:0 8px 0 4px; }
.no-sections { margin:8px; color:var(--muted); font-size:11px; }
.empty { text-align:center; padding:23px 17px; color:var(--muted); }
.empty svg { width:26px; height:26px; }
.empty p { font-size:12px; margin:8px 0; color:var(--text); }
.empty small { font-size:11px; }
.jump { display:flex; align-items:center; gap:7px; border-top:1px solid var(--border); padding:10px 15px; margin:0; color:var(--muted); font-size:10px; }
.jump-group { display:flex; align-items:center; gap:6px; margin-left:auto; }
.jump input { width:42px; height:25px; border:1px solid var(--border); background:var(--field); color:var(--text); border-radius:5px; text-align:center; font-size:11px; appearance:textfield; -moz-appearance:textfield; }
.jump input::-webkit-inner-spin-button { appearance:none; }
.go { width:25px; height:25px; display:grid; place-items:center; padding:4px; color:var(--text); border-radius:5px; background:var(--hover); }
.go svg { width:14px; height:14px; }
.footer { display:flex; align-items:center; gap:6px; padding:0 15px 10px; color:var(--muted); font-size:9px; }
.footer kbd { font:9px/1.5 inherit; margin-left:auto; }
.status-dot { width:4px; height:4px; border-radius:50%; background:var(--muted); }
.toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); max-width:calc(100vw - 32px); padding:9px 16px; background:var(--text); color:var(--surface); border-radius:8px; font-size:12px; z-index:2147483502; }
@media(prefers-color-scheme:dark) { :host { --surface:#2c2c2c; --border:#3c3c3c; --text:#ededed; --muted:#969696; --line:#505050; --line-active:#f5f5f5; --hover:#3c3c3c; --field:#303030; } .panel { box-shadow:0 8px 28px #0003; } }
@media(max-width:600px) { .panel { width:min(360px,calc(100vw - 68px)); } }
@media(prefers-reduced-motion:reduce) { * { transition:none !important; scroll-behavior:auto !important; } }
@media print { :host { display:none !important; } }
`;
