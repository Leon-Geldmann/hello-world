// 弹出窗口脚本

document.addEventListener('DOMContentLoaded', () => {
  loadPrices();
});

function loadPrices() {
  chrome.storage.local.get(['prices'], (result) => {
    const prices = result.prices;
    const contentDiv = document.getElementById('content');

    if (!prices || !prices.bitcoin || !prices.gold) {
      contentDiv.innerHTML = `
        <div class="error">
          暂无价格数据<br>
          请稍候片刻再试
        </div>
        <button class="refresh-btn" onclick="refreshPrices()">🔄 刷新</button>
      `;
      return;
    }

    const lastUpdate = new Date(prices.lastUpdate);
    const timeAgo = getTimeAgo(lastUpdate);

    contentDiv.innerHTML = `
      <div class="price-card">
        <h2><span class="icon">₿</span>比特币</h2>
        <div class="value">$${formatPrice(prices.bitcoin)}</div>
        <div class="label">1 BTC = ${formatPrice(prices.bitcoin)} USD</div>
      </div>

      <div class="price-card">
        <h2><span class="icon">🏆</span>黄金</h2>
        <div class="value">$${formatPrice(prices.gold)}</div>
        <div class="label">1 盎司 = ${formatPrice(prices.gold)} USD</div>
      </div>

      <button class="refresh-btn" onclick="refreshPrices()">🔄 刷新价格</button>

      <div class="update-info">
        最后更新: ${timeAgo}
      </div>
    `;
  });
}

function formatPrice(price) {
  if (!price) return '0.00';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // 秒

  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

function refreshPrices() {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = '<div class="loading">正在刷新价格...</div>';

  // 发送消息给background script强制更新
  chrome.runtime.sendMessage({ type: 'forceUpdate' }, () => {
    setTimeout(() => {
      loadPrices();
    }, 2000);
  });
}

// 将refreshPrices暴露到全局作用域
window.refreshPrices = refreshPrices;
