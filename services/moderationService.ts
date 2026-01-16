// ModerationService for NexusPC Community Posts
// Handles content reporting, automated flagging, user blocking, and moderation actions
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
  equalTo,
  onValue
} from 'firebase/database';
import { database } from '../firebase.config';
import { 
  ContentReport, 
  ModerationAction,
  PostError,
  PostErrorType
} from '../types/community-posts';

// Constants for moderation
export const PROHIBITED_KEYWORDS = [
  'spam', 'scam', 'fake', 'illegal', 'hate', 'harassment', 
  'violence', 'abuse', 'threat', 'discrimination'
];

export const PROFANITY_THRESHOLD = 3; // Number of profanity words that trigger auto-flag

/**
 * ModerationService handles content moderation, reporting, and user blocking
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10
 */
export class ModerationService {
  
  /**
   * Report inappropriate content
   * @param reportData - The report details
   * @param reporterId - The ID of the user making the report
   * @returns Promise<ContentReport> - The created report
   * Requirements: 6.1, 6.2
   */
  async reportContent(
    reportData: {
      postId?: string;
      commentId?: string;
      reason: string;
      description?: string;
    },
    reporterId: string
  ): Promise<ContentReport> {
    try {
      // Validate report data
      if (!reportData.postId && !reportData.commentId) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Must specify either post or comment to report');
      }
      
      if (!reportData.reason || reportData.reason.trim().length === 0) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Report reason is required');
      }
      
      // Verify content exists
      if (reportData.postId) {
        const postRef = ref(database, `posts/${reportData.postId}`);
        const postSnapshot = await get(postRef);
        if (!postSnapshot.exists()) {
          throw new PostError(PostErrorType.PERMISSION_DENIED, 'Post not found');
        }
      }
      
      if (reportData.commentId && reportData.postId) {
        const commentRef = ref(database, `comments/${reportData.postId}/${reportData.commentId}`);
        const commentSnapshot = await get(commentRef);
        if (!commentSnapshot.exists()) {
          throw new PostError(PostErrorType.PERMISSION_DENIED, 'Comment not found');
        }
      }
      
      // Create report object
      const now = Date.now();
      const report: Omit<ContentReport, 'id'> = {
        reporterId,
        postId: reportData.postId,
        commentId: reportData.commentId,
        reason: reportData.reason.trim(),
        description: reportData.description?.trim(),
        createdAt: now,
        status: 'pending'
      };
      
      // Save to Firebase
      const reportsRef = ref(database, 'contentReports');
      const newReportRef = push(reportsRef);
      await set(newReportRef, report);
      
      const createdReport: ContentReport = {
        id: newReportRef.key!,
        ...report
      };
      
      // Auto-flag content if it meets criteria
      await this.checkAutoFlag(reportData.postId, reportData.commentId);
      
