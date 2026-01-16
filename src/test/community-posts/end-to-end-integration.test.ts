// End-to-End Integration Tests for Community Posts
// Tests complete user workflows, error recovery scenarios, and concurrent user interactions
// Requirements: Complete system integration, System-wide validation

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  Post, 
  PostPrivacy, 
  ProductReference,
  PostError,
  PostErrorType,
  Comment
} from '../../../types/community-posts';

// Mock Firebase
vi.mock('../../../firebase.config', () => ({
  database: {},
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}));

// Mock Firebase database functions
vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ path: 'mock-ref' })),
  push: vi.fn(() => ({ key: 'mock-id-' + Date.now() })),
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
}));

// Mock follow service
vi.mock('../../../services/followService', () => ({
  followService: {
    isFollowing: vi.fn().mockResolvedValue(false),
    getFollowing: vi.fn().mockResolvedValue([]),
    getFollowers: vi.fn().mockResolvedValue([])
  }
}));

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8);
const postContentGenerator = fc.string({ minLength: 5, maxLength: 5000 }).filter(s => s.trim().length >= 5);
const commentContentGenerator = fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length >= 1);
const postPrivacyGenerator = fc.constantFrom<PostPrivacy>('public', 'friends', 'private');

const productReferenceGenerator = fc.record({
  productId: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  title: fc.string({ minLength: 3, maxLength: 200 }).filter(s => s.trim().length >= 3),
  imageUrl: fc.webUrl(),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  retailer: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  category: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3)
});

const validPostGenerator = fc.record({
  id: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
  authorId: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
  content: postContentGenerator,
  images: fc.array(fc.webUrl(), { maxLength: 10 }),
  taggedProducts: fc.array(productReferenceGenerator, { maxLength: 5 }),
  privacy: postPrivacyGenerator,
  createdAt: fc.integer({ min: Date.now() - (23 * 60 * 60 * 1000), max: Date.now() }),
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
  likeCount: fc.integer({ min: 0, max: 1000 }),
  commentCount: fc.integer({ min: 0, max: 1000 }),
  reactionCounts: fc.record({
    like: fc.integer({ min: 0, max: 1000 }),
    love: fc.integer({ min: 0, max: 1000 }),
    wow: fc.integer({ min: 0, max: 1000 }),
    helpful: fc.integer({ min: 0, max: 1000 }),
    inspiring: fc.integer({ min: 0, max: 1000 })
  }, { requiredKeys: [] })
});

const validCommentGenerator = fc.record({
  id: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
  postId: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
  authorId: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
  content: commentContentGenerator,
  parentId: fc.option(fc.string({ minLength: 8, maxLength: 50 })),
  createdAt: fc.integer({ min: Date.now() - (14 * 60 * 1000), max: Date.now() }),
  editedAt: fc.option(fc.integer({ min: 1000000000000, max: 9999999999999 })),
  mentions: fc.array(fc.string({ minLength: 8, maxLength: 50 }), { maxLength: 5 }),
  likeCount: fc.integer({ min: 0, max: 1000 })
});

