// EngagementService for NexusPC Community Posts
// Facebook-style reactions with transactions for atomic updates
// Data structure: posts/{postId}/reactions/{userId} and posts/{postId}/reactionCounts
import { 
  ref, 
  get, 
  set, 
  remove, 
  onValue,
  push
} from 'firebase/database';
import { database } from '../firebase.config';
import { 
  ReactionType,
  PostError,
  PostErrorType
} from '../types/community-posts';

// Reaction data stored per user
interface UserReaction {
  type: ReactionType;
  updatedAt: number;
}

/**
 * EngagementService handles all reaction-related operations using transactions
 * Data structure follows Facebook pattern: reactions stored inside posts with userId as key
 */
export class EngagementService {
  
  /**
   * Create a notification for post interaction
   */
  private async createPostNotification(
    recipientUserId: string,
    fromUserId: string,
    postId: string,
    type: 'like' | 'reaction',
    reactionType?: ReactionType
  ): Promise<void> {
    try {
      // Don't notify yourself
      if (recipientUserId === fromUserId) return;
      
      const notificationRef = ref(database, `communityNotifications/${recipientUserId}`);
      const newNotifRef = push(notificationRef);
      
      const notification = {
        userId: recipientUserId,
        type: type,
        fromUserId,
        postId,
        createdAt: Date.now(),
        read: false,
        message: type === 'like' 
          ? 'liked your post'
          : `reacted with ${reactionType || 'a reaction'} to your post`
      };
      
      await set(newNotifRef, notification);
    } catch (error) {
      // Don't fail the reaction if notification fails
      console.error('Failed to create notification:', error);
    }
  }

  /**
   * Set or toggle a reaction on a post
   * This is the main method - handles add, change, and remove
   * @param postId - The ID of the post
   * @param userId - The ID of the user reacting
   * @param newType - The reaction type to set
   * @returns Promise<{ reacted: boolean, reactionType: ReactionType | null }>
   */
  async setReaction(
    postId: string, 
    userId: string, 
    newType: ReactionType
  ): Promise<{ reacted: boolean; reactionType: ReactionType | null }> {
    try {
      // Get current user reaction
      const userReactionRef = ref(database, `posts/${postId}/reactions/${userId}`);
      const reactionCountsRef = ref(database, `posts/${postId}/reactionCounts`);
      
      // Get current state
      const [reactionSnapshot, countsSnapshot] = await Promise.all([
        get(userReactionRef),
        get(reactionCountsRef)
      ]);
      
      const prevReaction = reactionSnapshot.exists() ? reactionSnapshot.val() as UserReaction : null;
      const prevType = prevReaction?.type;
      const currentCounts = countsSnapshot.exists() ? countsSnapshot.val() : {};
      
      let result: { reacted: boolean; reactionType: ReactionType | null };
      
      // Toggle off if same reaction
      if (prevType === newType) {
        // Remove reaction
        await remove(userReactionRef);
        
        // Update count
        const newCount = Math.max(0, (currentCounts[prevType] || 0) - 1);
        if (newCount === 0) {
          await remove(ref(database, `posts/${postId}/reactionCounts/${prevType}`));
        } else {
          await set(ref(database, `posts/${postId}/reactionCounts/${prevType}`), newCount);
        }
        
        result = { reacted: false, reactionType: null };
      } else {
        // Decrement old reaction count if switching
        if (prevType) {
          const oldCount = Math.max(0, (currentCounts[prevType] || 0) - 1);
          if (oldCount === 0) {
            await remove(ref(database, `posts/${postId}/reactionCounts/${prevType}`));
          } else {
            await set(ref(database, `posts/${postId}/reactionCounts/${prevType}`), oldCount);
          }
        }
        
        // Set new reaction
        await set(userReactionRef, {
          type: newType,
          updatedAt: Date.now()
        });
        
        // Increment new reaction count
        const newCount = (currentCounts[newType] || 0) + 1;
        await set(ref(database, `posts/${postId}/reactionCounts/${newType}`), newCount);
        
        result = { reacted: true, reactionType: newType };
      }
      
      // Send notification if reacted (not on removal)
      if (result.reacted) {
        // Get post author for notification
        const postSnapshot = await get(ref(database, `posts/${postId}/authorId`));
        if (postSnapshot.exists()) {
          const authorId = postSnapshot.val();
          await this.createPostNotification(authorId, userId, postId, 'reaction', result.reactionType!);
        }
      }

      return result;

    } catch (error: any) {
      throw new PostError(
        PostErrorType.NETWORK_ERROR, 
        `Failed to set reaction: ${error.message}`, 
        true
      );
    }
  }

