// Feature: community-posts, Property 22: Feed Prioritization Logic
// **Validates: Requirements 7.3**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { FollowSystemLogic } from '../../../services/followService'
import { Post, PostPrivacy, ReactionType, ProductReference } from '../../../types/community-posts'

// Generator for creating valid Post objects
const postGenerator = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  authorId: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  images: fc.array(fc.string(), { maxLength: 3 }),
  taggedProducts: fc.constant([] as ProductReference[]),
  privacy: fc.constantFrom('public', 'friends', 'private') as fc.Arbitrary<PostPrivacy>,
  createdAt: fc.integer({ min: 1, max: Date.now() + 1000000 }),
  likeCount: fc.integer({ min: 0, max: 1000 }),
  commentCount: fc.integer({ min: 0, max: 1000 }),
  reactionCounts: fc.constant({} as Partial<Record<ReactionType, number>>)
}) as fc.Arbitrary<Post>

// Generator for creating a set of followed user IDs
const followedUserIdsGenerator = fc.array(
  fc.string({ minLength: 1, maxLength: 50 }),
  { minLength: 0, maxLength: 10 }
).map(arr => new Set(arr))

describe('Feed Prioritization Logic - Property 22', () => {
  describe('Requirement 7.3: Posts from followed users appear with higher priority', () => {
    it('should place all followed users posts before non-followed users posts', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 0, maxLength: 20 }),
          followedUserIdsGenerator,
          (posts, followedUserIds) => {
            const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, followedUserIds)
            
            // Verify that all followed users' posts come before non-followed users' posts
            const isCorrectlyPrioritized = FollowSystemLogic.arePostsPrioritized(prioritized, followedUserIds)
            expect(isCorrectlyPrioritized).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve all posts after prioritization (no posts lost)', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 0, maxLength: 20 }),
          followedUserIdsGenerator,
          (posts, followedUserIds) => {
            const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, followedUserIds)
            
            // Same number of posts
            expect(prioritized.length).toBe(posts.length)
            
            // All original post IDs should be present
            const originalIds = new Set(posts.map(p => p.id))
            const prioritizedIds = new Set(prioritized.map(p => p.id))
            
            for (const id of originalIds) {
              expect(prioritizedIds.has(id)).toBe(true)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain chronological order within followed users posts', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 2, maxLength: 20 }),
          followedUserIdsGenerator,
          (posts, followedUserIds) => {
            const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, followedUserIds)
            
            // Get only followed users' posts
            const followedPosts = prioritized.filter(p => followedUserIds.has(p.authorId))
            
            // Check chronological order (newest first)
            for (let i = 1; i < followedPosts.length; i++) {
              expect(followedPosts[i].createdAt).toBeLessThanOrEqual(followedPosts[i - 1].createdAt)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain chronological order within non-followed users posts', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 2, maxLength: 20 }),
          followedUserIdsGenerator,
          (posts, followedUserIds) => {
            const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, followedUserIds)
            
            // Get only non-followed users' posts
            const nonFollowedPosts = prioritized.filter(p => !followedUserIds.has(p.authorId))
            
            // Check chronological order (newest first)
            for (let i = 1; i < nonFollowedPosts.length; i++) {
              expect(nonFollowedPosts[i].createdAt).toBeLessThanOrEqual(nonFollowedPosts[i - 1].createdAt)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle empty posts array', () => {
      const emptyPosts: Post[] = []
      const followedUserIds = new Set(['user1', 'user2'])
      
      const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(emptyPosts, followedUserIds)
      
      expect(prioritized).toEqual([])
      expect(FollowSystemLogic.arePostsPrioritized(prioritized, followedUserIds)).toBe(true)
    })

    it('should handle empty followed users set', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 1, maxLength: 10 }),
          (posts) => {
            const emptyFollowed = new Set<string>()
            const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, emptyFollowed)
            
            // Should just be sorted by timestamp (newest first)
            for (let i = 1; i < prioritized.length; i++) {
              expect(prioritized[i].createdAt).toBeLessThanOrEqual(prioritized[i - 1].createdAt)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle all posts from followed users', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 1, maxLength: 10 }),
          (posts) => {
            // Create a set containing all author IDs
            const allAuthors = new Set(posts.map(p => p.authorId))
            const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, allAuthors)
            
            // All posts should be from followed users, sorted by timestamp
            for (let i = 1; i < prioritized.length; i++) {
              expect(prioritized[i].createdAt).toBeLessThanOrEqual(prioritized[i - 1].createdAt)
            }
            
            expect(FollowSystemLogic.arePostsPrioritized(prioritized, allAuthors)).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle single post', () => {
      fc.assert(
        fc.property(
          postGenerator,
          followedUserIdsGenerator,
          (post, followedUserIds) => {
            const posts = [post]
            const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, followedUserIds)
            
            expect(prioritized.length).toBe(1)
            expect(prioritized[0].id).toBe(post.id)
            expect(FollowSystemLogic.arePostsPrioritized(prioritized, followedUserIds)).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Prioritization verification', () => {
    it('should correctly identify properly prioritized feeds', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 0, maxLength: 20 }),
          followedUserIdsGenerator,
          (posts, followedUserIds) => {
            // Prioritize the posts
            const prioritized = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, followedUserIds)
            
            // The result should always be correctly prioritized
            expect(FollowSystemLogic.arePostsPrioritized(prioritized, followedUserIds)).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should correctly identify improperly prioritized feeds', () => {
      // Create a feed where a non-followed user's post comes before a followed user's post
      const followedUserIds = new Set(['followed_user'])
      
      const improperlyPrioritized: Post[] = [
        {
          id: '1',
          authorId: 'non_followed_user',
          content: 'First post',
          images: [],
          taggedProducts: [],
          privacy: 'public',
          createdAt: Date.now(),
          likeCount: 0,
          commentCount: 0,
          reactionCounts: {}
        },
        {
          id: '2',
          authorId: 'followed_user',
          content: 'Second post',
          images: [],
          taggedProducts: [],
          privacy: 'public',
          createdAt: Date.now() - 1000,
          likeCount: 0,
          commentCount: 0,
          reactionCounts: {}
        }
      ]
      
      // This should be detected as improperly prioritized
      expect(FollowSystemLogic.arePostsPrioritized(improperlyPrioritized, followedUserIds)).toBe(false)
    })
  })

  describe('Idempotence', () => {
    it('should be idempotent - prioritizing twice gives same result', () => {
      fc.assert(
        fc.property(
          fc.array(postGenerator, { minLength: 0, maxLength: 20 }),
          followedUserIdsGenerator,
          (posts, followedUserIds) => {
            const firstPrioritization = FollowSystemLogic.prioritizeFollowedUsersPosts(posts, followedUserIds)
            const secondPrioritization = FollowSystemLogic.prioritizeFollowedUsersPosts(firstPrioritization, followedUserIds)
            
            // Both should have same order
            expect(firstPrioritization.length).toBe(secondPrioritization.length)
            for (let i = 0; i < firstPrioritization.length; i++) {
              expect(firstPrioritization[i].id).toBe(secondPrioritization[i].id)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
