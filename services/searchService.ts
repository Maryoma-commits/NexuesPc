// SearchService for NexusPC Community Posts
import { 
  ref, 
  get, 
  query, 
  orderByChild, 
  limitToLast,
  push,
  set,
  remove,
  onValue
} from 'firebase/database';
import { database } from '../firebase.config';
import { 
  Post, 
  SearchFilters, 
  TrendingTopic, 
  SavedSearch,
  PostError,
  PostErrorType
} from '../types/community-posts';

export interface SearchResult {
  posts: Post[];
  groupedResults: {
    product: Post[];
    media: Post[];
    general: Post[];
  };
  totalCount: number;
  suggestions: string[];
}

export interface AutocompleteResult {
  suggestions: string[];
  trending: TrendingTopic[];
}

/**
 * SearchService handles search functionality, autocomplete, trending topics, and saved searches
 */
export class SearchService {
  
  /**
   * Search posts with comprehensive filtering and grouping
   * @param query - The search query string
   * @param filters - Optional search filters
   * @param viewerId - The ID of the user performing the search
   * @returns Promise<SearchResult>
   */
  async searchPosts(query: string, filters?: SearchFilters, viewerId?: string): Promise<SearchResult> {
    try {
      if (!query || query.trim().length === 0) {
        return {
          posts: [],
          groupedResults: { product: [], media: [], general: [] },
          totalCount: 0,
          suggestions: await this.getSearchSuggestions('')
        };
      }

      // Get all posts from Firebase
      const postsRef = ref(database, 'posts');
      const snapshot = await get(postsRef);
      const allPosts: Post[] = [];
      
      snapshot.forEach((childSnapshot) => {
        const post: Post = {
          id: childSnapshot.key!,
          ...childSnapshot.val()
        };
        allPosts.push(post);
      });

      // Filter posts based on search criteria
      const searchResults = this.filterAndSearchPosts(allPosts, query, filters, viewerId);
      
      // Group results by type
      const groupedResults = this.groupPostsByType(searchResults);
      
      // Get search suggestions
      const suggestions = await this.getSearchSuggestions(query);
      
      // Update search analytics
      await this.trackSearch(query, searchResults.length, viewerId);
      
      return {
        posts: searchResults,
        groupedResults,
        totalCount: searchResults.length,
        suggestions
      };
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Search failed: ${error.message}`, true);
    }
  }
  
  /**
   * Get autocomplete suggestions based on partial query
   * @param partialQuery - The partial search query
   * @param limit - Maximum number of suggestions
   * @returns Promise<AutocompleteResult>
   */
  async getAutocompleteSuggestions(partialQuery: string, limit: number = 10): Promise<AutocompleteResult> {
    try {
      const suggestions = await this.getSearchSuggestions(partialQuery, limit);
      const trending = await this.getTrendingTopics(5);
      
      return {
        suggestions,
        trending
      };
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Autocomplete failed: ${error.message}`, true);
    }
  }
  
  /**
   * Get trending hashtags and topics
   * @param limit - Maximum number of trending topics
   * @returns Promise<TrendingTopic[]>
   */
  async getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
    try {
      const trendingRef = ref(database, 'trending');
      const snapshot = await get(trendingRef);
      const trending: TrendingTopic[] = [];
      
      snapshot.forEach((childSnapshot) => {
        trending.push(childSnapshot.val());
      });
      
      // Sort by post count and recency
      trending.sort((a, b) => {
        const scoreA = a.postCount * (1 + (Date.now() - a.lastUsed) / (24 * 60 * 60 * 1000));
        const scoreB = b.postCount * (1 + (Date.now() - b.lastUsed) / (24 * 60 * 60 * 1000));
        return scoreB - scoreA;
      });
      
      return trending.slice(0, limit);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get trending topics: ${error.message}`, true);
    }
  }
  
  /**
   * Save a search query for a user with optional notifications
   * @param userId - The user ID
   * @param query - The search query to save
   * @param filters - Optional search filters
   * @param notificationsEnabled - Whether to notify on new matches
   * @returns Promise<SavedSearch>
   */
  async saveSearch(userId: string, query: string, filters?: SearchFilters, notificationsEnabled: boolean = false): Promise<SavedSearch> {
    try {
      const savedSearchesRef = ref(database, `savedSearches/${userId}`);
      const newSearchRef = push(savedSearchesRef);
      
      const savedSearch: Omit<SavedSearch, 'id'> = {
        userId,
        query,
        filters: filters || {},
        createdAt: Date.now(),
        notificationsEnabled
      };
      
      await set(newSearchRef, savedSearch);
      
      return {
        id: newSearchRef.key!,
        ...savedSearch
      };
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to save search: ${error.message}`, true);
    }
  }
  
  /**
   * Get saved searches for a user
   * @param userId - The user ID
   * @returns Promise<SavedSearch[]>
   */
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    try {
      const savedSearchesRef = ref(database, `savedSearches/${userId}`);
      const snapshot = await get(savedSearchesRef);
      const savedSearches: SavedSearch[] = [];
      
      snapshot.forEach((childSnapshot) => {
        savedSearches.push({
          id: childSnapshot.key!,
          ...childSnapshot.val()
        });
      });
      
      // Sort by creation date (newest first)
      savedSearches.sort((a, b) => b.createdAt - a.createdAt);
      
      return savedSearches;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get saved searches: ${error.message}`, true);
    }
  }
  
  /**
   * Delete a saved search
   * @param userId - The user ID
   * @param searchId - The saved search ID
   * @returns Promise<void>
   */
  async deleteSavedSearch(userId: string, searchId: string): Promise<void> {
    try {
      const searchRef = ref(database, `savedSearches/${userId}/${searchId}`);
      await remove(searchRef);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to delete saved search: ${error.message}`, true);
    }
  }
  
  /**
   * Search for hashtags in posts
   * @param hashtag - The hashtag to search for (without #)
   * @param viewerId - The ID of the user performing the search
   * @returns Promise<Post[]>
   */
  async searchByHashtag(hashtag: string, viewerId?: string): Promise<Post[]> {
    try {
      const hashtagQuery = `#${hashtag.replace('#', '')}`;
      return this.searchPosts(hashtagQuery, undefined, viewerId).then(result => result.posts);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Hashtag search failed: ${error.message}`, true);
    }
  }
  
  /**
   * Check for new content matching saved searches and notify users
   * @param newPost - The newly created post
   * @returns Promise<void>
   */
  async checkSavedSearchNotifications(newPost: Post): Promise<void> {
    try {
      // Get all saved searches with notifications enabled
      const savedSearchesRef = ref(database, 'savedSearches');
      const snapshot = await get(savedSearchesRef);
      
      const notificationPromises: Promise<void>[] = [];
      
      snapshot.forEach((userSnapshot) => {
        userSnapshot.forEach((searchSnapshot) => {
          const savedSearch: SavedSearch = {
            id: searchSnapshot.key!,
            ...searchSnapshot.val()
          };
          
          if (savedSearch.notificationsEnabled) {
            // Check if the new post matches this saved search
            if (this.postMatchesSearch(newPost, savedSearch.query, savedSearch.filters)) {
              notificationPromises.push(this.sendSearchNotification(savedSearch.userId, savedSearch.query, newPost));
            }
          }
        });
      });
      
      await Promise.all(notificationPromises);
      
    } catch (error: any) {
      console.error('Failed to check saved search notifications:', error);
      // Don't throw error as this is a background process
    }
  }
  
  /**
   * Filter and search posts based on query and filters
   * @private
   */
  private filterAndSearchPosts(posts: Post[], query: string, filters?: SearchFilters, viewerId?: string): Post[] {
    return posts.filter(post => {
      // Privacy filtering
      if (!this.canViewPost(post, viewerId)) {
        return false;
      }
      
      // Apply search filters
      if (filters) {
        if (filters.userId && post.authorId !== filters.userId) {
          return false;
        }
        
        if (filters.dateRange) {
          if (post.createdAt < filters.dateRange.start || post.createdAt > filters.dateRange.end) {
            return false;
          }
        }
        
        if (filters.postType && filters.postType !== 'all') {
          const taggedProducts = post.taggedProducts || [];
          const images = post.images || [];
          
          if (filters.postType === 'product' && taggedProducts.length === 0) {
            return false;
          }
          if (filters.postType === 'media' && images.length === 0) {
            return false;
          }
        }
      }
      
      // Search matching
      return this.postMatchesSearch(post, query, filters);
    }).sort((a, b) => b.createdAt - a.createdAt); // Sort by recency
  }
  
  /**
   * Check if a post matches a search query
   * @private
   */
  private postMatchesSearch(post: Post, query: string, filters?: SearchFilters): boolean {
    const searchLower = query.toLowerCase();
    
    // Search in content
    if (post.content && post.content.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search in tagged products (with null check)
    const taggedProducts = post.taggedProducts || [];
    if (taggedProducts.some(p => p.title && p.title.toLowerCase().includes(searchLower))) {
      return true;
    }
    
    // Search for hashtags
    if (query.startsWith('#')) {
      const hashtag = query.substring(1);
      return post.content && post.content.toLowerCase().includes(`#${hashtag.toLowerCase()}`);
    }
    
    return false;
  }
  
  /**
   * Group posts by type for search results
   * @private
   */
  private groupPostsByType(posts: Post[]): { product: Post[]; media: Post[]; general: Post[] } {
    const grouped = {
      product: [] as Post[],
      media: [] as Post[],
      general: [] as Post[]
    };
    
    posts.forEach(post => {
      const taggedProducts = post.taggedProducts || [];
      const images = post.images || [];
      
      if (taggedProducts.length > 0) {
        grouped.product.push(post);
      } else if (images.length > 0) {
        grouped.media.push(post);
      } else {
        grouped.general.push(post);
      }
    });
    
    return grouped;
  }
  
  /**
   * Get search suggestions based on popular searches and content
   * @private
   */
  private async getSearchSuggestions(query: string, limit: number = 10): Promise<string[]> {
    try {
      // In a real implementation, this would use a proper search index
      // For now, we'll return some basic suggestions
      const suggestions: string[] = [];
      
      if (query.length === 0) {
        // Return popular/trending searches
        suggestions.push('RTX 4090', 'AMD Ryzen', 'Gaming Setup', 'Budget Build', 'RGB Lighting');
      } else {
        // Return query-based suggestions
        const queryLower = query.toLowerCase();
        const commonTerms = [
          'RTX 4090', 'RTX 4080', 'RTX 4070', 'AMD Ryzen 7', 'AMD Ryzen 5', 
          'Intel i7', 'Intel i5', 'Gaming Setup', 'Budget Build', 'High-end Build',
          'RGB Lighting', 'Cooling System', 'Motherboard', 'RAM', 'SSD', 'PSU'
        ];
        
        suggestions.push(...commonTerms.filter(term => 
          term.toLowerCase().includes(queryLower)
        ).slice(0, limit));
      }
      
      return suggestions.slice(0, limit);
      
    } catch (error: any) {
      return [];
    }
  }
  
  /**
   * Track search analytics
   * @private
   */
  private async trackSearch(query: string, resultCount: number, userId?: string): Promise<void> {
    try {
      // Update search analytics
      const analyticsRef = ref(database, 'searchAnalytics');
      const searchData = {
        query,
        resultCount,
        userId,
        timestamp: Date.now()
      };
      
      const newAnalyticsRef = push(analyticsRef);
      await set(newAnalyticsRef, searchData);
      
      // Update trending topics if query contains hashtags
      const hashtags = query.match(/#\w+/g);
      if (hashtags) {
        for (const hashtag of hashtags) {
          await this.updateTrendingTopic(hashtag);
        }
      }
      
    } catch (error: any) {
      // Don't throw error for analytics failures
      console.error('Failed to track search:', error);
    }
  }
  
  /**
   * Update trending topic statistics
   * @private
   */
  private async updateTrendingTopic(hashtag: string): Promise<void> {
    try {
      const trendingRef = ref(database, `trending/${hashtag.replace('#', '')}`);
      const snapshot = await get(trendingRef);
      
      let trendingData: TrendingTopic;
      
      if (snapshot.exists()) {
        trendingData = snapshot.val();
        trendingData.postCount += 1;
        trendingData.lastUsed = Date.now();
      } else {
        trendingData = {
          hashtag,
          postCount: 1,
          lastUsed: Date.now()
        };
      }
      
      await set(trendingRef, trendingData);
      
    } catch (error: any) {
      console.error('Failed to update trending topic:', error);
    }
  }
  
  /**
   * Send notification for saved search match
   * @private
   */
  private async sendSearchNotification(userId: string, query: string, matchingPost: Post): Promise<void> {
    try {
      const notificationsRef = ref(database, `notifications/${userId}`);
      const newNotificationRef = push(notificationsRef);
      
      const notification = {
        type: 'saved_search_match',
        fromUserId: matchingPost.authorId,
        postId: matchingPost.id,
        message: `New post matches your saved search: "${query}"`,
        createdAt: Date.now(),
        read: false
      };
      
      await set(newNotificationRef, notification);
      
    } catch (error: any) {
      console.error('Failed to send search notification:', error);
    }
  }
  
  /**
   * Check if a user can view a post based on privacy settings
   * @private
   */
  private canViewPost(post: Post, viewerId?: string): boolean {
    if (post.privacy === 'public') {
      return true;
    }
    
    if (post.privacy === 'private') {
      return viewerId === post.authorId;
    }
    
    if (post.privacy === 'friends') {
      if (!viewerId) {
        return false;
      }
      
      if (viewerId === post.authorId) {
        return true;
      }
      
      // TODO: Check if viewer is following the author
      // For now, allow all authenticated users to see friends-only posts
      return true;
    }
    
    return false;
  }
}

// Export a singleton instance
export const searchService = new SearchService();