  /**
   * Remove a reaction from a post
   * @param postId - The ID of the post
   * @param userId - The ID of the user
   * @returns Promise<void>
   */
  async removeReaction(postId: string, userId: string): Promise<void> {
    try {
      const userReactionRef = ref(database, `posts/${postId}/reactions/${userId}`);
      
      // Get current reaction
      const reactionSnapshot = await get(userReactionRef);
      if (!reactionSnapshot.exists()) return; // No reaction to remove
      
      const prevReaction = reactionSnapshot.val() as UserReaction;
      const prevType = prevReaction.type;
      
      // Remove reaction
      await remove(userReactionRef);
      
      // Decrement count
      const countRef = ref(database, `posts/${postId}/reactionCounts/${prevType}`);
      const countSnapshot = await get(countRef);
      const currentCount = countSnapshot.exists() ? countSnapshot.val() : 0;
      const newCount = Math.max(0, currentCount - 1);
      
      if (newCount === 0) {
        await remove(countRef);
      } else {
        await set(countRef, newCount);
      }
    } catch (error: any) {
      throw new PostError(
        PostErrorType.NETWORK_ERROR, 
        `Failed to remove reaction: ${error.message}`, 
        true
      );
    }
  }

  /**
   * Get user's current reaction on a post
   * @param postId - The ID of the post
   * @param userId - The ID of the user
   * @returns Promise<ReactionType | null>
   */
  async getUserReaction(postId: string, userId: string): Promise<ReactionType | null> {
    try {
      const reactionRef = ref(database, `posts/${postId}/reactions/${userId}`);
      const snapshot = await get(reactionRef);
      
      if (!snapshot.exists()) {
        return null;
      }
      
      const reaction = snapshot.val() as UserReaction;
      return reaction.type || null;
    } catch (error: any) {
      throw new PostError(
        PostErrorType.NETWORK_ERROR, 
        `Failed to get user reaction: ${error.message}`, 
        true
      );
    }
  }

  /**
   * Get reaction counts for a post
   * @param postId - The ID of the post
   * @returns Promise<Partial<Record<ReactionType, number>>>
   */
  async getReactionCounts(postId: string): Promise<Partial<Record<ReactionType, number>>> {
    try {
      const countsRef = ref(database, `posts/${postId}/reactionCounts`);
      const snapshot = await get(countsRef);
      
      if (!snapshot.exists()) {
        return {};
      }
      
      return snapshot.val() || {};
    } catch (error: any) {
      throw new PostError(
        PostErrorType.NETWORK_ERROR, 
        `Failed to get reaction counts: ${error.message}`, 
        true
      );
    }
  }

  /**
   * Listen to real-time reaction count updates for a post
   * @param postId - The ID of the post
   * @param callback - Function to call when counts update
   * @returns Function to unsubscribe
   */
  listenToReactionCounts(
    postId: string, 
    callback: (counts: Partial<Record<ReactionType, number>>) => void
  ): () => void {
    const countsRef = ref(database, `posts/${postId}/reactionCounts`);
    
    return onValue(countsRef, (snapshot) => {
      callback(snapshot.val() || {});
    });
  }

