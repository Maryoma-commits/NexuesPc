// Caching Service Tests for Community Posts
// Tests LRU cache, post cache, image cache, and offline cache functionality
// Requirements: Performance optimization and caching
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  LRUCache, 
  PostCacheService, 
  OfflineCacheService 
} from '../../../services/cacheService'
import { Post, PostPrivacy, ReactionType } from '../../../types/community-posts'

// Helper to create test posts
const createTestPost = (id: string, overrides?: Partial<Post>): Post => ({
  id,
  authorId: `author-${id}`,
  content: `Test content for post ${id}`,
  images: [],
  taggedProducts: [],
  privacy: 'public' as PostPrivacy,
  createdAt: Date.now(),
  likeCount: 0,
  commentCount: 0,
  reactionCounts: {},
  ...overrides
})

describe('LRU Cache', () => {
  let cache: LRUCache<string>

  beforeEach(() => {
    cache = new LRUCache<string>({ maxSize: 3, defaultTTL: 60000 })
  })

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('should delete values', () => {
      cache.set('key1', 'value1')
      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeNull()
    })

    it('should check if key exists', () => {
      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('should clear all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()
      expect(cache.size).toBe(0)
    })
  })

  describe('LRU Eviction', () => {
    it('should evict least recently used item when at capacity', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      
      // Access key1 to make it recently used
      cache.get('key1')
      
      // Add new item, should evict key2 (least recently used)
      cache.set('key4', 'value4')
      
      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBeNull()
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')
    })

    it('should not evict when updating existing key', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      
      // Update existing key
      cache.set('key1', 'updated')
      
      expect(cache.size).toBe(3)
      expect(cache.get('key1')).toBe('updated')
    })
  })

  describe('TTL Expiration', () => {
    it('should return null for expired entries', () => {
      // Create cache with very short TTL
      const shortTTLCache = new LRUCache<string>({ maxSize: 10, defaultTTL: 1 })
      shortTTLCache.set('key1', 'value1')
      
      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortTTLCache.get('key1')).toBeNull()
          resolve()
        }, 10)
      })
    })

    it('should respect custom TTL', () => {
      cache.set('key1', 'value1', 1) // 1ms TTL
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.get('key1')).toBeNull()
          resolve()
        }, 10)
      })
    })
  })

  describe('Pattern Invalidation', () => {
    it('should invalidate entries matching pattern', () => {
      cache.set('user:1:posts', 'data1')
      cache.set('user:2:posts', 'data2')
      cache.set('feed:main', 'data3')
      
      const count = cache.invalidatePattern(/^user:/)
      
      expect(count).toBe(2)
      expect(cache.get('user:1:posts')).toBeNull()
      expect(cache.get('user:2:posts')).toBeNull()
      expect(cache.get('feed:main')).toBe('data3')
    })
  })
})

