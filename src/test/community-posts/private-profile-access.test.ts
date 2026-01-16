// Feature: community-posts, Property 24: Private Profile Access Control
// **Validates: Requirements 7.6, 7.7**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FollowSystemLogic } from '../../../services/followService'

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)

describe('Private Profile Access Control - Property 24', () => {
  describe('Requirement 7.6: Private profiles require follow approval', () => {
    it('should require follow request for private profiles', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isPrivate
          (isPrivate) => {
            const profile = { isPrivate }
            const requiresRequest = FollowSystemLogic.requiresFollowRequest(profile)
            
            // Private profiles should require follow request
            expect(requiresRequest).toBe(isPrivate)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not require follow request for public profiles', () => {
      const publicProfile = { isPrivate: false }
      expect(FollowSystemLogic.requiresFollowRequest(publicProfile)).toBe(false)
    })

    it('should require follow request for private profiles', () => {
      const privateProfile = { isPrivate: true }
      expect(FollowSystemLogic.requiresFollowRequest(privateProfile)).toBe(true)
    })
  })

  describe('Requirement 7.7: Non-approved followers cannot view private posts', () => {
    it('should allow users to always view their own posts', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          fc.boolean(), // isPrivate
          fc.boolean(), // isFollowing
          fc.boolean(), // isApproved
          (userId, isPrivate, isFollowing, isApproved) => {
            // User viewing their own posts
            const canView = FollowSystemLogic.canViewUserPosts(
              userId,
              userId, // same user
              isPrivate,
              isFollowing,
              isApproved
            )
            
            // Users should always be able to view their own posts
            expect(canView).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow anyone to view public profile posts', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator,
          fc.boolean(), // isFollowing
          fc.boolean(), // isApproved
          (viewerId, authorId, isFollowing, isApproved) => {
            // Skip if same user (covered by previous test)
            if (viewerId === authorId) return true
            
            // Public profile
            const canView = FollowSystemLogic.canViewUserPosts(
              viewerId,
              authorId,
              false, // not private
              isFollowing,
              isApproved
            )
            
            // Anyone should be able to view public profile posts
            expect(canView).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should deny access to private profile posts for non-followers', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator,
          (viewerId, authorId) => {
            // Skip if same user
            if (viewerId === authorId) return true
            
            // Private profile, not following
            const canView = FollowSystemLogic.canViewUserPosts(
              viewerId,
              authorId,
              true, // private
              false, // not following
              false // not approved
            )
            
            // Non-followers should not be able to view private profile posts
            expect(canView).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should deny access to private profile posts for unapproved followers', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator,
          (viewerId, authorId) => {
            // Skip if same user
            if (viewerId === authorId) return true
            
            // Private profile, following but not approved
            const canView = FollowSystemLogic.canViewUserPosts(
              viewerId,
              authorId,
              true, // private
              true, // following
              false // not approved
            )
            
            // Unapproved followers should not be able to view private profile posts
            expect(canView).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow access to private profile posts for approved followers', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator,
          (viewerId, authorId) => {
            // Skip if same user
            if (viewerId === authorId) return true
            
            // Private profile, following and approved
            const canView = FollowSystemLogic.canViewUserPosts(
              viewerId,
              authorId,
              true, // private
              true, // following
              true // approved
            )
            
            // Approved followers should be able to view private profile posts
            expect(canView).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Access control matrix', () => {
    it('should correctly handle all combinations of privacy and follow status', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator,
          fc.boolean(), // isPrivate
          fc.boolean(), // isFollowing
          fc.boolean(), // isApproved
          (viewerId, authorId, isPrivate, isFollowing, isApproved) => {
            const canView = FollowSystemLogic.canViewUserPosts(
              viewerId,
              authorId,
              isPrivate,
              isFollowing,
              isApproved
            )
            
            // Determine expected result
            let expectedCanView: boolean
            
            if (viewerId === authorId) {
              // Own posts - always viewable
              expectedCanView = true
            } else if (!isPrivate) {
              // Public profile - always viewable
              expectedCanView = true
            } else {
              // Private profile - only approved followers can view
              expectedCanView = isFollowing && isApproved
            }
            
            expect(canView).toBe(expectedCanView)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Profile statistics validation', () => {
    it('should return valid statistics for any non-negative counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 1000000 }),
          (postCount, followerCount, followingCount) => {
            const stats = FollowSystemLogic.getProfileStatistics(postCount, followerCount, followingCount)
            
            expect(stats.postCount).toBe(postCount)
            expect(stats.followerCount).toBe(followerCount)
            expect(stats.followingCount).toBe(followingCount)
            expect(stats.isValid).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should clamp negative counts to zero', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: -1 }),
          fc.integer({ min: -1000000, max: -1 }),
          fc.integer({ min: -1000000, max: -1 }),
          (postCount, followerCount, followingCount) => {
            const stats = FollowSystemLogic.getProfileStatistics(postCount, followerCount, followingCount)
            
            // All counts should be clamped to 0
            expect(stats.postCount).toBe(0)
            expect(stats.followerCount).toBe(0)
            expect(stats.followingCount).toBe(0)
            // But isValid should be false since original values were negative
            expect(stats.isValid).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain non-negative invariant for all statistics', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 1000000 }),
          fc.integer({ min: -1000, max: 1000000 }),
          fc.integer({ min: -1000, max: 1000000 }),
          (postCount, followerCount, followingCount) => {
            const stats = FollowSystemLogic.getProfileStatistics(postCount, followerCount, followingCount)
            
            // All returned counts should be non-negative
            expect(stats.postCount).toBeGreaterThanOrEqual(0)
            expect(stats.followerCount).toBeGreaterThanOrEqual(0)
            expect(stats.followingCount).toBeGreaterThanOrEqual(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle empty user IDs correctly', () => {
      // Empty viewer ID with following and approved - can view private posts
      const canView1 = FollowSystemLogic.canViewUserPosts('', 'author', true, true, true)
      // Following and approved, so can view
      expect(canView1).toBe(true)
      
      // Empty viewer ID without following - cannot view private posts
      const canView1b = FollowSystemLogic.canViewUserPosts('', 'author', true, false, false)
      expect(canView1b).toBe(false)
      
      // Empty author ID - viewer is not the author
      const canView2 = FollowSystemLogic.canViewUserPosts('viewer', '', true, true, true)
      expect(canView2).toBe(true) // Following and approved
    })

    it('should handle undefined isApproved (defaults to true for backward compatibility)', () => {
      // When isApproved is not provided, it defaults to true
      const canView = FollowSystemLogic.canViewUserPosts(
        'viewer',
        'author',
        true, // private
        true  // following
        // isApproved not provided - defaults to true
      )
      
      expect(canView).toBe(true)
    })
  })
})
