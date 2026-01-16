// Post Display Utility Functions
// Pure functions for post display logic (no Firebase/React dependencies)
import { Post, ReactionType } from '../types/community-posts';

/**
 * Format timestamp to relative time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: days > 365 ? 'numeric' : undefined
  });
}

/**
 * Check if post has all required display fields
 * @param post - Post object to validate
 * @returns Object with validation results
 */
export function validatePostDisplayFields(post: Post): {
  hasAuthorId: boolean;
  hasTimestamp: boolean;
  hasContent: boolean;
  hasEngagementMetrics: boolean;
  isComplete: boolean;
} {
  const hasAuthorId = Boolean(post.authorId && post.authorId.length > 0);
  const hasTimestamp = Boolean(post.createdAt && post.createdAt > 0);
  const hasContent = Boolean(post.content !== undefined);
  const hasEngagementMetrics = post.likeCount !== undefined && post.commentCount !== undefined;
  
  return {
    hasAuthorId,
    hasTimestamp,
    hasContent,
    hasEngagementMetrics,
    isComplete: hasAuthorId && hasTimestamp && hasContent && hasEngagementMetrics
  };
}

/**
 * Calculate image grid layout based on image count
 * @param imageCount - Number of images
 * @returns Grid layout configuration
 */
export function calculateImageGridLayout(imageCount: number): {
  columns: number;
  rows: number;
  displayCount: number;
  hasOverflow: boolean;
  overflowCount: number;
} {
  if (imageCount === 0) {
    return { columns: 0, rows: 0, displayCount: 0, hasOverflow: false, overflowCount: 0 };
  }
  if (imageCount === 1) {
    return { columns: 1, rows: 1, displayCount: 1, hasOverflow: false, overflowCount: 0 };
  }
  if (imageCount === 2) {
    return { columns: 2, rows: 1, displayCount: 2, hasOverflow: false, overflowCount: 0 };
  }
  if (imageCount === 3) {
    return { columns: 2, rows: 2, displayCount: 3, hasOverflow: false, overflowCount: 0 };
  }
  if (imageCount === 4) {
    return { columns: 2, rows: 2, displayCount: 4, hasOverflow: false, overflowCount: 0 };
  }
  // More than 4 images
  return { 
    columns: 2, 
    rows: 2, 
    displayCount: 4, 
    hasOverflow: true, 
    overflowCount: imageCount - 4 
  };
}

/**
 * Get top reactions from reaction counts
 * @param reactionCounts - Map of reaction types to counts
 * @param limit - Maximum number of reactions to return
 * @returns Array of top reaction types
 */
export function getTopReactions(
  reactionCounts: Partial<Record<ReactionType, number>>,
  limit: number = 3
): ReactionType[] {
  return Object.entries(reactionCounts)
    .filter(([_, count]) => count && count > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, limit)
    .map(([type]) => type as ReactionType);
}

/**
 * Calculate total engagement (likes + reactions)
 * @param likeCount - Number of likes
 * @param reactionCounts - Map of reaction types to counts
 * @returns Total engagement count
 */
export function calculateTotalEngagement(
  likeCount: number,
  reactionCounts: Partial<Record<ReactionType, number>>
): number {
  const totalReactions = Object.values(reactionCounts)
    .reduce((sum, count) => sum + (count || 0), 0);
  return likeCount + totalReactions;
}

/**
 * Check if images should display in responsive grid
 * @param images - Array of image URLs
 * @returns Whether grid layout should be used
 */
export function shouldUseGridLayout(images: string[]): boolean {
  return images.length > 1;
}

/**
 * Validate image URLs are present and valid
 * @param images - Array of image URLs
 * @returns Validation result
 */
export function validateImages(images: string[]): {
  allValid: boolean;
  validCount: number;
  invalidCount: number;
} {
  const validImages = images.filter(url => url && url.length > 0 && url.startsWith('http'));
  return {
    allValid: validImages.length === images.length,
    validCount: validImages.length,
    invalidCount: images.length - validImages.length
  };
}

// Export all functions as a namespace for backward compatibility
export const PostDisplayLogic = {
  formatTimestamp,
  validatePostDisplayFields,
  calculateImageGridLayout,
  getTopReactions,
  calculateTotalEngagement,
  shouldUseGridLayout,
  validateImages
};
