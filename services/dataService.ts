import { Product } from '../types';

export interface ProductsData {
  last_updated: string;
  total_products: number;
  sites: {
    [siteName: string]: {
      last_updated: string;
      product_count: number;
      products: any[];
    };
  };
}

/**
 * Load products directly from the frontend JSON file
 */
export const loadProductsFromFile = async (): Promise<Product[]> => {
  try {
    const response = await fetch('/data/products.json');
    
    if (!response.ok) {
      throw new Error(`Failed to load products: ${response.status}`);
    }
    
    const data: ProductsData = await response.json();
    
    // Combine products from all sites
    const allProducts: Product[] = [];
    
    for (const [siteName, siteData] of Object.entries(data.sites)) {
      const siteProducts = siteData.products.map(product => ({
        ...product,
        retailer: product.store || siteName, // Use store field or fallback to site name
        imageUrl: typeof product.image === 'string' ? product.image : product.image?.src || product.imageUrl, // Handle both string and object image formats
        url: product.link || product.url, // Map 'link' field to 'url'
        inStock: product.in_stock !== undefined ? product.in_stock : true, // Map stock status
        compareAtPrice: product.old_price, // Map discount pricing
        discountPercentage: product.discount, // Map discount percentage
        category: product.category || 'Other', // Use scraper category if available
      }));
      
      allProducts.push(...siteProducts);
    }
    
    
    return allProducts;
    
  } catch (error) {
    console.error('Failed to load products from JSON file:', error);
    return [];
  }
};

/**
 * Get data status from backend
 */
export const getDataStatus = async () => {
  try {
    const response = await fetch('http://127.0.0.1:8000/status');
    return await response.json();
  } catch (error) {
    console.error('Failed to get data status:', error);
    return null;
  }
};

/**
 * Trigger manual scraping
 */
export const triggerManualScrape = async () => {
  try {
    const response = await fetch('http://127.0.0.1:8000/scrape', {
      method: 'POST'
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to trigger scrape:', error);
    return { status: 'error', message: String(error) };
  }
};

