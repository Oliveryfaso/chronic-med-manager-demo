const STATE_KEY = "chronic-med-manager-state-v1";
const ACCESS_KEY = "chronic-med-manager-accessibility-v1";

const defaultState = {
  doseChecks: {
    d0730: true,
    adh_0730: true,
    d1230: true,
    adh_1230: true,
    d1930: false,
    adh_1930: false,
    d1930_metformin: false,
    adh_1930_metformin: false,
    d2200: false,
    adh_2200: false
  },
  notes: [
    {
      content: "昨晚轻微头晕，休息后缓解。",
      severity: "轻度",
      ts: "2026-04-23T21:10:00+08:00"
    },
    {
      content: "午后血糖偏高，已减少甜食。",
      severity: "中度",
      ts: "2026-04-22T14:35:00+08:00"
    }
  ],
  lastAiResult: null
};

const defaultAccessibility = {
  elderMode: false,
  highContrast: false,
  reducedMotion: false,
  simpleHome: true,
  contact: {
    name: "王敏",
    relation: "女儿",
    phone: "13800138000"
  },
  contactLogs: [
    {
      ts: "2026-04-24T18:30:00+08:00",
      page: "首页",
      action: "quick_help",
      detail: "触发求助提示并查看紧急建议"
    },
    {
      ts: "2026-04-24T18:36:00+08:00",
      page: "首页",
      action: "call_contact",
      detail: "尝试联系王敏（女儿）"
    }
  ]
};

const CARE_PROFILE = {
  name: "王宁",
  age: 67,
  conditions: ["高血压", "糖代谢异常", "血脂偏高"],
  routine: "晚餐后和睡前容易被家务、看电视打断",
  followUpDate: "2026-05-03",
  refillLeadDays: 3
};

const MEDICATIONS = [
  {
    id: "metformin",
    name: "二甲双胍",
    english: "Metformin",
    dose: "500mg",
    frequency: "每日 2 次",
    purpose: "控制血糖",
    timing: "早餐后 / 晚餐后",
    caution: "避免空腹服用，关注胃部反应",
    stockDays: 13,
    doses: [
      { id: "d0730", pairedId: "adh_0730", time: "07:30", label: "早餐后", meta: "搭配进食，减少胃肠不适" },
      { id: "d1930_metformin", pairedId: "adh_1930_metformin", time: "19:30", label: "晚餐后", meta: "与晚餐绑定提醒，减少遗漏" }
    ]
  },
  {
    id: "valsartan",
    name: "缬沙坦",
    english: "Valsartan",
    dose: "80mg",
    frequency: "每日 1 次",
    purpose: "稳定血压",
    timing: "午餐后",
    caution: "固定时段执行，避免漏服",
    stockDays: 4,
    doses: [{ id: "d1230", pairedId: "adh_1230", time: "12:30", label: "午餐后", meta: "建议固定餐后 30 分钟内完成" }]
  },
  {
    id: "atorvastatin",
    name: "阿托伐他汀",
    english: "Atorvastatin",
    dose: "20mg",
    frequency: "每日 1 次",
    purpose: "降脂方案",
    timing: "晚餐后",
    caution: "夜间服用更利于依从",
    stockDays: 9,
    doses: [{ id: "d1930", pairedId: "adh_1930", time: "19:30", label: "晚餐后", meta: "可与二甲双胍合并提醒" }]
  },
  {
    id: "amlodipine",
    name: "氨氯地平",
    english: "Amlodipine",
    dose: "5mg",
    frequency: "每日 1 次",
    purpose: "长效降压",
    timing: "睡前",
    caution: "注意头晕、低血压反应",
    stockDays: 16,
    doses: [{ id: "d2200", pairedId: "adh_2200", time: "22:00", label: "睡前", meta: "建议与睡前洗漱绑定" }]
  }
];

const DOSE_ID_ALIASES = MEDICATIONS.flatMap((med) =>
  med.doses.map((dose) => [dose.id, dose.pairedId]).filter((pair) => pair[0] && pair[1])
);

const emergencyRuntime = {
  active: false,
  secondsLeft: 7,
  countdownTimer: null,
  dialTimer: null,
  alarmInterval: null,
  audioContext: null,
  numbers: []
};

const HOME_SEARCH_INDEX = [
  {
    name: "二甲双胍",
    aliases: ["metformin", "降糖药", "早餐后"],
    type: "focus",
    selector: "[data-dose-id='d0730']"
  },
  {
    name: "缬沙坦",
    aliases: ["valsartan", "降压药", "午餐后"],
    type: "focus",
    selector: "[data-dose-id='d1230']"
  },
  {
    name: "阿托伐他汀",
    aliases: ["atorvastatin", "降脂药", "晚餐后"],
    type: "focus",
    selector: "[data-dose-id='d1930']"
  },
  {
    name: "氨氯地平",
    aliases: ["amlodipine", "睡前药", "降压"],
    type: "focus",
    selector: "[data-dose-id='d2200']"
  },
  {
    name: "库存预警",
    aliases: ["库存", "续方提醒", "药快没了"],
    type: "focus",
    selector: ".dashboard-inventory-panel"
  },
  {
    name: "复诊准备",
    aliases: ["复诊摘要", "随访", "复诊"],
    type: "focus",
    selector: ".dashboard-followup-panel"
  },
  {
    name: "用药计划",
    aliases: ["药单", "服药计划"],
    type: "goto",
    href: "./plan.html"
  },
  {
    name: "打卡记录",
    aliases: ["依从率", "打卡", "症状记录"],
    type: "goto",
    href: "./adherence.html"
  },
  {
    name: "续方复诊",
    aliases: ["续方", "补药", "复诊"],
    type: "goto",
    href: "./refill.html"
  },
  {
    name: "漏服补救",
    aliases: ["漏服", "AI助手", "漏服助手"],
    type: "goto",
    href: "./ai-assist.html"
  },
  {
    name: "长辈模式",
    aliases: ["老人模式", "大字模式", "字体放大"],
    type: "action",
    action: "elder-mode"
  },
  {
    name: "辅助功能",
    aliases: ["高对比", "减少动效", "语音朗读"],
    type: "action",
    action: "assist-panel"
  }
];

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return deepClone(fallback);
    }
    return JSON.parse(raw);
  } catch (error) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return deepClone(fallback);
  }
}

function writeJsonStorage(key, payload) {
  localStorage.setItem(key, JSON.stringify(payload));
}

function normalizePhone(value) {
  return `${value || ""}`.replace(/[^\d+]/g, "").trim();
}

function formatPhoneDisplay(value) {
  const digits = normalizePhone(value);
  if (!digits) return "未设置号码";
  if (digits.startsWith("+")) return digits;

  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
  }

  if (digits.length > 7) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }

  return digits;
}

function readState() {
  const parsed = readJsonStorage(STATE_KEY, defaultState);
  const doseChecks = {
    ...deepClone(defaultState).doseChecks,
    ...(parsed.doseChecks || {})
  };

  DOSE_ID_ALIASES.forEach(([primaryId, pairedId]) => {
    const saved = parsed.doseChecks || {};
    if (Object.prototype.hasOwnProperty.call(saved, primaryId) || Object.prototype.hasOwnProperty.call(saved, pairedId)) {
      const value = Boolean(Object.prototype.hasOwnProperty.call(saved, primaryId) ? saved[primaryId] : saved[pairedId]);
      doseChecks[primaryId] = value;
      doseChecks[pairedId] = value;
    }
  });

  return {
    ...deepClone(defaultState),
    ...parsed,
    doseChecks,
    notes: Array.isArray(parsed.notes) ? parsed.notes : deepClone(defaultState).notes
  };
}

function readAccessibility() {
  const parsed = readJsonStorage(ACCESS_KEY, defaultAccessibility);
  return {
    ...deepClone(defaultAccessibility),
    ...parsed,
    contact: {
      ...deepClone(defaultAccessibility).contact,
      ...(parsed.contact || {})
    },
    contactLogs: Array.isArray(parsed.contactLogs) ? parsed.contactLogs : deepClone(defaultAccessibility).contactLogs
  };
}

const state = readState();
const accessibility = readAccessibility();

function writeState(payload) {
  writeJsonStorage(STATE_KEY, payload);
}

function writeAccessibility(payload) {
  writeJsonStorage(ACCESS_KEY, payload);
}

