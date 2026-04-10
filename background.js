importScripts('constants.js');

const COINGECKO_IDS = ASSET_REGISTRY.map(a => a.apiId).join(',');
const PRICES_API = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=usd`;

async function updatePrices() {
  let raw;
  try {
    const resp = await fetch(PRICES_API);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    raw = await resp.json();
  } catch (e) {
    console.error('[PriceConverter] Fetch failed:', e);
    return;
  }

  const prices = { lastUpdate: new Date().toISOString() };
  for (const asset of ASSET_REGISTRY) {
    prices[asset.key] = raw[asset.apiId]?.usd ?? null;
  }

  const { prices: prev } = await chrome.storage.local.get(['prices']);
  const changed = ASSET_REGISTRY.some(a => prev?.[a.key] !== prices[a.key]);

  await chrome.storage.local.set({ prices });

  if (changed) {
    // Only message tabs where content scripts can run
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'pricesUpdated', prices }).catch(() => {});
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  updatePrices();
  chrome.alarms.create('updatePrices', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === 'updatePrices') updatePrices();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getPrices') {
    chrome.storage.local.get(['prices'], r => sendResponse(r.prices ?? null));
    return true;
  }
  if (msg.type === 'forceUpdate') {
    updatePrices().then(() => sendResponse({ success: true }));
    return true;
  }
});
