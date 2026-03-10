// Cache Service for NexusPC Community Posts
// Implements caching for posts, images, and feed data
// Requirements: Performance optimization and caching

import { Post, FeedFilters } from '../types/community-posts';

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  maxSize: number;
  defaultTTL: number; // Time to live in milliseconds
}

/**
 * Performance metrics for monitoring
 */
interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  totalRequests: number;
  averageLoadTime: number;
  loadTimes: number[];
}

/**
 * Generic in-memory cache with LRU eviction
 */
class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private accessOrder: string[];
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map();
    this.accessOrder = [];
    this.config = {
      maxSize: config.maxSize || 100,
      defaultTTL: config.defaultTTL || 5 * 60 * 1000 // 5 minutes default
    };
  }

  /**
   * Get item from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access order (move to end)
    this.updateAccessOrder(key);
    
    return entry.data;
  }

  /**
   * Set item in cache
   */
  set(key: string, data: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttl || this.config.defaultTTL)
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  private updateAccessOrder(key: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  private evictLRU(): void {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift()!;
      this.cache.delete(lruKey);
    }
  }
}

/**
 * Post Cache Service
 * Caches individual posts and feed results
 */
class PostCacheService {
  private postCache: LRUCache<Post>;
  private feedCache: LRUCache<Post[]>;
  private metrics: PerformanceMetrics;

  constructor() {
    this.postCache = new LRUCache<Post>({ maxSize: 500, defaultTTL: 5 * 60 * 1000 });
    this.feedCache = new LRUCache<Post[]>({ maxSize: 50, defaultTTL: 2 * 60 * 1000 });
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageLoadTime: 0,
      loadTimes: []
    };
  }

  /**
   * Get a single post from cache
   */
  getPost(postId: string): Post | null {
    this.metrics.totalRequests++;
    const post = this.postCache.get(`post:${postId}`);
    
    if (post) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    
    return post;
  }

  /**
   * Cache a single post
   */
  setPost(post: Post): void {
    this.postCache.set(`post:${post.id}`, post);
  }

  /**
   * Cache multiple posts
   */
  setPosts(posts: Post[]): void {
    for (const post of posts) {
      this.setPost(post);
    }
  }

  /**
   * Get feed from cache
   */
  getFeed(userId: string, feedType: string, page: number, filters?: FeedFilters): Post[] | null {
    const key = this.generateFeedKey(userId, feedType, page, filters);
    this.metrics.totalRequests++;
    
    const feed = this.feedCache.get(key);
    
    if (feed) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    
    return feed;
  }

  /**
   * Cache feed results
   */
  setFeed(userId: string, feedType: string, page: number, posts: Post[], filters?: FeedFilters): void {
    const key = this.generateFeedKey(userId, feedType, page, filters);
    this.feedCache.set(key, posts);
    
    // Also cache individual posts
    this.setPosts(posts);
  }

  /**
   * Invalidate post cache
   */
  invalidatePost(postId: string): void {
    this.postCache.delete(`post:${postId}`);
    // Also invalidate related feeds
    this.feedCache.invalidatePattern(/^feed:/);
  }

  /**
   * Invalidate user's feed cache
   */
  invalidateUserFeed(userId: string): void {
    this.feedCache.invalidatePattern(new RegExp(`^feed:${userId}:`));
  }

  /**
   * Invalidate all feed caches
   */
  invalidateAllFeeds(): void {
    this.feedCache.clear();
  }

  /**
   * Record load time for metrics
   */
  recordLoadTime(duration: number): void {
    this.metrics.loadTimes.push(duration);
    
    // Keep only last 100 measurements
    if (this.metrics.loadTimes.length > 100) {
      this.metrics.loadTimes.shift();
    }
    
    // Update average
    this.metrics.averageLoadTime = 
      this.metrics.loadTimes.reduce((a, b) => a + b, 0) / this.metrics.loadTimes.length;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.cacheHits / this.metrics.totalRequests;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.postCache.clear();
    this.feedCache.clear();
  }

  private generateFeedKey(userId: string, feedType: string, page: number, filters?: FeedFilters): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `feed:${userId}:${feedType}:${page}:${filterStr}`;
  }
}

/**
 * Image Cache Service
 * Handles image preloading and caching
 */
class ImageCacheService {
  private loadedImages: Set<string>;
  private loadingImages: Map<string, Promise<void>>;
  private failedImages: Set<string>;

