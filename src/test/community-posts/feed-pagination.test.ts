// Feature: community-posts, Property 8: Feed Pagination Behavior
// **Validates: Requirements 2.5**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FeedLogic } from '../../../utils/feedUtils'
import { Post, PostPrivacy, ReactionType } from '../../../types/community-posts'

// Generators for property-based testing
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

// Generator for valid posts
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

// Generator for array of posts with unique IDs
const postsArrayGenerator = fc.array(validPostGenerator, { minLength: 0, maxLength: 100 })
  .map(posts => {
    // Ensure unique IDs
    const seen = new Set<string>()
    return posts.filter(post => {
      if (seen.has(post.id)) return false
      seen.add(post.id)
      return true
    })
  })

// Generator for page numbers
const pageNumberGenerator = fc.integer({ min: 0, max: 10 })

// Generator for page sizes (default is 20 per requirement 2.5)
const pageSizeGenerator = fc.integer({ min: 1, max: 50 })

describe('Feed Pagination Behavior - Property 8', () => {
  describe('Requirement 2.5: Infinite scroll loading 20 posts at a time', () => {
    it('should return exactly 20 posts per page when enough posts exist', () => {
      fc.assert(
        fc.property(
          fc.array(validPostGenerator, { minLength: 50, maxLength: 100 })
            .map(posts => {
              const seen = new Set<string>()
              return posts.filter(post => {
                if (seen.has(post.id)) return false
                seen.add(post.id)
                return true
              })
            }),
          pageNumberGenerator,
          (posts, page) => {
            // Only test if we have enough posts for the page
            if (posts.length <= page * 20) return true
            
            const result = FeedLogic.paginatePosts(posts, page, 20)
            
            // Should return exactly 20 posts if there are enough
            if (posts.length >= (page + 1) * 20) {
              expect(result.posts.length).toBe(20)
            } else {
              // Otherwise return remaining posts
              expect(result.posts.length).toBe(posts.length - page * 20)
            }
            
            return true
          }
        ),
        { numRuns: 50 }
      )
    }, 10000)

    it('should correctly indicate hasMore when more posts exist', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          pageNumberGenerator,
          pageSizeGenerator,
          (posts, page, pageSize) => {
            const result = FeedLogic.paginatePosts(posts, page, pageSize)
            
            const endIndex = (page + 1) * pageSize
            const expectedHasMore = endIndex < posts.length
            
            expect(result.hasMore).toBe(expectedHasMore)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should calculate total pages correctly', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          pageSizeGenerator,
          (posts, pageSize) => {
            const result = FeedLogic.paginatePosts(posts, 0, pageSize)
            
            const expectedTotalPages = Math.ceil(posts.length / pageSize)
            
            expect(result.totalPages).toBe(expectedTotalPages)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return correct current page', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          pageNumberGenerator,
          (posts, page) => {
            const result = FeedLogic.paginatePosts(posts, page, 20)
            
            expect(result.currentPage).toBe(page)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Infinite Scroll Accumulation', () => {
    it('should accumulate posts correctly for infinite scroll', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          pageNumberGenerator,
          (posts, page) => {
            const result = FeedLogic.getPostsForInfiniteScroll(posts, page, 20)
            
            // Should return all posts up to (page + 1) * pageSize
            const expectedCount = Math.min(posts.length, (page + 1) * 20)
            
            expect(result.loadedCount).toBe(expectedCount)
            expect(result.posts.length).toBe(expectedCount)
            expect(result.totalCount).toBe(posts.length)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly indicate hasMore for infinite scroll', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          pageNumberGenerator,
          (posts, page) => {
            const result = FeedLogic.getPostsForInfiniteScroll(posts, page, 20)
            
            const endIndex = (page + 1) * 20
            const expectedHasMore = endIndex < posts.length
            
            expect(result.hasMore).toBe(expectedHasMore)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should include all posts from previous pages', () => {
      fc.assert(
        fc.property(
          fc.array(validPostGenerator, { minLength: 50, maxLength: 100 })
            .map(posts => {
              const seen = new Set<string>()
              return posts.filter(post => {
                if (seen.has(post.id)) return false
                seen.add(post.id)
                return true
              })
            }),
          fc.integer({ min: 1, max: 3 }),
          (posts, page) => {
            const result = FeedLogic.getPostsForInfiniteScroll(posts, page, 20)
            
            // All posts from page 0 should be included
            const page0Posts = posts.slice(0, 20)
            for (const post of page0Posts) {
              const found = result.posts.find(p => p.id === post.id)
              expect(found).toBeDefined()
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Pagination Edge Cases', () => {
    it('should handle empty posts array', () => {
      const result = FeedLogic.paginatePosts([], 0, 20)
      
      expect(result.posts).toEqual([])
      expect(result.hasMore).toBe(false)
      expect(result.totalPages).toBe(0)
      expect(result.currentPage).toBe(0)
    })

    it('should handle page beyond available posts', () => {
      fc.assert(
        fc.property(
          fc.array(validPostGenerator, { minLength: 1, maxLength: 20 })
            .map(posts => {
              const seen = new Set<string>()
              return posts.filter(post => {
                if (seen.has(post.id)) return false
                seen.add(post.id)
                return true
              })
            }),
          (posts) => {
            // Request page 10 when we have less than 200 posts
            const result = FeedLogic.paginatePosts(posts, 10, 20)
            
            expect(result.posts).toEqual([])
            expect(result.hasMore).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle last page with fewer than pageSize posts', () => {
      fc.assert(
        fc.property(
          fc.array(validPostGenerator, { minLength: 21, maxLength: 39 })
            .map(posts => {
              const seen = new Set<string>()
              return posts.filter(post => {
                if (seen.has(post.id)) return false
                seen.add(post.id)
                return true
              })
            }),
          (posts) => {
            // Get second page (should have fewer than 20 posts)
            const result = FeedLogic.paginatePosts(posts, 1, 20)
            
            const expectedCount = posts.length - 20
            expect(result.posts.length).toBe(expectedCount)
            expect(result.hasMore).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Pagination Parameter Validation', () => {
    it('should validate pagination parameters correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10, max: 100 }),
          fc.integer({ min: -10, max: 200 }),
          (page, pageSize) => {
            const result = FeedLogic.validatePaginationParams(page, pageSize)
            
            // Page should be non-negative
            expect(result.page).toBeGreaterThanOrEqual(0)
            
            // Page size should be between 1 and 100
            expect(result.pageSize).toBeGreaterThanOrEqual(1)
            expect(result.pageSize).toBeLessThanOrEqual(100)
            
            // isValid should be true only for valid inputs
            const expectedValid = page >= 0 && pageSize > 0 && pageSize <= 100
            expect(result.isValid).toBe(expectedValid)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should clamp negative page numbers to 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: -1 }),
          (negativePage) => {
            const result = FeedLogic.validatePaginationParams(negativePage, 20)
            
            expect(result.page).toBe(0)
            expect(result.isValid).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should clamp page size to valid range', () => {
      // Test too small
      const tooSmall = FeedLogic.validatePaginationParams(0, 0)
      expect(tooSmall.pageSize).toBe(1)
      
      // Test too large
      const tooLarge = FeedLogic.validatePaginationParams(0, 200)
      expect(tooLarge.pageSize).toBe(100)
    })
  })

  describe('Pagination Invariants', () => {
    it('should never return more posts than pageSize', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          pageNumberGenerator,
          pageSizeGenerator,
          (posts, page, pageSize) => {
            const result = FeedLogic.paginatePosts(posts, page, pageSize)
            
            expect(result.posts.length).toBeLessThanOrEqual(pageSize)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return posts in same order as input (no reordering)', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          pageNumberGenerator,
          (posts, page) => {
            const result = FeedLogic.paginatePosts(posts, page, 20)
            
            const startIndex = page * 20
            const expectedPosts = posts.slice(startIndex, startIndex + 20)
            
            // Posts should be in same order
            for (let i = 0; i < result.posts.length; i++) {
              expect(result.posts[i].id).toBe(expectedPosts[i].id)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should cover all posts when iterating through all pages', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          pageSizeGenerator,
          (posts, pageSize) => {
            const allPaginatedPosts: Post[] = []
            let page = 0
            let hasMore = true
            
            while (hasMore && page < 100) { // Safety limit
              const result = FeedLogic.paginatePosts(posts, page, pageSize)
              allPaginatedPosts.push(...result.posts)
              hasMore = result.hasMore
              page++
            }
            
            // Should have all posts
            expect(allPaginatedPosts.length).toBe(posts.length)
            
            // All original posts should be present
            const paginatedIds = new Set(allPaginatedPosts.map(p => p.id))
            for (const post of posts) {
              expect(paginatedIds.has(post.id)).toBe(true)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
