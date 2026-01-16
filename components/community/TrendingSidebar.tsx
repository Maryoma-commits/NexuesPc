import React, { useState, useEffect } from 'react';
import { TrendingUp, Hash, Search, Bookmark, Clock } from 'lucide-react';
import { searchService } from '../../services/searchService';
import { TrendingTopic, SavedSearch } from '../../types/community-posts';
import { useAuth } from '../../contexts/AuthContext';

interface TrendingSidebarProps {
  onHashtagClick?: (hashtag: string) => void;
  onSearchClick?: (query: string) => void;
  className?: string;
}

export const TrendingSidebar: React.FC<TrendingSidebarProps> = ({
  onHashtagClick,
  onSearchClick,
  className = ''
}) => {
  const { user } = useAuth();
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrendingTopics();
    if (user) {
      loadSavedSearches();
    }
  }, [user]);

  const loadTrendingTopics = async () => {
    try {
      const topics = await searchService.getTrendingTopics(10);
      setTrendingTopics(topics);
    } catch (error) {
      console.error('Failed to load trending topics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedSearches = async () => {
    if (!user) return;
    
    try {
      const searches = await searchService.getSavedSearches(user.uid);
      setSavedSearches(searches.slice(0, 5)); // Show only recent 5
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  const getTrendingScore = (topic: TrendingTopic): string => {
    const hoursAgo = (Date.now() - topic.lastUsed) / (1000 * 60 * 60);
    if (hoursAgo < 1) {
      return 'Hot';
    } else if (hoursAgo < 6) {
      return 'Rising';
    } else {
      return 'Trending';
    }
  };

  const getTrendingColor = (topic: TrendingTopic): string => {
    const score = getTrendingScore(topic);
    switch (score) {
      case 'Hot':
        return 'text-red-500';
      case 'Rising':
        return 'text-orange-500';
      default:
        return 'text-blue-500';
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Trending Topics */}
      {trendingTopics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-3">
            <TrendingUp className="w-5 h-5 text-orange-500 mr-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Trending</h3>
          </div>
          
          <div className="space-y-2">
            {trendingTopics.map((topic, index) => (
              <button
                key={index}
                onClick={() => onHashtagClick?.(topic.hashtag)}
                className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <Hash className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-blue-600 dark:text-blue-400 font-medium truncate group-hover:text-blue-800 dark:group-hover:text-blue-300">
                      {topic.hashtag.replace('#', '')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {topic.postCount} posts • {formatTimeAgo(topic.lastUsed)}
                    </div>
                  </div>
                </div>
                <div className={`text-xs font-medium px-2 py-1 rounded-full ${getTrendingColor(topic)} bg-opacity-10`}>
                  {getTrendingScore(topic)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved Searches */}
      {user && savedSearches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-3">
            <Bookmark className="w-5 h-5 text-blue-500 mr-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Saved Searches</h3>
          </div>
          
          <div className="space-y-2">
            {savedSearches.map((search) => (
              <button
                key={search.id}
                onClick={() => onSearchClick?.(search.query)}
                className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left group"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-900 dark:text-white font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {search.query}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTimeAgo(search.createdAt)}
                      {search.notificationsEnabled && (
                        <span className="ml-2 w-2 h-2 bg-green-500 rounded-full"></span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Tips */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Search Tips</h3>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <div>• Use #hashtags to find trending topics</div>
          <div>• Search product names for reviews</div>
          <div>• Save searches for notifications</div>
          <div>• Filter by time range</div>
        </div>
      </div>
    </div>
  );
};

export default TrendingSidebar;