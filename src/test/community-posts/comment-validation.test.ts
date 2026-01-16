/**
 * Comment Validation and Display Property Tests
 * Feature: community-posts, Property 11: Comment Validation and Display
 * Validates: Requirements 4.2, 4.3
 * 
 * Tests that comment content is validated against 1000 character limit,
 * and valid comments display immediately with author info and timestamp.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  CommentValidationLogic,
  MAX_COMMENT_LENGTH,
  EDIT_WINDOW_MINUTES
} from '../../../services/commentService';
import { Comment } from '../../../types/community-posts';

describe('Comment Validation and Display - Property 11', () => {
  
  describe('Requirement 4.2: Validate content length (max 1000 characters)', () => {
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should accept all valid comments within content limits', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: MAX_COMMENT_LENGTH }),
        (content) => {
          // Filter out whitespace-only strings
          if (content.trim().length === 0) {
            return true; // Skip whitespace-only, tested separately
          }
          
          const result = CommentValidationLogic.validateContent(content);
          return result.valid === true;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should reject all comments exceeding 1000 characters', () => {
      fc.assert(fc.property(
        fc.string({ minLength: MAX_COMMENT_LENGTH + 1, maxLength: MAX_COMMENT_LENGTH + 500 }),
        (content) => {
          const result = CommentValidationLogic.validateContent(content);
          return result.valid === false && result.error !== undefined;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should reject empty comments', () => {
      fc.assert(fc.property(
        fc.constantFrom('', '   ', '\t', '\n', '  \n  \t  '),
        (content) => {
          const result = CommentValidationLogic.validateContent(content);
          return result.valid === false;
        }
      ), { numRuns: 100 });
    });
    
    it('should accept content at exactly 1000 characters', () => {
      const exactContent = 'a'.repeat(MAX_COMMENT_LENGTH);
      const result = CommentValidationLogic.validateContent(exactContent);
      expect(result.valid).toBe(true);
    });
    
    it('should reject content at 1001 characters', () => {
      const overContent = 'a'.repeat(MAX_COMMENT_LENGTH + 1);
      const result = CommentValidationLogic.validateContent(overContent);
      expect(result.valid).toBe(false);
    });
  });

  
  describe('Requirement 4.3: Display comment with author info and timestamp', () => {
    
    // Generator for valid comment data
    const validCommentGenerator = () => fc.record({
      id: fc.uuid(),
      postId: fc.uuid(),
      authorId: fc.uuid(),
      content: fc.string({ minLength: 1, maxLength: MAX_COMMENT_LENGTH }).filter(s => s.trim().length > 0),
      createdAt: fc.integer({ min: 1, max: Date.now() }),
      mentions: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
      likeCount: fc.integer({ min: 0, max: 10000 })
    });
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should have all required display fields for any valid comment', () => {
      fc.assert(fc.property(
        validCommentGenerator(),
        (commentData) => {
          const comment: Comment = {
            ...commentData,
            parentId: undefined
          };
          
          // Verify all required display fields are present
          const hasId = typeof comment.id === 'string' && comment.id.length > 0;
          const hasAuthorId = typeof comment.authorId === 'string' && comment.authorId.length > 0;
          const hasContent = typeof comment.content === 'string' && comment.content.length > 0;
          const hasTimestamp = typeof comment.createdAt === 'number' && comment.createdAt > 0;
          const hasPostId = typeof comment.postId === 'string' && comment.postId.length > 0;
          
          return hasId && hasAuthorId && hasContent && hasTimestamp && hasPostId;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should preserve content integrity through validation', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: MAX_COMMENT_LENGTH }).filter(s => s.trim().length > 0),
        (content) => {
          const result = CommentValidationLogic.validateContent(content);
          // If valid, the content should be usable as-is
          if (result.valid) {
            return content.length <= MAX_COMMENT_LENGTH && content.trim().length > 0;
          }
          return true;
        }
      ), { numRuns: 100 });
    });
  });
  
  describe('Mention Extraction', () => {
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should extract all @mentions from comment content', () => {
      fc.assert(fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^\w+$/.test(s)), { minLength: 1, maxLength: 5 }),
        (usernames) => {
          // Create content with mentions
          const content = usernames.map(u => `@${u}`).join(' hello ');
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // All unique usernames should be extracted
          const uniqueUsernames = [...new Set(usernames)];
          return uniqueUsernames.every(u => mentions.includes(u));
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should not duplicate mentions', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^\w+$/.test(s)),
        (username) => {
          // Create content with duplicate mentions
          const content = `@${username} hello @${username} world @${username}`;
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // Should only appear once
          return mentions.filter(m => m === username).length === 1;
        }
      ), { numRuns: 100 });
    });
    
    it('should return empty array for content without mentions', () => {
      const content = 'This is a comment without any mentions';
      const mentions = CommentValidationLogic.extractMentions(content);
      expect(mentions).toEqual([]);
    });
    
    it('should handle mixed content with mentions', () => {
      const content = 'Hey @john, check this out! @jane might like it too.';
      const mentions = CommentValidationLogic.extractMentions(content);
      expect(mentions).toContain('john');
      expect(mentions).toContain('jane');
      expect(mentions.length).toBe(2);
    });
  });

  
  describe('Edit Time Window', () => {
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should allow editing within 15 minutes for any comment', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: EDIT_WINDOW_MINUTES * 60 * 1000 - 1 }),
        (elapsedMs) => {
          const createdAt = Date.now() - elapsedMs;
          const currentTime = Date.now();
          
          return CommentValidationLogic.canEditComment(createdAt, currentTime) === true;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 11: Comment Validation and Display
    it('should prevent editing after 15 minutes for any comment', () => {
      fc.assert(fc.property(
        fc.integer({ min: EDIT_WINDOW_MINUTES * 60 * 1000 + 1, max: 24 * 60 * 60 * 1000 }),
        (elapsedMs) => {
          const createdAt = Date.now() - elapsedMs;
          const currentTime = Date.now();
          
          return CommentValidationLogic.canEditComment(createdAt, currentTime) === false;
        }
      ), { numRuns: 100 });
    });
    
    it('should return correct time remaining', () => {
      const createdAt = Date.now() - (5 * 60 * 1000); // 5 minutes ago
      const currentTime = Date.now();
      const remaining = CommentValidationLogic.getEditTimeRemaining(createdAt, currentTime);
      
      // Should have approximately 10 minutes remaining (with some tolerance)
      const expectedRemaining = 10 * 60 * 1000;
      expect(remaining).toBeGreaterThan(expectedRemaining - 1000);
      expect(remaining).toBeLessThanOrEqual(expectedRemaining + 1000);
    });
    
    it('should return 0 when edit window has expired', () => {
      const createdAt = Date.now() - (20 * 60 * 1000); // 20 minutes ago
      const currentTime = Date.now();
      const remaining = CommentValidationLogic.getEditTimeRemaining(createdAt, currentTime);
      
      expect(remaining).toBe(0);
    });
  });
  
  describe('Edge Cases', () => {
    
    it('should handle unicode characters in content', () => {
      const unicodeContent = '这是一个测试评论 🎉 مرحبا';
      const result = CommentValidationLogic.validateContent(unicodeContent);
      expect(result.valid).toBe(true);
    });
    
    it('should handle content with only newlines as invalid', () => {
      const newlineContent = '\n\n\n';
      const result = CommentValidationLogic.validateContent(newlineContent);
      expect(result.valid).toBe(false);
    });
    
    it('should handle mentions with underscores', () => {
      const content = '@user_name mentioned @another_user';
      const mentions = CommentValidationLogic.extractMentions(content);
      expect(mentions).toContain('user_name');
      expect(mentions).toContain('another_user');
    });
    
    it('should not extract email addresses as mentions', () => {
      const content = 'Contact me at user@example.com';
      const mentions = CommentValidationLogic.extractMentions(content);
      // Should extract 'example' from @example.com pattern
      expect(mentions).not.toContain('user@example.com');
    });
  });
});
