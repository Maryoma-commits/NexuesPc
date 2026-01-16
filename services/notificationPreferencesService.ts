// Notification Preferences Service for NexusPC Community Posts
// Handles user notification preferences and email digest functionality
// Requirements: 9.5, 9.6, 9.9, 9.10

import { 
  ref, 
  set, 
  get, 
  update, 
  onValue
} from 'firebase/database';
import { database } from '../firebase.config';
import { NotificationType } from '../types/community-posts';

/**
 * Interface for notification preferences
 */
export interface NotificationPreferences {
  userId: string;
  // Real-time notification preferences
  likes: boolean;
  comments: boolean;
  mentions: boolean;
  follows: boolean;
  reactions: boolean;
  // Email digest preferences
  emailDigestEnabled: boolean;
  emailDigestFrequency: 'daily' | 'weekly' | 'never';
  // Push notification preferences (for future implementation)
  pushNotificationsEnabled: boolean;
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:MM format
  quietHoursEnd: string; // HH:MM format
  // Last activity tracking for email digest
  lastActiveAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Default notification preferences for new users
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt' | 'lastActiveAt'> = {
  likes: true,
  comments: true,
  mentions: true,
  follows: true,
  reactions: true,
  emailDigestEnabled: true,
  emailDigestFrequency: 'weekly',
  pushNotificationsEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00'
};

/**
 * Interface for email digest data
 */
export interface EmailDigestData {
  userId: string;
  email: string;
  displayName: string;
  unreadNotifications: number;
  recentActivity: {
    likes: number;
    comments: number;
    mentions: number;
    follows: number;
    reactions: number;
  };
  topPosts: Array<{
    postId: string;
    content: string;
    engagementCount: number;
  }>;
  lastDigestSent: number;
  nextDigestDue: number;
}

/**
 * NotificationPreferencesService handles user notification preferences
 * Requirements: 9.5, 9.6, 9.9, 9.10
 */
export class NotificationPreferencesService {
  
  /**
   * Get notification preferences for a user
   * @param userId - The user ID
   * @returns Promise<NotificationPreferences>
   * Requirement: 9.5
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const preferencesRef = ref(database, `notificationPreferences/${userId}`);
      const snapshot = await get(preferencesRef);
      
      if (!snapshot.exists()) {
        // Create default preferences for new user
        return await this.createDefaultPreferences(userId);
      }
      
      return snapshot.val() as NotificationPreferences;
      
    } catch (error: any) {
      console.error('Error getting notification preferences:', error);
      // Return default preferences on error
      return await this.createDefaultPreferences(userId);
    }
  }
  
  /**
   * Update notification preferences for a user
   * @param userId - The user ID
   * @param updates - Partial preferences to update
   * @returns Promise<NotificationPreferences>
   * Requirement: 9.6
   */
  async updatePreferences(
    userId: string, 
    updates: Partial<Omit<NotificationPreferences, 'userId' | 'createdAt'>>
  ): Promise<NotificationPreferences> {
    try {
      const preferencesRef = ref(database, `notificationPreferences/${userId}`);
      const currentPrefs = await this.getPreferences(userId);
      
      const updatedPreferences: NotificationPreferences = {
        ...currentPrefs,
        ...updates,
        userId,
        updatedAt: Date.now()
      };
      
      await set(preferencesRef, updatedPreferences);
      return updatedPreferences;
      
    } catch (error: any) {
      console.error('Error updating notification preferences:', error);
      throw new Error(`Failed to update notification preferences: ${error.message}`);
    }
  }
  
  /**
   * Check if a notification type is enabled for a user
   * @param userId - The user ID
   * @param notificationType - The notification type to check
   * @returns Promise<boolean>
   */
  async isNotificationEnabled(userId: string, notificationType: NotificationType): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(userId);
      
