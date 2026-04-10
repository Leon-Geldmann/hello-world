// content.js — Price converter content script.
// constants.js (ASSET_REGISTRY, DEFAULT_SETTINGS, FIAT_TO_USD) is loaded before this.

// Price patterns WITHOUT /g flag to avoid lastIndex state bugs.
// Each entry declares its currency statically where possible.
const PRICE_PATTERNS = [
  { re: /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/, currency: 'USD' },
  { re: /[¥￥]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/, currency: 'CNY' },
  { re: /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*元/, currency: 'CNY' },
  { re: /€\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/, currency: 'EUR' },
  { re: /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*€/, currency: 'EUR' },
  { re: /£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/, currency: 'GBP' },
  // Currency code prefix: "USD 123.45" — currency extracted from match group 1
  { re: /(USD|CNY|EUR|GBP|JPY)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/, currency: null },
];

// Tags whose text content should never be processed
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'HEAD']);

// Tags where inserting a sibling div would produce invalid HTML
const UNSAFE_PARENT_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'DL', 'OL', 'UL']);

// MD3-inspired badge styles injected into each shadow root
const BADGE_CSS = `
:host { display: block; margin-top: 4px; }
.badge {
  display: inline-flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 12px;
  background: #FFFBFE;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15);
  font-family: system-ui, Roboto, 'Segoe UI', sans-serif;
  font-size: 12px;
  line-height: 1.4;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1C1B1F;
}
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: -0.5px;
}
.amount { font-weight: 500; font-size: 12px; }
.unit { font-size: 11px; color: #49454F; }
@media (prefers-color-scheme: dark) {
  .badge {
    background: #2B2930;
    box-shadow: 0 1px 2px rgba(0,0,0,0.5), 0 2px 6px 2px rgba(0,0,0,0.3);
  }
  .row { color: #E6E1E5; }
  .unit { color: #CAC4D0; }
}
`;

let currentPrices = null;
let currentSettings = { ...DEFAULT_SETTINGS };
let scanDebounceTimer = null;
let pendingNodes = [];

function extractPrice(text) {
  for (const { re, currency } of PRICE_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    if (currency === null) {
      // Currency-code pattern: group 1 = currency code, group 2 = amount
      return { amount: parseFloat(m[2].replace(/,/g, '')), currency: m[1].toUpperCase() };
    }
    return { amount: parseFloat(m[1].replace(/,/g, '')), currency };
  }
  return null;
}

function convertAsset(amountUSD, assetKey) {
  const price = currentPrices?.[assetKey];
  if (!price) return null;
  const ratio = amountUSD / price;

  switch (assetKey) {
    case 'gold':
      return currentSettings.goldUnit === 'g'
        ? { amount: ratio * 31.1035, unit: 'g Gold' }
        : { amount: ratio, unit: 'oz Gold' };
    case 'silver':
      return currentSettings.silverUnit === 'g'
        ? { amount: ratio * 31.1035, unit: 'g Silver' }
        : { amount: ratio, unit: 'oz Silver' };
    case 'bitcoin':
      return currentSettings.bitcoinUnit === 'sat'
        ? { amount: Math.round(ratio * 1e8), unit: 'sat' }
        : { amount: ratio, unit: 'BTC' };
    case 'ethereum': return { amount: ratio, unit: 'ETH' };
    case 'dogecoin': return { amount: ratio, unit: 'DOGE' };
    case 'xrp':      return { amount: ratio, unit: 'XRP' };
    case 'xlm':      return { amount: ratio, unit: 'XLM' };
    default: return null;
  }
}

function formatAmount(amount, unit) {
  if (unit === 'sat') return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === 'BTC') return amount.toFixed(6);
  if (unit === 'ETH') return amount.toFixed(4);
  if (unit === 'DOGE' || unit === 'XRP' || unit === 'XLM') return amount.toFixed(2);
  // Metals: grams or oz
  return amount < 0.01 ? amount.toFixed(4) : amount.toFixed(2);
}

function createBadge(amountUSD) {
  const enabledAssets = ASSET_REGISTRY.filter(a => currentSettings.enabledAssets.includes(a.key));
  const rows = [];
  for (const asset of enabledAssets) {
    const converted = convertAsset(amountUSD, asset.key);
    if (converted) rows.push({ asset, converted });
  }
  if (rows.length === 0) return null;

  const host = document.createElement('div');
  host.setAttribute('data-pc-badge', '');
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = BADGE_CSS;

  const badge = document.createElement('div');
  badge.className = 'badge';

  for (const { asset, converted } of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.setProperty('--accent', asset.color);

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = asset.icon;

    const amountEl = document.createElement('span');
    amountEl.className = 'amount';
    amountEl.textContent = formatAmount(converted.amount, converted.unit);

    const unitEl = document.createElement('span');
    unitEl.className = 'unit';
    unitEl.textContent = converted.unit;

    row.append(icon, amountEl, unitEl);
    badge.appendChild(row);
  }

  shadow.append(styleEl, badge);
  return host;
}

function scanRoot(root) {
  if (!currentPrices || currentSettings.enabledAssets.length === 0) return;
  if (!(root instanceof Element)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_SKIP;
      if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_SKIP;
      if (p.hasAttribute('data-pc-badge') || p.hasAttribute('data-pc-processed')) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const toProcess = [];
  while (walker.nextNode()) toProcess.push(walker.currentNode);

  for (const node of toProcess) {
    const parent = node.parentElement;
    if (!parent || parent.hasAttribute('data-pc-processed')) continue;
    if (!parent.parentElement || UNSAFE_PARENT_TAGS.has(parent.parentElement.tagName)) continue;

    const priceInfo = extractPrice(node.textContent);
    if (!priceInfo || priceInfo.amount < 0.01) continue;

    const usdRate = FIAT_TO_USD[priceInfo.currency] ?? 1;
    const amountUSD = priceInfo.amount * usdRate;

    const badge = createBadge(amountUSD);
    if (!badge) continue;

    parent.setAttribute('data-pc-processed', '');
    parent.insertAdjacentElement('afterend', badge);
  }
}

function refreshAllBadges() {
  document.querySelectorAll('[data-pc-badge]').forEach(el => el.remove());
  document.querySelectorAll('[data-pc-processed]').forEach(el => el.removeAttribute('data-pc-processed'));
  scanRoot(document.body);
}

async function init() {
  try {
    const [prices, syncResult] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'getPrices' }),
      chrome.storage.sync.get(['settings']),
    ]);
    currentPrices = prices;
    currentSettings = { ...DEFAULT_SETTINGS, ...(syncResult.settings ?? {}) };
  } catch (_e) {
    // Background not yet ready; will receive prices via pricesUpdated message
    const syncResult = await chrome.storage.sync.get(['settings']).catch(() => ({}));
    currentSettings = { ...DEFAULT_SETTINGS, ...(syncResult.settings ?? {}) };
  }
  scanRoot(document.body);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'pricesUpdated') {
    currentPrices = msg.prices;
    refreshAllBadges();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) {
    currentSettings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue ?? {}) };
    refreshAllBadges();
  }
});

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && !node.hasAttribute('data-pc-badge')) {
        pendingNodes.push(node);
      }
    }
  }
  clearTimeout(scanDebounceTimer);
  scanDebounceTimer = setTimeout(() => {
    const batch = pendingNodes.splice(0);
    batch.forEach(scanRoot);
  }, 500);
});

observer.observe(document.body, { childList: true, subtree: true });

init();
