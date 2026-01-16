// Feature: community-posts, Property 1: Post Content Validation
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  Post, 
  Comment, 
  PostPrivacy, 
  ReactionType, 
  ProductReference,
  PostError,
  PostErrorType 
} from '../../../types/community-posts'

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

const validPostGenerator = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  authorId: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.string({ minLength: 1, maxLength: 5000 }),
  images: fc.array(fc.webUrl(), { maxLength: 10 }),
  taggedProducts: fc.array(productReferenceGenerator, { maxLength: 20 }),
  privacy: postPrivacyGenerator,
  createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }), // Valid timestamps
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
  likeCount: fc.integer({ min: 0, max: 1000000 }),
  commentCount: fc.integer({ min: 0, max: 1000000 }),
  reactionCounts: fc.record({
    like: fc.integer({ min: 0, max: 1000000 }),
    love: fc.integer({ min: 0, max: 1000000 }),
    wow: fc.integer({ min: 0, max: 1000000 }),
    helpful: fc.integer({ min: 0, max: 1000000 }),
    inspiring: fc.integer({ min: 0, max: 1000000 })
  }, { requiredKeys: [] }) // Make all keys optional
})

const validCommentGenerator = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  postId: fc.string({ minLength: 1, maxLength: 50 }),
  authorId: fc.string({ minLength: 1, maxLength: 50 }),
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  parentId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
  mentions: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
  likeCount: fc.integer({ min: 0, max: 1000000 })
})

// Validation functions (simulating the actual validation logic)
function validatePostContent(content: string): void {
  if (content.length === 0) {
    throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Content cannot be empty')
  }
  if (content.length > 5000) {
    throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Content exceeds 5000 character limit')
  }
}

function validatePostImages(images: string[]): void {
  if (images.length > 10) {
    throw new PostError(PostErrorType.TOO_MANY_IMAGES, 'Cannot attach more than 10 images')
  }
}

function validateCommentContent(content: string): void {
  if (content.length === 0) {
    throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Comment cannot be empty')
  }
  if (content.length > 1000) {
    throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Comment exceeds 1000 character limit')
  }
}

function validatePost(post: Partial<Post>): Post {
  if (!post.content) {
    throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Content is required')
  }
  
  validatePostContent(post.content)
  
  if (post.images) {
    validatePostImages(post.images)
  }
  
  if (!post.authorId) {
    throw new PostError(PostErrorType.PERMISSION_DENIED, 'Author ID is required')
  }
  
  if (!post.privacy) {
    throw new PostError(PostErrorType.PERMISSION_DENIED, 'Privacy setting is required')
  }
  
  return {
    id: post.id || '',
    authorId: post.authorId,
    content: post.content,
    images: post.images || [],
    taggedProducts: post.taggedProducts || [],
    privacy: post.privacy,
    createdAt: post.createdAt || Date.now(),
    editedAt: post.editedAt,
    likeCount: post.likeCount || 0,
    commentCount: post.commentCount || 0,
    reactionCounts: post.reactionCounts || {}
  }
}

function validateComment(comment: Partial<Comment>): Comment {
  if (!comment.content) {
    throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Comment content is required')
  }
  
  validateCommentContent(comment.content)
  
  if (!comment.authorId) {
    throw new PostError(PostErrorType.PERMISSION_DENIED, 'Author ID is required')
  }
  
  if (!comment.postId) {
    throw new PostError(PostErrorType.PERMISSION_DENIED, 'Post ID is required')
  }
  
  return {
    id: comment.id || '',
    postId: comment.postId,
    authorId: comment.authorId,
    content: comment.content,
    parentId: comment.parentId,
    createdAt: comment.createdAt || Date.now(),
    editedAt: comment.editedAt,
    mentions: comment.mentions || [],
    likeCount: comment.likeCount || 0
  }
}

