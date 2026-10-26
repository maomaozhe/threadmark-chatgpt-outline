"use strict";
let round = 3;
document.getElementById("add-turn").addEventListener("click", () => {
  round += 1;
  const host = document.getElementById("new-turns");
  const user = document.createElement("article");
  user.innerHTML = `<div data-message-author-role="user" data-message-id="u${round}"><div class="question">第 ${round} 轮练习：帮我整理这次学习的行动清单。</div></div>`;
  const answer = document.createElement("article");
  answer.innerHTML = `<div data-message-author-role="assistant" data-message-id="a${round}"><div class="markdown"><h2>1. 把知识变成验证</h2><h3>1.1 画出完整业务链路</h3><p>从入口、消息投递到消费落库，标出每个可能失败的位置。</p><h3>1.2 为失败设计可恢复路径</h3><p>验证幂等、重试与对账，记录每个状态如何推进。</p><h2>2. 建立复习节奏</h2><h3>2.1 用自己的语言讲一遍</h3><p>把核心概念讲清楚，再用一个小项目验证理解。</p></div></div>`;
  host.append(user, answer);
});
let stream = 0;
document.getElementById("stream-answer").addEventListener("click", () => {
  const roots = document.querySelectorAll('[data-message-author-role="assistant"] .markdown');
  const root = roots[roots.length - 1];
  stream += 1;
  const heading = document.createElement("h3");
  root.append(heading);
  const label = `4.${stream} 流式补充：目录会自动更新`;
  let index = 0;
  const timer = setInterval(() => {
    heading.textContent = label.slice(0, ++index);
    if (index >= label.length) {
      clearInterval(timer);
      const paragraph = document.createElement("p");
      paragraph.textContent = "这是逐字写入的新小节，用来验证持续生成过程中目录仍会及时更新。";
      root.append(paragraph);
    }
  }, 60);
});
