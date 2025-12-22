// Background Service Worker - Runs independently of popup

// Galaxy IQ categories
const CATEGORIES = [
  { name: 'Motherboards', url: 'https://galaxy-iq.com/product-categories/motherboards' },
  { name: 'Coolers', url: 'https://galaxy-iq.com/product-categories/coolers' },
  { name: 'Cases', url: 'https://galaxy-iq.com/product-categories/computer-cases' },
  { name: 'GPUs', url: 'https://galaxy-iq.com/product-categories/graphics-cards-gpu' },
  { name: 'PSUs', url: 'https://galaxy-iq.com/product-categories/power-supply-psu' },
  { name: 'RAM', url: 'https://galaxy-iq.com/product-categories/ram' },
  { name: 'Storage', url: 'https://galaxy-iq.com/product-categories/storage' },
  { name: 'CPUs', url: 'https://galaxy-iq.com/product-categories/processors' },
  { name: 'Monitors', url: 'https://galaxy-iq.com/product-categories/gaming-monitors' },
  { name: 'Laptops', url: 'https://galaxy-iq.com/product-categories/laptop' },
  { name: 'Keyboards', url: 'https://galaxy-iq.com/product-categories/keyboard' },
  { name: 'Headsets', url: 'https://galaxy-iq.com/product-categories/headsets' },
  { name: 'Mice', url: 'https://galaxy-iq.com/product-categories/mouse-1' }
];

let scrapingState = {
  isRunning: false,
  shouldStop: false,
  currentCategory: 0,
  totalProducts: 0,
  products: [],
  status: 'idle'
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse(scrapingState);
  } else if (request.action === 'startScraping') {
    startScrapingAll();
    sendResponse({ success: true });
  } else if (request.action === 'stopScraping') {
    scrapingState.shouldStop = true;
    scrapingState.status = 'Stopping...';
    sendResponse({ success: true });
  } else if (request.action === 'clearData') {
    scrapingState.products = [];
    scrapingState.totalProducts = 0;
    scrapingState.currentCategory = 0;
    scrapingState.status = 'idle';
    sendResponse({ success: true });
  } else if (request.action === 'getProducts') {
    sendResponse({ products: scrapingState.products });
  }
  return true; // Keep channel open for async response
});

async function startScrapingAll() {
  if (scrapingState.isRunning) {
    console.log('Already scraping');
    return;
  }

  scrapingState.isRunning = true;
  scrapingState.shouldStop = false;
  scrapingState.currentCategory = 0;
  scrapingState.status = 'Starting...';

  for (let i = 0; i < CATEGORIES.length; i++) {
    if (scrapingState.shouldStop) break;

    const category = CATEGORIES[i];
    scrapingState.currentCategory = i + 1;
    scrapingState.status = `Scraping ${category.name}... (${i + 1}/${CATEGORIES.length})`;

    try {
      // Open category in new tab
      const tab = await chrome.tabs.create({ url: category.url, active: false });

      // Wait for page to load
      await waitForPageLoad(tab.id);

      // Scrape all pages in this category
      let pageNum = 1;
      let hasMorePages = true;

      while (hasMorePages && !scrapingState.shouldStop) {
        const pageUrl = pageNum === 1 ? category.url : `${category.url}?page=${pageNum}`;

        if (pageNum > 1) {
          await chrome.tabs.update(tab.id, { url: pageUrl });
          await waitForPageLoad(tab.id);
        }

        // Scrape page
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: scraperFunction
          });

          const products = results[0].result;

          if (products && products.length > 0) {
            // Remove duplicates by checking product URL
            const existingUrls = new Set(scrapingState.products.map(p => p.url));
            const newProducts = products.filter(p => !existingUrls.has(p.url));
            
            if (newProducts.length > 0) {
              scrapingState.products = scrapingState.products.concat(newProducts);
              scrapingState.totalProducts = scrapingState.products.length;
              scrapingState.status = `${category.name} page ${pageNum}: +${newProducts.length} new (${products.length - newProducts.length} duplicates) - Total: ${scrapingState.totalProducts}`;
            } else {
              scrapingState.status = `${category.name} page ${pageNum}: All ${products.length} products already scraped`;
            }

            // Check if there's a next page
            const hasNext = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: () => {
                const nextBtn = document.querySelector('a[rel="next"], .next-page, [class*="next"]');
                return nextBtn !== null && !nextBtn.classList.contains('disabled');
              }
            });

            hasMorePages = hasNext[0].result;
            pageNum++;

            // Small delay to avoid rate limiting
            await sleep(2000);
          } else {
            hasMorePages = false;
          }
        } catch (error) {
          console.error(`Error scraping page ${pageNum}:`, error);
          hasMorePages = false;
        }
      }

      // Close tab
      await chrome.tabs.remove(tab.id);

      // Delay between categories
      await sleep(1000);

    } catch (error) {
      console.error(`Error scraping ${category.name}:`, error);
      scrapingState.status = `Error scraping ${category.name}`;
    }
  }

  // Done
  scrapingState.isRunning = false;

  if (scrapingState.shouldStop) {
    scrapingState.status = `Stopped at ${scrapingState.currentCategory}/${CATEGORIES.length} categories`;
    showNotification('Scraping Stopped', `Scraped ${scrapingState.totalProducts} products from ${scrapingState.currentCategory} categories`);
  } else {
    scrapingState.status = `✅ Complete! ${scrapingState.totalProducts} products from ${CATEGORIES.length} categories`;
    showNotification('Scraping Complete! 🎉', `Successfully scraped ${scrapingState.totalProducts} products from all categories!`);
    
    // Auto-download JSON file
    downloadJSON();
  }
}

