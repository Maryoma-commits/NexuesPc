// Performance Tests for Community Posts
// Tests feed loading, image handling, and real-time update performance
// Requirements: Performance and scalability validation
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { FeedLogic } from '../../../utils/feedUtils'
import { Post, PostPrivacy, ReactionType, ProductReference } from '../../../types/community-posts'

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  FEED_SORT_LARGE_DATASET: 100, // 100ms for sorting 1000 posts
  FEED_PAGINATION: 50, // 50ms for pagination
  FEED_MERGE: 100, // 100ms for merging posts
  CACHE_LOOKUP: 10, // 10ms for cache lookup
  IMAGE_VALIDATION: 50, // 50ms for validating images
}

// Generators for test data
const postPrivacyGenerator = fc.constantFrom<PostPrivacy>('public', 'friends', 'private')

const reactionCountsGenerator = fc.record({
  like: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  love: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  wow: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  helpful: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  inspiring: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined })
}).map(counts => {
  const result: Partial<Record<ReactionType, number>> = {}
  for (const [key, value] of Object.entries(counts)) {
    if (value !== undefined) {
      result[key as ReactionType] = value
    }
  }
  return result
})

const productReferenceGenerator = fc.record({
  productId: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  imageUrl: fc.webUrl(),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  retailer: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.string({ minLength: 1, maxLength: 50 })
})

const validPostGenerator = fc.record({
  id: fc.uuid(),
  authorId: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.string({ minLength: 0, maxLength: 5000 }),
  images: fc.array(fc.webUrl(), { maxLength: 10 }),
  taggedProducts: fc.array(productReferenceGenerator, { maxLength: 5 }),
  privacy: postPrivacyGenerator,
  createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: Date.now() })),
  likeCount: fc.integer({ min: 0, max: 1000000 }),
  commentCount: fc.integer({ min: 0, max: 1000000 }),
  reactionCounts: reactionCountsGenerator
})

// Generate large dataset for performance testing
const generateLargePostsArray = (count: number): Post[] => {
  const posts: Post[] = []
  const baseTime = Date.now()
  
  for (let i = 0; i < count; i++) {
    posts.push({
      id: `post-${i}`,
      authorId: `author-${i % 100}`,
      content: `Test content for post ${i}. `.repeat(10),
      images: i % 3 === 0 ? [`https://example.com/image${i}.jpg`] : [],
      taggedProducts: i % 5 === 0 ? [{
        productId: `product-${i}`,
        title: `Product ${i}`,
        imageUrl: `https://example.com/product${i}.jpg`,
        price: 100 + i,
        retailer: 'TestRetailer',
        category: 'TestCategory'
      }] : [],
      privacy: 'public',
      createdAt: baseTime - (i * 1000), // Each post 1 second apart
      likeCount: Math.floor(Math.random() * 1000),
      commentCount: Math.floor(Math.random() * 100),
      reactionCounts: {}
    })
  }
  
  return posts
}

// Helper to measure execution time
const measureTime = async <T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  return { result, duration }
}

