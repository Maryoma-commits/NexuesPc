// Email Digest Service for NexusPC Community Posts
// Handles email digest functionality for inactive users
// Requirements: 9.10

import { 
  ref, 
  get, 
  set, 
  query, 
  orderByChild, 
  limitToLast 
} from 'firebase/database';
import { database } from '../firebase.config';
import { 
  notificationPreferencesService,
  EmailDigestData 
} from './notificationPreferencesService';
import { communityNotificationService } from './communityNotificationService';
import { Notification, Post } from '../types/community-posts';

/**
 * Interface for digest email content
 */
export interface DigestEmailContent {
  recipientEmail: string;
  recipientName: string;
  unreadCount: number;
  activitySummary: {
    likes: number;
    comments: number;
    mentions: number;
    follows: number;
    reactions: number;
  };
  topPosts: Array<{
    id: string;
    content: string;
    authorName: string;
    engagementCount: number;
    createdAt: number;
  }>;
  digestPeriod: 'daily' | 'weekly';
  generatedAt: number;
}

/**
 * Interface for digest generation result
 */
export interface DigestGenerationResult {
  success: boolean;
  digestsGenerated: number;
  errors: string[];
}

/**
 * EmailDigestService handles email digest generation for inactive users
 * Requirements: 9.10
 */
export class EmailDigestService {
  
