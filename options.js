// options.js — relies on constants.js (ASSET_REGISTRY, DEFAULT_SETTINGS) being loaded first.

let settings = { ...DEFAULT_SETTINGS };

function buildAssetToggles() {
  const container = document.getElementById('assetList');
  container.innerHTML = '';

  for (const asset of ASSET_REGISTRY) {
    const isEnabled = settings.enabledAssets.includes(asset.key);

    // Outer label makes the entire row a click target for the checkbox
    const row = document.createElement('label');
    row.className = 'switch-row';

    const iconEl = document.createElement('div');
    iconEl.className = 'row-icon';
    iconEl.style.background = asset.color;
    iconEl.textContent = asset.icon;

    const textEl = document.createElement('div');
    textEl.className = 'row-text';

    const labelEl = document.createElement('div');
    labelEl.className = 'row-label';
    labelEl.textContent = asset.label;

    const descEl = document.createElement('div');
    descEl.className = 'row-desc';
    descEl.textContent = asset.symbol;

    textEl.append(labelEl, descEl);

    const switchEl = document.createElement('div');
    switchEl.className = 'switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = isEnabled;
    input.addEventListener('change', () => onAssetToggle(asset.key, input.checked));

    const track = document.createElement('span');
    track.className = 'switch-track';

    const thumb = document.createElement('span');
    thumb.className = 'switch-thumb';

    switchEl.append(input, track, thumb);
    row.append(iconEl, textEl, switchEl);
    container.appendChild(row);
  }
}

function syncUnitSectionVisibility() {
  const goldOn = settings.enabledAssets.includes('gold');
  const silverOn = settings.enabledAssets.includes('silver');
  const btcOn = settings.enabledAssets.includes('bitcoin');

  document.getElementById('goldUnitBlock').classList.toggle('hidden', !goldOn);
  document.getElementById('silverUnitBlock').classList.toggle('hidden', !silverOn);
  document.getElementById('bitcoinUnitBlock').classList.toggle('hidden', !btcOn);
  document.getElementById('unitsSection').classList.toggle('hidden', !goldOn && !silverOn && !btcOn);
}

function onAssetToggle(key, enabled) {
  if (enabled) {
    if (!settings.enabledAssets.includes(key)) settings.enabledAssets.push(key);
  } else {
    settings.enabledAssets = settings.enabledAssets.filter(k => k !== key);
  }
  syncUnitSectionVisibility();
  saveSettings();
}

function saveSettings() {
  chrome.storage.sync.set({ settings });
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(['settings']);
  settings = { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) };

  buildAssetToggles();
  syncUnitSectionVisibility();

  // Restore radio selections
  const goldRadio = document.querySelector(`input[name="goldUnit"][value="${settings.goldUnit}"]`);
  if (goldRadio) goldRadio.checked = true;

  const silverRadio = document.querySelector(`input[name="silverUnit"][value="${settings.silverUnit}"]`);
  if (silverRadio) silverRadio.checked = true;

  const btcRadio = document.querySelector(`input[name="bitcoinUnit"][value="${settings.bitcoinUnit}"]`);
  if (btcRadio) btcRadio.checked = true;
}

// Wire up radio buttons
document.querySelectorAll('input[name="goldUnit"]').forEach(input => {
  input.addEventListener('change', () => { settings.goldUnit = input.value; saveSettings(); });
});
document.querySelectorAll('input[name="silverUnit"]').forEach(input => {
  input.addEventListener('change', () => { settings.silverUnit = input.value; saveSettings(); });
});
document.querySelectorAll('input[name="bitcoinUnit"]').forEach(input => {
  input.addEventListener('change', () => { settings.bitcoinUnit = input.value; saveSettings(); });
});

loadSettings();
