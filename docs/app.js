import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";

const $ = (selector) => document.querySelector(selector);
const authView = $("#auth-view");
const appView = $("#app-view");
const setupView = $("#setup-view");
const accessForm = $("#access-form");
const accessCodeInput = $("#access-code-input");
const rememberDeviceInput = $("#remember-device-input");
const authStatus = $("#auth-status");
const signoutButton = $("#signout-button");
const accountLabel = $("#account-label");
const mailForm = $("#mail-form");
const mailInput = $("#mail-input");
const mailStatus = $("#mail-status");
const alertForm = $("#alert-form");
const coinInput = $("#coin-input");
const coinList = $("#coin-list");
const targetInput = $("#target-price-input");
const quote = $("#quote");
const alertsRoot = $("#alerts");
const alertCount = $("#alert-count");
const formMessage = $("#form-message");
const toast = $("#toast");
const lootCount = $("#loot-count");
const lootGridEl = $("#loot-grid");
const lootListEl = $("#loot-list");

const ACCESS_CODE_KEY = "price-sentinel-access-code";
const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_");

let supabase = null;
let accessCode = localStorage.getItem(ACCESS_CODE_KEY) || sessionStorage.getItem(ACCESS_CODE_KEY) || "";
let quoteTimer = null;
let alertRefreshTimer = null;
let searchTimer = null;
let binanceSymbols = [];
let selectedToken = null;
let currentAlerts = [];
let priceRefreshTimer = null;

