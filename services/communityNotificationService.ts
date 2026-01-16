// CommunityNotificationService for NexusPC Community Posts
// Handles notification generation for likes, comments, mentions, and reactions
// Requirements: 9.1, 9.2, 9.3, 9.4, 9.7, 9.8
import { 
  ref, 
  push, 
  set, 
  get, 
  update, 
  remove, 
  query, 
  orderByChild, 
  limitToLast, 
  onValue
} from 'firebase/database';
import { database } from '../firebase.config';
import { 
  Notification, 
  NotificationType,
  PostError,
  PostErrorType
} from '../types/community-posts';

// Constants for notification management
export const NOTIFICATION_GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes for grouping
export const MAX_NOTIFICATIONS_PER_PAGE = 20;
export const MAX_GROUPED_USERS = 5; // Max users to show in grouped notification

/**
 * Interface for creating a notification
 */
export interface CreateNotificationRequest {
  userId: string; // Recipient user ID
  type: NotificationType;
  fromUserId: string;
  postId?: string;
  commentId?: string;
  message: string;
}

/**
 * Interface for grouped notifications
 */
export interface GroupedNotification {
  id: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  fromUserIds: string[];
  count: number;
  message: string;
  createdAt: number;
  read: boolean;
  lastUpdated: number;
}


/**
 * CommunityNotificationService handles all notification-related operations for community posts
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.7, 9.8
 */
export class CommunityNotificationService {
  
