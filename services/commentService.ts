// CommentService for NexusPC Community Posts
// Handles comment CRUD operations, threading, mentions, and permissions
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
  endBefore,
  equalTo,
  onValue
} from 'firebase/database';
import { database } from '../firebase.config';
import { 
  Comment, 
  CreateCommentRequest,
  PostError,
  PostErrorType,
  ReactionType
} from '../types/community-posts';

// Constants for comment validation
export const MAX_COMMENT_LENGTH = 1000;
export const MAX_NESTING_DEPTH = 3;
export const EDIT_WINDOW_MINUTES = 15;
export const COMMENTS_PER_PAGE = 10;

/**
 * CommentService handles all comment-related operations
 * Requirements: 4.1, 4.2, 4.4, 4.6, 4.7, 4.8, 4.10
 */
export class CommentService {
  
  /**
   * Create a notification for comment interaction
   */
  private async createCommentNotification(
    recipientUserId: string,
    fromUserId: string,
    postId: string,
    commentId: string,
    type: 'comment' | 'reply'
  ): Promise<void> {
    try {
      // Don't notify yourself
      if (recipientUserId === fromUserId) return;
      
      const notificationRef = ref(database, `communityNotifications/${recipientUserId}`);
      const newNotifRef = push(notificationRef);
      
      const notification = {
        userId: recipientUserId,
        type: 'comment', // Use 'comment' for both comments and replies
        fromUserId,
        postId,
        commentId,
        createdAt: Date.now(),
        read: false,
        message: type === 'comment' 
          ? 'commented on your post'
          : 'replied to your comment'
      };
      
      await set(newNotifRef, notification);
    } catch (error) {
      // Don't fail the comment if notification fails
      console.error('Failed to create notification:', error);
    }
  }
  