describe('Performance Tests - Feed Loading with Large Datasets', () => {
  describe('Feed Sorting Performance', () => {
    it('should sort 1000 posts within acceptable time', async () => {
      const posts = generateLargePostsArray(1000)
      // Shuffle the posts to simulate unsorted data
      const shuffled = [...posts].sort(() => Math.random() - 0.5)
      
      const { result, duration } = await measureTime(() => 
        FeedLogic.sortByChronological(shuffled)
      )
      
      expect(result.length).toBe(1000)
      expect(FeedLogic.isChronologicallySorted(result)).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_SORT_LARGE_DATASET)
    })

    it('should sort 500 posts within acceptable time consistently', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          (count) => {
            const posts = generateLargePostsArray(count)
            const shuffled = [...posts].sort(() => Math.random() - 0.5)
            
            const start = performance.now()
            const sorted = FeedLogic.sortByChronological(shuffled)
            const duration = performance.now() - start
            
            expect(sorted.length).toBe(count)
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_SORT_LARGE_DATASET)
            
            return true
          }
        ),
        { numRuns: 10 } // Fewer runs for performance tests
      )
    })
  })

  describe('Feed Pagination Performance', () => {
    it('should paginate 1000 posts within acceptable time', async () => {
      const posts = generateLargePostsArray(1000)
      
      const { result, duration } = await measureTime(() => 
        FeedLogic.paginatePosts(posts, 0, 20)
      )
      
      expect(result.posts.length).toBe(20)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_PAGINATION)
    })

    it('should handle multiple page requests efficiently', async () => {
      const posts = generateLargePostsArray(1000)
      const pageRequests = 10
      
      const start = performance.now()
      for (let page = 0; page < pageRequests; page++) {
        FeedLogic.paginatePosts(posts, page, 20)
      }
      const totalDuration = performance.now() - start
      
      // Average time per page should be acceptable
      const avgDuration = totalDuration / pageRequests
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_PAGINATION)
    })

    it('should handle infinite scroll accumulation efficiently', async () => {
      const posts = generateLargePostsArray(500)
      
      const { result, duration } = await measureTime(() => 
        FeedLogic.getPostsForInfiniteScroll(posts, 10, 20)
      )
      
      expect(result.loadedCount).toBe(220) // 11 pages * 20 posts
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_PAGINATION)
    })
  })

  describe('Feed Merge Performance (Real-time Updates)', () => {
    it('should merge new posts with existing feed efficiently', async () => {
      const existingPosts = generateLargePostsArray(500)
      const newPosts = generateLargePostsArray(50).map((p, i) => ({
        ...p,
        id: `new-post-${i}`,
        createdAt: Date.now() + i
      }))
      
      const { result, duration } = await measureTime(() => 
        FeedLogic.mergeNewPosts(existingPosts, newPosts)
      )
      
      expect(result.length).toBe(550)
      expect(FeedLogic.isChronologicallySorted(result)).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_MERGE)
    })

    it('should handle frequent real-time updates efficiently', async () => {
      let currentPosts = generateLargePostsArray(200)
      const updateCount = 20
      
      const start = performance.now()
      for (let i = 0; i < updateCount; i++) {
        const newPost: Post = {
          id: `realtime-${i}`,
          authorId: `author-${i}`,
          content: `Real-time update ${i}`,
          images: [],
          taggedProducts: [],
          privacy: 'public',
          createdAt: Date.now() + i,
          likeCount: 0,
          commentCount: 0,
          reactionCounts: {}
        }
        currentPosts = FeedLogic.mergeNewPosts(currentPosts, [newPost])
      }
      const totalDuration = performance.now() - start
      
      expect(currentPosts.length).toBe(220)
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_MERGE * 2)
    })
  })
})

describe('Performance Tests - Image Handling', () => {
  describe('Image URL Validation Performance', () => {
    it('should validate image URLs efficiently', async () => {
      const imageUrls = Array.from({ length: 100 }, (_, i) => 
        `https://example.com/image${i}.jpg`
      )
      
      const { duration } = await measureTime(() => {
        return imageUrls.map(url => {
          return url && url.length > 0 && url.startsWith('http')
        })
      })
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.IMAGE_VALIDATION)
    })

    it('should handle posts with many images efficiently', () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
          (images) => {
            const start = performance.now()
            
            // Simulate image validation logic
            const validImages = images.filter(url => 
              url && url.length > 0 && url.startsWith('http')
            )
            
            const duration = performance.now() - start
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.IMAGE_VALIDATION)
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Image Grid Layout Calculation Performance', () => {
    it('should calculate grid layouts efficiently for various image counts', async () => {
      const imageCounts = [0, 1, 2, 3, 4, 5, 10, 20]
      
      const { duration } = await measureTime(() => {
        return imageCounts.map(count => {
          // Simulate grid layout calculation
          if (count === 0) return { columns: 0, rows: 0 }
          if (count === 1) return { columns: 1, rows: 1 }
          if (count === 2) return { columns: 2, rows: 1 }
          if (count <= 4) return { columns: 2, rows: 2 }
          return { columns: 2, rows: Math.ceil(count / 2) }
        })
      })
      
      expect(duration).toBeLessThan(10) // Should be very fast
    })
  })
})

