"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const extension = path.resolve(__dirname, "..");
const Core = require(path.join(extension, "src/core.js"));
const pause = (ms = 340) => new Promise((resolve) => setTimeout(resolve, ms));
const user = (id, text) => `<article><div data-message-author-role="user" data-message-id="${id}"><p>${text}</p></div></article>`;
const answer = (id, content) => `<article><div data-message-author-role="assistant" data-message-id="${id}"><div class="markdown">${content}</div></div></article>`;
const fixture = () => user("u1", "认识分布式事务") + answer("a1", "<h2>1. 基础认知</h2><h3>1.1 本地事务</h3><p>普通正文</p>") + user("u2", "如何使用消息队列？") + answer("a2", "<h2>2. 消息方案</h2><h3>2.1 消费幂等</h3><h3>2.2 对账与重试</h3>");

function create(content, options = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><main>${content}</main></body></html>`, { url: "https://chatgpt.com/c/test-one", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  const scrolled = [];
  window.HTMLElement.prototype.scrollIntoView = function (settings) { scrolled.push({ element: this, settings }); };
  const writes = [];
  const listeners = new Set();
  if (options.chrome) window.chrome = {
    runtime: { id: "our-extension", onMessage: { addListener: (listener) => listeners.add(listener), removeListener: (listener) => listeners.delete(listener) } },
    storage: { local: { get: async () => options.saved || {}, set: async (data) => writes.push(data) } }
  };
  return { dom, window, document: window.document, scrolled, writes, listeners, cleanup() { window.dispatchEvent(new window.Event("pagehide")); window.close(); } };
}

function boot(content = fixture(), options) {
  const result = create(content, options);
  for (const file of ["core.js", "styles.js", "panel.js", "section-panel.js", "content.js"]) result.window.eval(fs.readFileSync(path.join(extension, "src", file), "utf8"));
  result.root = result.document.getElementById("threadmark-outline").shadowRoot;
  result.tocRoot = result.document.getElementById("threadmark-section-outline").shadowRoot;
  return result;
}

test("numbered sections include nested, full-width, and Chinese numbering", () => {
  assert.equal(Core.numberedTitle("1.1 标题").depth, 2);
  assert.equal(Core.numberedTitle("1.2.3 深层小节").depth, 3);
  assert.equal(Core.numberedTitle("２.１ 标题"), null);
  assert.equal(Core.numberedTitle("1．2 小节").number, "1.2");
  assert.equal(Core.numberedTitle("2. 方案").depth, 1);
  assert.equal(Core.numberedTitle("一、背景").number, "一");
  assert.equal(Core.numberedTitle("2.1 2PC：协调多个数据库统一提交").number, "2.1");
  assert.equal(Core.numberedTitle("1. 3D 渲染方案").number, "1");
  for (const text of ["普通内容", "1.1", "1.2.3", "1.2.3-beta", "2026.10.26 更新", "3.14%", "1.2 ms", "2.5 元"]) assert.equal(Core.numberedTitle(text), null, text);
});

test("old page structure groups multiple assistant answers under the same user round", () => {
  const env = create(user("u1", "问题") + answer("a1", "<h2>1. 标题</h2>") + answer("a1-more", "<h3>1.1 补充</h3>") + user("u2", "未回答"));
  try {
    const turns = Core.readConversation(env.document);
    assert.equal(turns.length, 2);
    assert.equal(turns[0].answers.length, 2);
    assert.equal(turns[0].sections.length, 2);
    assert.equal(turns[1].answers.length, 0);
  } finally { env.cleanup(); }
});

test("new 2026 search-unit structure and nested old selectors do not duplicate messages", () => {
  const env = create('<div data-chatgpt-search-unit-key="fallback-turn-0:0:user"><div data-message-author-role="user" data-message-id="nested-user">请讲解</div></div><div data-chatgpt-search-unit-key="fallback-turn-0:1:reasoning">思考中</div><div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant"><h4 class="sr-only" data-conversation-role="assistant">ChatGPT said:</h4><div><h1>一、整体思路</h1><h2>1.1 第一节</h2></div></div>');
  try {
    const messages = Core.extractMessages(env.document);
    assert.equal(messages.length, 2);
    const turns = Core.buildTurns(messages);
    assert.equal(turns.length, 1);
    assert.equal(turns[0].title, "请讲解");
    assert.deepEqual(turns[0].sections.map((s) => s.label), ["一、整体思路", "1.1 第一节"]);
    assert.deepEqual(turns[0].sections.map((s) => s.depth), [0, 1]);
  } finally { env.cleanup(); }
});

test("accessible speaker markers provide a fallback without generated class names", () => {
  const env = create('<div><h4 class="sr-only">You said:</h4><div>问题摘要</div></div><div><h4 data-conversation-role="assistant" class="sr-only">ChatGPT said:</h4><div><h2>1. 答案</h2></div></div>');
  try { assert.equal(Core.readConversation(env.document)[0].sections.length, 1); assert.equal(Core.readConversation(env.document)[0].title, "问题摘要"); }
  finally { env.cleanup(); }
});

test("sections exclude code, tables, quotes, screen-reader labels, numeric citations, and hidden branches", () => {
  const env = create(user("u1", "问题") + answer("a1", '<h2>1. 合法标题</h2><p><strong>1.1 合法编号段落</strong></p><pre><code><p>1.2 假标题</p></code></pre><table><tr><td><p>1.3 表格内容</p></td></tr></table><blockquote><h3>1.4 引用标题</h3></blockquote><h4 class="sr-only">辅助文本</h4><h2>10</h2><div style="display:none"><h3>1.5 隐藏标题</h3></div><h3 aria-hidden="true">1.6 隐藏标题</h3>') + '<div style="display:none">' + answer("hidden-answer", "<h2>1.7 旧分支</h2>") + '</div>');
  try { assert.deepEqual(Core.readConversation(env.document)[0].sections.map((s) => s.label), ["1. 合法标题", "1.1 合法编号段落"]); }
  finally { env.cleanup(); }
});

test("same section titles in different rounds retain distinct navigation IDs", () => {
  const env = create(user("u1", "问题一") + answer("a1", "<h3>1.1 同名标题</h3>") + user("u2", "问题二") + answer("a2", "<h3>1.1 同名标题</h3>"));
  try { const turns = Core.readConversation(env.document); assert.notEqual(turns[0].sections[0].id, turns[1].sections[0].id); }
  finally { env.cleanup(); }
});

test("a branch changed through visibility attributes is re-indexed", async () => {
  const env = boot(user("u1", "分支测试") + '<div id="branch-one">' + answer("a1", "<h2>1. 原始回答</h2>") + '</div><div id="branch-two" hidden>' + answer("a2", "<h2>1. 重新生成的回答</h2>") + '</div>');
  try {
    env.document.getElementById("branch-one").hidden = true;
    env.document.getElementById("branch-two").hidden = false;
    await pause();
    assert.equal(env.root.querySelectorAll(".section").length, 1);
    assert.equal(env.root.querySelector(".section-title").textContent, "重新生成的回答");
  } finally { env.cleanup(); }
});

test("scroll position updates the active round and section without navigation", async () => {
  const env = boot();
  try {
    env.document.querySelector('[data-message-id="u1"]').getBoundingClientRect = () => ({ top: -1000 });
    env.document.querySelector('[data-message-id="u2"]').getBoundingClientRect = () => ({ top: -300 });
    const sections = [...env.document.querySelectorAll('[data-message-id="a2"] h2,[data-message-id="a2"] h3')];
    sections.forEach((section, index) => { section.getBoundingClientRect = () => ({ top: [-200, 100, 400][index] }); });
    env.document.dispatchEvent(new env.window.Event("scroll"));
    await pause(45);
    assert.match(env.root.querySelector('.turn-link[aria-current="location"]').getAttribute("aria-label"), /第 2 轮/);
    assert.equal(env.root.querySelector('.section[aria-current="location"]').getAttribute("aria-label"), "2.1 消费幂等");
  } finally { env.cleanup(); }
});

test("a document restored from BFCache retains the panel and resumes updates", async () => {
  const env = boot();
  try {
    env.window.dispatchEvent(new env.window.PageTransitionEvent("pagehide", { persisted: true }));
    assert.ok(env.document.getElementById("threadmark-outline"));
    env.document.querySelector("main").insertAdjacentHTML("beforeend", user("u3", "缓存恢复后提问"));
    await pause();
    assert.equal(env.root.querySelectorAll(".turn").length, 3);
  } finally { env.cleanup(); }
});

test("attachment-only questions and unloaded user messages have explicit fallbacks", () => {
  const env = create(answer("orphan", "<h2>1. 回答</h2>") + user("image-only", '<img alt="附件">'));
  try { const turns = Core.readConversation(env.document); assert.match(turns[0].title, /未加载提问/); assert.equal(turns[1].title, "图片或附件提问"); }
  finally { env.cleanup(); }
});

test("outline navigation opens a round, targets its question, and jumps to an exact section", () => {
  const env = boot();
  try {
    assert.equal(env.root.querySelectorAll(".turn").length, 2);
    assert.equal(env.root.querySelectorAll('.disclosure[aria-expanded="true"]').length, 1);
    env.root.querySelector('.turn-link[aria-label^="第 1 轮"]').click();
    assert.equal(env.scrolled.at(-1).element.getAttribute("data-message-id"), "u1");
    env.root.querySelector('.section[aria-label="1.1 本地事务"]').click();
    assert.equal(env.scrolled.at(-1).element.textContent, "1.1 本地事务");
    assert.equal(env.scrolled.at(-1).element.getAttribute("data-threadmark-focus"), "true");
    assert.equal(env.root.querySelector('.section[aria-current="location"]').textContent, "1.1本地事务");
    assert.equal(env.scrolled.length, 2, "one scroll call per navigation, avoiding conflicting smooth scroll animations");
  } finally { env.cleanup(); }
});

test("search filters a round by content or exact number, and clearing restores all rounds", () => {
  const env = boot();
  try {
    const search = env.root.querySelector(".search-input");
    search.value = "幂等"; search.dispatchEvent(new env.window.Event("input"));
    assert.equal(env.root.querySelectorAll(".turn").length, 1);
    assert.match(env.root.querySelector(".turn-title").textContent, /消息队列/);
    assert.equal(env.root.querySelector(".children").hidden, false);
    search.value = "第1轮"; search.dispatchEvent(new env.window.Event("input"));
    assert.equal(env.root.querySelectorAll(".turn").length, 1);
    assert.match(env.root.querySelector(".turn-title").textContent, /分布式事务/);
    env.root.querySelector(".clear").click();
    assert.equal(env.root.querySelectorAll(".turn").length, 2);
  } finally { env.cleanup(); }
});

test("round jump clears a filter, expands the destination, and rejects an out-of-range round", () => {
  const env = boot();
  try {
    env.root.querySelector("#turn-number").value = "1";
    env.root.querySelector(".jump").dispatchEvent(new env.window.Event("submit", { bubbles: true, cancelable: true }));
    assert.equal(env.scrolled.at(-1).element.getAttribute("data-message-id"), "u1");
    env.root.querySelector("#turn-number").value = "99";
    env.root.querySelector(".jump").dispatchEvent(new env.window.Event("submit", { bubbles: true, cancelable: true }));
    assert.match(env.root.querySelector(".toast").textContent, /1–2/);
    assert.equal(env.scrolled.length, 1);
  } finally { env.cleanup(); }
});

test("new rounds and streaming headings are indexed while manual collapse survives updates", async () => {
  const env = boot();
  try {
    env.root.querySelector(".collapse-all").click();
    const markdown = env.document.querySelector('[data-message-id="a2"] .markdown');
    markdown.insertAdjacentHTML("beforeend", "<h3>2.3 新增内容</h3>");
    await pause();
    assert.equal(env.root.querySelectorAll(".section").length, 6);
    assert.equal(env.root.querySelectorAll('.disclosure[aria-expanded="true"]').length, 0);
    env.document.querySelector("main").insertAdjacentHTML("beforeend", user("u3", "第三个问题") + answer("a3", "<h2>3. 新回答</h2>"));
    await pause();
    assert.equal(env.root.querySelectorAll(".turn").length, 3);
    assert.equal(env.root.querySelectorAll('.disclosure[aria-expanded="true"]').length, 1);
    assert.match(env.root.querySelector('.disclosure[aria-expanded="true"]').getAttribute("aria-label"), /第 3 轮/);
  } finally { env.cleanup(); }
});

test("continuous streaming has a bounded refresh delay", async () => {
  const env = boot();
  try {
    const heading = env.document.createElement("h3");
    env.document.querySelector('[data-message-id="a2"] .markdown').append(heading);
    let tick = 0;
    const timer = setInterval(() => { heading.textContent = `3.1 流式内容 ${++tick}`; }, 35);
    await pause(1150);
    clearInterval(timer);
    assert.ok([...env.root.querySelectorAll(".section")].some((node) => node.textContent.includes("流式内容")));
  } finally { env.cleanup(); }
});

test("re-rendered DOM with identical labels is used when an existing outline button is clicked", async () => {
  const env = boot();
  try {
    const oldHeading = env.document.querySelector('[data-message-id="a2"] h3');
    const replacement = oldHeading.cloneNode(true);
    oldHeading.replaceWith(replacement);
    await pause();
    env.root.querySelector('.section[aria-label="2.1 消费幂等"]').click();
    assert.equal(env.scrolled.at(-1).element, replacement);
    assert.equal(oldHeading.isConnected, false);
  } finally { env.cleanup(); }
});

test("SPA conversation changes remove old rounds and reset search", async () => {
  const env = boot();
  try {
    const search = env.root.querySelector(".search-input");
    search.value = "幂等"; search.dispatchEvent(new env.window.Event("input"));
    env.window.history.pushState({}, "", "/c/test-two");
    env.document.querySelector("main").innerHTML = user("new-user", "全新的会话") + answer("new-answer", "<h2>1. 新会话目录</h2>");
    await pause();
    assert.equal(env.root.querySelectorAll(".turn").length, 1);
    assert.equal(search.value, "");
    assert.equal(env.root.querySelector(".turn-title").textContent, "全新的会话");
    assert.ok(!env.root.querySelector(".tree").textContent.includes("幂等"));
  } finally { env.cleanup(); }
});

test("untrusted message text remains text inside the outline", () => {
  const env = boot(user("u1", '&lt;img src=x onerror=alert(1)&gt;') + answer("a1", '<h2>1. &lt;script&gt;alert(1)&lt;/script&gt;</h2>'));
  try {
    assert.equal(env.root.querySelectorAll("img,script").length, 0);
    assert.match(env.root.querySelector(".turn-title").textContent, /<img/);
    assert.match(env.root.querySelector(".section-title").textContent, /<script>/);
  } finally { env.cleanup(); }
});

test("preferences store only booleans and toolbar messages require the same extension ID", async () => {
  const env = boot(fixture(), { chrome: true });
  try {
    await pause(10);
    env.root.querySelector(".minimize").click();
    assert.equal(env.root.querySelector(".panel").hidden, true);
    assert.equal(env.document.querySelector("main").hasAttribute("data-threadmark-dock"), false);
    assert.deepEqual(JSON.parse(JSON.stringify(env.writes.at(-1))), { "threadmark:preferences": { open: false, tocPinned: false } });
    const listener = [...env.listeners][0];
    listener({ type: "threadmark:toggle" }, { id: "another-extension" }, () => {});
    assert.equal(env.root.querySelector(".panel").hidden, true);
    listener({ type: "threadmark:toggle" }, { id: "our-extension" }, () => {});
    assert.equal(env.root.querySelector(".panel").hidden, false);
  } finally { env.cleanup(); }
});

test("manifest assets exist and extension code has no remote requests or remote scripts", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  const assets = [manifest.background.service_worker, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap((entry) => entry.js)];
  for (const file of assets) assert.ok(fs.existsSync(path.join(extension, file)), file);
  for (const file of assets.filter((file) => file.endsWith(".js"))) {
    const source = fs.readFileSync(path.join(extension, file), "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//);
  }
});

test("the initial UI is a compact rail and hover previews a round without navigating", () => {
  const env = boot();
  try {
    assert.equal(env.root.querySelector(".panel").hidden, true);
    assert.equal(env.root.querySelectorAll(".rail-turn").length, 2);
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').dispatchEvent(new env.window.MouseEvent("mouseenter"));
    assert.equal(env.root.querySelector(".panel").hidden, false);
    assert.equal(env.root.querySelector(".directory").hidden, true);
    assert.equal(env.root.querySelector(".preview-title").textContent, "认识分布式事务");
    assert.equal(env.root.querySelector(".preview-excerpt").textContent, "普通正文");
    assert.equal(env.scrolled.length, 0);
  } finally { env.cleanup(); }
});

test("clicking a rail marker navigates without pinning, and explicit pinning protects the preview", () => {
  const env = boot();
  try {
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').click();
    assert.equal(env.root.querySelector(".directory").hidden, false);
    assert.equal(env.root.querySelector(".pin").getAttribute("aria-pressed"), "false");
    assert.equal(env.scrolled.at(-1).element.getAttribute("data-message-id"), "u1");
    const displayed = [...env.root.querySelectorAll(".turn")].filter((node) => !node.hidden);
    assert.equal(displayed.length, 1);
    assert.equal(displayed[0].dataset.turnKey, "u1");
    env.root.querySelector(".pin").click();
    assert.equal(env.root.querySelector(".pin").getAttribute("aria-pressed"), "true");
    env.root.querySelector('.rail-turn[data-turn-key="u2"]').dispatchEvent(new env.window.MouseEvent("mouseenter"));
    assert.equal(env.root.querySelector(".preview-title").textContent, "认识分布式事务", "hover must not replace a pinned card");
    env.root.querySelector('.rail-turn[data-turn-key="u2"]').click();
    assert.equal(env.root.querySelector(".preview-title").textContent, "如何使用消息队列？");
  } finally { env.cleanup(); }
});

test("an unpinned hover card closes after the pointer leaves", async () => {
  const env = boot();
  try {
    env.root.querySelector(".rail-turn").dispatchEvent(new env.window.MouseEvent("mouseenter"));
    env.root.querySelector(".rail").dispatchEvent(new env.window.MouseEvent("mouseleave"));
    await pause(280);
    assert.equal(env.root.querySelector(".panel").hidden, true);
  } finally { env.cleanup(); }
});

test("closing a keyboard-focused card does not reopen it through the rail focus handler", async () => {
  const env = boot();
  try {
    env.root.querySelector(".rail-turn").click();
    const close = env.root.querySelector(".minimize");
    close.focus(); close.click();
    await pause(10);
    assert.equal(env.root.querySelector(".panel").hidden, true);
    assert.equal(env.root.querySelector(".pin").getAttribute("aria-pressed"), "false");
    assert.ok(env.root.activeElement.classList.contains("rail-turn"));
  } finally { env.cleanup(); }
});

test("the preview excerpt follows a streaming answer even if its headings stay the same", async () => {
  const env = boot();
  try {
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').dispatchEvent(new env.window.MouseEvent("mouseenter"));
    env.document.querySelector('[data-message-id="a1"] p').textContent = "更新后的回答开头";
    await pause();
    assert.equal(env.root.querySelector(".preview-excerpt").textContent, "更新后的回答开头");
  } finally { env.cleanup(); }
});

test("opening or pinning the card leaves ChatGPT's original layout untouched", () => {
  const env = boot();
  try {
    const main = env.document.querySelector("main");
    const original = main.getAttribute("style");
    env.root.querySelector(".rail-turn").click();
    assert.equal(main.getAttribute("style"), original);
    assert.equal(main.hasAttribute("data-threadmark-dock"), false);
    env.root.querySelector(".minimize").click();
    assert.equal(main.getAttribute("style"), original);
  } finally { env.cleanup(); }
});

test("clicking a search result in another round updates the card preview to that round", () => {
  const env = boot();
  try {
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').click();
    const search = env.root.querySelector(".search-input");
    search.value = "幂等"; search.dispatchEvent(new env.window.Event("input"));
    env.root.querySelector('.section[aria-label="2.1 消费幂等"]').click();
    assert.equal(env.root.querySelector(".preview-title").textContent, "如何使用消息队列？");
    assert.equal(env.scrolled.at(-1).element.textContent, "2.1 消费幂等");
  } finally { env.cleanup(); }
});

test("the right directory follows the reading round, independently of a left hover preview", () => {
  const env = boot();
  try {
    assert.equal(env.tocRoot.querySelector(".toc-card").hidden, true);
    assert.equal(env.tocRoot.querySelectorAll(".toc-mark").length, 3);
    assert.equal(env.tocRoot.querySelector(".toc-title").textContent, "如何使用消息队列？");
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').dispatchEvent(new env.window.MouseEvent("mouseenter"));
    assert.equal(env.tocRoot.querySelector(".toc-title").textContent, "如何使用消息队列？");
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').click();
    assert.equal(env.tocRoot.querySelectorAll(".toc-item").length, 2);
    assert.equal(env.tocRoot.querySelector(".toc-title").textContent, "认识分布式事务");
    assert.ok(!env.tocRoot.querySelector(".toc-list").textContent.includes("消费幂等"));
  } finally { env.cleanup(); }
});

test("right rail hover opens without scrolling and a section click navigates to its actual heading", () => {
  const env = boot();
  try {
    const mark = env.tocRoot.querySelector('[aria-label="定位小节 2.1 消费幂等"]');
    mark.dispatchEvent(new env.window.MouseEvent("mouseenter"));
    assert.equal(env.tocRoot.querySelector(".toc-card").hidden, false);
    assert.equal(env.scrolled.length, 0);
    env.tocRoot.querySelector('.toc-item[aria-label="2.1 消费幂等"]').click();
    assert.equal(env.scrolled.at(-1).element.textContent, "2.1 消费幂等");
    assert.equal(env.tocRoot.querySelector('.toc-item[aria-current="location"]').getAttribute("aria-label"), "2.1 消费幂等");
    assert.equal(env.root.querySelector('.rail-turn[aria-current="location"]').dataset.turnKey, "u2");
  } finally { env.cleanup(); }
});

test("pinning the right directory follows round changes and closing restores the page layout", async () => {
  const env = boot(fixture(), { chrome: true });
  try {
    await pause(10);
    const main = env.document.querySelector("main");
    env.tocRoot.querySelector(".toc-mark").click();
    env.tocRoot.querySelector(".toc-pin").click();
    assert.equal(main.getAttribute("data-threadmark-toc-pinned"), "true");
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').click();
    assert.equal(env.tocRoot.querySelector(".toc-card").hidden, false);
    assert.equal(env.tocRoot.querySelector(".toc-title").textContent, "认识分布式事务");
    assert.equal(env.tocRoot.querySelector(".toc-pin").getAttribute("aria-pressed"), "true");
    env.tocRoot.querySelector(".toc-close").click();
    assert.equal(main.hasAttribute("data-threadmark-toc-pinned"), false);
    assert.equal(main.getAttribute("style"), null);
    assert.equal(env.root.querySelector(".panel").hidden, false, "left card stays open");
    assert.equal(env.tocRoot.querySelectorAll(".toc-mark").length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(env.writes.at(-1))), { "threadmark:preferences": { open: false, tocPinned: false } });
  } finally { env.cleanup(); }
});

test("scrollspy switches the right directory and keeps sidebar scrolling independent", async () => {
  const env = boot();
  try {
    env.document.querySelector('[data-message-id="u1"]').getBoundingClientRect = () => ({ top: -300 });
    env.document.querySelector('[data-message-id="u2"]').getBoundingClientRect = () => ({ top: 900 });
    env.document.querySelector('[data-message-id="a1"] h2').getBoundingClientRect = () => ({ top: -100 });
    env.document.querySelector('[data-message-id="a1"] h3').getBoundingClientRect = () => ({ top: 100 });
    env.document.dispatchEvent(new env.window.Event("scroll"));
    await pause(45);
    assert.equal(env.tocRoot.querySelector(".toc-title").textContent, "认识分布式事务");
    assert.equal(env.tocRoot.querySelector('.toc-item[aria-current="location"]').getAttribute("aria-label"), "1.1 本地事务");
    env.document.querySelector('[data-message-id="u2"]').getBoundingClientRect = () => ({ top: -100 });
    env.tocRoot.querySelector(".toc-list").dispatchEvent(new env.window.Event("scroll", { composed: true }));
    await pause(45);
    assert.equal(env.tocRoot.querySelector(".toc-title").textContent, "认识分布式事务");
  } finally { env.cleanup(); }
});

test("the right directory refreshes streaming headings during a navigation lock and uses replacement DOM", async () => {
  const env = boot();
  try {
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').click();
    const markdown = env.document.querySelector('[data-message-id="a1"] .markdown');
    markdown.insertAdjacentHTML("beforeend", "<h3>1.2 新的小节</h3>");
    const oldHeading = markdown.querySelector("h3");
    const replacement = oldHeading.cloneNode(true);
    oldHeading.replaceWith(replacement);
    await pause();
    assert.equal(env.tocRoot.querySelectorAll(".toc-item").length, 3);
    env.tocRoot.querySelector('.toc-item[aria-label="1.1 本地事务"]').click();
    assert.equal(env.scrolled.at(-1).element, replacement);
  } finally { env.cleanup(); }
});

test("Escape closes only the right directory and returns keyboard focus without reopening it", async () => {
  const env = boot();
  try {
    env.root.querySelector(".rail-turn").click();
    env.tocRoot.querySelector(".toc-mark").click();
    env.tocRoot.querySelector(".toc-pin").click();
    const item = env.tocRoot.querySelector(".toc-item");
    item.focus();
    item.dispatchEvent(new env.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    await pause(10);
    assert.equal(env.tocRoot.querySelector(".toc-card").hidden, true);
    assert.equal(env.tocRoot.querySelector(".toc-pin").getAttribute("aria-pressed"), "false");
    assert.ok(env.tocRoot.activeElement.classList.contains("toc-mark"));
    assert.equal(env.root.querySelector(".panel").hidden, false);
  } finally { env.cleanup(); }
});

test("SPA changes replace the pinned right directory and an empty page removes stale sections", async () => {
  const env = boot();
  try {
    env.tocRoot.querySelector(".toc-pin").click();
    env.window.history.pushState({}, "", "/c/another");
    env.document.querySelector("main").innerHTML = user("new-u", "新主题") + answer("new-a", "<h2>1. 新目录</h2>");
    await pause();
    assert.equal(env.tocRoot.querySelectorAll(".toc-item").length, 1);
    assert.equal(env.tocRoot.querySelector(".toc-title").textContent, "新主题");
    assert.equal(env.tocRoot.querySelector(".toc-card").hidden, false);
    env.window.history.pushState({}, "", "/");
    env.document.querySelector("main").replaceChildren();
    await pause();
    assert.equal(env.tocRoot.querySelector(".toc-card").hidden, true);
    assert.equal(env.tocRoot.querySelectorAll(".toc-item").length, 0);
    assert.equal(env.document.querySelector("main").hasAttribute("data-threadmark-toc-pinned"), false);
  } finally { env.cleanup(); }
});

test("saved right pin is restored separately from the left card, with an explicit empty-answer state", async () => {
  const env = boot(user("u1", "正在等待回答"), { chrome: true, saved: { "threadmark:preferences": { open: false, tocPinned: true } } });
  try {
    await pause(10);
    assert.equal(env.root.querySelector(".panel").hidden, true);
    assert.equal(env.tocRoot.querySelector(".toc-card").hidden, false);
    assert.match(env.tocRoot.querySelector(".toc-empty").textContent, /回答生成后/);
    env.document.querySelector("main").insertAdjacentHTML("beforeend", answer("a1", "<p>这是一段没有标题的回答。</p>"));
    await pause();
    assert.match(env.tocRoot.querySelector(".toc-empty").textContent, /暂无可识别/);
  } finally { env.cleanup(); }
});

test("section hierarchy respects semantic chapter levels and numbered sublevels", () => {
  const env = create(user("u1", "章节") + answer("a1", "<h1>一、背景</h1><h2>1. 方案</h2><h2>1.1 小节</h2><h2>2. 另一方案</h2><h1>二、实现</h1><h2>1. 实施</h2>"));
  try { assert.deepEqual(Core.readConversation(env.document)[0].sections.map((section) => section.depth), [0, 1, 2, 1, 0, 1]); }
  finally { env.cleanup(); }
});

test("mouse-focused rail buttons do not keep either hover card open after leaving", async () => {
  const env = boot();
  try {
    for (const [root, marker, rail, card] of [
      [env.root, ".rail-turn", ".rail", ".panel"],
      [env.tocRoot, ".toc-mark", ".toc-rail", ".toc-card"]
    ]) {
      const button = root.querySelector(marker);
      button.click();
      button.focus();
      // jsdom lacks input modality: model the browser's pointer-only focus state.
      const matches = button.matches.bind(button);
      button.matches = (selector) => selector === ":focus-visible" ? false : matches(selector);
      root.querySelector(rail).dispatchEvent(new env.window.MouseEvent("mouseleave"));
      await pause(280);
      assert.equal(root.querySelector(card).hidden, true);
      button.blur();
    }
  } finally { env.cleanup(); }
});

test("right directory chapters collapse independently without navigating, including nested chapters", () => {
  const env = boot(user("u1", "章节折叠") + answer("a1", "<h1>一、背景</h1><h2>1. 方案</h2><h3>1.1 细节</h3><h1>二、实现</h1><h2>1. 步骤</h2>"));
  try {
    env.tocRoot.querySelector(".toc-mark").click();
    const toggle = (label) => env.tocRoot.querySelector(`.toc-toggle[aria-label="${label}"]`);
    const group = (button) => env.tocRoot.getElementById(button.getAttribute("aria-controls"));
    const nested = toggle("收起章节 1. 方案");
    nested.click();
    assert.equal(group(nested).hidden, true);
    const chapter = toggle("收起章节 一、背景");
    chapter.click();
    assert.equal(chapter.getAttribute("aria-expanded"), "false");
    assert.equal(group(chapter).hidden, true);
    assert.equal(group(toggle("收起章节 二、实现")).hidden, false);
    assert.equal(env.scrolled.length, 1, "disclosure clicks must not navigate");
    chapter.click();
    assert.equal(group(chapter).hidden, false);
    assert.equal(group(nested).hidden, true, "reopening a parent preserves the child's own collapse state");
    env.tocRoot.querySelector('.toc-item[aria-label="一、背景"]').click();
    assert.equal(env.scrolled.at(-1).element.textContent, "一、背景");
    assert.equal(env.tocRoot.querySelector(".toc-pin").getAttribute("aria-pressed"), "false");
  } finally { env.cleanup(); }
});

test("right chapter collapse survives streaming and round switches, then resets for another conversation", async () => {
  const env = boot();
  try {
    const toggle = env.tocRoot.querySelector('.toc-toggle[aria-label="收起章节 2. 消息方案"]');
    toggle.click();
    env.document.querySelector('[data-message-id="a2"] .markdown').insertAdjacentHTML("beforeend", "<h3>2.3 流式新增</h3>");
    await pause();
    const added = env.tocRoot.querySelector('.toc-item[aria-label="2.3 流式新增"]');
    assert.equal(added.closest(".toc-children").hidden, true);
    env.root.querySelector('.rail-turn[data-turn-key="u1"]').click();
    env.root.querySelector('.rail-turn[data-turn-key="u2"]').click();
    assert.ok(env.tocRoot.querySelector('.toc-toggle[aria-label="展开章节 2. 消息方案"]'));
    assert.equal(env.tocRoot.querySelector('.toc-item[aria-label="2.1 消费幂等"]').closest(".toc-children").hidden, true);
    env.window.history.pushState({}, "", "/c/other-conversation");
    env.document.querySelector("main").innerHTML = env.document.querySelector("main").innerHTML;
    await pause();
    assert.ok(env.tocRoot.querySelector('.toc-toggle[aria-label="收起章节 2. 消息方案"]'));
  } finally { env.cleanup(); }
});

test("scrolling within a collapsed chapter highlights its visible parent, while explicit jumps reveal the target", async () => {
  const env = boot();
  try {
    env.tocRoot.querySelector('.toc-mark[aria-label="定位小节 2.1 消费幂等"]').click();
    const toggle = env.tocRoot.querySelector('.toc-toggle[aria-label="收起章节 2. 消息方案"]');
    toggle.click();
    const parent = env.tocRoot.querySelector('.toc-item[aria-label="2. 消息方案"]');
    assert.equal(parent.classList.contains("contains-active"), true);
    env.document.dispatchEvent(new env.window.Event("scroll"));
    await pause(30);
    assert.equal(toggle.getAttribute("aria-expanded"), "false", "scrollspy must respect manual collapse");
    env.tocRoot.querySelector('.toc-mark[aria-label="定位小节 2.2 对账与重试"]').click();
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(parent.classList.contains("contains-active"), false);
    assert.equal(env.scrolled.at(-1).element.textContent, "2.2 对账与重试");
    assert.equal(env.tocRoot.querySelector('.toc-item[aria-label="2.2 对账与重试"]').classList.contains("active"), true);
  } finally { env.cleanup(); }
});
