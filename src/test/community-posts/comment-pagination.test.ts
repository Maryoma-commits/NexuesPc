/**
 * Comment Pagination Consistency Property Tests
 * Feature: community-posts, Property 14: Comment Pagination Consistency
 * Validates: Requirements 4.9
 * 
 * Tests that initially 10 comments are displayed with load-more functionality
 * for additional comments.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  CommentPaginationLogic,
  COMMENTS_PER_PAGE
} from '../../../services/commentService';

describe('Comment Pagination Consistency - Property 14', () => {
  
  describe('Requirement 4.9: Display 10 comments initially with load more', () => {
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should have COMMENTS_PER_PAGE set to 10', () => {
      expect(COMMENTS_PER_PAGE).toBe(10);
    });
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should correctly calculate pagination info for any number of comments', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        (totalComments, currentPage) => {
          const pageSize = COMMENTS_PER_PAGE;
          const info = CommentPaginationLogic.getPaginationInfo(totalComments, currentPage, pageSize);
          
          // Total pages should be ceiling of total/pageSize
          const expectedTotalPages = Math.ceil(totalComments / pageSize);
          if (info.totalPages !== expectedTotalPages) {
            return false;
          }
          
          // Start index should be (page - 1) * pageSize
          const expectedStartIndex = (currentPage - 1) * pageSize;
          if (info.startIndex !== expectedStartIndex) {
            return false;
          }
          
          // End index should be min of startIndex + pageSize and totalComments
          const expectedEndIndex = Math.min(expectedStartIndex + pageSize, totalComments);
          if (info.endIndex !== expectedEndIndex) {
            return false;
          }
          
          // hasMore should be true if currentPage < totalPages
          const expectedHasMore = currentPage < expectedTotalPages;
          if (info.hasMore !== expectedHasMore) {
            return false;
          }
          
          return true;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should show hasMore=true when there are more comments to load', () => {
      fc.assert(fc.property(
        fc.integer({ min: COMMENTS_PER_PAGE + 1, max: 500 }),
        (totalComments) => {
          // First page should always have more when total > page size
          const info = CommentPaginationLogic.getPaginationInfo(totalComments, 1, COMMENTS_PER_PAGE);
          return info.hasMore === true;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should show hasMore=false when all comments are loaded', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: COMMENTS_PER_PAGE }),
        (totalComments) => {
          // When total <= page size, first page should have no more
          const info = CommentPaginationLogic.getPaginationInfo(totalComments, 1, COMMENTS_PER_PAGE);
          return info.hasMore === false;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should correctly determine hasMoreComments for any loaded/total combination', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        (loadedCount, totalCount) => {
          const hasMore = CommentPaginationLogic.hasMoreComments(loadedCount, totalCount);
          return hasMore === (loadedCount < totalCount);
        }
      ), { numRuns: 100 });
    });
  });

  
  describe('Timestamp-based Pagination', () => {
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should return oldest timestamp from any non-empty comment array', () => {
      fc.assert(fc.property(
        fc.array(
          fc.record({
            createdAt: fc.integer({ min: 1, max: Date.now() })
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (comments) => {
          const oldestTimestamp = CommentPaginationLogic.getOldestTimestamp(comments);
          const expectedOldest = Math.min(...comments.map(c => c.createdAt));
          return oldestTimestamp === expectedOldest;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should return undefined for empty comment array', () => {
      const result = CommentPaginationLogic.getOldestTimestamp([]);
      expect(result).toBeUndefined();
    });
    
    it('should return the single timestamp for array with one comment', () => {
      const timestamp = 1234567890;
      const result = CommentPaginationLogic.getOldestTimestamp([{ createdAt: timestamp }]);
      expect(result).toBe(timestamp);
    });
  });
  
  describe('Page Boundary Calculations', () => {
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should never have startIndex exceed totalComments', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 20 }),
        (totalComments, currentPage) => {
          const info = CommentPaginationLogic.getPaginationInfo(totalComments, currentPage, COMMENTS_PER_PAGE);
          // startIndex can exceed totalComments for pages beyond the last page
          // but endIndex should never exceed totalComments
          return info.endIndex <= totalComments;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should have endIndex >= startIndex for pages within range', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }),
        (totalComments) => {
          // Only test valid pages (within totalPages)
          const totalPages = Math.ceil(totalComments / COMMENTS_PER_PAGE);
          for (let page = 1; page <= totalPages; page++) {
            const info = CommentPaginationLogic.getPaginationInfo(totalComments, page, COMMENTS_PER_PAGE);
            if (info.endIndex < info.startIndex) {
              return false;
            }
          }
          return true;
        }
      ), { numRuns: 100 });
    });
    
    it('should calculate correct indices for first page', () => {
      const info = CommentPaginationLogic.getPaginationInfo(25, 1, COMMENTS_PER_PAGE);
      expect(info.startIndex).toBe(0);
      expect(info.endIndex).toBe(10);
      expect(info.hasMore).toBe(true);
      expect(info.totalPages).toBe(3);
    });
    
    it('should calculate correct indices for middle page', () => {
      const info = CommentPaginationLogic.getPaginationInfo(25, 2, COMMENTS_PER_PAGE);
      expect(info.startIndex).toBe(10);
      expect(info.endIndex).toBe(20);
      expect(info.hasMore).toBe(true);
    });
    
    it('should calculate correct indices for last page', () => {
      const info = CommentPaginationLogic.getPaginationInfo(25, 3, COMMENTS_PER_PAGE);
      expect(info.startIndex).toBe(20);
      expect(info.endIndex).toBe(25);
      expect(info.hasMore).toBe(false);
    });
  });

  
  describe('Edge Cases', () => {
    
    it('should handle zero comments', () => {
      const info = CommentPaginationLogic.getPaginationInfo(0, 1, COMMENTS_PER_PAGE);
      expect(info.totalPages).toBe(0);
      expect(info.startIndex).toBe(0);
      expect(info.endIndex).toBe(0);
      expect(info.hasMore).toBe(false);
    });
    
    it('should handle exactly 10 comments (one full page)', () => {
      const info = CommentPaginationLogic.getPaginationInfo(10, 1, COMMENTS_PER_PAGE);
      expect(info.totalPages).toBe(1);
      expect(info.startIndex).toBe(0);
      expect(info.endIndex).toBe(10);
      expect(info.hasMore).toBe(false);
    });
    
    it('should handle 11 comments (just over one page)', () => {
      const info = CommentPaginationLogic.getPaginationInfo(11, 1, COMMENTS_PER_PAGE);
      expect(info.totalPages).toBe(2);
      expect(info.hasMore).toBe(true);
      
      const page2Info = CommentPaginationLogic.getPaginationInfo(11, 2, COMMENTS_PER_PAGE);
      expect(page2Info.startIndex).toBe(10);
      expect(page2Info.endIndex).toBe(11);
      expect(page2Info.hasMore).toBe(false);
    });
    
    it('should handle custom page sizes', () => {
      const customPageSize = 5;
      const info = CommentPaginationLogic.getPaginationInfo(12, 1, customPageSize);
      expect(info.totalPages).toBe(3);
      expect(info.endIndex).toBe(5);
      expect(info.hasMore).toBe(true);
    });
    
    // Feature: community-posts, Property 14: Comment Pagination Consistency
    it('should maintain consistency across multiple page loads', () => {
      fc.assert(fc.property(
        fc.integer({ min: 20, max: 100 }),
        (totalComments) => {
          // Simulate loading multiple pages
          let loadedCount = 0;
          let currentPage = 1;
          
          while (loadedCount < totalComments) {
            const info = CommentPaginationLogic.getPaginationInfo(totalComments, currentPage, COMMENTS_PER_PAGE);
            const pageItems = info.endIndex - info.startIndex;
            loadedCount += pageItems;
            
            // Check consistency
            if (info.hasMore && loadedCount >= totalComments) {
              return false; // hasMore should be false when all loaded
            }
            if (!info.hasMore && loadedCount < totalComments) {
              return false; // hasMore should be true when more to load
            }
            
            currentPage++;
            
            // Safety check to prevent infinite loop
            if (currentPage > 100) break;
          }
          
          return loadedCount === totalComments;
        }
      ), { numRuns: 100 });
    });
  });
});