function escapeHtml(str) {
  return `${str}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(input) {
  const d = new Date(input);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(input) {
  const d = new Date(input);
  const h = `${d.getHours()}`.padStart(2, "0");
  const m = `${d.getMinutes()}`.padStart(2, "0");
  return `${h}:${m}`;
}

function formatDateTime(input) {
  return `${formatDate(input)} ${formatTime(input)}`;
}

function addDays(input, days) {
  const d = new Date(input);
  d.setDate(d.getDate() + days);
  return d;
}

function getAllDoseIds(kind = "home") {
  return MEDICATIONS.flatMap((med) =>
    med.doses.map((dose) => (kind === "adherence" ? dose.pairedId : dose.id)).filter(Boolean)
  );
}

function findMedicationByDoseId(doseId) {
  for (const med of MEDICATIONS) {
    const dose = med.doses.find((item) => item.id === doseId || item.pairedId === doseId);
    if (dose) return { med, dose };
  }
  return null;
}

function getDoseAliases(doseId) {
  const pair = DOSE_ID_ALIASES.find(([a, b]) => a === doseId || b === doseId);
  return pair || [doseId];
}

function setDoseCheck(doseId, checked) {
  getDoseAliases(doseId).forEach((id) => {
    state.doseChecks[id] = checked;
  });
}

function isDoseChecked(doseId) {
  return getDoseAliases(doseId).some((id) => Boolean(state.doseChecks[id]));
}

function getAdherenceSnapshot() {
  const ids = getAllDoseIds("home");
  const done = ids.filter((id) => isDoseChecked(id)).length;
  const total = ids.length;
  const ratio = total ? Math.round((done / total) * 100) : 0;
  const missed = ids
    .filter((id) => !isDoseChecked(id))
    .map((id) => findMedicationByDoseId(id))
    .filter(Boolean);
  const eveningMissed = missed.filter(({ dose }) => parseHourMinute(dose.time) >= 18 * 60).length;

  return { ids, done, total, ratio, missed, eveningMissed };
}

function getLowestStockMedicine() {
  return MEDICATIONS.slice().sort((a, b) => a.stockDays - b.stockDays)[0];
}

function getRefillRiskInfo(med) {
  const now = new Date();
  const runOutDate = addDays(now, med.stockDays);
  const latestRefillDate = addDays(now, Math.max(1, med.stockDays - (med.stockDays <= 5 ? 1 : CARE_PROFILE.refillLeadDays)));
  const followUpDate = new Date(`${CARE_PROFILE.followUpDate}T00:00:00+08:00`);
  const gapDays = Math.ceil((followUpDate - runOutDate) / 86400000);
  const priority = med.stockDays <= 5 ? "高优先级" : med.stockDays <= 10 ? "中优先级" : "低优先级";
  const reason =
    gapDays > 0
      ? `预计 ${formatDate(runOutDate)} 断药，早于 ${formatDate(followUpDate)} 复诊 ${gapDays} 天，建议先续方再复诊。`
      : `预计库存可覆盖到复诊窗口，但仍建议在 ${formatDate(latestRefillDate)} 前确认处方。`;

  return { runOutDate, latestRefillDate, followUpDate, gapDays, priority, reason };
}

function isDashboardPage() {
  return document.body.getAttribute("data-page") === "dashboard";
}

function isMainCarePage() {
  const page = document.body.getAttribute("data-page") || "";
  return ["dashboard", "plan", "adherence", "refill", "ai-assist"].includes(page);
}

function getCurrentPageLabel() {
  const page = document.body.getAttribute("data-page") || "";
  const map = {
    dashboard: "首页",
    plan: "用药计划",
    adherence: "打卡记录",
    refill: "续方复诊",
    "ai-assist": "AI 漏服助手"
  };
  return map[page] || "页面";
}

function getToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  container.style.position = "fixed";
  container.style.right = window.matchMedia("(max-width: 780px)").matches ? "10px" : "18px";
  container.style.zIndex = "100";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  syncToastOffset(container);
  return container;
}

function syncToastOffset(containerArg) {
  const container = containerArg || document.getElementById("toast-container");
  if (!container) return;

  const mobile = window.matchMedia("(max-width: 780px)").matches;
  const hasEmergency = Boolean(document.getElementById("emergency-fab"));
  const bottom = hasEmergency ? (mobile ? 84 : 92) : mobile ? 64 : 72;
  container.style.bottom = `${bottom}px`;
}

function showToast(text) {
  const container = getToastContainer();
  const node = document.createElement("div");
  node.className = "user-pill";
  node.style.background = "rgba(16, 42, 38, 0.88)";
  node.style.color = "#fff";
  node.style.marginTop = "8px";
  node.textContent = text;
  container.appendChild(node);

  setTimeout(() => {
    node.remove();
  }, 2600);
}

function setPressed(el, on) {
  if (!el) return;
  el.setAttribute("aria-pressed", on ? "true" : "false");
  el.classList.toggle("active", on);
}

function getContactInfo() {
  const contact = accessibility.contact || defaultAccessibility.contact;
  const name = (contact.name || "未设置联系人").trim() || "未设置联系人";
  const relation = (contact.relation || "家属").trim() || "家属";
  const phoneRaw = normalizePhone(contact.phone || "");

  return {
    name,
    relation,
    phoneRaw,
    phoneDisplay: formatPhoneDisplay(phoneRaw),
    hasPhone: Boolean(phoneRaw)
  };
}

function getContactLogs() {
  return Array.isArray(accessibility.contactLogs) ? accessibility.contactLogs : [];
}

function logActionLabel(action) {
  const map = {
    quick_help: "触发求助",
    call_contact: "联系家属",
    update_contact: "更新联系人",
    call_link: "快捷拨号",
    emergency_trigger: "紧急呼叫",
    emergency_cancel: "取消紧急呼叫",
    emergency_dial: "自动拨号"
  };
  return map[action] || "辅助动作";
}

function pushContactLog(action, detail) {
  const entry = {
    ts: new Date().toISOString(),
    page: getCurrentPageLabel(),
    action,
    detail
  };

  accessibility.contactLogs = [entry, ...getContactLogs()].slice(0, 20);
  writeAccessibility(accessibility);
  renderContactLogs();
}

function renderContactLogs() {
  const logs = getContactLogs().slice(0, 8);
  const wraps = document.querySelectorAll("[data-bind='contact-log-list']");
  const latest = logs[0];
  const latestText = latest
    ? `${logActionLabel(latest.action || "")} · ${latest.page || "页面"} · ${formatTime(latest.ts || new Date().toISOString())}`
    : "暂无联络记录";

  document.querySelectorAll("[data-bind='contact-last-log']").forEach((el) => {
    el.textContent = latestText;
  });

  if (!wraps.length) return;

  wraps.forEach((wrap) => {
    if (!logs.length) {
      wrap.innerHTML = '<div class="assist-log-empty">暂无联络记录</div>';
      return;
    }

    wrap.innerHTML = logs
      .map((log) => {
        const page = escapeHtml(log.page || "页面");
        const detail = escapeHtml(log.detail || logActionLabel(log.action || ""));
        const action = escapeHtml(logActionLabel(log.action || ""));
        const ts = escapeHtml(formatDateTime(log.ts || new Date().toISOString()));
        return `
          <div class="assist-log-item">
            <p>${action} · ${page}</p>
            <span>${detail}</span>
            <small>${ts}</small>
          </div>
        `;
      })
      .join("");
  });
}

function bindContactCallLinks() {
  document.querySelectorAll("[data-bind='contact-call']").forEach((el) => {
    if (el.getAttribute("data-log-bound") === "1") return;
    el.setAttribute("data-log-bound", "1");

    el.addEventListener("click", (event) => {
      const contact = getContactInfo();
      if (!contact.hasPhone) {
        event.preventDefault();
        showToast("请先设置家属联系电话");
        return;
      }

      pushContactLog("call_link", `从快捷拨号联系${contact.name}`);
    });
  });
}

function updateContactBindings() {
  const contact = getContactInfo();

  document.querySelectorAll("[data-bind='contact-name']").forEach((el) => {
    el.textContent = contact.name;
  });

  document.querySelectorAll("[data-bind='contact-relation']").forEach((el) => {
    el.textContent = contact.relation;
  });

  document.querySelectorAll("[data-bind='contact-phone']").forEach((el) => {
    el.textContent = contact.phoneDisplay;
  });

  document.querySelectorAll("[data-bind='contact-call']").forEach((el) => {
    if (el.tagName.toLowerCase() !== "a") return;
    if (contact.hasPhone) {
      el.setAttribute("href", `tel:${contact.phoneRaw}`);
      el.removeAttribute("aria-disabled");
      el.classList.remove("disabled");
    } else {
      el.setAttribute("href", "#");
      el.setAttribute("aria-disabled", "true");
      el.classList.add("disabled");
    }
  });

  bindContactCallLinks();
}

function applyAccessibilityModes() {
  document.body.classList.toggle("elder-mode", accessibility.elderMode);
  document.body.classList.toggle("high-contrast", accessibility.highContrast);
  document.body.classList.toggle("reduce-motion", accessibility.reducedMotion);

  const simpleHomeEnabled = isDashboardPage() && accessibility.elderMode && accessibility.simpleHome;
  document.body.classList.toggle("elder-simple-home", simpleHomeEnabled);
}

function refreshAccessibilityUiState() {
  document.querySelectorAll("[data-bind='elder-state']").forEach((el) => {
    el.textContent = accessibility.elderMode ? "开" : "关";
  });
  document.querySelectorAll("[data-bind='contrast-state']").forEach((el) => {
    el.textContent = accessibility.highContrast ? "开" : "关";
  });
  document.querySelectorAll("[data-bind='motion-state']").forEach((el) => {
    el.textContent = accessibility.reducedMotion ? "开" : "关";
  });
  document.querySelectorAll("[data-bind='simple-home-state']").forEach((el) => {
    el.textContent = accessibility.simpleHome ? "开" : "关";
  });

  document.querySelectorAll("[data-action='toggle-elder']").forEach((el) => {
    setPressed(el, accessibility.elderMode);
  });
  document.querySelectorAll("[data-action='toggle-contrast']").forEach((el) => {
    setPressed(el, accessibility.highContrast);
  });
  document.querySelectorAll("[data-action='toggle-motion']").forEach((el) => {
    setPressed(el, accessibility.reducedMotion);
  });
  document.querySelectorAll("[data-action='toggle-simple-home']").forEach((el) => {
    setPressed(el, accessibility.simpleHome);
  });

  applyAccessibilityModes();
  updateContactBindings();
  renderContactLogs();
}

function toggleAccessibilityFlag(flag) {
  accessibility[flag] = !accessibility[flag];
  writeAccessibility(accessibility);
  refreshAccessibilityUiState();
}

function getPageNarration() {
  const page = document.body.getAttribute("data-page") || "generic";

  const summaryMap = {
    dashboard: "首页会优先展示今天最关键的服药任务，包括下一次服药时间、打卡进度、库存风险和复诊准备。",
    plan: "用药计划页把处方转成结构化执行矩阵，按时间和用法组织，便于患者每天照着执行。",
    adherence: "打卡记录页用于查看依从率趋势，并记录症状变化，帮助复诊时快速回顾最近状态。",
    refill: "续方复诊页会根据库存剩余天数推荐续方时间，并提醒复诊前需要准备的核心信息。",
    "ai-assist": "AI 漏服助手会根据药物类型和时间延迟窗口给出保守建议，并对高风险症状优先提示就医。"
  };

  return summaryMap[page] || "这是慢病用药小管家演示页面。";
}

function speakPageSummary() {
  if (!("speechSynthesis" in window)) {
    showToast("当前浏览器不支持语音朗读");
    return;
  }

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(getPageNarration());
  utter.lang = "zh-CN";
  utter.rate = accessibility.elderMode ? 0.9 : 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
  showToast("正在朗读本页核心信息");
}

function stopNarration() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  showToast("已停止朗读");
}

function triggerQuickHelp() {
  const contact = getContactInfo();
  const message = contact.hasPhone
    ? `紧急情况请立即拨打 120；常规协助可联系 ${contact.name}（${contact.relation}）${contact.phoneDisplay}`
    : "紧急情况请立即拨打 120；常规协助建议先在辅助功能中设置家属联系人。";

  const helpNode = document.getElementById("assist-help-note");
  if (helpNode) {
    helpNode.textContent = message;
  }

  document.querySelectorAll("[data-bind='emergency-guidance']").forEach((el) => {
    el.textContent = message;
  });

  pushContactLog("quick_help", "触发求助提示并显示紧急建议");
  showToast("已触发求助提示");
}

function callEmergencyContactDirect() {
  const contact = getContactInfo();
  if (!contact.hasPhone) {
    showToast("请先设置家属联系电话");
    return;
  }

  const note = document.getElementById("assist-help-note");
  if (note) {
    note.textContent = `已准备联系 ${contact.name}（${contact.relation}）${contact.phoneDisplay}`;
  }

  pushContactLog("call_contact", `尝试联系${contact.name}（${contact.relation}）`);
  showToast(`正在尝试拨打 ${contact.phoneDisplay}`);
  window.location.href = `tel:${contact.phoneRaw}`;
}

function setAssistPanelState(isOpen) {
  const panel = document.getElementById("assist-panel");
  if (!panel) return;

  panel.classList.toggle("open", isOpen);
  document.body.classList.toggle("assist-panel-open", isOpen);

  const fab = document.getElementById("assist-fab");
  if (fab) {
    fab.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  document.querySelectorAll("[data-action='toggle-assist']").forEach((el) => {
    el.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

function closeAssistPanel() {
  const panel = document.getElementById("assist-panel");
  if (!panel || !panel.classList.contains("open")) return;
  setAssistPanelState(false);
}

function injectSkipLink() {
  if (document.querySelector(".skip-link")) return;
  const main = document.querySelector("main");
  if (!main) return;

  if (!main.id) {
    main.id = "main-content";
  }

  const skip = document.createElement("a");
  skip.className = "skip-link";
  skip.href = `#${main.id}`;
  skip.textContent = "跳到主要内容";
  document.body.prepend(skip);
}

