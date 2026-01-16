// Feature: community-posts, Property 21: Follow System Integrity
// **Validates: Requirements 7.2**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FollowSystemLogic } from '../../../services/followService'

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
const countGenerator = fc.integer({ min: 0, max: 1000000 })
const timestampGenerator = fc.integer({ min: 1, max: Date.now() + 1000000 })

describe('Follow System Integrity - Property 21', () => {
  describe('Requirement 7.2: Follow/unfollow updates follower lists correctly', () => {
    it('should toggle follow state correctly for any user combination', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isCurrentlyFollowing
          (isCurrentlyFollowing) => {
            const result = FollowSystemLogic.determineFollowAction(isCurrentlyFollowing)
            
            // If currently following, action should be to unfollow
            // If not following, action should be to follow
            expect(result.shouldFollow).toBe(!isCurrentlyFollowing)
            expect(result.newFollowingState).toBe(!isCurrentlyFollowing)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should increment follower count by exactly 1 when following', () => {
      fc.assert(
        fc.property(
          countGenerator,
          (currentCount) => {
            const newCount = FollowSystemLogic.calculateFollowerCount(currentCount, true)
            
            // Follower count should increase by exactly 1
            expect(newCount).toBe(currentCount + 1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should decrement follower count by exactly 1 when unfollowing (never below 0)', () => {
      fc.assert(
        fc.property(
          countGenerator,
          (currentCount) => {
            const newCount = FollowSystemLogic.calculateFollowerCount(currentCount, false)
            
            // Follower count should decrease by 1, but never go below 0
            expect(newCount).toBe(Math.max(0, currentCount - 1))
            expect(newCount).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should increment following count by exactly 1 when following', () => {
      fc.assert(
        fc.property(
          countGenerator,
          (currentCount) => {
            const newCount = FollowSystemLogic.calculateFollowingCount(currentCount, true)
            
            // Following count should increase by exactly 1
            expect(newCount).toBe(currentCount + 1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should decrement following count by exactly 1 when unfollowing (never below 0)', () => {
      fc.assert(
        fc.property(
          countGenerator,
          (currentCount) => {
            const newCount = FollowSystemLogic.calculateFollowingCount(currentCount, false)
            
            // Following count should decrease by 1, but never go below 0
            expect(newCount).toBe(Math.max(0, currentCount - 1))
            expect(newCount).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Self-follow prevention', () => {
    it('should prevent any user from following themselves', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          (userId) => {
            const canFollow = FollowSystemLogic.canUserFollow(userId, userId)
            
            // User should NOT be able to follow themselves
            expect(canFollow).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow any user to follow other users', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator,
          (followerId, targetId) => {
            // Skip if same user
            if (followerId === targetId) return true
            
            const canFollow = FollowSystemLogic.canUserFollow(followerId, targetId)
            
            // User should be able to follow other users
            expect(canFollow).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Follow/Unfollow Round Trip', () => {
    it('should return to original follower count after follow then unfollow', () => {
      fc.assert(
        fc.property(
          countGenerator,
          (originalCount) => {
            // Follow
            const afterFollow = FollowSystemLogic.calculateFollowerCount(originalCount, true)
            
            // Unfollow
            const afterUnfollow = FollowSystemLogic.calculateFollowerCount(afterFollow, false)
            
            // Should return to original count
            expect(afterUnfollow).toBe(originalCount)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return to original following count after follow then unfollow', () => {
      fc.assert(
        fc.property(
          countGenerator,
          (originalCount) => {
            // Follow
            const afterFollow = FollowSystemLogic.calculateFollowingCount(originalCount, true)
            
            // Unfollow
            const afterUnfollow = FollowSystemLogic.calculateFollowingCount(afterFollow, false)
            
            // Should return to original count
            expect(afterUnfollow).toBe(originalCount)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Follow Count Invariants', () => {
    it('should maintain non-negative follower count invariant', () => {
      fc.assert(
        fc.property(
          countGenerator,
          fc.boolean(),
          (currentCount, isFollowing) => {
            const newCount = FollowSystemLogic.calculateFollowerCount(currentCount, isFollowing)
            
            // Follower count should never be negative
            expect(newCount).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain non-negative following count invariant', () => {
      fc.assert(
        fc.property(
          countGenerator,
          fc.boolean(),
          (currentCount, isFollowing) => {
            const newCount = FollowSystemLogic.calculateFollowingCount(currentCount, isFollowing)
            
            // Following count should never be negative
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
          countGenerator,
          fc.boolean(),
          (currentCount, isFollowing) => {
            const newFollowerCount = FollowSystemLogic.calculateFollowerCount(currentCount, isFollowing)
            const newFollowingCount = FollowSystemLogic.calculateFollowingCount(currentCount, isFollowing)
            
            // Change should be at most 1
            expect(Math.abs(newFollowerCount - currentCount)).toBeLessThanOrEqual(1)
            expect(Math.abs(newFollowingCount - currentCount)).toBeLessThanOrEqual(1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Follow Data Validation', () => {
    it('should validate follow data correctly', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator,
          timestampGenerator,
          (followerId, followedId, timestamp) => {
            const isValid = FollowSystemLogic.validateFollowData(followerId, followedId, timestamp)
            
            // Should be valid if different users and valid timestamp
            if (followerId === followedId) {
              expect(isValid).toBe(false)
            } else {
              expect(isValid).toBe(true)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject invalid follow data', () => {
      // Empty follower ID
      expect(FollowSystemLogic.validateFollowData('', 'user2', Date.now())).toBe(false)
      
      // Empty followed ID
      expect(FollowSystemLogic.validateFollowData('user1', '', Date.now())).toBe(false)
      
      // Same user
      expect(FollowSystemLogic.validateFollowData('user1', 'user1', Date.now())).toBe(false)
      
      // Invalid timestamp
      expect(FollowSystemLogic.validateFollowData('user1', 'user2', 0)).toBe(false)
      expect(FollowSystemLogic.validateFollowData('user1', 'user2', -1)).toBe(false)
    })
  })

  describe('Idempotence Properties', () => {
    it('should be idempotent for consecutive follow toggles', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (initialFollowingState) => {
            // First toggle
            const afterFirst = FollowSystemLogic.determineFollowAction(initialFollowingState)
            
            // Second toggle (using result of first)
            const afterSecond = FollowSystemLogic.determineFollowAction(afterFirst.newFollowingState)
            
            // After two toggles, should return to original state
            expect(afterSecond.newFollowingState).toBe(initialFollowingState)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