  constructor() {
    this.loadedImages = new Set();
    this.loadingImages = new Map();
    this.failedImages = new Set();
  }

  /**
   * Check if image is cached
   */
  isLoaded(url: string): boolean {
    return this.loadedImages.has(url);
  }

  /**
   * Check if image failed to load
   */
  hasFailed(url: string): boolean {
    return this.failedImages.has(url);
  }

  /**
   * Preload a single image
   */
  async preload(url: string): Promise<boolean> {
    if (this.loadedImages.has(url)) {
      return true;
    }

    if (this.failedImages.has(url)) {
      return false;
    }

    // Check if already loading
    const existingPromise = this.loadingImages.get(url);
    if (existingPromise) {
      await existingPromise;
      return this.loadedImages.has(url);
    }

    // Start loading
    const loadPromise = this.loadImage(url);
    this.loadingImages.set(url, loadPromise);

    try {
      await loadPromise;
      this.loadedImages.add(url);
      return true;
    } catch {
      this.failedImages.add(url);
      return false;
    } finally {
      this.loadingImages.delete(url);
    }
  }

  /**
   * Preload multiple images
   */
  async preloadMany(urls: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    await Promise.all(
      urls.map(async (url) => {
        const success = await this.preload(url);
        results.set(url, success);
      })
    );

    return results;
  }

  /**
   * Preload images for posts (lazy loading support)
   */
  async preloadPostImages(posts: Post[], limit: number = 5): Promise<void> {
    if (!posts || !Array.isArray(posts)) return;
    
    const imagesToLoad: string[] = [];
    
    for (const post of posts.slice(0, limit)) {
      if (post.images && Array.isArray(post.images)) {
        imagesToLoad.push(...post.images.slice(0, 2)); // First 2 images per post
      }
    }

    if (imagesToLoad.length > 0) {
      await this.preloadMany(imagesToLoad);
    }
  }

  /**
   * Clear image cache
   */
  clear(): void {
    this.loadedImages.clear();
    this.failedImages.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): { loaded: number; failed: number; loading: number } {
    return {
      loaded: this.loadedImages.size,
      failed: this.failedImages.size,
      loading: this.loadingImages.size
    };
  }

  private loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }
}

/**
 * Offline Cache Service
 * Handles offline data storage using localStorage
 */
class OfflineCacheService {
  private readonly STORAGE_KEY_PREFIX = 'offline_';
  private readonly MAX_OFFLINE_POSTS = 100;

  /**
   * Save posts for offline viewing
   */
  savePosts(posts: Post[]): void {
    try {
      const postsToSave = posts.slice(0, this.MAX_OFFLINE_POSTS);
      const data = {
        posts: postsToSave,
        savedAt: Date.now()
      };
      localStorage.setItem(
        `${this.STORAGE_KEY_PREFIX}posts`,
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn('Failed to save posts for offline viewing:', error);
    }
  }

  /**
   * Get offline posts
   */
  getPosts(): Post[] | null {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY_PREFIX}posts`);
      if (!stored) return null;

      const data = JSON.parse(stored);
      
      // Check if data is too old (24 hours)
      if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
        this.clearPosts();
        return null;
      }

      return data.posts;
    } catch {
      return null;
    }
  }

  /**
   * Clear offline posts
   */
  clearPosts(): void {
    localStorage.removeItem(`${this.STORAGE_KEY_PREFIX}posts`);
  }

  /**
   * Save user preferences
   */
  savePreferences(preferences: Record<string, any>): void {
    try {
      localStorage.setItem(
        `${this.STORAGE_KEY_PREFIX}preferences`,
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.warn('Failed to save preferences:', error);
    }
  }

  /**
   * Get user preferences
   */
  getPreferences(): Record<string, any> | null {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY_PREFIX}preferences`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if offline data is available
   */
  hasOfflineData(): boolean {
    return this.getPosts() !== null;
  }

  /**
   * Get offline data age in milliseconds
   */
  getDataAge(): number | null {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY_PREFIX}posts`);
      if (!stored) return null;

      const data = JSON.parse(stored);
      return Date.now() - data.savedAt;
    } catch {
      return null;
    }
  }
}

// Export singleton instances
export const postCache = new PostCacheService();
export const imageCache = new ImageCacheService();
export const offlineCache = new OfflineCacheService();

// Export classes for testing
export { LRUCache, PostCacheService, ImageCacheService, OfflineCacheService };
export type { CacheConfig, CacheEntry, PerformanceMetrics };
