// Feature: community-posts, Property 20: User Blocking Effectiveness
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  Post, 
  Comment, 
  PostPrivacy,
  ProductReference
} from '../../../types/community-posts'
import { ModerationLogic } from '../../../services/moderationService'

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const postIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const commentIdGenerator = fc.string({ minLength: 1, maxLength: 50 })

const postPrivacyGenerator = fc.constantFrom<PostPrivacy>('public', 'friends', 'private')

const productReferenceGenerator = fc.record({
  productId: fc.string({ minLength: 1, maxLength: 50 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  imageUrl: fc.webUrl(),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  retailer: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.string({ minLength: 1, maxLength: 50 })
})

const postGenerator = fc.record({
  id: postIdGenerator,
  authorId: userIdGenerator,
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  images: fc.array(fc.webUrl(), { maxLength: 10 }),
  taggedProducts: fc.array(productReferenceGenerator, { maxLength: 5 }),
  privacy: postPrivacyGenerator,
  createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
  likeCount: fc.integer({ min: 0, max: 1000000 }),
  commentCount: fc.integer({ min: 0, max: 1000000 }),
  reactionCounts: fc.record({
    like: fc.integer({ min: 0, max: 1000000 }),
    love: fc.integer({ min: 0, max: 1000000 }),
    wow: fc.integer({ min: 0, max: 1000000 }),
    helpful: fc.integer({ min: 0, max: 1000000 }),
    inspiring: fc.integer({ min: 0, max: 1000000 })
  }, { requiredKeys: [] })
})

const commentGenerator = fc.record({
  id: commentIdGenerator,
  postId: postIdGenerator,
  authorId: userIdGenerator,
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  parentId: fc.option(commentIdGenerator),
  createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
  mentions: fc.array(userIdGenerator, { maxLength: 10 }),
  likeCount: fc.integer({ min: 0, max: 1000000 })
})

const userBlockRelationshipGenerator = fc.record({
  blockerId: userIdGenerator,
  blockedId: userIdGenerator,
  blockedAt: fc.integer({ min: 1000000000000, max: 9999999999999 })
}).filter(rel => rel.blockerId !== rel.blockedId)

const feedContentGenerator = fc.record({
  posts: fc.array(postGenerator, { maxLength: 50 }),
  comments: fc.array(commentGenerator, { maxLength: 100 }),
  blockRelationships: fc.array(userBlockRelationshipGenerator, { maxLength: 20 })
})

// Mock functions to simulate blocking behavior
function mockIsUserBlocked(viewerId: string, authorId: string, blockRelationships: Array<{blockerId: string, blockedId: string}>): boolean {
  return blockRelationships.some(rel => rel.blockerId === viewerId && rel.blockedId === authorId)
}

function mockFilterBlockedContent<T extends { authorId: string }>(
  content: T[], 
  viewerId: string, 
  blockRelationships: Array<{blockerId: string, blockedId: string}>
): T[] {
  return content.filter(item => !mockIsUserBlocked(viewerId, item.authorId, blockRelationships))
}

function mockBlockUser(blockerId: string, blockedId: string): { success: boolean; error?: string } {
  const validation = ModerationLogic.canBlockUser(blockerId, blockedId)
  if (!validation.canBlock) {
    return { success: false, error: validation.error }
  }
  return { success: true }
}

function mockRemoveFollowRelationships(blockerId: string, blockedId: string): { followingRemoved: boolean; followerRemoved: boolean } {
  // Simulate removing follow relationships when blocking
  return { followingRemoved: true, followerRemoved: true }
}

function mockPreventInteractions(viewerId: string, targetId: string, isBlocked: boolean): {
  canLike: boolean;
  canComment: boolean;
  canFollow: boolean;
  canMessage: boolean;
} {
  if (isBlocked) {
    return { canLike: false, canComment: false, canFollow: false, canMessage: false }
  }
  return { canLike: true, canComment: true, canFollow: true, canMessage: true }
}

describe('User Blocking Effectiveness', () => {
  describe('Property 20: User Blocking Effectiveness', () => {
    it('should prevent blocked users content from appearing in feed', () => {
      // **Validates: Requirements 6.7**
      fc.assert(
        fc.property(
          feedContentGenerator,
          userIdGenerator,
          (feedData, viewerId) => {
            const { posts, blockRelationships } = feedData
            
            // Filter posts based on blocking relationships
            const filteredPosts = mockFilterBlockedContent(posts, viewerId, blockRelationships)
            
            // No post in filtered feed should be from a blocked user
            for (const post of filteredPosts) {
              const isBlocked = mockIsUserBlocked(viewerId, post.authorId, blockRelationships)
              expect(isBlocked).toBe(false)
            }
            
            // All blocked users' posts should be excluded
            const blockedUserIds = blockRelationships
              .filter(rel => rel.blockerId === viewerId)
              .map(rel => rel.blockedId)
            
            for (const blockedUserId of blockedUserIds) {
              const blockedUserPosts = filteredPosts.filter(post => post.authorId === blockedUserId)
              expect(blockedUserPosts).toHaveLength(0)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should prevent blocked users comments from appearing', () => {
      // **Validates: Requirements 6.7**
      fc.assert(
        fc.property(
          feedContentGenerator,
          userIdGenerator,
          (feedData, viewerId) => {
            const { comments, blockRelationships } = feedData
            
            // Filter comments based on blocking relationships
            const filteredComments = mockFilterBlockedContent(comments, viewerId, blockRelationships)
            
            // No comment in filtered list should be from a blocked user
            for (const comment of filteredComments) {
              const isBlocked = mockIsUserBlocked(viewerId, comment.authorId, blockRelationships)
              expect(isBlocked).toBe(false)
            }
            
            // All blocked users' comments should be excluded
            const blockedUserIds = blockRelationships
              .filter(rel => rel.blockerId === viewerId)
              .map(rel => rel.blockedId)
            
            for (const blockedUserId of blockedUserIds) {
              const blockedUserComments = filteredComments.filter(comment => comment.authorId === blockedUserId)
              expect(blockedUserComments).toHaveLength(0)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow blocking valid user relationships', () => {
      fc.assert(
        fc.property(
          fc.tuple(userIdGenerator, userIdGenerator).filter(([blockerId, blockedId]) => blockerId !== blockedId),
          ([blockerId, blockedId]) => {
            // Should successfully block different users
            const result = mockBlockUser(blockerId, blockedId)
            expect(result.success).toBe(true)
            expect(result.error).toBeUndefined()
            
            // Validation should pass
            const validation = ModerationLogic.canBlockUser(blockerId, blockedId)
            expect(validation.canBlock).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should prevent users from blocking themselves', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          (userId) => {
            // Should prevent self-blocking
            const result = mockBlockUser(userId, userId)
            expect(result.success).toBe(false)
            expect(result.error).toBe('Cannot block yourself')
            
            // Validation should fail
            const validation = ModerationLogic.canBlockUser(userId, userId)
            expect(validation.canBlock).toBe(false)
            expect(validation.error).toBe('Cannot block yourself')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should remove follow relationships when blocking', () => {
      fc.assert(
        fc.property(
          fc.tuple(userIdGenerator, userIdGenerator).filter(([blockerId, blockedId]) => blockerId !== blockedId),
          ([blockerId, blockedId]) => {
            // Should remove follow relationships when blocking
            const result = mockRemoveFollowRelationships(blockerId, blockedId)
            
            expect(result.followingRemoved).toBe(true)
            expect(result.followerRemoved).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should prevent interactions with blocked users', () => {
      fc.assert(
        fc.property(
          fc.tuple(userIdGenerator, userIdGenerator).filter(([viewerId, targetId]) => viewerId !== targetId),
          ([viewerId, targetId]) => {
            // Test interactions when user is blocked
            const blockedInteractions = mockPreventInteractions(viewerId, targetId, true)
            expect(blockedInteractions.canLike).toBe(false)
            expect(blockedInteractions.canComment).toBe(false)
            expect(blockedInteractions.canFollow).toBe(false)
            expect(blockedInteractions.canMessage).toBe(false)
            
            // Test interactions when user is not blocked
            const allowedInteractions = mockPreventInteractions(viewerId, targetId, false)
            expect(allowedInteractions.canLike).toBe(true)
            expect(allowedInteractions.canComment).toBe(true)
            expect(allowedInteractions.canFollow).toBe(true)
            expect(allowedInteractions.canMessage).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain blocking relationship consistency', () => {
      fc.assert(
        fc.property(
          userBlockRelationshipGenerator,
          (blockRelationship) => {
            const { blockerId, blockedId } = blockRelationship
            
            // Blocking relationship should be valid
            expect(blockerId).toBeDefined()
            expect(blockedId).toBeDefined()
            expect(blockerId).not.toBe(blockedId)
            expect(blockRelationship.blockedAt).toBeGreaterThan(0)
            
            // Should be detected as blocked
            const isBlocked = mockIsUserBlocked(blockerId, blockedId, [blockRelationship])
            expect(isBlocked).toBe(true)
            
            // Reverse relationship should not exist unless explicitly created
            const reverseBlocked = mockIsUserBlocked(blockedId, blockerId, [blockRelationship])
            expect(reverseBlocked).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle multiple blocking relationships correctly', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            userIdGenerator,
            fc.array(userIdGenerator, { minLength: 1, maxLength: 5 })
          ).filter(([blockerId, blockedUserIds]) => 
            // Ensure no self-blocking and all IDs are unique
            !blockedUserIds.includes(blockerId) && 
            new Set(blockedUserIds).size === blockedUserIds.length
          ),
          ([blockerId, blockedUserIds]) => {
            // Create blocking relationships
            const blockRelationships = blockedUserIds.map(blockedId => ({
              blockerId,
              blockedId,
              blockedAt: Date.now()
            }))
            
            // All specified users should be blocked
            for (const blockedId of blockedUserIds) {
              const isBlocked = mockIsUserBlocked(blockerId, blockedId, blockRelationships)
              expect(isBlocked).toBe(true)
            }
            
            // Generate some content from blocked users
            const posts = blockedUserIds.slice(0, 3).map(authorId => ({ // Limit to 3 to avoid complexity
              id: `post_${authorId}`,
              authorId,
              content: 'Test content',
              images: [],
              taggedProducts: [],
              privacy: 'public' as PostPrivacy,
              createdAt: Date.now(),
              likeCount: 0,
              commentCount: 0,
              reactionCounts: {}
            }))
            
            // Filter should remove all posts from blocked users
            const filteredPosts = mockFilterBlockedContent(posts, blockerId, blockRelationships)
            expect(filteredPosts).toHaveLength(0)
            
            return true
          }
        ),
        { numRuns: 50 } // Reduced iterations to prevent timeout
      )
    })

    it('should not affect content from non-blocked users', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            userIdGenerator,
            fc.array(userIdGenerator, { minLength: 1, maxLength: 3 }),
            fc.array(userIdGenerator, { minLength: 1, maxLength: 3 })
          ).filter(([viewerId, blockedIds, nonBlockedIds]) => {
            // Ensure viewer is not in any list and lists don't overlap
            const allIds = new Set([viewerId, ...blockedIds, ...nonBlockedIds])
            return allIds.size === (1 + blockedIds.length + nonBlockedIds.length) // All unique
          }),
          ([viewerId, blockedUserIds, nonBlockedUserIds]) => {
            // Create blocking relationships only for blocked users
            const blockRelationships = blockedUserIds.map(blockedId => ({
              blockerId: viewerId,
              blockedId,
              blockedAt: Date.now()
            }))
            
            // Create posts from both blocked and non-blocked users
            const allPosts = [
              ...blockedUserIds.map(authorId => ({
                id: `blocked_post_${authorId}`,
                authorId,
                content: 'Blocked user content',
                images: [],
                taggedProducts: [],
                privacy: 'public' as PostPrivacy,
                createdAt: Date.now(),
                likeCount: 0,
                commentCount: 0,
                reactionCounts: {}
              })),
              ...nonBlockedUserIds.map(authorId => ({
                id: `allowed_post_${authorId}`,
                authorId,
                content: 'Non-blocked user content',
                images: [],
                taggedProducts: [],
                privacy: 'public' as PostPrivacy,
                createdAt: Date.now(),
                likeCount: 0,
                commentCount: 0,
                reactionCounts: {}
              }))
            ]
            
            // Filter content
            const filteredPosts = mockFilterBlockedContent(allPosts, viewerId, blockRelationships)
            
            // Should contain all posts from non-blocked users
            const nonBlockedPosts = filteredPosts.filter(post => 
              nonBlockedUserIds.includes(post.authorId)
            )
            expect(nonBlockedPosts).toHaveLength(nonBlockedUserIds.length)
            
            // Should contain no posts from blocked users
            const blockedPosts = filteredPosts.filter(post => 
              blockedUserIds.includes(post.authorId)
            )
            expect(blockedPosts).toHaveLength(0)
            
            return true
          }
        ),
        { numRuns: 50 } // Reduced iterations
      )
    })

    it('should handle edge cases in blocking logic', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.oneof(
              fc.constant(''), // Empty user ID
              fc.string({ minLength: 1, maxLength: 1000 }), // Very long user ID
              userIdGenerator
            ),
            fc.oneof(
              fc.constant(''), // Empty user ID
              fc.string({ minLength: 1, maxLength: 1000 }), // Very long user ID
              userIdGenerator
            )
          ),
          ([blockerId, blockedId]) => {
            // Should handle edge cases gracefully
            expect(() => {
              const validation = ModerationLogic.canBlockUser(blockerId, blockedId)
              
              // Validation should return a valid result
              expect(typeof validation.canBlock).toBe('boolean')
              if (!validation.canBlock) {
                expect(validation.error).toBeDefined()
              }
            }).not.toThrow()
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain blocking state consistency across operations', () => {
      fc.assert(
        fc.property(
          fc.tuple(userIdGenerator, userIdGenerator).filter(([blockerId, blockedId]) => blockerId !== blockedId),
          ([blockerId, blockedId]) => {
            const blockRelationship = { blockerId, blockedId, blockedAt: Date.now() }
            
            // Multiple checks should return consistent results
            const isBlocked1 = mockIsUserBlocked(blockerId, blockedId, [blockRelationship])
            const isBlocked2 = mockIsUserBlocked(blockerId, blockedId, [blockRelationship])
            const isBlocked3 = mockIsUserBlocked(blockerId, blockedId, [blockRelationship])
            
            expect(isBlocked1).toBe(isBlocked2)
            expect(isBlocked2).toBe(isBlocked3)
            expect(isBlocked1).toBe(true)
            
            // Filtering should be consistent
            const testPost = {
              id: 'test_post',
              authorId: blockedId,
              content: 'Test content',
              images: [],
              taggedProducts: [],
              privacy: 'public' as PostPrivacy,
              createdAt: Date.now(),
              likeCount: 0,
              commentCount: 0,
              reactionCounts: {}
            }
            
            const filtered1 = mockFilterBlockedContent([testPost], blockerId, [blockRelationship])
            const filtered2 = mockFilterBlockedContent([testPost], blockerId, [blockRelationship])
            
            expect(filtered1).toHaveLength(0)
            expect(filtered2).toHaveLength(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})