const hide = (element, shouldHide = true) => element.classList.toggle("hidden", shouldHide);

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const digits = number >= 1000 ? 2 : number >= 1 ? 4 : 8;
  return `$${number.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

const COIN_ALIASES = {
  "比特币": "BTC", "btc": "BTC", "BTC": "BTC",
  "以太坊": "ETH", "eth": "ETH", "ETH": "ETH",
  "币安币": "BNB", "币安": "BNB", "bnb": "BNB", "BNB": "BNB",
  "瑞波币": "XRP", "xrp": "XRP", "XRP": "XRP",
  "狗狗币": "DOGE", "狗币": "DOGE", "doge": "DOGE", "DOGE": "DOGE",
  "卡尔达诺": "ADA", "艾达币": "ADA", "ada": "ADA", "ADA": "ADA",
  "索拉纳": "SOL", "索拉那": "SOL", "sol": "SOL", "SOL": "SOL",
  "波卡": "DOT", "dot": "DOT", "DOT": "DOT",
  "莱特币": "LTC", "ltc": "LTC", "LTC": "LTC",
  "比特币现金": "BCH", "bch": "BCH", "BCH": "BCH",
  "柚子": "EOS", "柚子币": "EOS", "eos": "EOS", "EOS": "EOS",
  "柴犬币": "SHIB", "柴犬": "SHIB", "shib": "SHIB", "SHIB": "SHIB",
  "波场": "TRX", "波场币": "TRX", "TRON": "TRX", "trx": "TRX", "TRX": "TRX",
  "雪崩币": "AVAX", "雪崩": "AVAX", "avax": "AVAX", "AVAX": "AVAX",
  "马蹄莲": "MATIC", "多边形": "MATIC", "马特": "MATIC", "matic": "MATIC", "MATIC": "MATIC",
  "链接币": "LINK", "链接": "LINK", "chainlink": "LINK", "link": "LINK", "LINK": "LINK",
  "优币": "UNI", "uni": "UNI", "UNI": "UNI",
  "阿童木": "ATOM", "atom": "ATOM", "ATOM": "ATOM",
  "恒星币": "XLM", "xlm": "XLM", "XLM": "XLM",
  "文件币": "FIL", "filecoin": "FIL", "fil": "FIL", "FIL": "FIL",
  "以太经典": "ETC", "etc": "ETC", "ETC": "ETC",
  "新星": "NEAR", "near": "NEAR", "NEAR": "NEAR",
  "阿普托斯": "APT", "apt": "APT", "APT": "APT",
  "阿比特": "ARB", "arbitrum": "ARB", "arb": "ARB", "ARB": "ARB",
  "乐观币": "OP", "乐观": "OP", "op": "OP", "OP": "OP",
  "龙币": "SUI", "sui": "SUI", "SUI": "SUI",
  "西伊币": "SEI", "sei": "SEI", "SEI": "SEI",
  "小币": "PEPE", "佩佩": "PEPE", "pepe": "PEPE", "PEPE": "PEPE",
  "世界币": "WLD", "wld": "WLD", "WLD": "WLD",
  "重组": "RNDR", "rndr": "RNDR", "RNDR": "RNDR",
  "泰达币": "USDT", "usdt": "USDT", "USDT": "USDT",
  "美元币": "USDC", "usdc": "USDC", "USDC": "USDC",
  "宇宙": "AAVE", "aave": "AAVE", "AAVE": "AAVE",
  "曲线": "CRV", "crv": "CRV", "CRV": "CRV",
  "抹茶": "MKR", "mkr": "MKR", "MKR": "MKR",
  "加网": "GALA", "gala": "GALA", "GALA": "GALA",
  "阿克塞尔": "AXS", "axs": "AXS", "AXS": "AXS",
  "迷因": "MEME", "meme": "MEME", "MEME": "MEME",
  "宝贝狗": "BABYDOGE", "babydoge": "BABYDOGE", "BABYDOGE": "BABYDOGE",
  "米努斯": "MINA", "mina": "MINA", "MINA": "MINA",
  "恒久": "IMX", "imx": "IMX", "IMX": "IMX",
  "圣殿": "SAND", "sand": "SAND", "SAND": "SAND",
  "魔盒": "MANA", "mana": "MANA", "MANA": "MANA",
  "休闲": "ILV", "ilv": "ILV", "ILV": "ILV",
  "月亮": "LUNC", "lunc": "LUNC", "LUNC": "LUNC",
  "露娜": "LUNA", "luna": "LUNA", "LUNA": "LUNA",
};

async function loadBinanceSymbols() {
  try {
    const response = await fetch("https://data-api.binance.vision/api/v3/ticker/price", { signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    binanceSymbols = (Array.isArray(data) ? data : [])
      .map((x) => x.symbol)
      .filter((s) => typeof s === "string" && s.endsWith("USDT") && !s.endsWith("DOWNUSDT") && !s.endsWith("UPUSDT"));
  } catch {
    binanceSymbols = [];
  }
}

function currentTokenKey() {
  if (selectedToken) return selectedToken.key;
  const raw = coinInput.value.trim();
  const alias = COIN_ALIASES[raw] || COIN_ALIASES[raw.toUpperCase()];
  const base = (alias || raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!base) return "";
  return base.endsWith("USDT") ? base : `${base}USDT`;
}

function tokenLabel(key) {
  const s = String(key || "");
  if (s.startsWith("DEX:")) {
    const parts = s.split(":");
    return `${parts[3]} · 链上`;
  }
  return s.replace(/USDT$/, "");
}

async function searchCoins(q) {
  const results = [];
  const uq = q.toUpperCase();
  const alias = COIN_ALIASES[q] || COIN_ALIASES[uq];
  if (alias) {
    const key = alias.endsWith("USDT") ? alias : `${alias}USDT`;
    results.push({ key, label: alias, tag: "现货" });
  }
  for (const s of binanceSymbols) {
    if (s.startsWith(uq) && !s.endsWith("DOWNUSDT") && !s.endsWith("UPUSDT")) {
      results.push({ key: s, label: s.replace(/USDT$/, ""), tag: "现货" });
      if (results.length >= 15) break;
    }
  }
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const data = await response.json();
      const seen = new Set();
      for (const pair of data.pairs || []) {
        const bt = pair.baseToken;
        if (!bt || !bt.address || !bt.name) continue;
        const key = `DEX:${pair.chainId}:${bt.address}:${bt.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ key, label: bt.name, tag: "链上", chain: pair.chainId });
        if (results.length >= 30) break;
      }
    }
  } catch {
    // 链上搜索失败则忽略。
  }
  return results;
}

