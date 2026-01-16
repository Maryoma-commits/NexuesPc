// Property-based tests for notification read status management
// Feature: community-posts, Property 29: Notification Read Status Management
// Validates: Requirements 9.8, 9.9

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  NotificationReadStatusLogic,
  NotificationGenerationLogic
} from '../../../services/communityNotificationService';
import { Notification, NotificationType } from '../../../types/community-posts';

// Generators for property-based testing
const notificationTypeGenerator = fc.constantFrom<NotificationType>(
  'like', 'comment', 'mention', 'follow', 'reaction'
);

const notificationGenerator = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  userId: fc.string({ minLength: 1, maxLength: 50 }),
  type: notificationTypeGenerator,
  fromUserId: fc.string({ minLength: 1, maxLength: 50 }),
  postId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  commentId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
  read: fc.boolean(),
  message: fc.string({ minLength: 1, maxLength: 200 })
}) as fc.Arbitrary<Notification>;

const unreadNotificationGenerator = notificationGenerator.map(n => ({ ...n, read: false }));

describe('Notification Read Status Management Properties', () => {
  
  // Feature: community-posts, Property 29: Notification Read Status Management
  it('should mark notification as read and preserve all other properties', () => {
    fc.assert(fc.property(
      unreadNotificationGenerator,
      fc.integer({ min: 1000000000000, max: Date.now() + 1000000 }),
      (notification, readTimestamp) => {
        const markedNotification = NotificationReadStatusLogic.markAsRead(notification, readTimestamp);
        
        // Should be marked as read
        expect(markedNotification.read).toBe(true);
        expect(markedNotification.readAt).toBe(readTimestamp);
        
        // All other properties should be preserved
        expect(markedNotification.id).toBe(notification.id);
        expect(markedNotification.userId).toBe(notification.userId);
        expect(markedNotification.type).toBe(notification.type);
        expect(markedNotification.fromUserId).toBe(notification.fromUserId);
        expect(markedNotification.postId).toBe(notification.postId);
        expect(markedNotification.commentId).toBe(notification.commentId);
        expect(markedNotification.createdAt).toBe(notification.createdAt);
        expect(markedNotification.message).toBe(notification.message);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should correctly identify read status of notifications', () => {
    fc.assert(fc.property(
      notificationGenerator,
      (notification) => {
        const isRead = NotificationReadStatusLogic.isRead(notification);
        expect(isRead).toBe(notification.read);
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should accurately count unread notifications', () => {
    fc.assert(fc.property(
      fc.array(notificationGenerator, { minLength: 0, maxLength: 50 }),
      (notifications) => {
        const unreadCount = NotificationReadStatusLogic.countUnread(notifications);
        const expectedCount = notifications.filter(n => !n.read).length;
        expect(unreadCount).toBe(expectedCount);
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should filter unread notifications correctly', () => {
    fc.assert(fc.property(
      fc.array(notificationGenerator, { minLength: 0, maxLength: 50 }),
      (notifications) => {
        const unreadNotifications = NotificationReadStatusLogic.filterUnread(notifications);
        
        // All returned notifications should be unread
        for (const notification of unreadNotifications) {
          expect(notification.read).toBe(false);
        }
        
        // Count should match expected unread count
        const expectedUnreadCount = notifications.filter(n => !n.read).length;
        expect(unreadNotifications.length).toBe(expectedUnreadCount);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should sort notifications by timestamp in descending order (newest first)', () => {
    fc.assert(fc.property(
      fc.array(notificationGenerator, { minLength: 2, maxLength: 20 }),
      (notifications) => {
        const sorted = NotificationReadStatusLogic.sortByTimestamp(notifications);
        
        // Should not modify original array
        expect(sorted).not.toBe(notifications);
        expect(sorted.length).toBe(notifications.length);
        
        // Should be sorted by createdAt in descending order
        for (let i = 0; i < sorted.length - 1; i++) {
          expect(sorted[i].createdAt).toBeGreaterThanOrEqual(sorted[i + 1].createdAt);
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should preserve notification content when marking as read', () => {
    fc.assert(fc.property(
      unreadNotificationGenerator,
      fc.integer({ min: 1000000000000, max: Date.now() + 1000000 }),
      (notification, readTimestamp) => {
        const original = { ...notification };
        const marked = NotificationReadStatusLogic.markAsRead(notification, readTimestamp);
        
        // Original should be unchanged
        expect(notification).toEqual(original);
        
        // Marked should have same content but different read status
        expect(marked.message).toBe(notification.message);
        expect(marked.type).toBe(notification.type);
        expect(marked.fromUserId).toBe(notification.fromUserId);
        expect(marked.read).toBe(true);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should handle empty notification arrays correctly', () => {
    const emptyArray: Notification[] = [];
    
    expect(NotificationReadStatusLogic.countUnread(emptyArray)).toBe(0);
    expect(NotificationReadStatusLogic.filterUnread(emptyArray)).toEqual([]);
    expect(NotificationReadStatusLogic.sortByTimestamp(emptyArray)).toEqual([]);
  });

  it('should handle arrays with all read notifications', () => {
    fc.assert(fc.property(
      fc.array(notificationGenerator.map(n => ({ ...n, read: true })), { minLength: 1, maxLength: 20 }),
      (readNotifications) => {
        expect(NotificationReadStatusLogic.countUnread(readNotifications)).toBe(0);
        expect(NotificationReadStatusLogic.filterUnread(readNotifications)).toEqual([]);
        
        const sorted = NotificationReadStatusLogic.sortByTimestamp(readNotifications);
        expect(sorted.length).toBe(readNotifications.length);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should handle arrays with all unread notifications', () => {
    fc.assert(fc.property(
      fc.array(unreadNotificationGenerator, { minLength: 1, maxLength: 20 }),
      (unreadNotifications) => {
        expect(NotificationReadStatusLogic.countUnread(unreadNotifications)).toBe(unreadNotifications.length);
        expect(NotificationReadStatusLogic.filterUnread(unreadNotifications)).toEqual(unreadNotifications);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  it('should maintain referential integrity when filtering and sorting', () => {
    fc.assert(fc.property(
      fc.array(notificationGenerator, { minLength: 5, maxLength: 20 }),
      (notifications) => {
        const unread = NotificationReadStatusLogic.filterUnread(notifications);
        const sorted = NotificationReadStatusLogic.sortByTimestamp(notifications);
        
        // Every unread notification should exist in original array
        for (const unreadNotif of unread) {
          expect(notifications).toContain(unreadNotif);
        }
        
        // Every sorted notification should exist in original array
        for (const sortedNotif of sorted) {
          expect(notifications).toContain(sortedNotif);
        }
        
        // Sorted array should contain all notifications
        expect(sorted.length).toBe(notifications.length);
        
        return true;
      }
    ), { numRuns: 100 });
  });
});