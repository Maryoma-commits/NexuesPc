import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Filter, Bookmark, TrendingUp, Hash } from 'lucide-react';
import { searchService, SearchResult, AutocompleteResult } from '../../services/searchService';
import { SearchFilters, Post, TrendingTopic, SavedSearch } from '../../types/community-posts';
import { SearchResultItem } from './SearchResultItem';
import PostDetailModal from './PostDetailModal';
import { useAuth } from '../../contexts/AuthContext';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, initialQuery = '' }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [autocomplete, setAutocomplete] = useState<AutocompleteResult | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'product' | 'media' | 'general'>('all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Set initial query when modal opens and trigger search
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
      loadSavedSearches();
      setSelectedPostId(null); // Reset selected post when modal opens
      
      // Set query from initialQuery if provided
      if (initialQuery) {
        setQuery(initialQuery);
      } else {
        loadAutocomplete();
      }
    } else {
      // Reset state when modal closes
      setSearchResults(null);
      setShowAutocomplete(false);
      setSelectedPostId(null);
    }
  }, [isOpen, initialQuery]);

  // Perform search when query changes
  useEffect(() => {
    if (!isOpen) return;
    
    if (query.length > 0) {
      const debounceTimer = setTimeout(() => {
        performSearch();
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setSearchResults(null);
      loadAutocomplete();
    }
  }, [query, filters, isOpen]);

  const loadSavedSearches = async () => {
    if (!user) return;
    try {
      const searches = await searchService.getSavedSearches(user.uid);
      setSavedSearches(searches);
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  };

  const loadAutocomplete = async () => {
    try {
      const result = await searchService.getAutocompleteSuggestions(query);
      setAutocomplete(result);
    } catch (error) {
      console.error('Failed to load autocomplete:', error);
    }
  };

  const performSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await searchService.searchPosts(query, filters, user?.uid);
      setSearchResults(result);
      setShowAutocomplete(false);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!user || !query.trim()) return;
    
    try {
      await searchService.saveSearch(user.uid, query, filters, true);
      await loadSavedSearches();
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  const handleLoadSavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query);
    setFilters(savedSearch.filters || {});
    setShowAutocomplete(false);
  };

  const handleDeleteSavedSearch = async (searchId: string) => {
    if (!user) return;
    
    try {
      await searchService.deleteSavedSearch(user.uid, searchId);
      await loadSavedSearches();
    } catch (error) {
      console.error('Failed to delete saved search:', error);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowAutocomplete(false);
  };

  const handleHashtagClick = (hashtag: string) => {
    setQuery(hashtag);
    setShowAutocomplete(false);
  };

  const getDisplayedPosts = (): Post[] => {
    if (!searchResults) return [];
    
    switch (selectedTab) {
      case 'product':
        return searchResults.groupedResults.product;
      case 'media':
        return searchResults.groupedResults.media;
      case 'general':
        return searchResults.groupedResults.general;
      default:
        return searchResults.posts;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Search Posts</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowAutocomplete(true)}
              placeholder="Search posts, products, hashtags..."
              className="w-full pl-10 pr-20 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
              {user && query.trim() && (
                <button
                  onClick={handleSaveSearch}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-500"
                  title="Save Search"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {showAutocomplete && (query.length === 0 || autocomplete) && (
            <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {query.length === 0 && savedSearches.length > 0 && (
                <div className="p-3 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Saved Searches</h3>
                  {savedSearches.slice(0, 5).map((savedSearch) => (
                    <div key={savedSearch.id} className="flex items-center justify-between py-1">
                      <button
                        onClick={() => handleLoadSavedSearch(savedSearch)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {savedSearch.query}
                      </button>
                      <button
                        onClick={() => handleDeleteSavedSearch(savedSearch.id)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {autocomplete?.suggestions && autocomplete.suggestions.length > 0 && (
                <div className="p-3 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suggestions</h3>
                  {autocomplete.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="block w-full text-left px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {autocomplete?.trending && autocomplete.trending.length > 0 && (
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Trending
                  </h3>
                  {autocomplete.trending.map((topic, index) => (
                    <button
                      key={index}
                      onClick={() => handleHashtagClick(topic.hashtag)}
                      className="block w-full text-left px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded flex items-center"
                    >
                      <Hash className="w-3 h-3 mr-1" />
                      {topic.hashtag} ({topic.postCount})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Time Range
                </label>
                <select
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'all') {
                      const { dateRange, ...newFilters } = filters;
                      setFilters(newFilters);
                    } else {
                      const now = Date.now();
                      let start = 0;
                      switch (value) {
                        case 'day':
                          start = now - (24 * 60 * 60 * 1000);
                          break;
                        case 'week':
                          start = now - (7 * 24 * 60 * 60 * 1000);
                          break;
                        case 'month':
                          start = now - (30 * 24 * 60 * 60 * 1000);
                          break;
                      }
                      setFilters({ ...filters, dateRange: { start, end: now } });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Time</option>
                  <option value="day">Last 24 Hours</option>
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({})}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search Results List */}
          {searchResults && (
            <>
              {/* Result Tabs */}
              <div className="flex items-center space-x-4 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedTab('all')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedTab === 'all'
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  All ({searchResults.totalCount})
                </button>
                {searchResults.groupedResults.product.length > 0 && (
                  <button
                    onClick={() => setSelectedTab('product')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedTab === 'product'
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    Products ({searchResults.groupedResults.product.length})
                  </button>
                )}
                {searchResults.groupedResults.media.length > 0 && (
                  <button
                    onClick={() => setSelectedTab('media')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedTab === 'media'
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    Media ({searchResults.groupedResults.media.length})
                  </button>
                )}
                {searchResults.groupedResults.general.length > 0 && (
                  <button
                    onClick={() => setSelectedTab('general')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedTab === 'general'
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    General ({searchResults.groupedResults.general.length})
                  </button>
                )}
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getDisplayedPosts().map((post) => (
                      <SearchResultItem
                        key={post.id}
                        post={post}
                        onClick={(p) => setSelectedPostId(p.id)}
                        searchQuery={query}
                      />
                    ))}
                    {getDisplayedPosts().length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No posts found matching your search.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {!searchResults && !isLoading && query.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start typing to search posts, products, and hashtags</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post Detail Modal */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </div>
  );
};