function injectDashboardPriorityPanel() {
  if (!isDashboardPage()) return;

  const grid = document.querySelector(".layout-grid");
  if (!grid || grid.querySelector(".elder-quick-panel")) return;

  const panel = document.createElement("article");
  panel.className = "panel span-12 elder-quick-panel";
  panel.innerHTML = `
    <header class="panel-head">
      <div>
        <p class="section-kicker">Elder Quick Actions</p>
        <h3 class="panel-title">长辈简化首页</h3>
      </div>
      <span class="badge ok">只保留高频动作</span>
    </header>
    <div class="elder-quick-grid">
      <button class="btn" type="button" data-action="mark-next-dose">我已完成下一次服药</button>
      <button class="btn-danger" type="button" data-action="call-contact">一键联系家属</button>
      <button class="btn-light" type="button" data-action="quick-help">显示求助建议</button>
      <a class="btn-ghost" href="./ai-assist.html" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center">漏服补救助手</a>
      <a class="btn-ghost" data-bind="contact-call" href="#" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center">联系 <span data-bind="contact-name">家属</span></a>
    </div>
    <p class="assist-help" data-bind="emergency-guidance">紧急情况请立即拨打 120；常规协助建议联系预设家属联系人。</p>
    <p class="footer-note">最近联络: <span data-bind="contact-last-log">暂无联络记录</span></p>
  `;

  grid.prepend(panel);
}

