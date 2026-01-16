// Feature: community-posts, Property 27: Notification Generation Consistency
// **Validates: Requirements 9.1, 9.2, 9.3, 9.7**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  NotificationGenerationLogic 
} from '../../../services/communityNotificationService'
import { NotificationType } from '../../../types/community-posts'

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const postIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const commentIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const timestampGenerator = fc.integer({ min: 1000000000000, max: 2000000000000 })
const notificationTypeGenerator = fc.constantFrom<NotificationType>('like', 'comment', 'mention', 'reaction', 'follow')
const actionTypeGenerator = fc.constantFrom<'like' | 'comment' | 'reply' | 'mention' | 'reaction' | 'follow'>(
  'like', 'comment', 'reply', 'mention', 'reaction', 'follow'
)

describe('Notification Generation Consistency - Property 27', () => {
  describe('Requirement 9.1: Like notifications', () => {
    it('should not create notification when user likes their own post', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          (userId) => {
            // When recipient and actor are the same
            const shouldCreate = NotificationGenerationLogic.shouldCreateNotification(userId, userId)
            
            // Should NOT create notification for self-like
            expect(shouldCreate).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should create notification when different user likes a post', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator.filter(id => id.length > 0),
          (postAuthorId, likerId) => {
            // Skip if same user
            if (postAuthorId === likerId) return true
            
            const shouldCreate = NotificationGenerationLogic.shouldCreateNotification(postAuthorId, likerId)
            
            // Should create notification for different users
            expect(shouldCreate).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate correct like notification message', () => {
      const message = NotificationGenerationLogic.generateMessage('like', 1)
      expect(message).toBe('liked your post')
    })
  })


  describe('Requirement 9.2: Comment notifications', () => {
    it('should not create notification when user comments on their own post', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          (userId) => {
            const shouldCreate = NotificationGenerationLogic.shouldCreateNotification(userId, userId)
            
            // Should NOT create notification for self-comment
            expect(shouldCreate).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should create notification when different user comments on a post', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator.filter(id => id.length > 0),
          (postAuthorId, commenterId) => {
            if (postAuthorId === commenterId) return true
            
            const shouldCreate = NotificationGenerationLogic.shouldCreateNotification(postAuthorId, commenterId)
            
            expect(shouldCreate).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate correct comment notification message', () => {
      const message = NotificationGenerationLogic.generateMessage('comment', 1)
      expect(message).toBe('commented on your post')
    })
  })

  describe('Requirement 9.3: Reply notifications', () => {
    it('should not create notification when user replies to their own comment', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          (userId) => {
            const shouldCreate = NotificationGenerationLogic.shouldCreateNotification(userId, userId)
            
            // Should NOT create notification for self-reply
            expect(shouldCreate).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should create notification when different user replies to a comment', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          userIdGenerator.filter(id => id.length > 0),
          (commentAuthorId, replierId) => {
            if (commentAuthorId === replierId) return true
            
            const shouldCreate = NotificationGenerationLogic.shouldCreateNotification(commentAuthorId, replierId)
            
            expect(shouldCreate).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should map reply action to comment notification type', () => {
      const type = NotificationGenerationLogic.getNotificationTypeForAction('reply')
      expect(type).toBe('comment')
    })
  })


  describe('Requirement 9.7: Mention notifications', () => {
    it('should filter out self-mentions from notification list', () => {
      fc.assert(
        fc.property(
          fc.array(userIdGenerator, { minLength: 1, maxLength: 10 }),
          userIdGenerator,
          (mentionedUserIds, mentionerId) => {
            const filtered = NotificationGenerationLogic.filterSelfNotifications(mentionedUserIds, mentionerId)
            
            // Self should be filtered out
            expect(filtered).not.toContain(mentionerId)
            
            // All other users should remain
            const expectedOthers = mentionedUserIds.filter(id => id !== mentionerId)
            expect(filtered.length).toBe(expectedOthers.length)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should create notifications for all mentioned users except self', () => {
      fc.assert(
        fc.property(
          fc.array(userIdGenerator, { minLength: 0, maxLength: 10 }),
          userIdGenerator,
          (mentionedUserIds, mentionerId) => {
            const filtered = NotificationGenerationLogic.filterSelfNotifications(mentionedUserIds, mentionerId)
            
            // Each filtered user should get a notification
            for (const userId of filtered) {
              const shouldCreate = NotificationGenerationLogic.shouldCreateNotification(userId, mentionerId)
              expect(shouldCreate).toBe(true)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate correct mention notification message', () => {
      const message = NotificationGenerationLogic.generateMessage('mention', 1)
      expect(message).toBe('mentioned you in a comment')
    })
  })

  describe('Notification Object Creation', () => {
    it('should create notification object with all required fields', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          notificationTypeGenerator,
          userIdGenerator,
          postIdGenerator,
          commentIdGenerator,
          timestampGenerator,
          (userId, type, fromUserId, postId, commentId, timestamp) => {
            const notification = NotificationGenerationLogic.createNotificationObject({
              userId,
              type,
              fromUserId,
              postId,
              commentId,
              message: 'test message',
              timestamp
            })
            
            // Verify all required fields are present
            expect(notification.userId).toBe(userId)
            expect(notification.type).toBe(type)
            expect(notification.fromUserId).toBe(fromUserId)
            expect(notification.postId).toBe(postId)
            expect(notification.commentId).toBe(commentId)
            expect(notification.createdAt).toBe(timestamp)
            expect(notification.read).toBe(false)
            expect(notification.message).toBe('test message')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should always create notifications with read=false initially', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          notificationTypeGenerator,
          userIdGenerator,
          timestampGenerator,
          (userId, type, fromUserId, timestamp) => {
            const notification = NotificationGenerationLogic.createNotificationObject({
              userId,
              type,
              fromUserId,
              message: 'test',
              timestamp
            })
            
            // New notifications should always be unread
            expect(notification.read).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  describe('Action to Notification Type Mapping', () => {
    it('should correctly map all action types to notification types', () => {
      fc.assert(
        fc.property(
          actionTypeGenerator,
          (action) => {
            const type = NotificationGenerationLogic.getNotificationTypeForAction(action)
            
            // Verify correct mapping
            switch (action) {
              case 'like':
                expect(type).toBe('like')
                break
              case 'comment':
              case 'reply':
                expect(type).toBe('comment')
                break
              case 'mention':
                expect(type).toBe('mention')
                break
              case 'reaction':
                expect(type).toBe('reaction')
                break
              case 'follow':
                expect(type).toBe('follow')
                break
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Self-Notification Prevention Invariant', () => {
    it('should never allow self-notifications for any notification type', () => {
      fc.assert(
        fc.property(
          userIdGenerator,
          notificationTypeGenerator,
          (userId, type) => {
            // For any user and any notification type
            const shouldCreate = NotificationGenerationLogic.shouldCreateNotification(userId, userId)
            
            // Self-notifications should NEVER be created
            expect(shouldCreate).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Message Generation Consistency', () => {
    it('should generate non-empty messages for all notification types', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          fc.integer({ min: 1, max: 100 }),
          (type, count) => {
            const message = NotificationGenerationLogic.generateMessage(type, count)
            
            // Message should never be empty
            expect(message.length).toBeGreaterThan(0)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate different messages for single vs grouped notifications', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          fc.integer({ min: 2, max: 100 }),
          (type, count) => {
            const singleMessage = NotificationGenerationLogic.generateMessage(type, 1)
            const groupedMessage = NotificationGenerationLogic.generateMessage(type, count)
            
            // Grouped message should be different from single
            expect(groupedMessage).not.toBe(singleMessage)
            
            // Grouped message should contain "other" or "others"
            expect(groupedMessage).toMatch(/other/)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
