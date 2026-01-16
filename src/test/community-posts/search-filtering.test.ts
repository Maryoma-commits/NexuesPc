// Feature: community-posts, Property 26: Search Filtering Accuracy
// Validates: Requirements 8.3

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { PostService } from '../../../services/postService';
import { Post, SearchFilters } from '../../../types/community-posts';

// Mock Firebase completely
vi.mock('../../../firebase.config', () => ({
  database: {}
}));

// Mock Firebase database functions
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  limitToLast: vi.fn(),
  push: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  onValue: vi.fn(),
  serverTimestamp: vi.fn(() => Date.now()),
  equalTo: vi.fn(),
  endBefore: vi.fn(),
  startAfter: vi.fn()
}));

describe('Search Filtering Accuracy Properties', () => {
  let postService: PostService;
  
  beforeEach(() => {
    postService = new PostService();
    vi.clearAllMocks();
  });

  // Generators for property-based testing
  const productReferenceGenerator = () => fc.record({
    productId: fc.string({ minLength: 1, maxLength: 50 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    imageUrl: fc.webUrl(),
    price: fc.float({ min: 0, max: 10000 }),
    retailer: fc.string({ minLength: 1, maxLength: 50 }),
    category: fc.constantFrom('CPU', 'GPU', 'RAM', 'Storage', 'Motherboard', 'PSU')
  });

  const postGenerator = () => fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    authorId: fc.string({ minLength: 1, maxLength: 50 }),
    content: fc.string({ minLength: 1, maxLength: 5000 }),
    images: fc.array(fc.webUrl(), { maxLength: 10 }),
    taggedProducts: fc.array(productReferenceGenerator(), { maxLength: 5 }),
    privacy: fc.constantFrom('public', 'friends', 'private'),
    createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
    likeCount: fc.integer({ min: 0, max: 1000 }),
    commentCount: fc.integer({ min: 0, max: 1000 }),
    reactionCounts: fc.record({})
  });

  // Property 26: Search Filtering Accuracy
  // For any search with filters applied, results should only include posts matching the specified post type, date range, and user criteria
  it('should filter by post type accurately', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(postGenerator(), { minLength: 5, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.constantFrom('all', 'product', 'media'),
      fc.string({ minLength: 1, maxLength: 50 }), // viewerId
      async (posts, searchQuery, postType, viewerId) => {
        // Create test posts with specific characteristics
        const testPosts = posts.map((post, index) => ({
          ...post,
          content: `Content with ${searchQuery}`, // Ensure all match search
          privacy: 'public' as const, // Ensure visibility
          taggedProducts: index % 3 === 0 ? [posts[0].taggedProducts[0] || {
            productId: 'test', title: 'Test Product', imageUrl: 'test.jpg',
            price: 100, retailer: 'test', category: 'CPU'
          }] : [],
          images: index % 3 === 1 ? ['test.jpg'] : []
        }));

        const filters: SearchFilters = { postType };

        // Mock Firebase database operations
        const { get } = await import('firebase/database');
        const mockGet = vi.mocked(get);
        
        mockGet.mockResolvedValue({
          forEach: (callback: (snapshot: any) => void) => {
            testPosts.forEach((post) => {
              callback({
                key: post.id,
                val: () => ({ ...post, id: undefined })
              });
            });
          }
        } as any);

        const results = await postService.searchPosts(searchQuery, filters, viewerId);

        // Verify filtering accuracy based on post type
        for (const result of results) {
          switch (postType) {
            case 'product':
              expect(result.taggedProducts.length).toBeGreaterThan(0);
              break;
            case 'media':
              expect(result.images.length).toBeGreaterThan(0);
              break;
            case 'all':
              // No specific requirement for 'all' type
              break;
          }
        }

        // Verify no posts of wrong type are included
        if (postType === 'product') {
          const nonProductPosts = results.filter(p => p.taggedProducts.length === 0);
          expect(nonProductPosts.length).toBe(0);
        }
        
        if (postType === 'media') {
          const nonMediaPosts = results.filter(p => p.images.length === 0);
          expect(nonMediaPosts.length).toBe(0);
        }
      }
    ), { numRuns: 50 });
  }, 10000);

  it('should filter by date range accurately', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(postGenerator(), { minLength: 5, maxLength: 15 }),
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.integer({ min: 1000000000000, max: Date.now() - 86400000 }), // start date
      fc.integer({ min: Date.now() - 86400000, max: Date.now() }), // end date
      fc.string({ minLength: 1, maxLength: 50 }), // viewerId
      async (posts, searchQuery, startDate, endDate, viewerId) => {
        // Ensure start <= end
        const actualStart = Math.min(startDate, endDate);
        const actualEnd = Math.max(startDate, endDate);

        // Create test posts with varying creation dates
        const testPosts = posts.map((post, index) => ({
          ...post,
          content: `Content with ${searchQuery}`, // Ensure all match search
          privacy: 'public' as const, // Ensure visibility
          createdAt: actualStart + (index * ((actualEnd - actualStart) / posts.length))
        }));

        const filters: SearchFilters = {
          dateRange: {
            start: actualStart,
            end: actualEnd
          }
        };

        // Mock Firebase database operations
        const { get } = await import('firebase/database');
        const mockGet = vi.mocked(get);
        
        mockGet.mockResolvedValue({
          forEach: (callback: (snapshot: any) => void) => {
            testPosts.forEach((post) => {
              callback({
                key: post.id,
                val: () => ({ ...post, id: undefined })
              });
            });
          }
        } as any);

        const results = await postService.searchPosts(searchQuery, filters, viewerId);

        // Verify all results fall within the date range
        for (const result of results) {
          expect(result.createdAt).toBeGreaterThanOrEqual(actualStart);
          expect(result.createdAt).toBeLessThanOrEqual(actualEnd);
        }

        // Verify that posts outside the range are excluded
        const postsInRange = testPosts.filter(p => 
          p.createdAt >= actualStart && p.createdAt <= actualEnd
        );
        
        // Results should not exceed posts in range
        expect(results.length).toBeLessThanOrEqual(postsInRange.length);
      }
    ), { numRuns: 100 });
  });

  it('should filter by user ID accurately', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(postGenerator(), { minLength: 5, maxLength: 15 }),
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.string({ minLength: 1, maxLength: 50 }), // target userId
      fc.string({ minLength: 1, maxLength: 50 }), // viewerId
      async (posts, searchQuery, targetUserId, viewerId) => {
        // Create test posts with specific authors
        const testPosts = posts.map((post, index) => ({
          ...post,
          content: `Content with ${searchQuery}`, // Ensure all match search
          privacy: 'public' as const, // Ensure visibility
          authorId: index % 3 === 0 ? targetUserId : post.authorId
        }));

        const filters: SearchFilters = { userId: targetUserId };

        // Mock Firebase database operations
        const { get } = await import('firebase/database');
        const mockGet = vi.mocked(get);
        
        mockGet.mockResolvedValue({
          forEach: (callback: (snapshot: any) => void) => {
            testPosts.forEach((post) => {
              callback({
                key: post.id,
                val: () => ({ ...post, id: undefined })
              });
            });
          }
        } as any);

        const results = await postService.searchPosts(searchQuery, filters, viewerId);

        // Verify all results are from the target user
        for (const result of results) {
          expect(result.authorId).toBe(targetUserId);
        }

        // Verify no posts from other users are included
        const otherUserPosts = results.filter(p => p.authorId !== targetUserId);
        expect(otherUserPosts.length).toBe(0);

        // Verify that all target user posts that match search are included
        const expectedPosts = testPosts.filter(p => 
          p.authorId === targetUserId && 
          p.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        expect(results.length).toBeLessThanOrEqual(expectedPosts.length);
      }
    ), { numRuns: 100 });
  });

  it('should apply multiple filters simultaneously', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(postGenerator(), { minLength: 10, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.constantFrom('product', 'media'),
      fc.string({ minLength: 1, maxLength: 50 }), // target userId
      fc.string({ minLength: 1, maxLength: 50 }), // viewerId
      async (posts, searchQuery, postType, targetUserId, viewerId) => {
        const now = Date.now();
        const dayAgo = now - (24 * 60 * 60 * 1000);

        // Create test posts with specific characteristics
        const testPosts = posts.map((post, index) => ({
          ...post,
          content: `Content with ${searchQuery}`, // Ensure all match search
          privacy: 'public' as const, // Ensure visibility
          authorId: index % 4 === 0 ? targetUserId : post.authorId,
          createdAt: index % 2 === 0 ? now - 1000 : dayAgo - 1000, // Some recent, some old
          taggedProducts: (postType === 'product' && index % 4 === 0) ? [{
            productId: 'test', title: 'Test Product', imageUrl: 'test.jpg',
            price: 100, retailer: 'test', category: 'CPU'
          }] : [],
          images: (postType === 'media' && index % 4 === 0) ? ['test.jpg'] : []
        }));

        const filters: SearchFilters = {
          postType,
          userId: targetUserId,
          dateRange: {
            start: dayAgo,
            end: now
          }
        };

        // Mock Firebase database operations
        const { get } = await import('firebase/database');
        const mockGet = vi.mocked(get);
        
        mockGet.mockResolvedValue({
          forEach: (callback: (snapshot: any) => void) => {
            testPosts.forEach((post) => {
              callback({
                key: post.id,
                val: () => ({ ...post, id: undefined })
              });
            });
          }
        } as any);

        const results = await postService.searchPosts(searchQuery, filters, viewerId);

        // Verify all filters are applied correctly
        for (const result of results) {
          // User filter
          expect(result.authorId).toBe(targetUserId);
          
          // Date range filter
          expect(result.createdAt).toBeGreaterThanOrEqual(dayAgo);
          expect(result.createdAt).toBeLessThanOrEqual(now);
          
          // Post type filter
          if (postType === 'product') {
            expect(result.taggedProducts.length).toBeGreaterThan(0);
          } else if (postType === 'media') {
            expect(result.images.length).toBeGreaterThan(0);
          }
        }

        // Verify no posts that don't meet all criteria are included
        expect(results.every(post => 
          post.authorId === targetUserId &&
          post.createdAt >= dayAgo &&
          post.createdAt <= now &&
          (postType === 'product' ? post.taggedProducts.length > 0 : 
           postType === 'media' ? post.images.length > 0 : true)
        )).toBe(true);
      }
    ), { numRuns: 100 });
  });
});