function injectEmergencyUi() {
  if (!isMainCarePage()) return;

  if (!document.getElementById("emergency-fab")) {
    const fab = document.createElement("button");
    fab.id = "emergency-fab";
    fab.className = "emergency-fab";
    fab.type = "button";
    fab.textContent = "紧急呼叫";
    fab.setAttribute("aria-label", "紧急呼叫");
    fab.setAttribute("aria-controls", "emergency-overlay");
    fab.setAttribute("aria-expanded", "false");
    fab.addEventListener("click", () => {
      openEmergencyOverlay(7);
    });
    document.body.appendChild(fab);
  }

  if (!document.getElementById("emergency-overlay")) {
    const overlay = document.createElement("section");
    overlay.id = "emergency-overlay";
    overlay.className = "emergency-overlay";
    overlay.setAttribute("aria-live", "assertive");
    overlay.innerHTML = `
      <div class="emergency-card" role="dialog" aria-modal="true" aria-label="紧急呼叫确认">
        <p class="emergency-entered">已进入紧急呼叫模式</p>
        <h3>紧急呼叫准备中</h3>
        <p class="emergency-message" id="emergency-message">系统将在 <b data-bind="emergency-seconds">7</b> 秒后自动拨号。若误触请立即取消紧急呼叫。</p>
        <p class="emergency-phones" id="emergency-phones">将拨打: 家属 + 120</p>
        <p class="emergency-status" id="emergency-status">倒计时进行中...</p>
        <div class="emergency-actions">
          <button class="btn-danger emergency-cancel-btn" type="button" data-action="cancel-emergency">取消紧急呼叫</button>
          <button class="btn-ghost emergency-dial-btn" type="button" data-action="dial-now">立即拨打</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector("[data-action='cancel-emergency']");
    const dialNowBtn = overlay.querySelector("[data-action='dial-now']");

    if (cancelBtn) {
      cancelBtn.addEventListener("click", cancelEmergencyFlow);
    }

    if (dialNowBtn) {
      dialNowBtn.addEventListener("click", () => {
        startEmergencyDialSequence(true);
      });
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cancelEmergencyFlow();
      }
    });
  }

  syncToastOffset(getToastContainer());
}

function getEmergencyDialTargets() {
  const contact = getContactInfo();
  const numbers = [];
  if (contact.hasPhone) {
    numbers.push({ label: `${contact.name}（${contact.relation}）`, value: contact.phoneRaw });
  }
  numbers.push({ label: "急救电话", value: "120" });
  return numbers;
}

function updateEmergencyOverlayInfo(secondsLeft) {
  const secondsNode = document.querySelector("[data-bind='emergency-seconds']");
  const phonesNode = document.getElementById("emergency-phones");
  const statusNode = document.getElementById("emergency-status");

  if (secondsNode) {
    secondsNode.textContent = `${secondsLeft}`;
  }

  if (phonesNode) {
    const readable = emergencyRuntime.numbers.map((item) => `${item.label} ${formatPhoneDisplay(item.value)}`).join(" -> ");
    phonesNode.textContent = `将拨打: ${readable}`;
  }

  if (statusNode && emergencyRuntime.active) {
    statusNode.textContent = `已进入紧急呼叫模式，剩余取消时间: ${secondsLeft} 秒`;
  }
}

function stopAlarmSound() {
  if (emergencyRuntime.alarmInterval) {
    clearInterval(emergencyRuntime.alarmInterval);
    emergencyRuntime.alarmInterval = null;
  }
}

function playAlarmBeep() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  if (!emergencyRuntime.audioContext) {
    emergencyRuntime.audioContext = new AudioCtx();
  }

  const ctx = emergencyRuntime.audioContext;
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.25);
}

function startAlarmSound() {
  stopAlarmSound();
  playAlarmBeep();
  emergencyRuntime.alarmInterval = setInterval(() => {
    playAlarmBeep();
  }, 380);
}

function setEmergencyOverlayOpen(open) {
  const overlay = document.getElementById("emergency-overlay");
  const fab = document.getElementById("emergency-fab");
  if (!overlay) return;

  overlay.classList.toggle("open", open);
  document.body.classList.toggle("emergency-open", open);
  if (fab) {
    fab.setAttribute("aria-expanded", open ? "true" : "false");
  }
}

function clearEmergencyTimers() {
  if (emergencyRuntime.countdownTimer) {
    clearInterval(emergencyRuntime.countdownTimer);
    emergencyRuntime.countdownTimer = null;
  }
  if (emergencyRuntime.dialTimer) {
    clearTimeout(emergencyRuntime.dialTimer);
    emergencyRuntime.dialTimer = null;
  }
}

function openEmergencyOverlay(seconds) {
  const targets = getEmergencyDialTargets();
  emergencyRuntime.numbers = targets;
  emergencyRuntime.secondsLeft = seconds;
  emergencyRuntime.active = true;

  setAssistPanelState(false);
  clearEmergencyTimers();
  setEmergencyOverlayOpen(true);
  updateEmergencyOverlayInfo(seconds);
  startAlarmSound();

  const statusNode = document.getElementById("emergency-status");
  if (statusNode) {
    statusNode.textContent = `已进入紧急呼叫模式，剩余取消时间: ${seconds} 秒`;
  }

  pushContactLog("emergency_trigger", "触发紧急呼叫倒计时");
  showToast("紧急呼叫已启动，7秒内可取消");

  emergencyRuntime.countdownTimer = setInterval(() => {
    emergencyRuntime.secondsLeft -= 1;
    updateEmergencyOverlayInfo(Math.max(emergencyRuntime.secondsLeft, 0));

    if (emergencyRuntime.secondsLeft <= 0) {
      clearEmergencyTimers();
      startEmergencyDialSequence(false);
    }
  }, 1000);
}

function cancelEmergencyFlow() {
  if (!emergencyRuntime.active) {
    setEmergencyOverlayOpen(false);
    return;
  }

  emergencyRuntime.active = false;
  clearEmergencyTimers();
  stopAlarmSound();
  setEmergencyOverlayOpen(false);

  const statusNode = document.getElementById("emergency-status");
  if (statusNode) {
    statusNode.textContent = "紧急呼叫已取消";
  }

  pushContactLog("emergency_cancel", "在倒计时阶段取消紧急呼叫");
  showToast("已取消紧急呼叫");
}

function dialNumbersSequentially(numbers, index = 0) {
  if (index >= numbers.length) {
    emergencyRuntime.active = false;
    setEmergencyOverlayOpen(false);
    return;
  }

  const current = numbers[index];
  const statusNode = document.getElementById("emergency-status");
  if (statusNode) {
    statusNode.textContent = `正在拨打 ${current.label} (${formatPhoneDisplay(current.value)})`;
  }

  window.location.href = `tel:${current.value}`;

  if (index + 1 < numbers.length) {
    emergencyRuntime.dialTimer = setTimeout(() => {
      dialNumbersSequentially(numbers, index + 1);
    }, 2400);
  } else {
    emergencyRuntime.dialTimer = setTimeout(() => {
      emergencyRuntime.active = false;
      setEmergencyOverlayOpen(false);
    }, 1600);
  }
}

function startEmergencyDialSequence(manual) {
  const numbers = emergencyRuntime.numbers.length ? emergencyRuntime.numbers : getEmergencyDialTargets();

  emergencyRuntime.active = true;
  clearEmergencyTimers();
  stopAlarmSound();

  const statusNode = document.getElementById("emergency-status");
  if (statusNode) {
    statusNode.textContent = "紧急呼叫已确认，正在自动拨号，请保持电话可用";
  }

  const source = manual ? "手动确认后开始拨号" : "倒计时结束自动拨号";
  pushContactLog("emergency_dial", `${source}（${numbers.map((n) => n.label).join(" -> ")}）`);
  showToast("正在执行紧急拨号流程");
  dialNumbersSequentially(numbers, 0);
}

function normalizeKeyword(value) {
  return `${value || ""}`.toLowerCase().replace(/\s+/g, "");
}

function findHomeSearchMatches(query) {
  const key = normalizeKeyword(query);
  if (!key) return [];

  const scored = HOME_SEARCH_INDEX.map((item) => {
    const terms = [item.name, ...(item.aliases || [])].map((term) => normalizeKeyword(term));
    let score = 0;

    terms.forEach((term) => {
      if (term === key) score = Math.max(score, 300);
      if (term.startsWith(key)) score = Math.max(score, 220);
      if (term.includes(key)) score = Math.max(score, 160);
      if (key.includes(term) && term.length >= 2) score = Math.max(score, 120);
    });

    return { item, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.item);
}

function pulseSearchTarget(node) {
  if (!node) return;
  node.classList.add("search-highlight");
  setTimeout(() => {
    node.classList.remove("search-highlight");
  }, 1400);
}

function setHomeSearchResult(message, isError = false) {
  const result = document.getElementById("home-search-results");
  if (!result) return;
  result.hidden = false;
  result.classList.toggle("error", isError);
  result.textContent = message;
}

function executeHomeSearchItem(item) {
  if (!item) return;

  if (item.type === "focus") {
    const target = document.querySelector(item.selector);
    if (!target) {
      setHomeSearchResult(`正在回到首页定位“${item.name}”。`);
      setTimeout(() => {
        window.location.href = `./index.html?search=${encodeURIComponent(item.name)}`;
      }, 220);
      return;
    }

    target.scrollIntoView({
      behavior: accessibility.reducedMotion ? "auto" : "smooth",
      block: "center"
    });

    pulseSearchTarget(target);
    setHomeSearchResult(`已定位到“${item.name}”。`);
    showToast(`已定位: ${item.name}`);
    return;
  }

  if (item.type === "goto") {
    setHomeSearchResult(`正在前往“${item.name}”。`);
    setTimeout(() => {
      window.location.href = item.href;
    }, 220);
    return;
  }

  if (item.type === "action" && item.action === "elder-mode") {
    if (!accessibility.elderMode) {
      toggleAccessibilityFlag("elderMode");
    }
    setAssistPanelState(true);
    setHomeSearchResult("已开启长辈模式，并打开辅助功能面板。");
    showToast("已开启长辈模式");
    return;
  }

  if (item.type === "action" && item.action === "assist-panel") {
    setAssistPanelState(true);
    setHomeSearchResult("已打开辅助功能面板。");
    showToast("辅助功能面板已打开");
  }
}

function bindHomeSearch() {
  const form = document.getElementById("home-search-form");
  const input = document.getElementById("home-search-input");
  const suggest = document.getElementById("home-search-suggest");
  const result = document.getElementById("home-search-results");
  if (!form || !input || !suggest || !result) return;

  const renderSuggestions = (list) => {
    const candidates = list.slice(0, 7);
    suggest.innerHTML = candidates
      .map((item) => `<button type="button" class="search-tag" data-search-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`)
      .join("");
  };

  const defaultList = HOME_SEARCH_INDEX.slice(0, 7);
  renderSuggestions(defaultList);
  result.hidden = true;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (!q) {
      renderSuggestions(defaultList);
      result.hidden = true;
      return;
    }

    const matches = findHomeSearchMatches(q);
    if (!matches.length) {
      suggest.innerHTML = '<span class="search-empty">没有匹配结果，可尝试“库存预警”或“漏服补救”</span>';
      setHomeSearchResult(`没有找到“${q}”，请换一个关键词。`, true);
      return;
    }

    renderSuggestions(matches);
    result.hidden = true;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const q = input.value.trim();

    if (!q) {
      setHomeSearchResult("请输入药物名或功能名，例如“二甲双胍”“续方复诊”。", true);
      return;
    }

    const matches = findHomeSearchMatches(q);
    if (!matches.length) {
      setHomeSearchResult(`没有找到“${q}”，请试试建议关键词。`, true);
      return;
    }

    executeHomeSearchItem(matches[0]);
  });

  suggest.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest("[data-search-name]");
    if (!btn) return;

    const name = btn.getAttribute("data-search-name") || "";
    input.value = name;
    const match = HOME_SEARCH_INDEX.find((item) => item.name === name) || findHomeSearchMatches(name)[0];
    executeHomeSearchItem(match);
  });

  const initialQuery = new URLSearchParams(window.location.search).get("search");
  if (initialQuery) {
    input.value = initialQuery;
    const matches = findHomeSearchMatches(initialQuery);
    renderSuggestions(matches.length ? matches : defaultList);
    if (matches[0]) {
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => executeHomeSearchItem(matches[0]), 120);
    }
  }
}

function injectAccessibilityUi() {
  if (!isMainCarePage()) return;

  const nav = document.querySelector(".top-nav-inner");
  if (nav && !document.querySelector(".nav-access")) {
    const navAccess = document.createElement("div");
    navAccess.className = "nav-access";
    navAccess.innerHTML = `
      <button class="elder-switch" type="button" data-action="toggle-elder" aria-pressed="false">
        <span class="switch-text">
          <span class="switch-title">长辈模式</span>
        </span>
        <span class="switch-dot" aria-hidden="true"></span>
      </button>
    `;
    nav.appendChild(navAccess);
  }

  if (!document.getElementById("assist-panel")) {
    const showSimpleHomeItem = isDashboardPage()
      ? `
        <button class="assist-item" type="button" data-action="toggle-simple-home" aria-pressed="false">
          <span>简化首页视图</span>
          <b data-bind="simple-home-state">开</b>
        </button>
      `
      : "";

    const panel = document.createElement("aside");
    panel.id = "assist-panel";
    panel.className = "assist-panel";
    panel.setAttribute("aria-label", "辅助功能面板");
    panel.innerHTML = `
      <div class="assist-panel-head">
        <strong>辅助功能</strong>
        <button type="button" class="assist-close" data-action="close-assist" aria-label="关闭辅助面板">关闭</button>
      </div>
      <div class="assist-list">
        <button class="assist-item" type="button" data-action="toggle-elder" aria-pressed="false">
          <span>长辈模式</span>
          <b data-bind="elder-state">关</b>
        </button>
        <button class="assist-item" type="button" data-action="toggle-contrast" aria-pressed="false">
          <span>高对比模式</span>
          <b data-bind="contrast-state">关</b>
        </button>
        <button class="assist-item" type="button" data-action="toggle-motion" aria-pressed="false">
          <span>减少动效</span>
          <b data-bind="motion-state">关</b>
        </button>
        ${showSimpleHomeItem}
        <button class="assist-item" type="button" data-action="speak-summary">
          <span>朗读本页重点</span>
          <b>播报</b>
        </button>
        <button class="assist-item" type="button" data-action="stop-speak">
          <span>停止朗读</span>
          <b>停止</b>
        </button>
        <button class="assist-item" type="button" data-action="quick-help">
          <span>快速求助提示</span>
          <b>触发</b>
        </button>
        <button class="assist-item" type="button" data-action="call-contact">
          <span>一键联系家属</span>
          <b>拨号</b>
        </button>
      </div>

      <div class="assist-contact-card">
        <div class="assist-contact-head">
          <strong>家属紧急联系人</strong>
          <button type="button" class="assist-edit" data-action="toggle-contact-editor">编辑</button>
        </div>
        <p class="assist-contact-meta"><span data-bind="contact-name">王敏</span> · <span data-bind="contact-relation">女儿</span></p>
        <p class="assist-contact-phone" data-bind="contact-phone">138 0013 8000</p>
        <a class="assist-call" data-bind="contact-call" href="#">一键拨号</a>
      </div>

      <form id="assist-contact-form" class="assist-contact-form" novalidate>
        <label class="assist-field">
          <span>联系人</span>
          <input id="contact-name-input" maxlength="20" placeholder="例如: 王敏" />
        </label>
        <label class="assist-field">
          <span>关系</span>
          <input id="contact-relation-input" maxlength="20" placeholder="例如: 女儿" />
        </label>
        <label class="assist-field">
          <span>电话</span>
          <input id="contact-phone-input" maxlength="20" placeholder="例如: 13800138000" inputmode="tel" />
        </label>
        <button type="submit" class="assist-save">保存联系人</button>
      </form>

      <div class="assist-log-wrap">
        <div class="assist-log-head">
          <strong>最近联络记录</strong>
          <span>最多展示 8 条</span>
        </div>
        <div class="assist-log-list" data-bind="contact-log-list"></div>
      </div>

      <p class="assist-tip">快捷键: Alt+E 长辈模式 | Alt+H 高对比 | Alt+S 简化首页 | Alt+R 朗读</p>
      <p class="assist-help" id="assist-help-note">常规问题优先联系家属，急症立即拨打 120。</p>
    `;

    const fab = document.createElement("button");
    fab.id = "assist-fab";
    fab.className = "assist-fab";
    fab.type = "button";
    fab.textContent = "辅助";
    fab.setAttribute("aria-controls", "assist-panel");
    fab.setAttribute("aria-expanded", "false");

    document.body.appendChild(panel);
    document.body.appendChild(fab);
  }

  const assistPanel = document.getElementById("assist-panel");
  const assistFab = document.getElementById("assist-fab");

  if (assistFab) {
    assistFab.addEventListener("click", () => {
      setAssistPanelState(!assistPanel.classList.contains("open"));
    });
  }

  document.querySelectorAll("[data-action='toggle-assist']").forEach((btn) => {
    btn.addEventListener("click", () => {
      setAssistPanelState(!assistPanel.classList.contains("open"));
    });
  });

  document.querySelectorAll("[data-action='close-assist']").forEach((btn) => {
    btn.addEventListener("click", () => {
      setAssistPanelState(false);
    });
  });

  document.querySelectorAll("[data-action='toggle-elder']").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleAccessibilityFlag("elderMode");
      showToast(accessibility.elderMode ? "已开启长辈模式" : "已关闭长辈模式");
    });
  });

  document.querySelectorAll("[data-action='toggle-contrast']").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleAccessibilityFlag("highContrast");
      showToast(accessibility.highContrast ? "已开启高对比模式" : "已关闭高对比模式");
    });
  });

  document.querySelectorAll("[data-action='toggle-motion']").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleAccessibilityFlag("reducedMotion");
      showToast(accessibility.reducedMotion ? "已开启减少动效" : "已恢复默认动效");
    });
  });

  document.querySelectorAll("[data-action='toggle-simple-home']").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleAccessibilityFlag("simpleHome");
      showToast(accessibility.simpleHome ? "已开启简化首页" : "已关闭简化首页");
    });
  });

  document.querySelectorAll("[data-action='speak-summary']").forEach((btn) => {
    btn.addEventListener("click", speakPageSummary);
  });

  document.querySelectorAll("[data-action='stop-speak']").forEach((btn) => {
    btn.addEventListener("click", stopNarration);
  });

  document.querySelectorAll("[data-action='quick-help']").forEach((btn) => {
    btn.addEventListener("click", triggerQuickHelp);
  });

  document.querySelectorAll("[data-action='call-contact']").forEach((btn) => {
    btn.addEventListener("click", callEmergencyContactDirect);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!assistPanel.classList.contains("open")) return;

    const clickedInside = target.closest("#assist-panel") || target.closest("#assist-fab") || target.closest("[data-action='toggle-assist']");
    if (!clickedInside) {
      setAssistPanelState(false);
    }
  });
}

function bindContactEditor() {
  const form = document.getElementById("assist-contact-form");
  if (!form) return;

  const nameInput = document.getElementById("contact-name-input");
  const relationInput = document.getElementById("contact-relation-input");
  const phoneInput = document.getElementById("contact-phone-input");
  const toggleBtn = document.querySelector("[data-action='toggle-contact-editor']");

  const fillForm = () => {
    const contact = getContactInfo();
    if (nameInput) nameInput.value = contact.name;
    if (relationInput) relationInput.value = contact.relation;
    if (phoneInput) phoneInput.value = contact.phoneRaw;
  };

  fillForm();

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      form.classList.toggle("open");
      if (form.classList.contains("open") && nameInput) {
        nameInput.focus();
      }
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const nextName = (nameInput?.value || "").trim();
    const nextRelation = (relationInput?.value || "").trim();
    const nextPhone = normalizePhone(phoneInput?.value || "");

    if (!nextName) {
      showToast("请填写联系人姓名");
      return;
    }

    if (!nextPhone || nextPhone.length < 6) {
      showToast("请填写有效联系电话");
      return;
    }

    accessibility.contact = {
      name: nextName,
      relation: nextRelation || "家属",
      phone: nextPhone
    };

    writeAccessibility(accessibility);
    refreshAccessibilityUiState();
    form.classList.remove("open");

    pushContactLog("update_contact", `更新联系人为${nextName}（${nextRelation || "家属"}）`);
    triggerQuickHelp();
    showToast("已保存紧急联系人");
  });
}

function bindAccessibilityShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (document.body.classList.contains("emergency-open")) {
        cancelEmergencyFlow();
      } else if (document.body.classList.contains("brief-modal-open")) {
        setBriefReportModal(false);
      } else {
        closeAssistPanel();
      }
    }

    if (!event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "e") {
      event.preventDefault();
      toggleAccessibilityFlag("elderMode");
      showToast(accessibility.elderMode ? "已开启长辈模式" : "已关闭长辈模式");
    }

    if (key === "h") {
      event.preventDefault();
      toggleAccessibilityFlag("highContrast");
      showToast(accessibility.highContrast ? "已开启高对比模式" : "已关闭高对比模式");
    }

    if (key === "s" && isDashboardPage()) {
      event.preventDefault();
      toggleAccessibilityFlag("simpleHome");
      showToast(accessibility.simpleHome ? "已开启简化首页" : "已关闭简化首页");
    }

    if (key === "r") {
      event.preventDefault();
      speakPageSummary();
    }
  });
}

function markNextDose() {
  const doseItems = Array.from(document.querySelectorAll("[data-dose-id]"));
  if (!doseItems.length) {
    showToast("当前页面没有可执行的打卡任务");
    return;
  }

  const pending = doseItems.find((item) => !item.classList.contains("done"));
  if (!pending) {
    showToast("今日服药任务已全部完成");
    return;
  }

  const doseId = pending.getAttribute("data-dose-id");
  if (!doseId) return;

  setDoseCheck(doseId, true);
  writeState(state);

  pending.classList.add("done");
  const btn = pending.querySelector("[data-action='toggle-dose']");
  if (btn) {
    btn.textContent = "已服用";
    btn.className = "btn-light";
  }

  updateDoseSummary();
  renderCareInsights();

  pending.scrollIntoView({
    behavior: accessibility.reducedMotion ? "auto" : "smooth",
    block: "center"
  });

  showToast("已完成下一次服药打卡");
}

function bindDoseItems() {
  const doseItems = document.querySelectorAll("[data-dose-id]");
  if (!doseItems.length) return;

  doseItems.forEach((item) => {
    const doseId = item.getAttribute("data-dose-id");
    const actionBtn = item.querySelector("[data-action='toggle-dose']");

    const done = isDoseChecked(doseId);
    item.classList.toggle("done", done);
    if (actionBtn) {
      actionBtn.textContent = done ? "已服用" : "标记服用";
      actionBtn.className = done ? "btn-light" : "btn";
    }

    if (!actionBtn) return;
    actionBtn.addEventListener("click", () => {
      const nextValue = !isDoseChecked(doseId);
      setDoseCheck(doseId, nextValue);
      writeState(state);

      item.classList.toggle("done", nextValue);
      actionBtn.textContent = nextValue ? "已服用" : "标记服用";
      actionBtn.className = nextValue ? "btn-light" : "btn";

      updateDoseSummary();
      renderCareInsights();
      showToast(nextValue ? "已记录本次服药" : "已取消该次记录");
    });
  });

  updateDoseSummary();
}

function updateDoseSummary() {
  const snapshot = getAdherenceSnapshot();

  document.querySelectorAll("[data-bind='dose-summary']").forEach((el) => {
    el.textContent = `${snapshot.done} / ${snapshot.total}`;
  });

  document.querySelectorAll("[data-bind='dose-ratio']").forEach((el) => {
    el.textContent = `${snapshot.ratio}%`;
  });

  document.querySelectorAll("[data-bind='dose-progress']").forEach((el) => {
    el.style.width = `${snapshot.ratio}%`;
  });
}

function buildVisitSummaryHtml() {
  const snapshot = getAdherenceSnapshot();
  const lowStock = getLowestStockMedicine();
  const risk = getRefillRiskInfo(lowStock);
  const latestNotes = state.notes.slice(0, 3);
  const missedText = snapshot.missed.length
    ? snapshot.missed.map(({ med, dose }) => `${dose.time} ${med.name}`).join("、")
    : "今日暂无漏服";
  const notesText = latestNotes.length
    ? latestNotes.map((note) => `<li>${escapeHtml(note.severity)}: ${escapeHtml(note.content)}</li>`).join("")
    : "<li>暂无症状备注</li>";

  return `
    <div class="summary-card">
      <div class="summary-head">
        <div>
          <p class="section-kicker">Doctor Brief</p>
          <h4>复诊沟通摘要</h4>
        </div>
        <span class="badge ${snapshot.ratio >= 80 ? "ok" : "warn"}">${snapshot.ratio}% 依从率</span>
      </div>
      <div class="summary-grid">
        <div>
          <b>患者画像</b>
          <p>${CARE_PROFILE.name}，${CARE_PROFILE.age} 岁；${CARE_PROFILE.conditions.join("、")}。${CARE_PROFILE.routine}。</p>
        </div>
        <div>
          <b>今日执行</b>
          <p>已完成 ${snapshot.done}/${snapshot.total} 次；待关注: ${missedText}。</p>
        </div>
        <div>
          <b>库存风险</b>
          <p>${lowStock.name} 剩余 ${lowStock.stockDays} 天，${risk.reason}</p>
        </div>
        <div>
          <b>建议沟通问题</b>
          <p>晚间漏服是否需要调整提醒时间；低库存药是否可提前续方；近期不适是否与用药时机有关。</p>
        </div>
      </div>
      <div class="summary-notes">
        <b>近期症状记录</b>
        <ul>${notesText}</ul>
      </div>
    </div>
  `;
}

function renderVisitSummary(focus = false) {
  document.querySelectorAll("[data-bind='visit-summary']").forEach((wrap) => {
    wrap.innerHTML = buildVisitSummaryHtml();
    wrap.hidden = false;
    if (focus) {
      wrap.scrollIntoView({ behavior: accessibility.reducedMotion ? "auto" : "smooth", block: "center" });
    }
  });
}

function renderRefillRiskInsights() {
  document.querySelectorAll("[data-risk-med]").forEach((node) => {
    const med = MEDICATIONS.find((item) => item.id === node.getAttribute("data-risk-med"));
    if (!med) return;
    const risk = getRefillRiskInfo(med);
    node.innerHTML = `
      <p class="info-meta"><b>风险解释:</b> ${risk.reason}</p>
      <p class="info-meta">断药预估: ${formatDate(risk.runOutDate)} · 优先级: ${risk.priority}</p>
    `;
  });

  const lowStock = getLowestStockMedicine();
  const risk = getRefillRiskInfo(lowStock);
  document.querySelectorAll("[data-bind='refill-risk-window']").forEach((node) => {
    node.innerHTML = `
      <div class="info-card warn">
        <p class="info-title">最需要处理</p>
        <p class="info-value">${lowStock.name} 剩余 ${lowStock.stockDays} 天</p>
        <p class="info-meta">${risk.reason}</p>
      </div>
    `;
  });
}

function renderCaregiverSummary() {
  const snapshot = getAdherenceSnapshot();
  const contact = getContactInfo();
  const lowStock = getLowestStockMedicine();
  const nextAction = snapshot.missed.length
    ? `提醒完成 ${snapshot.missed[0].dose.time} ${snapshot.missed[0].med.name}`
    : `协助确认 ${lowStock.name} 续方`;

  document.querySelectorAll("[data-bind='caregiver-summary']").forEach((node) => {
    node.innerHTML = `
      <div class="summary-card compact">
        <div class="summary-head">
          <div>
            <p class="section-kicker">Family Brief</p>
            <h4>家属协同摘要</h4>
          </div>
          <span class="badge ${snapshot.missed.length ? "warn" : "ok"}">${contact.name}</span>
        </div>
        <p>今天已完成 ${snapshot.done}/${snapshot.total} 次服药；${snapshot.missed.length ? `仍有 ${snapshot.missed.length} 次待确认。` : "今日执行稳定。"}</p>
        <p>建议家属动作: ${nextAction}；库存最低药为 ${lowStock.name}，剩余 ${lowStock.stockDays} 天。</p>
        <div class="panel-tools">
          <button class="btn-light" type="button" data-action="quick-help">生成提醒话术</button>
          <a class="btn-ghost" data-bind="contact-call" href="#" style="text-decoration: none; display: inline-flex; align-items: center">联系家属</a>
        </div>
      </div>
    `;
  });

  updateContactBindings();
  document.querySelectorAll("[data-bind='caregiver-summary'] [data-action='quick-help']").forEach((btn) => {
    if (btn.getAttribute("data-care-bound") === "1") return;
    btn.setAttribute("data-care-bound", "1");
    btn.addEventListener("click", triggerQuickHelp);
  });
}

function renderWeeklyInsight() {
  const snapshot = getAdherenceSnapshot();
  const lowStock = getLowestStockMedicine();
  document.querySelectorAll("[data-bind='weekly-insight']").forEach((node) => {
    const advice = snapshot.eveningMissed
      ? "晚间任务仍未完成，建议把提醒前移到晚餐后 15 分钟，并开启家属协助。"
      : "今日关键任务执行稳定，下一步重点是提前处理低库存药品。";
    node.innerHTML = `
      <div class="tool-card insight-card">
        <p class="info-title">本周洞察</p>
        <p class="info-meta">${advice}</p>
        <p class="info-meta">当前最低库存: ${lowStock.name} ${lowStock.stockDays} 天。</p>
      </div>
    `;
  });
}

function renderCareInsights() {
  renderWeeklyInsight();
  renderRefillRiskInsights();
  renderCaregiverSummary();
  if (document.querySelector("[data-bind='visit-summary']:not([hidden])")) {
    renderVisitSummary(false);
  }
  if (document.body.classList.contains("brief-modal-open")) {
    renderBriefReport();
  }
}

function getNextPendingDoseText() {
  const pending = getAdherenceSnapshot().missed[0];
  if (!pending) return "今日任务已完成";
  return `${pending.dose.time} ${pending.med.name} ${pending.med.dose}`;
}

function buildBriefReportHtml() {
  const snapshot = getAdherenceSnapshot();
  const lowStock = getLowestStockMedicine();
  const risk = getRefillRiskInfo(lowStock);
  const contact = getContactInfo();
  const latestNote = state.notes[0];
  const missedText = snapshot.missed.length
    ? snapshot.missed.map(({ med, dose }) => `${dose.time} ${med.name}`).join("、")
    : "无";
  const mainAction = snapshot.missed.length
    ? `先完成 ${getNextPendingDoseText()}`
    : `处理 ${lowStock.name} 续方`;

  return `
    <div class="brief-list">
      <div class="brief-row urgent">
        <span>现在先看</span>
        <b>${mainAction}</b>
      </div>
      <div class="brief-row">
        <span>今日服药</span>
        <b>${snapshot.done}/${snapshot.total}，${snapshot.ratio}%</b>
      </div>
      <div class="brief-row">
        <span>待确认</span>
        <b>${missedText}</b>
      </div>
      <div class="brief-row">
        <span>库存</span>
        <b>${lowStock.name} 剩余 ${lowStock.stockDays} 天</b>
      </div>
      <div class="brief-row">
        <span>复诊</span>
        <b>${formatDate(risk.followUpDate)}</b>
      </div>
      <div class="brief-row">
        <span>症状</span>
        <b>${latestNote ? `${escapeHtml(latestNote.severity)}: ${escapeHtml(latestNote.content)}` : "暂无新增记录"}</b>
      </div>
      <div class="brief-row">
        <span>家属</span>
        <b>${contact.hasPhone ? `${contact.name} ${contact.phoneDisplay}` : "未设置联系人"}</b>
      </div>
    </div>
    <p class="brief-action">建议下一步: ${risk.gapDays > 0 ? risk.reason : `联系家属协助确认 ${lowStock.name} 续方。`}</p>
  `;
}

function renderBriefReport() {
  const content = document.getElementById("brief-report-content");
  if (!content) return;
  content.innerHTML = buildBriefReportHtml();
}

function setBriefReportModal(open) {
  const modal = document.getElementById("brief-report-modal");
  if (!modal) return;
  modal.classList.toggle("open", open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("brief-modal-open", open);
  if (open) {
    renderBriefReport();
    const closeBtn = modal.querySelector("[data-action='close-brief-report']");
    if (closeBtn) closeBtn.focus();
  }
}

function bindBriefReport() {
  const modal = document.getElementById("brief-report-modal");
  document.querySelectorAll("[data-action='open-brief-report']").forEach((btn) => {
    btn.addEventListener("click", () => {
      setBriefReportModal(true);
      showToast("已生成今日简要报告");
    });
  });

  document.querySelectorAll("[data-action='close-brief-report']").forEach((btn) => {
    btn.addEventListener("click", () => setBriefReportModal(false));
  });

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) setBriefReportModal(false);
    });
  }
}

function bindQuickActions() {
  document.querySelectorAll("[data-action='mock-upload']").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("演示模式：已解析处方并更新计划");
    });
  });

  document.querySelectorAll("[data-action='mock-remind']").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("已设置 20 分钟后再次提醒");
    });
  });

  document.querySelectorAll("[data-action='mock-summary']").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderVisitSummary(true);
      showToast("已生成复诊沟通摘要");
    });
  });

  document.querySelectorAll("[data-action='mark-next-dose']").forEach((btn) => {
    btn.addEventListener("click", markNextDose);
  });

}

function renderNotes() {
  const wrap = document.getElementById("symptom-note-list");
  if (!wrap) return;

  if (!state.notes.length) {
    wrap.innerHTML = '<div class="note-item"><p>暂无记录</p><span>开始添加今天的症状变化</span></div>';
    return;
  }

  wrap.innerHTML = state.notes
    .slice(0, 6)
    .map((note) => {
      const content = escapeHtml(note.content);
      const severity = escapeHtml(note.severity);
      return `
        <div class="note-item">
          <p>${content}</p>
          <span>${severity} · ${formatDate(note.ts)} ${formatTime(note.ts)}</span>
        </div>
      `;
    })
    .join("");
}

function bindSymptomForm() {
  const form = document.getElementById("symptom-form");
  if (!form) {
    renderNotes();
    return;
  }

  renderNotes();

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const noteInput = document.getElementById("symptom-content");
    const severityInput = document.getElementById("symptom-severity");
    const content = (noteInput?.value || "").trim();

    if (!content) {
      showToast("请先填写症状描述");
      return;
    }

    const note = {
      content,
      severity: severityInput?.value || "轻度",
      ts: new Date().toISOString()
    };

    state.notes.unshift(note);
    state.notes = state.notes.slice(0, 10);
    writeState(state);

    form.reset();
    renderNotes();
    showToast("症状记录已保存");
  });
}

function parseHourMinute(str) {
  if (!str || !str.includes(":")) return null;
  const [h, m] = str.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function adviceByMedicine({ med, planned, current, symptom }) {
  const p = parseHourMinute(planned);
  const c = parseHourMinute(current);
  if (p === null || c === null) {
    return {
      title: "信息不足",
      message: "请填写完整时间后再判断。",
      callout: "如出现明显不适，请立即联系医生。"
    };
  }

  const delayHours = (c - p) / 60;
  const highRisk = symptom.includes("胸") || symptom.includes("呼吸") || symptom.includes("剧烈");

  if (highRisk) {
    return {
      title: "优先就医",
      message: "已识别到高风险不适描述，不建议仅依赖自动补救建议。",
      callout: "请尽快联系医生或急救服务。"
    };
  }

  if (med === "metformin") {
    if (delayHours <= 2) {
      return {
        title: "可在当前餐后补服",
        message: "延迟时间较短，可随当前进食补服本次剂量，下一次按原计划执行。",
        callout: "若出现胃部不适，记录后与医生沟通。"
      };
    }
    if (delayHours <= 6) {
      return {
        title: "视下次间隔决定",
        message: "若距下一次服药仍有 4 小时以上，可补服；否则跳过本次，避免过近重复。",
        callout: "不要自行双倍补服。"
      };
    }
    return {
      title: "建议跳过本次",
      message: "距离原计划时间较久，建议跳过并按下次原计划服用。",
      callout: "若连续漏服，建议咨询医生调整方案。"
    };
  }

  if (med === "amlodipine") {
    if (delayHours <= 8) {
      return {
        title: "可尽快补服",
        message: "当前仍可补服本次剂量，后续继续按固定时段服药。",
        callout: "若已接近下一次服药时间，优先咨询医生。"
      };
    }
    return {
      title: "不建议补服",
      message: "延迟过久，建议跳过本次并恢复原日程，避免重复降压风险。",
      callout: "监测血压，异常波动及时咨询医生。"
    };
  }

  if (med === "atorvastatin") {
    if (c <= 23 * 60 + 30 && delayHours <= 5) {
      return {
        title: "今晚可补服",
        message: "尚在当天夜间窗口，可补服一次，次日恢复正常节奏。",
        callout: "不要额外增加剂量。"
      };
    }
    return {
      title: "直接进入下一周期",
      message: "已经超过建议补服窗口，建议本次跳过，按次日计划继续。",
      callout: "若频繁漏服，可启用家属提醒。"
    };
  }

  return {
    title: "保守建议",
    message: "请根据处方说明优先执行，不确定时联系医生或药师确认。",
    callout: "不要自行增加剂量补偿漏服。"
  };
}

function renderAiDecisionPath({ med, planned, current, symptom, result } = {}) {
  const wrap = document.getElementById("ai-decision-path");
  if (!wrap) return;

  const p = parseHourMinute(planned || "");
  const c = parseHourMinute(current || "");
  const medLabel = {
    metformin: "二甲双胍",
    amlodipine: "氨氯地平",
    atorvastatin: "阿托伐他汀",
    generic: "其他慢病常用药"
  }[med || "generic"];
  const delay = p === null || c === null ? null : Math.round(((c - p) / 60) * 10) / 10;
  const highRisk = `${symptom || ""}`.includes("胸") || `${symptom || ""}`.includes("呼吸") || `${symptom || ""}`.includes("剧烈");

  wrap.innerHTML = `
    <div class="decision-step ${med ? "done" : ""}">
      <b>1. 药物类型</b>
      <span>${medLabel || "等待选择"}</span>
    </div>
    <div class="decision-step ${delay !== null ? "done" : ""}">
      <b>2. 延迟窗口</b>
      <span>${delay === null ? "等待时间输入" : `已延迟 ${delay} 小时`}</span>
    </div>
    <div class="decision-step ${symptom ? (highRisk ? "warn" : "done") : ""}">
      <b>3. 症状边界</b>
      <span>${symptom ? (highRisk ? "命中高风险症状" : "未命中高风险症状") : "未填写不适描述"}</span>
    </div>
    <div class="decision-step ${result ? "done" : ""}">
      <b>4. 建议动作</b>
      <span>${result ? escapeHtml(result.title) : "生成后展示建议"}</span>
    </div>
  `;
}

function bindAiForm() {
  const form = document.getElementById("ai-form");
  if (!form) return;

  const titleEl = document.getElementById("ai-result-title");
  const msgEl = document.getElementById("ai-result-message");
  const calloutEl = document.getElementById("ai-result-callout");

  if (state.lastAiResult) {
    titleEl.textContent = state.lastAiResult.title;
    msgEl.textContent = state.lastAiResult.message;
    calloutEl.textContent = state.lastAiResult.callout;
    renderAiDecisionPath(state.lastAiResult.context || {});
  } else {
    renderAiDecisionPath();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const med = document.getElementById("ai-med")?.value || "generic";
    const planned = document.getElementById("ai-planned")?.value || "";
    const current = document.getElementById("ai-current")?.value || "";
    const symptom = (document.getElementById("ai-symptom")?.value || "").trim();

    const result = adviceByMedicine({ med, planned, current, symptom });

    titleEl.textContent = result.title;
    msgEl.textContent = result.message;
    calloutEl.textContent = result.callout;

    const context = { med, planned, current, symptom, result };
    state.lastAiResult = { ...result, context };
    writeState(state);
    renderAiDecisionPath(context);
    showToast("已生成漏服补救建议");
  });
}

function bindRefillCalc() {
  const button = document.getElementById("calc-refill-btn");
  const rows = document.querySelectorAll("[data-refill-days]");
  if (!rows.length) return;

  const calc = () => {
    rows.forEach((row) => {
      const days = Number(row.getAttribute("data-refill-days"));
      const target = row.querySelector("[data-bind='refill-date']");
      const caution = row.querySelector("[data-bind='refill-caution']");
      if (!target || Number.isNaN(days)) return;

      const d = new Date();
      const lead = days <= 5 ? 1 : 3;
      d.setDate(d.getDate() + Math.max(1, days - lead));
      target.textContent = formatDate(d);

      if (!caution) return;
      if (days <= 5) caution.textContent = "高优先级，建议立即准备续方";
      else if (days <= 10) caution.textContent = "中优先级，建议本周内完成续方";
      else caution.textContent = "低优先级，继续按计划观察库存";
    });
  };

  calc();

  if (button) {
    button.addEventListener("click", () => {
      calc();
      showToast("已按当前日期重新计算续方节点");
    });
  }
}

function setFooterYear() {
  document.querySelectorAll("[data-bind='year']").forEach((el) => {
    el.textContent = `${new Date().getFullYear()}`;
  });
}

function bindResizeSync() {
  let bound = window.__cm_resize_bound__;
  if (bound) return;

  window.__cm_resize_bound__ = true;
  window.addEventListener("resize", () => {
    syncToastOffset();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindResizeSync();
  getToastContainer();
  injectSkipLink();
  injectDashboardPriorityPanel();
  injectAccessibilityUi();
  injectEmergencyUi();
  bindContactEditor();
  bindAccessibilityShortcuts();
  bindHomeSearch();
  bindBriefReport();
  bindQuickActions();
  bindDoseItems();
  bindSymptomForm();
  bindAiForm();
  bindRefillCalc();
  renderCareInsights();
  refreshAccessibilityUiState();
  setFooterYear();
  syncToastOffset();
});