function renderCoinList(results) {
  coinList.replaceChildren();
  if (!results.length) {
    hide(coinList);
    return;
  }
  for (const result of results) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "coin-option";
    const label = createText("span", result.label);
    const tag = createText("small", result.tag + (result.chain ? ` · ${result.chain}` : ""));
    item.append(label, tag);
    item.addEventListener("click", () => {
      selectedToken = result;
      coinInput.value = result.label;
      hide(coinList);
      loadQuote();
    });
    coinList.append(item);
  }
  hide(coinList, false);
}

function readableError(error, fallback = "操作失败，请稍后再试。") {
  const raw = String(error?.message || error || "").toLowerCase();
  if (
    raw.includes("access code") ||
    raw.includes("口令") ||
    raw.includes("invalid code") ||
    raw.includes("unauthorized") ||
    raw.includes("permission")
  ) {
    return "访问口令不正确，请重新输入。";
  }
  if (raw.includes("failed to fetch") || raw.includes("network")) return "网络暂时不通，请稍后再试。";
  return fallback;
}

function setAuthStatus(text, type = "") {
  authStatus.textContent = text;
  authStatus.className = `auth-status ${type}`;
}

function setFormMessage(text, type = "") {
  formMessage.textContent = text;
  formMessage.className = `form-note ${type}`;
}

function setMailStatus(text, type = "") {
  mailStatus.textContent = text;
  mailStatus.className = `form-note ${type}`;
}

async function loadAccount() {
  const { data, error } = await supabase.rpc("personal_account_info", { p_access_code: accessCode });
  if (error) throw error;
  const email = Array.isArray(data) && data[0]?.email ? data[0].email : "";
  mailInput.value = email;
  if (!email) {
    setMailStatus("还没有设置收件邮箱，请填写后保存，否则收不到提醒。", "error");
  }
}

mailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!accessCode) return;
  const button = mailForm.querySelector("button[type='submit']");
  const email = mailInput.value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setMailStatus("请输入正确的邮箱地址。", "error");
  setButtonBusy(button, true, "保存中…");
  setMailStatus("正在保存…");
  try {
    const { error } = await supabase.rpc("personal_account_set_email", {
      p_access_code: accessCode,
      p_email: email,
    });
    if (error) throw error;
    setMailStatus("邮箱已保存，到价提醒会发送到这里。", "success");
  } catch (error) {
    setMailStatus(readableError(error, "邮箱保存失败，请稍后再试。"), "error");
  } finally {
    setButtonBusy(button, false);
  }
});

function showToast(text) {
  toast.textContent = text;
  hide(toast, false);
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => hide(toast), 2600);
}

function setButtonBusy(button, busy, busyText = "请稍候…") {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.label;
}

function rememberAccessCode(code, remember) {
  localStorage.removeItem(ACCESS_CODE_KEY);
  sessionStorage.removeItem(ACCESS_CODE_KEY);
  (remember ? localStorage : sessionStorage).setItem(ACCESS_CODE_KEY, code);
}

function forgetAccessCode() {
  localStorage.removeItem(ACCESS_CODE_KEY);
  sessionStorage.removeItem(ACCESS_CODE_KEY);
  accessCode = "";
}

