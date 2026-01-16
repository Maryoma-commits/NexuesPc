// Community Posts Data Models
// Based on design document specifications

export interface PostEditHistory {
  content: string;
  images: string[];
  editedAt: number;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  images: string[]; // ImgBB URLs
  taggedProducts: ProductReference[];
  privacy: PostPrivacy;
  createdAt: number;
  editedAt?: number;
  editHistory?: PostEditHistory[]; // Array of previous versions
  likeCount: number;
  commentCount: number;
  reactionCounts: Partial<Record<ReactionType, number>>;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentId?: string; // for nested replies
  createdAt: number;
  editedAt?: number;
  mentions: string[]; // mentioned user IDs
  likeCount: number;
  reactionCounts: Partial<Record<ReactionType, number>>;
}

export interface ProductReference {
  productId: string;
  title: string;
  imageUrl: string;
  price: number;
  retailer: string;
  category: string;
}

export interface Like {
  userId: string;
  postId?: string;
  commentId?: string;
  createdAt: number;
}

export interface Reaction {
  userId: string;
  postId?: string;
  commentId?: string;
  type: ReactionType;
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  fromUserId: string;
  postId?: string;
  commentId?: string;
  createdAt: number;
  read: boolean;
  message: string;
}

// Type definitions
export type PostPrivacy = 'public' | 'friends' | 'private';
export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
export type NotificationType = 'like' | 'comment' | 'mention' | 'follow' | 'reaction';

// Request/Response interfaces
export interface CreatePostRequest {
  content: string;
  images: File[];
  imageUrls?: string[]; // Pre-uploaded image URLs (alternative to images)
  taggedProducts: ProductReference[];
  privacy: PostPrivacy;
}

export interface CreateCommentRequest {
  postId: string;
  content: string;
  parentId?: string;
  mentions: string[];
}

export interface FeedQuery {
  userId: string;
  feedType: 'following' | 'discover' | 'user';
  limit: number;
  startAfter?: string; // for pagination
  filters?: FeedFilters;
}

export interface FeedFilters {
  postType?: 'all' | 'product' | 'media';
  timeRange?: 'day' | 'week' | 'month' | 'all';
  sortBy?: 'recent' | 'popular' | 'trending';
}

export interface SearchFilters {
  postType?: 'all' | 'product' | 'media';
  dateRange?: {
    start: number;
    end: number;
  };
  userId?: string;
}

// Error handling
export enum PostErrorType {
  CONTENT_TOO_LONG = 'CONTENT_TOO_LONG',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  TOO_MANY_IMAGES = 'TOO_MANY_IMAGES',
  INVALID_PRODUCT_TAG = 'INVALID_PRODUCT_TAG',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMITED = 'RATE_LIMITED'
}

export class PostError extends Error {
  constructor(
    public type: PostErrorType,
    public message: string,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

// Offline support
export interface OfflinePostQueue {
  pendingPosts: PendingPost[];
  pendingComments: PendingComment[];
  pendingLikes: PendingLike[];
}

export interface PendingPost {
  id: string;
  content: string;
  images: File[];
  taggedProducts: ProductReference[];
  privacy: PostPrivacy;
  createdAt: number;
  retryCount: number;
}

export interface PendingComment {
  id: string;
  postId: string;
  content: string;
  parentId?: string;
  mentions: string[];
  createdAt: number;
  retryCount: number;
}

export interface PendingLike {
  id: string;
  postId?: string;
  commentId?: string;
  createdAt: number;
  retryCount: number;
}

// User following system
export interface UserFollow {
  followerId: string;
  followedId: string;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: number;
  lastOnline: number;
}

// Feed and discovery
export interface TrendingTopic {
  hashtag: string;
  postCount: number;
  lastUsed: number;
}

export interface SavedSearch {
  id: string;
  userId: string;
  query: string;
  filters: SearchFilters;
  createdAt: number;
  notificationsEnabled: boolean;
}

export interface SearchAnalytics {
  id: string;
  query: string;
  resultCount: number;
  userId?: string;
  timestamp: number;
}

// Content moderation
export interface ContentReport {
  id: string;
  reporterId: string;
  postId?: string;
  commentId?: string;
  reason: string;
  description?: string;
  createdAt: number;
  status: 'pending' | 'reviewed' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface ModerationAction {
  id: string;
  moderatorId: string;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  action: 'hide' | 'delete' | 'ban' | 'warn';
  reason: string;
  createdAt: number;
}

export interface UserBlock {
  blockerId: string;
  blockedId: string;
  blockedAt: number;
}

export interface AutoFlagResult {
  shouldFlag: boolean;
  reason?: string;
  confidence: number;
}