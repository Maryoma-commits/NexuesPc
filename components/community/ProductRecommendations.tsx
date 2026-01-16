// ProductRecommendations Component for NexusPC Community Posts
// Requirements: 5.9, 5.10
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  AlertTriangle,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { 
  productIntegrationService,
  ProductRecommendation
} from '../../services/productIntegrationService';
import { ProductReference } from '../../types/community-posts';
import { Product } from '../../types';
import { loadProductsFromFile } from '../../services/dataService';
import ProductDisplayCard from './ProductDisplayCard';

interface ProductRecommendationsProps {
  product: ProductReference;
  type: 'related' | 'alternatives';
  title?: string;
  limit?: number;
  onProductClick?: (product: ProductReference) => void;
}

export default function ProductRecommendations({
  product,
  type,
  title,
  limit = 4,
  onProductClick
}: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [alternatives, setAlternatives] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecommendations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const allProducts = await loadProductsFromFile();

        if (type === 'related') {
          const related = productIntegrationService.getRelatedProducts(
            product,
            allProducts,
            limit
          );
          setRecommendations(related);
        } else {
          const alts = productIntegrationService.getAlternativeProducts(
            product,
            allProducts,
            limit
          );
          setAlternatives(alts);
        }
      } catch (err) {
        setError('Failed to load recommendations');
        console.error('Error loading recommendations:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [product.productId, type, limit]);

  const defaultTitle = type === 'related' 
    ? 'Related Products' 
    : 'Alternative Products';

  const displayTitle = title || defaultTitle;

  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-blue-500" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {displayTitle}
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  const items = type === 'related' ? recommendations : alternatives;

  if (items.length === 0) {
    return null; // Don't show section if no recommendations
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {type === 'alternatives' ? (
            <AlertTriangle size={18} className="text-yellow-500" />
          ) : (
            <Sparkles size={18} className="text-blue-500" />
          )}
          <h3 className="font-medium text-gray-900 dark:text-white">
            {displayTitle}
          </h3>
        </div>
        {items.length > 4 && (
          <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            View all
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {type === 'related' ? (
          recommendations.slice(0, limit).map((rec) => (
            <div key={rec.product.productId} className="relative">
              <ProductDisplayCard
                product={rec.product}
                compact
                showRating={false}
                onProductClick={onProductClick}
              />
              {/* Recommendation reason badge */}
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                {rec.reason}
              </div>
            </div>
          ))
        ) : (
          alternatives.slice(0, limit).map((alt) => (
            <ProductDisplayCard
              key={alt.id}
              product={{
                productId: alt.id,
                title: alt.title,
                imageUrl: alt.imageUrl || '',
                price: alt.price,
                retailer: alt.retailer,
                category: alt.category || 'Other'
              }}
              compact
              showRating={false}
              onProductClick={onProductClick}
            />
          ))
        )}
      </div>

      {/* Out of stock notice for alternatives */}
      {type === 'alternatives' && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          The original product may be out of stock. Here are some similar alternatives.
        </p>
      )}
    </div>
  );
}