async function fetchDexPrice(tokenKey) {
  const parts = tokenKey.split(":");
  const chain = parts[1];
  const contract = parts[2];
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contract}`, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error("price unavailable");
  const data = await response.json();
  const pairs = (data.pairs || []).filter((p) => p.chainId === chain && p.priceUsd && Number(p.liquidity?.usd || 0) > 0);
  if (!pairs.length) throw new Error("price unavailable");
  pairs.sort((a, b) => Number(b.liquidity.usd || 0) - Number(a.liquidity.usd || 0));
  const price = Number(pairs[0].priceUsd);
  if (!Number.isFinite(price) || price <= 0) throw new Error("price unavailable");
  return price;
}

async function fetchPrice(tokenKey) {
  if (String(tokenKey).startsWith("DEX:")) return fetchDexPrice(tokenKey);
  const endpoints = [
    `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(tokenKey)}`,
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=${encodeURIComponent(tokenKey)}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) continue;
      const payload = await response.json();
      const price = Number(payload.price);
      if (Number.isFinite(price) && price > 0) return price;
    } catch {
      // 尝试下一个公开行情入口。
    }
  }
  throw new Error("price unavailable");
}

async function loadQuote() {
  window.clearTimeout(quoteTimer);
  const key = currentTokenKey();
  if (!key) return;
  const label = tokenLabel(key);
  quote.replaceChildren(createText("span", `${label} 当前价格`), createText("b", "正在读取…"));
  try {
    const price = await fetchPrice(key);
    quote.replaceChildren(createText("span", `${label} 当前价格`), createText("b", money(price)));
  } catch {
    quote.replaceChildren(createText("span", `${label} 当前价格`), createText("b", "未找到该币"));
  }
}

coinInput.addEventListener("input", () => {
  const q = coinInput.value.trim();
  selectedToken = null;
  window.clearTimeout(searchTimer);
  window.clearTimeout(quoteTimer);
  if (!q) {
    hide(coinList);
    return;
  }
  searchTimer = window.setTimeout(async () => {
    try {
      renderCoinList(await searchCoins(q));
    } catch {
      hide(coinList);
    }
  }, 280);
  quoteTimer = window.setTimeout(loadQuote, 700);
});

coinInput.addEventListener("focus", () => {
  if (coinInput.value.trim()) {
    searchTimer = window.setTimeout(async () => {
      try {
        renderCoinList(await searchCoins(coinInput.value.trim()));
      } catch {
        hide(coinList);
      }
    }, 200);
  }
});

document.addEventListener("click", (event) => {
  if (!coinList.contains(event.target) && event.target !== coinInput) hide(coinList);
});

function createText(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderAlerts(alerts) {
  currentAlerts = alerts;
  const activeCount = alerts.filter((item) => item.enabled && !item.triggered_at).length;
  alertCount.textContent = `${activeCount} 个进行中`;
  alertsRoot.replaceChildren();

  if (!alerts.length) {
    alertsRoot.append(createText("div", "还没有提醒。在左边填币种和触发价即可开始。", "empty-card"));
    return;
  }

  for (const item of alerts) {
    const base = tokenLabel(item.symbol);
    const active = item.enabled && !item.triggered_at;
    const condition = item.direction === "above" ? "涨到" : "跌到";
    const card = document.createElement("article");
    card.className = "alert-card";
    card.dataset.id = String(item.id);

    const icon = createText("div", base.replace(/[·\s]/g, "").slice(0, 4), "token-icon");
    const main = document.createElement("div");
    main.className = "alert-main";
    const title = document.createElement("div");
    title.className = "alert-title";
    title.append(createText("b", base));
    title.append(
      createText(
        "span",
        active ? "● 监控中" : item.triggered_at ? "✓ 已触发" : "已暂停",
        `status-pill${item.triggered_at ? " triggered" : ""}`,
      ),
    );
    const target = document.createElement("div");
    target.className = "alert-target";
    const priceEl = createText("strong", money(item.last_price));
    priceEl.dataset.price = "";
    target.append("当前 ", priceEl, ` · ${condition} `);
    target.append(createText("strong", money(item.target_price)), " 时提醒");
    main.append(title, target);

    const actions = document.createElement("div");
    actions.className = "alert-actions";
    const toggle = createText("button", active ? "暂停" : "重新开启", "small-button");
    toggle.type = "button";
    toggle.dataset.action = "toggle";
    toggle.dataset.id = String(item.id);
    toggle.dataset.active = String(active);
    const remove = createText("button", "删除", "small-button danger-button");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.id = String(item.id);
    actions.append(toggle, remove);
    card.append(icon, main, actions);
    alertsRoot.append(card);
  }
  refreshAlertPrices();
}

async function refreshAlertPrices() {
  for (const item of currentAlerts) {
    if (!item.enabled || item.triggered_at) continue;
    try {
      const price = await fetchPrice(item.symbol);
      const card = document.querySelector(`.alert-card[data-id="${item.id}"]`);
      const el = card?.querySelector("[data-price]");
      if (el) el.textContent = money(price);
    } catch {
      // 单个币查价失败不影响其它提醒。
    }
  }
}

let lootData = [];
let lootSelectedDay = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}
function dayKey(s) {
  return String(s || "").slice(0, 10);
}

async function loadLoot() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/loot_activities?select=id,title,category,reason,source,url,detected_at,score,profit,cost,difficulty&order=score.desc&limit=50`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
    });
    if (!res.ok) throw new Error("load loot failed");
    const data = await res.json();
    lootData = Array.isArray(data) ? data : [];
  } catch {
    lootData = [];
  }
  lootCount.textContent = `${lootData.length} 条活动`;
  const now = new Date();
  lootSelectedDay = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  renderLootCalendar();
  renderLootList();
}