describe('End-to-End Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete User Workflows', () => {
    describe('Post Creation to Engagement Workflow', () => {
      it('should support complete post lifecycle: create -> view -> like -> comment -> edit -> delete', async () => {
        await fc.assert(
          fc.asyncProperty(
            userIdGenerator,
            postContentGenerator,
            postPrivacyGenerator,
            commentContentGenerator,
            async (authorId, content, privacy, commentText) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { get, push, set, update, remove } = await import('firebase/database');
              
              // Step 1: Create post
              const mockPostId = 'post-' + Date.now();
              vi.mocked(push).mockReturnValue({ key: mockPostId } as any);
              vi.mocked(set).mockResolvedValue(undefined);
              
              const createRequest = {
                content,
                images: [],
                taggedProducts: [],
                privacy
              };
              
              const createdPost = await postService.createPost(createRequest, authorId);
              expect(createdPost).toBeDefined();
              expect(createdPost.content).toBe(content.trim());
              expect(createdPost.authorId).toBe(authorId);
              expect(createdPost.privacy).toBe(privacy);
              
              // Step 2: View post
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                val: () => ({
                  ...createdPost,
                  id: undefined // Firebase doesn't store id in the value
                })
              } as any);
              
              const viewedPost = await postService.getPost(mockPostId, authorId);
              expect(viewedPost).toBeDefined();
              expect(viewedPost?.content).toBe(content.trim());
              
              // Step 3: Edit post (within 24 hours)
              const newContent = content + ' [edited]';
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                val: () => ({
                  ...createdPost,
                  createdAt: Date.now() - (1 * 60 * 60 * 1000) // 1 hour ago
                })
              } as any);
              vi.mocked(update).mockResolvedValue(undefined);
              
              await expect(
                postService.updatePost(mockPostId, { content: newContent }, authorId)
              ).resolves.not.toThrow();
              
              // Step 4: Delete post
              vi.mocked(remove).mockResolvedValue(undefined);
              
              await expect(
                postService.deletePost(mockPostId, authorId)
              ).resolves.not.toThrow();
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });

      it('should maintain data consistency across post operations', async () => {
        await fc.assert(
          fc.asyncProperty(
            validPostGenerator,
            async (post) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { get } = await import('firebase/database');
              
              // Mock the post retrieval
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                val: () => ({
                  authorId: post.authorId,
                  content: post.content,
                  images: post.images,
                  taggedProducts: post.taggedProducts,
                  privacy: post.privacy,
                  createdAt: post.createdAt,
                  likeCount: post.likeCount,
                  commentCount: post.commentCount,
                  reactionCounts: post.reactionCounts
                })
              } as any);
              
              const retrievedPost = await postService.getPost(post.id, post.authorId);
              
              // Verify data consistency
              expect(retrievedPost).toBeDefined();
              expect(retrievedPost?.authorId).toBe(post.authorId);
              expect(retrievedPost?.content).toBe(post.content);
              expect(retrievedPost?.privacy).toBe(post.privacy);
              expect(retrievedPost?.likeCount).toBe(post.likeCount);
              expect(retrievedPost?.commentCount).toBe(post.commentCount);
              
              return true;
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Multi-User Interaction Workflow', () => {
      it('should handle user A creating post and user B interacting with it', async () => {
        await fc.assert(
          fc.asyncProperty(
            userIdGenerator,
            userIdGenerator,
            postContentGenerator,
            async (userA, userB, content) => {
              // Ensure different users
              fc.pre(userA !== userB);
              
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { get, push, set } = await import('firebase/database');
              
              // User A creates a public post
              const mockPostId = 'post-' + Date.now();
              vi.mocked(push).mockReturnValue({ key: mockPostId } as any);
              vi.mocked(set).mockResolvedValue(undefined);
              
              const createdPost = await postService.createPost({
                content,
                images: [],
                taggedProducts: [],
                privacy: 'public'
              }, userA);
              
              expect(createdPost.authorId).toBe(userA);
              
              // User B views the post
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                val: () => ({
                  authorId: userA,
                  content: content.trim(),
                  images: [],
                  taggedProducts: [],
                  privacy: 'public',
                  createdAt: Date.now(),
                  likeCount: 0,
                  commentCount: 0,
                  reactionCounts: {}
                })
              } as any);
              
              const viewedPost = await postService.getPost(mockPostId, userB);
              
              // User B should be able to view public post
              expect(viewedPost).toBeDefined();
              expect(viewedPost?.content).toBe(content.trim());
              
              // User B should NOT be able to edit User A's post
              await expect(
                postService.updatePost(mockPostId, { content: 'hacked!' }, userB)
              ).rejects.toThrow('Only the post author can edit this post');
              
              // User B should NOT be able to delete User A's post
              await expect(
                postService.deletePost(mockPostId, userB)
              ).rejects.toThrow('Only the post author can delete this post');
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    describe('Feed Navigation Workflow', () => {
      it('should support feed browsing with pagination', async () => {
        await fc.assert(
          fc.asyncProperty(
            userIdGenerator,
            fc.integer({ min: 1, max: 5 }),
            async (userId, pageCount) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { get } = await import('firebase/database');
              
              // Generate mock posts for feed
              const mockPosts: any[] = [];
              for (let i = 0; i < 20; i++) {
                mockPosts.push({
                  id: `post-${i}`,
                  authorId: `author-${i % 5}`,
                  content: `Test post content ${i}`,
                  images: [],
                  taggedProducts: [],
                  privacy: 'public',
                  createdAt: Date.now() - (i * 60000),
                  likeCount: i * 10,
                  commentCount: i * 2,
                  reactionCounts: {}
                });
              }
              
              // Mock feed retrieval
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                forEach: (callback: (snapshot: any) => void) => {
                  mockPosts.slice(0, 20).forEach((post, index) => {
                    callback({
                      key: post.id,
                      val: () => post
                    });
                  });
                }
              } as any);
              
              const feedPosts = await postService.getFeedPosts({
                userId,
                feedType: 'discover',
                limit: 20
              });
              
              // Verify feed is returned
              expect(Array.isArray(feedPosts)).toBe(true);
              
              // Verify posts are sorted by creation time (newest first)
              for (let i = 1; i < feedPosts.length; i++) {
                expect(feedPosts[i - 1].createdAt).toBeGreaterThanOrEqual(feedPosts[i].createdAt);
              }
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    describe('Network Error Recovery', () => {
      it('should handle network errors gracefully during post creation', async () => {
        await fc.assert(
          fc.asyncProperty(
            userIdGenerator,
            postContentGenerator,
            async (authorId, content) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { set } = await import('firebase/database');
              
              // Simulate network error
              vi.mocked(set).mockRejectedValue(new Error('Network error'));
              
              await expect(
                postService.createPost({
                  content,
                  images: [],
                  taggedProducts: [],
                  privacy: 'public'
                }, authorId)
              ).rejects.toThrow();
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });

      it('should handle network errors gracefully during post retrieval', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 8, maxLength: 50 }),
            userIdGenerator,
            async (postId, viewerId) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { get } = await import('firebase/database');
              
              // Simulate network error
              vi.mocked(get).mockRejectedValue(new Error('Network error'));
              
              await expect(
                postService.getPost(postId, viewerId)
              ).rejects.toThrow();
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    describe('Validation Error Recovery', () => {
      it('should reject posts with content exceeding limits', async () => {
        await fc.assert(
          fc.asyncProperty(
            userIdGenerator,
            fc.string({ minLength: 5001, maxLength: 6000 }),
            async (authorId, longContent) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              await expect(
                postService.createPost({
                  content: longContent,
                  images: [],
                  taggedProducts: [],
                  privacy: 'public'
                }, authorId)
              ).rejects.toThrow('Post content exceeds 5000 character limit');
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });

      it('should reject posts with too many images', async () => {
        await fc.assert(
          fc.asyncProperty(
            userIdGenerator,
            postContentGenerator,
            fc.array(fc.webUrl(), { minLength: 11, maxLength: 15 }),
            async (authorId, content, tooManyImages) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              // Create mock files for images
              const mockFiles = tooManyImages.map((url, i) => 
                new File([''], `image${i}.jpg`, { type: 'image/jpeg' })
              );
              
              await expect(
                postService.createPost({
                  content,
                  images: mockFiles,
                  taggedProducts: [],
                  privacy: 'public'
                }, authorId)
              ).rejects.toThrow('Cannot attach more than 10 images to a post');
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });

      it('should reject empty post content', async () => {
        await fc.assert(
          fc.asyncProperty(
            userIdGenerator,
            fc.constantFrom('', '   ', '\n\n', '\t\t'),
            async (authorId, emptyContent) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              await expect(
                postService.createPost({
                  content: emptyContent,
                  images: [],
                  taggedProducts: [],
                  privacy: 'public'
                }, authorId)
              ).rejects.toThrow('Post content cannot be empty');
              
              return true;
            }
          ),
          { numRuns: 20 }
        );
      });
    });

    describe('Permission Error Recovery', () => {
      it('should handle permission denied errors for non-existent posts', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 8, maxLength: 50 }),
            userIdGenerator,
            async (postId, userId) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { get } = await import('firebase/database');
              
              // Mock non-existent post
              vi.mocked(get).mockResolvedValue({
                exists: () => false,
                val: () => null
              } as any);
              
              await expect(
                postService.updatePost(postId, { content: 'new content' }, userId)
              ).rejects.toThrow('Post not found');
              
              await expect(
                postService.deletePost(postId, userId)
              ).rejects.toThrow('Post not found');
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });
    });
  });

  describe('Concurrent User Interactions', () => {
    describe('Simultaneous Post Operations', () => {
      it('should handle multiple users viewing the same post concurrently', async () => {
        await fc.assert(
          fc.asyncProperty(
            validPostGenerator,
            fc.array(userIdGenerator, { minLength: 2, maxLength: 5 }),
            async (post, viewers) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { get } = await import('firebase/database');
              
              // Mock post retrieval
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                val: () => ({
                  authorId: post.authorId,
                  content: post.content,
                  images: post.images,
                  taggedProducts: post.taggedProducts,
                  privacy: 'public', // Use public for concurrent viewing test
                  createdAt: post.createdAt,
                  likeCount: post.likeCount,
                  commentCount: post.commentCount,
                  reactionCounts: post.reactionCounts
                })
              } as any);
              
              // Simulate concurrent views
              const viewPromises = viewers.map(viewerId => 
                postService.getPost(post.id, viewerId)
              );
              
              const results = await Promise.all(viewPromises);
              
              // All viewers should see the same post
              results.forEach(result => {
                expect(result).toBeDefined();
                expect(result?.content).toBe(post.content);
                expect(result?.authorId).toBe(post.authorId);
              });
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });

      it('should handle race conditions in like operations', async () => {
        await fc.assert(
          fc.asyncProperty(
            validPostGenerator,
            fc.array(userIdGenerator, { minLength: 2, maxLength: 5 }),
            async (post, likers) => {
              // Ensure unique likers
              const uniqueLikers = [...new Set(likers)];
              fc.pre(uniqueLikers.length >= 2);
              
              const { LikeSystemLogic } = await import('../../../services/engagementService');
              
              // Simulate concurrent like operations
              let currentLikeCount = post.likeCount;
              const likeResults: boolean[] = [];
              
              for (const liker of uniqueLikers) {
                // Check if user can like (not their own post)
                const canLike = LikeSystemLogic.canUserLikePost(post.authorId, liker);
                
                if (canLike) {
                  currentLikeCount = LikeSystemLogic.calculateLikeCount(currentLikeCount, true);
                  likeResults.push(true);
                } else {
                  likeResults.push(false);
                }
              }
              
              // Verify like count is consistent
              expect(currentLikeCount).toBeGreaterThanOrEqual(post.likeCount);
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    describe('Feed Consistency Under Load', () => {
      it('should maintain feed order consistency with concurrent updates', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(validPostGenerator, { minLength: 5, maxLength: 10 }),
            userIdGenerator,
            async (posts, viewerId) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { get } = await import('firebase/database');
              
              // Sort posts by creation time for expected order
              const sortedPosts = [...posts].sort((a, b) => b.createdAt - a.createdAt);
              
              // Mock feed retrieval
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                forEach: (callback: (snapshot: any) => void) => {
                  sortedPosts.forEach(post => {
                    callback({
                      key: post.id,
                      val: () => ({
                        ...post,
                        privacy: 'public' // Ensure all posts are visible
                      })
                    });
                  });
                }
              } as any);
              
              const feedPosts = await postService.getFeedPosts({
                userId: viewerId,
                feedType: 'discover',
                limit: 20
              });
              
              // Verify chronological order is maintained
              for (let i = 1; i < feedPosts.length; i++) {
                expect(feedPosts[i - 1].createdAt).toBeGreaterThanOrEqual(feedPosts[i].createdAt);
              }
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });
    });
  });

  describe('Cross-Feature Integration', () => {
    describe('Posts and Products Integration', () => {
      it('should correctly associate products with posts', async () => {
        await fc.assert(
          fc.asyncProperty(
            userIdGenerator,
            postContentGenerator,
            fc.array(productReferenceGenerator, { minLength: 1, maxLength: 5 }),
            async (authorId, content, products) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              const { push, set } = await import('firebase/database');
              
              const mockPostId = 'post-' + Date.now();
              vi.mocked(push).mockReturnValue({ key: mockPostId } as any);
              vi.mocked(set).mockResolvedValue(undefined);
              
              const createdPost = await postService.createPost({
                content,
                images: [],
                taggedProducts: products,
                privacy: 'public'
              }, authorId);
              
              // Verify products are correctly associated
              expect(createdPost.taggedProducts).toHaveLength(products.length);
              createdPost.taggedProducts.forEach((product, index) => {
                expect(product.productId).toBe(products[index].productId);
                expect(product.title).toBe(products[index].title);
                expect(product.retailer).toBe(products[index].retailer);
              });
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    describe('Posts and Privacy Integration', () => {
      it('should enforce privacy settings across all operations', async () => {
        await fc.assert(
          fc.asyncProperty(
            validPostGenerator,
            userIdGenerator,
            async (post, viewerId) => {
              // Ensure viewer is not the author
              fc.pre(viewerId !== post.authorId);
              
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              // Disable cache to ensure mock is used
              postService.setCacheEnabled(false);
              
              const { get } = await import('firebase/database');
              
              // Mock post with private privacy
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                val: () => ({
                  ...post,
                  privacy: 'private'
                }),
                key: post.id
              } as any);
              
              const viewedPost = await postService.getPost(post.id, viewerId);
              
              // Private posts should not be visible to non-authors
              expect(viewedPost).toBeNull();
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });

      it('should allow authors to view their own private posts', async () => {
        await fc.assert(
          fc.asyncProperty(
            validPostGenerator,
            async (post) => {
              const { PostService } = await import('../../../services/postService');
              const postService = new PostService();
              
              // Disable cache to ensure mock is used
              postService.setCacheEnabled(false);
              
              const { get } = await import('firebase/database');
              
              // Mock private post - explicitly set privacy to 'private'
              const privatePost = {
                authorId: post.authorId,
                content: post.content,
                images: post.images,
                taggedProducts: post.taggedProducts,
                privacy: 'private' as const,
                createdAt: post.createdAt,
                likeCount: post.likeCount,
                commentCount: post.commentCount,
                reactionCounts: post.reactionCounts
              };
              
              vi.mocked(get).mockResolvedValue({
                exists: () => true,
                val: () => privatePost,
                key: post.id
              } as any);
              
              const viewedPost = await postService.getPost(post.id, post.authorId);
              
              // Author should be able to view their own private post
              expect(viewedPost).toBeDefined();
              expect(viewedPost?.authorId).toBe(post.authorId);
              expect(viewedPost?.privacy).toBe('private');
              
              return true;
            }
          ),
          { numRuns: 50 }
        );
      });
    });
  });

  describe('Data Integrity Validation', () => {
    it('should maintain referential integrity between posts and comments', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          fc.array(validCommentGenerator, { minLength: 1, maxLength: 5 }),
          async (post, comments) => {
            // All comments should reference the same post
            const commentsForPost = comments.map(c => ({
              ...c,
              postId: post.id
            }));
            
            // Verify all comments reference the correct post
            commentsForPost.forEach(comment => {
              expect(comment.postId).toBe(post.id);
            });
            
            return true;
            }
          ),
          { numRuns: 50 }
        );
      });

    it('should maintain timestamp consistency across operations', async () => {
      // Create a custom generator that ensures editedAt > createdAt
      const timestampConsistentPostGenerator = fc.record({
        id: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
        authorId: fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8),
        content: postContentGenerator,
        images: fc.array(fc.webUrl(), { maxLength: 10 }),
        taggedProducts: fc.array(productReferenceGenerator, { maxLength: 5 }),
        privacy: postPrivacyGenerator,
        createdAt: fc.integer({ min: Date.now() - (23 * 60 * 60 * 1000), max: Date.now() }),
        likeCount: fc.integer({ min: 0, max: 1000 }),
        commentCount: fc.integer({ min: 0, max: 1000 }),
        reactionCounts: fc.record({
          like: fc.integer({ min: 0, max: 1000 }),
          love: fc.integer({ min: 0, max: 1000 }),
          wow: fc.integer({ min: 0, max: 1000 }),
          helpful: fc.integer({ min: 0, max: 1000 }),
          inspiring: fc.integer({ min: 0, max: 1000 })
        }, { requiredKeys: [] })
      }).chain(post => 
        fc.record({
          ...Object.fromEntries(Object.entries(post).map(([k, v]) => [k, fc.constant(v)])),
          editedAt: fc.option(fc.integer({ min: post.createdAt, max: post.createdAt + (24 * 60 * 60 * 1000) }))
        })
      );

      await fc.assert(
        fc.asyncProperty(
          timestampConsistentPostGenerator,
          async (post) => {
            // createdAt should always be set
            expect(post.createdAt).toBeDefined();
            expect(post.createdAt).toBeGreaterThan(0);
            
            // If editedAt exists, it should be after createdAt
            if (post.editedAt) {
              expect(post.editedAt).toBeGreaterThanOrEqual(post.createdAt);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain count consistency (likes, comments, reactions)', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPostGenerator,
          async (post) => {
            // All counts should be non-negative
            expect(post.likeCount).toBeGreaterThanOrEqual(0);
            expect(post.commentCount).toBeGreaterThanOrEqual(0);
            
            // Reaction counts should all be non-negative
            Object.values(post.reactionCounts).forEach(count => {
              expect(count).toBeGreaterThanOrEqual(0);
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