      switch (notificationType) {
        case 'like':
          return preferences.likes;
        case 'comment':
          return preferences.comments;
        case 'mention':
          return preferences.mentions;
        case 'follow':
          return preferences.follows;
        case 'reaction':
          return preferences.reactions;
        default:
          return true; // Default to enabled for unknown types
      }
      
    } catch (error) {
      console.error('Error checking notification preference:', error);
      return true; // Default to enabled on error
    }
  }
  
  /**
   * Update user's last active timestamp (for email digest logic)
   * @param userId - The user ID
   * @returns Promise<void>
   * Requirement: 9.10
   */
  async updateLastActive(userId: string): Promise<void> {
    try {
      const preferencesRef = ref(database, `notificationPreferences/${userId}/lastActiveAt`);
      await set(preferencesRef, Date.now());
      
    } catch (error) {
      console.error('Error updating last active timestamp:', error);
    }
  }
  
  /**
   * Check if user is in quiet hours
   * @param userId - The user ID
   * @returns Promise<boolean>
   */
  async isInQuietHours(userId: string): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(userId);
      
      if (!preferences.quietHoursEnabled) {
        return false;
      }
      
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const startTime = preferences.quietHoursStart;
      const endTime = preferences.quietHoursEnd;
      
      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
      } else {
        return currentTime >= startTime && currentTime <= endTime;
      }
      
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }
  
  /**
   * Get users who need email digest
   * @param frequency - The digest frequency to check
   * @returns Promise<string[]> - Array of user IDs
   * Requirement: 9.10
   */
  async getUsersNeedingDigest(frequency: 'daily' | 'weekly'): Promise<string[]> {
    try {
      const preferencesRef = ref(database, 'notificationPreferences');
      const snapshot = await get(preferencesRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const now = Date.now();
      const userIds: string[] = [];
      
      snapshot.forEach((childSnapshot) => {
        const preferences = childSnapshot.val() as NotificationPreferences;
        const userId = childSnapshot.key!;
        
        if (
          preferences.emailDigestEnabled &&
          preferences.emailDigestFrequency === frequency
        ) {
          // Check if user has been inactive long enough to warrant a digest
          const inactiveThreshold = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
          const timeSinceActive = now - (preferences.lastActiveAt || 0);
          
          if (timeSinceActive >= inactiveThreshold) {
            userIds.push(userId);
          }
        }
      });
      
      return userIds;
      
    } catch (error) {
      console.error('Error getting users needing digest:', error);
      return [];
    }
  }
  
  /**
   * Create default preferences for a new user
   * @param userId - The user ID
   * @returns Promise<NotificationPreferences>
   */
  private async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const now = Date.now();
    const preferences: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      userId,
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now
    };
    
    try {
      const preferencesRef = ref(database, `notificationPreferences/${userId}`);
      await set(preferencesRef, preferences);
      return preferences;
      
    } catch (error) {
      console.error('Error creating default preferences:', error);
      return preferences; // Return preferences even if save fails
    }
  }
  
  /**
   * Listen to real-time preference updates for a user
   * @param userId - The user ID
   * @param callback - Function to call when preferences update
   * @returns Function to unsubscribe from updates
   */
  listenToPreferences(
    userId: string,
    callback: (preferences: NotificationPreferences) => void
  ): () => void {
    const preferencesRef = ref(database, `notificationPreferences/${userId}`);
    
    return onValue(preferencesRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as NotificationPreferences);
      } else {
        // Create default preferences if none exist
        this.createDefaultPreferences(userId).then(callback);
      }
    });
  }
  
  /**
   * Reset preferences to default for a user
   * @param userId - The user ID
   * @returns Promise<NotificationPreferences>
   */
  async resetToDefaults(userId: string): Promise<NotificationPreferences> {
    try {
      const preferencesRef = ref(database, `notificationPreferences/${userId}`);
      await set(preferencesRef, null); // Remove existing preferences
      return await this.createDefaultPreferences(userId);
      
    } catch (error: any) {
      console.error('Error resetting preferences:', error);
      throw new Error(`Failed to reset preferences: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const notificationPreferencesService = new NotificationPreferencesService();

// Export pure functions for testing
export const NotificationPreferencesLogic = {
  /**
   * Check if current time is within quiet hours
   * @param currentTime - Current time in HH:MM format
   * @param startTime - Quiet hours start time in HH:MM format
   * @param endTime - Quiet hours end time in HH:MM format
   * @returns boolean - True if within quiet hours
   */
  isWithinQuietHours(currentTime: string, startTime: string, endTime: string): boolean {
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  },
  
  /**
   * Calculate next digest due time
   * @param lastDigestTime - Last digest timestamp
   * @param frequency - Digest frequency
   * @returns number - Next digest due timestamp
   */
  calculateNextDigestTime(lastDigestTime: number, frequency: 'daily' | 'weekly'): number {
    const intervalMs = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return lastDigestTime + intervalMs;
  },
  
  /**
   * Check if user needs digest based on activity
   * @param lastActiveAt - Last active timestamp
   * @param frequency - Digest frequency
   * @param currentTime - Current timestamp
   * @returns boolean - True if digest is needed
   */
  needsDigest(lastActiveAt: number, frequency: 'daily' | 'weekly', currentTime: number): boolean {
    const inactiveThreshold = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return (currentTime - lastActiveAt) >= inactiveThreshold;
  },
  
  /**
   * Validate time format (HH:MM)
   * @param time - Time string to validate
   * @returns boolean - True if valid format
   */
  isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  },
  
  /**
   * Create default preferences object
   * @param userId - The user ID
   * @param timestamp - Creation timestamp
   * @returns NotificationPreferences - Default preferences
   */
  createDefaultPreferences(userId: string, timestamp: number): NotificationPreferences {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      userId,
      lastActiveAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }
};