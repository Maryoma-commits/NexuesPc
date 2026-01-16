// Feed Utility Functions for NexusPC Community Posts
// Pure functions for testing feed logic without React/Firebase dependency
import { Post, FeedFilters, PostPrivacy, ReactionType, ProductReference } from '../types/community-posts';

/**
 * FeedLogic contains pure functions for feed operations
 * These can be tested independently of React components and Firebase
 */
export const FeedLogic = {
  /**
   * Sort posts in reverse chronological order (newest first)
   * Requirement 2.1: Posts should be displayed in reverse chronological order
   * @param posts - Array of posts to sort
   * @returns Sorted array of posts (newest first)
   */
  sortByChronological(posts: Post[]): Post[] {
    return [...posts].sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Verify that posts are in reverse chronological order
   * @param posts - Array of posts to verify
   * @returns true if posts are sorted newest first
   */
  isChronologicallySorted(posts: Post[]): boolean {
    if (posts.length <= 1) return true;
    
    for (let i = 1; i < posts.length; i++) {
      if (posts[i].createdAt > posts[i - 1].createdAt) {
        return false;
      }
    }
    return true;
  },

  /**
   * Paginate posts for infinite scroll
   * Requirement 2.5: Implement infinite scroll loading 20 posts at a time
   * @param posts - All posts
   * @param page - Page number (0-indexed)
   * @param pageSize - Number of posts per page (default 20)
   * @returns Paginated posts for the requested page
   */
  paginatePosts(posts: Post[], page: number, pageSize: number = 20): {
    posts: Post[];
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  } {
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPosts = posts.slice(startIndex, endIndex);
    const totalPages = Math.ceil(posts.length / pageSize);
    
    return {
      posts: paginatedPosts,
      hasMore: endIndex < posts.length,
      totalPages,
      currentPage: page
    };
  },

  /**
   * Get posts for infinite scroll (accumulative)
   * Returns all posts up to and including the current page
   * @param posts - All posts
   * @param page - Current page number (0-indexed)
   * @param pageSize - Number of posts per page (default 20)
   * @returns Accumulated posts up to current page
   */
  getPostsForInfiniteScroll(posts: Post[], page: number, pageSize: number = 20): {
    posts: Post[];
    hasMore: boolean;
    loadedCount: number;
    totalCount: number;
  } {
    const endIndex = (page + 1) * pageSize;
    const loadedPosts = posts.slice(0, endIndex);
    
    return {
      posts: loadedPosts,
      hasMore: endIndex < posts.length,
      loadedCount: loadedPosts.length,
      totalCount: posts.length
    };
  },

  /**
   * Filter posts by type
   * @param posts - Posts to filter
   * @param filters - Filter criteria
   * @returns Filtered posts
   */
  filterPosts(posts: Post[], filters?: FeedFilters): Post[] {
    if (!filters) return posts;
    
    return posts.filter(post => {
      // Filter by post type
      if (filters.postType && filters.postType !== 'all') {
        if (filters.postType === 'product' && post.taggedProducts.length === 0) {
          return false;
        }
        if (filters.postType === 'media' && post.images.length === 0) {
          return false;
        }
      }
      
      // Filter by time range
      if (filters.timeRange && filters.timeRange !== 'all') {
        const now = Date.now();
        let timeThreshold = 0;
        
        switch (filters.timeRange) {
          case 'day':
            timeThreshold = now - (24 * 60 * 60 * 1000);
            break;
          case 'week':
            timeThreshold = now - (7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            timeThreshold = now - (30 * 24 * 60 * 60 * 1000);
            break;
        }
        
        if (post.createdAt < timeThreshold) {
          return false;
        }
      }
      
      return true;
    });
  },

  /**
   * Calculate skeleton count for loading state
   * Requirement 2.8: Display skeleton placeholders to prevent layout shifts
   * @param expectedCount - Expected number of posts
   * @returns Number of skeleton items to show
   */
  calculateSkeletonCount(expectedCount: number = 20): number {
    return Math.min(expectedCount, 20);
  },

  /**
   * Determine if feed should show loading state
   * @param isLoading - Whether data is being fetched
   * @param posts - Current posts array
   * @returns Whether to show loading skeleton
   */
  shouldShowSkeleton(isLoading: boolean, posts: Post[]): boolean {
    return isLoading && posts.length === 0;
  },

  /**
   * Determine if feed should show "load more" indicator
   * @param isLoadingMore - Whether more data is being fetched
   * @param hasMore - Whether there are more posts to load
   * @returns Whether to show load more indicator
   */
  shouldShowLoadMore(isLoadingMore: boolean, hasMore: boolean): boolean {
    return isLoadingMore || hasMore;
  },

  /**
   * Merge new posts with existing posts (for real-time updates)
   * Requirement 2.9: Update in real-time when new posts are created
   * @param existingPosts - Current posts in feed
   * @param newPosts - New posts from real-time update
   * @returns Merged and sorted posts
   */
  mergeNewPosts(existingPosts: Post[], newPosts: Post[]): Post[] {
    // Create a map of existing posts by ID
    const existingMap = new Map(existingPosts.map(p => [p.id, p]));
    
    // Add or update posts from newPosts
    for (const post of newPosts) {
      existingMap.set(post.id, post);
    }
    
    // Convert back to array and sort
    const merged = Array.from(existingMap.values());
    return this.sortByChronological(merged);
  },

  /**
   * Check if a post is new (for highlighting)
   * @param post - Post to check
   * @param lastViewedTimestamp - When user last viewed the feed
   * @returns Whether post is new since last view
   */
  isNewPost(post: Post, lastViewedTimestamp: number): boolean {
    return post.createdAt > lastViewedTimestamp;
  },

  /**
   * Count new posts since last view
   * @param posts - All posts
   * @param lastViewedTimestamp - When user last viewed the feed
   * @returns Number of new posts
   */
  countNewPosts(posts: Post[], lastViewedTimestamp: number): number {
    return posts.filter(p => p.createdAt > lastViewedTimestamp).length;
  },

  /**
   * Validate pagination parameters
   * @param page - Page number
   * @param pageSize - Page size
   * @returns Validated parameters
   */
  validatePaginationParams(page: number, pageSize: number): {
    page: number;
    pageSize: number;
    isValid: boolean;
  } {
    const validPage = Math.max(0, Math.floor(page));
    const validPageSize = Math.min(Math.max(1, Math.floor(pageSize)), 100);
    
    return {
      page: validPage,
      pageSize: validPageSize,
      isValid: page >= 0 && pageSize > 0 && pageSize <= 100
    };
  }
};
