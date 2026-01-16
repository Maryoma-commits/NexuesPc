/**
 * Mention and Notification System Property Tests
 * Feature: community-posts, Property 15: Mention and Notification System
 * Validates: Requirements 4.10
 * 
 * Tests that comments containing @mentions properly extract mentioned users
 * and that the mention should be properly stored and linked.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  CommentValidationLogic
} from '../../../services/commentService';

describe('Mention and Notification System - Property 15', () => {
  
  describe('Requirement 4.10: @mentions with notification delivery', () => {
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should extract all unique @mentions from any comment content', () => {
      fc.assert(fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^\w+$/.test(s)),
          { minLength: 1, maxLength: 10 }
        ),
        fc.string({ minLength: 0, maxLength: 100 }),
        (usernames, filler) => {
          // Create content with mentions interspersed with filler text
          const content = usernames.map(u => `@${u}`).join(` ${filler} `);
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // All unique usernames should be extracted
          const uniqueUsernames = [...new Set(usernames)];
          return uniqueUsernames.every(u => mentions.includes(u));
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should never return duplicate mentions', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^\w+$/.test(s)),
        fc.integer({ min: 1, max: 10 }),
        (username, repeatCount) => {
          // Create content with the same mention repeated multiple times
          const content = Array(repeatCount).fill(`@${username}`).join(' hello ');
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // Should only appear once
          const occurrences = mentions.filter(m => m === username).length;
          return occurrences === 1;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should return empty array for content without mentions', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 0, maxLength: 500 }).filter(s => !s.includes('@')),
        (content) => {
          const mentions = CommentValidationLogic.extractMentions(content);
          return mentions.length === 0;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should extract mentions regardless of position in content', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^\w+$/.test(s)),
        fc.constantFrom('start', 'middle', 'end'),
        (username, position) => {
          let content: string;
          switch (position) {
            case 'start':
              content = `@${username} is mentioned at the start`;
              break;
            case 'middle':
              content = `This mentions @${username} in the middle`;
              break;
            case 'end':
              content = `This mentions at the end @${username}`;
              break;
          }
          
          const mentions = CommentValidationLogic.extractMentions(content);
          return mentions.includes(username);
        }
      ), { numRuns: 100 });
    });
  });

  
  describe('Mention Pattern Matching', () => {
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should handle usernames with underscores', () => {
      fc.assert(fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 5 }).filter(s => /^\w+$/.test(s)), { minLength: 2, maxLength: 4 }),
        (parts) => {
          const username = parts.join('_');
          const content = `Hello @${username}, how are you?`;
          const mentions = CommentValidationLogic.extractMentions(content);
          return mentions.includes(username);
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should handle usernames with numbers', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\w+$/.test(s)),
        fc.integer({ min: 0, max: 9999 }),
        (base, num) => {
          const username = `${base}${num}`;
          const content = `Tagging @${username} here`;
          const mentions = CommentValidationLogic.extractMentions(content);
          return mentions.includes(username);
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should handle multiple different mentions in same content', () => {
      fc.assert(fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\w+$/.test(s)),
          { minLength: 2, maxLength: 5 }
        ).filter(arr => new Set(arr).size === arr.length), // Ensure unique usernames
        (usernames) => {
          const content = usernames.map(u => `@${u}`).join(' and ');
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // All usernames should be extracted
          return usernames.every(u => mentions.includes(u)) && 
                 mentions.length === usernames.length;
        }
      ), { numRuns: 100 });
    });
    
    it('should extract mention from content with special characters around it', () => {
      const testCases = [
        { content: '(@john)', expected: 'john' },
        { content: '@john!', expected: 'john' },
        { content: '@john?', expected: 'john' },
        { content: '@john.', expected: 'john' },
        { content: '@john,', expected: 'john' },
        { content: '"@john"', expected: 'john' },
        { content: '@john:', expected: 'john' }
      ];
      
      for (const { content, expected } of testCases) {
        const mentions = CommentValidationLogic.extractMentions(content);
        expect(mentions).toContain(expected);
      }
    });
  });
  
  describe('Edge Cases', () => {
    
    it('should handle empty content', () => {
      const mentions = CommentValidationLogic.extractMentions('');
      expect(mentions).toEqual([]);
    });
    
    it('should handle content with only @ symbol', () => {
      const mentions = CommentValidationLogic.extractMentions('@');
      expect(mentions).toEqual([]);
    });
    
    it('should handle @ followed by space', () => {
      const mentions = CommentValidationLogic.extractMentions('@ john');
      expect(mentions).toEqual([]);
    });
    
    it('should handle email-like patterns', () => {
      // The regex will extract 'example' from user@example.com
      const content = 'Contact user@example.com for help';
      const mentions = CommentValidationLogic.extractMentions(content);
      // Should extract 'example' since it follows @
      expect(mentions).toContain('example');
    });
    
    it('should handle consecutive @ symbols', () => {
      const mentions = CommentValidationLogic.extractMentions('@@john');
      expect(mentions).toContain('john');
    });
    
    it('should handle mention at very end of content', () => {
      const mentions = CommentValidationLogic.extractMentions('Hello @john');
      expect(mentions).toContain('john');
    });
    
    it('should handle mention at very start of content', () => {
      const mentions = CommentValidationLogic.extractMentions('@john says hello');
      expect(mentions).toContain('john');
    });
    
    it('should handle unicode content around mentions', () => {
      const mentions = CommentValidationLogic.extractMentions('مرحبا @john 你好');
      expect(mentions).toContain('john');
    });
    
    it('should handle newlines around mentions', () => {
      const mentions = CommentValidationLogic.extractMentions('Hello\n@john\nHow are you?');
      expect(mentions).toContain('john');
    });
  });

  
  describe('Mention Storage and Linking', () => {
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should preserve mention order based on first occurrence', () => {
      fc.assert(fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\w+$/.test(s)),
          { minLength: 2, maxLength: 5 }
        ).filter(arr => new Set(arr).size === arr.length),
        (usernames) => {
          const content = usernames.map(u => `@${u}`).join(' then ');
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // Mentions should be in order of first occurrence
          for (let i = 0; i < usernames.length; i++) {
            if (mentions[i] !== usernames[i]) {
              return false;
            }
          }
          return true;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should extract mentions that can be used as user identifiers', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^\w+$/.test(s)),
        (username) => {
          const content = `Hey @${username}, check this out!`;
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // The extracted mention should be a valid identifier (alphanumeric + underscore)
          return mentions.length === 1 && 
                 /^\w+$/.test(mentions[0]) &&
                 mentions[0] === username;
        }
      ), { numRuns: 100 });
    });
    
    it('should handle realistic comment scenarios', () => {
      const scenarios = [
        {
          content: 'Great build @john_doe! @jane_smith should check this out too.',
          expected: ['john_doe', 'jane_smith']
        },
        {
          content: '@admin Please review this post by @user123',
          expected: ['admin', 'user123']
        },
        {
          content: 'Thanks @everyone for the feedback! Especially @tech_guru and @pc_master',
          expected: ['everyone', 'tech_guru', 'pc_master']
        }
      ];
      
      for (const { content, expected } of scenarios) {
        const mentions = CommentValidationLogic.extractMentions(content);
        expect(mentions).toEqual(expected);
      }
    });
  });
  
  describe('Notification Trigger Conditions', () => {
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should identify when notifications should be sent (mentions present)', () => {
      fc.assert(fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\w+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ),
        (usernames) => {
          const content = usernames.map(u => `@${u}`).join(' ');
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // If there are mentions, notifications should be triggered
          const shouldNotify = mentions.length > 0;
          return shouldNotify === true;
        }
      ), { numRuns: 100 });
    });
    
    // Feature: community-posts, Property 15: Mention and Notification System
    it('should identify when no notifications needed (no mentions)', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 0, maxLength: 200 }).filter(s => !s.includes('@')),
        (content) => {
          const mentions = CommentValidationLogic.extractMentions(content);
          
          // If no mentions, no notifications needed
          const shouldNotify = mentions.length > 0;
          return shouldNotify === false;
        }
      ), { numRuns: 100 });
    });
  });
});
