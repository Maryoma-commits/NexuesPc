// Privacy utility functions for NexusPC Community Posts
// Requirement 1.6: Privacy controls and post visibility

import { Post, PostPrivacy } from '../types/community-posts';

/**
 * Privacy boundary testing utilities
 */
export const PrivacyUtils = {
  /**
   * Test privacy boundary conditions for a post
   * @param post - The post to test
   * @param viewerId - The ID of the user viewing the post
   * @param isFollowing - Whether the viewer is following the author
   * @param isApproved - Whether the follow request is approved (for private profiles)
   * @returns Privacy test results
   */
  testPrivacyBoundaries(
    post: Post, 
    viewerId?: string, 
    isFollowing: boolean = false, 
    isApproved: boolean = true
  ): {
    canView: boolean;
    reason: string;
    privacyLevel: 'public' | 'restricted' | 'private';
    requiresAuth: boolean;
    requiresFollowing: boolean;
  } {
    const result = {
      canView: false,
      reason: '',
      privacyLevel: 'private' as const,
      requiresAuth: false,
      requiresFollowing: false
    };

    // Test public posts
    if (post.privacy === 'public') {
      result.canView = true;
      result.reason = 'Public post - visible to everyone';
      result.privacyLevel = 'public';
      result.requiresAuth = false;
      result.requiresFollowing = false;
      return result;
    }

    // Test private posts
    if (post.privacy === 'private') {
      result.requiresAuth = true;
      result.requiresFollowing = false;
      
      if (viewerId === post.authorId) {
        result.canView = true;
        result.reason = 'Private post - author can view own posts';
      } else {
        result.canView = false;
        result.reason = 'Private post - only author can view';
      }
      return result;
    }

    // Test friends-only posts
    if (post.privacy === 'friends') {
      result.privacyLevel = 'restricted';
      result.requiresAuth = true;
      result.requiresFollowing = true;

      if (!viewerId) {
        result.canView = false;
        result.reason = 'Friends-only post - authentication required';
        return result;
      }

      if (viewerId === post.authorId) {
        result.canView = true;
        result.reason = 'Friends-only post - author can view own posts';
        return result;
      }

      if (isFollowing && isApproved) {
        result.canView = true;
        result.reason = 'Friends-only post - viewer is approved follower';
      } else if (isFollowing && !isApproved) {
        result.canView = false;
        result.reason = 'Friends-only post - follow request pending approval';
      } else {
        result.canView = false;
        result.reason = 'Friends-only post - viewer is not following author';
      }
      return result;
    }

    // Default case
    result.canView = false;
    result.reason = 'Unknown privacy setting';
    return result;
  },

  /**
   * Get privacy level description for UI display
   * @param privacy - The privacy setting
   * @returns Human-readable description
   */
  getPrivacyDescription(privacy: PostPrivacy): string {
    switch (privacy) {
      case 'public':
        return 'Anyone can see this post';
      case 'friends':
        return 'Only people you follow can see this post';
      case 'private':
        return 'Only you can see this post';
      default:
        return 'Unknown privacy setting';
    }
  },

  /**
   * Get privacy icon for UI display
   * @param privacy - The privacy setting
   * @returns Icon name or component
   */
  getPrivacyIcon(privacy: PostPrivacy): string {
    switch (privacy) {
      case 'public':
        return 'globe';
      case 'friends':
        return 'users';
      case 'private':
        return 'lock';
      default:
        return 'help-circle';
    }
  },

  /**
   * Validate privacy setting
   * @param privacy - The privacy setting to validate
   * @returns Whether the privacy setting is valid
   */
  isValidPrivacy(privacy: string): privacy is PostPrivacy {
    return ['public', 'friends', 'private'].includes(privacy);
  },

  /**
   * Get recommended privacy setting based on user context
   * @param isNewUser - Whether the user is new to the platform
   * @param hasFollowers - Whether the user has followers
   * @param isPublicProfile - Whether the user has a public profile
   * @returns Recommended privacy setting
   */
  getRecommendedPrivacy(
    isNewUser: boolean = false,
    hasFollowers: boolean = false,
    isPublicProfile: boolean = true
  ): PostPrivacy {
    // New users might want to start with friends-only
    if (isNewUser && !hasFollowers) {
      return 'public'; // Start public to gain followers
    }

    // Users with private profiles might prefer friends-only by default
    if (!isPublicProfile) {
      return 'friends';
    }

    // Default to public for established users
    return 'public';
  },

  /**
   * Filter posts based on privacy and viewer permissions
   * @param posts - Array of posts to filter
   * @param viewerId - ID of the user viewing the posts
   * @param followingSet - Set of user IDs that the viewer is following
   * @returns Filtered posts that the viewer can see
   */
  filterPostsByPrivacy(
    posts: Post[],
    viewerId?: string,
    followingSet: Set<string> = new Set()
  ): Post[] {
    return posts.filter(post => {
      const isFollowing = followingSet.has(post.authorId);
      const result = this.testPrivacyBoundaries(post, viewerId, isFollowing);
      return result.canView;
    });
  },

  /**
   * Count posts by privacy level
   * @param posts - Array of posts to analyze
   * @returns Count of posts by privacy level
   */
  countPostsByPrivacy(posts: Post[]): Record<PostPrivacy, number> {
    return posts.reduce((counts, post) => {
      counts[post.privacy] = (counts[post.privacy] || 0) + 1;
      return counts;
    }, {} as Record<PostPrivacy, number>);
  },

  /**
   * Check if privacy change is allowed
   * @param post - The post to check
   * @param newPrivacy - The new privacy setting
   * @param userId - The user attempting the change
   * @returns Whether the privacy change is allowed
   */
  canChangePrivacy(post: Post, newPrivacy: PostPrivacy, userId: string): {
    allowed: boolean;
    reason: string;
  } {
    // Only the author can change privacy
    if (post.authorId !== userId) {
      return {
        allowed: false,
        reason: 'Only the post author can change privacy settings'
      };
    }

    // Check if post is within edit window (24 hours)
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now - post.createdAt > twentyFourHours) {
      return {
        allowed: false,
        reason: 'Privacy can only be changed within 24 hours of posting'
      };
    }

    // Validate new privacy setting
    if (!this.isValidPrivacy(newPrivacy)) {
      return {
        allowed: false,
        reason: 'Invalid privacy setting'
      };
    }

    return {
      allowed: true,
      reason: 'Privacy change allowed'
    };
  }
};

/**
 * Privacy enforcement middleware for API calls
 */
export const PrivacyMiddleware = {
  /**
   * Enforce privacy on a single post
   * @param post - The post to check
   * @param viewerId - The user viewing the post
   * @param followingSet - Set of users the viewer is following
   * @returns The post if viewable, null otherwise
   */
  enforcePostPrivacy(
    post: Post,
    viewerId?: string,
    followingSet: Set<string> = new Set()
  ): Post | null {
    const isFollowing = followingSet.has(post.authorId);
    const result = PrivacyUtils.testPrivacyBoundaries(post, viewerId, isFollowing);
    return result.canView ? post : null;
  },

  /**
   * Enforce privacy on an array of posts
   * @param posts - The posts to filter
   * @param viewerId - The user viewing the posts
   * @param followingSet - Set of users the viewer is following
   * @returns Filtered array of viewable posts
   */
  enforcePostsPrivacy(
    posts: Post[],
    viewerId?: string,
    followingSet: Set<string> = new Set()
  ): Post[] {
    return posts
      .map(post => this.enforcePostPrivacy(post, viewerId, followingSet))
      .filter((post): post is Post => post !== null);
  }
};