// ProductIntegrationService for NexusPC Community Posts
// Handles product search, tagging, ratings, and price updates
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9, 5.10
import { 
  ref, 
  get, 
  set, 
  update, 
  remove,
  query,
  orderByChild,
  equalTo,
  onValue
} from 'firebase/database';
import { database } from '../firebase.config';
import { 
  ProductReference,
  PostError,
  PostErrorType
} from '../types/community-posts';
import { Product } from '../types';

/**
 * Product rating data structure
 */
export interface ProductRating {
  productId: string;
  userId: string;
  rating: number; // 1-5 stars
  createdAt: number;
  updatedAt?: number;
}

/**
 * Product rating summary
 */
export interface ProductRatingSummary {
  productId: string;
  averageRating: number;
  totalRatings: number;
  ratingDistribution: Record<number, number>; // 1-5 -> count
}

/**
 * Price update notification
 */
export interface PriceUpdateNotification {
  id: string;
  productId: string;
  productTitle: string;
  oldPrice: number;
  newPrice: number;
  priceChange: number;
  percentageChange: number;
  createdAt: number;
  notifiedUsers: string[];
}

/**
 * Product recommendation
 */
export interface ProductRecommendation {
  product: ProductReference;
  score: number;
  reason: string;
}

/**
 * ProductIntegrationService handles all product-related operations for community posts
 */
export class ProductIntegrationService {
  
