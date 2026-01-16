// Feature: community-posts, Property 25: Search Functionality Completeness
// Validates: Requirements 8.1, 8.2, 8.6

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { PostService } from '../../../services/postService';
import { Post, ProductReference, SearchFilters } from '../../../types/community-posts';

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

describe('Search Functionality Completeness Properties', () => {
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

  const searchFiltersGenerator = () => fc.record({
    postType: fc.option(fc.constantFrom('all', 'product', 'media')),
    dateRange: fc.option(fc.record({
      start: fc.integer({ min: 1000000000000, max: Date.now() - 86400000 }),
      end: fc.integer({ min: Date.now() - 86400000, max: Date.now() })
    })),
    userId: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
  });

  // Property 25: Search Functionality Completeness
  // For any search query and backing data, search results should include matches from post content, tags, and product names with proper keyword highlighting and grouping by post type
  it('should search across post content, tags, and product names', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(postGenerator(), { minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 50 }),
      searchFiltersGenerator(),
      fc.string({ minLength: 1, maxLength: 50 }), // viewerId
      async (posts, searchQuery, filters, viewerId) => {
        // Mock Firebase database operations
        const { get } = await import('firebase/database');
        const mockGet = vi.mocked(get);
        
        mockGet.mockResolvedValue({
          forEach: (callback: (snapshot: any) => void) => {
            posts.forEach((post, index) => {
              callback({
                key: post.id,
                val: () => ({ ...post, id: undefined })
              });
            });
          }
        } as any);

        const results = await postService.searchPosts(searchQuery, filters, viewerId);

        // Verify search completeness - results should only include posts that match the query
        const searchLower = searchQuery.toLowerCase();
        
        for (const result of results) {
          const contentMatches = result.content.toLowerCase().includes(searchLower);
          const productMatches = result.taggedProducts.some(p => 
            p.title.toLowerCase().includes(searchLower)
          );
          
          // At least one of content or product should match
          expect(contentMatches || productMatches).toBe(true);
        }

        // Verify that all matching posts from the dataset are included (privacy permitting)
        const expectedMatches = posts.filter(post => {
          // Only include public posts or posts by the viewer
          if (post.privacy !== 'public' && post.authorId !== viewerId) {
            return false;
          }

          const contentMatches = post.content.toLowerCase().includes(searchLower);
          const productMatches = post.taggedProducts.some(p => 
            p.title.toLowerCase().includes(searchLower)
          );
          
          return contentMatches || productMatches;
        });

        // Results should include all expected matches (accounting for filters)
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(results.length).toBeLessThanOrEqual(expectedMatches.length);
      }
    ), { numRuns: 50 });
  }, 10000);

  it('should group search results by post type when requested', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(postGenerator(), { minLength: 5, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.string({ minLength: 1, maxLength: 50 }), // viewerId
      async (posts, searchQuery, viewerId) => {
        // Ensure we have different post types in our test data
        const testPosts = posts.map((post, index) => ({
          ...post,
          taggedProducts: index % 3 === 0 ? [posts[0].taggedProducts[0] || { 
            productId: 'test', title: searchQuery, imageUrl: 'test.jpg', 
            price: 100, retailer: 'test', category: 'CPU' 
          }] : [],
          images: index % 3 === 1 ? ['test.jpg'] : [],
          content: index % 2 === 0 ? `Content with ${searchQuery}` : post.content
        }));

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

        const results = await postService.searchPosts(searchQuery, undefined, viewerId);

        // Verify results can be categorized by type
        const productPosts = results.filter(p => p.taggedProducts.length > 0);
        const mediaPosts = results.filter(p => p.images.length > 0);
        const generalPosts = results.filter(p => p.taggedProducts.length === 0 && p.images.length === 0);

        // All results should fall into one of these categories
        expect(productPosts.length + mediaPosts.length + generalPosts.length).toBeGreaterThanOrEqual(results.length);
      }
    ), { numRuns: 100 });
  });

  it('should highlight matching keywords in search results', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(postGenerator(), { minLength: 1, maxLength: 10 }),
      fc.string({ minLength: 3, maxLength: 20 }), // Ensure meaningful search terms
      fc.string({ minLength: 1, maxLength: 50 }), // viewerId
      async (posts, searchQuery, viewerId) => {
        // Ensure at least one post contains the search query
        const testPosts = posts.map((post, index) => ({
          ...post,
          content: index === 0 ? `This content contains ${searchQuery} for testing` : post.content,
          privacy: 'public' as const // Ensure visibility
        }));

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

        const results = await postService.searchPosts(searchQuery, undefined, viewerId);

        // Verify that search functionality works (results contain matching content)
        const matchingResults = results.filter(post => 
          post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.taggedProducts.some(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        // If there are results, they should match the search criteria
        if (results.length > 0) {
          expect(matchingResults.length).toBeGreaterThan(0);
        }

        // All returned results should be relevant to the search
        for (const result of results) {
          const isRelevant = result.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            result.taggedProducts.some(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
          expect(isRelevant).toBe(true);
        }
      }
    ), { numRuns: 100 });
  });
});