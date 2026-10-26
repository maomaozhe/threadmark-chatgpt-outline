(function (scope) {
  "use strict";

  const normalize = (value) => String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
  const shorten = (value, length = 80) => {
    const text = normalize(value);
    return text.length > length ? text.slice(0, length - 1) + "…" : text;
  };

  function numberedTitle(value) {
    const text = normalize(value).replace(/^[#＃]{1,6}\s*/, "");
    // A title must have text after its number; dates, decimals and versions are not headings.
    const decimal = text.match(/^(\d{1,3}(?:[.．]\d{1,3}){1,5})(?:[、:：)）]\s*|[.．]\s+|\s+)(\S.*)$/u) || text.match(/^(\d{1,3}(?:[.．]\d{1,3}){1,5})(\p{L}.*)$/u);
    if (decimal) {
      const title = decimal[2];
      if (/^\d+(?:[.．]\d+)*$/.test(title)) return null;
      if (/^(?:%|％|元|美元|人民币|MB|GB|ms|秒|毫秒)(?:\s|$)/i.test(title)) return null;
      return { number: decimal[1].replace(/．/g, "."), title, depth: decimal[1].split(/[.．]/).length };
    }
    const single = text.match(/^(\d{1,3})\s*(?:[、)）:：]\s*|[.．]\s+)(\S.*)$/u) || text.match(/^(\d{1,3})\s*[、.．)）:：]\s*([^\d\s.．].*)$/u);
    if (single) return { number: single[1], title: single[2], depth: 1 };
    const chinese = text.match(/^([一二三四五六七八九十百]+)[、.．:：)）]\s*(.+)$/u);
    if (chinese) return { number: chinese[1], title: chinese[2], depth: 1 };
    return null;
  }

  function isVisible(element, cache = new WeakMap()) {
    if (!element?.isConnected) return false;
    if (cache.has(element)) return cache.get(element);
    if (element.matches('[hidden],[aria-hidden="true"],template')) { cache.set(element, false); return false; }
    const view = element.ownerDocument.defaultView;
    const style = view?.getComputedStyle(element);
    const visible = (!style || (style.display !== "none" && style.visibility !== "hidden")) && (!element.parentElement || isVisible(element.parentElement, cache));
    cache.set(element, visible);
    return visible;
  }

  function getRole(element) {
    const explicit = element.getAttribute("data-message-author-role");
    if (explicit === "user" || explicit === "assistant") return explicit;
    const key = element.getAttribute("data-chatgpt-search-unit-key") || "";
    const match = key.match(/:(user|assistant)$/);
    if (match) return match[1];
    const marker = element.querySelector(":scope > [data-conversation-role]");
    return marker?.getAttribute("data-conversation-role") || null;
  }

  function extractMessages(document, visibility = new WeakMap()) {
    const container = document.querySelector("main") || document.body;
    const selector = '[data-message-author-role="user"],[data-message-author-role="assistant"],[data-chatgpt-search-unit-key]';
    const candidates = [...container.querySelectorAll(selector)].filter((element) => getRole(element) && isVisible(element, visibility));
    // Some releases put the old author attribute inside the newer search-unit wrapper.
    const candidateSet = new Set(candidates);
    const messages = candidates.filter((element) => {
      for (let parent = element.parentElement; parent && parent !== container; parent = parent.parentElement) {
        if (candidateSet.has(parent)) return false;
      }
      return true;
    });
    if (!messages.length) {
      // Accessible speaker markers are a fallback; no generated React class names are used.
      for (const marker of container.querySelectorAll('[data-conversation-role="assistant"],h4.sr-only')) {
        const label = normalize(marker.textContent);
        const role = marker.getAttribute("data-conversation-role") || (/^(?:You said:|你说[：:]|您说[：:])$/i.test(label) ? "user" : /^(?:ChatGPT said:|ChatGPT 说[：:])$/i.test(label) ? "assistant" : null);
        const element = marker.parentElement;
        if (role && isVisible(element, visibility) && !messages.some((item) => item.element === element)) messages.push({ element, role });
      }
      return messages.map((message, index) => ({ ...message, key: messageKey(message.element, index), content: message.element }));
    }
    return messages.map((element, index) => ({
      element,
      content: element.querySelector(".markdown,.prose,[data-message-content]") || element,
      role: getRole(element),
      key: messageKey(element, index)
    }));
  }

  function messageKey(element, index) {
    return element.getAttribute("data-message-id") || element.getAttribute("data-chatgpt-search-unit-key") || element.getAttribute("data-chatgpt-search-message-ids") || element.closest("[data-message-id]")?.getAttribute("data-message-id") || `message-${index}`;
  }

  function contentText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('h4.sr-only,[data-conversation-role],button,script,style,[aria-hidden="true"]').forEach((node) => node.remove());
    return normalize(clone.textContent);
  }

  function collectSections(root, key = "answer", visibility = new WeakMap()) {
    const result = [];
    const candidates = root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li");
    for (const element of candidates) {
      if (!isVisible(element, visibility) || element.closest("pre,code,table,blockquote,nav,button") || element.matches(".sr-only,[data-conversation-role]")) continue;
      // Numbered paragraphs inside a list item will be handled once by the paragraph.
      if (element.tagName === "LI" && element.querySelector("p,h1,h2,h3,h4,h5,h6")) continue;
      const heading = /^H[1-6]$/.test(element.tagName);
      if (!heading && element.parentElement?.closest("h1,h2,h3,h4,h5,h6")) continue;
      const raw = normalize(element.textContent);
      if (!raw || raw.length > (heading ? 240 : 140)) continue;
      const numbered = numberedTitle(raw);
      // Plain prose is included only when it starts with an explicit section number.
      if (!heading && !numbered) continue;
      if (heading && /^\d+$/.test(raw)) continue;
      const lines = (element.innerText || element.textContent).split("\n").filter((line) => normalize(line));
      // A bold first line can introduce a longer paragraph without indexing its body.
      const lead = element.firstElementChild;
      let label = raw;
      if (!heading && raw.length > 100) {
        if (lead?.matches("strong,b") && numberedTitle(lead.textContent)) label = normalize(lead.textContent);
        else if (lines.length > 1 && numberedTitle(lines[0])) label = normalize(lines[0]);
        else continue;
      }
      const parsed = numberedTitle(label);
      result.push({
        id: `${key}:section-${result.length}`,
        label: shorten(label, 150),
        number: parsed?.number || "",
        title: parsed?.title || label,
        // Semantic levels preserve H1 > H2 even when each restarts at "1.";
        // the suffix also nests 1 > 1.1 when both use the same heading tag.
        rank: (heading ? Number(element.tagName.slice(1)) : (parsed?.depth || 1) + 1) * 10 + (parsed?.depth || 1) - 1,
        numbered: Boolean(parsed),
        element
      });
    }
    // Compress skipped heading levels, retaining numbered nesting such as 1 > 1.1 > 1.1.1.
    const stack = [];
    for (const section of result) {
      while (stack.length && stack[stack.length - 1].rank >= section.rank) stack.pop();
      section.depth = Math.min(stack.length, 5);
      section.parentId = stack[stack.length - 1]?.id || null;
      stack.push(section);
    }
    return result;
  }

  function buildTurns(messages, visibility = new WeakMap()) {
    const turns = [];
    let current = null;
    for (const message of messages) {
      if (message.role === "user") {
        current = { key: message.key, number: turns.length + 1, user: message, answers: [], sections: [], element: message.element, title: shorten(contentText(message.content), 76) || "图片或附件提问" };
        turns.push(current);
      } else if (message.role === "assistant") {
        if (!current) {
          current = { key: `orphan-${message.key}`, number: turns.length + 1, user: null, answers: [], sections: [], element: message.element, title: "回答（当前页面未加载提问）" };
          turns.push(current);
        }
        current.answers.push(message);
        if (!current.excerpt) {
          const paragraph = [...message.content.querySelectorAll("p")].find((node) => !node.closest("pre,code,table,blockquote") && isVisible(node, visibility));
          current.excerpt = shorten(paragraph?.textContent || contentText(message.content), 180);
        }
        current.sections.push(...collectSections(message.content, message.key, visibility));
      }
    }
    return turns;
  }

  function readConversation(document) {
    const visibility = new WeakMap();
    return buildTurns(extractMessages(document, visibility), visibility);
  }

  function matchesQuery(turn, query) {
    const q = normalize(query).toLocaleLowerCase();
    if (!q) return true;
    const number = q.match(/^(?:第\s*)?(\d+)\s*(?:轮)?$/);
    if (number) return turn.number === Number(number[1]);
    return `${turn.title} ${turn.sections.map((section) => section.label).join(" ")}`.toLocaleLowerCase().includes(q);
  }

  const api = { normalize, shorten, numberedTitle, isVisible, extractMessages, collectSections, buildTurns, readConversation, matchesQuery };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else scope.ThreadmarkCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