  /**
   * Create a new comment on a post
   * @param commentData - The comment creation request data
   * @param authorId - The ID of the user creating the comment
   * @returns Promise<Comment> - The created comment with generated ID
   * Requirements: 4.1, 4.2, 4.3
   */
  async createComment(commentData: CreateCommentRequest, authorId: string): Promise<Comment> {
    try {
      // Validate content length (Requirement 4.2)
      if (!commentData.content || commentData.content.trim().length === 0) {
        throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Comment content cannot be empty');
      }
      
      if (commentData.content.length > MAX_COMMENT_LENGTH) {
        throw new PostError(
          PostErrorType.CONTENT_TOO_LONG, 
          `Comment content exceeds ${MAX_COMMENT_LENGTH} character limit`
        );
      }
      
      // Verify post exists
      const postRef = ref(database, `posts/${commentData.postId}`);
      const postSnapshot = await get(postRef);
      
      if (!postSnapshot.exists()) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Post not found');
      }

      
      // Validate nesting depth if this is a reply (Requirement 4.4)
      if (commentData.parentId) {
        const depth = await this.getCommentDepth(commentData.postId, commentData.parentId);
        if (depth >= MAX_NESTING_DEPTH) {
          throw new PostError(
            PostErrorType.PERMISSION_DENIED, 
            `Comments can only be nested up to ${MAX_NESTING_DEPTH} levels deep`
          );
        }
        
        // Verify parent comment exists
        const parentRef = ref(database, `comments/${commentData.postId}/${commentData.parentId}`);
        const parentSnapshot = await get(parentRef);
        
        if (!parentSnapshot.exists()) {
          throw new PostError(PostErrorType.PERMISSION_DENIED, 'Parent comment not found');
        }
      }
      
      // Extract mentions from content (Requirement 4.10)
      const mentions = commentData.mentions || this.extractMentions(commentData.content);
      
      // Create comment object (Requirement 4.3)
      const now = Date.now();
      const comment: Omit<Comment, 'id'> = {
        postId: commentData.postId,
        authorId,
        content: commentData.content.trim(),
        parentId: commentData.parentId || null,
        createdAt: now,
        mentions,
        likeCount: 0
      };
      
      // Save to Firebase
      const commentsRef = ref(database, `comments/${commentData.postId}`);
      const newCommentRef = push(commentsRef);
      await set(newCommentRef, comment);
      
      // Increment comment count on post
      const post = postSnapshot.val();
      const currentCommentCount = post.commentCount || 0;
      await update(postRef, { commentCount: currentCommentCount + 1 });
      
      const createdComment: Comment = {
        id: newCommentRef.key!,
        ...comment
      };
      
      // Send notification to post author or parent comment author
      if (commentData.parentId) {
        // This is a reply - notify the parent comment author
        const parentRef = ref(database, `comments/${commentData.postId}/${commentData.parentId}`);
        const parentSnapshot = await get(parentRef);
        if (parentSnapshot.exists()) {
          const parentComment = parentSnapshot.val();
          await this.createCommentNotification(
            parentComment.authorId,
            authorId,
            commentData.postId,
            createdComment.id,
            'reply'
          );
        }
      } else {
        // This is a top-level comment - notify the post author
        await this.createCommentNotification(
          post.authorId,
          authorId,
          commentData.postId,
          createdComment.id,
          'comment'
        );
      }
      
      return createdComment;
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to create comment: ${error.message}`, true);
    }
  }

  
  /**
   * Update an existing comment with permission checks
   * @param postId - The ID of the post containing the comment
   * @param commentId - The ID of the comment to update
   * @param content - The new content for the comment
   * @param userId - The ID of the user attempting the update
   * @returns Promise<void>
   * Requirement: 4.6
   */
  async updateComment(postId: string, commentId: string, content: string, userId: string): Promise<void> {
    try {
      const commentRef = ref(database, `comments/${postId}/${commentId}`);
      const snapshot = await get(commentRef);
      
      if (!snapshot.exists()) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Comment not found');
      }
      
      const existingComment = snapshot.val() as Comment;
      
      // Check if user is the author (Requirement 4.6)
      if (existingComment.authorId !== userId) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Only the comment author can edit this comment');
      }
      
      // Check if comment is within 15-minute edit window (Requirement 4.6)
      const editWindowMs = EDIT_WINDOW_MINUTES * 60 * 1000;
      const now = Date.now();
      if (now - existingComment.createdAt > editWindowMs) {
        throw new PostError(
          PostErrorType.PERMISSION_DENIED, 
          `Comments can only be edited within ${EDIT_WINDOW_MINUTES} minutes of posting`
        );
      }
      
      // Validate new content
      if (!content || content.trim().length === 0) {
        throw new PostError(PostErrorType.CONTENT_TOO_LONG, 'Comment content cannot be empty');
      }
      
      if (content.length > MAX_COMMENT_LENGTH) {
        throw new PostError(
          PostErrorType.CONTENT_TOO_LONG, 
          `Comment content exceeds ${MAX_COMMENT_LENGTH} character limit`
        );
      }
      
      // Extract new mentions
      const mentions = this.extractMentions(content);
      
      // Update the comment
      await update(commentRef, {
        content: content.trim(),
        editedAt: now,
        mentions
      });
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to update comment: ${error.message}`, true);
    }
  }

  
  /**
   * Delete a comment with permission checks
   * @param postId - The ID of the post containing the comment
   * @param commentId - The ID of the comment to delete
   * @param userId - The ID of the user attempting the deletion
   * @returns Promise<void>
   * Requirements: 4.7, 4.8
   */
  async deleteComment(postId: string, commentId: string, userId: string): Promise<void> {
    try {
      const commentRef = ref(database, `comments/${postId}/${commentId}`);
      const snapshot = await get(commentRef);
      
      if (!snapshot.exists()) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Comment not found');
      }
      
      const existingComment = snapshot.val() as Comment;
      
      // Check if user is the author (Requirement 4.7)
      if (existingComment.authorId !== userId) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Only the comment author can delete this comment');
      }
      
      // Check if comment has replies (Requirement 4.8)
      const hasReplies = await this.commentHasReplies(postId, commentId);
      
      if (hasReplies) {
        // Mark as deleted but keep placeholder (Requirement 4.8)
        await update(commentRef, {
          content: '[Comment deleted]',
          isDeleted: true,
          deletedAt: Date.now()
        });
      } else {
        // No replies - safe to fully delete
        await remove(commentRef);
        
        // Decrement comment count on post
        const postRef = ref(database, `posts/${postId}`);
        const postSnapshot = await get(postRef);
        
        if (postSnapshot.exists()) {
          const post = postSnapshot.val();
          const currentCommentCount = post.commentCount || 0;
          const newCommentCount = Math.max(0, currentCommentCount - 1);
          await update(postRef, { commentCount: newCommentCount });
        }
      }
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to delete comment: ${error.message}`, true);
    }
  }

  
  /**
   * Get a single comment by ID
   * @param postId - The ID of the post containing the comment
   * @param commentId - The ID of the comment to retrieve
   * @returns Promise<Comment | null>
   */
  async getComment(postId: string, commentId: string): Promise<Comment | null> {
    try {
      const commentRef = ref(database, `comments/${postId}/${commentId}`);
      const snapshot = await get(commentRef);
      
      if (!snapshot.exists()) {
        return null;
      }
      
      return {
        id: snapshot.key!,
        ...snapshot.val()
      };
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get comment: ${error.message}`, true);
    }
  }
  
  /**
   * Get comments for a post with pagination
   * @param postId - The ID of the post
   * @param limit - Maximum number of comments to retrieve
   * @param startAfterTimestamp - Timestamp to start after for pagination
   * @returns Promise<Comment[]>
   * Requirement: 4.9
   */
  async getPostComments(
    postId: string, 
    limit: number = COMMENTS_PER_PAGE, 
    startAfterTimestamp?: number
  ): Promise<Comment[]> {
    try {
      const commentsRef = ref(database, `comments/${postId}`);
      let commentsQuery;
      
      if (startAfterTimestamp) {
        commentsQuery = query(
          commentsRef,
          orderByChild('createdAt'),
          endBefore(startAfterTimestamp),
          limitToLast(limit)
        );
      } else {
        commentsQuery = query(
          commentsRef,
          orderByChild('createdAt'),
          limitToLast(limit)
        );
      }
      
      const snapshot = await get(commentsQuery);
      const comments: Comment[] = [];
      
      snapshot.forEach((childSnapshot) => {
        comments.push({
          id: childSnapshot.key!,
          ...childSnapshot.val()
        });
      });
      
      // Sort by creation time (oldest first for comments)
      comments.sort((a, b) => a.createdAt - b.createdAt);
      
      return comments;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get post comments: ${error.message}`, true);
    }
  }

  
  /**
   * Get replies to a specific comment
   * @param postId - The ID of the post
   * @param parentId - The ID of the parent comment
   * @returns Promise<Comment[]>
   * Requirement: 4.4, 4.5
   */
  async getCommentReplies(postId: string, parentId: string): Promise<Comment[]> {
    try {
      const commentsRef = ref(database, `comments/${postId}`);
      const snapshot = await get(commentsRef);
      const replies: Comment[] = [];
      
      snapshot.forEach((childSnapshot) => {
        const comment = childSnapshot.val();
        if (comment.parentId === parentId) {
          replies.push({
            id: childSnapshot.key!,
            ...comment
          });
        }
      });
      
      // Sort by creation time (oldest first)
      replies.sort((a, b) => a.createdAt - b.createdAt);
      
      return replies;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get comment replies: ${error.message}`, true);
    }
  }
  
  /**
   * Get threaded comments for a post (organized by parent-child relationships)
   * @param postId - The ID of the post
   * @param limit - Maximum number of top-level comments
   * @returns Promise<CommentThread[]>
   * Requirements: 4.4, 4.5
   */
  async getThreadedComments(postId: string, limit: number = COMMENTS_PER_PAGE): Promise<CommentThread[]> {
    try {
      // Get all comments for the post
      const commentsRef = ref(database, `comments/${postId}`);
      const snapshot = await get(commentsRef);
      
      const allComments: Comment[] = [];
      snapshot.forEach((childSnapshot) => {
        allComments.push({
          id: childSnapshot.key!,
          ...childSnapshot.val()
        });
      });
      
      // Build threaded structure
      return this.buildCommentThreads(allComments, limit);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get threaded comments: ${error.message}`, true);
    }
  }

  
  /**
   * Listen to real-time comment updates for a post
   * @param postId - The ID of the post
   * @param callback - Function to call when comments update
   * @returns Function to unsubscribe from updates
   */
  listenToPostComments(postId: string, callback: (comments: Comment[]) => void): () => void {
    const commentsRef = ref(database, `comments/${postId}`);
    
    return onValue(commentsRef, (snapshot) => {
      const comments: Comment[] = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          comments.push({
            id: childSnapshot.key!,
            ...childSnapshot.val()
          });
        });
      }
      
      // Sort by creation time (oldest first)
      comments.sort((a, b) => a.createdAt - b.createdAt);
      
      callback(comments);
    });
  }
  
  /**
   * Get the nesting depth of a comment
   * @param postId - The ID of the post
   * @param commentId - The ID of the comment
   * @returns Promise<number> - The depth level (0 for top-level)
   */
  async getCommentDepth(postId: string, commentId: string): Promise<number> {
    try {
      let depth = 0;
      let currentId = commentId;
      
      while (currentId && depth < MAX_NESTING_DEPTH + 1) {
        const commentRef = ref(database, `comments/${postId}/${currentId}`);
        const snapshot = await get(commentRef);
        
        if (!snapshot.exists()) {
          break;
        }
        
        const comment = snapshot.val();
        if (!comment.parentId) {
          break;
        }
        
        depth++;
        currentId = comment.parentId;
      }
      
      return depth;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get comment depth: ${error.message}`, true);
    }
  }

  
  /**
   * Check if a comment has any replies
   * @param postId - The ID of the post
   * @param commentId - The ID of the comment
   * @returns Promise<boolean>
   */
  async commentHasReplies(postId: string, commentId: string): Promise<boolean> {
    try {
      const commentsRef = ref(database, `comments/${postId}`);
      const snapshot = await get(commentsRef);
      
      if (!snapshot.exists()) {
        return false;
      }
      
      let hasReplies = false;
      snapshot.forEach((childSnapshot) => {
        const comment = childSnapshot.val();
        if (comment.parentId === commentId) {
          hasReplies = true;
        }
      });
      
      return hasReplies;
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to check comment replies: ${error.message}`, true);
    }
  }
  
  /**
   * Add or update a reaction to a comment
   * @param commentId - The ID of the comment
   * @param postId - The ID of the post containing the comment
   * @param userId - The ID of the user reacting
   * @param reactionType - The type of reaction
   * @returns Promise<void>
   */
  async addCommentReaction(commentId: string, postId: string, userId: string, reactionType: ReactionType): Promise<void> {
    try {
      const commentRef = ref(database, `comments/${postId}/${commentId}`);
      const commentSnapshot = await get(commentRef);
      
      if (!commentSnapshot.exists()) {
        throw new PostError(PostErrorType.PERMISSION_DENIED, 'Comment not found');
      }
      
      // Check if user already has a reaction on this comment
      const userReactionRef = ref(database, `commentReactions/${commentId}/${userId}`);
      const existingReactionSnapshot = await get(userReactionRef);
      
      const comment = commentSnapshot.val();
      const currentReactionCounts = comment.reactionCounts || {};
      
      // Remove old reaction if exists
      if (existingReactionSnapshot.exists()) {
        const oldReaction = existingReactionSnapshot.val();
        const oldCount = currentReactionCounts[oldReaction.type] || 0;
        currentReactionCounts[oldReaction.type] = Math.max(0, oldCount - 1);
      }
      
      // Add new reaction
      const newReaction = {
        userId,
        commentId,
        postId,
        type: reactionType,
        createdAt: Date.now()
      };
      
      await set(userReactionRef, newReaction);
      
      // Update reaction count
      const newCount = (currentReactionCounts[reactionType] || 0) + 1;
      currentReactionCounts[reactionType] = newCount;
      
      // Update comment with new reaction counts
      await update(commentRef, { reactionCounts: currentReactionCounts });
      
    } catch (error: any) {
      if (error instanceof PostError) {
        throw error;
      }
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to add comment reaction: ${error.message}`, true);
    }
  }

  /**
   * Remove a reaction from a comment
   * @param commentId - The ID of the comment
   * @param postId - The ID of the post containing the comment
   * @param userId - The ID of the user removing reaction
   * @returns Promise<void>
   */
  async removeCommentReaction(commentId: string, postId: string, userId: string): Promise<void> {
    try {
      const userReactionRef = ref(database, `commentReactions/${commentId}/${userId}`);
      const reactionSnapshot = await get(userReactionRef);
      
      if (!reactionSnapshot.exists()) {
        return; // No reaction to remove
      }
      
      const reaction = reactionSnapshot.val();
      const commentRef = ref(database, `comments/${postId}/${commentId}`);
      const commentSnapshot = await get(commentRef);
      
      if (commentSnapshot.exists()) {
        const comment = commentSnapshot.val();
        const currentReactionCounts = comment.reactionCounts || {};
        const currentCount = currentReactionCounts[reaction.type] || 0;
        currentReactionCounts[reaction.type] = Math.max(0, currentCount - 1);
        
        await update(commentRef, { reactionCounts: currentReactionCounts });
      }
      
      await remove(userReactionRef);
      
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to remove comment reaction: ${error.message}`, true);
    }
  }

  /**
   * Get user's reaction to a comment
   * @param commentId - The ID of the comment
   * @param userId - The ID of the user
   * @returns Promise<ReactionType | null>
   */
  async getUserCommentReaction(commentId: string, userId: string): Promise<ReactionType | null> {
    try {
      const userReactionRef = ref(database, `commentReactions/${commentId}/${userId}`);
      const snapshot = await get(userReactionRef);
      
      if (snapshot.exists()) {
        return snapshot.val().type;
      }
      
      return null;
    } catch (error: any) {
      throw new PostError(PostErrorType.NETWORK_ERROR, `Failed to get user comment reaction: ${error.message}`, true);
    }
  }

  /**
   * Extract @mentions from comment content
   * @param content - The comment content
   * @returns string[] - Array of mentioned user IDs/usernames
   * Requirement: 4.10
   */
  extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const mention = match[1];
      if (!mentions.includes(mention)) {
        mentions.push(mention);
      }
    }
    
    return mentions;
  }

  /**
   * Build threaded comment structure from flat list
   * @param comments - Flat array of comments
   * @param limit - Maximum number of top-level comments
   * @returns CommentThread[] - Threaded comment structure
   */
  private buildCommentThreads(comments: Comment[], limit: number): CommentThread[] {
    // Separate top-level comments and replies
    const topLevel = comments.filter(c => !c.parentId);
    const replies = comments.filter(c => c.parentId);
    
    // Sort top-level by creation time (oldest first)
    topLevel.sort((a, b) => a.createdAt - b.createdAt);
    
    // Build map of replies by parent ID
    const replyMap = new Map<string, Comment[]>();
    for (const reply of replies) {
      if (reply.parentId) {
        const existing = replyMap.get(reply.parentId) || [];
        existing.push(reply);
        replyMap.set(reply.parentId, existing);
      }
    }
    
    // Sort replies by creation time
    for (const [, replyList] of replyMap) {
      replyList.sort((a, b) => a.createdAt - b.createdAt);
    }
    
    // Build threaded structure recursively
    const buildThread = (comment: Comment, depth: number): CommentThread => {
      const childReplies = replyMap.get(comment.id) || [];
      return {
        comment,
        depth,
        replies: depth < MAX_NESTING_DEPTH 
          ? childReplies.map(r => buildThread(r, depth + 1))
          : []
      };
    };
    
    // Take only the requested number of top-level comments
    const limitedTopLevel = topLevel.slice(0, limit);
    
    return limitedTopLevel.map(c => buildThread(c, 0));
  }
}

// Export a singleton instance
export const commentService = new CommentService();

// Interface for threaded comments
export interface CommentThread {
  comment: Comment;
  depth: number;
  replies: CommentThread[];
}


// Export pure functions for testing (without Firebase dependency)
export const CommentValidationLogic = {
  /**
   * Validate comment content length
   * @param content - The comment content
   * @returns { valid: boolean, error?: string }
   */
  validateContent(content: string): { valid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'Comment content cannot be empty' };
    }
    
    if (content.length > MAX_COMMENT_LENGTH) {
      return { valid: false, error: `Comment content exceeds ${MAX_COMMENT_LENGTH} character limit` };
    }
    
    return { valid: true };
  },
  
  /**
   * Check if a comment can be edited based on time window
   * @param createdAt - The comment creation timestamp
   * @param currentTime - The current timestamp
   * @returns boolean
   */
  canEditComment(createdAt: number, currentTime: number): boolean {
    const editWindowMs = EDIT_WINDOW_MINUTES * 60 * 1000;
    return (currentTime - createdAt) <= editWindowMs;
  },
  
  /**
   * Check if user is the comment author
   * @param commentAuthorId - The author of the comment
   * @param userId - The user attempting the action
   * @returns boolean
   */
  isCommentAuthor(commentAuthorId: string, userId: string): boolean {
    return commentAuthorId === userId;
  },
  
  /**
   * Check if nesting depth is within limits
   * @param depth - Current depth level
   * @returns boolean
   */
  isValidNestingDepth(depth: number): boolean {
    return depth < MAX_NESTING_DEPTH;
  },
  
  /**
   * Extract @mentions from content
   * @param content - The comment content
   * @returns string[] - Array of mentioned usernames
   */
  extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const mention = match[1];
      if (!mentions.includes(mention)) {
        mentions.push(mention);
      }
    }
    
    return mentions;
  },
  
  /**
   * Calculate time remaining for edit window
   * @param createdAt - The comment creation timestamp
   * @param currentTime - The current timestamp
   * @returns number - Milliseconds remaining, or 0 if expired
   */
  getEditTimeRemaining(createdAt: number, currentTime: number): number {
    const editWindowMs = EDIT_WINDOW_MINUTES * 60 * 1000;
    const elapsed = currentTime - createdAt;
    return Math.max(0, editWindowMs - elapsed);
  }
};

export const CommentThreadingLogic = {
  /**
   * Calculate the depth of a comment in a thread
   * @param commentId - The comment ID
   * @param parentMap - Map of comment ID to parent ID
   * @returns number - The depth level (0 for top-level)
   */
  calculateDepth(commentId: string, parentMap: Map<string, string | undefined>): number {
    let depth = 0;
    let currentId: string | undefined = commentId;
    
    while (currentId && depth < MAX_NESTING_DEPTH + 1) {
      const parentId = parentMap.get(currentId);
      if (!parentId) {
        break;
      }
      depth++;
      currentId = parentId;
    }
    
    return depth;
  },
  
  /**
   * Check if a comment can have replies based on its depth
   * @param depth - Current depth of the comment
   * @returns boolean
   */
  canHaveReplies(depth: number): boolean {
    return depth < MAX_NESTING_DEPTH;
  },
  
  /**
   * Build a parent map from a list of comments
   * @param comments - Array of comments
   * @returns Map<string, string | undefined> - Map of comment ID to parent ID
   */
  buildParentMap(comments: Array<{ id: string; parentId?: string }>): Map<string, string | undefined> {
    const map = new Map<string, string | undefined>();
    for (const comment of comments) {
      map.set(comment.id, comment.parentId);
    }
    return map;
  },
  
  /**
   * Get all descendant comment IDs for a given comment
   * @param commentId - The parent comment ID
   * @param comments - Array of all comments
   * @returns string[] - Array of descendant comment IDs
   */
  getDescendantIds(commentId: string, comments: Array<{ id: string; parentId?: string }>): string[] {
    const descendants: string[] = [];
    const queue = [commentId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const comment of comments) {
        if (comment.parentId === currentId) {
          descendants.push(comment.id);
          queue.push(comment.id);
        }
      }
    }
    
    return descendants;
  },
  
  /**
   * Organize comments into a flat list with depth information
   * @param comments - Array of comments
   * @returns Array<{ comment: Comment, depth: number }>
   */
  flattenWithDepth(comments: Array<{ id: string; parentId?: string; createdAt: number }>): Array<{ id: string; depth: number }> {
    const parentMap = this.buildParentMap(comments);
    const result: Array<{ id: string; depth: number }> = [];
    
    // Get top-level comments first
    const topLevel = comments.filter(c => !c.parentId);
    topLevel.sort((a, b) => a.createdAt - b.createdAt);
    
    const addWithReplies = (comment: { id: string; parentId?: string; createdAt: number }, depth: number) => {
      result.push({ id: comment.id, depth });
      
      // Get direct replies
      const replies = comments.filter(c => c.parentId === comment.id);
      replies.sort((a, b) => a.createdAt - b.createdAt);
      
      for (const reply of replies) {
        addWithReplies(reply, depth + 1);
      }
    };
    
    for (const comment of topLevel) {
      addWithReplies(comment, 0);
    }
    
    return result;
  }
};

export const CommentPaginationLogic = {
  /**
   * Calculate pagination info for comments
   * @param totalComments - Total number of comments
   * @param currentPage - Current page number (1-indexed)
   * @param pageSize - Number of comments per page
   * @returns { hasMore: boolean, totalPages: number, startIndex: number, endIndex: number }
   */
  getPaginationInfo(
    totalComments: number, 
    currentPage: number, 
    pageSize: number = COMMENTS_PER_PAGE
  ): { hasMore: boolean; totalPages: number; startIndex: number; endIndex: number } {
    const totalPages = Math.ceil(totalComments / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalComments);
    const hasMore = currentPage < totalPages;
    
    return { hasMore, totalPages, startIndex, endIndex };
  },
  
  /**
   * Get the timestamp to use for "load more" pagination
   * @param comments - Current array of comments
   * @returns number | undefined - The oldest timestamp, or undefined if empty
   */
  getOldestTimestamp(comments: Array<{ createdAt: number }>): number | undefined {
    if (comments.length === 0) {
      return undefined;
    }
    
    return Math.min(...comments.map(c => c.createdAt));
  },
  
  /**
   * Check if there are more comments to load
   * @param loadedCount - Number of comments currently loaded
   * @param totalCount - Total number of comments on the post
   * @returns boolean
   */
  hasMoreComments(loadedCount: number, totalCount: number): boolean {
    return loadedCount < totalCount;
  }
};
