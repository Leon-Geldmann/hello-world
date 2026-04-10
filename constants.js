// Shared constants for the Price Converter extension.
// Loaded via content_scripts before content.js, and via <script> in popup/options.
// Imported in background.js via importScripts('constants.js').

const ASSET_REGISTRY = [
  { key: 'bitcoin',  apiId: 'bitcoin',        label: 'Bitcoin',  symbol: 'BTC',  icon: '₿',  color: '#F7931A', textColor: '#fff' },
  { key: 'ethereum', apiId: 'ethereum',        label: 'Ethereum', symbol: 'ETH',  icon: 'Ξ',  color: '#627EEA', textColor: '#fff' },
  { key: 'dogecoin', apiId: 'dogecoin',        label: 'Dogecoin', symbol: 'DOGE', icon: 'Ð',  color: '#C2A633', textColor: '#fff' },
  { key: 'xrp',      apiId: 'ripple',          label: 'XRP',      symbol: 'XRP',  icon: 'X',  color: '#00AAE4', textColor: '#fff' },
  { key: 'xlm',      apiId: 'stellar',         label: 'XLM',      symbol: 'XLM',  icon: '✦',  color: '#14B6E7', textColor: '#fff' },
  { key: 'gold',     apiId: 'pax-gold',        label: 'Gold',     symbol: 'XAU',  icon: 'Au', color: '#D4AF37', textColor: '#fff' },
  { key: 'silver',   apiId: 'kinesis-silver',  label: 'Silver',   symbol: 'XAG',  icon: 'Ag', color: '#9E9E9E', textColor: '#fff' },
];

const DEFAULT_SETTINGS = {
  enabledAssets: ['bitcoin', 'gold'],
  goldUnit: 'g',      // 'oz' | 'g'
  silverUnit: 'oz',   // 'oz' | 'g'
  bitcoinUnit: 'BTC', // 'BTC' | 'sat'
};

// Approximate fiat-to-USD rates (intentionally static — minor drift is acceptable
// for a reference tool; updating these requires no API key and reduces complexity).
const FIAT_TO_USD = {
  USD: 1,
  CNY: 0.138,
  EUR: 1.08,
  GBP: 1.26,
  JPY: 0.0066,
};