  /**
   * Generate email digests for users based on frequency
   * @param frequency - The digest frequency ('daily' or 'weekly')
   * @returns Promise<DigestGenerationResult>
   * Requirement: 9.10
   */
  async generateDigests(frequency: 'daily' | 'weekly'): Promise<DigestGenerationResult> {
    const result: DigestGenerationResult = {
      success: true,
      digestsGenerated: 0,
      errors: []
    };

    try {
      // Get users who need digest
      const userIds = await notificationPreferencesService.getUsersNeedingDigest(frequency);
      
      if (userIds.length === 0) {
        return result;
      }

      // Generate digest for each user
      for (const userId of userIds) {
        try {
          const digestContent = await this.generateUserDigest(userId, frequency);
          
          if (digestContent) {
            // In a real implementation, this would send the email
            // For now, we'll store the digest data for potential future use
            await this.storeDigestData(userId, digestContent);
            result.digestsGenerated++;
          }
          
        } catch (error: any) {
          result.errors.push(`Failed to generate digest for user ${userId}: ${error.message}`);
          result.success = false;
        }
      }

      return result;
      
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Failed to generate digests: ${error.message}`);
      return result;
    }
  }
  
  /**
   * Generate digest content for a specific user
   * @param userId - The user ID
   * @param frequency - The digest frequency
   * @returns Promise<DigestEmailContent | null>
   */
  async generateUserDigest(
    userId: string, 
    frequency: 'daily' | 'weekly'
  ): Promise<DigestEmailContent | null> {
    try {
      // Get user profile information
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        return null;
      }

      // Get user's unread notifications
      const notifications = await communityNotificationService.getUserNotifications(userId, 50);
      const unreadNotifications = notifications.filter(n => !n.read);

      // If no unread notifications, don't send digest
      if (unreadNotifications.length === 0) {
        return null;
      }

      // Calculate activity summary
      const activitySummary = this.calculateActivitySummary(unreadNotifications);

      // Get top posts from the period
      const topPosts = await this.getTopPostsForPeriod(frequency);

      // Generate digest content
      const digestContent: DigestEmailContent = {
        recipientEmail: userProfile.email,
        recipientName: userProfile.displayName,
        unreadCount: unreadNotifications.length,
        activitySummary,
        topPosts,
        digestPeriod: frequency,
        generatedAt: Date.now()
      };

      return digestContent;
      
    } catch (error) {
      console.error(`Error generating digest for user ${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Calculate activity summary from notifications
   * @param notifications - Array of notifications
   * @returns Activity summary object
   */
  private calculateActivitySummary(notifications: Notification[]): DigestEmailContent['activitySummary'] {
    const summary = {
      likes: 0,
      comments: 0,
      mentions: 0,
      follows: 0,
      reactions: 0
    };

    for (const notification of notifications) {
      switch (notification.type) {
        case 'like':
          summary.likes++;
          break;
        case 'comment':
          summary.comments++;
          break;
        case 'mention':
          summary.mentions++;
          break;
        case 'follow':
          summary.follows++;
          break;
        case 'reaction':
          summary.reactions++;
          break;
      }
    }

    return summary;
  }
  
  /**
   * Get top posts for the digest period
   * @param frequency - The digest frequency
   * @returns Promise<Array> - Top posts data
   */
  private async getTopPostsForPeriod(frequency: 'daily' | 'weekly'): Promise<DigestEmailContent['topPosts']> {
    try {
      const now = Date.now();
      const periodMs = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const startTime = now - periodMs;

      // Get posts from the period
      const postsRef = ref(database, 'communityPosts');
      const postsSnapshot = await get(postsRef);

      if (!postsSnapshot.exists()) {
        return [];
      }

      const posts: Array<Post & { id: string }> = [];
      postsSnapshot.forEach((childSnapshot) => {
        const post = childSnapshot.val() as Post;
        if (post.createdAt >= startTime && post.privacy === 'public') {
          posts.push({ ...post, id: childSnapshot.key! });
        }
      });

      // Sort by engagement (likes + comments) and take top 5
      const topPosts = posts
        .sort((a, b) => (b.likeCount + b.commentCount) - (a.likeCount + a.commentCount))
        .slice(0, 5)
        .map(post => ({
          id: post.id,
          content: post.content.substring(0, 200) + (post.content.length > 200 ? '...' : ''),
          authorName: 'User', // In real implementation, would fetch author name
          engagementCount: post.likeCount + post.commentCount,
          createdAt: post.createdAt
        }));

      return topPosts;
      
    } catch (error) {
      console.error('Error getting top posts:', error);
      return [];
    }
  }
  
  /**
   * Get user profile information
   * @param userId - The user ID
   * @returns Promise<UserProfile | null>
   */
  private async getUserProfile(userId: string): Promise<{ email: string; displayName: string } | null> {
    try {
      // In a real implementation, this would fetch from user profiles
      // For now, return a mock profile
      return {
        email: `user${userId}@example.com`,
        displayName: `User ${userId}`
      };
      
    } catch (error) {
      console.error(`Error getting user profile for ${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Store digest data for record keeping
   * @param userId - The user ID
   * @param digestContent - The digest content
   * @returns Promise<void>
   */
  private async storeDigestData(userId: string, digestContent: DigestEmailContent): Promise<void> {
    try {
      const digestRef = ref(database, `emailDigests/${userId}/${Date.now()}`);
      await set(digestRef, {
        ...digestContent,
        sent: false, // Would be true after actual email sending
        sentAt: null
      });
      
    } catch (error) {
      console.error('Error storing digest data:', error);
    }
  }
  
  /**
   * Get digest history for a user
   * @param userId - The user ID
   * @param limit - Maximum number of digests to retrieve
   * @returns Promise<EmailDigestData[]>
   */
  async getDigestHistory(userId: string, limit: number = 10): Promise<EmailDigestData[]> {
    try {
      const digestsRef = query(
        ref(database, `emailDigests/${userId}`),
        orderByChild('generatedAt'),
        limitToLast(limit)
      );
      
      const snapshot = await get(digestsRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      const digests: EmailDigestData[] = [];
      snapshot.forEach((childSnapshot) => {
        digests.push(childSnapshot.val() as EmailDigestData);
      });

      return digests.reverse(); // Most recent first
      
    } catch (error) {
      console.error('Error getting digest history:', error);
      return [];
    }
  }
  
  /**
   * Check if user should receive digest
   * @param userId - The user ID
   * @param frequency - The digest frequency
   * @returns Promise<boolean>
   */
  async shouldReceiveDigest(userId: string, frequency: 'daily' | 'weekly'): Promise<boolean> {
    try {
      const preferences = await notificationPreferencesService.getPreferences(userId);
      
      if (!preferences.emailDigestEnabled || preferences.emailDigestFrequency !== frequency) {
        return false;
      }

      // Check if user has been inactive long enough
      const now = Date.now();
      const inactiveThreshold = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      const timeSinceActive = now - preferences.lastActiveAt;

      if (timeSinceActive < inactiveThreshold) {
        return false;
      }

      // Check if digest was already sent recently
      const lastDigest = await this.getLastDigestTime(userId);
      if (lastDigest) {
        const timeSinceLastDigest = now - lastDigest;
        const digestInterval = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        
        if (timeSinceLastDigest < digestInterval) {
          return false;
        }
      }

      return true;
      
    } catch (error) {
      console.error('Error checking digest eligibility:', error);
      return false;
    }
  }
  
  /**
   * Get the timestamp of the last digest sent to a user
   * @param userId - The user ID
   * @returns Promise<number | null>
   */
  private async getLastDigestTime(userId: string): Promise<number | null> {
    try {
      const digestsRef = query(
        ref(database, `emailDigests/${userId}`),
        orderByChild('generatedAt'),
        limitToLast(1)
      );
      
      const snapshot = await get(digestsRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      let lastDigestTime: number | null = null;
      snapshot.forEach((childSnapshot) => {
        const digest = childSnapshot.val() as EmailDigestData;
        lastDigestTime = digest.generatedAt;
      });

      return lastDigestTime;
      
    } catch (error) {
      console.error('Error getting last digest time:', error);
      return null;
    }
  }
}

// Export a singleton instance
export const emailDigestService = new EmailDigestService();

// Export pure functions for testing
export const EmailDigestLogic = {
  /**
   * Calculate activity summary from notifications
   * @param notifications - Array of notifications
   * @returns Activity summary object
   */
  calculateActivitySummary(notifications: Array<{ type: string }>): DigestEmailContent['activitySummary'] {
    const summary = {
      likes: 0,
      comments: 0,
      mentions: 0,
      follows: 0,
      reactions: 0
    };

    for (const notification of notifications) {
      switch (notification.type) {
        case 'like':
          summary.likes++;
          break;
        case 'comment':
          summary.comments++;
          break;
        case 'mention':
          summary.mentions++;
          break;
        case 'follow':
          summary.follows++;
          break;
        case 'reaction':
          summary.reactions++;
          break;
      }
    }

    return summary;
  },
  
  /**
   * Check if enough time has passed for digest
   * @param lastActiveAt - Last active timestamp
   * @param frequency - Digest frequency
   * @param currentTime - Current timestamp
   * @returns boolean - True if enough time has passed
   */
  hasBeenInactiveLongEnough(
    lastActiveAt: number,
    frequency: 'daily' | 'weekly',
    currentTime: number
  ): boolean {
    const inactiveThreshold = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return (currentTime - lastActiveAt) >= inactiveThreshold;
  },
  
  /**
   * Check if enough time has passed since last digest
   * @param lastDigestTime - Last digest timestamp
   * @param frequency - Digest frequency
   * @param currentTime - Current timestamp
   * @returns boolean - True if enough time has passed
   */
  shouldSendNewDigest(
    lastDigestTime: number | null,
    frequency: 'daily' | 'weekly',
    currentTime: number
  ): boolean {
    if (!lastDigestTime) {
      return true;
    }
    
    const digestInterval = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return (currentTime - lastDigestTime) >= digestInterval;
  },
  
  /**
   * Truncate content for digest
   * @param content - Original content
   * @param maxLength - Maximum length
   * @returns Truncated content
   */
  truncateContent(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  },
  
  /**
   * Calculate engagement score for post ranking
   * @param likeCount - Number of likes
   * @param commentCount - Number of comments
   * @param ageInHours - Age of post in hours
   * @returns Engagement score
   */
  calculateEngagementScore(likeCount: number, commentCount: number, ageInHours: number): number {
    // Simple engagement score: (likes + comments * 2) / age_factor
    const ageFactor = Math.max(1, ageInHours / 24); // Newer posts get higher scores
    return (likeCount + commentCount * 2) / ageFactor;
  }
};