      return createdReport;
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to report content: ${error.message}`, true);
    }
  }
  
  /**
   * Get reports for moderation review
   * @param status - Filter by report status
   * @param limit - Maximum number of reports to retrieve
   * @returns Promise<ContentReport[]>
   * Requirement: 6.3
   */
  async getReports(status?: 'pending' | 'reviewed' | 'dismissed', limit: number = 50): Promise<ContentReport[]> {
    try {
      const reportsRef = ref(database, 'contentReports');
      let reportsQuery;
      
      if (status) {
        reportsQuery = query(
          reportsRef,
          orderByChild('status'),
          equalTo(status),
          limitToLast(limit)
        );
      } else {
        reportsQuery = query(
          reportsRef,
          orderByChild('createdAt'),
          limitToLast(limit)
        );
      }
      
      const snapshot = await get(reportsQuery);
      const reports: ContentReport[] = [];
      
      snapshot.forEach((childSnapshot) => {
        reports.push({
          id: childSnapshot.key!,
          ...childSnapshot.val()
        });
      });
      
      // Sort by creation time (newest first)
      reports.sort((a, b) => b.createdAt - a.createdAt);
      
      return reports;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get reports: ${error.message}`, true);
    }
  }
  
  /**
   * Take moderation action on reported content
   * @param reportId - The ID of the report
   * @param action - The moderation action to take
   * @param moderatorId - The ID of the moderator
   * @param reason - Reason for the action
   * @returns Promise<ModerationAction>
   * Requirements: 6.3, 6.4, 6.9
   */
  async takeModerationAction(
    reportId: string,
    action: 'hide' | 'delete' | 'ban' | 'warn' | 'dismiss',
    moderatorId: string,
    reason: string
  ): Promise<ModerationAction> {
    try {
      // Get the report
      const reportRef = ref(database, `contentReports/${reportId}`);
      const reportSnapshot = await get(reportRef);
      
      if (!reportSnapshot.exists()) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Report not found');
      }
      
      const report = reportSnapshot.val() as ContentReport;
      
      // Create moderation action record
      const now = Date.now();
      const moderationAction: Omit<ModerationAction, 'id'> = {
        moderatorId,
        targetType: report.postId ? 'post' : 'comment',
        targetId: report.postId || report.commentId!,
        action: action === 'dismiss' ? 'warn' : action, // Convert dismiss to warn for logging
        reason,
        createdAt: now
      };
      
      // Save moderation action
      const actionsRef = ref(database, 'moderationActions');
      const newActionRef = push(actionsRef);
      await set(newActionRef, moderationAction);
      
      // Apply the action
      if (action !== 'dismiss') {
        await this.applyModerationAction(report, action, moderatorId);
      }
      
      // Update report status
      await update(reportRef, {
        status: action === 'dismiss' ? 'dismissed' : 'reviewed',
        reviewedBy: moderatorId,
        reviewedAt: now
      });
      
      return {
        id: newActionRef.key!,
        ...moderationAction
      };
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to take moderation action: ${error.message}`, true);
    }
  }
  
  /**
   * Block a user to prevent seeing their content
   * @param blockerId - The ID of the user doing the blocking
   * @param blockedId - The ID of the user being blocked
   * @returns Promise<void>
   * Requirement: 6.7
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    try {
      if (blockerId === blockedId) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Cannot block yourself');
      }
      
      // Add to blocked users list
      const blockRef = ref(database, `userBlocks/${blockerId}/${blockedId}`);
      await set(blockRef, {
        blockedAt: Date.now()
      });
      
      // Remove any existing follow relationships
      const followerRef = ref(database, `userFollows/${blockerId}/following/${blockedId}`);
      const followingRef = ref(database, `userFollows/${blockedId}/followers/${blockerId}`);
      
      await Promise.all([
        remove(followerRef),
        remove(followingRef)
      ]);
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to block user: ${error.message}`, true);
    }
  }
  
  /**
   * Unblock a user
   * @param blockerId - The ID of the user doing the unblocking
   * @param blockedId - The ID of the user being unblocked
   * @returns Promise<void>
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    try {
      const blockRef = ref(database, `userBlocks/${blockerId}/${blockedId}`);
      await remove(blockRef);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to unblock user: ${error.message}`, true);
    }
  }
  
  /**
   * Check if a user is blocked by another user
   * @param viewerId - The ID of the user viewing content
   * @param authorId - The ID of the content author
   * @returns Promise<boolean>
   */
  async isUserBlocked(viewerId: string, authorId: string): Promise<boolean> {
    try {
      const blockRef = ref(database, `userBlocks/${viewerId}/${authorId}`);
      const snapshot = await get(blockRef);
      return snapshot.exists();
      
    } catch (error: any) {
      return false; // Default to not blocked on error
    }
  }
  
  /**
   * Get list of blocked users for a user
   * @param userId - The ID of the user
   * @returns Promise<string[]> - Array of blocked user IDs
   */
  async getBlockedUsers(userId: string): Promise<string[]> {
    try {
      const blocksRef = ref(database, `userBlocks/${userId}`);
      const snapshot = await get(blocksRef);
      
      const blockedUsers: string[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          blockedUsers.push(childSnapshot.key!);
        });
      }
      
      return blockedUsers;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get blocked users: ${error.message}`, true);
    }
  }
  
  /**
   * Automatically flag content based on keywords and profanity
   * @param postId - The ID of the post (if applicable)
   * @param commentId - The ID of the comment (if applicable)
   * @returns Promise<boolean> - Whether content was flagged
   * Requirement: 6.5
   */
  async checkAutoFlag(postId?: string, commentId?: string): Promise<boolean> {
    try {
      let content = '';
      
      // Get content to analyze
      if (postId && !commentId) {
        const postRef = ref(database, `posts/${postId}`);
        const postSnapshot = await get(postRef);
        if (postSnapshot.exists()) {
          content = postSnapshot.val().content;
        }
      } else if (postId && commentId) {
        const commentRef = ref(database, `comments/${postId}/${commentId}`);
        const commentSnapshot = await get(commentRef);
        if (commentSnapshot.exists()) {
          content = commentSnapshot.val().content;
        }
      }
      
      if (!content) {
        return false;
      }
      
      // Check for prohibited keywords
      const lowerContent = content.toLowerCase();
      const hasProhibitedKeywords = PROHIBITED_KEYWORDS.some(keyword => 
        lowerContent.includes(keyword)
      );
      
      // Check for excessive profanity (simplified check)
      const profanityCount = this.countProfanity(content);
      const hasExcessiveProfanity = profanityCount >= PROFANITY_THRESHOLD;
      
      // Flag if criteria met
      if (hasProhibitedKeywords || hasExcessiveProfanity) {
        await this.flagContent(postId, commentId, 'Automatic flagging: inappropriate content detected');
        return true;
      }
      
      return false;
      
    } catch (error: any) {
      // Don't throw on auto-flag errors, just log and continue
      console.error('Auto-flag check failed:', error);
      return false;
    }
  }
  
  /**
   * Flag content as inappropriate
   * @param postId - The ID of the post (if applicable)
   * @param commentId - The ID of the comment (if applicable)
   * @param reason - Reason for flagging
   * @returns Promise<void>
   */
  private async flagContent(postId?: string, commentId?: string, reason: string = 'Flagged for review'): Promise<void> {
    try {
      if (postId && !commentId) {
        // Flag post
        const postRef = ref(database, `posts/${postId}`);
        await update(postRef, {
          isFlagged: true,
          flaggedAt: Date.now(),
          flagReason: reason
        });
      } else if (postId && commentId) {
        // Flag comment
        const commentRef = ref(database, `comments/${postId}/${commentId}`);
        await update(commentRef, {
          isFlagged: true,
          flaggedAt: Date.now(),
          flagReason: reason
        });
      }
      
    } catch (error: any) {
      console.error('Failed to flag content:', error);
    }
  }
  
  /**
   * Apply moderation action to content
   * @param report - The content report
   * @param action - The action to apply
   * @param moderatorId - The ID of the moderator
   * @returns Promise<void>
   */
  private async applyModerationAction(
    report: ContentReport, 
    action: 'hide' | 'delete' | 'ban' | 'warn',
    moderatorId: string
  ): Promise<void> {
    try {
      if (report.postId && !report.commentId) {
        // Action on post
        const postRef = ref(database, `posts/${report.postId}`);
        
        if (action === 'hide') {
          await update(postRef, {
            isHidden: true,
            hiddenBy: moderatorId,
            hiddenAt: Date.now()
          });
        } else if (action === 'delete') {
          await remove(postRef);
          // Also remove related data
          await Promise.all([
            remove(ref(database, `comments/${report.postId}`)),
            remove(ref(database, `likes/${report.postId}`)),
            remove(ref(database, `reactions/${report.postId}`))
          ]);
        }
      } else if (report.postId && report.commentId) {
        // Action on comment
        const commentRef = ref(database, `comments/${report.postId}/${report.commentId}`);
        
        if (action === 'hide') {
          await update(commentRef, {
            isHidden: true,
            hiddenBy: moderatorId,
            hiddenAt: Date.now()
          });
        } else if (action === 'delete') {
          await update(commentRef, {
            content: '[Comment removed by moderator]',
            isDeleted: true,
            deletedBy: moderatorId,
            deletedAt: Date.now()
          });
        }
      }
      
      // Handle user-level actions
      if (action === 'ban' || action === 'warn') {
        // Get the author of the content
        let authorId = '';
        
        if (report.postId && !report.commentId) {
          const postRef = ref(database, `posts/${report.postId}`);
          const postSnapshot = await get(postRef);
          if (postSnapshot.exists()) {
            authorId = postSnapshot.val().authorId;
          }
        } else if (report.postId && report.commentId) {
          const commentRef = ref(database, `comments/${report.postId}/${report.commentId}`);
          const commentSnapshot = await get(commentRef);
          if (commentSnapshot.exists()) {
            authorId = commentSnapshot.val().authorId;
          }
        }
        
        if (authorId) {
          if (action === 'ban') {
            await this.banUser(authorId, moderatorId, 'Content violation');
          } else if (action === 'warn') {
            await this.warnUser(authorId, moderatorId, 'Content warning');
          }
        }
      }
      
    } catch (error: any) {
      console.error('Failed to apply moderation action:', error);
    }
  }
  
  /**
   * Ban a user
   * @param userId - The ID of the user to ban
   * @param moderatorId - The ID of the moderator
   * @param reason - Reason for the ban
   * @returns Promise<void>
   */
  private async banUser(userId: string, moderatorId: string, reason: string): Promise<void> {
    try {
      const banRef = ref(database, `userBans/${userId}`);
      await set(banRef, {
        bannedBy: moderatorId,
        bannedAt: Date.now(),
        reason,
        isActive: true
      });
      
    } catch (error: any) {
      console.error('Failed to ban user:', error);
    }
  }
  
  /**
   * Warn a user
   * @param userId - The ID of the user to warn
   * @param moderatorId - The ID of the moderator
   * @param reason - Reason for the warning
   * @returns Promise<void>
   */
  private async warnUser(userId: string, moderatorId: string, reason: string): Promise<void> {
    try {
      const warningsRef = ref(database, `userWarnings/${userId}`);
      const newWarningRef = push(warningsRef);
      await set(newWarningRef, {
        warnedBy: moderatorId,
        warnedAt: Date.now(),
        reason
      });
      
    } catch (error: any) {
      console.error('Failed to warn user:', error);
    }
  }
  
  /**
   * Count profanity words in content (simplified implementation)
   * @param content - The content to analyze
   * @returns number - Count of profanity words
   */
  private countProfanity(content: string): number {
    // Simplified profanity detection - in production you'd use a proper library
    const profanityWords = ['damn', 'hell', 'crap', 'stupid', 'idiot'];
    const words = content.toLowerCase().split(/\s+/);
    
    return words.filter(word => profanityWords.includes(word)).length;
  }
}

// Export a singleton instance
export const moderationService = new ModerationService();

// Export pure functions for testing (without Firebase dependency)
export const ModerationLogic = {
  /**
   * Check if content contains prohibited keywords
   * @param content - The content to check
   * @param keywords - Array of prohibited keywords
   * @returns boolean
   */
  containsProhibitedKeywords(content: string, keywords: string[] = PROHIBITED_KEYWORDS): boolean {
    const lowerContent = content.toLowerCase();
    return keywords.some(keyword => lowerContent.includes(keyword));
  },
  
  /**
   * Count profanity words in content
   * @param content - The content to analyze
   * @param profanityWords - Array of profanity words to check
   * @returns number
   */
  countProfanity(content: string, profanityWords: string[] = ['damn', 'hell', 'crap', 'stupid', 'idiot']): number {
    const words = content.toLowerCase().split(/\s+/);
    return words.filter(word => profanityWords.includes(word)).length;
  },
  
  /**
   * Check if content should be auto-flagged
   * @param content - The content to check
   * @param profanityThreshold - Number of profanity words that trigger flagging
   * @returns boolean
   */
  shouldAutoFlag(content: string, profanityThreshold: number = PROFANITY_THRESHOLD): boolean {
    const hasProhibitedKeywords = this.containsProhibitedKeywords(content);
    const profanityCount = this.countProfanity(content);
    const hasExcessiveProfanity = profanityCount >= profanityThreshold;
    
    return hasProhibitedKeywords || hasExcessiveProfanity;
  },
  
  /**
   * Validate report data
   * @param reportData - The report data to validate
   * @returns { valid: boolean, error?: string }
   */
  validateReport(reportData: {
    postId?: string;
    commentId?: string;
    reason: string;
    description?: string;
  }): { valid: boolean; error?: string } {
    if (!reportData.postId && !reportData.commentId) {
      return { valid: false, error: 'Must specify either post or comment to report' };
    }
    
    if (!reportData.reason || reportData.reason.trim().length === 0) {
      return { valid: false, error: 'Report reason is required' };
    }
    
    if (reportData.reason.length > 500) {
      return { valid: false, error: 'Report reason cannot exceed 500 characters' };
    }
    
    if (reportData.description && reportData.description.length > 1000) {
      return { valid: false, error: 'Report description cannot exceed 1000 characters' };
    }
    
    return { valid: true };
  },
  
  /**
   * Check if user can be blocked
   * @param blockerId - The ID of the user doing the blocking
   * @param blockedId - The ID of the user being blocked
   * @returns { canBlock: boolean, error?: string }
   */
  canBlockUser(blockerId: string, blockedId: string): { canBlock: boolean; error?: string } {
    if (blockerId === blockedId) {
      return { canBlock: false, error: 'Cannot block yourself' };
    }
    
    if (!blockerId || !blockedId) {
      return { canBlock: false, error: 'Both user IDs are required' };
    }
    
    return { canBlock: true };
  }
};