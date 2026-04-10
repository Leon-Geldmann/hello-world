// popup.js — relies on constants.js (ASSET_REGISTRY, DEFAULT_SETTINGS) being loaded first.

function formatUSD(price) {
  if (!price) return 'N/A';
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTimeAgo(isoString) {
  if (!isoString) return 'Never updated';
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return 'Updated just now';
  if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `Updated ${Math.floor(diff / 3600)}h ago`;
  return `Updated ${Math.floor(diff / 86400)}d ago`;
}

function renderAssets(prices, settings) {
  const listEl = document.getElementById('assetList');
  const enabledKeys = settings?.enabledAssets ?? DEFAULT_SETTINGS.enabledAssets;
  const enabledAssets = ASSET_REGISTRY.filter(a => enabledKeys.includes(a.key));

  if (enabledAssets.length === 0) {
    listEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'empty-msg';
    msg.textContent = 'No assets enabled. Open Settings to enable some.';
    listEl.appendChild(msg);
    return;
  }

  listEl.innerHTML = '';

  for (const asset of enabledAssets) {
    const card = document.createElement('div');
    card.className = 'asset-card';

    const icon = document.createElement('div');
    icon.className = 'asset-icon';
    icon.style.background = asset.color;
    icon.style.color = asset.textColor;
    icon.textContent = asset.icon;

    const info = document.createElement('div');
    info.className = 'asset-info';

    const label = document.createElement('div');
    label.className = 'asset-label';
    label.textContent = asset.label;

    const priceEl = document.createElement('div');
    priceEl.className = 'asset-price';
    priceEl.textContent = formatUSD(prices?.[asset.key]);

    info.append(label, priceEl);
    card.append(icon, info);
    listEl.appendChild(card);
  }

  document.getElementById('updateTime').textContent = formatTimeAgo(prices?.lastUpdate);
}

async function loadPrices() {
  const [localResult, syncResult] = await Promise.all([
    chrome.storage.local.get(['prices']),
    chrome.storage.sync.get(['settings']),
  ]);
  renderAssets(localResult.prices, syncResult.settings);
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const listEl = document.getElementById('assetList');
  listEl.innerHTML = '<div class="status-msg">Refreshing…</div>';
  // loadPrices is called directly in callback — no arbitrary timeout needed
  await chrome.runtime.sendMessage({ type: 'forceUpdate' });
  loadPrices();
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

loadPrices();