  /**
   * Create a notification for a user
   * @param request - The notification creation request
   * @returns Promise<Notification> - The created notification
   * Requirements: 9.1, 9.2, 9.3, 9.7
   */
  async createNotification(request: CreateNotificationRequest): Promise<Notification> {
    try {
      // Don't notify users about their own actions
      if (request.userId === request.fromUserId) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Cannot notify user about their own action');
      }
      
      const now = Date.now();
      
      // Check for existing similar notification to group (Requirement 9.4)
      const existingGrouped = await this.findGroupableNotification(
        request.userId,
        request.type,
        request.postId,
        request.commentId
      );
      
      if (existingGrouped) {
        // Update existing grouped notification
        return await this.updateGroupedNotification(existingGrouped, request.fromUserId);
      }
      
      // Create new notification
      const notificationsRef = ref(database, `communityNotifications/${request.userId}`);
      const newNotificationRef = push(notificationsRef);
      
      const notification: Notification = {
        id: newNotificationRef.key!,
        userId: request.userId,
        type: request.type,
        fromUserId: request.fromUserId,
        postId: request.postId,
        commentId: request.commentId,
        createdAt: now,
        read: false,
        message: request.message
      };
      
      await set(newNotificationRef, notification);
      
      return notification;
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to create notification: ${error.message}`, true);
    }
  }


  /**
   * Create a like notification
   * @param postAuthorId - The author of the post being liked
   * @param likerId - The user who liked the post
   * @param postId - The ID of the post
   * @returns Promise<Notification | null> - The created notification or null if self-like
   * Requirement: 9.1
   */
  async createLikeNotification(
    postAuthorId: string, 
    likerId: string, 
    postId: string
  ): Promise<Notification | null> {
    // Don't notify for self-likes
    if (postAuthorId === likerId) {
      return null;
    }
    
    return this.createNotification({
      userId: postAuthorId,
      type: 'like',
      fromUserId: likerId,
      postId,
      message: 'liked your post'
    });
  }
  
  /**
   * Create a comment notification
   * @param postAuthorId - The author of the post being commented on
   * @param commenterId - The user who commented
   * @param postId - The ID of the post
   * @param commentId - The ID of the comment
   * @returns Promise<Notification | null> - The created notification or null if self-comment
   * Requirement: 9.2
   */
  async createCommentNotification(
    postAuthorId: string,
    commenterId: string,
    postId: string,
    commentId: string
  ): Promise<Notification | null> {
    // Don't notify for self-comments
    if (postAuthorId === commenterId) {
      return null;
    }
    
    return this.createNotification({
      userId: postAuthorId,
      type: 'comment',
      fromUserId: commenterId,
      postId,
      commentId,
      message: 'commented on your post'
    });
  }
  
  /**
   * Create a reply notification
   * @param parentCommentAuthorId - The author of the parent comment
   * @param replierId - The user who replied
   * @param postId - The ID of the post
   * @param commentId - The ID of the reply comment
   * @returns Promise<Notification | null> - The created notification or null if self-reply
   * Requirement: 9.3
   */
  async createReplyNotification(
    parentCommentAuthorId: string,
    replierId: string,
    postId: string,
    commentId: string
  ): Promise<Notification | null> {
    // Don't notify for self-replies
    if (parentCommentAuthorId === replierId) {
      return null;
    }
    
    return this.createNotification({
      userId: parentCommentAuthorId,
      type: 'comment',
      fromUserId: replierId,
      postId,
      commentId,
      message: 'replied to your comment'
    });
  }


  /**
   * Create mention notifications for all mentioned users
   * @param mentionedUserIds - Array of mentioned user IDs
   * @param mentionerId - The user who mentioned them
   * @param postId - The ID of the post
   * @param commentId - The ID of the comment containing mentions
   * @returns Promise<Notification[]> - Array of created notifications
   * Requirement: 9.7
   */
  async createMentionNotifications(
    mentionedUserIds: string[],
    mentionerId: string,
    postId: string,
    commentId: string
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];
    
    for (const userId of mentionedUserIds) {
      // Don't notify for self-mentions
      if (userId === mentionerId) {
        continue;
      }
      
      try {
        const notification = await this.createNotification({
          userId,
          type: 'mention',
          fromUserId: mentionerId,
          postId,
          commentId,
          message: 'mentioned you in a comment'
        });
        notifications.push(notification);
      } catch (error) {
        // Continue with other notifications even if one fails
        console.error(`Failed to create mention notification for user ${userId}:`, error);
      }
    }
    
    return notifications;
  }
  
  /**
   * Create a reaction notification
   * @param postAuthorId - The author of the post being reacted to
   * @param reactorId - The user who reacted
   * @param postId - The ID of the post
   * @param reactionType - The type of reaction
   * @returns Promise<Notification | null> - The created notification or null if self-reaction
   */
  async createReactionNotification(
    postAuthorId: string,
    reactorId: string,
    postId: string,
    reactionType: string
  ): Promise<Notification | null> {
    // Don't notify for self-reactions
    if (postAuthorId === reactorId) {
      return null;
    }
    
    return this.createNotification({
      userId: postAuthorId,
      type: 'reaction',
      fromUserId: reactorId,
      postId,
      message: `reacted ${reactionType} to your post`
    });
  }


  /**
   * Find an existing notification that can be grouped with a new one
   * @param userId - The recipient user ID
   * @param type - The notification type
   * @param postId - The post ID (optional)
   * @param commentId - The comment ID (optional)
   * @returns Promise<Notification | null> - Existing groupable notification or null
   * Requirement: 9.4
   */
  private async findGroupableNotification(
    userId: string,
    type: NotificationType,
    postId?: string,
    commentId?: string
  ): Promise<Notification | null> {
    try {
      const notificationsRef = ref(database, `communityNotifications/${userId}`);
      const snapshot = await get(notificationsRef);
      
      if (!snapshot.exists()) {
        return null;
      }
      
      const now = Date.now();
      let groupableNotification: Notification | null = null;
      
      snapshot.forEach((childSnapshot) => {
        const notification = childSnapshot.val() as Notification;
        
        // Check if notification is within grouping window and matches criteria
        if (
          notification.type === type &&
          notification.postId === postId &&
          notification.commentId === commentId &&
          !notification.read &&
          (now - notification.createdAt) < NOTIFICATION_GROUP_WINDOW_MS
        ) {
          groupableNotification = { ...notification, id: childSnapshot.key! };
        }
      });
      
      return groupableNotification;
      
    } catch (error) {
      console.error('Error finding groupable notification:', error);
      return null;
    }
  }
  
  /**
   * Update an existing notification to include a new user (grouping)
   * @param existingNotification - The existing notification to update
   * @param newFromUserId - The new user to add to the group
   * @returns Promise<Notification> - The updated notification
   * Requirement: 9.4
   */
  private async updateGroupedNotification(
    existingNotification: Notification,
    newFromUserId: string
  ): Promise<Notification> {
    try {
      const notificationRef = ref(
        database, 
        `communityNotifications/${existingNotification.userId}/${existingNotification.id}`
      );
      
      // Get current grouped users or initialize with existing fromUserId
      const groupedRef = ref(
        database,
        `communityNotifications/${existingNotification.userId}/${existingNotification.id}/groupedFromUserIds`
      );
      const groupedSnapshot = await get(groupedRef);
      
      let groupedUserIds: string[] = groupedSnapshot.exists() 
        ? groupedSnapshot.val() 
        : [existingNotification.fromUserId];
      
      // Add new user if not already in group
      if (!groupedUserIds.includes(newFromUserId)) {
        groupedUserIds.push(newFromUserId);
      }
      
      // Update the notification
      const count = groupedUserIds.length;
      const message = this.generateGroupedMessage(existingNotification.type, count);
      
      await update(notificationRef, {
        fromUserId: newFromUserId, // Most recent user
        groupedFromUserIds: groupedUserIds,
        groupedCount: count,
        message,
        lastUpdated: Date.now()
      });
      
      return {
        ...existingNotification,
        fromUserId: newFromUserId,
        message
      };
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to update grouped notification: ${error.message}`, true);
    }
  }


  /**
   * Generate a message for grouped notifications
   * @param type - The notification type
   * @param count - Number of users in the group
   * @returns string - The grouped message
   */
  private generateGroupedMessage(type: NotificationType, count: number): string {
    const otherCount = count - 1;
    const otherText = otherCount === 1 ? '1 other' : `${otherCount} others`;
    
    switch (type) {
      case 'like':
        return count === 1 ? 'liked your post' : `and ${otherText} liked your post`;
      case 'comment':
        return count === 1 ? 'commented on your post' : `and ${otherText} commented on your post`;
      case 'mention':
        return count === 1 ? 'mentioned you' : `and ${otherText} mentioned you`;
      case 'reaction':
        return count === 1 ? 'reacted to your post' : `and ${otherText} reacted to your post`;
      case 'follow':
        return count === 1 ? 'started following you' : `and ${otherText} started following you`;
      default:
        return count === 1 ? 'interacted with your content' : `and ${otherText} interacted with your content`;
    }
  }
  
  /**
   * Get notifications for a user with pagination
   * @param userId - The user ID
   * @param limit - Maximum number of notifications to retrieve
   * @param startAfterTimestamp - Timestamp to start after for pagination
   * @returns Promise<Notification[]>
   */
  async getUserNotifications(
    userId: string,
    limit: number = MAX_NOTIFICATIONS_PER_PAGE,
    startAfterTimestamp?: number
  ): Promise<Notification[]> {
    try {
      const notificationsRef = ref(database, `communityNotifications/${userId}`);
      const snapshot = await get(notificationsRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const notifications: Notification[] = [];
      
      snapshot.forEach((childSnapshot) => {
        const notification = childSnapshot.val() as Notification;
        notifications.push({
          ...notification,
          id: childSnapshot.key!
        });
      });
      
      // Sort by creation time (newest first)
      notifications.sort((a, b) => b.createdAt - a.createdAt);
      
      // Apply pagination
      let filtered = notifications;
      if (startAfterTimestamp) {
        filtered = notifications.filter(n => n.createdAt < startAfterTimestamp);
      }
      
      return filtered.slice(0, limit);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get notifications: ${error.message}`, true);
    }
  }


  /**
   * Mark a notification as read
   * @param userId - The user ID
   * @param notificationId - The notification ID
   * @returns Promise<void>
   * Requirement: 9.8
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const notificationRef = ref(database, `communityNotifications/${userId}/${notificationId}`);
      const snapshot = await get(notificationRef);
      
      if (!snapshot.exists()) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Notification not found');
      }
      
      await update(notificationRef, { read: true, readAt: Date.now() });
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to mark notification as read: ${error.message}`, true);
    }
  }
  
  /**
   * Mark all notifications as read for a user
   * @param userId - The user ID
   * @returns Promise<void>
   * Requirement: 9.8
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const notificationsRef = ref(database, `communityNotifications/${userId}`);
      const snapshot = await get(notificationsRef);
      
      if (!snapshot.exists()) {
        return;
      }
      
      const now = Date.now();
      const updates: Record<string, any> = {};
      
      snapshot.forEach((childSnapshot) => {
        const notification = childSnapshot.val() as Notification;
        if (!notification.read) {
          updates[`${childSnapshot.key}/read`] = true;
          updates[`${childSnapshot.key}/readAt`] = now;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await update(notificationsRef, updates);
      }
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to mark all notifications as read: ${error.message}`, true);
    }
  }

  /**
   * Mark a notification as seen (badge cleared but still shows as unread)
   * @param userId - The user ID
   * @param notificationId - The notification ID
   * @returns Promise<void>
   */
  async markAsSeen(userId: string, notificationId: string): Promise<void> {
    try {
      const notificationRef = ref(database, `communityNotifications/${userId}/${notificationId}`);
      await update(notificationRef, { seen: true, seenAt: Date.now() });
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to mark notification as seen: ${error.message}`, true);
    }
  }

  /**
   * Mark all notifications as seen for a user
   * @param userId - The user ID
   * @returns Promise<void>
   */
  async markAllAsSeen(userId: string): Promise<void> {
    try {
      const notificationsRef = ref(database, `communityNotifications/${userId}`);
      const snapshot = await get(notificationsRef);
      
      if (!snapshot.exists()) return;
      
      const now = Date.now();
      const updates: Record<string, any> = {};
      
      snapshot.forEach((childSnapshot) => {
        const notification = childSnapshot.val();
        if (!notification.seen) {
          updates[`${childSnapshot.key}/seen`] = true;
          updates[`${childSnapshot.key}/seenAt`] = now;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await update(notificationsRef, updates);
      }
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to mark all notifications as seen: ${error.message}`, true);
    }
  }
  
  /**
   * Get unread notification count for a user
   * @param userId - The user ID
   * @returns Promise<number>
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const notificationsRef = ref(database, `communityNotifications/${userId}`);
      const snapshot = await get(notificationsRef);
      
      if (!snapshot.exists()) {
        return 0;
      }
      
      let count = 0;
      snapshot.forEach((childSnapshot) => {
        const notification = childSnapshot.val() as Notification;
        if (!notification.read) {
          count++;
        }
      });
      
      return count;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get unread count: ${error.message}`, true);
    }
  }


  /**
   * Delete a notification
   * @param userId - The user ID
   * @param notificationId - The notification ID
   * @returns Promise<void>
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    try {
      const notificationRef = ref(database, `communityNotifications/${userId}/${notificationId}`);
      await remove(notificationRef);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to delete notification: ${error.message}`, true);
    }
  }
  
  /**
   * Clear all notifications for a user
   * @param userId - The user ID
   * @returns Promise<void>
   */
  async clearAllNotifications(userId: string): Promise<void> {
    try {
      const notificationsRef = ref(database, `communityNotifications/${userId}`);
      await remove(notificationsRef);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to clear notifications: ${error.message}`, true);
    }
  }
  
  /**
   * Listen to real-time notification updates for a user
   * @param userId - The user ID
   * @param callback - Function to call when notifications update
   * @returns Function to unsubscribe from updates
   */
  listenToNotifications(
    userId: string,
    callback: (notifications: Notification[], unreadCount: number) => void
  ): () => void {
    const notificationsRef = ref(database, `communityNotifications/${userId}`);
    
    return onValue(notificationsRef, (snapshot) => {
      const notifications: Notification[] = [];
      let unreadCount = 0;
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const notification = childSnapshot.val() as Notification;
          const notificationWithId = {
            ...notification,
            id: childSnapshot.key!
          };
          notifications.push(notificationWithId);
          
          if (!notification.read) {
            unreadCount++;
          }
        });
      }
      
      // Sort by creation time (newest first)
      notifications.sort((a, b) => b.createdAt - a.createdAt);
      
      callback(notifications, unreadCount);
    });
  }
}

// Export a singleton instance
export const communityNotificationService = new CommunityNotificationService();


// Export pure functions for testing (without Firebase dependency)
export const NotificationGenerationLogic = {
  /**
   * Check if a notification should be created (not self-notification)
   * @param recipientId - The recipient user ID
   * @param actorId - The user performing the action
   * @returns boolean - True if notification should be created
   * Requirement: 9.1, 9.2, 9.3, 9.7
   */
  shouldCreateNotification(recipientId: string, actorId: string): boolean {
    return recipientId !== actorId;
  },
  
  /**
   * Generate notification message based on type
   * @param type - The notification type
   * @param count - Number of users (for grouped notifications)
   * @returns string - The notification message
   */
  generateMessage(type: NotificationType, count: number = 1): string {
    const otherCount = count - 1;
    const otherText = otherCount === 1 ? '1 other' : `${otherCount} others`;
    
    switch (type) {
      case 'like':
        return count === 1 ? 'liked your post' : `and ${otherText} liked your post`;
      case 'comment':
        return count === 1 ? 'commented on your post' : `and ${otherText} commented on your post`;
      case 'mention':
        return count === 1 ? 'mentioned you in a comment' : `and ${otherText} mentioned you`;
      case 'reaction':
        return count === 1 ? 'reacted to your post' : `and ${otherText} reacted to your post`;
      case 'follow':
        return count === 1 ? 'started following you' : `and ${otherText} started following you`;
      default:
        return count === 1 ? 'interacted with your content' : `and ${otherText} interacted with your content`;
    }
  },
  
  /**
   * Create a notification object
   * @param params - Notification parameters
   * @returns Notification object (without id)
   */
  createNotificationObject(params: {
    userId: string;
    type: NotificationType;
    fromUserId: string;
    postId?: string;
    commentId?: string;
    message: string;
    timestamp: number;
  }): Omit<Notification, 'id'> {
    return {
      userId: params.userId,
      type: params.type,
      fromUserId: params.fromUserId,
      postId: params.postId,
      commentId: params.commentId,
      createdAt: params.timestamp,
      read: false,
      message: params.message
    };
  },
  
  /**
   * Filter out self-notifications from a list of user IDs
   * @param userIds - Array of user IDs to notify
   * @param actorId - The user performing the action
   * @returns string[] - Filtered user IDs (excluding actor)
   */
  filterSelfNotifications(userIds: string[], actorId: string): string[] {
    return userIds.filter(id => id !== actorId);
  },
  
  /**
   * Determine notification type for engagement action
   * @param action - The engagement action type
   * @returns NotificationType
   */
  getNotificationTypeForAction(action: 'like' | 'comment' | 'reply' | 'mention' | 'reaction' | 'follow'): NotificationType {
    switch (action) {
      case 'like':
        return 'like';
      case 'comment':
      case 'reply':
        return 'comment';
      case 'mention':
        return 'mention';
      case 'reaction':
        return 'reaction';
      case 'follow':
        return 'follow';
      default:
        return 'like';
    }
  }
};


export const NotificationGroupingLogic = {
  /**
   * Check if two notifications can be grouped together
   * @param notification1 - First notification
   * @param notification2 - Second notification
   * @param groupWindowMs - Time window for grouping in milliseconds
   * @returns boolean - True if notifications can be grouped
   * Requirement: 9.4
   */
  canGroupNotifications(
    notification1: { type: NotificationType; postId?: string; commentId?: string; createdAt: number; read: boolean },
    notification2: { type: NotificationType; postId?: string; commentId?: string; createdAt: number },
    groupWindowMs: number = NOTIFICATION_GROUP_WINDOW_MS
  ): boolean {
    // Must be same type
    if (notification1.type !== notification2.type) {
      return false;
    }
    
    // Must be for same post (if applicable)
    if (notification1.postId !== notification2.postId) {
      return false;
    }
    
    // Must be for same comment (if applicable)
    if (notification1.commentId !== notification2.commentId) {
      return false;
    }
    
    // First notification must be unread
    if (notification1.read) {
      return false;
    }
    
    // Must be within time window
    const timeDiff = Math.abs(notification2.createdAt - notification1.createdAt);
    if (timeDiff > groupWindowMs) {
      return false;
    }
    
    return true;
  },
  
  /**
   * Generate grouped notification message
   * @param type - The notification type
   * @param userCount - Number of users in the group
   * @returns string - The grouped message
   * Requirement: 9.4
   */
  generateGroupedMessage(type: NotificationType, userCount: number): string {
    if (userCount <= 1) {
      return NotificationGenerationLogic.generateMessage(type, 1);
    }
    
    const otherCount = userCount - 1;
    const otherText = otherCount === 1 ? '1 other' : `${otherCount} others`;
    
    switch (type) {
      case 'like':
        return `and ${otherText} liked your post`;
      case 'comment':
        return `and ${otherText} commented on your post`;
      case 'mention':
        return `and ${otherText} mentioned you`;
      case 'reaction':
        return `and ${otherText} reacted to your post`;
      case 'follow':
        return `and ${otherText} started following you`;
      default:
        return `and ${otherText} interacted with your content`;
    }
  },
  
  /**
   * Merge user IDs for grouped notification
   * @param existingUserIds - Existing user IDs in the group
   * @param newUserId - New user ID to add
   * @returns string[] - Updated user IDs array
   */
  mergeGroupedUsers(existingUserIds: string[], newUserId: string): string[] {
    if (existingUserIds.includes(newUserId)) {
      return existingUserIds;
    }
    return [...existingUserIds, newUserId];
  },
  
  /**
   * Calculate group count from user IDs
   * @param userIds - Array of user IDs in the group
   * @returns number - The count
   */
  getGroupCount(userIds: string[]): number {
    return userIds.length;
  },
  
  /**
   * Check if notification should be grouped based on time
   * @param existingTimestamp - Timestamp of existing notification
   * @param newTimestamp - Timestamp of new notification
   * @param groupWindowMs - Time window for grouping
   * @returns boolean - True if within grouping window
   */
  isWithinGroupingWindow(
    existingTimestamp: number,
    newTimestamp: number,
    groupWindowMs: number = NOTIFICATION_GROUP_WINDOW_MS
  ): boolean {
    return Math.abs(newTimestamp - existingTimestamp) <= groupWindowMs;
  }
};

export const NotificationReadStatusLogic = {
  /**
   * Mark notification as read
   * @param notification - The notification to mark
   * @param readTimestamp - The timestamp when read
   * @returns Updated notification object
   * Requirement: 9.8
   */
  markAsRead(
    notification: Notification,
    readTimestamp: number
  ): Notification & { readAt: number } {
    return {
      ...notification,
      read: true,
      readAt: readTimestamp
    };
  },
  
  /**
   * Check if notification is read
   * @param notification - The notification to check
   * @returns boolean - True if read
   */
  isRead(notification: { read: boolean }): boolean {
    return notification.read === true;
  },
  
  /**
   * Count unread notifications
   * @param notifications - Array of notifications
   * @returns number - Count of unread notifications
   */
  countUnread(notifications: Array<{ read: boolean }>): number {
    return notifications.filter(n => !n.read).length;
  },
  
  /**
   * Filter unread notifications
   * @param notifications - Array of notifications
   * @returns Array of unread notifications
   */
  filterUnread<T extends { read: boolean }>(notifications: T[]): T[] {
    return notifications.filter(n => !n.read);
  },
  
  /**
   * Sort notifications by timestamp (newest first)
   * @param notifications - Array of notifications
   * @returns Sorted array
   */
  sortByTimestamp<T extends { createdAt: number }>(notifications: T[]): T[] {
    return [...notifications].sort((a, b) => b.createdAt - a.createdAt);
  }
};
