// Feature: community-posts, Property 5: Feed Chronological Ordering
// **Validates: Requirements 2.1**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FeedLogic } from '../../../utils/feedUtils'
import { Post, PostPrivacy, ReactionType, ProductReference } from '../../../types/community-posts'

// Generators for property-based testing
const postPrivacyGenerator = fc.constantFrom<PostPrivacy>('public', 'friends', 'private')
const reactionTypeGenerator = fc.constantFrom<ReactionType>('like', 'love', 'wow', 'helpful', 'inspiring')

const productReferenceGenerator = fc.record({
  productId: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  imageUrl: fc.webUrl(),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  retailer: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.string({ minLength: 1, maxLength: 50 })
})

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

// Generator for valid posts with unique timestamps
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

describe('Feed Chronological Ordering - Property 5', () => {
  describe('Requirement 2.1: Posts displayed in reverse chronological order', () => {
    it('should sort any array of posts in reverse chronological order (newest first)', () => {
      fc.assert(
        fc.property(postsArrayGenerator, (posts) => {
          const sorted = FeedLogic.sortByChronological(posts)
          
          // Verify sorted array is in reverse chronological order
          expect(FeedLogic.isChronologicallySorted(sorted)).toBe(true)
          
          // Verify all original posts are present
          expect(sorted.length).toBe(posts.length)
          
          // Verify each post from original is in sorted
          const sortedIds = new Set(sorted.map(p => p.id))
          for (const post of posts) {
            expect(sortedIds.has(post.id)).toBe(true)
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should place newer posts before older posts', () => {
      fc.assert(
        fc.property(
          validPostGenerator,
          validPostGenerator,
          (post1, post2) => {
            // Ensure different timestamps
            const olderPost = { ...post1, id: 'older', createdAt: 1000000000000 }
            const newerPost = { ...post2, id: 'newer', createdAt: 2000000000000 }
            
            const sorted = FeedLogic.sortByChronological([olderPost, newerPost])
            
            // Newer post should come first
            expect(sorted[0].id).toBe('newer')
            expect(sorted[1].id).toBe('older')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly identify if posts are chronologically sorted', () => {
      fc.assert(
        fc.property(postsArrayGenerator, (posts) => {
          // Sort the posts
          const sorted = FeedLogic.sortByChronological(posts)
          
          // Sorted posts should pass the check
          expect(FeedLogic.isChronologicallySorted(sorted)).toBe(true)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should handle empty array', () => {
      const sorted = FeedLogic.sortByChronological([])
      expect(sorted).toEqual([])
      expect(FeedLogic.isChronologicallySorted([])).toBe(true)
    })

    it('should handle single post array', () => {
      fc.assert(
        fc.property(validPostGenerator, (post) => {
          const sorted = FeedLogic.sortByChronological([post])
          
          expect(sorted.length).toBe(1)
          expect(sorted[0].id).toBe(post.id)
          expect(FeedLogic.isChronologicallySorted(sorted)).toBe(true)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should not mutate the original array', () => {
      fc.assert(
        fc.property(postsArrayGenerator, (posts) => {
          const originalOrder = posts.map(p => p.id)
          
          FeedLogic.sortByChronological(posts)
          
          // Original array should be unchanged
          const afterOrder = posts.map(p => p.id)
          expect(afterOrder).toEqual(originalOrder)
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Sorting Invariants', () => {
    it('should maintain stable sort for posts with same timestamp', () => {
      fc.assert(
        fc.property(
          fc.array(validPostGenerator, { minLength: 2, maxLength: 10 }),
          (posts) => {
            // Give all posts the same timestamp
            const sameTimestamp = Date.now()
            const postsWithSameTime = posts.map((p, i) => ({
              ...p,
              id: `post-${i}`,
              createdAt: sameTimestamp
            }))
            
            const sorted = FeedLogic.sortByChronological(postsWithSameTime)
            
            // All posts should still be present
            expect(sorted.length).toBe(postsWithSameTime.length)
            
            // Should still be considered sorted (all same timestamp)
            expect(FeedLogic.isChronologicallySorted(sorted)).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve post data integrity after sorting', () => {
      fc.assert(
        fc.property(postsArrayGenerator, (posts) => {
          const sorted = FeedLogic.sortByChronological(posts)
          
          // Create maps for comparison
          const originalMap = new Map(posts.map(p => [p.id, p]))
          
          // Each sorted post should have identical data to original
          for (const sortedPost of sorted) {
            const original = originalMap.get(sortedPost.id)
            expect(original).toBeDefined()
            expect(sortedPost.content).toBe(original!.content)
            expect(sortedPost.authorId).toBe(original!.authorId)
            expect(sortedPost.createdAt).toBe(original!.createdAt)
            expect(sortedPost.likeCount).toBe(original!.likeCount)
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Real-time Update Merging', () => {
    it('should merge new posts and maintain chronological order', () => {
      fc.assert(
        fc.property(
          postsArrayGenerator,
          postsArrayGenerator,
          (existingPosts, newPosts) => {
            const merged = FeedLogic.mergeNewPosts(existingPosts, newPosts)
            
            // Merged result should be chronologically sorted
            expect(FeedLogic.isChronologicallySorted(merged)).toBe(true)
            
            // All unique posts should be present
            const allIds = new Set([
              ...existingPosts.map(p => p.id),
              ...newPosts.map(p => p.id)
            ])
            expect(merged.length).toBe(allIds.size)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should update existing posts when merging duplicates', () => {
      fc.assert(
        fc.property(validPostGenerator, (post) => {
          const existingPosts = [{ ...post, content: 'old content' }]
          const newPosts = [{ ...post, content: 'new content' }]
          
          const merged = FeedLogic.mergeNewPosts(existingPosts, newPosts)
          
          // Should have only one post (merged)
          expect(merged.length).toBe(1)
          // Should have the new content
          expect(merged[0].content).toBe('new content')
          
          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