  /**
   * Listen to real-time updates for user's own reaction on a post
   * @param postId - The ID of the post
   * @param userId - The ID of the user
   * @param callback - Function to call when reaction updates
   * @returns Function to unsubscribe
   */
  listenToUserReaction(
    postId: string,
    userId: string,
    callback: (reactionType: ReactionType | null) => void
  ): () => void {
    const reactionRef = ref(database, `posts/${postId}/reactions/${userId}`);
    
    return onValue(reactionRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const reaction = snapshot.val() as UserReaction;
      callback(reaction?.type || null);
    });
  }

  /**
   * Toggle reaction on a post (convenience method - same as setReaction)
   * @param postId - The ID of the post
   * @param userId - The ID of the user
   * @param reactionType - The type of reaction
   * @returns Promise<{ reacted: boolean, reactionType: ReactionType | null }>
   */
  async toggleReaction(
    postId: string, 
    userId: string, 
    reactionType: ReactionType
  ): Promise<{ reacted: boolean; reactionType: ReactionType | null }> {
    return this.setReaction(postId, userId, reactionType);
  }

  // ============ LEGACY METHODS (for backward compatibility) ============
  // These are kept for any code that might still use the old API

  /**
   * @deprecated Use getUserReaction instead
   */
  async hasUserLiked(postId: string, userId: string): Promise<boolean> {
    const reaction = await this.getUserReaction(postId, userId);
    return reaction === 'like';
  }

  /**
   * @deprecated Use listenToReactionCounts instead
   */
  listenToPostReactions(
    postId: string, 
    callback: (reactions: any, counts: Partial<Record<ReactionType, number>>) => void
  ): () => void {
    return this.listenToReactionCounts(postId, (counts) => {
      callback({}, counts);
    });
  }

  /**
   * @deprecated Use listenToReactionCounts instead
   */
  listenToPostLikes(postId: string, callback: (likes: any[], count: number) => void): () => void {
    return this.listenToReactionCounts(postId, (counts) => {
      const likeCount = counts.like || 0;
      callback([], likeCount);
    });
  }
}

// Export a singleton instance
export const engagementService = new EngagementService();

// Export pure functions for testing (without Firebase dependency)
export const ReactionSystemLogic = {
  /**
   * Validate if a user can react to a post
   */
  canUserReactToPost(postAuthorId: string, userId: string): boolean {
    return postAuthorId !== userId;
  },
  
  /**
   * Calculate new reaction counts after reaction action
   */
  calculateReactionCounts(
    currentCounts: Partial<Record<ReactionType, number>>,
    oldReaction: ReactionType | null,
    newReaction: ReactionType | null
  ): Partial<Record<ReactionType, number>> {
    const newCounts = { ...currentCounts };
    
    // Decrement old reaction count
    if (oldReaction) {
      newCounts[oldReaction] = Math.max(0, (newCounts[oldReaction] || 0) - 1);
    }
    
    // Increment new reaction count
    if (newReaction) {
      newCounts[newReaction] = (newCounts[newReaction] || 0) + 1;
    }
    
    return newCounts;
  },
  
  /**
   * Determine reaction action result
   */
  determineReactionAction(
    currentReaction: ReactionType | null,
    newReaction: ReactionType
  ): { shouldAdd: boolean; shouldRemove: boolean; finalReaction: ReactionType | null } {
    if (currentReaction === newReaction) {
      // Same reaction - toggle off
      return { shouldAdd: false, shouldRemove: true, finalReaction: null };
    } else if (currentReaction) {
      // Different reaction - replace
      return { shouldAdd: true, shouldRemove: true, finalReaction: newReaction };
    } else {
      // No current reaction - add new
      return { shouldAdd: true, shouldRemove: false, finalReaction: newReaction };
    }
  },
  
  /**
   * Get total reaction count from counts object
   */
  getTotalReactionCount(counts: Partial<Record<ReactionType, number>>): number {
    return Object.values(counts).reduce((sum, count) => sum + (count || 0), 0);
  },

  /**
   * Check if user has any reaction on a post
   */
  getUserReactionFromMap(
    userReactions: Partial<Record<ReactionType, string[]>>,
    userId: string
  ): ReactionType | null {
    for (const [type, users] of Object.entries(userReactions)) {
      if (users && users.includes(userId)) {
        return type as ReactionType;
      }
    }
    return null;
  }
};

// Legacy LikeSystemLogic for backward compatibility with tests
export const LikeSystemLogic = {
  /**
   * Validate if a user can like a post
   */
  canUserLikePost(postAuthorId: string, userId: string): boolean {
    return postAuthorId !== userId;
  },
  
  /**
   * Calculate new like count after like action
   */
  calculateLikeCount(currentCount: number, isLiking: boolean): number {
    if (isLiking) {
      return currentCount + 1;
    }
    return Math.max(0, currentCount - 1);
  },
  
  /**
   * Determine like action result
   */
  determineLikeAction(userHasLiked: boolean): { shouldLike: boolean; newLikedState: boolean } {
    return {
      shouldLike: !userHasLiked,
      newLikedState: !userHasLiked
    };
  }
};
