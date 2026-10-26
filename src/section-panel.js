(function (scope) {
  "use strict";

  const style = `
:host { all:initial; color-scheme:light dark; font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; --toc-surface:#fafafa; --toc-border:#e4e4e4; --toc-text:#262626; --toc-muted:#858585; --toc-line:#b9b9b9; --toc-active:#292929; --toc-hover:#eeeeee; --toc-top:120px; }
* { box-sizing:border-box; }
[hidden] { display:none !important; }
button { font:inherit; color:inherit; background:none; border:0; cursor:pointer; }
button:focus-visible { outline:2px solid var(--toc-muted); outline-offset:3px; }
svg { width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
.toc-rail { position:fixed; right:12px; top:50%; transform:translateY(-50%); width:40px; max-height:64vh; padding:8px 0; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; overscroll-behavior:contain; z-index:2147483500; }
.toc-rail::-webkit-scrollbar { display:none; }
.toc-mark { width:40px; height:17px; min-height:17px; padding:0 4px; display:flex; justify-content:flex-end; align-items:center; }
.toc-line { width:16px; height:2px; border-radius:1px; background:var(--toc-line); transition:width .15s,background .15s; flex-shrink:0; }
.toc-mark:hover .toc-line,.toc-mark:focus-visible .toc-line { width:24px; background:var(--toc-active); }
.toc-mark.active .toc-line { background:var(--toc-active); }
.toc-mark:focus-visible { outline-offset:-2px; }
.toc-card { position:fixed; right:56px; top:var(--toc-top); width:280px; max-width:calc(100vw - 76px); max-height:calc(100vh - var(--toc-top) - 20px); display:flex; flex-direction:column; color:var(--toc-text); background:var(--toc-surface); border:1px solid var(--toc-border); border-radius:13px; box-shadow:0 6px 24px #00000012; overflow:hidden; z-index:2147483501; }
.toc-head { display:flex; flex:0 0 auto; align-items:center; gap:6px; padding:10px 10px 0 16px; min-height:35px; color:var(--toc-muted); }
.toc-context { font-size:11px; font-variant-numeric:tabular-nums; }
.toc-spacer { flex:1; }
.toc-tool { width:25px; height:25px; padding:5px; display:grid; place-items:center; color:var(--toc-muted); border-radius:5px; }
.toc-tool:hover { background:var(--toc-hover); color:var(--toc-text); }
.toc-pin[aria-pressed="true"] { color:var(--toc-text); }
.toc-pin[aria-pressed="true"] svg { fill:var(--toc-line); }
.toc-title { flex:0 0 auto; margin:6px 16px 12px; font-size:13px; line-height:1.7; font-weight:600; overflow:hidden; overflow-wrap:anywhere; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
.toc-list { flex:1 1 auto; padding:0 9px 12px; min-height:0; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:var(--toc-line) transparent; }
.toc-row { display:flex; align-items:center; padding-left:calc(1px + var(--toc-indent,0px)); margin:1px 0; }
.toc-row[data-depth="0"] { margin-top:4px; }
.toc-toggle,.toc-toggle-space { flex:0 0 20px; width:20px; }
.toc-toggle { display:grid; place-items:center; align-self:stretch; min-height:30px; padding:2px; color:var(--toc-muted); border-radius:5px; }
.toc-toggle svg { width:12px; height:12px; transition:transform .15s; }
.toc-toggle[aria-expanded="false"] svg { transform:rotate(-90deg); }
.toc-toggle:hover { background:var(--toc-hover); color:var(--toc-text); }
.toc-toggle:focus-visible { outline-offset:-2px; }
.toc-item { position:relative; display:flex; flex:1; align-items:baseline; gap:8px; min-width:0; padding:6px 7px 6px 3px; border-radius:6px; text-align:left; color:var(--toc-muted); font-size:12px; line-height:1.7; }
.toc-item[data-depth="0"] { color:var(--toc-text); font-weight:500; }
.toc-number { min-width:20px; flex-shrink:0; color:var(--toc-muted); font-size:11px; font-variant-numeric:tabular-nums; }
.toc-label { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.toc-dot { width:3px; height:3px; border-radius:50%; background:var(--toc-line); align-self:center; flex-shrink:0; margin:0 11px 0 5px; }
.toc-item:hover { background:var(--toc-hover); color:var(--toc-text); }
.toc-item.active,.toc-item.contains-active { background:var(--toc-hover); color:var(--toc-text); font-weight:500; }
.toc-item.active:before,.toc-item.contains-active:before { content:""; position:absolute; left:0; top:50%; transform:translateY(-50%); width:3px; height:3px; border-radius:50%; background:var(--toc-active); }
.toc-empty { padding:8px 12px 15px; margin:0; font-size:12px; color:var(--toc-muted); }
@media(prefers-color-scheme:dark) { :host { --toc-surface:#2c2c2c; --toc-border:#3c3c3c; --toc-text:#ededed; --toc-muted:#999999; --toc-line:#505050; --toc-active:#f0f0f0; --toc-hover:#383838; } .toc-card { box-shadow:0 6px 24px #0003; } }
@media(max-width:600px) { .toc-rail { right:5px; } .toc-card { right:47px; } }
@media(pointer:coarse) { .toc-mark { min-height:44px; height:44px; } .toc-tool { width:40px; height:40px; } .toc-item { min-height:40px; } .toc-toggle { flex-basis:28px; min-height:40px; } }
@media(prefers-reduced-motion:reduce) { * { transition:none !important; } }
@media print { :host { display:none !important; } }
`;

  function create(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const bookmark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15l-6-4-6 4Z"/></svg>';
  const close = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
  const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  class SectionPanel {
    constructor(callbacks) {
      this.callbacks = callbacks;
      this.turns = [];
      this.activeTurn = "";
      this.activeSection = "";
      this.open = false;
      this.pinned = false;
      this.signature = "";
      this.collapsed = new Set();
      this.branches = new Map();
      this.host = document.createElement("div");
      this.host.id = "threadmark-section-outline";
      this.host.dataset.threadmarkVersion = scope.chrome?.runtime?.getManifest?.()?.version || "preview";
      this.root = this.host.attachShadow({ mode: "open" });
      const css = create("style", "");
      css.textContent = style;
      this.root.append(css);
      const shell = create("div", "");
      // Static extension-owned markup; all message labels are inserted as text.
      shell.innerHTML = `<nav class="toc-rail" aria-label="当前轮次小节导航" hidden></nav>
        <aside class="toc-card" role="dialog" aria-label="本轮小节目录" aria-modal="false" hidden>
          <div class="toc-head"><span class="toc-context"></span><span class="toc-spacer"></span><button class="toc-tool toc-pin" type="button" aria-label="固定右侧目录" aria-pressed="false" title="固定右侧目录">${bookmark}</button><button class="toc-tool toc-close" type="button" aria-label="收起右侧目录" title="收起">${close}</button></div>
          <h2 class="toc-title"></h2><nav class="toc-list" aria-label="当前轮次目录"></nav>
        </aside>`;
      this.root.append(...shell.childNodes);
      this.rail = this.root.querySelector(".toc-rail");
      this.card = this.root.querySelector(".toc-card");
      this.list = this.root.querySelector(".toc-list");
      this.root.querySelector(".toc-pin").addEventListener("click", () => this.setPinned(!this.pinned, true));
      this.root.querySelector(".toc-close").addEventListener("click", () => this.close(true));
      for (const node of [this.rail, this.card]) {
        node.addEventListener("mouseenter", () => clearTimeout(this.closeTimer));
        node.addEventListener("mouseleave", () => this.scheduleClose());
      }
      this.root.addEventListener("focusout", () => queueMicrotask(() => this.scheduleClose()));
      this.root.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        this.close(true);
      });
      this.onOutside = (event) => {
        if (!this.pinned && !event.composedPath().includes(this.host)) this.setOpen(false);
      };
      document.addEventListener("pointerdown", this.onOutside);
      document.body.append(this.host);
    }

    setTurns(turns, reset = false) {
      this.turns = turns;
      this.signature = "";
      if (reset) {
        this.collapsed.clear();
        this.branches.clear();
        this.activeTurn = this.activeSection = "";
        this.setOpen(false);
        this.rail.replaceChildren();
        this.list.replaceChildren();
        this.rail.hidden = true;
      }
    }

    setActive(turnKey, sectionId = "") {
      const turn = this.turns.find((item) => item.key === turnKey);
      const changed = this.activeTurn !== turnKey;
      this.activeTurn = turn?.key || "";
      this.activeSection = sectionId;
      if (!turn) {
        this.rail.hidden = true;
        this.setOpen(false);
        return;
      }
      const signature = JSON.stringify([turn.key, turn.title, turn.sections.map((section) => [section.id, section.label, section.depth, section.parentId])]);
      if (signature !== this.signature) {
        this.signature = signature;
        this.render(turn);
      }
      if (changed && this.pinned) this.setOpen(true);
      this.markActive();
    }

    render(turn) {
      const focusKey = this.root.activeElement?.dataset.focusKey;
      const oldScroll = this.list.scrollTop;
      this.root.querySelector(".toc-context").textContent = `第 ${String(turn.number).padStart(2, "0")} 轮 · 本轮目录`;
      const title = this.root.querySelector(".toc-title");
      title.textContent = turn.title;
      title.title = turn.title;
      const marks = document.createDocumentFragment();
      const rows = document.createDocumentFragment();
      const sectionIds = new Set(turn.sections.map((section) => section.id));
      const parents = new Set(turn.sections.filter((section) => sectionIds.has(section.parentId)).map((section) => section.parentId));
      this.branches.clear();
      for (const section of turn.sections) {
        const mark = create("button", "toc-mark");
        mark.type = "button";
        mark.dataset.sectionId = section.id;
        mark.dataset.focusKey = `mark:${section.id}`;
        mark.dataset.depth = section.depth ? "child" : "parent";
        mark.setAttribute("aria-label", `定位小节 ${section.label}`);
        mark.setAttribute("aria-haspopup", "dialog");
        mark.append(create("span", "toc-line"));
        mark.addEventListener("mouseenter", () => this.setOpen(true));
        mark.addEventListener("focus", () => { if (!this.ignoreFocus) this.setOpen(true); });
        mark.addEventListener("click", () => { this.setOpen(true); this.callbacks.navigate(turn, section); });
        marks.append(mark);
        const branch = create("div", "toc-branch");
        const row = create("div", "toc-row");
        row.dataset.depth = String(section.depth);
        row.style.setProperty("--toc-indent", `${Math.min(section.depth, 4) * 11}px`);
        const group = parents.has(section.id) ? create("div", "toc-children") : null;
        const toggle = group ? create("button", "toc-toggle") : null;
        if (group) {
          group.id = `threadmark-subsections-${section.id}`;
          group.setAttribute("role", "group");
          group.setAttribute("aria-label", section.label);
          toggle.type = "button";
          toggle.dataset.focusKey = `toggle:${section.id}`;
          toggle.setAttribute("aria-controls", group.id);
          toggle.innerHTML = chevron;
          toggle.addEventListener("click", () => this.setCollapsed(section.id, !this.collapsed.has(section.id)));
          row.append(toggle);
        } else row.append(create("span", "toc-toggle-space"));
        const item = create("button", "toc-item");
        item.type = "button";
        item.dataset.sectionId = section.id;
        item.dataset.focusKey = `item:${section.id}`;
        item.dataset.depth = String(section.depth);
        item.setAttribute("aria-label", section.label);
        item.title = section.label;
        item.append(create("span", section.number ? "toc-number" : "toc-dot", section.number || undefined), create("span", "toc-label", section.title));
        item.addEventListener("click", () => this.callbacks.navigate(turn, section));
        row.append(item);
        branch.append(row);
        if (group) branch.append(group);
        this.branches.set(section.id, { section, branch, item, group, toggle });
      }
      for (const { section, branch } of this.branches.values()) {
        (this.branches.get(section.parentId)?.group || rows).append(branch);
        this.updateBranch(section.id);
      }
      if (!turn.sections.length) rows.append(create("p", "toc-empty", turn.answers.length ? "本轮暂无可识别的小节" : "回答生成后会自动更新"));
      this.rail.replaceChildren(marks);
      this.list.replaceChildren(rows);
      this.rail.hidden = !turn.sections.length;
      this.list.scrollTop = oldScroll;
      if (focusKey) {
        this.ignoreFocus = true;
        [...this.root.querySelectorAll("[data-focus-key]")].find((node) => node.dataset.focusKey === focusKey)?.focus({ preventScroll: true });
        this.ignoreFocus = false;
      }
      this.card.hidden = !this.open;
      this.position();
    }

    updateBranch(sectionId) {
      const entry = this.branches.get(sectionId);
      if (!entry?.group) return;
      const collapsed = this.collapsed.has(sectionId);
      entry.group.hidden = collapsed;
      entry.toggle.setAttribute("aria-expanded", String(!collapsed));
      entry.toggle.setAttribute("aria-label", `${collapsed ? "展开" : "收起"}章节 ${entry.section.label}`);
      entry.toggle.title = collapsed ? "展开子节" : "收起子节";
    }

    setCollapsed(sectionId, collapsed) {
      const entry = this.branches.get(sectionId);
      if (!entry?.group) return;
      if (collapsed) this.collapsed.add(sectionId); else this.collapsed.delete(sectionId);
      if (collapsed && entry.group.contains(this.root.activeElement)) entry.toggle.focus({ preventScroll: true });
      this.updateBranch(sectionId);
      this.markActive(false);
    }

    expandTo(sectionId) {
      let parentId = this.branches.get(sectionId)?.section.parentId;
      while (parentId && this.branches.has(parentId)) {
        this.collapsed.delete(parentId);
        this.updateBranch(parentId);
        parentId = this.branches.get(parentId).section.parentId;
      }
      this.markActive();
    }

    visibleActiveItem() {
      let item = this.branches.get(this.activeSection)?.item;
      let hiddenGroup;
      while (item && (hiddenGroup = item.closest(".toc-children[hidden]"))) {
        item = hiddenGroup.parentElement.querySelector(":scope > .toc-row > .toc-item");
      }
      return item;
    }

    markActive(reveal = true) {
      for (const node of this.root.querySelectorAll("[data-section-id]")) {
        const active = node.dataset.sectionId === this.activeSection;
        node.classList.toggle("active", active);
        node.classList.remove("contains-active");
        if (active) node.setAttribute("aria-current", "location"); else node.removeAttribute("aria-current");
      }
      const visibleItem = this.visibleActiveItem();
      if (visibleItem && visibleItem.dataset.sectionId !== this.activeSection) {
        visibleItem.classList.add("contains-active");
        visibleItem.setAttribute("aria-current", "location");
      }
      if (!reveal) return;
      this.reveal(this.rail, this.rail.querySelector(".active"));
      if (this.open) this.reveal(this.list, visibleItem);
    }

    reveal(container, node) {
      if (!node || !container.clientHeight) return;
      const bounds = container.getBoundingClientRect();
      const item = node.getBoundingClientRect();
      if (item.top < bounds.top + 8) container.scrollTop += item.top - bounds.top - 8;
      else if (item.bottom > bounds.bottom - 8) container.scrollTop += item.bottom - bounds.bottom + 8;
    }

    position() {
      if (!this.open) return;
      const active = this.rail.querySelector(".active") || this.rail.firstElementChild;
      const anchor = active?.getBoundingClientRect().top || innerHeight * 0.4;
      this.host.style.setProperty("--toc-top", `${Math.max(64, Math.min(anchor - 18, innerHeight - 420))}px`);
    }

    setOpen(open) {
      clearTimeout(this.closeTimer);
      this.open = Boolean(open && this.activeTurn);
      this.card.hidden = !this.open;
      this.position();
      if (this.open) this.reveal(this.list, this.visibleActiveItem());
      this.callbacks.layout?.();
    }

    setPinned(pinned, save = false) {
      this.pinned = Boolean(pinned);
      const button = this.root.querySelector(".toc-pin");
      button.setAttribute("aria-pressed", String(this.pinned));
      button.setAttribute("aria-label", this.pinned ? "取消固定右侧目录" : "固定右侧目录");
      button.title = this.pinned ? "取消固定" : "固定右侧目录";
      if (this.pinned) this.setOpen(true);
      this.callbacks.layout?.();
      if (save) this.callbacks.preference?.(this.pinned);
    }

    close(save = false) {
      const focusInside = this.card.contains(this.root.activeElement);
      this.setPinned(false, save);
      this.setOpen(false);
      if (focusInside) {
        this.ignoreFocus = true;
        (this.rail.querySelector(".active") || this.rail.firstElementChild)?.focus({ preventScroll: true });
        queueMicrotask(() => { this.ignoreFocus = false; });
      }
    }

    scheduleClose() {
      clearTimeout(this.closeTimer);
      if (this.pinned) return;
      this.closeTimer = setTimeout(() => {
        if (!this.pinned && !this.root.activeElement?.matches(":focus-visible") && !this.card.matches(":hover") && !this.rail.matches(":hover")) this.setOpen(false);
      }, 220);
    }

    destroy() {
      clearTimeout(this.closeTimer);
      document.removeEventListener("pointerdown", this.onOutside);
      this.host.remove();
    }
  }
  scope.ThreadmarkSectionPanel = SectionPanel;
})(globalThis);