describe('Performance Tests - Caching Utilities', () => {
  describe('Cache Key Generation', () => {
    it('should generate cache keys efficiently', async () => {
      const testCases = Array.from({ length: 1000 }, (_, i) => ({
        userId: `user-${i}`,
        feedType: 'discover',
        page: i % 10
      }))
      
      const { duration } = await measureTime(() => {
        return testCases.map(tc => 
          `feed:${tc.userId}:${tc.feedType}:${tc.page}`
        )
      })
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_LOOKUP)
    })
  })

  describe('Cache Hit/Miss Simulation', () => {
    it('should handle cache lookups efficiently', async () => {
      // Simulate a simple cache
      const cache = new Map<string, Post[]>()
      const posts = generateLargePostsArray(100)
      
      // Pre-populate cache
      for (let i = 0; i < 50; i++) {
        cache.set(`feed:user-${i}:discover:0`, posts.slice(0, 20))
      }
      
      const { duration } = await measureTime(() => {
        const results: (Post[] | undefined)[] = []
        for (let i = 0; i < 100; i++) {
          const key = `feed:user-${i}:discover:0`
          results.push(cache.get(key))
        }
        return results
      })
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_LOOKUP)
    })
  })
})

describe('Performance Tests - Filter Operations', () => {
  describe('Post Filtering Performance', () => {
    it('should filter posts by type efficiently', async () => {
      const posts = generateLargePostsArray(1000)
      
      const { result, duration } = await measureTime(() => 
        FeedLogic.filterPosts(posts, { postType: 'product' })
      )
      
      // Should filter correctly
      expect(result.every(p => p.taggedProducts.length > 0)).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_PAGINATION)
    })

    it('should filter posts by time range efficiently', async () => {
      const posts = generateLargePostsArray(1000)
      
      const { result, duration } = await measureTime(() => 
        FeedLogic.filterPosts(posts, { timeRange: 'day' })
      )
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_PAGINATION)
    })

    it('should apply multiple filters efficiently', async () => {
      const posts = generateLargePostsArray(1000)
      
      const { duration } = await measureTime(() => 
        FeedLogic.filterPosts(posts, { 
          postType: 'media',
          timeRange: 'week'
        })
      )
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_PAGINATION)
    })
  })
})

describe('Performance Tests - Memory Efficiency', () => {
  describe('Large Dataset Memory Handling', () => {
    it('should not create excessive copies when sorting', () => {
      const posts = generateLargePostsArray(500)
      const originalLength = posts.length
      
      // Sort should create only one copy
      const sorted = FeedLogic.sortByChronological(posts)
      
      // Original should be unchanged
      expect(posts.length).toBe(originalLength)
      expect(sorted.length).toBe(originalLength)
      
      // Sorted should be a different array
      expect(sorted).not.toBe(posts)
    })

    it('should handle pagination without copying entire dataset', () => {
      const posts = generateLargePostsArray(1000)
      
      // Pagination should only return requested slice
      const page0 = FeedLogic.paginatePosts(posts, 0, 20)
      const page1 = FeedLogic.paginatePosts(posts, 1, 20)
      
      expect(page0.posts.length).toBe(20)
      expect(page1.posts.length).toBe(20)
      
      // Pages should have different posts
      expect(page0.posts[0].id).not.toBe(page1.posts[0].id)
    })
  })
})

describe('Performance Tests - Skeleton Loading', () => {
  describe('Skeleton Count Calculation', () => {
    it('should calculate skeleton count efficiently', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (expectedCount) => {
            const start = performance.now()
            const count = FeedLogic.calculateSkeletonCount(expectedCount)
            const duration = performance.now() - start
            
            expect(count).toBeLessThanOrEqual(20)
            expect(count).toBeGreaterThanOrEqual(0)
            expect(duration).toBeLessThan(1) // Should be instant
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Loading State Determination', () => {
    it('should determine loading state efficiently', () => {
      const posts = generateLargePostsArray(100)
      
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        FeedLogic.shouldShowSkeleton(i % 2 === 0, posts)
        FeedLogic.shouldShowLoadMore(i % 2 === 0, i % 3 === 0)
      }
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(10) // Should be very fast
    })
  })
})

describe('Performance Tests - New Post Detection', () => {
  describe('New Post Counting Performance', () => {
    it('should count new posts efficiently', async () => {
      const posts = generateLargePostsArray(1000)
      const lastViewedTimestamp = Date.now() - 60000 // 1 minute ago
      
      const { result, duration } = await measureTime(() => 
        FeedLogic.countNewPosts(posts, lastViewedTimestamp)
      )
      
      expect(typeof result).toBe('number')
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_PAGINATION)
    })

    it('should check individual post newness efficiently', () => {
      const posts = generateLargePostsArray(500)
      const lastViewedTimestamp = Date.now() - 60000
      
      const start = performance.now()
      posts.forEach(post => {
        FeedLogic.isNewPost(post, lastViewedTimestamp)
      })
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FEED_PAGINATION)
    })
  })
})
