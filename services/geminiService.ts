import { Product } from "../types";
import { parsePrice, calculateDiscount } from "./priceUtils";

const API_BASE_URL = "http://127.0.0.1:8000";

export const fetchProducts = async (): Promise<Product[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const url = `${API_BASE_URL}/products?sort=best_selling`;
    
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    let rawItems: any[] = [];
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data && Array.isArray(data.products)) {
      rawItems = data.products;
    }

    const getRetailerFromUrl = (link: string): string => {
      if (!link) return "Unknown Store";
      const lower = link.toLowerCase();
      if (lower.includes('kolshzin')) return 'Kolshzin';
      if (lower.includes('3d-iraq')) return '3D-Iraq';
      if (lower.includes('alityan')) return 'Alityan';
      if (lower.includes('globaliraq')) return 'GlobalIraq';
      return "Unknown Store";
    };


    let products: Product[] = rawItems.map((item: any) => {
      
      // 1. Map Image
      let foundImage = "";
      const rawImage = item.image || (Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null);

      if (rawImage) {
        if (typeof rawImage === 'string') {
          foundImage = rawImage;
        } else if (typeof rawImage === 'object' && rawImage !== null) {
          foundImage = rawImage.src || rawImage.url || "";
        }
      }

      // 2. Fix Image URLs
      if (foundImage) {
        if (foundImage.startsWith('//')) {
          foundImage = `https:${foundImage}`;
        } else if (!foundImage.startsWith('http') && !foundImage.startsWith('data:')) {
          const cleanPath = foundImage.startsWith('/') ? foundImage.substring(1) : foundImage;
          foundImage = `${API_BASE_URL}/${cleanPath}`;
        }
      }

      // 3. Map Retailer
      const productUrl = item.url || (typeof item.link === 'string' ? item.link : "#");
      const retailerName = item.store || item.site || item.vendor || getRetailerFromUrl(productUrl);

      // 4. Handle already normalized prices from backend
      // Backend now sends normalized numeric prices and raw price strings
      const normalizedPrice = typeof item.price === 'number' ? item.price : parsePrice(item.price).numericValue;
      const normalizedCompareAtPrice = typeof item.old_price === 'number' ? item.old_price : 
        (item.old_price ? parsePrice(item.old_price).numericValue : undefined);

      // 5. Use discount from backend or calculate if needed
      const discountPercentage = item.discount || 
        (normalizedCompareAtPrice ? calculateDiscount(normalizedCompareAtPrice, normalizedPrice) : 0);

      // 6. Map Title
      const title = item.name || item.title || "Untitled Product";

      return {
        id: String(item.id || Math.random().toString(36).substr(2, 9)),
        title: title,
        price: normalizedPrice,
        compareAtPrice: normalizedCompareAtPrice,
        discountPercentage: discountPercentage,
        retailer: retailerName, 
        url: productUrl, 
        imageUrl: foundImage, 
        specs: item.tags || [], 
        // Store raw price data for display formatting
        rawPrice: item.raw_price || String(normalizedPrice),
        rawCompareAtPrice: item.raw_old_price || (normalizedCompareAtPrice ? String(normalizedCompareAtPrice) : undefined),
        detectedCurrency: item.detected_currency || "IQD",
      };
    });

    return products;

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[NexusPC] Fetch failed:", error);
    if (error.name === 'AbortError') {
      throw new Error("Request timed out. The server took too long to respond.");
    }
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Network Error: Could not connect to the backend (127.0.0.1:8000). Ensure the server is running.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};