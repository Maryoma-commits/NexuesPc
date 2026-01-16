// ProductSearchModal Component for NexusPC Community Posts
// Requirements: 5.1, 5.2
import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Search, 
  Loader2,
  Tag,
  Check,
  Star
} from 'lucide-react';
import { loadProductsFromFile } from '../../services/dataService';
import { 
  productIntegrationService,
  ProductDisplayLogic
} from '../../services/productIntegrationService';
import { ProductReference } from '../../types/community-posts';
import { Product } from '../../types';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: ProductReference) => void;
  selectedProducts?: ProductReference[];
  maxProducts?: number;
}

export default function ProductSearchModal({
  isOpen,
  onClose,
  onSelectProduct,
  selectedProducts = [],
  maxProducts = 10
}: ProductSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Load all products on mount
  useEffect(() => {
    const loadProducts = async () => {
      setIsInitialLoading(true);
      try {
        const products = await loadProductsFromFile();
        setAllProducts(products);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  // Search products
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setIsLoading(true);

    // Debounce search
    const timeoutId = setTimeout(() => {
      let results = productIntegrationService.searchProducts(allProducts, query, 20);
      
      // Apply category filter
      if (selectedCategory) {
        results = results.filter(p => p.category === selectedCategory);
      }

      setSearchResults(results);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [allProducts, selectedCategory]);

  // Get unique categories
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();

  // Check if product is already selected
  const isProductSelected = (productId: string) => {
    return selectedProducts.some(p => p.productId === productId);
  };

  // Handle product selection
  const handleSelectProduct = (product: Product) => {
    if (isProductSelected(product.id)) {
      return; // Already selected
    }

    if (selectedProducts.length >= maxProducts) {
      return; // Max products reached
    }

    const productRef = productIntegrationService.productToReference(product);
    onSelectProduct(productRef);
  };

  // Format price
  const formatPrice = (price: number) => {
    return ProductDisplayLogic.formatPrice(price);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tag Products
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search products by name, category, or retailer..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Category Filter */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedCategory(null);
                handleSearch(searchQuery);
              }}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {categories.slice(0, 8).map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category === selectedCategory ? null : category || null);
                  handleSearch(searchQuery);
                }}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Products Count */}
        {selectedProducts.length > 0 && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
            {selectedProducts.length} of {maxProducts} products selected
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {isInitialLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : searchQuery.length < 2 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Search size={48} className="mx-auto mb-4 opacity-50" />
              <p>Type at least 2 characters to search</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No products found for "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((product) => {
                const isSelected = isProductSelected(product.id);
                const canSelect = !isSelected && selectedProducts.length < maxProducts;

                return (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    disabled={!canSelect}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : canSelect
                          ? 'hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                          : 'opacity-50 cursor-not-allowed border-2 border-transparent'
                    }`}
                  >
                    {/* Product Image */}
                    <div className="w-16 h-16 bg-white rounded-lg flex-shrink-0 overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Tag size={24} />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {product.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{product.category || 'Other'}</span>
                        <span>•</span>
                        <span>{product.retailer}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {formatPrice(product.price)}
                        </span>
                        {product.rating && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Star size={12} className="text-yellow-400 fill-yellow-400" />
                            <span>{product.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'border-2 border-gray-300 dark:border-gray-600'
                    }`}>
                      {isSelected && <Check size={14} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
