(function () {
  "use strict";
  if (document.getElementById("threadmark-outline")) return;
  const Core = globalThis.ThreadmarkCore;
  if (!Core || !globalThis.ThreadmarkPanel || !globalThis.ThreadmarkSectionPanel) return;

  let turns = [];
  let path = location.pathname;
  let pendingReset = false;
  let signature = "";
  let scanTimer;
  let scanStarted = 0;
  let scrollFrame = 0;
  let navigationUntil = 0;
  let highlight;
  let highlightTimer;
  let disposed = false;
  const disposers = [];
  const preferenceKey = "threadmark:preferences";
  const preferences = { open: false, tocPinned: false };
  let preferenceRevision = 0;

  function savePreferences() {
    preferenceRevision += 1;
    if (globalThis.chrome?.storage?.local) chrome.storage.local.set({ [preferenceKey]: { ...preferences } }).catch(() => {});
  }

  const panel = new globalThis.ThreadmarkPanel({
    refresh: () => { scan(true); panel.toast("已重新扫描当前页面"); },
    navigate,
    visibility(open, save) {
      positionOverlay();
      if (save) { preferences.open = open && panel.pinned; savePreferences(); }
    }
  });
  const tocPanel = new globalThis.ThreadmarkSectionPanel({
    navigate,
    layout: () => positionOverlay(),
    preference(pinned) { preferences.tocPinned = pinned; savePreferences(); }
  });

  // Pinning the right directory reserves space on wide screens without changing inline styles.
  const layoutStyle = document.createElement("style");
  layoutStyle.id = "threadmark-page-style";
  layoutStyle.textContent = `[data-threadmark-focus="true"] { scroll-margin-top:100px !important; outline:2px solid #999 !important; outline-offset:6px !important; border-radius:4px; } @media(min-width:1200px) { main[data-threadmark-toc-pinned="true"] { margin-inline-end:308px !important; min-width:0 !important; } } @media(prefers-color-scheme:dark) { [data-threadmark-focus="true"] { outline-color:#aaa !important; } } @media print { main[data-threadmark-toc-pinned] { margin-inline-end:0 !important; } }`;
  document.head.append(layoutStyle);

  function positionOverlay() {
    const left = document.querySelector("main")?.getBoundingClientRect().left || 0;
    const railLeft = Math.max(8, Math.min(window.innerWidth - 80, left + 10));
    panel.host.style.setProperty("--rail-left", `${railLeft}px`);
    panel.host.style.setProperty("--card-left", `${railLeft + 46}px`);
    if (panel.open) panel.positionCard();
    const main = document.querySelector("main");
    if (main) {
      if (tocPanel.open && tocPanel.pinned) main.setAttribute("data-threadmark-toc-pinned", "true");
      else main.removeAttribute("data-threadmark-toc-pinned");
    }
    tocPanel.position();
  }

  function scan(force = false) {
    if (disposed) return;
    scanStarted = 0;
    clearTimeout(scanTimer);
    if (location.pathname !== path) {
      path = location.pathname;
      pendingReset = true;
      navigationUntil = 0;
      signature = "";
      clearHighlight();
    }
    const next = Core.readConversation(document);
    const nextSignature = JSON.stringify(next.map((turn) => [turn.key, turn.title, turn.excerpt, turn.answers.length, turn.sections.map((section) => section.label)]));
    turns = next; // Refresh DOM references even when visible labels remain unchanged.
    if (force || pendingReset || nextSignature !== signature) {
      signature = nextSignature;
      panel.setModel(turns, pendingReset);
      tocPanel.setTurns(turns, pendingReset);
      pendingReset = false;
    } else {
      panel.turns = turns;
      tocPanel.turns = turns;
    }
    positionOverlay();
    updateActive();
  }

  function scheduleScan() {
    if (disposed) return;
    const now = Date.now();
    if (!scanStarted) scanStarted = now;
    clearTimeout(scanTimer);
    // Debounce with a maximum wait so streaming never postpones updates indefinitely.
    scanTimer = setTimeout(scan, now - scanStarted > 900 ? 0 : 220);
  }

  function navigate(turn, section) {
    // Rerenders can replace headings without changing their labels; always use the latest DOM.
    const freshTurn = turns.find((item) => item.key === turn.key);
    const freshSection = section && freshTurn?.sections.find((item) => item.id === section.id);
    const target = section ? freshSection?.element : freshTurn?.element;
    if (!target?.isConnected) { scan(true); panel.toast("这段内容尚未加载，请先向上滚动加载历史消息"); return; }
    navigationUntil = Date.now() + 1100;
    panel.setActive(turn.key, section?.id || "");
    tocPanel.setActive(turn.key, section?.id || "");
    if (section) tocPanel.expandTo(section.id);
    clearHighlight();
    target.setAttribute("data-threadmark-focus", "true");
    highlight = target;
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start", inline: "nearest" });
    highlightTimer = setTimeout(clearHighlight, 1800);
    if (window.innerWidth < 600) { panel.setOpen(false, false); tocPanel.setOpen(false); }
  }

  function clearHighlight() {
    clearTimeout(highlightTimer);
    highlight?.removeAttribute("data-threadmark-focus");
    highlight = null;
  }

  function updateActive() {
    scrollFrame = 0;
    if (Date.now() < navigationUntil && turns.some((turn) => turn.key === tocPanel.activeTurn)) {
      // Keep a clicked destination stable during smooth scrolling, while still refreshing streaming sections.
      tocPanel.setActive(tocPanel.activeTurn, tocPanel.activeSection);
      return;
    }
    if (!turns.length) { tocPanel.setActive(""); return; }
    const boundary = 155;
    let active = turns[0];
    let sectionId = "";
    for (const turn of turns) {
      if (turn.element.getBoundingClientRect().top <= boundary) active = turn;
      else break;
    }
    for (const section of active.sections) {
      if (section.element.getBoundingClientRect().top <= boundary) sectionId = section.id;
      else break;
    }
    panel.setActive(active.key, sectionId);
    tocPanel.setActive(active.key, sectionId);
  }

  function onScroll(event) {
    // Sidebar scrolling must never move the active marker for the conversation itself.
    if (event.composedPath().includes(panel.host) || event.composedPath().includes(tocPanel.host)) return;
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateActive);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.target !== panel.host && !panel.host.contains(mutation.target) && mutation.target !== tocPanel.host && !tocPanel.host.contains(mutation.target) && mutation.target !== layoutStyle && !layoutStyle.contains(mutation.target))) scheduleScan();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "class", "style", "data-message-author-role", "data-chatgpt-search-unit-key", "data-message-id"]
  });
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  const onPopState = () => scheduleScan();
  window.addEventListener("popstate", onPopState);
  const onKey = (event) => {
    // Demo fallback; the packaged extension handles the shortcut through chrome.commands.
    if (!globalThis.chrome?.runtime?.id && event.altKey && event.shiftKey && event.code === "KeyO") {
      event.preventDefault(); panel.setOpen(!panel.open, true);
    }
  };
  document.addEventListener("keydown", onKey);
  const onResize = () => positionOverlay();
  window.addEventListener("resize", onResize);
  const onOutside = (event) => { if (!panel.pinned && !event.composedPath().includes(panel.host)) panel.setOpen(false); };
  document.addEventListener("pointerdown", onOutside);
  const interval = setInterval(() => {
    if (location.pathname !== path) scan();
    if (!panel.host.isConnected) { document.body.append(panel.host); positionOverlay(); }
    if (!tocPanel.host.isConnected) document.body.append(tocPanel.host);
  }, 1200);

  const onMessage = (message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === "threadmark:toggle") { panel.setOpen(!panel.open, true); respond({ open: panel.open }); }
  };
  if (globalThis.chrome?.runtime?.id) {
    chrome.runtime.onMessage.addListener(onMessage);
    disposers.push(() => chrome.runtime.onMessage.removeListener(onMessage));
  }

  function destroy() {
    if (disposed) return;
    disposed = true;
    observer.disconnect(); clearTimeout(scanTimer); clearInterval(interval); cancelAnimationFrame(scrollFrame);
    clearHighlight(); clearTimeout(panel.toastTimer); clearTimeout(panel.closeTimer);
    document.removeEventListener("scroll", onScroll, true);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onOutside);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("popstate", onPopState);
    disposers.forEach((dispose) => dispose());
    document.querySelectorAll("main[data-threadmark-toc-pinned]").forEach((main) => main.removeAttribute("data-threadmark-toc-pinned"));
    tocPanel.destroy();
    layoutStyle.remove(); panel.host.remove();
  }
  // A BFCache navigation freezes and later resumes this same document; keep its panel alive.
  window.addEventListener("pagehide", (event) => { if (!event.persisted) destroy(); });

  scan(true);
  if (globalThis.chrome?.storage?.local) {
    const restoreRevision = preferenceRevision;
    chrome.storage.local.get(preferenceKey).then((data) => {
      if (!disposed && preferenceRevision === restoreRevision) {
        const saved = data[preferenceKey];
        if (typeof saved?.open === "boolean") {
          preferences.open = saved.open;
          panel.pinned = saved.open;
          panel.setOpen(saved.open);
        }
        if (typeof saved?.tocPinned === "boolean") {
          preferences.tocPinned = saved.tocPinned;
          tocPanel.setPinned(saved.tocPinned);
        }
      }
    }).catch(() => {});
  }
})();
