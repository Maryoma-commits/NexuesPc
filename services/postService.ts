// PostService for NexusPC Community Posts
import { 
  ref, 
  push, 
  set, 
  get, 
  update, 
  remove, 
  query, 
  orderByChild, 
  limitToLast, 
  endBefore, 
  startAfter,
  equalTo,
  serverTimestamp,
  onValue
} from 'firebase/database';
import { database } from '../firebase.config';
import { 
  Post, 
  CreatePostRequest, 
  PostPrivacy, 
  ProductReference,
  PostError,
  PostErrorType,
  FeedQuery,
  FeedFilters,
  SearchFilters
} from '../types/community-posts';
import { postCache, offlineCache, imageCache } from './cacheService';
import { performanceMonitor } from '../utils/performanceUtils';

/**
 * PostService handles all post-related operations including CRUD, validation, and privacy controls
 * Includes caching for performance optimization
 */
export class PostService {
  private cacheEnabled: boolean = true;

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { hitRate: number; metrics: any } {
    return {
      hitRate: postCache.getHitRate(),
      metrics: postCache.getMetrics()
    };
  }
  
  /**
   * Create a new post with content validation and privacy controls
   * @param postData - The post creation request data
   * @param authorId - The ID of the user creating the post
   * @returns Promise<Post> - The created post with generated ID
   */
  async createPost(postData: CreatePostRequest, authorId: string): Promise<Post> {
    try {
      // Validate content length (Requirement 1.4)
      if (!postData.content || postData.content.trim().length === 0) {
        throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Post content cannot be empty');
      }
      
      if (postData.content.length > 5000) {
        throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Post content exceeds 5000 character limit');
      }
      
      // Validate image sizes (client-side validation should catch this, but double-check)
      if (postData.images) {
        for (const image of postData.images) {
          if (image.size > 10 * 1024 * 1024) { // 10MB
            throw new PostError(PostErrorType.IMAGE_TOO_LARGE, 'Image size cannot exceed 10MB');
          }
        }
      }
      
      // Validate tagged products
      if (postData.taggedProducts) {
        for (const product of postData.taggedProducts) {
          if (!product.productId || !product.title || !product.retailer) {
            throw new PostError(PostErrorType.INVALID_PRODUCT_TAG, 'Invalid product reference');
          }
        }
      }
      
      // Upload images to ImgBB if any (only if imageUrls not provided)
      const imageUrls: string[] = postData.imageUrls || [];
      if (imageUrls.length === 0 && postData.images && postData.images.length > 0) {
        for (const image of postData.images) {
          const imageUrl = await this.uploadImage(image);
          imageUrls.push(imageUrl);
        }
      }
      
      // Create post object (Requirements 1.5, 1.6)
      const now = Date.now();
      const post: Omit<Post, 'id'> = {
        authorId,
        content: postData.content.trim(),
        images: imageUrls,
        taggedProducts: postData.taggedProducts || [],
        privacy: postData.privacy,
        createdAt: now,
        likeCount: 0,
        commentCount: 0,
        reactionCounts: {}
      };
      
      // Save to Firebase
      const postsRef = ref(database, 'posts');
      const newPostRef = push(postsRef);
      await set(newPostRef, post);
      
      const createdPost: Post = {
        id: newPostRef.key!,
        ...post
      };
      
      return createdPost;
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to create post: ${error.message}`, true);
    }
  }
  
  /**
   * Update an existing post with permission checks and edit timestamp
   * @param postId - The ID of the post to update
   * @param updates - Partial post data to update
   * @param userId - The ID of the user attempting the update
   * @returns Promise<void>
   */
  async updatePost(postId: string, updates: Partial<Post>, userId: string): Promise<void> {
    try {
      const postRef = ref(database, `posts/${postId}`);
      const snapshot = await get(postRef);
      
      if (!snapshot.exists()) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Post not found');
      }
      
      const existingPost = snapshot.val() as Post;
      
      // Check if user is the author (Requirement 1.7)
      if (existingPost.authorId !== userId) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Only the post author can edit this post');
      }
      
      // Check if post is within 24-hour edit window (Requirement 1.7)
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (now - existingPost.createdAt > twentyFourHours) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Posts can only be edited within 24 hours of creation');
      }
      
      // Validate content if being updated
      if (updates.content !== undefined) {
        if (updates.content.trim().length === 0) {
          throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Post content cannot be empty');
        }
        if (updates.content.length > 5000) {
          throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Post content exceeds 5000 character limit');
        }
      }
      
      // Save current version to edit history before updating
      const editHistoryEntry = {
        content: existingPost.content,
        images: existingPost.images || [],
        editedAt: existingPost.editedAt || existingPost.createdAt
      };
      
      // Get existing edit history or create new array
      const existingHistory = existingPost.editHistory || [];
      const newHistory = [...existingHistory, editHistoryEntry];
      
      // Prepare update data (Requirement 1.9 - preserve createdAt, update editedAt)
      const updateData: any = {
        ...updates,
        editedAt: serverTimestamp(),
        editHistory: newHistory
      };
      
      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.authorId;
      delete updateData.createdAt;
      delete updateData.likeCount;
      delete updateData.commentCount;
      
      await update(postRef, updateData);
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to update post: ${error.message}`, true);
    }
  }
  
  /**
   * Delete a post with permission checks
   * @param postId - The ID of the post to delete
   * @param userId - The ID of the user attempting the deletion
   * @returns Promise<void>
   */
  async deletePost(postId: string, userId: string): Promise<void> {
    try {
      const postRef = ref(database, `posts/${postId}`);
      const snapshot = await get(postRef);
      
      if (!snapshot.exists()) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Post not found');
      }
      
      const existingPost = snapshot.val() as Post;
      
      // Check if user is the author (Requirement 1.8)
      if (existingPost.authorId !== userId) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Only the post author can delete this post');
      }
      
      // Delete related data FIRST (before deleting the post, so rules can verify ownership)
      // Use try-catch to allow post deletion even if cleanup fails
      try {
        await Promise.all([
          remove(ref(database, `comments/${postId}`)),
          remove(ref(database, `likes/${postId}`)),
          remove(ref(database, `reactions/${postId}`))
        ]);
      } catch (cleanupError) {
        // Log but don't fail - the post deletion is more important
        console.warn('Failed to cleanup related data:', cleanupError);
      }
      
      // Now delete the post
      await remove(postRef);

      // Invalidate cache
      if (this.cacheEnabled) {
        postCache.invalidatePost(postId);
      }
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to delete post: ${error.message}`, true);
    }
  }
  
  /**
   * Get a single post by ID with privacy filtering and caching
   * @param postId - The ID of the post to retrieve
   * @param viewerId - The ID of the user viewing the post (for privacy checks)
   * @returns Promise<Post | null>
   */
  async getPost(postId: string, viewerId?: string): Promise<Post | null> {
    return performanceMonitor.measure('getPost', async () => {
      try {
        // Check cache first
        if (this.cacheEnabled) {
          const cachedPost = postCache.getPost(postId);
          if (cachedPost) {
            // Apply privacy filtering
            if (!(await this.canViewPost(cachedPost, viewerId))) {
              return null;
            }
            return cachedPost;
          }
        }

        const postRef = ref(database, `posts/${postId}`);
        const snapshot = await get(postRef);
        
        if (!snapshot.exists()) {
          return null;
        }
        
        const post: Post = {
          id: snapshot.key!,
          ...snapshot.val()
        };
        
        // Cache the post
        if (this.cacheEnabled) {
          postCache.setPost(post);
        }
        
        // Apply privacy filtering
        if (!(await this.canViewPost(post, viewerId))) {
          return null;
        }
        
        return post;
        
      } catch (error: any) {
        throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get post: ${error.message}`, true);
      }
    }, { postId });
  }
  
  /**
   * Get posts by a specific user with privacy filtering
   * @param userId - The ID of the user whose posts to retrieve
   * @param viewerId - The ID of the user viewing the posts
   * @param limit - Maximum number of posts to retrieve
   * @returns Promise<Post[]>
   */
  async getUserPosts(userId: string, viewerId?: string, limit: number = 20): Promise<Post[]> {
    try {
      const postsRef = ref(database, 'posts');
      const userPostsQuery = query(
        postsRef,
        orderByChild('authorId'),
        equalTo(userId),
        limitToLast(limit)
      );
      
      const snapshot = await get(userPostsQuery);
      const posts: Post[] = [];
      
      // Get follow status once for efficiency
      let isFollowing = false;
      if (viewerId && viewerId !== userId) {
        const { followService } = await import('./followService');
        isFollowing = await followService.isFollowing(viewerId, userId);
      }
      
      snapshot.forEach((childSnapshot) => {
        const post: Post = {
          id: childSnapshot.key!,
          ...childSnapshot.val()
        };
        
        // Apply privacy filtering using sync version since we have follow status
        if (this.canViewPostSync(post, viewerId, isFollowing)) {
          posts.push(post);
        }
      });
      
      // Sort by creation time (newest first)
      posts.sort((a, b) => b.createdAt - a.createdAt);
      
      return posts;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get user posts: ${error.message}`, true);
    }
  }
  
  /**
   * Get feed posts with filtering, pagination, and caching
   * @param feedQuery - The feed query parameters
   * @returns Promise<Post[]>
   */
  async getFeedPosts(feedQuery: FeedQuery): Promise<Post[]> {
    return performanceMonitor.measure('getFeedPosts', async () => {
      try {
        // Calculate page number from startAfter for cache key
        const page = feedQuery.startAfter ? Math.floor(parseInt(feedQuery.startAfter) / feedQuery.limit) : 0;

        // Check cache first
        if (this.cacheEnabled) {
          const cachedFeed = postCache.getFeed(
            feedQuery.userId || 'anonymous',
            feedQuery.feedType,
            page,
            feedQuery.filters
          );
          if (cachedFeed) {
            return cachedFeed;
          }
        }

        const postsRef = ref(database, 'posts');
        let postsQuery;
        
        // Build query based on feed type
        if (feedQuery.feedType === 'user' && feedQuery.userId) {
          // User-specific feed
          postsQuery = query(
            postsRef,
            orderByChild('authorId'),
            equalTo(feedQuery.userId),
            limitToLast(feedQuery.limit)
          );
        } else {
          // General feed (following/discover)
          postsQuery = query(
            postsRef,
            orderByChild('createdAt'),
            limitToLast(feedQuery.limit)
          );
          
          if (feedQuery.startAfter) {
            postsQuery = query(
              postsRef,
              orderByChild('createdAt'),
              endBefore(parseInt(feedQuery.startAfter)),
              limitToLast(feedQuery.limit)
            );
          }
        }
        
        const snapshot = await get(postsQuery);
        const posts: Post[] = [];
        
        // Get following list for efficiency
        let followingSet = new Set<string>();
        if (feedQuery.userId) {
          const { followService } = await import('./followService');
          const following = await followService.getFollowing(feedQuery.userId);
          followingSet = new Set(following);
        }
        
        snapshot.forEach((childSnapshot) => {
          const post: Post = {
            id: childSnapshot.key!,
            ...childSnapshot.val()
          };
          
          // Apply privacy filtering using sync version with follow status
          const isFollowing = followingSet.has(post.authorId);
          if (this.canViewPostSync(post, feedQuery.userId, isFollowing)) {
            // Apply additional filters
            if (this.matchesFilters(post, feedQuery.filters)) {
              posts.push(post);
            }
          }
        });
        
        // Sort by creation time (newest first) for chronological feed
        posts.sort((a, b) => b.createdAt - a.createdAt);

        // Cache the results
        if (this.cacheEnabled) {
          postCache.setFeed(
            feedQuery.userId || 'anonymous',
            feedQuery.feedType,
            page,
            posts,
            feedQuery.filters
          );

          // Save for offline viewing
          if (page === 0) {
            offlineCache.savePosts(posts);
          }

          // Preload images for first few posts
          if (posts.length > 0) {
            imageCache.preloadPostImages(posts, 3);
          }
        }
        
        return posts;
        
      } catch (error: any) {
        // Try to return offline data if available
        if (this.cacheEnabled) {
          const offlinePosts = offlineCache.getPosts();
          if (offlinePosts) {
            return offlinePosts;
          }
        }
        throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get feed posts: ${error.message}`, true);
      }
    }, { feedType: feedQuery.feedType, limit: feedQuery.limit });
  }
  
  /**
   * Search posts with filters
   * @param query - The search query string
   * @param filters - Optional search filters
   * @param viewerId - The ID of the user performing the search
   * @returns Promise<Post[]>
   */
  async searchPosts(query: string, filters?: SearchFilters, viewerId?: string): Promise<Post[]> {
    try {
      // For now, we'll do a simple client-side search
      // In production, you'd want to use a proper search service like Algolia
      const postsRef = ref(database, 'posts');
      const snapshot = await get(postsRef);
      const posts: Post[] = [];
      
      // Get following list for efficiency
      let followingSet = new Set<string>();
      if (viewerId) {
        const { followService } = await import('./followService');
        const following = await followService.getFollowing(viewerId);
        followingSet = new Set(following);
      }
      
      snapshot.forEach((childSnapshot) => {
        const post: Post = {
          id: childSnapshot.key!,
          ...childSnapshot.val()
        };
        
        // Apply privacy filtering using sync version with follow status
        const isFollowing = followingSet.has(post.authorId);
        if (!this.canViewPostSync(post, viewerId, isFollowing)) {
          return;
        }
        
        // Apply search filters
        if (filters) {
          if (filters.userId && post.authorId !== filters.userId) {
            return;
          }
          
          if (filters.dateRange) {
            if (post.createdAt < filters.dateRange.start || post.createdAt > filters.dateRange.end) {
              return;
            }
          }
          
          if (filters.postType && filters.postType !== 'all') {
            if (filters.postType === 'product' && post.taggedProducts.length === 0) {
              return;
            }
            if (filters.postType === 'media' && post.images.length === 0) {
              return;
            }
          }
        }
        
        // Check if post matches search query
        const searchText = query.toLowerCase();
        const postContent = post.content.toLowerCase();
        const productTitles = post.taggedProducts.map(p => p.title.toLowerCase()).join(' ');
        
        if (postContent.includes(searchText) || productTitles.includes(searchText)) {
          posts.push(post);
        }
      });
      
      // Sort by relevance (for now, just by creation time)
      posts.sort((a, b) => b.createdAt - a.createdAt);
      
      return posts;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to search posts: ${error.message}`, true);
    }
  }
  
  /**
   * Listen to real-time post updates
   * @param callback - Function to call when posts update
   * @param limit - Maximum number of posts to listen to
   * @returns Function to unsubscribe from updates
   */
  listenToPosts(callback: (posts: Post[]) => void, limit: number = 50): () => void {
    const postsRef = ref(database, 'posts');
    const postsQuery = query(postsRef, orderByChild('createdAt'), limitToLast(limit));
    
    return onValue(postsQuery, (snapshot) => {
      const posts: Post[] = [];
      
      snapshot.forEach((childSnapshot) => {
        posts.push({
          id: childSnapshot.key!,
          ...childSnapshot.val()
        });
      });
      
      // Sort by creation time (newest first)
      posts.sort((a, b) => b.createdAt - a.createdAt);
      
      callback(posts);
    });
  }
  
  /**
   * Check if a user can view a post based on privacy settings
   * @param post - The post to check
   * @param viewerId - The ID of the user trying to view the post
   * @param isFollowing - Whether the viewer is following the author (optional, will be checked if not provided)
   * @returns Promise<boolean>
   */
  async canViewPost(post: Post, viewerId?: string, isFollowing?: boolean): Promise<boolean> {
    // Public posts can be viewed by anyone
    if (post.privacy === 'public') {
      return true;
    }
    
    // Private posts can only be viewed by the author
    if (post.privacy === 'private') {
      return viewerId === post.authorId;
    }
    
    // Friends-only posts require authentication and following relationship
    if (post.privacy === 'friends') {
      if (!viewerId) {
        return false; // Not authenticated
      }
      
      if (viewerId === post.authorId) {
        return true; // Author can always see their own posts
      }
      
      // Check if viewer is following the author
      if (isFollowing === undefined) {
        // Import followService here to avoid circular dependency
        const { followService } = await import('./followService');
        isFollowing = await followService.isFollowing(viewerId, post.authorId);
      }
      
      return isFollowing;
    }
    
    return false;
  }

  /**
   * Synchronous version of canViewPost for cases where follow status is already known
   * @param post - The post to check
   * @param viewerId - The ID of the user trying to view the post
   * @param isFollowing - Whether the viewer is following the author
   * @returns boolean
   */
  private canViewPostSync(post: Post, viewerId?: string, isFollowing: boolean = false): boolean {
    // Public posts can be viewed by anyone
    if (post.privacy === 'public') {
      return true;
    }
    
    // Private posts can only be viewed by the author
    if (post.privacy === 'private') {
      return viewerId === post.authorId;
    }
    
    // Friends-only posts require authentication and following relationship
    if (post.privacy === 'friends') {
      if (!viewerId) {
        return false; // Not authenticated
      }
      
      if (viewerId === post.authorId) {
        return true; // Author can always see their own posts
      }
      
      return isFollowing;
    }
    
    return false;
  }
  
  /**
   * Check if a post matches the given filters
   * @param post - The post to check
   * @param filters - The filters to apply
   * @returns boolean
   */
  private matchesFilters(post: Post, filters?: FeedFilters): boolean {
    if (!filters) {
      return true;
    }
    
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
  }
  
  /**
   * Upload an image to ImgBB
   * @param file - The image file to upload
   * @returns Promise<string> - The uploaded image URL
   */
  private async uploadImage(file: File): Promise<string> {
    try {
      // Get ImgBB API key from environment
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
      if (!apiKey) {
        throw new PostError(PostErrorType.NETWORK_ERROR, 'Image upload service not configured');
      }

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64String = result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to ImgBB
      const formData = new FormData();
      formData.append('image', base64);
      formData.append('name', `post_${Date.now()}`);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new PostError(PostErrorType.NETWORK_ERROR, 'Failed to upload image');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new PostError(PostErrorType.NETWORK_ERROR, data.error?.message || 'Image upload failed');
      }

      return data.data.url;
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Image upload failed: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const postService = new PostService();