import React from 'react';
import { X, Heart, ShoppingCart, ExternalLink } from 'lucide-react';
import type { Product } from '../types';
import { formatPrice } from '../services/priceUtils';

interface FavoritesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: Product[];
  onRemoveFavorite: (productId: string) => void;
}

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({
  isOpen,
  onClose,
  favorites,
  onRemoveFavorite
}) => {
  // Calculate total price
  const totalPrice = favorites.reduce((sum, product) => sum + (product.price || 0), 0);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 dark:bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`fixed right-0 top-0 h-full w-full sm:w-[450px] bg-white dark:bg-nexus-950/95 backdrop-blur-xl border-l border-gray-200 dark:border-white/10 z-[70] shadow-2xl transform transition-all duration-300 ease-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Heart className="w-5 h-5 text-red-400 fill-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Favorites</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">{favorites.length} items saved</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close favorites"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Total Price Bar & Clear Button */}
          {favorites.length > 0 && (
            <div className="px-6 pb-4 space-y-3">
              <div className="bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-600/20 dark:to-cyan-600/20 border border-blue-300 dark:border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Price</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
              </div>

              {/* Clear All Button */}
              <button
                onClick={() => {
                  favorites.forEach(product => onRemoveFavorite(product.id));
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-all duration-200 text-sm font-medium"
              >
                <X className="w-4 h-4" />
                <span>Clear All Favorites</span>
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{height: 'calc(100vh - 200px)'}}>
          {favorites.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Heart className="w-10 h-10 text-gray-400 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No favorites yet</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xs">
                Start adding products to your favorites by clicking the heart icon on any product card
              </p>
            </div>
          ) : (
            // Favorites List
            <div className="p-4 space-y-3">
              {favorites.map((product) => (
                <div
                  key={product.id}
                  className="bg-gray-50 dark:bg-nexus-900/50 border border-gray-200 dark:border-white/5 rounded-xl p-4 hover:border-gray-300 dark:hover:border-white/10 transition-all group"
                >
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="flex-shrink-0 w-20 h-20 bg-white dark:bg-white rounded-lg overflow-hidden border border-gray-200 dark:border-transparent">
                      <img
                        src={typeof product.image === 'object' && product.image !== null ? (product.image as any).src : product.image}
                        alt={product.title}
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23f0f0f0" width="80" height="80"/%3E%3C/svg%3E';
                        }}
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {product.title}
                      </h3>
                      
                      {/* Price */}
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatPrice(product.price)}
                        </span>
                        {product.old_price && product.old_price > product.price && (
                          <>
                            <span className="text-xs text-gray-500 dark:text-gray-500 line-through">
                              {formatPrice(product.old_price)}
                            </span>
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
                              {product.discount}% OFF
                            </span>
                          </>
                        )}
                      </div>

                      {/* Store Badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-white/5 rounded text-gray-700 dark:text-gray-400">
                          {product.store}
                        </span>
                        {product.in_stock ? (
                          <span className="text-xs px-2 py-1 bg-green-500/20 rounded text-green-600 dark:text-green-400">
                            In Stock
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-red-500/20 rounded text-red-600 dark:text-red-400">
                            Out of Stock
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        
                        <button
                          onClick={() => onRemoveFavorite(product.id)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                          aria-label="Remove from favorites"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};