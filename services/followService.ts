// Follow Service for NexusPC Community Posts
// Handles user following/unfollowing functionality and feed prioritization
import { 
  ref, 
  push, 
  set, 
  get, 
  remove, 
  update, 
  onValue,
  query,
  orderByChild,
  equalTo,
  serverTimestamp
} from 'firebase/database';
import { database } from '../firebase.config';
import { Post, UserProfile } from '../types/community-posts';

/**
 * FollowSystemLogic contains pure functions for follow operations
 * These can be tested independently of React components and Firebase
 */
export const FollowSystemLogic = {
  /**
   * Determine the result of a follow action
   * Requirement 7.2: Follow/unfollow updates follower lists correctly
   * @param isCurrentlyFollowing - Whether the user is currently following
   * @returns The new following state
   */
  determineFollowAction(isCurrentlyFollowing: boolean): {
    shouldFollow: boolean;
    newFollowingState: boolean;
  } {
    return {
      shouldFollow: !isCurrentlyFollowing,
      newFollowingState: !isCurrentlyFollowing
    };
  },

  /**
   * Calculate follower count after follow/unfollow action
   * @param currentCount - Current follower count
   * @param isFollowing - Whether the action is a follow (true) or unfollow (false)
   * @returns New follower count (never negative)
   */
  calculateFollowerCount(currentCount: number, isFollowing: boolean): number {
    if (isFollowing) {
      return currentCount + 1;
    }
    return Math.max(0, currentCount - 1);
  },

  /**
   * Calculate following count after follow/unfollow action
   * @param currentCount - Current following count
   * @param isFollowing - Whether the action is a follow (true) or unfollow (false)
   * @returns New following count (never negative)
   */
  calculateFollowingCount(currentCount: number, isFollowing: boolean): number {
    if (isFollowing) {
      return currentCount + 1;
    }
    return Math.max(0, currentCount - 1);
  },

  /**
   * Check if a user can follow another user
   * Users cannot follow themselves
   * @param followerId - ID of the user trying to follow
   * @param targetId - ID of the user being followed
   * @returns Whether the follow action is allowed
   */
  canUserFollow(followerId: string, targetId: string): boolean {
    // Users cannot follow themselves
    if (followerId === targetId) {
      return false;
    }
    // Both IDs must be non-empty
    if (!followerId || !targetId) {
      return false;
    }
    return true;
  },

  /**
   * Check if a follow request is required (for private profiles)
   * Requirement 7.6, 7.7: Private profiles require follow approval
   * @param targetProfile - The profile of the user being followed
   * @returns Whether a follow request is required
   */
  requiresFollowRequest(targetProfile: { isPrivate: boolean }): boolean {
    return targetProfile.isPrivate === true;
  },

  /**
   * Check if a user can view another user's posts
   * Requirement 7.6, 7.7: Private profile access control
   * @param viewerId - ID of the user trying to view
   * @param authorId - ID of the post author
   * @param authorIsPrivate - Whether the author has a private profile
   * @param isFollowing - Whether the viewer is following the author
   * @param isApproved - Whether the follow request is approved (for private profiles)
   * @returns Whether the viewer can see the author's posts
   */
  canViewUserPosts(
    viewerId: string,
    authorId: string,
    authorIsPrivate: boolean,
    isFollowing: boolean,
    isApproved: boolean = true
  ): boolean {
    // Users can always view their own posts
    if (viewerId === authorId) {
      return true;
    }
    
    // Public profiles: anyone can view
    if (!authorIsPrivate) {
      return true;
    }
    
    // Private profiles: only approved followers can view
    return isFollowing && isApproved;
  },

  /**
   * Prioritize posts from followed users in feed
   * Requirement 7.3: Posts from followed users appear with higher priority
   * @param posts - Array of posts to prioritize
   * @param followedUserIds - Set of user IDs that the current user follows
   * @returns Posts sorted with followed users' posts first, then by timestamp
   */
  prioritizeFollowedUsersPosts(posts: Post[], followedUserIds: Set<string>): Post[] {
    return [...posts].sort((a, b) => {
      const aIsFollowed = followedUserIds.has(a.authorId);
      const bIsFollowed = followedUserIds.has(b.authorId);
      
      // If one is followed and the other isn't, followed comes first
      if (aIsFollowed && !bIsFollowed) return -1;
      if (!aIsFollowed && bIsFollowed) return 1;
      
      // If both are followed or both are not, sort by timestamp (newest first)
      return b.createdAt - a.createdAt;
    });
  },

  /**
   * Check if posts are properly prioritized (followed users first)
   * @param posts - Array of posts to check
   * @param followedUserIds - Set of user IDs that the current user follows
   * @returns Whether posts are properly prioritized
   */
  arePostsPrioritized(posts: Post[], followedUserIds: Set<string>): boolean {
    if (posts.length <= 1) return true;
    
    let seenNonFollowed = false;
    
    for (const post of posts) {
      const isFollowed = followedUserIds.has(post.authorId);
      
      if (isFollowed && seenNonFollowed) {
        // Found a followed user's post after a non-followed user's post
        return false;
      }
      
      if (!isFollowed) {
        seenNonFollowed = true;
      }
    }
    
    return true;
  },

  /**
   * Validate follow relationship data
   * @param followerId - ID of the follower
   * @param followedId - ID of the followed user
   * @param timestamp - When the follow occurred
   * @returns Whether the follow data is valid
   */
  validateFollowData(followerId: string, followedId: string, timestamp: number): boolean {
    if (!followerId || !followedId) return false;
    if (followerId === followedId) return false;
    if (typeof timestamp !== 'number' || timestamp <= 0) return false;
    return true;
  },

  /**
   * Get profile statistics
   * Requirement 7.4: Display user's post count, follower count, and following count
   * @param postCount - Number of posts
   * @param followerCount - Number of followers
   * @param followingCount - Number of users being followed
   * @returns Formatted statistics object
   */
  getProfileStatistics(postCount: number, followerCount: number, followingCount: number): {
    postCount: number;
    followerCount: number;
    followingCount: number;
    isValid: boolean;
  } {
    return {
      postCount: Math.max(0, postCount),
      followerCount: Math.max(0, followerCount),
      followingCount: Math.max(0, followingCount),
      isValid: postCount >= 0 && followerCount >= 0 && followingCount >= 0
    };
  }
};