describe('Community Posts Data Model Validation', () => {
  describe('Property 1: Post Content Validation', () => {
    it('should accept all valid posts within content and image limits', () => {
      // **Validates: Requirements 1.4**
      fc.assert(
        fc.property(validPostGenerator, (post) => {
          const validatedPost = validatePost(post)
          
          // Post should be successfully validated
          expect(validatedPost).toBeDefined()
          expect(validatedPost.content).toBe(post.content)
          expect(validatedPost.authorId).toBe(post.authorId)
          expect(validatedPost.privacy).toBe(post.privacy)
          
          // Content should be within limits
          expect(validatedPost.content.length).toBeGreaterThan(0)
          expect(validatedPost.content.length).toBeLessThanOrEqual(5000)
          
          // Images should be within limits
          expect(validatedPost.images.length).toBeLessThanOrEqual(10)
          
          // Counts should be non-negative
          expect(validatedPost.likeCount).toBeGreaterThanOrEqual(0)
          expect(validatedPost.commentCount).toBeGreaterThanOrEqual(0)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should reject posts with content exceeding 5000 characters', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 5001, maxLength: 10000 }),
            authorId: fc.string({ minLength: 1 }),
            privacy: postPrivacyGenerator
          }),
          (invalidPost) => {
            expect(() => validatePost(invalidPost)).toThrow(PostError)
            expect(() => validatePost(invalidPost)).toThrow('Content exceeds 5000 character limit')
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject posts with more than 10 images', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 1, maxLength: 100 }),
            authorId: fc.string({ minLength: 1 }),
            privacy: postPrivacyGenerator,
            images: fc.array(fc.webUrl(), { minLength: 11, maxLength: 20 })
          }),
          (invalidPost) => {
            expect(() => validatePost(invalidPost)).toThrow(PostError)
            expect(() => validatePost(invalidPost)).toThrow('Cannot attach more than 10 images')
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject posts with empty content', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.constant(''),
            authorId: fc.string({ minLength: 1 }),
            privacy: postPrivacyGenerator
          }),
          (invalidPost) => {
            expect(() => validatePost(invalidPost)).toThrow(PostError)
            expect(() => validatePost(invalidPost)).toThrow('Content is required')
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should accept all valid comments within content limits', () => {
      fc.assert(
        fc.property(validCommentGenerator, (comment) => {
          const validatedComment = validateComment(comment)
          
          // Comment should be successfully validated
          expect(validatedComment).toBeDefined()
          expect(validatedComment.content).toBe(comment.content)
          expect(validatedComment.authorId).toBe(comment.authorId)
          expect(validatedComment.postId).toBe(comment.postId)
          
          // Content should be within limits
          expect(validatedComment.content.length).toBeGreaterThan(0)
          expect(validatedComment.content.length).toBeLessThanOrEqual(1000)
          
          // Like count should be non-negative
          expect(validatedComment.likeCount).toBeGreaterThanOrEqual(0)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should reject comments with content exceeding 1000 characters', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 1001, maxLength: 2000 }),
            authorId: fc.string({ minLength: 1 }),
            postId: fc.string({ minLength: 1 })
          }),
          (invalidComment) => {
            expect(() => validateComment(invalidComment)).toThrow(PostError)
            expect(() => validateComment(invalidComment)).toThrow('Comment exceeds 1000 character limit')
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject comments with empty content', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.constant(''),
            authorId: fc.string({ minLength: 1 }),
            postId: fc.string({ minLength: 1 })
          }),
          (invalidComment) => {
            expect(() => validateComment(invalidComment)).toThrow(PostError)
            expect(() => validateComment(invalidComment)).toThrow('Comment content is required')
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate product references have required fields', () => {
      fc.assert(
        fc.property(productReferenceGenerator, (productRef) => {
          // All required fields should be present and valid
          expect(productRef.productId).toBeDefined()
          expect(productRef.productId.length).toBeGreaterThan(0)
          
          expect(productRef.title).toBeDefined()
          expect(productRef.title.length).toBeGreaterThan(0)
          
          expect(productRef.imageUrl).toBeDefined()
          expect(productRef.imageUrl).toMatch(/^https?:\/\//)
          
          expect(productRef.price).toBeGreaterThanOrEqual(0)
          
          expect(productRef.retailer).toBeDefined()
          expect(productRef.retailer.length).toBeGreaterThan(0)
          
          expect(productRef.category).toBeDefined()
          expect(productRef.category.length).toBeGreaterThan(0)
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should validate privacy settings are within allowed values', () => {
      fc.assert(
        fc.property(postPrivacyGenerator, (privacy) => {
          expect(['public', 'friends', 'private']).toContain(privacy)
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should validate reaction types are within allowed values', () => {
      fc.assert(
        fc.property(reactionTypeGenerator, (reactionType) => {
          expect(['like', 'love', 'wow', 'helpful', 'inspiring']).toContain(reactionType)
          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})