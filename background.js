// 后台脚本 - 负责获取黄金和比特币价格

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('价格转换器扩展已安装');
  // 立即获取价格
  updatePrices();
  // 设置定时器，每分钟更新一次
  chrome.alarms.create('updatePrices', { periodInMinutes: 1 });
});

// 监听定时器
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updatePrices') {
    updatePrices();
  }
});

// 获取比特币价格（以美元计）
async function getBitcoinPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    return data.bitcoin.usd;
  } catch (error) {
    console.error('获取比特币价格失败:', error);
    return null;
  }
}

// 获取黄金价格（每盎司美元）
async function getGoldPrice() {
  try {
    // 使用免费的黄金价格API
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd');
    const data = await response.json();
    // PAX Gold (PAXG) 代表1盎司黄金
    return data['pax-gold'].usd;
  } catch (error) {
    console.error('获取黄金价格失败:', error);
    // 如果API失败，使用备用方案
    try {
      // 备用：使用黄金ETF价格估算
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd');
      const data = await response.json();
      return data['tether-gold'].usd;
    } catch (backupError) {
      console.error('备用黄金价格API也失败:', backupError);
      return null;
    }
  }
}

// 更新价格
async function updatePrices() {
  console.log('正在更新价格...');

  const bitcoinPrice = await getBitcoinPrice();
  const goldPrice = await getGoldPrice();

  const prices = {
    bitcoin: bitcoinPrice,
    gold: goldPrice,
    lastUpdate: new Date().toISOString()
  };

  // 保存到storage
  await chrome.storage.local.set({ prices });

  console.log('价格已更新:', prices);

  // 通知所有content scripts更新显示
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, {
      type: 'pricesUpdated',
      prices: prices
    }).catch(() => {
      // 忽略错误（某些标签页可能没有content script）
    });
  });
}

// 监听来自content script和popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getPrices') {
    chrome.storage.local.get(['prices'], (result) => {
      sendResponse(result.prices || null);
    });
    return true; // 保持消息通道开启
  }

  if (request.type === 'forceUpdate') {
    updatePrices().then(() => {
      sendResponse({ success: true });
    });
    return true; // 保持消息通道开启
  }
});
