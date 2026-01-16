// Privacy boundary conditions tests for NexusPC Community Posts
// Tests edge cases and boundary conditions for privacy enforcement
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { PrivacyUtils, PrivacyMiddleware } from '../../../utils/privacyUtils'
import { 
  Post, 
  PostPrivacy, 
  ProductReference
} from '../../../types/community-posts'

// Mock Firebase
vi.mock('../../../firebase.config', () => ({
  database: {},
  auth: {}
}))

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const postIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const postPrivacyGenerator = fc.constantFrom<PostPrivacy>('public', 'friends', 'private')

const productReferenceGenerator = fc.record({
  productId: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  imageUrl: fc.webUrl(),
  price: fc.integer({ min: 1, max: 1000000 }),
  retailer: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.string({ minLength: 1, max: 50 })
})

const postGenerator = fc.record({
  id: postIdGenerator,
  authorId: userIdGenerator,
  content: fc.string({ minLength: 1, maxLength: 5000 }),
  images: fc.array(fc.webUrl(), { maxLength: 10 }),
  taggedProducts: fc.array(productReferenceGenerator, { maxLength: 5 }),
  privacy: postPrivacyGenerator,
  createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
  likeCount: fc.integer({ min: 0, max: 10000 }),
  commentCount: fc.integer({ min: 0, max: 1000 }),
  reactionCounts: fc.constant({})
})

