// Feature: community-posts, Property 28: Notification Grouping Logic
// **Validates: Requirements 9.4**
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  NotificationGroupingLogic,
  NOTIFICATION_GROUP_WINDOW_MS
} from '../../../services/communityNotificationService'
import { NotificationType } from '../../../types/community-posts'

// Generators for property-based testing
const userIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const postIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const commentIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
const timestampGenerator = fc.integer({ min: 1000000000000, max: 2000000000000 })
const notificationTypeGenerator = fc.constantFrom<NotificationType>('like', 'comment', 'mention', 'reaction', 'follow')
const userCountGenerator = fc.integer({ min: 1, max: 100 })

// Generator for notification-like objects
const notificationGenerator = fc.record({
  type: notificationTypeGenerator,
  postId: fc.option(postIdGenerator, { nil: undefined }),
  commentId: fc.option(commentIdGenerator, { nil: undefined }),
  createdAt: timestampGenerator,
  read: fc.boolean()
})

describe('Notification Grouping Logic - Property 28', () => {
  describe('Requirement 9.4: Group similar notifications to prevent spam', () => {
    it('should group notifications of the same type for the same post', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          postIdGenerator,
          timestampGenerator,
          (type, postId, baseTimestamp) => {
            const notification1 = {
              type,
              postId,
              commentId: undefined,
              createdAt: baseTimestamp,
              read: false
            }
            
            // Second notification within grouping window
            const notification2 = {
              type,
              postId,
              commentId: undefined,
              createdAt: baseTimestamp + 1000 // 1 second later
            }
            
            const canGroup = NotificationGroupingLogic.canGroupNotifications(
              notification1,
              notification2
            )
            
            // Should be able to group same type, same post, within window
            expect(canGroup).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should NOT group notifications of different types', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          notificationTypeGenerator,
          postIdGenerator,
          timestampGenerator,
          (type1, type2, postId, baseTimestamp) => {
            // Skip if same type
            if (type1 === type2) return true
            
            const notification1 = {
              type: type1,
              postId,
              commentId: undefined,
              createdAt: baseTimestamp,
              read: false
            }
            
            const notification2 = {
              type: type2,
              postId,
              commentId: undefined,
              createdAt: baseTimestamp + 1000
            }
            
            const canGroup = NotificationGroupingLogic.canGroupNotifications(
              notification1,
              notification2
            )
            
            // Should NOT group different types
            expect(canGroup).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })


    it('should NOT group notifications for different posts', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          postIdGenerator,
          postIdGenerator,
          timestampGenerator,
          (type, postId1, postId2, baseTimestamp) => {
            // Skip if same post
            if (postId1 === postId2) return true
            
            const notification1 = {
              type,
              postId: postId1,
              commentId: undefined,
              createdAt: baseTimestamp,
              read: false
            }
            
            const notification2 = {
              type,
              postId: postId2,
              commentId: undefined,
              createdAt: baseTimestamp + 1000
            }
            
            const canGroup = NotificationGroupingLogic.canGroupNotifications(
              notification1,
              notification2
            )
            
            // Should NOT group different posts
            expect(canGroup).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should NOT group notifications outside the time window', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          postIdGenerator,
          timestampGenerator,
          (type, postId, baseTimestamp) => {
            const notification1 = {
              type,
              postId,
              commentId: undefined,
              createdAt: baseTimestamp,
              read: false
            }
            
            // Second notification OUTSIDE grouping window
            const notification2 = {
              type,
              postId,
              commentId: undefined,
              createdAt: baseTimestamp + NOTIFICATION_GROUP_WINDOW_MS + 1000 // Beyond window
            }
            
            const canGroup = NotificationGroupingLogic.canGroupNotifications(
              notification1,
              notification2
            )
            
            // Should NOT group outside time window
            expect(canGroup).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should NOT group if existing notification is already read', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          postIdGenerator,
          timestampGenerator,
          (type, postId, baseTimestamp) => {
            const notification1 = {
              type,
              postId,
              commentId: undefined,
              createdAt: baseTimestamp,
              read: true // Already read
            }
            
            const notification2 = {
              type,
              postId,
              commentId: undefined,
              createdAt: baseTimestamp + 1000
            }
            
            const canGroup = NotificationGroupingLogic.canGroupNotifications(
              notification1,
              notification2
            )
            
            // Should NOT group with read notifications
            expect(canGroup).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  describe('Grouped Message Generation', () => {
    it('should generate correct message for single user', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          (type) => {
            const message = NotificationGroupingLogic.generateGroupedMessage(type, 1)
            
            // Single user message should not contain "other"
            expect(message).not.toMatch(/other/)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate correct message for multiple users', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          fc.integer({ min: 2, max: 100 }),
          (type, userCount) => {
            const message = NotificationGroupingLogic.generateGroupedMessage(type, userCount)
            
            // Multiple users message should contain "other" or "others"
            expect(message).toMatch(/other/)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use singular "other" for exactly 2 users', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          (type) => {
            const message = NotificationGroupingLogic.generateGroupedMessage(type, 2)
            
            // Should say "1 other" not "1 others"
            expect(message).toContain('1 other')
            expect(message).not.toContain('1 others')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use plural "others" for more than 2 users', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          fc.integer({ min: 3, max: 100 }),
          (type, userCount) => {
            const message = NotificationGroupingLogic.generateGroupedMessage(type, userCount)
            
            // Should say "X others" for 3+ users
            expect(message).toContain('others')
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('User Merging for Grouped Notifications', () => {
    it('should add new user to group if not already present', () => {
      fc.assert(
        fc.property(
          fc.array(userIdGenerator, { minLength: 1, maxLength: 10 }),
          userIdGenerator,
          (existingUsers, newUser) => {
            // Skip if new user already in list
            if (existingUsers.includes(newUser)) return true
            
            const merged = NotificationGroupingLogic.mergeGroupedUsers(existingUsers, newUser)
            
            // New user should be added
            expect(merged).toContain(newUser)
            expect(merged.length).toBe(existingUsers.length + 1)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should NOT duplicate user if already in group', () => {
      fc.assert(
        fc.property(
          fc.array(userIdGenerator, { minLength: 1, maxLength: 10 }),
          (existingUsers) => {
            // Pick a user that's already in the list
            const existingUser = existingUsers[0]
            
            const merged = NotificationGroupingLogic.mergeGroupedUsers(existingUsers, existingUser)
            
            // Should not add duplicate
            expect(merged.length).toBe(existingUsers.length)
            
            // Count occurrences of the user
            const occurrences = merged.filter(u => u === existingUser).length
            expect(occurrences).toBe(existingUsers.filter(u => u === existingUser).length)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve all existing users when merging', () => {
      fc.assert(
        fc.property(
          fc.array(userIdGenerator, { minLength: 1, maxLength: 10 }),
          userIdGenerator,
          (existingUsers, newUser) => {
            const merged = NotificationGroupingLogic.mergeGroupedUsers(existingUsers, newUser)
            
            // All existing users should still be present
            for (const user of existingUsers) {
              expect(merged).toContain(user)
            }
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  describe('Group Count Calculation', () => {
    it('should correctly count users in group', () => {
      fc.assert(
        fc.property(
          fc.array(userIdGenerator, { minLength: 0, maxLength: 100 }),
          (userIds) => {
            const count = NotificationGroupingLogic.getGroupCount(userIds)
            
            expect(count).toBe(userIds.length)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return 0 for empty group', () => {
      const count = NotificationGroupingLogic.getGroupCount([])
      expect(count).toBe(0)
    })
  })

  describe('Time Window Checking', () => {
    it('should return true for timestamps within window', () => {
      fc.assert(
        fc.property(
          timestampGenerator,
          fc.integer({ min: 0, max: NOTIFICATION_GROUP_WINDOW_MS - 1 }),
          (baseTimestamp, offset) => {
            const isWithin = NotificationGroupingLogic.isWithinGroupingWindow(
              baseTimestamp,
              baseTimestamp + offset
            )
            
            expect(isWithin).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return false for timestamps outside window', () => {
      fc.assert(
        fc.property(
          timestampGenerator,
          fc.integer({ min: NOTIFICATION_GROUP_WINDOW_MS + 1, max: NOTIFICATION_GROUP_WINDOW_MS * 10 }),
          (baseTimestamp, offset) => {
            const isWithin = NotificationGroupingLogic.isWithinGroupingWindow(
              baseTimestamp,
              baseTimestamp + offset
            )
            
            expect(isWithin).toBe(false)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle timestamps in either order', () => {
      fc.assert(
        fc.property(
          timestampGenerator,
          fc.integer({ min: 0, max: NOTIFICATION_GROUP_WINDOW_MS - 1 }),
          (baseTimestamp, offset) => {
            // Forward order
            const forward = NotificationGroupingLogic.isWithinGroupingWindow(
              baseTimestamp,
              baseTimestamp + offset
            )
            
            // Reverse order
            const reverse = NotificationGroupingLogic.isWithinGroupingWindow(
              baseTimestamp + offset,
              baseTimestamp
            )
            
            // Both should give same result
            expect(forward).toBe(reverse)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Grouping Invariants', () => {
    it('should maintain grouping symmetry for time window', () => {
      fc.assert(
        fc.property(
          timestampGenerator,
          fc.integer({ min: -NOTIFICATION_GROUP_WINDOW_MS, max: NOTIFICATION_GROUP_WINDOW_MS }),
          (baseTimestamp, offset) => {
            const timestamp1 = baseTimestamp
            const timestamp2 = baseTimestamp + offset
            
            // Check both directions
            const result1 = NotificationGroupingLogic.isWithinGroupingWindow(timestamp1, timestamp2)
            const result2 = NotificationGroupingLogic.isWithinGroupingWindow(timestamp2, timestamp1)
            
            // Should be symmetric
            expect(result1).toBe(result2)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should always group notifications at exact same timestamp', () => {
      fc.assert(
        fc.property(
          notificationTypeGenerator,
          postIdGenerator,
          timestampGenerator,
          (type, postId, timestamp) => {
            const notification1 = {
              type,
              postId,
              commentId: undefined,
              createdAt: timestamp,
              read: false
            }
            
            const notification2 = {
              type,
              postId,
              commentId: undefined,
              createdAt: timestamp // Same timestamp
            }
            
            const canGroup = NotificationGroupingLogic.canGroupNotifications(
              notification1,
              notification2
            )
            
            // Same timestamp should always be groupable
            expect(canGroup).toBe(true)
            
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
