// Smart Image Selection for NexusPC
// Handles processed vs original images based on store/category configuration

import { Product } from '../types';

// Background Removal Configuration - ALL stores enabled for ALL categories
const GPU_PROCESSING_CONFIG = {
  'alityan': { enabled: true, categories: ['ALL'] },
  'globaliraq': { enabled: true, categories: ['ALL'] },
  'kolshzin': { enabled: true, categories: ['ALL'] },
  '3d-iraq': { enabled: true, categories: ['ALL'] },
  'spniq': { enabled: false, categories: [] },
  'jokercenter': { enabled: true, categories: ['ALL'] },
} as const;

export type ImageType = 'processed' | 'original' | 'placeholder';

export interface ImageResult {
  url: string;
  type: ImageType;
  reason: string;
}

/**
 * Get the correct image URL for a product based on store/category configuration
 */
export function getProductImageUrl(product: Product): ImageResult {
  const storeName = normalizeStoreName(product.retailer);
  const category = product.category?.toUpperCase() || '';
  
  // Get store configuration
  const config = GPU_PROCESSING_CONFIG[storeName as keyof typeof GPU_PROCESSING_CONFIG];
  
  // If store is disabled, always use original
  if (!config || !config.enabled) {
    const originalUrl = getOriginalImageUrl(product);
    return {
      url: originalUrl,
      type: 'original',
      reason: `Store '${storeName}' disabled for processing`
    };
  }
  
  // If category is not allowed for this store, use original
  if (!config.categories.includes(category) && !config.categories.includes('ALL')) {
    const originalUrl = getOriginalImageUrl(product);
    return {
      url: originalUrl,
      type: 'original', 
      reason: `Category '${category}' not enabled for ${storeName}`
    };
  }
  
  // Store and category are enabled - check if processed image exists
  if (product.processed_image) {
    return {
      url: product.processed_image,
      type: 'processed',
      reason: 'Background removed image available'
    };
  }
  
  // Fallback to original if no processed image
  const originalUrl = getOriginalImageUrl(product);
  return {
    url: originalUrl,
    type: 'original',
    reason: 'Processed image not available'
  };
}

/**
 * Extract original image URL from product data
 */
function getOriginalImageUrl(product: Product): string {
  // Check multiple possible image fields
  if (product.imageUrl) {
    return product.imageUrl;
  }
  
  if (product.image) {
    if (typeof product.image === 'object' && product.image.src) {
      return product.image.src;
    }
    if (typeof product.image === 'string') {
      return product.image;
    }
  }
  
  // Fallback to placeholder
  return '/placeholder.jpg';
}

/**
 * Normalize store names to match backend configuration
 */
function normalizeStoreName(retailer: string): string {
  const lower = retailer.toLowerCase();
  
  if (lower.includes('alityan')) return 'alityan';
  if (lower.includes('global')) return 'globaliraq'; 
  if (lower.includes('kolshzin')) return 'kolshzin';
  if (lower.includes('3d') || lower.includes('iraq')) return '3d-iraq';
  if (lower.includes('spniq') || lower.includes('spider')) return 'spniq';
  if (lower.includes('joker')) return 'jokercenter';
  
  return lower;
}

/**
 * Check if store has background removal enabled
 */
export function isBackgroundRemovalEnabled(retailer: string): boolean {
  const storeName = normalizeStoreName(retailer);
  const config = GPU_PROCESSING_CONFIG[storeName as keyof typeof GPU_PROCESSING_CONFIG];
  return config?.enabled || false;
}

/**
 * Check if category is enabled for background removal for a specific store
 */
export function isCategoryEnabled(retailer: string, category: string): boolean {
  const storeName = normalizeStoreName(retailer);
  const config = GPU_PROCESSING_CONFIG[storeName as keyof typeof GPU_PROCESSING_CONFIG];
  
  if (!config || !config.enabled) return false;
  
  const upperCategory = category.toUpperCase();
  return config.categories.includes(upperCategory) || config.categories.includes('ALL');
}

/**
 * Get current configuration status for debugging
 */
export function getConfigStatus() {
  return GPU_PROCESSING_CONFIG;
}