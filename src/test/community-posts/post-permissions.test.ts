// Feature: community-posts, Property 4: Post Author Permissions
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { PostService } from '../../../services/postService'
import { 
  Post, 
  PostPrivacy, 
  ProductReference,
  PostError,
  PostErrorType 
} from '../../../types/community-posts'

// Mock Firebase
vi.mock('../../../firebase.config', () => ({
  database: {},
  auth: {}
}))

// Mock Firebase database functions
vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ path: 'mock-ref' })),
  push: vi.fn(() => ({ key: 'mock-post-id' })),
  set: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  limitToLast: vi.fn(),
  endBefore: vi.fn(),
  startAfter: vi.fn(),
  equalTo: vi.fn(),
  serverTimestamp: vi.fn(() => Date.now()),
  onValue: vi.fn()
}))

// Generators for property-based testing
const postPrivacyGenerator = fc.constantFrom<PostPrivacy>('public', 'friends', 'private')

const productReferenceGenerator = fc.record({
  productId: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  title: fc.string({ minLength: 3, maxLength: 200 }).filter(s => s.trim().length >= 3),
  imageUrl: fc.webUrl(),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  retailer: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  category: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3)
})

const validPostGenerator = fc.record({
  id: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
  authorId: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
  content: fc.string({ minLength: 5, maxLength: 5000 }).filter(s => s.trim().length >= 5),
  images: fc.array(fc.webUrl(), { maxLength: 10 }),
  taggedProducts: fc.array(productReferenceGenerator, { maxLength: 20 }),
  privacy: postPrivacyGenerator,
  createdAt: fc.integer({ min: Date.now() - (23 * 60 * 60 * 1000), max: Date.now() }), // Within last 23 hours for edit tests
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

const userIdGenerator = fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8)

describe('Post Author Permissions Properties', () => {
  let postService: PostService
  
  beforeEach(() => {
    vi.clearAllMocks()
    postService = new PostService()
  })

  describe('Property 4: Post Author Permissions', () => {
    it('should allow authors to edit their own posts within 24 hours', async () => {
      // **Validates: Requirements 1.7, 1.8**
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          fc.string({ minLength: 5, maxLength: 5000 }).filter(s => s.trim().length >= 5),
          async (post, newContent) => {
            // Mock post that was created within the last 24 hours
            const recentPost = {
              ...post,
              createdAt: Date.now() - (12 * 60 * 60 * 1000) // 12 hours ago
            }
            
            const { get, update } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => true,
              val: () => recentPost
            } as any)
            
            // Author should be able to edit their own post
            await expect(
              postService.updatePost(post.id, { content: newContent }, post.authorId)
            ).resolves.not.toThrow()
            
            // Verify update was called
            expect(update).toHaveBeenCalledWith(
              expect.objectContaining({ path: 'mock-ref' }),
              expect.objectContaining({
                content: newContent,
                editedAt: expect.any(Number)
              })
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should prevent non-authors from editing posts', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          userIdGenerator,
          fc.string({ minLength: 5, maxLength: 5000 }).filter(s => s.trim().length >= 5),
          async (post, differentUserId, newContent) => {
            // Ensure the user ID is different from the author
            fc.pre(differentUserId !== post.authorId)
            
            const recentPost = {
              ...post,
              createdAt: Date.now() - (12 * 60 * 60 * 1000) // 12 hours ago
            }
            
            const { get } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => true,
              val: () => recentPost
            } as any)
            
            // Non-author should not be able to edit the post
            await expect(
              postService.updatePost(post.id, { content: newContent }, differentUserId)
            ).rejects.toThrow(PostError)
            
            await expect(
              postService.updatePost(post.id, { content: newContent }, differentUserId)
            ).rejects.toThrow('Only the post author can edit this post')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should prevent editing posts older than 24 hours', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          fc.string({ minLength: 5, maxLength: 5000 }).filter(s => s.trim().length >= 5),
          async (post, newContent) => {
            // Mock post that was created more than 24 hours ago
            const oldPost = {
              ...post,
              createdAt: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
            }
            
            const { get } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => true,
              val: () => oldPost
            } as any)
            
            // Even the author should not be able to edit old posts
            await expect(
              postService.updatePost(post.id, { content: newContent }, post.authorId)
            ).rejects.toThrow(PostError)
            
            await expect(
              postService.updatePost(post.id, { content: newContent }, post.authorId)
            ).rejects.toThrow('Posts can only be edited within 24 hours of creation')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should allow authors to delete their own posts at any time', async () => {
      // **Validates: Requirements 1.8**
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }), // Up to 1 year old
          async (post, ageInMs) => {
            // Clear all mocks before each property test run
            vi.clearAllMocks()
            
            // Mock post of any age
            const oldPost = {
              ...post,
              createdAt: Date.now() - ageInMs
            }
            
            const { get, remove } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => true,
              val: () => oldPost
            } as any)
            
            // Author should be able to delete their own post regardless of age
            await expect(
              postService.deletePost(post.id, post.authorId)
            ).resolves.not.toThrow()
            
            // Verify remove was called for post and related data
            expect(remove).toHaveBeenCalledTimes(4) // post, comments, likes, reactions
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should prevent non-authors from deleting posts', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          userIdGenerator,
          async (post, differentUserId) => {
            // Ensure the user ID is different from the author
            fc.pre(differentUserId !== post.authorId)
            
            const { get } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => true,
              val: () => post
            } as any)
            
            // Non-author should not be able to delete the post
            await expect(
              postService.deletePost(post.id, differentUserId)
            ).rejects.toThrow(PostError)
            
            await expect(
              postService.deletePost(post.id, differentUserId)
            ).rejects.toThrow('Only the post author can delete this post')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle non-existent posts gracefully for edit operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
          userIdGenerator,
          fc.string({ minLength: 5, maxLength: 5000 }).filter(s => s.trim().length >= 5),
          async (postId, userId, newContent) => {
            const { get } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => false,
              val: () => null
            } as any)
            
            // Should throw error for non-existent post
            await expect(
              postService.updatePost(postId, { content: newContent }, userId)
            ).rejects.toThrow(PostError)
            
            await expect(
              postService.updatePost(postId, { content: newContent }, userId)
            ).rejects.toThrow('Post not found')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle non-existent posts gracefully for delete operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
          userIdGenerator,
          async (postId, userId) => {
            const { get } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => false,
              val: () => null
            } as any)
            
            // Should throw error for non-existent post
            await expect(
              postService.deletePost(postId, userId)
            ).rejects.toThrow(PostError)
            
            await expect(
              postService.deletePost(postId, userId)
            ).rejects.toThrow('Post not found')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve post ownership throughout operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          async (post) => {
            // Clear all mocks before each property test run
            vi.clearAllMocks()
            
            const { get, update } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => true,
              val: () => post
            } as any)
            
            // Try to update authorId (should be ignored)
            const differentAuthorId = post.authorId + '_different'
            
            await expect(
              postService.updatePost(post.id, { authorId: differentAuthorId }, post.authorId)
            ).resolves.not.toThrow()
            
            // Verify that authorId was not included in the update
            if (vi.mocked(update).mock.calls.length > 0) {
              const updateCall = vi.mocked(update).mock.calls[0]
              const updateData = updateCall[1]
              expect(updateData).not.toHaveProperty('authorId')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain consistent permission checks across all operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          userIdGenerator,
          async (post, randomUserId) => {
            const { get } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => true,
              val: () => post
            } as any)
            
            const isAuthor = randomUserId === post.authorId
            
            // Test edit permissions
            const editPromise = postService.updatePost(post.id, { content: 'new content' }, randomUserId)
            
            if (isAuthor) {
              // Author should be able to edit (if within time limit)
              const isRecent = (Date.now() - post.createdAt) <= (24 * 60 * 60 * 1000)
              if (isRecent) {
                await expect(editPromise).resolves.not.toThrow()
              } else {
                await expect(editPromise).rejects.toThrow('Posts can only be edited within 24 hours')
              }
            } else {
              // Non-author should not be able to edit
              await expect(editPromise).rejects.toThrow('Only the post author can edit this post')
            }
            
            // Test delete permissions
            const deletePromise = postService.deletePost(post.id, randomUserId)
            
            if (isAuthor) {
              // Author should always be able to delete
              await expect(deletePromise).resolves.not.toThrow()
            } else {
              // Non-author should not be able to delete
              await expect(deletePromise).rejects.toThrow('Only the post author can delete this post')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})