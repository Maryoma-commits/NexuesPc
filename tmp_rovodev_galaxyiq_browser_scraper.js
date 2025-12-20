// Galaxy IQ Browser Scraper
// Instructions:
// 1. Open https://galaxy-iq.com/product-categories/graphics-cards-gpu in your browser
// 2. Pass Cloudflare check
// 3. Open DevTools (F12) → Console tab
// 4. Paste this entire script and press Enter
// 5. Wait for it to finish scraping all pages
// 6. Copy the JSON output at the end

(async function scrapeGalaxyIQ() {
    console.log('🌌 Galaxy IQ Browser Scraper Started...');
    
    const categories = {
        'graphics-cards-gpu': 'GPU',
        'processors': 'CPU',
        'ram': 'RAM',
        'motherboards': 'Motherboards',
        'storage': 'Storage',
        'power-supply-psu': 'Power Supply',
        'coolers': 'Cooler',
        'computer-cases': 'Case',
        'gaming-monitors': 'Monitors',
        'laptop': 'Laptops',
        'mouse-1': 'Mouse',
        'keyboard': 'Keyboard',
        'headsets': 'Headsets'
    };
    
    let allProducts = [];
    
    // Get current category from URL
    const currentUrl = window.location.href;
    const currentCategorySlug = Object.keys(categories).find(slug => currentUrl.includes(slug));
    const currentCategory = categories[currentCategorySlug] || 'Unknown';
    
    console.log(`📦 Scraping category: ${currentCategory}`);
    
    // Function to scrape current page
    function scrapeCurrentPage() {
        const products = [];
        const productDivs = document.querySelectorAll('.product');
        
        productDivs.forEach(div => {
            try {
                // Get link and image
                const linkEl = div.querySelector('a[href*="/products/"]');
                if (!linkEl) return;
                
                const imgEl = linkEl.querySelector('img');
                if (!imgEl) return;
                
                const title = imgEl.alt.trim();
                const link = linkEl.href;
                const image = imgEl.src;
                
                // Get price
                const priceDiv = div.querySelector('.product_price');
                if (!priceDiv) return;
                
                const priceSpan = priceDiv.querySelector('.price');
                if (!priceSpan) return;
                
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
                
                // Calculate discount
                const discount = oldPrice && oldPrice > price 
                    ? Math.round(((oldPrice - price) / oldPrice) * 100) 
                    : 0;
                
                // Generate ID (hash the title)
                const hashCode = (str) => {
                    let hash = 0;
                    for (let i = 0; i < str.length; i++) {
                        const char = str.charCodeAt(i);
                        hash = ((hash << 5) - hash) + char;
                        hash = hash & hash;
                    }
                    return Math.abs(hash).toString(16);
                };
                const id = 'galaxyiq-' + hashCode(title + 'galaxyiq').substring(0, 16);
                
                products.push({
                    id: id,
                    title: title,
                    price: price,
                    old_price: oldPrice > price ? oldPrice : null,
                    raw_price: priceText,
                    raw_old_price: oldPrice > price ? oldPriceText : null,
                    detected_currency: 'IQD',
                    discount: discount,
                    image: image,
                    link: link,
                    store: 'Galaxy IQ',
                    in_stock: true,
                    category: currentCategory
                });
            } catch (e) {
                console.error('Error parsing product:', e);
            }
        });
        
        return products;
    }
    
    // Get current page number from URL
    const urlParams = new URLSearchParams(window.location.search);
    let currentPage = parseInt(urlParams.get('page')) || 1;
    
    console.log(`📄 Scraping page ${currentPage}...`);
    const pageProducts = scrapeCurrentPage();
    allProducts.push(...pageProducts);
    console.log(`✅ Found ${pageProducts.length} products on page ${currentPage}`);
    
    // Output products WITHOUT brackets for easy combining
    const productsString = allProducts.map(p => JSON.stringify(p, null, 2)).join(',\n');
    
    console.log('\n📋 RESULTS:');
    console.log(`Total products scraped: ${allProducts.length}`);
    console.log('\n📝 Copy this (NO BRACKETS - easy to combine):');
    console.log(productsString);
    
    console.log('\n\n🔄 TO SCRAPE NEXT PAGE:');
    console.log('1. Go to next page URL (add ?page=2, ?page=3, etc.)');
    console.log('2. Wait for Cloudflare check');
    console.log('3. Run this script again');
    console.log('4. Paste all results into one file with [ at start and ] at end');
    
    console.log('\n\n💡 HOW TO COMBINE:');
    console.log('Put [ at the beginning');
    console.log('Paste page 1 products');
    console.log('Add comma');
    console.log('Paste page 2 products');
    console.log('Put ] at the end');
    
    // Also copy to clipboard if available
    if (navigator.clipboard) {
        navigator.clipboard.writeText(productsString)
            .then(() => console.log('\n✅ Products copied to clipboard (without brackets)!'))
            .catch(() => console.log('\n⚠️ Could not copy to clipboard, please copy from console'));
    }
    
    return allProducts;
})();