  /**
   * Search products from the NexusPC database
   * @param products - Array of all products
   * @param searchQuery - Search query string
   * @param limit - Maximum number of results
   * @returns Filtered products matching the query
   * Requirement: 5.1
   */
  searchProducts(products: Product[], searchQuery: string, limit: number = 10): Product[] {
    if (!searchQuery || searchQuery.trim().length < 2) {
      return [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    return products
      .filter(product => 
        product.title.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.retailer.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query)
      )
      .slice(0, limit);
  }
  
  /**
   * Convert a Product to ProductReference for tagging
   * @param product - Product to convert
   * @returns ProductReference for use in posts
   * Requirement: 5.1
   */
  productToReference(product: Product): ProductReference {
    return {
      productId: product.id,
      title: product.title,
      imageUrl: product.imageUrl || '',
      price: product.price,
      retailer: product.retailer,
      category: product.category || 'Other'
    };
  }
  
  /**
   * Validate a product reference has all required fields
   * @param productRef - ProductReference to validate
   * @returns Validation result
   * Requirement: 5.2
   */
  validateProductReference(productRef: ProductReference): {
    isValid: boolean;
    hasPrice: boolean;
    hasRetailer: boolean;
    hasTitle: boolean;
    missingFields: string[];
  } {
    const missingFields: string[] = [];
    
    if (!productRef.productId) missingFields.push('productId');
    if (!productRef.title) missingFields.push('title');
    if (productRef.price === undefined || productRef.price === null) missingFields.push('price');
    if (!productRef.retailer) missingFields.push('retailer');
    
    return {
      isValid: missingFields.length === 0,
      hasPrice: productRef.price !== undefined && productRef.price !== null,
      hasRetailer: Boolean(productRef.retailer),
      hasTitle: Boolean(productRef.title),
      missingFields
    };
  }
  
  /**
   * Rate a product (1-5 stars)
   * @param productId - Product ID
   * @param userId - User ID
   * @param rating - Rating value (1-5)
   * @returns Promise<void>
   * Requirement: 5.6
   */
  async rateProduct(productId: string, userId: string, rating: number): Promise<void> {
    // Validate rating
    if (!ProductRatingLogic.isValidRating(rating)) {
      throw new PostError(PostErrorType.PERMISSION_DENIED, 'Rating must be between 1 and 5');
    }
    
    const ratingRef = ref(database, `productRatings/${productId}/${userId}`);
    const existingSnapshot = await get(ratingRef);
    
    const ratingData: ProductRating = {
      productId,
      userId,
      rating,
      createdAt: existingSnapshot.exists() ? existingSnapshot.val().createdAt : Date.now(),
      updatedAt: existingSnapshot.exists() ? Date.now() : undefined
    };
    
    await set(ratingRef, ratingData);
    
    // Update product rating summary
    await this.updateRatingSummary(productId);
  }
  
  /**
   * Get user's rating for a product
   * @param productId - Product ID
   * @param userId - User ID
   * @returns Promise<number | null>
   */
  async getUserRating(productId: string, userId: string): Promise<number | null> {
    const ratingRef = ref(database, `productRatings/${productId}/${userId}`);
    const snapshot = await get(ratingRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val().rating;
  }
  
  /**
   * Get product rating summary
   * @param productId - Product ID
   * @returns Promise<ProductRatingSummary | null>
   * Requirement: 5.7
   */
  async getProductRatingSummary(productId: string): Promise<ProductRatingSummary | null> {
    const summaryRef = ref(database, `productRatingSummaries/${productId}`);
    const snapshot = await get(summaryRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val();
  }
  
  /**
   * Update product rating summary after a new rating
   * @param productId - Product ID
   */
  private async updateRatingSummary(productId: string): Promise<void> {
    const ratingsRef = ref(database, `productRatings/${productId}`);
    const snapshot = await get(ratingsRef);
    
    if (!snapshot.exists()) {
      // Remove summary if no ratings
      await remove(ref(database, `productRatingSummaries/${productId}`));
      return;
    }
    
    const ratings: ProductRating[] = [];
    snapshot.forEach((child) => {
      ratings.push(child.val());
    });
    
    const summary = ProductRatingLogic.calculateRatingSummary(productId, ratings);
    await set(ref(database, `productRatingSummaries/${productId}`), summary);
  }
  
  /**
   * Get related product recommendations
   * @param product - Base product
   * @param allProducts - All available products
   * @param limit - Maximum recommendations
   * @returns Array of recommended products
   * Requirement: 5.9
   */
  getRelatedProducts(
    product: ProductReference, 
    allProducts: Product[], 
    limit: number = 5
  ): ProductRecommendation[] {
    return ProductRecommendationLogic.getRelatedProducts(product, allProducts, limit);
  }
  
  /**
   * Check for price updates and create notifications
   * @param oldProduct - Previous product data
   * @param newProduct - Updated product data
   * @returns Price update notification if price changed
   * Requirement: 5.3
   */
  checkPriceUpdate(
    oldProduct: ProductReference, 
    newProduct: Product
  ): PriceUpdateNotification | null {
    return ProductPriceLogic.checkPriceUpdate(oldProduct, newProduct);
  }
  
  /**
   * Get alternative products when one is out of stock
   * @param product - Out of stock product
   * @param allProducts - All available products
   * @param limit - Maximum alternatives
   * @returns Array of alternative products
   * Requirement: 5.10
   */
  getAlternativeProducts(
    product: ProductReference,
    allProducts: Product[],
    limit: number = 5
  ): Product[] {
    return ProductRecommendationLogic.getAlternatives(product, allProducts, limit);
  }
  
  /**
   * Listen to product rating updates
   * @param productId - Product ID
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  listenToProductRatings(
    productId: string,
    callback: (summary: ProductRatingSummary | null) => void
  ): () => void {
    const summaryRef = ref(database, `productRatingSummaries/${productId}`);
    
    return onValue(summaryRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback(null);
      }
    });
  }
}

// Export singleton instance
export const productIntegrationService = new ProductIntegrationService();

/**
 * Pure functions for product rating logic (testable without Firebase)
 */
export const ProductRatingLogic = {
  /**
   * Validate rating is within valid range (1-5)
   * @param rating - Rating value
   * @returns boolean
   * Requirement: 5.6
   */
  isValidRating(rating: number): boolean {
    return Number.isInteger(rating) && rating >= 1 && rating <= 5;
  },
  
  /**
   * Calculate average rating from array of ratings
   * @param ratings - Array of rating values
   * @returns Average rating (0 if no ratings)
   * Requirement: 5.7
   */
  calculateAverageRating(ratings: number[]): number {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, r) => acc + r, 0);
    return Math.round((sum / ratings.length) * 10) / 10; // Round to 1 decimal
  },
  
  /**
   * Calculate rating distribution (count per star level)
   * @param ratings - Array of rating values
   * @returns Distribution object {1: count, 2: count, ...}
   */
  calculateRatingDistribution(ratings: number[]): Record<number, number> {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    for (const rating of ratings) {
      if (rating >= 1 && rating <= 5) {
        distribution[rating]++;
      }
    }
    
    return distribution;
  },
  
  /**
   * Calculate complete rating summary
   * @param productId - Product ID
   * @param ratings - Array of ProductRating objects
   * @returns ProductRatingSummary
   */
  calculateRatingSummary(productId: string, ratings: ProductRating[]): ProductRatingSummary {
    const ratingValues = ratings.map(r => r.rating);
    
    return {
      productId,
      averageRating: this.calculateAverageRating(ratingValues),
      totalRatings: ratings.length,
      ratingDistribution: this.calculateRatingDistribution(ratingValues)
    };
  },
  
  /**
   * Check if a rating would change the average significantly
   * @param currentAverage - Current average rating
   * @param currentCount - Current number of ratings
   * @param newRating - New rating to add
   * @returns New average after adding rating
   */
  calculateNewAverage(currentAverage: number, currentCount: number, newRating: number): number {
    if (currentCount === 0) return newRating;
    const totalSum = currentAverage * currentCount + newRating;
    return Math.round((totalSum / (currentCount + 1)) * 10) / 10;
  }
};

/**
 * Pure functions for product display logic (testable without Firebase)
 */
export const ProductDisplayLogic = {
  /**
   * Validate product reference has all required display fields
   * @param productRef - ProductReference to validate
   * @returns Validation result
   * Requirement: 5.2
   */
  validateDisplayFields(productRef: ProductReference): {
    hasPrice: boolean;
    hasAvailability: boolean;
    hasRetailer: boolean;
    hasPurchaseLink: boolean;
    isComplete: boolean;
  } {
    const hasPrice = productRef.price !== undefined && productRef.price !== null && productRef.price >= 0;
    const hasRetailer = Boolean(productRef.retailer && productRef.retailer.length > 0);
    const hasAvailability = true; // Availability is implied by presence in database
    const hasPurchaseLink = Boolean(productRef.productId); // Can construct link from ID
    
    return {
      hasPrice,
      hasAvailability,
      hasRetailer,
      hasPurchaseLink,
      isComplete: hasPrice && hasRetailer && hasPurchaseLink
    };
  },
  
  /**
   * Format price for display
   * @param price - Price value
   * @param currency - Currency code (default IQD)
   * @returns Formatted price string
   */
  formatPrice(price: number, currency: string = 'IQD'): string {
    return new Intl.NumberFormat('en-IQ', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(price);
  },
  
  /**
   * Generate purchase link for a product
   * @param productRef - ProductReference
   * @param baseUrl - Base URL for the retailer (optional)
   * @returns Purchase URL
   * Requirement: 5.5
   */
  generatePurchaseLink(productRef: ProductReference, baseUrl?: string): string {
    // In a real implementation, this would construct the actual retailer URL
    // For now, return a placeholder that includes the product ID
    return baseUrl 
      ? `${baseUrl}/product/${productRef.productId}`
      : `/product/${productRef.productId}`;
  },
  
  /**
   * Check if product display is complete (has all required info)
   * @param productRef - ProductReference
   * @returns boolean
   */
  isDisplayComplete(productRef: ProductReference): boolean {
    return this.validateDisplayFields(productRef).isComplete;
  }
};

/**
 * Pure functions for price update logic (testable without Firebase)
 */
export const ProductPriceLogic = {
  /**
   * Check if price has changed and create notification data
   * @param oldProduct - Previous product data
   * @param newProduct - Updated product data
   * @returns PriceUpdateNotification or null
   * Requirement: 5.3
   */
  checkPriceUpdate(
    oldProduct: ProductReference, 
    newProduct: Product
  ): PriceUpdateNotification | null {
    if (oldProduct.price === newProduct.price) {
      return null;
    }
    
    const priceChange = newProduct.price - oldProduct.price;
    const percentageChange = oldProduct.price > 0 
      ? Math.round((priceChange / oldProduct.price) * 100)
      : 0;
    
    return {
      id: `price_${oldProduct.productId}_${Date.now()}`,
      productId: oldProduct.productId,
      productTitle: oldProduct.title,
      oldPrice: oldProduct.price,
      newPrice: newProduct.price,
      priceChange,
      percentageChange,
      createdAt: Date.now(),
      notifiedUsers: []
    };
  },
  
  /**
   * Calculate price change percentage
   * @param oldPrice - Previous price
   * @param newPrice - New price
   * @returns Percentage change (positive = increase, negative = decrease)
   */
  calculatePriceChangePercentage(oldPrice: number, newPrice: number): number {
    if (oldPrice === 0) return 0;
    return Math.round(((newPrice - oldPrice) / oldPrice) * 100);
  },
  
  /**
   * Determine if price change is significant (worth notifying)
   * @param percentageChange - Percentage change
   * @param threshold - Minimum percentage to consider significant (default 5%)
   * @returns boolean
   */
  isSignificantPriceChange(percentageChange: number, threshold: number = 5): boolean {
    return Math.abs(percentageChange) >= threshold;
  }
};

/**
 * Pure functions for product recommendation logic (testable without Firebase)
 */
export const ProductRecommendationLogic = {
  /**
   * Get related products based on category and price range
   * @param product - Base product
   * @param allProducts - All available products
   * @param limit - Maximum recommendations
   * @returns Array of recommended products with scores
   * Requirement: 5.9
   */
  getRelatedProducts(
    product: ProductReference, 
    allProducts: Product[], 
    limit: number = 5
  ): ProductRecommendation[] {
    const recommendations: ProductRecommendation[] = [];
    
    for (const candidate of allProducts) {
      // Skip the same product
      if (candidate.id === product.productId) continue;
      
      let score = 0;
      let reason = '';
      
      // Same category gets highest score
      if (candidate.category === product.category) {
        score += 50;
        reason = 'Same category';
      }
      
      // Similar price range (within 30%)
      const priceDiff = Math.abs(candidate.price - product.price);
      const priceRatio = product.price > 0 ? priceDiff / product.price : 1;
      if (priceRatio <= 0.3) {
        score += 30;
        reason = reason ? `${reason}, similar price` : 'Similar price';
      }
      
      // Same retailer
      if (candidate.retailer === product.retailer) {
        score += 20;
        reason = reason ? `${reason}, same retailer` : 'Same retailer';
      }
      
      if (score > 0) {
        recommendations.push({
          product: {
            productId: candidate.id,
            title: candidate.title,
            imageUrl: candidate.imageUrl || '',
            price: candidate.price,
            retailer: candidate.retailer,
            category: candidate.category || 'Other'
          },
          score,
          reason
        });
      }
    }
    
    // Sort by score and return top results
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
  
  /**
   * Get alternative products when one is out of stock
   * @param product - Out of stock product
   * @param allProducts - All available products
   * @param limit - Maximum alternatives
   * @returns Array of alternative products
   * Requirement: 5.10
   */
  getAlternatives(
    product: ProductReference,
    allProducts: Product[],
    limit: number = 5
  ): Product[] {
    return allProducts
      .filter(p => 
        p.id !== product.productId &&
        p.category === product.category &&
        p.inStock !== false // Only in-stock products
      )
      .sort((a, b) => {
        // Sort by price similarity
        const aDiff = Math.abs(a.price - product.price);
        const bDiff = Math.abs(b.price - product.price);
        return aDiff - bDiff;
      })
      .slice(0, limit);
  },
  
  /**
   * Calculate recommendation score for a product
   * @param baseProduct - Product to compare against
   * @param candidate - Candidate product
   * @returns Score (0-100)
   */
  calculateRecommendationScore(baseProduct: ProductReference, candidate: Product): number {
    let score = 0;
    
    // Category match (50 points)
    if (candidate.category === baseProduct.category) {
      score += 50;
    }
    
    // Price similarity (30 points max)
    const priceDiff = Math.abs(candidate.price - baseProduct.price);
    const priceRatio = baseProduct.price > 0 ? priceDiff / baseProduct.price : 1;
    if (priceRatio <= 0.1) score += 30;
    else if (priceRatio <= 0.2) score += 20;
    else if (priceRatio <= 0.3) score += 10;
    
    // Same retailer (20 points)
    if (candidate.retailer === baseProduct.retailer) {
      score += 20;
    }
    
    return score;
  }
};