/**
 * Follow request status
 */
export type FollowRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Follow request interface
 */
export interface FollowRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FollowRequestStatus;
  createdAt: number;
  updatedAt?: number;
}

/**
 * FollowService handles Firebase operations for the follow system
 */
export class FollowService {
  /**
   * Follow a user
   * @param followerId - ID of the user following
   * @param targetId - ID of the user being followed
   * @returns Promise<void>
   */
  async followUser(followerId: string, targetId: string): Promise<{ success: boolean; requiresApproval: boolean }> {
    if (!FollowSystemLogic.canUserFollow(followerId, targetId)) {
      throw new Error('Cannot follow this user');
    }

    try {
      // Check if target has a private profile
      const targetProfileRef = ref(database, `users/${targetId}`);
      const targetSnapshot = await get(targetProfileRef);
      
      if (!targetSnapshot.exists()) {
        throw new Error('User not found');
      }

      const targetProfile = targetSnapshot.val();
      
      if (FollowSystemLogic.requiresFollowRequest(targetProfile)) {
        // Create a follow request for private profiles
        await this.createFollowRequest(followerId, targetId);
        return { success: true, requiresApproval: true };
      }

      // Direct follow for public profiles
      await this.createFollowRelationship(followerId, targetId);
      return { success: true, requiresApproval: false };
      
    } catch (error: any) {
      throw new Error(`Failed to follow user: ${error.message}`);
    }
  }

  /**
   * Unfollow a user
   * @param followerId - ID of the user unfollowing
   * @param targetId - ID of the user being unfollowed
   */
  async unfollowUser(followerId: string, targetId: string): Promise<void> {
    try {
      const now = Date.now();
      
      // Remove from follower's following list
      await remove(ref(database, `userFollows/${followerId}/following/${targetId}`));
      
      // Remove from target's followers list
      await remove(ref(database, `userFollows/${targetId}/followers/${followerId}`));
      
      // Update counts
      await this.updateFollowCounts(followerId, targetId, false);
      
    } catch (error: any) {
      throw new Error(`Failed to unfollow user: ${error.message}`);
    }
  }

  /**
   * Create a follow relationship (for public profiles)
   */
  private async createFollowRelationship(followerId: string, targetId: string): Promise<void> {
    const now = Date.now();
    
    // Add to follower's following list
    await set(ref(database, `userFollows/${followerId}/following/${targetId}`), now);
    
    // Add to target's followers list
    await set(ref(database, `userFollows/${targetId}/followers/${followerId}`), now);
    
    // Update counts
    await this.updateFollowCounts(followerId, targetId, true);
  }

  /**
   * Create a follow request (for private profiles)
   */
  private async createFollowRequest(fromUserId: string, toUserId: string): Promise<void> {
    const requestRef = push(ref(database, `followRequests/${toUserId}`));
    const request: Omit<FollowRequest, 'id'> = {
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: Date.now()
    };
    await set(requestRef, request);
  }

  /**
   * Approve a follow request
   */
  async approveFollowRequest(requestId: string, toUserId: string): Promise<void> {
    try {
      const requestRef = ref(database, `followRequests/${toUserId}/${requestId}`);
      const snapshot = await get(requestRef);
      
      if (!snapshot.exists()) {
        throw new Error('Follow request not found');
      }

      const request = snapshot.val() as FollowRequest;
      
      // Create the follow relationship
      await this.createFollowRelationship(request.fromUserId, toUserId);
      
      // Update request status
      await update(requestRef, { status: 'approved', updatedAt: Date.now() });
      
      // Remove the request after a delay
      setTimeout(() => remove(requestRef), 1000);
      
    } catch (error: any) {
      throw new Error(`Failed to approve follow request: ${error.message}`);
    }
  }

