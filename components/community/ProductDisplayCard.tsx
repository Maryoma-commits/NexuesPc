// ProductDisplayCard Component for NexusPC Community Posts
// Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
import React, { useState, useEffect } from 'react';
import { 
  Star, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  ShoppingCart
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  productIntegrationService,
  ProductRatingSummary,
  ProductDisplayLogic
} from '../../services/productIntegrationService';
import { ProductReference } from '../../types/community-posts';

interface ProductDisplayCardProps {
  product: ProductReference;
  showRating?: boolean;
  showPriceChange?: boolean;
  previousPrice?: number;
  onProductClick?: (product: ProductReference) => void;
  onRatingChange?: (productId: string, rating: number) => void;
  compact?: boolean;
}

export default function ProductDisplayCard({
  product,
  showRating = true,
  showPriceChange = false,
  previousPrice,
  onProductClick,
  onRatingChange,
  compact = false
}: ProductDisplayCardProps) {
  const { userProfile } = useAuth();
  const [ratingSummary, setRatingSummary] = useState<ProductRatingSummary | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isRating, setIsRating] = useState(false);

  // Validate product display fields
  const validation = ProductDisplayLogic.validateDisplayFields(product);

  // Load rating data
  useEffect(() => {
    if (!showRating) return;

    const unsubscribe = productIntegrationService.listenToProductRatings(
      product.productId,
      (summary) => setRatingSummary(summary)
    );

    return () => unsubscribe();
  }, [product.productId, showRating]);

  // Load user's rating
  useEffect(() => {
    if (!showRating || !userProfile?.uid) return;

    const loadUserRating = async () => {
      const rating = await productIntegrationService.getUserRating(
        product.productId,
        userProfile.uid
      );
      setUserRating(rating);
    };

    loadUserRating();
  }, [product.productId, userProfile?.uid, showRating]);

  // Handle rating click
  const handleRating = async (rating: number) => {
    if (!userProfile?.uid || isRating) return;

    setIsRating(true);
    try {
      await productIntegrationService.rateProduct(
        product.productId,
        userProfile.uid,
        rating
      );
      setUserRating(rating);
      onRatingChange?.(product.productId, rating);
    } catch (error) {
      console.error('Failed to rate product:', error);
    } finally {
      setIsRating(false);
    }
  };

  // Format price
  const formatPrice = (price: number) => {
    return ProductDisplayLogic.formatPrice(price);
  };

  // Calculate price change
  const priceChange = previousPrice ? product.price - previousPrice : 0;
  const priceChangePercent = previousPrice && previousPrice > 0
    ? Math.round((priceChange / previousPrice) * 100)
    : 0;

  // Generate purchase link
  const purchaseLink = ProductDisplayLogic.generatePurchaseLink(product);

  // Render star rating
  const renderStars = (rating: number, interactive: boolean = false) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = interactive 
            ? (hoverRating || userRating || 0) >= star
            : rating >= star;
          const halfFilled = !filled && rating >= star - 0.5;

          return (
            <button
              key={star}
              type="button"
              disabled={!interactive || isRating || !userProfile}
              onClick={() => interactive && handleRating(star)}
              onMouseEnter={() => interactive && setHoverRating(star)}
              onMouseLeave={() => interactive && setHoverRating(null)}
              className={`${interactive && userProfile ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
            >
              <Star
                size={interactive ? 20 : 14}
                className={`${
                  filled 
                    ? 'text-yellow-400 fill-yellow-400' 
                    : halfFilled
                      ? 'text-yellow-400 fill-yellow-400/50'
                      : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          );
        })}
      </div>
    );
  };

  if (compact) {
    return (
      <button
        onClick={() => onProductClick?.(product)}
        className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600 text-left"
      >
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-10 h-10 object-contain rounded bg-white flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {product.title}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {formatPrice(product.price)}
            </p>
            {ratingSummary && ratingSummary.totalRatings > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span>{ratingSummary.averageRating}</span>
              </div>
            )}
          </div>
        </div>
        <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Product Image */}
      <div 
        className="relative aspect-square bg-gray-100 dark:bg-gray-700 cursor-pointer"
        onClick={() => onProductClick?.(product)}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ShoppingCart size={48} />
          </div>
        )}

        {/* Price change badge */}
        {showPriceChange && priceChange !== 0 && (
          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
            priceChange < 0 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {priceChange < 0 ? (
              <TrendingDown size={12} />
            ) : (
              <TrendingUp size={12} />
            )}
            <span>{Math.abs(priceChangePercent)}%</span>
          </div>
        )}

        {/* Validation warning */}
        {!validation.isComplete && (
          <div className="absolute top-2 left-2 p-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3">
        {/* Title */}
        <h4 
          className="font-medium text-gray-900 dark:text-white line-clamp-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
          onClick={() => onProductClick?.(product)}
        >
          {product.title}
        </h4>

        {/* Category & Retailer */}
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{product.category}</span>
          <span>•</span>
          <span>{product.retailer}</span>
        </div>

        {/* Price */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatPrice(product.price)}
          </span>
          {showPriceChange && previousPrice && previousPrice !== product.price && (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(previousPrice)}
            </span>
          )}
        </div>

        {/* Rating Section */}
        {showRating && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            {/* Community Rating */}
            {ratingSummary && ratingSummary.totalRatings > 0 ? (
              <div className="flex items-center gap-2 mb-2">
                {renderStars(ratingSummary.averageRating)}
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {ratingSummary.averageRating} ({ratingSummary.totalRatings} {ratingSummary.totalRatings === 1 ? 'rating' : 'ratings'})
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                No ratings yet
              </p>
            )}

            {/* User Rating */}
            {userProfile && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Your rating:
                </span>
                {renderStars(userRating || 0, true)}
              </div>
            )}
          </div>
        )}

        {/* Purchase Button */}
        <a
          href={purchaseLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <ShoppingCart size={16} />
          <span>View at {product.retailer}</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