function renderLootCalendar() {
  lootGridEl.replaceChildren();
  for (const w of ["日", "一", "二", "三", "四", "五", "六"]) lootGridEl.append(createText("div", w, "loot-dow"));
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const startPad = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const daySet = new Set(lootData.map((x) => dayKey(x.detected_at)));
  for (let i = 0; i < startPad; i++) lootGridEl.append(createText("div", "", "loot-day loot-empty"));
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${pad2(m + 1)}-${pad2(d)}`;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.textContent = String(d);
    cell.className = "loot-day" + (daySet.has(ds) ? " has" : "") + (ds === lootSelectedDay ? " selected" : "");
    cell.addEventListener("click", () => {
      lootSelectedDay = ds;
      renderLootCalendar();
      renderLootList();
    });
    lootGridEl.append(cell);
  }
}

function renderLootList() {
  lootListEl.replaceChildren();
  const items = lootData.filter((x) => dayKey(x.detected_at) === lootSelectedDay);
  if (!items.length) {
    lootListEl.append(createText("div", "这一天没有新发现的撸毛活动。", "empty-card"));
    return;
  }
  const hasFuture = items.some((x) => {
    const p = Date.parse(x.detected_at);
    const t = Date.parse(lootSelectedDay + "T00:00:00Z");
    return Number.isFinite(p) && p >= t;
  });
  if (hasFuture && lootSelectedDay > dayKey(new Date().toISOString())) {
    lootListEl.append(createText("div", "这些是未来日期的活动，去看看！", "empty-card"));
  }
  for (const it of items) {
    const card = document.createElement("article");
    card.className = "loot-item";
    const head = document.createElement("div");
    head.className = "loot-item-head";
    const score = Number(it.score || 0);
    head.append(createText("span", `评分 ${score}`, score >= 8 ? "loot-cat hot" : "loot-cat"));
    head.append(createText("span", it.category || "活动", "loot-cat"));
    head.append(createText("span", dayKey(it.detected_at), "loot-date"));
    const title = createText("a", it.title, "loot-title");
    title.href = it.url || "#";
    title.target = "_blank";
    title.rel = "noopener";
    const meta = document.createElement("div");
    meta.className = "loot-meta";
    if (it.profit) meta.append(createText("span", `💰 利润：${it.profit}`, "meta-pill"));
    if (it.cost) meta.append(createText("span", `成本：${it.cost}`, "meta-pill"));
    if (it.difficulty) meta.append(createText("span", `难度：${it.difficulty}`, "meta-pill"));
    const reason = createText("p", it.reason || "", "loot-reason");
    card.append(head, title, meta, reason);
    lootListEl.append(card);
  }
}

async function requestAlerts(code = accessCode) {
  const { data, error } = await supabase.rpc("personal_alerts_list", { p_access_code: code });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function loadAlerts({ quiet = false } = {}) {
  if (!accessCode) return;
  if (!quiet) {
    alertsRoot.replaceChildren(createText("div", "正在读取你的提醒…", "loading-card"));
    alertCount.textContent = "读取中";
  }
  try {
    renderAlerts(await requestAlerts());
  } catch (error) {
    if (!quiet) {
      alertsRoot.replaceChildren(createText("div", readableError(error, "暂时无法读取提醒，请稍后刷新。"), "empty-card"));
      alertCount.textContent = "连接异常";
    }
    throw error;
  }
}

function showLockedView(message = "") {
  window.clearInterval(alertRefreshTimer);
  window.clearInterval(priceRefreshTimer);
  accountLabel.textContent = "";
  hide(signoutButton);
  hide(appView);
  hide(authView, false);
  accessCodeInput.value = "";
  setAuthStatus(message, message ? "error" : "");
  window.setTimeout(() => accessCodeInput.focus(), 0);
}

async function showUnlockedView() {
  accountLabel.textContent = "私人空间";
  hide(signoutButton, false);
  hide(authView);
  hide(appView, false);
  await Promise.all([loadAlerts(), loadQuote(), loadAccount()]);
  loadLoot();
  window.clearInterval(alertRefreshTimer);
  alertRefreshTimer = window.setInterval(() => loadAlerts({ quiet: true }).catch(() => {}), 15000);
  window.clearInterval(priceRefreshTimer);
  priceRefreshTimer = window.setInterval(() => refreshAlertPrices(), 3000);
}

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = accessCodeInput.value.trim();
  const button = accessForm.querySelector("button[type='submit']");
  if (!code) return setAuthStatus("请输入访问口令。", "error");
  setButtonBusy(button, true, "正在进入…");
  setAuthStatus("正在确认访问口令…");
  try {
    await requestAlerts(code);
    accessCode = code;
    rememberAccessCode(code, rememberDeviceInput.checked);
    setAuthStatus("");
    await showUnlockedView();
  } catch (error) {
    setAuthStatus(readableError(error, "暂时无法进入，请稍后再试。"), "error");
  } finally {
    setButtonBusy(button, false);
  }
});

signoutButton.addEventListener("click", () => {
  forgetAccessCode();
  showLockedView();
});

alertForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!accessCode) return;
  const button = alertForm.querySelector("button[type='submit']");
  const targetPrice = Number(targetInput.value);
  const symbol = currentTokenKey();
  if (symbol.length < 5) return setFormMessage("请填写或选择正确的币种。", "error");
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) return setFormMessage("请填写大于 0 的触发价。", "error");

  setButtonBusy(button, true, "正在创建…");
  setFormMessage("正在确认币种和价格…");
  try {
    const lastPrice = await fetchPrice(symbol);
    const direction = new FormData(alertForm).get("direction");
    const { error } = await supabase.rpc("personal_alert_create", {
      p_access_code: accessCode,
      p_symbol: symbol,
      p_direction: direction,
      p_target_price: targetPrice,
      p_last_price: lastPrice,
    });
    if (error) throw error;
    targetInput.value = "";
    setFormMessage("提醒已开始，电脑可以关机。", "success");
    await loadAlerts();
  } catch (error) {
    const text = String(error?.message || "").includes("price unavailable")
      ? "没有找到这个币种，请检查后重试。"
      : readableError(error, "提醒创建失败，请稍后再试。");
    setFormMessage(text, "error");
  } finally {
    setButtonBusy(button, false);
  }
});

alertsRoot.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !accessCode) return;
  const id = Number(button.dataset.id);
  if (!Number.isSafeInteger(id)) return;
  if (button.dataset.action === "delete" && !window.confirm("确定删除这条价格提醒吗？")) return;
  button.disabled = true;

  const operation =
    button.dataset.action === "delete"
      ? supabase.rpc("personal_alert_delete", { p_access_code: accessCode, p_id: id })
      : supabase.rpc("personal_alert_set_enabled", {
          p_access_code: accessCode,
          p_id: id,
          p_enabled: button.dataset.active !== "true",
        });
  const { error } = await operation;
  if (error) showToast(readableError(error));
  else await loadAlerts();
  button.disabled = false;
});

async function boot() {
  loadBinanceSymbols();
  if (!configured) {
    hide(authView);
    hide(appView);
    hide(setupView, false);
    return;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  if (!accessCode) return showLockedView();
  try {
    await showUnlockedView();
  } catch (error) {
    forgetAccessCode();
    showLockedView(readableError(error, "已保存的访问口令失效，请重新输入。"));
  }
}

boot().catch(() => {
  hide(authView);
  hide(appView);
  hide(setupView, false);
});
