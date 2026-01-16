// Search Integration Utilities for NexusPC Community Posts
import { searchService } from '../services/searchService';
import { Post, TrendingTopic, SavedSearch } from '../types/community-posts';

/**
 * Extract hashtags from text content
 */
export const extractHashtags = (content: string): string[] => {
  const hashtagRegex = /#[\w\u0600-\u06FF]+/g;
  return content.match(hashtagRegex) || [];
};

/**
 * Update trending topics when a post is created
 */
export const updateTrendingFromPost = async (post: Post): Promise<void> => {
  const hashtags = extractHashtags(post.content);
  
  // Update trending for each hashtag
  for (const hashtag of hashtags) {
    try {
      // This would be handled by the searchService internally
      await searchService.checkSavedSearchNotifications(post);
    } catch (error) {
      console.error('Failed to update trending for hashtag:', hashtag, error);
    }
  }
};

/**
 * Search posts with smart query processing
 */
export const smartSearch = async (
  query: string, 
  userId?: string
): Promise<{ posts: Post[]; suggestions: string[] }> => {
  try {
    // Process query for hashtags
    let processedQuery = query.trim();
    
    // Auto-add # for hashtag searches if not present
    if (processedQuery.length > 0 && !processedQuery.startsWith('#') && !processedQuery.includes(' ')) {
      // Check if this looks like a hashtag (single word, alphanumeric)
      if (/^[a-zA-Z0-9\u0600-\u06FF]+$/.test(processedQuery)) {
        processedQuery = `#${processedQuery}`;
      }
    }
    
    const result = await searchService.searchPosts(processedQuery, undefined, userId);
    
    return {
      posts: result.posts,
      suggestions: result.suggestions
    };
  } catch (error) {
    console.error('Smart search failed:', error);
    return { posts: [], suggestions: [] };
  }
};

/**
 * Get popular search terms and hashtags
 */
export const getPopularSearchTerms = async (): Promise<{
  hashtags: TrendingTopic[];
  searches: string[];
}> => {
  try {
    const [trending] = await Promise.all([
      searchService.getTrendingTopics(10)
    ]);
    
    // Popular search terms (could be fetched from analytics)
    const popularSearches = [
      'RTX 4090 Build',
      'Budget Gaming PC', 
      'AMD vs Intel',
      'RGB Setup',
      'Cooling Solutions',
      'Best Motherboard',
      'Gaming Monitor',
      'Mechanical Keyboard',
      'High-end Build',
      'First Build'
    ];
    
    return {
      hashtags: trending,
      searches: popularSearches
    };
  } catch (error) {
    console.error('Failed to get popular search terms:', error);
    return { hashtags: [], searches: [] };
  }
};

/**
 * Format search query for display
 */
export const formatSearchQuery = (query: string): string => {
  return query.trim().replace(/\s+/g, ' ');
};

/**
 * Check if a query is a hashtag search
 */
export const isHashtagSearch = (query: string): boolean => {
  return query.trim().startsWith('#');
};

/**
 * Get search suggestions based on partial input
 */
export const getSearchSuggestions = async (
  partialQuery: string,
  limit: number = 5
): Promise<string[]> => {
  try {
    const result = await searchService.getAutocompleteSuggestions(partialQuery, limit);
    return result.suggestions;
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    return [];
  }
};

/**
 * Track search analytics (for future implementation)
 */
export const trackSearchAnalytics = (query: string, resultCount: number, userId?: string): void => {
  // This would send analytics data to a service
  console.log('Search analytics:', { query, resultCount, userId, timestamp: Date.now() });
};

/**
 * Highlight search terms in content
 */
export const highlightSearchTerms = (content: string, searchQuery: string): string => {
  if (!searchQuery.trim()) return content;
  
  const terms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
  let highlightedContent = content;
  
  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedContent = highlightedContent.replace(
      regex, 
      '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>'
    );
  });
  
  return highlightedContent;
};

/**
 * Validate search query
 */
export const validateSearchQuery = (query: string): { isValid: boolean; error?: string } => {
  const trimmedQuery = query.trim();
  
  if (trimmedQuery.length === 0) {
    return { isValid: false, error: 'Search query cannot be empty' };
  }
  
  if (trimmedQuery.length > 100) {
    return { isValid: false, error: 'Search query is too long (max 100 characters)' };
  }
  
  // Check for potentially harmful content
  const harmfulPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i
  ];
  
  for (const pattern of harmfulPatterns) {
    if (pattern.test(trimmedQuery)) {
      return { isValid: false, error: 'Invalid characters in search query' };
    }
  }
  
  return { isValid: true };
};

/**
 * Get search history for a user (placeholder for future implementation)
 */
export const getSearchHistory = async (userId: string): Promise<string[]> => {
  // This would fetch from user's search history
  // For now, return empty array
  return [];
};

/**
 * Save search to history (placeholder for future implementation)
 */
export const saveToSearchHistory = async (userId: string, query: string): Promise<void> => {
  // This would save to user's search history
  console.log('Saving to search history:', { userId, query });
};