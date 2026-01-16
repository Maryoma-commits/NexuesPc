// Feature: community-posts, Property 2: Post Metadata Consistency
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { PostService } from '../../../services/postService'
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

// Helper to create mock File objects
function createMockFile(name: string, size: number, type: string): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

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

const mockFileGenerator = fc.record({
  name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  size: fc.integer({ min: 1000, max: 10 * 1024 * 1024 }), // 1KB to 10MB
  type: fc.constantFrom('image/jpeg', 'image/png', 'image/gif', 'image/webp')
}).map(({ name, size, type }) => createMockFile(name, size, type))

const validCreatePostRequestGenerator = fc.record({
  content: fc.string({ minLength: 5, maxLength: 5000 }).filter(s => s.trim().length >= 5),
  images: fc.array(mockFileGenerator, { maxLength: 10 }),
  taggedProducts: fc.array(productReferenceGenerator, { maxLength: 20 }),
  privacy: postPrivacyGenerator
})

const authorIdGenerator = fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8)

describe('Post Metadata Consistency Properties', () => {
  let postService: PostService
  
  beforeEach(() => {
    vi.clearAllMocks()
    postService = new PostService()
    
    // Mock the uploadImage method to return a URL
    vi.spyOn(postService as any, 'uploadImage').mockResolvedValue('https://example.com/image.jpg')
  })

  describe('Property 2: Post Metadata Consistency', () => {
    it('should contain authorId, timestamp, and content metadata for any created post', async () => {
      // **Validates: Requirements 1.5, 1.9**
      await fc.assert(
        fc.asyncProperty(
          validCreatePostRequestGenerator,
          authorIdGenerator,
          async (postRequest, authorId) => {
            const createdPost = await postService.createPost(postRequest, authorId)
            
            // Post should contain required metadata (Requirement 1.5)
            expect(createdPost.id).toBeDefined()
            expect(createdPost.id).toBe('mock-post-id')
            
            expect(createdPost.authorId).toBeDefined()
            expect(createdPost.authorId).toBe(authorId)
            
            expect(createdPost.createdAt).toBeDefined()
            expect(typeof createdPost.createdAt).toBe('number')
            expect(createdPost.createdAt).toBeGreaterThan(0)
            
            expect(createdPost.content).toBeDefined()
            expect(createdPost.content).toBe(postRequest.content.trim())
            
            expect(createdPost.privacy).toBeDefined()
            expect(createdPost.privacy).toBe(postRequest.privacy)
            
            // Engagement metadata should be initialized
            expect(createdPost.likeCount).toBe(0)
            expect(createdPost.commentCount).toBe(0)
            expect(createdPost.reactionCounts).toEqual({})
            
            // Images and tagged products should be preserved
            expect(Array.isArray(createdPost.images)).toBe(true)
            expect(Array.isArray(createdPost.taggedProducts)).toBe(true)
            expect(createdPost.taggedProducts).toEqual(postRequest.taggedProducts || [])
            
            // editedAt should not be set on creation
            expect(createdPost.editedAt).toBeUndefined()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve createdAt and update editedAt when editing posts', async () => {
      // **Validates: Requirements 1.9**
      await fc.assert(
        fc.asyncProperty(
          validCreatePostRequestGenerator,
          authorIdGenerator,
          fc.string({ minLength: 5, maxLength: 5000 }).filter(s => s.trim().length >= 5),
          async (originalRequest, authorId, newContent) => {
            // Clear all mocks before each property test run
            vi.clearAllMocks()
            
            // Mock getting existing post
            const originalCreatedAt = Date.now() - 1000 // 1 second ago
            const mockExistingPost: Post = {
              id: 'mock-post-id',
              authorId,
              content: originalRequest.content,
              images: [],
              taggedProducts: originalRequest.taggedProducts || [],
              privacy: originalRequest.privacy,
              createdAt: originalCreatedAt,
              likeCount: 0,
              commentCount: 0,
              reactionCounts: {}
            }
            
            const { get, update } = await import('firebase/database')
            vi.mocked(get).mockResolvedValue({
              exists: () => true,
              val: () => mockExistingPost
            } as any)
            
            // Update the post
            await postService.updatePost('mock-post-id', { content: newContent }, authorId)
            
            // Verify update was called with correct data
            expect(update).toHaveBeenCalledTimes(1)
            expect(update).toHaveBeenCalledWith(
              expect.objectContaining({ path: 'mock-ref' }),
              expect.objectContaining({
                content: newContent,
                editedAt: expect.any(Number)
              })
            )
            
            // Verify createdAt is not in the update (preserved)
            const updateCall = vi.mocked(update).mock.calls[0]
            const updateData = updateCall[1]
            expect(updateData).not.toHaveProperty('createdAt')
            expect(updateData).not.toHaveProperty('authorId')
            expect(updateData).not.toHaveProperty('id')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain consistent metadata structure across all post operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          validCreatePostRequestGenerator,
          authorIdGenerator,
          async (postRequest, authorId) => {
            const createdPost = await postService.createPost(postRequest, authorId)
            
            // All posts should have the same metadata structure
            const requiredFields = [
              'id', 'authorId', 'content', 'images', 'taggedProducts', 
              'privacy', 'createdAt', 'likeCount', 'commentCount', 'reactionCounts'
            ]
            
            for (const field of requiredFields) {
              expect(createdPost).toHaveProperty(field)
            }
            
            // Type consistency checks
            expect(typeof createdPost.id).toBe('string')
            expect(typeof createdPost.authorId).toBe('string')
            expect(typeof createdPost.content).toBe('string')
            expect(Array.isArray(createdPost.images)).toBe(true)
            expect(Array.isArray(createdPost.taggedProducts)).toBe(true)
            expect(typeof createdPost.privacy).toBe('string')
            expect(typeof createdPost.createdAt).toBe('number')
            expect(typeof createdPost.likeCount).toBe('number')
            expect(typeof createdPost.commentCount).toBe('number')
            expect(typeof createdPost.reactionCounts).toBe('object')
            
            // Value consistency checks
            expect(createdPost.likeCount).toBeGreaterThanOrEqual(0)
            expect(createdPost.commentCount).toBeGreaterThanOrEqual(0)
            expect(['public', 'friends', 'private']).toContain(createdPost.privacy)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate unique IDs for different posts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(validCreatePostRequestGenerator, authorIdGenerator),
            { minLength: 2, maxLength: 10 }
          ),
          async (postPairs) => {
            const { push } = await import('firebase/database')
            
            // Mock different IDs for each post
            let idCounter = 0
            vi.mocked(push).mockImplementation(() => ({
              key: `mock-post-id-${++idCounter}`
            } as any))
            
            const createdPosts = []
            for (const [postRequest, authorId] of postPairs) {
              const post = await postService.createPost(postRequest, authorId)
              createdPosts.push(post)
            }
            
            // All posts should have unique IDs
            const ids = createdPosts.map(p => p.id)
            const uniqueIds = new Set(ids)
            expect(uniqueIds.size).toBe(ids.length)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should maintain timestamp ordering for posts created in sequence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(validCreatePostRequestGenerator, authorIdGenerator),
            { minLength: 2, maxLength: 5 }
          ),
          async (postPairs) => {
            const { push } = await import('firebase/database')
            
            // Mock different IDs for each post
            let idCounter = 0
            vi.mocked(push).mockImplementation(() => ({
              key: `mock-post-id-${++idCounter}`
            } as any))
            
            const createdPosts = []
            for (const [postRequest, authorId] of postPairs) {
              // Add small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 1))
              const post = await postService.createPost(postRequest, authorId)
              createdPosts.push(post)
            }
            
            // Timestamps should be in ascending order (later posts have higher timestamps)
            for (let i = 1; i < createdPosts.length; i++) {
              expect(createdPosts[i].createdAt).toBeGreaterThanOrEqual(createdPosts[i - 1].createdAt)
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })
})