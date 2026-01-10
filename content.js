// 内容脚本 - 检测网页价格并添加转换显示

let currentPrices = null;
const processedElements = new WeakSet();

// 价格匹配的正则表达式
const pricePatterns = [
  // 美元格式: $123.45, $1,234.56
  /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
  // 人民币格式: ¥123.45, ￥1,234.56, 123.45元
  /[¥￥]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
  /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*元/g,
  // 欧元格式: €123.45, 123.45€
  /€\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
  /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*€/g,
  // 英镑格式: £123.45
  /£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
  // 通用格式（带货币代码）: USD 123.45, CNY 123.45
  /(USD|CNY|EUR|GBP|JPY)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
];

// 货币符号到USD的转换率（这些是示例值，实际应该从API获取）
const currencyRates = {
  'USD': 1,
  '$': 1,
  'CNY': 0.14,
  '¥': 0.14,
  '￥': 0.14,
  '元': 0.14,
  'EUR': 1.09,
  '€': 1.09,
  'GBP': 1.27,
  '£': 1.27,
  'JPY': 0.0067,
};

// 初始化 - 获取当前价格
async function init() {
  currentPrices = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getPrices' }, (response) => {
      resolve(response);
    });
  });

  if (currentPrices && currentPrices.bitcoin && currentPrices.gold) {
    console.log('价格转换器已激活:', currentPrices);
    scanAndConvertPrices();
  }
}

// 监听来自background的价格更新消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'pricesUpdated') {
    currentPrices = request.prices;
    console.log('收到价格更新:', currentPrices);
    scanAndConvertPrices();
  }
});

// 扫描并转换页面中的价格
function scanAndConvertPrices() {
  if (!currentPrices || !currentPrices.bitcoin || !currentPrices.gold) {
    return;
  }

  // 获取所有文本节点
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // 跳过脚本、样式和已处理的元素
        if (node.parentElement.tagName === 'SCRIPT' ||
            node.parentElement.tagName === 'STYLE' ||
            node.parentElement.classList.contains('price-converter-info')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  // 处理每个文本节点
  textNodes.forEach(node => {
    const text = node.textContent;
    let hasPrice = false;

    // 检查是否包含价格
    for (const pattern of pricePatterns) {
      if (pattern.test(text)) {
        hasPrice = true;
        break;
      }
    }

    if (hasPrice && !processedElements.has(node.parentElement)) {
      processTextNode(node);
    }
  });
}

// 处理包含价格的文本节点
function processTextNode(textNode) {
  const parent = textNode.parentElement;
  if (!parent || processedElements.has(parent)) {
    return;
  }

  const text = textNode.textContent;
  let priceInfo = extractPrice(text);

  if (priceInfo) {
    processedElements.add(parent);
    addPriceConversion(parent, priceInfo);
  }
}

// 提取价格信息
function extractPrice(text) {
  for (const pattern of pricePatterns) {
    const match = pattern.exec(text);
    if (match) {
      let amount, currency;

      if (match[0].includes('USD') || match[0].includes('CNY') ||
          match[0].includes('EUR') || match[0].includes('GBP')) {
        currency = match[1].toUpperCase();
        amount = parseFloat(match[2].replace(/,/g, ''));
      } else {
        amount = parseFloat(match[1].replace(/,/g, ''));
        // 推断货币
        if (match[0].includes('$')) currency = 'USD';
        else if (match[0].includes('¥') || match[0].includes('￥') || match[0].includes('元')) currency = 'CNY';
        else if (match[0].includes('€')) currency = 'EUR';
        else if (match[0].includes('£')) currency = 'GBP';
        else currency = 'USD';
      }

      // 重置正则表达式
      pattern.lastIndex = 0;

      return { amount, currency };
    }
  }
  return null;
}

// 添加价格转换显示
function addPriceConversion(element, priceInfo) {
  const { amount, currency } = priceInfo;

  // 转换为USD
  const rate = currencyRates[currency] || 1;
  const amountInUSD = amount * rate;

  // 计算比特币和黄金等值
  const btcAmount = amountInUSD / currentPrices.bitcoin;
  const goldOunces = amountInUSD / currentPrices.gold;
  const goldGrams = goldOunces * 31.1035; // 1盎司 = 31.1035克

  // 创建转换信息元素
  const converterDiv = document.createElement('div');
  converterDiv.className = 'price-converter-info';
  converterDiv.innerHTML = `
    <div class="price-converter-item">
      <span class="price-converter-icon">₿</span>
      <span class="price-converter-value">${btcAmount.toFixed(8)} BTC</span>
    </div>
    <div class="price-converter-item">
      <span class="price-converter-icon">🏆</span>
      <span class="price-converter-value">${goldGrams.toFixed(2)} 克黄金</span>
    </div>
  `;

  // 插入到原价格元素后面
  if (element.nextSibling) {
    element.parentNode.insertBefore(converterDiv, element.nextSibling);
  } else {
    element.parentNode.appendChild(converterDiv);
  }
}

// 观察DOM变化
const observer = new MutationObserver((mutations) => {
  // 防抖处理
  clearTimeout(observer.timeout);
  observer.timeout = setTimeout(() => {
    scanAndConvertPrices();
  }, 500);
});

// 启动观察
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