// Function to download scraped products as JSON
function downloadJSON() {
  const jsonData = JSON.stringify(scrapingState.products, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `galaxyiq_scraped_data_${timestamp}.json`;
  
  // Trigger download
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false // Auto-save to default downloads folder
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('Download failed:', chrome.runtime.lastError);
    } else {
      console.log(`Download started: ${filename} (ID: ${downloadId})`);
      // Revoke the blob URL after download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500); // Extra delay for dynamic content
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.svg',
    title: title,
    message: message,
    priority: 2
  });
}

// MD5 hash function (same as Python backend)
function md5(string) {
  function rotateLeft(value, shift) {
    return (value << shift) | (value >>> (32 - shift));
  }
  
  function addUnsigned(x, y) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }
  
  function md5cmn(q, a, b, x, s, t) {
    return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, q), addUnsigned(x, t)), s), b);
  }
  
  function md5ff(a, b, c, d, x, s, t) {
    return md5cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }
  
  function md5gg(a, b, c, d, x, s, t) {
    return md5cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }
  
  function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  
  function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | (~d)), a, b, x, s, t);
  }
  
  function convertToWordArray(string) {
    const lWordCount = (((string.length + 8) - ((string.length + 8) % 64)) / 64 + 1) * 16;
    const lWordArray = Array(lWordCount - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    
    while (lByteCount < string.length) {
      const lWordIndex = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordIndex] = (lWordArray[lWordIndex] | (string.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    
    const lWordIndex = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordIndex] = lWordArray[lWordIndex] | (0x80 << lBytePosition);
    lWordArray[lWordArray.length - 2] = string.length << 3;
    lWordArray[lWordArray.length - 1] = string.length >>> 29;
    
    return lWordArray;
  }
  
  function wordToHex(value) {
    let result = '';
    for (let i = 0; i <= 3; i++) {
      const byte = (value >>> (i * 8)) & 255;
      result += ('0' + byte.toString(16)).slice(-2);
    }
    return result;
  }
  
  const x = convertToWordArray(string);
  let a = 0x67452301;
  let b = 0xEFCDAB89;
  let c = 0x98BADCFE;
  let d = 0x10325476;
  
  for (let k = 0; k < x.length; k += 16) {
    const AA = a;
    const BB = b;
    const CC = c;
    const DD = d;
    
    a = md5ff(a, b, c, d, x[k + 0], 7, 0xD76AA478);
    d = md5ff(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
    c = md5ff(c, d, a, b, x[k + 2], 17, 0x242070DB);
    b = md5ff(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
    a = md5ff(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
    d = md5ff(d, a, b, c, x[k + 5], 12, 0x4787C62A);
    c = md5ff(c, d, a, b, x[k + 6], 17, 0xA8304613);
    b = md5ff(b, c, d, a, x[k + 7], 22, 0xFD469501);
    a = md5ff(a, b, c, d, x[k + 8], 7, 0x698098D8);
    d = md5ff(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
    c = md5ff(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
    b = md5ff(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
    a = md5ff(a, b, c, d, x[k + 12], 7, 0x6B901122);
    d = md5ff(d, a, b, c, x[k + 13], 12, 0xFD987193);
    c = md5ff(c, d, a, b, x[k + 14], 17, 0xA679438E);
    b = md5ff(b, c, d, a, x[k + 15], 22, 0x49B40821);
    
    a = md5gg(a, b, c, d, x[k + 1], 5, 0xF61E2562);
    d = md5gg(d, a, b, c, x[k + 6], 9, 0xC040B340);
    c = md5gg(c, d, a, b, x[k + 11], 14, 0x265E5A51);
    b = md5gg(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
    a = md5gg(a, b, c, d, x[k + 5], 5, 0xD62F105D);
    d = md5gg(d, a, b, c, x[k + 10], 9, 0x2441453);
    c = md5gg(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
    b = md5gg(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
    a = md5gg(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
    d = md5gg(d, a, b, c, x[k + 14], 9, 0xC33707D6);
    c = md5gg(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
    b = md5gg(b, c, d, a, x[k + 8], 20, 0x455A14ED);
    a = md5gg(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
    d = md5gg(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
    c = md5gg(c, d, a, b, x[k + 7], 14, 0x676F02D9);
    b = md5gg(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
    
    a = md5hh(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
    d = md5hh(d, a, b, c, x[k + 8], 11, 0x8771F681);
    c = md5hh(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
    b = md5hh(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
    a = md5hh(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
    d = md5hh(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
    c = md5hh(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
    b = md5hh(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
    a = md5hh(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
    d = md5hh(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
    c = md5hh(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
    b = md5hh(b, c, d, a, x[k + 6], 23, 0x4881D05);
    a = md5hh(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
    d = md5hh(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
    c = md5hh(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
    b = md5hh(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
    
    a = md5ii(a, b, c, d, x[k + 0], 6, 0xF4292244);
    d = md5ii(d, a, b, c, x[k + 7], 10, 0x432AFF97);
    c = md5ii(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
    b = md5ii(b, c, d, a, x[k + 5], 21, 0xFC93A039);
    a = md5ii(a, b, c, d, x[k + 12], 6, 0x655B59C3);
    d = md5ii(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
    c = md5ii(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
    b = md5ii(b, c, d, a, x[k + 1], 21, 0x85845DD1);
    a = md5ii(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
    d = md5ii(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
    c = md5ii(c, d, a, b, x[k + 6], 15, 0xA3014314);
    b = md5ii(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
    a = md5ii(a, b, c, d, x[k + 4], 6, 0xF7537E82);
    d = md5ii(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
    c = md5ii(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
    b = md5ii(b, c, d, a, x[k + 9], 21, 0xEB86D391);
    
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// Scraper function that runs in the page context
function scraperFunction() {
  // MD5 function must be inside to be injected into page context
  function md5(string) {
    function rotateLeft(value, shift) {
      return (value << shift) | (value >>> (32 - shift));
    }
    function addUnsigned(x, y) {
      const lsw = (x & 0xFFFF) + (y & 0xFFFF);
      const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xFFFF);
    }
    function md5cmn(q, a, b, x, s, t) {
      return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, q), addUnsigned(x, t)), s), b);
    }
    function md5ff(a, b, c, d, x, s, t) {
      return md5cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    function md5gg(a, b, c, d, x, s, t) {
      return md5cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    function md5hh(a, b, c, d, x, s, t) {
      return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5ii(a, b, c, d, x, s, t) {
      return md5cmn(c ^ (b | (~d)), a, b, x, s, t);
    }
    function convertToWordArray(string) {
      const lWordCount = (((string.length + 8) - ((string.length + 8) % 64)) / 64 + 1) * 16;
      const lWordArray = Array(lWordCount - 1);
      let lBytePosition = 0, lByteCount = 0;
      while (lByteCount < string.length) {
        const lWordIndex = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordIndex] = (lWordArray[lWordIndex] | (string.charCodeAt(lByteCount) << lBytePosition));
        lByteCount++;
      }
      const lWordIndex = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordIndex] = lWordArray[lWordIndex] | (0x80 << lBytePosition);
      lWordArray[lWordArray.length - 2] = string.length << 3;
      lWordArray[lWordArray.length - 1] = string.length >>> 29;
      return lWordArray;
    }
    function wordToHex(value) {
      let result = '';
      for (let i = 0; i <= 3; i++) {
        const byte = (value >>> (i * 8)) & 255;
        result += ('0' + byte.toString(16)).slice(-2);
      }
      return result;
    }
    const x = convertToWordArray(string);
    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    for (let k = 0; k < x.length; k += 16) {
      const AA = a, BB = b, CC = c, DD = d;
      a = md5ff(a, b, c, d, x[k + 0], 7, 0xD76AA478);
      d = md5ff(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
      c = md5ff(c, d, a, b, x[k + 2], 17, 0x242070DB);
      b = md5ff(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
      a = md5ff(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
      d = md5ff(d, a, b, c, x[k + 5], 12, 0x4787C62A);
      c = md5ff(c, d, a, b, x[k + 6], 17, 0xA8304613);
      b = md5ff(b, c, d, a, x[k + 7], 22, 0xFD469501);
      a = md5ff(a, b, c, d, x[k + 8], 7, 0x698098D8);
      d = md5ff(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
      c = md5ff(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
      b = md5ff(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
      a = md5ff(a, b, c, d, x[k + 12], 7, 0x6B901122);
      d = md5ff(d, a, b, c, x[k + 13], 12, 0xFD987193);
      c = md5ff(c, d, a, b, x[k + 14], 17, 0xA679438E);
      b = md5ff(b, c, d, a, x[k + 15], 22, 0x49B40821);
      a = md5gg(a, b, c, d, x[k + 1], 5, 0xF61E2562);
      d = md5gg(d, a, b, c, x[k + 6], 9, 0xC040B340);
      c = md5gg(c, d, a, b, x[k + 11], 14, 0x265E5A51);
      b = md5gg(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
      a = md5gg(a, b, c, d, x[k + 5], 5, 0xD62F105D);
      d = md5gg(d, a, b, c, x[k + 10], 9, 0x2441453);
      c = md5gg(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
      b = md5gg(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
      a = md5gg(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
      d = md5gg(d, a, b, c, x[k + 14], 9, 0xC33707D6);
      c = md5gg(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
      b = md5gg(b, c, d, a, x[k + 8], 20, 0x455A14ED);
      a = md5gg(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
      d = md5gg(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
      c = md5gg(c, d, a, b, x[k + 7], 14, 0x676F02D9);
      b = md5gg(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
      a = md5hh(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
      d = md5hh(d, a, b, c, x[k + 8], 11, 0x8771F681);
      c = md5hh(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
      b = md5hh(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
      a = md5hh(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
      d = md5hh(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
      c = md5hh(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
      b = md5hh(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
      a = md5hh(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
      d = md5hh(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
      c = md5hh(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
      b = md5hh(b, c, d, a, x[k + 6], 23, 0x4881D05);
      a = md5hh(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
      d = md5hh(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
      c = md5hh(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
      b = md5hh(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
      a = md5ii(a, b, c, d, x[k + 0], 6, 0xF4292244);
      d = md5ii(d, a, b, c, x[k + 7], 10, 0x432AFF97);
      c = md5ii(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
      b = md5ii(b, c, d, a, x[k + 5], 21, 0xFC93A039);
      a = md5ii(a, b, c, d, x[k + 12], 6, 0x655B59C3);
      d = md5ii(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
      c = md5ii(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
      b = md5ii(b, c, d, a, x[k + 1], 21, 0x85845DD1);
      a = md5ii(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
      d = md5ii(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
      c = md5ii(c, d, a, b, x[k + 6], 15, 0xA3014314);
      b = md5ii(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
      a = md5ii(a, b, c, d, x[k + 4], 6, 0xF7537E82);
      d = md5ii(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
      c = md5ii(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
      b = md5ii(b, c, d, a, x[k + 9], 21, 0xEB86D391);
      a = addUnsigned(a, AA);
      b = addUnsigned(b, BB);
      c = addUnsigned(c, CC);
      d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
  }

  const products = [];
  const productDivs = document.querySelectorAll('.product');

  for (const div of productDivs) {
    try {
      // Get link and image
      const linkEl = div.querySelector('a[href*="/products/"]');
      if (!linkEl) continue;

      const imgEl = linkEl.querySelector('img');
      if (!imgEl) continue;

      const title = imgEl.alt.trim();
      const productUrl = linkEl.href;

      // Use image proxy to bypass hotlink protection
      let image = imgEl.src;
      if (image.includes('galaxy-iq.com')) {
        const imageUrl = image.replace('https://', '').replace('http://', '');
        image = `https://images.weserv.nl/?url=${imageUrl}`;
      }

      // Get price
      const priceDiv = div.querySelector('.product_price');
      if (!priceDiv) continue;

      const priceSpan = priceDiv.querySelector('.price');
      if (!priceSpan) continue;

      const priceText = priceSpan.textContent.trim();

      // Get old price if exists
      const delTag = priceDiv.querySelector('del');
      const oldPriceText = delTag ? delTag.textContent.trim() : null;

      // Parse prices (remove currency and commas)
      const parsePrice = (priceStr) => {
        if (!priceStr) return 0;
        const clean = priceStr.replace(/[^\d,]/g, '').replace(/,/g, '');
        return parseInt(clean) || 0;
      };

      const price = parsePrice(priceText);
      const oldPrice = parsePrice(oldPriceText);

      // Check stock status
      const stockBadge = div.querySelector('.pr_flash');
      const isOutOfStock = stockBadge && stockBadge.textContent.includes('إنتهى من المخزن');
      const inStock = !isOutOfStock;

      // Get category from URL
      const url = window.location.href;
      let category = 'Other';

      if (url.includes('/processors')) category = 'CPU';
      else if (url.includes('/graphics-cards-gpu')) category = 'GPU';
      else if (url.includes('/motherboards')) category = 'Motherboards';
      else if (url.includes('/ram')) category = 'RAM';
      else if (url.includes('/storage')) category = 'Storage';
      else if (url.includes('/power-supply-psu')) category = 'Power Supply';
      else if (url.includes('/coolers')) category = 'Cooler';
      else if (url.includes('/computer-cases')) category = 'Case';
      else if (url.includes('/gaming-monitors')) category = 'Monitor';
      else if (url.includes('/laptop')) category = 'Laptop';
      else if (url.includes('/keyboard')) category = 'Keyboard';
      else if (url.includes('/mouse-1')) category = 'Mouse';
      else if (url.includes('/headsets')) category = 'Headset';

      // Generate consistent ID using MD5 hash (same as backend scraper)
      const productId = `galaxyiq-${md5(title + '_galaxyiq').substring(0, 16)}`;

      const product = {
        id: productId,
        title: title,
        price: price,
        old_price: oldPrice > price ? oldPrice : price,
        raw_price: priceText,
        category: category,
        url: productUrl,
        image: image,
        in_stock: inStock,
        retailer: 'galaxyiq',
        site: 'galaxyiq'
      };

      products.push(product);
    } catch (error) {
      console.error('Error parsing product:', error);
    }
  }

  // Remove duplicates by ID (same product appearing multiple times on page)
  const uniqueProducts = [];
  const seenIds = new Set();
  for (const product of products) {
    if (!seenIds.has(product.id)) {
      seenIds.add(product.id);
      uniqueProducts.push(product);
    }
  }

  return uniqueProducts;
}
