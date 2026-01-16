// Feature: community-posts, Property 6: Post Display Completeness
// **Validates: Requirements 2.2, 2.7**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { PostDisplayLogic } from '../../../utils/postDisplayUtils'
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

const validPostGenerator = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  authorId: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.string({ minLength: 0, maxLength: 5000 }),
  images: fc.array(fc.webUrl(), { maxLength: 10 }),
  taggedProducts: fc.array(productReferenceGenerator, { maxLength: 20 }),
  privacy: postPrivacyGenerator,
  createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: Date.now() })),
  likeCount: fc.integer({ min: 0, max: 1000000 }),
  commentCount: fc.integer({ min: 0, max: 1000000 }),
  reactionCounts: reactionCountsGenerator
})

describe('Post Display Completeness - Property 6', () => {
  describe('Requirement 2.2: Display author avatar, name, timestamp, and content', () => {
    it('should validate all required display fields are present for any valid post', () => {
      fc.assert(
        fc.property(validPostGenerator, (post) => {
          const validation = PostDisplayLogic.validatePostDisplayFields(post)
          
          // All required fields should be present
          expect(validation.hasAuthorId).toBe(true)
          expect(validation.hasTimestamp).toBe(true)
          expect(validation.hasContent).toBe(true)
          expect(validation.hasEngagementMetrics).toBe(true)
          expect(validation.isComplete).toBe(true)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should detect missing authorId', () => {
      fc.assert(
        fc.property(
          validPostGenerator.map(post => ({ ...post, authorId: '' })),
          (post) => {
            const validation = PostDisplayLogic.validatePostDisplayFields(post)
            
            expect(validation.hasAuthorId).toBe(false)
            expect(validation.isComplete).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should detect missing timestamp', () => {
      fc.assert(
        fc.property(
          validPostGenerator.map(post => ({ ...post, createdAt: 0 })),
          (post) => {
            const validation = PostDisplayLogic.validatePostDisplayFields(post)
            
            expect(validation.hasTimestamp).toBe(false)
            expect(validation.isComplete).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Requirement 2.7: Show engagement metrics (like count, comment count)', () => {
    it('should calculate total engagement correctly for any post', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          reactionCountsGenerator,
          (likeCount, reactionCounts) => {
            const total = PostDisplayLogic.calculateTotalEngagement(likeCount, reactionCounts)
            
            // Total should be sum of likes and all reactions
            const expectedReactionTotal = Object.values(reactionCounts)
              .reduce((sum, count) => sum + (count || 0), 0)
            
            expect(total).toBe(likeCount + expectedReactionTotal)
            expect(total).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should get top reactions sorted by count', () => {
      fc.assert(
        fc.property(reactionCountsGenerator, (reactionCounts) => {
          const topReactions = PostDisplayLogic.getTopReactions(reactionCounts, 3)
          
          // Should return at most 3 reactions
          expect(topReactions.length).toBeLessThanOrEqual(3)
          
          // All returned reactions should have count > 0
          for (const type of topReactions) {
            expect(reactionCounts[type]).toBeGreaterThan(0)
          }
          
          // Should be sorted by count (descending)
          for (let i = 1; i < topReactions.length; i++) {
            const prevCount = reactionCounts[topReactions[i - 1]] || 0
            const currCount = reactionCounts[topReactions[i]] || 0
            expect(prevCount).toBeGreaterThanOrEqual(currCount)
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should return empty array when no reactions exist', () => {
      const emptyReactions: Partial<Record<ReactionType, number>> = {}
      const topReactions = PostDisplayLogic.getTopReactions(emptyReactions)
      
      expect(topReactions).toEqual([])
    })
  })

  describe('Timestamp Formatting', () => {
    it('should format recent timestamps as relative time', () => {
      const now = Date.now()
      
      // Just now (< 60 seconds)
      expect(PostDisplayLogic.formatTimestamp(now - 30000)).toBe('Just now')
      
      // Minutes ago
      expect(PostDisplayLogic.formatTimestamp(now - 5 * 60 * 1000)).toBe('5m ago')
      
      // Hours ago
      expect(PostDisplayLogic.formatTimestamp(now - 3 * 60 * 60 * 1000)).toBe('3h ago')
      
      // Days ago
      expect(PostDisplayLogic.formatTimestamp(now - 2 * 24 * 60 * 60 * 1000)).toBe('2d ago')
    })

    it('should format any valid timestamp without throwing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000000000000, max: Date.now() }),
          (timestamp) => {
            const formatted = PostDisplayLogic.formatTimestamp(timestamp)
            
            // Should return a non-empty string
            expect(formatted).toBeDefined()
            expect(formatted.length).toBeGreaterThan(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Engagement Metrics Invariants', () => {
    it('should maintain non-negative engagement counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          reactionCountsGenerator,
          (likeCount, reactionCounts) => {
            const total = PostDisplayLogic.calculateTotalEngagement(likeCount, reactionCounts)
            
            expect(total).toBeGreaterThanOrEqual(0)
            expect(likeCount).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
