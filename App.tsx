
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ProductCard } from './components/ProductCard';
import { FavoritesPanel } from './components/FavoritesPanel';
import { PCBuilder } from './components/PCBuilder';

import { CategoryNav } from './components/CategoryNav';
import { loadProductsFromFile } from './services/dataService';
import { Product, SortOption } from './types';
import { AlertTriangle, Ghost, Loader2, Sparkles } from 'lucide-react';

const PAGE_SIZE = 24;

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('best-selling');
  const [selectedRetailer, setSelectedRetailer] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [showOnDiscountOnly, setShowOnDiscountOnly] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Favorites State
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load favorites", e);
      return [];
    }
  });
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  
  // PC Builder State
  const [isPCBuilderOpen, setIsPCBuilderOpen] = useState(false);

  const observerTarget = useRef(null);

  // Theme toggle effect
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-theme');
      document.documentElement.classList.add('dark');
    } else {
      document.body.classList.add('light-theme');
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nexus_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error("Failed to save favorites", e);
    }
  }, [favorites]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  }, []);

  const removeFavorite = useCallback((productId: string) => {
    setFavorites(prev => prev.filter(id => id !== productId));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await loadProductsFromFile();
      setAllProducts(results);
      setVisibleCount(PAGE_SIZE);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load products from JSON file.");
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const smartSearch = useCallback((searchQuery: string, productText: string): boolean => {
    if (!searchQuery.trim()) return true;

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const normalizedProduct = productText.toLowerCase();

    // Method 1: Exact phrase matching
    if (normalizedProduct.includes(normalizedQuery)) return true;

    // Method 2: Smart space-insensitive matching (for model numbers like "7800 XT" vs "7800XT")
    const smartNoSpaces = (text: string) => {
      // Only remove spaces in specific patterns like "7800 XT", "RTX 4060", not random numbers
      return text.replace(/(\w+)\s+(xt|ti|super|pro|max|plus)(\b|$)/gi, '$1$2$3')
        .replace(/(rtx|gtx|rx)\s+(\d+)/gi, '$1$2');
    };

    const smartQuery = smartNoSpaces(normalizedQuery);
    const smartProduct = smartNoSpaces(normalizedProduct);
    if (smartProduct.includes(smartQuery)) return true;

    // Method 3: Word boundary matching for single tokens
    const queryTokens = normalizedQuery.split(/\s+/).filter(token => token.length > 0);
    if (queryTokens.length === 1) {
      const token = queryTokens[0];
      // Check if token exists as a complete word or alphanumeric sequence
      const wordBoundaryRegex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordBoundaryRegex.test(normalizedProduct)) return true;

      // Also check for alphanumeric sequences
      const alphanumericRegex = new RegExp(`(^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
      if (alphanumericRegex.test(normalizedProduct)) return true;
    }

    // Method 4: Multiple token matching - all tokens must be found
    return queryTokens.every(token => normalizedProduct.includes(token));
  }, []);

  // Calculate search relevance score for better sorting
  const calculateRelevanceScore = useCallback((product: any, searchQuery: string): number => {
    if (!searchQuery.trim()) return 0;

    const normalizedQuery = searchQuery.toLowerCase().trim();
    const normalizedTitle = product.title.toLowerCase();
    let score = 0;

    // Higher score for exact phrase match
    if (normalizedTitle.includes(normalizedQuery)) {
      score += 100;
    }

    // Higher score for exact token matches (whole words)
    const queryTokens = normalizedQuery.split(/\s+/).filter(token => token.length > 0);
    queryTokens.forEach(token => {
      // Check for whole word matches (word boundaries)
      const wordRegex = new RegExp(`\\b${token}\\b`, 'i');
      if (wordRegex.test(product.title)) {
        score += 50; // Higher score for exact word match
      } else if (normalizedTitle.includes(token)) {
        score += 10; // Lower score for partial match
      }
    });

    // Bonus for having all search terms close together
    const titleWords = normalizedTitle.split(/\s+/);
    let allTokensFoundClose = true;
    let minDistance = Infinity;

    for (let i = 0; i < titleWords.length; i++) {
      if (queryTokens.every(token => {
        for (let j = i; j < Math.min(i + queryTokens.length + 2, titleWords.length); j++) {
          if (titleWords[j].includes(token)) return true;
        }
        return false;
      })) {
        allTokensFoundClose = true;
        minDistance = Math.min(minDistance, queryTokens.length);
        break;
      }
    }

    if (allTokensFoundClose && minDistance < 3) {
      score += 25; // Bonus for tokens being close together
    }

    return score;
  }, []);

  const retailers = useMemo(() => {
    const counts: Record<string, number> = {};
    let baseList = allProducts;
    if (query.trim()) {
      baseList = baseList.filter(p => {
        const productText = `${p.title} ${p.retailer}`;
        return smartSearch(query, productText);
      });
    }
    if (selectedCategory !== null) {
      baseList = baseList.filter(p => p.category === selectedCategory);
    }
    baseList.forEach(p => {
      counts[p.retailer] = (counts[p.retailer] || 0) + 1;
    });
    const list = Object.keys(counts).map(name => ({ name, count: counts[name] }));
    list.unshift({ name: 'All', count: baseList.length });
    return list;
  }, [allProducts, query, smartSearch, selectedCategory]);

  const processedProducts = useMemo(() => {
    let result = allProducts;
    if (query.trim()) {
      result = result.filter(p => {
        const productText = `${p.title} ${p.retailer}`;
        return smartSearch(query, productText);
      });
    }
    if (selectedRetailer !== 'All') {
      result = result.filter(p => p.retailer === selectedRetailer);
    }
    if (selectedCategory !== null) {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (!showOutOfStock) {
      result = result.filter(p => p.inStock !== false && p.price > 0);
    }
    if (showOnDiscountOnly) {
      result = result.filter(p => p.compareAtPrice && p.compareAtPrice > p.price);
    }
    const sorted = [...result];
    if (sortOption === 'price-asc') {
      // Pure price sorting - low to high
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price-desc') {
      // Pure price sorting - high to low
      sorted.sort((a, b) => b.price - a.price);
    } else if (!sortOption || sortOption === 'relevance') {
      // Only use relevance scoring when no specific sort is chosen or relevance is explicitly selected
      if (query.trim()) {
        sorted.sort((a, b) => {
          const scoreA = calculateRelevanceScore(a, query);
          const scoreB = calculateRelevanceScore(b, query);
          if (scoreA !== scoreB) {
            return scoreB - scoreA; // Higher relevance first
          }
          // If same relevance, sort by price as secondary
          return a.price - b.price;
        });
      }
    }
    return sorted;
  }, [allProducts, query, sortOption, selectedRetailer, selectedCategory, showOutOfStock, showOnDiscountOnly, smartSearch, calculateRelevanceScore]);

  const productCounts = useMemo(() => {
    const counts: { [category: string]: number } = {};
    allProducts.forEach(p => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [allProducts]);

  // Get full product objects for favorites
  const favoriteProducts = useMemo(() => {
    return allProducts.filter(p => favorites.includes(p.id));
  }, [allProducts, favorites]);

  const displayedProducts = processedProducts.slice(0, visibleCount);
  const hasMore = visibleCount < processedProducts.length;

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    setVisibleCount(PAGE_SIZE);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [hasMore, loading]);

  return (
    <div className="min-h-screen bg-nexus-950 text-gray-100 flex flex-col font-sans selection:bg-nexus-accent selection:text-nexus-950 relative overflow-x-hidden">

      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-nexus-accent/5 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-nexus-secondary/5 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px] animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-grid-pattern opacity-40"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          onSearch={handleSearch}
          isLoading={loading}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
          favoritesCount={favorites.length}
          onOpenFavorites={() => setIsFavoritesOpen(true)}
          onOpenPCBuilder={() => setIsPCBuilderOpen(true)}
        />

        <FavoritesPanel
          isOpen={isFavoritesOpen}
          onClose={() => setIsFavoritesOpen(false)}
          favorites={favoriteProducts}
          onRemoveFavorite={removeFavorite}
        />

        <main className="flex-grow max-w-8xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Category Navigation */}
          <CategoryNav
            selectedCategory={selectedCategory}
            onCategorySelect={(category) => { setSelectedCategory(category); setVisibleCount(PAGE_SIZE); }}
            productCounts={productCounts}
          />

          <div className="flex flex-col lg:flex-row gap-8">

            {/* Sidebar Desktop */}
            <div className="hidden lg:block">
              <Sidebar
                sortOption={sortOption}
                onSortChange={setSortOption}
                resultCount={processedProducts.length}
                retailers={retailers}
                selectedRetailer={selectedRetailer}
                onRetailerChange={(r) => { setSelectedRetailer(r); setVisibleCount(PAGE_SIZE); }}
                showOutOfStock={showOutOfStock}
                onToggleOutOfStock={() => setShowOutOfStock(!showOutOfStock)}
                showOnDiscountOnly={showOnDiscountOnly}
                onToggleDiscountOnly={() => setShowOnDiscountOnly(!showOnDiscountOnly)}
              />
            </div>

            {/* Mobile Filter */}
            <div className="lg:hidden flex flex-col gap-3 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 mb-4 animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-gray-200 text-sm">{processedProducts.length} Items</span>
                <div className="flex gap-2 w-full justify-end">
                  <select
                    className="bg-black/40 border border-white/10 text-white text-sm rounded-lg focus:ring-nexus-accent focus:border-nexus-accent block p-2.5 max-w-[130px]"
                    value={selectedRetailer}
                    onChange={(e) => { setSelectedRetailer(e.target.value); setVisibleCount(PAGE_SIZE); }}
                  >
                    {retailers.map(r => (
                      <option key={r.name} value={r.name}>{r.name} ({r.count})</option>
                    ))}
                  </select>
                  <select
                    className="bg-black/40 border border-white/10 text-white text-sm rounded-lg focus:ring-nexus-accent focus:border-nexus-accent block w-40 p-2.5"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                  >
                    <option value="best-selling">Best Selling</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">

              {/* Header */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {query ? (
                    <>
                      <Sparkles className="text-nexus-accent hidden sm:block" size={18} />
                      <span>Results for <span className="text-transparent bg-clip-text bg-gradient-to-r from-nexus-accent to-white">"{query}"</span></span>
                    </>
                  ) : (
                    "Featured Components"
                  )}
                </h2>
                {query && (
                  <button
                    onClick={() => handleSearch('')}
                    className="text-xs font-medium text-gray-400 hover:text-white transition-colors self-start sm:self-auto border-b border-gray-600 hover:border-white pb-0.5"
                  >
                    Clear Search
                  </button>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-2xl p-6 flex items-start gap-4 text-red-200 mb-8 animate-slide-up shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                  <div className="bg-red-500/20 p-2 rounded-full">
                    <AlertTriangle size={24} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-400 text-lg">System Error</h3>
                    <p className="text-sm opacity-80 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Skeletons */}
              {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="bg-white/5 rounded-xl h-[340px] animate-pulse border border-white/5"></div>
                  ))}
                </div>
              )}

              {/* Grid */}
              {!loading && !error && displayedProducts.length > 0 && (
                <div className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4 animate-slide-up">
                    {displayedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        isFavorite={favorites.includes(product.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div ref={observerTarget} className="flex flex-col items-center justify-center py-8 gap-2">
                      <Loader2 className="w-6 h-6 text-nexus-accent animate-spin" />
                      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Loading more...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && displayedProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 px-4">
                  <div className="bg-white/5 p-6 rounded-full mb-6 relative">
                    <div className="absolute inset-0 bg-nexus-accent/20 rounded-full blur-xl animate-pulse"></div>
                    <Ghost size={48} className="text-gray-400 relative z-10" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 text-center">No Signals Detected</h3>
                  <p className="text-gray-400 text-center max-w-md text-sm">
                    We scanned the database but couldn't find matches. Try adjusting your search terms.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-white/5 mt-auto py-6 text-center bg-black/20 backdrop-blur-lg">
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} <span className="text-gray-300 font-semibold">NexusPC</span>. All rights reserved.
          </p>
        </footer>
      </div>

      {/* PC Builder Modal */}
      {isPCBuilderOpen && (
        <PCBuilder
          products={allProducts}
          onClose={() => setIsPCBuilderOpen(false)}
        />
      )}

      {/* Vercel Speed Insights */}
      <SpeedInsights />
      
      {/* Vercel Web Analytics */}
      <Analytics />
    </div>
  );
};

export default App;