describe('Post Cache Service', () => {
  let postCache: PostCacheService

  beforeEach(() => {
    postCache = new PostCacheService()
  })

  describe('Single Post Caching', () => {
    it('should cache and retrieve a single post', () => {
      const post = createTestPost('1')
      postCache.setPost(post)
      
      const cached = postCache.getPost('1')
      expect(cached).toEqual(post)
    })

    it('should return null for non-cached posts', () => {
      expect(postCache.getPost('nonexistent')).toBeNull()
    })

    it('should cache multiple posts', () => {
      const posts = [
        createTestPost('1'),
        createTestPost('2'),
        createTestPost('3')
      ]
      
      postCache.setPosts(posts)
      
      expect(postCache.getPost('1')).toEqual(posts[0])
      expect(postCache.getPost('2')).toEqual(posts[1])
      expect(postCache.getPost('3')).toEqual(posts[2])
    })
  })

  describe('Feed Caching', () => {
    it('should cache and retrieve feed', () => {
      const posts = [createTestPost('1'), createTestPost('2')]
      
      postCache.setFeed('user1', 'discover', 0, posts)
      
      const cached = postCache.getFeed('user1', 'discover', 0)
      expect(cached).toEqual(posts)
    })

    it('should return null for non-cached feeds', () => {
      expect(postCache.getFeed('user1', 'discover', 0)).toBeNull()
    })

    it('should cache feeds with different filters separately', () => {
      const posts1 = [createTestPost('1')]
      const posts2 = [createTestPost('2')]
      
      postCache.setFeed('user1', 'discover', 0, posts1, { postType: 'all' })
      postCache.setFeed('user1', 'discover', 0, posts2, { postType: 'product' })
      
      expect(postCache.getFeed('user1', 'discover', 0, { postType: 'all' })).toEqual(posts1)
      expect(postCache.getFeed('user1', 'discover', 0, { postType: 'product' })).toEqual(posts2)
    })
  })

  describe('Cache Invalidation', () => {
    it('should invalidate single post', () => {
      const post = createTestPost('1')
      postCache.setPost(post)
      
      postCache.invalidatePost('1')
      
      expect(postCache.getPost('1')).toBeNull()
    })

    it('should invalidate user feed', () => {
      const posts = [createTestPost('1')]
      postCache.setFeed('user1', 'discover', 0, posts)
      postCache.setFeed('user1', 'following', 0, posts)
      postCache.setFeed('user2', 'discover', 0, posts)
      
      postCache.invalidateUserFeed('user1')
      
      expect(postCache.getFeed('user1', 'discover', 0)).toBeNull()
      expect(postCache.getFeed('user1', 'following', 0)).toBeNull()
      expect(postCache.getFeed('user2', 'discover', 0)).toEqual(posts)
    })

    it('should invalidate all feeds', () => {
      const posts = [createTestPost('1')]
      postCache.setFeed('user1', 'discover', 0, posts)
      postCache.setFeed('user2', 'discover', 0, posts)
      
      postCache.invalidateAllFeeds()
      
      expect(postCache.getFeed('user1', 'discover', 0)).toBeNull()
      expect(postCache.getFeed('user2', 'discover', 0)).toBeNull()
    })
  })

  describe('Metrics', () => {
    it('should track cache hits and misses', () => {
      const post = createTestPost('1')
      postCache.setPost(post)
      
      // Hit
      postCache.getPost('1')
      // Miss
      postCache.getPost('nonexistent')
      
      const metrics = postCache.getMetrics()
      expect(metrics.cacheHits).toBe(1)
      expect(metrics.cacheMisses).toBe(1)
      expect(metrics.totalRequests).toBe(2)
    })

    it('should calculate hit rate correctly', () => {
      const post = createTestPost('1')
      postCache.setPost(post)
      
      // 2 hits
      postCache.getPost('1')
      postCache.getPost('1')
      // 1 miss
      postCache.getPost('nonexistent')
      
      expect(postCache.getHitRate()).toBeCloseTo(0.667, 2)
    })

    it('should record load times', () => {
      postCache.recordLoadTime(100)
      postCache.recordLoadTime(200)
      postCache.recordLoadTime(300)
      
      const metrics = postCache.getMetrics()
      expect(metrics.averageLoadTime).toBe(200)
    })
  })
})

describe('Offline Cache Service', () => {
  let offlineCache: OfflineCacheService

  beforeEach(() => {
    offlineCache = new OfflineCacheService()
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('Post Storage', () => {
    it('should save and retrieve posts', () => {
      const posts = [createTestPost('1'), createTestPost('2')]
      
      offlineCache.savePosts(posts)
      
      const retrieved = offlineCache.getPosts()
      expect(retrieved).toHaveLength(2)
      expect(retrieved![0].id).toBe('1')
      expect(retrieved![1].id).toBe('2')
    })

    it('should return null when no posts saved', () => {
      expect(offlineCache.getPosts()).toBeNull()
    })

    it('should clear posts', () => {
      const posts = [createTestPost('1')]
      offlineCache.savePosts(posts)
      
      offlineCache.clearPosts()
      
      expect(offlineCache.getPosts()).toBeNull()
    })

    it('should limit saved posts to max count', () => {
      const posts = Array.from({ length: 150 }, (_, i) => createTestPost(`${i}`))
      
      offlineCache.savePosts(posts)
      
      const retrieved = offlineCache.getPosts()
      expect(retrieved).toHaveLength(100) // MAX_OFFLINE_POSTS
    })
  })

  describe('Preferences Storage', () => {
    it('should save and retrieve preferences', () => {
      const prefs = { theme: 'dark', notifications: true }
      
      offlineCache.savePreferences(prefs)
      
      expect(offlineCache.getPreferences()).toEqual(prefs)
    })

    it('should return null when no preferences saved', () => {
      expect(offlineCache.getPreferences()).toBeNull()
    })
  })

  describe('Data Status', () => {
    it('should check if offline data exists', () => {
      expect(offlineCache.hasOfflineData()).toBe(false)
      
      offlineCache.savePosts([createTestPost('1')])
      
      expect(offlineCache.hasOfflineData()).toBe(true)
    })

    it('should return data age', () => {
      offlineCache.savePosts([createTestPost('1')])
      
      const age = offlineCache.getDataAge()
      expect(age).toBeGreaterThanOrEqual(0)
      expect(age).toBeLessThan(1000) // Should be very recent
    })

    it('should return null for data age when no data', () => {
      expect(offlineCache.getDataAge()).toBeNull()
    })
  })
})
