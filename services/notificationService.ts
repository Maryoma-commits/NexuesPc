// Notification Service - Track reply notifications
import { database, auth } from '../firebase.config';
import { ref, onValue, set, remove, query, orderByChild, equalTo, get } from 'firebase/database';

export interface Notification {
  id: string;
  type: 'reply';
  messageId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto: string;
  messageText: string; // Preview of their reply
  originalMessageText: string; // Your original message
  conversationType: 'global' | 'dm';
  conversationId?: string; // For DMs
  timestamp: number;
  read: boolean;
  seen?: boolean; // Whether user has opened the notification panel since this arrived
  seenAt?: number;
}

/**
 * Create a notification when someone replies to your message
 */
export const createReplyNotification = async (
  recipientUserId: string,
  fromUserId: string,
  fromUserName: string,
  fromUserPhoto: string,
  messageId: string,
  messageText: string,
  originalMessageText: string,
  conversationType: 'global' | 'dm',
  conversationId?: string
) => {
  try {
    const notificationId = `${messageId}_${Date.now()}`;
    const notificationRef = ref(database, `notifications/${recipientUserId}/${notificationId}`);
    
    const notification: Notification = {
      id: notificationId,
      type: 'reply',
      messageId,
      fromUserId,
      fromUserName,
      fromUserPhoto,
      messageText: messageText.substring(0, 100), // Preview only
      originalMessageText: originalMessageText.substring(0, 100),
      conversationType,
      ...(conversationId && { conversationId }), // Only include if defined
      timestamp: Date.now(),
      read: false
    };
    
    await set(notificationRef, notification);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Listen to user's notifications
 */
export const listenToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
) => {
  const notificationsRef = ref(database, `notifications/${userId}`);
  
  const unsubscribe = onValue(notificationsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    
    const notifications: Notification[] = Object.values(data);
    // Sort by timestamp, newest first
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    callback(notifications);
  });
  
  return unsubscribe;
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (userId: string, notificationId: string) => {
  try {
    const notificationRef = ref(database, `notifications/${userId}/${notificationId}/read`);
    await set(notificationRef, true);
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const notificationsRef = ref(database, `notifications/${userId}`);
    const snapshot = await get(notificationsRef);
    
    if (!snapshot.exists()) return;
    
    const notifications = snapshot.val();
    
    // Update each notification's read status individually
    const updatePromises = Object.keys(notifications).map(notifId => 
      set(ref(database, `notifications/${userId}/${notifId}/read`), true)
    );
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error marking all as read:', error);
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (userId: string, notificationId: string) => {
  try {
    const notificationRef = ref(database, `notifications/${userId}/${notificationId}`);
    await remove(notificationRef);
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};

/**
 * Mark notification as seen (badge cleared but still shows as unread)
 */
export const markNotificationAsSeen = async (userId: string, notificationId: string) => {
  try {
    const notificationRef = ref(database, `notifications/${userId}/${notificationId}`);
    await set(ref(database, `notifications/${userId}/${notificationId}/seen`), true);
    await set(ref(database, `notifications/${userId}/${notificationId}/seenAt`), Date.now());
  } catch (error) {
    console.error('Error marking notification as seen:', error);
  }
};

/**
 * Mark all notifications as seen
 */
export const markAllNotificationsAsSeen = async (userId: string) => {
  try {
    const notificationsRef = ref(database, `notifications/${userId}`);
    const snapshot = await get(notificationsRef);
    
    if (!snapshot.exists()) return;
    
    const notifications = snapshot.val();
    const now = Date.now();
    
    const updatePromises = Object.keys(notifications).map(notifId => {
      if (!notifications[notifId].seen) {
        return Promise.all([
          set(ref(database, `notifications/${userId}/${notifId}/seen`), true),
          set(ref(database, `notifications/${userId}/${notifId}/seenAt`), now)
        ]);
      }
      return Promise.resolve();
    });
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error marking all as seen:', error);
  }
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async (userId: string) => {
  try {
    const notificationsRef = ref(database, `notifications/${userId}`);
    await remove(notificationsRef);
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
};
