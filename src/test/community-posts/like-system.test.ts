// Feature: community-posts, Property 9: Like System Consistency
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { LikeSystemLogic } from '../../../services/engagementService'

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const likeCountGenerator = fc.integer({ min: 0, max: 1000000 })

describe('Like System Consistency - Property 9', () => {
  describe('Requirement 3.1: Toggle like status', () => {
    it('should toggle like status correctly for any user-post combination', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // userHasLiked
          (userHasLiked) => {
            const result = LikeSystemLogic.determineLikeAction(userHasLiked)
            
            // If user has liked, action should be to unlike (shouldLike = false)
            // If user hasn't liked, action should be to like (shouldLike = true)
            expect(result.shouldLike).toBe(!userHasLiked)
            expect(result.newLikedState).toBe(!userHasLiked)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Requirement 3.2: Increment like count when liking', () => {
    it('should increment like count by exactly 1 when liking', () => {
      fc.assert(
        fc.property(
          likeCountGenerator,
          (currentCount) => {
            const newCount = LikeSystemLogic.calculateLikeCount(currentCount, true)
            
            // Like count should increase by exactly 1
            expect(newCount).toBe(currentCount + 1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Requirement 3.3: Decrement like count when unliking', () => {
    it('should decrement like count by exactly 1 when unliking (never below 0)', () => {
      fc.assert(
        fc.property(
          likeCountGenerator,
          (currentCount) => {
            const newCount = LikeSystemLogic.calculateLikeCount(currentCount, false)
            
            // Like count should decrease by 1, but never go below 0
            expect(newCount).toBe(Math.max(0, currentCount - 1))
            expect(newCount).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle edge case of unliking when count is 0', () => {
      const newCount = LikeSystemLogic.calculateLikeCount(0, false)
      expect(newCount).toBe(0)
    })
  })

  describe('Requirement 3.4: Prevent users from liking their own posts', () => {
    it('should prevent any user from liking their own post', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          (userId) => {
            // When post author and user are the same
            const canLike = LikeSystemLogic.canUserLikePost(userId, userId)
            
            // User should NOT be able to like their own post
            expect(canLike).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow any user to like posts by other users', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator.filter(id => id.length > 0),
          (authorId, userId) => {
            // Skip if same user (covered by previous test)
            if (authorId === userId) return true
            
            const canLike = LikeSystemLogic.canUserLikePost(authorId, userId)
            
            // User should be able to like other users' posts
            expect(canLike).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Like/Unlike Round Trip', () => {
    it('should return to original count after like then unlike', () => {
      fc.assert(
        fc.property(
          likeCountGenerator,
          (originalCount) => {
            // Like the post
            const afterLike = LikeSystemLogic.calculateLikeCount(originalCount, true)
            
            // Unlike the post
            const afterUnlike = LikeSystemLogic.calculateLikeCount(afterLike, false)
            
            // Should return to original count
            expect(afterUnlike).toBe(originalCount)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Like Count Invariants', () => {
    it('should maintain non-negative like count invariant', () => {
      fc.assert(
        fc.property(
          likeCountGenerator,
          fc.boolean(),
          (currentCount, isLiking) => {
            const newCount = LikeSystemLogic.calculateLikeCount(currentCount, isLiking)
            
            // Like count should never be negative
            expect(newCount).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should change count by at most 1 per operation', () => {
      fc.assert(
        fc.property(
          likeCountGenerator,
          fc.boolean(),
          (currentCount, isLiking) => {
            const newCount = LikeSystemLogic.calculateLikeCount(currentCount, isLiking)
            
            // Change should be at most 1
            const change = Math.abs(newCount - currentCount)
            expect(change).toBeLessThanOrEqual(1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Idempotence Properties', () => {
    it('should be idempotent for consecutive likes (toggle behavior)', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (initialLikedState) => {
            // First toggle
            const afterFirst = LikeSystemLogic.determineLikeAction(initialLikedState)
            
            // Second toggle (using result of first)
            const afterSecond = LikeSystemLogic.determineLikeAction(afterFirst.newLikedState)
            
            // After two toggles, should return to original state
            expect(afterSecond.newLikedState).toBe(initialLikedState)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
