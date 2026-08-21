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
const targetInput = $("#target-price-input");
const quote = $("#quote");
const alertsRoot = $("#alerts");
const alertCount = $("#alert-count");
const formMessage = $("#form-message");
const toast = $("#toast");

const ACCESS_CODE_KEY = "price-sentinel-access-code";
const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_");

let supabase = null;
let accessCode = localStorage.getItem(ACCESS_CODE_KEY) || sessionStorage.getItem(ACCESS_CODE_KEY) || "";
let quoteTimer = null;
let alertRefreshTimer = null;

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
  "币安币": "BNB", "bnb": "BNB", "BNB": "BNB",
  "瑞波币": "XRP", "xrp": "XRP", "XRP": "XRP",
  "狗狗币": "DOGE", "doge": "DOGE", "DOGE": "DOGE",
  "卡尔达诺": "ADA", "艾达币": "ADA", "ada": "ADA", "ADA": "ADA",
  "索拉纳": "SOL", "sol": "SOL", "SOL": "SOL",
  "波卡": "DOT", "dot": "DOT", "DOT": "DOT",
  "莱特币": "LTC", "ltc": "LTC", "LTC": "LTC",
  "比特币现金": "BCH", "bch": "BCH", "BCH": "BCH",
  "柚子": "EOS", "eos": "EOS", "EOS": "EOS",
  "柴犬币": "SHIB", "shib": "SHIB", "SHIB": "SHIB",
  "波场": "TRX", "trx": "TRX", "TRX": "TRX",
  "雪崩币": "AVAX", "avax": "AVAX", "AVAX": "AVAX",
  "马蹄莲": "MATIC", "多边形": "MATIC", "matic": "MATIC", "MATIC": "MATIC",
  "链接币": "LINK", "link": "LINK", "LINK": "LINK",
  "优币": "UNI", "uni": "UNI", "UNI": "UNI",
  "阿童木": "ATOM", "atom": "ATOM", "ATOM": "ATOM",
  "恒星币": "XLM", "xlm": "XLM", "XLM": "XLM",
  "文件币": "FIL", "fil": "FIL", "FIL": "FIL",
  "以太经典": "ETC", "etc": "ETC", "ETC": "ETC",
  "新星": "NEAR", "near": "NEAR", "NEAR": "NEAR",
  "阿普托斯": "APT", "apt": "APT", "APT": "APT",
  "阿比特": "ARB", "arb": "ARB", "ARB": "ARB",
  "乐观币": "OP", "op": "OP", "OP": "OP",
  "龙币": "SUI", "sui": "SUI", "SUI": "SUI",
  "西伊币": "SEI", "sei": "SEI", "SEI": "SEI",
  "小币": "PEPE", "pepe": "PEPE", "PEPE": "PEPE",
  "世界币": "WLD", "wld": "WLD", "WLD": "WLD",
  "重组": "RNDR", "rndr": "RNDR", "RNDR": "RNDR",
};

function symbolFromInput() {
  const raw = coinInput.value.trim();
  const alias = COIN_ALIASES[raw] || COIN_ALIASES[raw.toUpperCase()];
  const base = (alias || raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!base) return "";
  return base.endsWith("USDT") ? base : `${base}USDT`;
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

async function fetchPrice(symbol) {
  const endpoints = [
    `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
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
  const symbol = symbolFromInput();
  if (symbol.length < 5) return;
  const base = symbol.replace(/USDT$/, "");
  quote.replaceChildren(createText("span", `${base} 当前价格`), createText("b", "正在读取…"));
  try {
    const price = await fetchPrice(symbol);
    quote.replaceChildren(createText("span", `${base} 当前价格`), createText("b", money(price)));
  } catch {
    quote.replaceChildren(createText("span", `${base} 当前价格`), createText("b", "未找到该交易对"));
  }
}

coinInput.addEventListener("input", () => {
  coinInput.value = coinInput.value.toUpperCase();
  quoteTimer = window.setTimeout(loadQuote, 350);
});

function createText(tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderAlerts(alerts) {
  const activeCount = alerts.filter((item) => item.enabled && !item.triggered_at).length;
  alertCount.textContent = `${activeCount} 个进行中`;
  alertsRoot.replaceChildren();

  if (!alerts.length) {
    alertsRoot.append(createText("div", "还没有提醒。在左边填币种和触发价即可开始。", "empty-card"));
    return;
  }

  for (const item of alerts) {
    const base = String(item.symbol).replace(/USDT$/, "");
    const active = item.enabled && !item.triggered_at;
    const condition = item.direction === "above" ? "涨到" : "跌到";
    const card = document.createElement("article");
    card.className = "alert-card";

    const icon = createText("div", base.slice(0, 4), "token-icon");
    const main = document.createElement("div");
    main.className = "alert-main";
    const title = document.createElement("div");
    title.className = "alert-title";
    title.append(createText("b", `${base} / USDT`));
    title.append(
      createText(
        "span",
        active ? "● 监控中" : item.triggered_at ? "✓ 已触发" : "已暂停",
        `status-pill${item.triggered_at ? " triggered" : ""}`,
      ),
    );
    const target = document.createElement("div");
    target.className = "alert-target";
    target.append("当前 ", createText("strong", money(item.last_price)), ` · ${condition} `);
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
  window.clearInterval(alertRefreshTimer);
  alertRefreshTimer = window.setInterval(() => loadAlerts({ quiet: true }).catch(() => {}), 15000);
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
  const symbol = symbolFromInput();
  if (symbol.length < 5) return setFormMessage("请填写正确的币种。", "error");
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
