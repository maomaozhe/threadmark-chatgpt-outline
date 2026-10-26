(function (scope) {
  "use strict";
  const icons = {
    outline: '<path d="M8 5h11M8 12h11M8 19h7M4 5h.01M4 12h.01M4 19h.01"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    pin: '<path d="M6 20V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15l-6-4-6 4Z"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 11-2l3 4M4 15l3 4a7 7 0 0 0 11-2"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>'
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  class Panel {
    constructor(callbacks) {
      this.callbacks = callbacks;
      this.turns = [];
      this.expanded = new Set();
      this.knownKeys = new Set();
      this.query = "";
      this.activeTurn = "";
      this.activeSection = "";
      this.open = false;
      this.pinned = false;
      this.previewKey = "";
      this.directoryOpen = false;
      this.host = document.createElement("div");
      this.host.id = "threadmark-outline";
      this.host.dataset.threadmarkVersion = scope.chrome?.runtime?.getManifest?.()?.version || "preview";
      this.root = this.host.attachShadow({ mode: "open" });
      const style = element("style");
      style.textContent = scope.ThreadmarkStyles;
      this.root.append(style);
      // This template contains only extension-owned static markup. Message text uses textContent.
      const shell = element("div");
      shell.innerHTML = `
        <nav class="rail" aria-label="对话轮次导航"></nav>
        <aside class="panel" role="dialog" aria-label="ChatGPT 对话目录" aria-modal="false" hidden>
          <div class="preview-head"><button class="preview-round" title="定位到本轮提问"></button><span class="count"></span><span class="spacer"></span><button class="icon pin" aria-label="固定目录卡片" aria-pressed="false" title="固定目录卡片">${svg("pin")}</button><button class="icon minimize" title="关闭目录 · Alt+Shift+O" aria-label="收起目录">${svg("close")}</button></div>
          <button class="preview-title" title="定位到本轮提问"></button>
          <p class="preview-excerpt"></p>
          <button class="directory-toggle" aria-label="展开本轮目录" aria-expanded="false" aria-controls="threadmark-directory"><span>本轮目录</span><span class="preview-section-count"></span>${svg("chevron")}</button>
          <div class="directory" id="threadmark-directory" hidden>
          <div class="search">${svg("search")}<input class="search-input" aria-label="搜索轮次或小节" placeholder="搜索提问、小节或第几轮" autocomplete="off" spellcheck="false"><button class="clear" aria-label="清除搜索" hidden>×</button></div>
          <div class="toolbar"><span class="caption">小节</span><span class="spacer"></span><button class="text-button expand-all">展开全部</button><span class="separator"></span><button class="text-button collapse-all">收起全部</button><span class="separator"></span><button class="icon refresh" title="重新扫描已加载的对话" aria-label="刷新目录">${svg("refresh")}</button></div>
          <nav class="tree" aria-label="轮次与小节"></nav>
          <form class="jump"><label for="turn-number">快速跳转</label><div class="jump-group"><label for="turn-number">第</label><input id="turn-number" aria-label="跳转轮次" type="number" min="1" step="1" placeholder="1"><label for="turn-number">轮</label><button class="go" type="submit" aria-label="跳转到指定轮次">${svg("arrow")}</button></div></form>
          <div class="footer"><span class="status-dot"></span><span class="status">本地目录 · 自动更新</span><kbd title="显示或收起目录">Alt ⇧ O</kbd></div>
          </div>
        </aside>
        <div class="toast" role="status" hidden></div>`;
      this.root.append(...shell.childNodes);
      this.tree = this.root.querySelector(".tree");
      this.rail = this.root.querySelector(".rail");
      this.search = this.root.querySelector(".search-input");
      this.jumpInput = this.root.querySelector("#turn-number");
      this.root.querySelector(".refresh").addEventListener("click", () => callbacks.refresh());
      this.root.querySelector(".minimize").addEventListener("click", () => this.setOpen(false, true));
      this.root.querySelector(".pin").addEventListener("click", () => {
        this.pinned = !this.pinned;
        this.updatePin();
        this.callbacks.visibility?.(this.open, true);
      });
      this.root.querySelector(".directory-toggle").addEventListener("click", () => {
        this.directoryOpen = !this.directoryOpen;
        if (this.previewKey) this.expanded.add(this.previewKey);
        this.pinned = true;
        this.render();
        this.updatePin();
      });
      const navigatePreview = () => {
        const turn = this.turns.find((item) => item.key === this.previewKey);
        if (turn) this.callbacks.navigate(turn, null);
      };
      this.root.querySelector(".preview-title").addEventListener("click", navigatePreview);
      this.root.querySelector(".preview-round").addEventListener("click", navigatePreview);
      for (const node of [this.rail, this.root.querySelector(".panel")]) {
        node.addEventListener("mouseenter", () => clearTimeout(this.closeTimer));
        node.addEventListener("mouseleave", () => this.scheduleClose());
      }
      this.root.addEventListener("focusout", () => queueMicrotask(() => {
        if (!this.root.activeElement) this.scheduleClose();
      }));
      this.root.querySelector(".expand-all").addEventListener("click", () => { this.turns.forEach((turn) => this.expanded.add(turn.key)); this.render(); });
      this.root.querySelector(".collapse-all").addEventListener("click", () => { this.expanded.clear(); this.render(); });
      this.search.addEventListener("input", () => {
        this.query = this.search.value.trim();
        this.root.querySelector(".clear").hidden = !this.query;
        this.render();
      });
      this.root.querySelector(".clear").addEventListener("click", () => {
        this.search.value = this.query = "";
        this.root.querySelector(".clear").hidden = true;
        this.render();
        this.search.focus();
      });
      this.root.querySelector(".jump").addEventListener("submit", (event) => {
        event.preventDefault();
        const turn = this.turns.find((item) => item.number === Number(this.jumpInput.value));
        if (!turn) { this.toast(`请输入 1–${this.turns.length || 1} 之间的轮次`); return; }
        this.search.value = this.query = "";
        this.root.querySelector(".clear").hidden = true;
        this.expanded.add(turn.key);
        this.previewKey = turn.key;
        this.render();
        callbacks.navigate(turn, null);
      });
      this.root.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.open) this.setOpen(false, true);
      });
      document.body.append(this.host);
    }

    setOpen(open, save = false) {
      clearTimeout(this.closeTimer);
      this.open = open;
      if (save || !open) this.pinned = open;
      this.root.querySelector(".panel").hidden = !open;
      this.updatePin();
      if (open) this.positionCard();
      if (!open && save && this.root.querySelector(".panel").contains(this.root.activeElement)) {
        this.ignoreFocus = true;
        const target = [...this.rail.querySelectorAll(".rail-turn")].find((node) => node.dataset.turnKey === this.activeTurn) || this.rail.querySelector("button");
        target?.focus({ preventScroll: true });
        queueMicrotask(() => { this.ignoreFocus = false; });
      }
      this.callbacks.visibility?.(open, save);
    }

    updatePin() {
      const pin = this.root.querySelector(".pin");
      pin.setAttribute("aria-pressed", String(this.pinned));
      pin.setAttribute("aria-label", this.pinned ? "取消固定目录卡片" : "固定目录卡片");
      pin.title = this.pinned ? "取消固定，移开鼠标后收起" : "固定目录卡片";
    }

    scheduleClose() {
      clearTimeout(this.closeTimer);
      if (!this.pinned) this.closeTimer = setTimeout(() => {
        if (!this.pinned && !this.root.activeElement && !this.root.querySelector(".panel").matches(":hover") && !this.rail.matches(":hover")) this.setOpen(false);
      }, 220);
    }

    positionCard() {
      const button = [...this.rail.querySelectorAll(".rail-turn")].find((node) => node.dataset.turnKey === this.previewKey);
      const anchor = button?.getBoundingClientRect().top || innerHeight * 0.4;
      this.host.style.setProperty("--card-top", `${Math.max(16, Math.min(anchor - 16, innerHeight - 430))}px`);
    }

    showTurn(turn, pinned = false) {
      if (this.pinned && !pinned && this.previewKey !== turn.key) return;
      this.previewKey = turn.key;
      this.setOpen(true, pinned);
      this.render();
    }

    renderRail() {
      const focusedKey = this.root.activeElement?.classList.contains("rail-turn") ? this.root.activeElement.dataset.turnKey : null;
      const fragment = document.createDocumentFragment();
      for (const turn of this.turns) {
        const button = element("button", "rail-turn");
        button.dataset.turnKey = turn.key;
        button.setAttribute("aria-label", `定位第 ${turn.number} 轮：${turn.title}`);
        button.setAttribute("aria-haspopup", "dialog");
        const line = element("span", "rail-line");
        line.style.setProperty("--line-width", `${10 + Math.min(16, Math.round(turn.title.length / 4))}px`);
        button.append(line);
        button.addEventListener("mouseenter", () => this.showTurn(turn));
        button.addEventListener("focus", () => { if (!this.ignoreFocus) this.showTurn(turn); });
        button.addEventListener("click", () => {
          this.directoryOpen = true;
          this.expanded.add(turn.key);
          this.showTurn(turn, true);
          this.callbacks.navigate(turn, null);
        });
        fragment.append(button);
      }
      if (!this.turns.length) {
        const button = element("button", "rail-empty");
        button.innerHTML = svg("outline");
        button.setAttribute("aria-label", "展开对话目录");
        button.addEventListener("click", () => { this.directoryOpen = true; this.setOpen(true, true); this.render(); });
        fragment.append(button);
      }
      this.rail.replaceChildren(fragment);
      if (focusedKey) {
        this.ignoreFocus = true;
        [...this.rail.children].find((node) => node.dataset.turnKey === focusedKey)?.focus({ preventScroll: true });
        this.ignoreFocus = false;
      }
    }

    setModel(turns, reset = false) {
      if (reset) {
        this.expanded.clear(); this.knownKeys.clear(); this.activeTurn = this.activeSection = "";
        this.previewKey = "";
        this.directoryOpen = false;
        this.setOpen(false);
        this.search.value = this.query = "";
        this.root.querySelector(".clear").hidden = true;
        this.tree.scrollTop = 0;
      }
      this.turns = turns;
      if (!turns.some((turn) => turn.key === this.previewKey)) this.previewKey = turns[turns.length - 1]?.key || "";
      // Open only the newest round on first load; do not override manual collapse during streaming.
      if (turns.length && !this.knownKeys.has(turns[turns.length - 1].key)) this.expanded.add(turns[turns.length - 1].key);
      for (const turn of turns) this.knownKeys.add(turn.key);
      this.jumpInput.max = String(Math.max(1, turns.length));
      this.root.querySelector(".count").textContent = `/ ${turns.length} 轮`;
      this.renderRail();
      this.render();
    }

    render() {
      const position = this.tree.scrollTop;
      const focus = this.root.activeElement;
      const focusKey = focus?.dataset?.focusKey;
      const fragment = document.createDocumentFragment();
      const visible = this.turns.filter((turn) => scope.ThreadmarkCore.matchesQuery(turn, this.query));
      const preview = this.turns.find((turn) => turn.key === this.previewKey);
      this.root.querySelector(".preview-round").textContent = preview ? `第 ${String(preview.number).padStart(2, "0")} 轮` : "对话目录";
      this.root.querySelector(".preview-title").textContent = preview?.title || "还没有可索引的对话";
      this.root.querySelector(".preview-excerpt").textContent = preview?.excerpt || (preview?.answers.length ? "点击本轮目录，展开回答中的小节。" : "回答出现后会自动更新目录。");
      this.root.querySelector(".preview-section-count").textContent = `${preview?.sections.length || 0} 小节`;
      this.root.querySelector(".directory").hidden = !this.directoryOpen;
      const toggle = this.root.querySelector(".directory-toggle");
      toggle.setAttribute("aria-expanded", String(this.directoryOpen));
      toggle.setAttribute("aria-label", this.directoryOpen ? "收起本轮目录" : "展开本轮目录");
      this.tree.classList.toggle("single", !this.query);
      for (const turn of visible) {
        const expanded = this.query ? true : this.expanded.has(turn.key);
        const item = element("div", `turn${turn.key === this.activeTurn ? " active" : ""}`);
        item.dataset.turnKey = turn.key;
        item.hidden = !this.query && turn.key !== this.previewKey;
        const row = element("div", "turn-row");
        row.hidden = !this.query;
        const disclosure = element("button", "disclosure");
        disclosure.innerHTML = svg("chevron");
        disclosure.setAttribute("aria-label", `${expanded ? "收起" : "展开"}第 ${turn.number} 轮小节`);
        disclosure.setAttribute("aria-expanded", String(expanded));
        disclosure.dataset.focusKey = `disclosure:${turn.key}`;
        disclosure.addEventListener("click", () => {
          if (expanded) this.expanded.delete(turn.key); else this.expanded.add(turn.key);
          if (this.query) {
            this.search.value = this.query = "";
            this.root.querySelector(".clear").hidden = true;
          }
          this.render();
        });
        const link = element("button", "turn-link");
        link.title = `跳转到第 ${turn.number} 轮：${turn.title}`;
        link.setAttribute("aria-label", `第 ${turn.number} 轮：${turn.title}`);
        link.dataset.focusKey = `turn:${turn.key}`;
        const top = element("span", "turn-top");
        top.append(element("span", "turn-number", `第 ${String(turn.number).padStart(2, "0")} 轮`), element("span", "section-count", turn.answers.length ? `${turn.sections.length} 小节` : "等待回答"));
        link.append(top, element("span", "turn-title", turn.title));
        link.addEventListener("click", () => {
          this.expanded.add(turn.key);
          this.previewKey = turn.key;
          this.render();
          this.callbacks.navigate(turn, null);
        });
        row.append(disclosure, link);
        item.append(row);
        const children = element("div", "children");
        children.id = `threadmark-turn-${turn.number}`;
        children.hidden = !expanded;
        disclosure.setAttribute("aria-controls", children.id);
        if (!turn.sections.length) children.append(element("p", "no-sections", turn.answers.length ? "本轮没有标题，点击提问可定位" : "回答出现后会自动更新目录"));
        for (const section of turn.sections) {
          const button = element("button", `section${section.id === this.activeSection ? " active" : ""}`);
          button.style.paddingLeft = `${7 + section.depth * 11}px`;
          button.title = section.label;
          button.dataset.sectionId = section.id;
          button.dataset.focusKey = section.id;
          button.setAttribute("aria-label", section.label);
          if (section.number) button.append(element("span", "section-no", section.number));
          else button.append(element("span", "dot"));
          button.append(element("span", "section-title", section.title));
          button.addEventListener("click", () => {
            this.previewKey = turn.key;
            this.render();
            this.callbacks.navigate(turn, section);
          });
          children.append(button);
        }
        item.append(children);
        fragment.append(item);
      }
      if (!visible.length) {
        const empty = element("div", "empty");
        empty.innerHTML = svg("outline");
        empty.append(element("p", "", this.query ? "没有匹配的轮次或小节" : "还没有可索引的对话"));
        empty.append(element("small", "", this.query ? "试试小节关键词，或直接输入轮次数字。" : "打开一段 ChatGPT 对话后，目录会自动出现。历史内容未加载时，先向上滚动。"));
        fragment.append(empty);
      }
      this.tree.replaceChildren(fragment);
      this.tree.scrollTop = position;
      if (focusKey) [...this.tree.querySelectorAll("[data-focus-key]")].find((node) => node.dataset.focusKey === focusKey)?.focus({ preventScroll: true });
      this.setActive(this.activeTurn, this.activeSection);
    }

    setActive(turnKey, sectionId = "") {
      this.activeTurn = turnKey;
      this.activeSection = sectionId;
      for (const node of this.tree.querySelectorAll(".turn")) {
        const active = node.dataset.turnKey === turnKey;
        node.classList.toggle("active", active);
        const link = node.querySelector(".turn-link");
        if (active) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
      }
      for (const node of this.tree.querySelectorAll(".section")) {
        const active = node.dataset.sectionId === sectionId;
        node.classList.toggle("active", active);
        if (active) node.setAttribute("aria-current", "location"); else node.removeAttribute("aria-current");
      }
      for (const node of this.rail.querySelectorAll(".rail-turn")) {
        const active = node.dataset.turnKey === turnKey;
        node.classList.toggle("active", active);
        node.classList.toggle("previewed", this.open && node.dataset.turnKey === this.previewKey);
        if (active) node.setAttribute("aria-current", "location"); else node.removeAttribute("aria-current");
      }
    }

    toast(message) {
      clearTimeout(this.toastTimer);
      const toast = this.root.querySelector(".toast");
      toast.textContent = message;
      toast.hidden = false;
      this.toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
    }
  }
  scope.ThreadmarkPanel = Panel;
})(globalThis);
