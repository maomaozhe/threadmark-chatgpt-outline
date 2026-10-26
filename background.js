"use strict";

async function toggle(tab) {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "threadmark:toggle" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    await chrome.action.setTitle({ tabId: tab.id, title: "显示 / 收起对话目录" });
  } catch {
    // No content script on other websites or on a ChatGPT tab opened before installation.
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#8a5c28" });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "↻" });
    await chrome.action.setTitle({ tabId: tab.id, title: "请打开或刷新 ChatGPT 网页，再点击对话目录" });
  }
}

chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-outline") return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await toggle(tab);
});