  /**
   * Reject a follow request
   */
  async rejectFollowRequest(requestId: string, toUserId: string): Promise<void> {
    try {
      await remove(ref(database, `followRequests/${toUserId}/${requestId}`));
    } catch (error: any) {
      throw new Error(`Failed to reject follow request: ${error.message}`);
    }
  }

  /**
   * Update follow counts for both users
   */
  private async updateFollowCounts(followerId: string, targetId: string, isFollowing: boolean): Promise<void> {
    // Get current counts
    const followerProfileRef = ref(database, `users/${followerId}`);
    const targetProfileRef = ref(database, `users/${targetId}`);
    
    const [followerSnapshot, targetSnapshot] = await Promise.all([
      get(followerProfileRef),
      get(targetProfileRef)
    ]);

    const followerProfile = followerSnapshot.val() || {};
    const targetProfile = targetSnapshot.val() || {};

    const newFollowingCount = FollowSystemLogic.calculateFollowingCount(
      followerProfile.followingCount || 0,
      isFollowing
    );
    const newFollowerCount = FollowSystemLogic.calculateFollowerCount(
      targetProfile.followerCount || 0,
      isFollowing
    );

    // Update counts
    await Promise.all([
      update(followerProfileRef, { followingCount: newFollowingCount }),
      update(targetProfileRef, { followerCount: newFollowerCount })
    ]);
  }

  /**
   * Check if a user is following another user
   */
  async isFollowing(followerId: string, targetId: string): Promise<boolean> {
    try {
      const followRef = ref(database, `userFollows/${followerId}/following/${targetId}`);
      const snapshot = await get(followRef);
      return snapshot.exists();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get list of users that a user is following
   */
  async getFollowing(userId: string): Promise<string[]> {
    try {
      const followingRef = ref(database, `userFollows/${userId}/following`);
      const snapshot = await get(followingRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      return Object.keys(snapshot.val());
    } catch (error) {
      return [];
    }
  }

  /**
   * Get list of followers for a user
   */
  async getFollowers(userId: string): Promise<string[]> {
    try {
      const followersRef = ref(database, `userFollows/${userId}/followers`);
      const snapshot = await get(followersRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      return Object.keys(snapshot.val());
    } catch (error) {
      return [];
    }
  }

  /**
   * Listen to following list changes
   */
  listenToFollowing(userId: string, callback: (following: string[]) => void): () => void {
    const followingRef = ref(database, `userFollows/${userId}/following`);
    
    return onValue(followingRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      callback(Object.keys(snapshot.val()));
    });
  }

  /**
   * Listen to followers list changes
   */
  listenToFollowers(userId: string, callback: (followers: string[]) => void): () => void {
    const followersRef = ref(database, `userFollows/${userId}/followers`);
    
    return onValue(followersRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      callback(Object.keys(snapshot.val()));
    });
  }

  /**
   * Listen to follow requests
   */
  listenToFollowRequests(userId: string, callback: (requests: FollowRequest[]) => void): () => void {
    const requestsRef = ref(database, `followRequests/${userId}`);
    
    return onValue(requestsRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      
      const requests: FollowRequest[] = [];
      snapshot.forEach((child) => {
        const request = child.val();
        if (request.status === 'pending') {
          requests.push({ id: child.key!, ...request });
        }
      });
      
      // Sort by creation time (newest first)
      requests.sort((a, b) => b.createdAt - a.createdAt);
      callback(requests);
    });
  }

  /**
   * Update user's private profile setting
   */
  async setProfilePrivacy(userId: string, isPrivate: boolean): Promise<void> {
    try {
      await update(ref(database, `users/${userId}`), { isPrivate });
    } catch (error: any) {
      throw new Error(`Failed to update privacy setting: ${error.message}`);
    }
  }

  /**
   * Get user profile with follow statistics
   */
  async getUserProfileWithStats(userId: string): Promise<{
    profile: any;
    followerCount: number;
    followingCount: number;
    postCount: number;
  } | null> {
    try {
      const [profileSnapshot, followersSnapshot, followingSnapshot] = await Promise.all([
        get(ref(database, `users/${userId}`)),
        get(ref(database, `userFollows/${userId}/followers`)),
        get(ref(database, `userFollows/${userId}/following`))
      ]);

      if (!profileSnapshot.exists()) {
        return null;
      }

      const profile = profileSnapshot.val();
      const followerCount = followersSnapshot.exists() ? Object.keys(followersSnapshot.val()).length : 0;
      const followingCount = followingSnapshot.exists() ? Object.keys(followingSnapshot.val()).length : 0;

      return {
        profile,
        followerCount,
        followingCount,
        postCount: profile.postCount || 0
      };
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const followService = new FollowService();
