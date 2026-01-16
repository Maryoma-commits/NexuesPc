import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { searchService, AutocompleteResult } from '../../services/searchService';
import { SearchModal } from './SearchModal';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  onSearchFocus?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  className = '', 
  placeholder = "Search posts, products, hashtags...",
  onSearchFocus
}) => {
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autocomplete, setAutocomplete] = useState<AutocompleteResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length > 0) {
      const debounceTimer = setTimeout(async () => {
        try {
          const result = await searchService.getAutocompleteSuggestions(query, 5);
          setAutocomplete(result);
        } catch (error) {
          console.error('Failed to load autocomplete:', error);
        }
      }, 200);
      return () => clearTimeout(debounceTimer);
    } else {
      setAutocomplete(null);
    }
  }, [query]);

  const handleInputFocus = () => {
    setShowSuggestions(true);
    onSearchFocus?.();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowModal(true);
      setShowSuggestions(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2.5 border border-white/10 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-nexus-800 text-gray-100 placeholder-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </form>

        {/* Quick Suggestions Dropdown */}
        {showSuggestions && (query.length > 0 || autocomplete?.trending) && (
          <div 
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-nexus-800 border border-white/10 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
          >
            {autocomplete?.suggestions && autocomplete.suggestions.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-medium text-gray-400 mb-2 px-2">
                  Suggestions
                </div>
                {autocomplete.suggestions.slice(0, 3).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-nexus-700 rounded transition-colors"
                  >
                    <Search className="w-4 h-4 inline mr-2 text-gray-400" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {query.length === 0 && autocomplete?.trending && autocomplete.trending.length > 0 && (
              <div className="p-2 border-t border-white/10">
                <div className="text-xs font-medium text-gray-400 mb-2 px-2">
                  Trending
                </div>
                {autocomplete.trending.slice(0, 3).map((topic, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(topic.hashtag)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-nexus-700 rounded transition-colors flex items-center justify-between"
                  >
                    <span className="text-blue-400">
                      {topic.hashtag}
                    </span>
                    <span className="text-xs text-gray-500">
                      {topic.postCount}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {query.trim() && (
              <div className="p-2 border-t border-white/10">
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-nexus-700 rounded transition-colors font-medium"
                >
                  Search for "{query}"
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Search Modal */}
      <SearchModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialQuery={query}
      />
    </>
  );
};