describe('Privacy Boundary Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PrivacyUtils.testPrivacyBoundaries', () => {
    it('should handle null and undefined viewer IDs correctly', () => {
      fc.assert(
        fc.property(
          postGenerator,
          fc.boolean(), // isFollowing
          (post, isFollowing) => {
            // Test with undefined viewerId
            const resultUndefined = PrivacyUtils.testPrivacyBoundaries(post, undefined, isFollowing)
            
            // Test with null viewerId (cast to undefined)
            const resultNull = PrivacyUtils.testPrivacyBoundaries(post, null as any, isFollowing)
            
            // Both should behave the same
            expect(resultUndefined.canView).toBe(resultNull.canView)
            expect(resultUndefined.reason).toBe(resultNull.reason)
            
            // Unauthenticated users should only see public posts
            if (post.privacy === 'public') {
              expect(resultUndefined.canView).toBe(true)
            } else {
              expect(resultUndefined.canView).toBe(false)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle empty string viewer IDs as unauthenticated', () => {
      fc.assert(
        fc.property(
          postGenerator,
          (post) => {
            const result = PrivacyUtils.testPrivacyBoundaries(post, '', false)
            
            // Empty string should be treated as unauthenticated
            if (post.privacy === 'public') {
              expect(result.canView).toBe(true)
            } else {
              expect(result.canView).toBe(false)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly identify privacy requirements', () => {
      fc.assert(
        fc.property(
          postGenerator,
          userIdGenerator,
          (post, viewerId) => {
            const result = PrivacyUtils.testPrivacyBoundaries(post, viewerId, false, true)
            
            // Check privacy level classification
            switch (post.privacy) {
              case 'public':
                expect(result.privacyLevel).toBe('public')
                expect(result.requiresAuth).toBe(false)
                expect(result.requiresFollowing).toBe(false)
                break
              case 'private':
                expect(result.privacyLevel).toBe('private')
                expect(result.requiresAuth).toBe(true)
                expect(result.requiresFollowing).toBe(false)
                break
              case 'friends':
                expect(result.privacyLevel).toBe('restricted')
                expect(result.requiresAuth).toBe(true)
                expect(result.requiresFollowing).toBe(true)
                break
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle follow approval status correctly for friends-only posts', () => {
      fc.assert(
        fc.property(
          fc.record({
            ...postGenerator.constraints,
            privacy: fc.constant('friends' as PostPrivacy)
          }),
          userIdGenerator,
          fc.boolean(), // isFollowing
          fc.boolean(), // isApproved
          (friendsPost, viewerId, isFollowing, isApproved) => {
            const result = PrivacyUtils.testPrivacyBoundaries(friendsPost, viewerId, isFollowing, isApproved)
            
            if (viewerId === friendsPost.authorId) {
              // Authors can always see their own posts
              expect(result.canView).toBe(true)
            } else if (!viewerId) {
              // Unauthenticated users cannot see friends-only posts
              expect(result.canView).toBe(false)
            } else if (isFollowing && isApproved) {
              // Approved followers can see friends-only posts
              expect(result.canView).toBe(true)
            } else {
              // Non-followers or unapproved followers cannot see friends-only posts
              expect(result.canView).toBe(false)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should provide meaningful reasons for privacy decisions', () => {
      fc.assert(
        fc.property(
          postGenerator,
          fc.option(userIdGenerator),
          fc.boolean(),
          (post, viewerId, isFollowing) => {
            const result = PrivacyUtils.testPrivacyBoundaries(post, viewerId, isFollowing)
            
            // Reason should always be a non-empty string
            expect(result.reason).toBeTruthy()
            expect(typeof result.reason).toBe('string')
            expect(result.reason.length).toBeGreaterThan(0)
            
            // Reason should be descriptive
            expect(result.reason.toLowerCase()).toMatch(/(public|private|friends|author|authentication|following)/i)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('PrivacyUtils.filterPostsByPrivacy', () => {
    it('should filter posts correctly based on privacy settings', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 1, maxLength: 20 }),
          fc.option(userIdGenerator),
          fc.array(userIdGenerator, { maxLength: 10 }),
          (posts, viewerId, followingList) => {
            const followingSet = new Set(followingList)
            const filteredPosts = PrivacyUtils.filterPostsByPrivacy(posts, viewerId, followingSet)
            
            // All filtered posts should be viewable
            for (const post of filteredPosts) {
              const isFollowing = followingSet.has(post.authorId)
              const result = PrivacyUtils.testPrivacyBoundaries(post, viewerId, isFollowing)
              expect(result.canView).toBe(true)
            }
            
            // No non-viewable posts should be in the filtered list
            const nonViewablePosts = posts.filter(post => {
              const isFollowing = followingSet.has(post.authorId)
              const result = PrivacyUtils.testPrivacyBoundaries(post, viewerId, isFollowing)
              return !result.canView
            })
            
            for (const nonViewablePost of nonViewablePosts) {
              expect(filteredPosts).not.toContain(nonViewablePost)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve post order when filtering', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 2, maxLength: 10 }),
          userIdGenerator,
          (posts, viewerId) => {
            // Make all posts public to ensure they pass filtering
            const publicPosts = posts.map(post => ({ ...post, privacy: 'public' as PostPrivacy }))
            
            const filteredPosts = PrivacyUtils.filterPostsByPrivacy(publicPosts, viewerId)
            
            // Order should be preserved
            expect(filteredPosts).toEqual(publicPosts)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('PrivacyUtils.canChangePrivacy', () => {
    it('should only allow authors to change privacy', () => {
      fc.assert(
        fc.property(
          postGenerator,
          userIdGenerator, // different user
          postPrivacyGenerator,
          (post, differentUserId, newPrivacy) => {
            // Ensure different user ID
            const userId = differentUserId === post.authorId ? differentUserId + '_different' : differentUserId
            
            const result = PrivacyUtils.canChangePrivacy(post, newPrivacy, userId)
            
            expect(result.allowed).toBe(false)
            expect(result.reason).toContain('author')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should enforce 24-hour edit window for privacy changes', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          postPrivacyGenerator,
          postPrivacyGenerator,
          fc.boolean(), // within24Hours
          (authorId, currentPrivacy, newPrivacy, within24Hours) => {
            const now = Date.now()
            const createdAt = within24Hours 
              ? now - (12 * 60 * 60 * 1000) // 12 hours ago (within window)
              : now - (48 * 60 * 60 * 1000) // 48 hours ago (outside window)
            
            const post: Post = {
              id: 'test-post',
              authorId,
              content: 'Test content',
              images: [],
              taggedProducts: [],
              privacy: currentPrivacy,
              createdAt,
              likeCount: 0,
              commentCount: 0,
              reactionCounts: {}
            }
            
            const result = PrivacyUtils.canChangePrivacy(post, newPrivacy, authorId)
            
            if (within24Hours) {
              expect(result.allowed).toBe(true)
            } else {
              expect(result.allowed).toBe(false)
              expect(result.reason).toContain('24 hours')
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('PrivacyMiddleware', () => {
    it('should enforce privacy consistently with PrivacyUtils', () => {
      fc.assert(
        fc.property(
          postGenerator,
          fc.option(userIdGenerator),
          fc.array(userIdGenerator, { maxLength: 5 }),
          (post, viewerId, followingList) => {
            const followingSet = new Set(followingList)
            
            // Test single post enforcement
            const enforcedPost = PrivacyMiddleware.enforcePostPrivacy(post, viewerId, followingSet)
            
            // Test with PrivacyUtils for comparison
            const isFollowing = followingSet.has(post.authorId)
            const utilsResult = PrivacyUtils.testPrivacyBoundaries(post, viewerId, isFollowing)
            
            if (utilsResult.canView) {
              expect(enforcedPost).toEqual(post)
            } else {
              expect(enforcedPost).toBeNull()
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle empty arrays correctly', () => {
      const result = PrivacyMiddleware.enforcePostsPrivacy([], 'user123')
      expect(result).toEqual([])
    })

    it('should maintain referential integrity for viewable posts', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 1, maxLength: 10 }),
          userIdGenerator,
          (posts, viewerId) => {
            // Make all posts public to ensure they're viewable
            const publicPosts = posts.map(post => ({ ...post, privacy: 'public' as PostPrivacy }))
            
            const enforcedPosts = PrivacyMiddleware.enforcePostsPrivacy(publicPosts, viewerId)
            
            // All posts should be returned and should be the same objects
            expect(enforcedPosts).toHaveLength(publicPosts.length)
            
            for (let i = 0; i < publicPosts.length; i++) {
              expect(enforcedPosts[i]).toEqual(publicPosts[i])
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed privacy values gracefully', () => {
      const malformedPost = {
        id: 'test',
        authorId: 'author123',
        content: 'test',
        images: [],
        taggedProducts: [],
        privacy: 'invalid' as any,
        createdAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        reactionCounts: {}
      }
      
      const result = PrivacyUtils.testPrivacyBoundaries(malformedPost, 'viewer123')
      
      // Should default to denying access for unknown privacy values
      expect(result.canView).toBe(false)
      expect(result.reason).toContain('Unknown')
    })

    it('should handle extremely long user IDs', () => {
      const longUserId = 'a'.repeat(1000)
      const post: Post = {
        id: 'test',
        authorId: longUserId,
        content: 'test',
        images: [],
        taggedProducts: [],
        privacy: 'public',
        createdAt: Date.now(),
        likeCount: 0,
        commentCount: 0,
        reactionCounts: {}
      }
      
      const result = PrivacyUtils.testPrivacyBoundaries(post, longUserId)
      expect(result.canView).toBe(true) // Author should see their own post
    })

    it('should handle posts with missing or invalid timestamps', () => {
      const invalidPost = {
        id: 'test',
        authorId: 'author123',
        content: 'test',
        images: [],
        taggedProducts: [],
        privacy: 'public' as PostPrivacy,
        createdAt: -1, // Invalid timestamp
        likeCount: 0,
        commentCount: 0,
        reactionCounts: {}
      }
      
      // Privacy checking should still work despite invalid timestamp
      const result = PrivacyUtils.testPrivacyBoundaries(invalidPost, 'viewer123')
      expect(result.canView).toBe(true) // Public post should be viewable
      
      // Privacy change should fail due to invalid timestamp
      const changeResult = PrivacyUtils.canChangePrivacy(invalidPost, 'private', 'author123')
      expect(changeResult.allowed).toBe(false)
    })
  })
})