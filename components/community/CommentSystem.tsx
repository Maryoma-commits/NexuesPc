// CommentSystem Component for NexusPC Community Posts
// Facebook-style threaded comments with connecting lines
import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Loader2,
  Flag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  commentService, 
  CommentThread,
  COMMENTS_PER_PAGE,
  MAX_COMMENT_LENGTH,
  MAX_NESTING_DEPTH,
  CommentValidationLogic
} from '../../services/commentService';
import { Comment, PostError, ReactionType } from '../../types/community-posts';

// Static PNG paths for reactions (used in most places)
const REACTION_STATIC: Record<ReactionType, string> = {
  like: '/assets/reactions/static/like.png',
  love: '/assets/reactions/static/love.png',
  haha: '/assets/reactions/static/haha.png',
  wow: '/assets/reactions/static/wow.png',
  sad: '/assets/reactions/static/sad.png',
  angry: '/assets/reactions/static/angry.png'
};

// Animated GIF paths for reaction picker popup
const REACTION_GIFS: Record<ReactionType, string> = {
  like: '/assets/reactions/animated/like.gif',
  love: '/assets/reactions/animated/heart.gif',
  haha: '/assets/reactions/animated/haha.gif',
  wow: '/assets/reactions/animated/wow.gif',
  sad: '/assets/reactions/animated/sad.gif',
  angry: '/assets/reactions/animated/angry.gif'
};

// Reaction colors (Facebook-style)
const REACTION_COLORS: Record<ReactionType, string> = {
  like: 'text-blue-500',
  love: 'text-red-500',
  haha: 'text-yellow-500',
  wow: 'text-yellow-500',
  sad: 'text-yellow-500',
  angry: 'text-orange-500'
};

// Add global styles for reaction popup animation
const reactionPopupStyles = `
  @keyframes reactionPopup {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .reaction-picker-container {
    animation: reactionPopup 0.2s ease-out forwards;
  }
`;

interface CommentSystemProps {
  postId: string;
  postAuthorId: string;
  initialCommentCount?: number;
  onCommentCountChange?: (count: number) => void;
  onReportComment?: (commentId: string) => void;
  scrollToCommentId?: string; // Auto-expand replies to show this comment
  scrollTrigger?: number; // Timestamp to force re-scroll
}

interface CommentAuthorInfo {
  displayName: string;
  photoURL: string;
}

export default function CommentSystem({
  postId,
  postAuthorId,
  initialCommentCount = 0,
  onCommentCountChange,
  onReportComment,
  scrollToCommentId,
  scrollTrigger
}: CommentSystemProps) {
  const { userProfile, getCachedProfile } = useAuth();
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [threadedComments, setThreadedComments] = useState<CommentThread[]>([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<{ [key: string]: string }>({});
  const [authorCache, setAuthorCache] = useState<{ [userId: string]: CommentAuthorInfo }>({});
  
  // Reaction states
  const [userReactions, setUserReactions] = useState<{ [commentId: string]: ReactionType | null }>({});
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [isReacting, setIsReacting] = useState(false);
  const [playingAnimation, setPlayingAnimation] = useState<{ commentId: string; type: ReactionType } | null>(null);
  const [localReactionCounts, setLocalReactionCounts] = useState<{ [commentId: string]: Partial<Record<ReactionType, number>> }>({});
  const [reactionJustSelected, setReactionJustSelected] = useState(false);
  
  // Timeout refs for hover behavior
  const showReactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideReactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Handle showing reactions with delay
  const handleShowReactions = (commentId: string) => {
    // Don't show if a reaction was just selected
    if (reactionJustSelected) return;
    
    if (hideReactionTimeoutRef.current) {
      clearTimeout(hideReactionTimeoutRef.current);
      hideReactionTimeoutRef.current = null;
    }
    showReactionTimeoutRef.current = setTimeout(() => {
      setShowReactionPicker(commentId);
    }, 700);
  };

  const handleHideReactions = () => {
    if (showReactionTimeoutRef.current) {
      clearTimeout(showReactionTimeoutRef.current);
      showReactionTimeoutRef.current = null;
    }
    hideReactionTimeoutRef.current = setTimeout(() => {
      setShowReactionPicker(null);
    }, 500);
  };

  // Close reactions on click outside
  useEffect(() => {
    if (!showReactionPicker) return;
    
    const handleClickOutside = () => {
      if (hideReactionTimeoutRef.current) {
        clearTimeout(hideReactionTimeoutRef.current);
      }
      setShowReactionPicker(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showReactionPicker]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hideReactionTimeoutRef.current) {
        clearTimeout(hideReactionTimeoutRef.current);
      }
      if (showReactionTimeoutRef.current) {
        clearTimeout(showReactionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadComments();
  }, [postId]);

  // Reload with more comments if scrollToCommentId is set and comment not found
  useEffect(() => {
    if (!scrollToCommentId || isLoading) return;
    
    // Check if the comment is already loaded
    const commentExists = comments.some(c => c.id === scrollToCommentId);
    if (!commentExists && comments.length > 0) {
      loadComments();
    }
  }, [scrollToCommentId, comments.length]);

  // Scroll to comment when scrollToCommentId or scrollTrigger changes
  useEffect(() => {
    if (!scrollToCommentId || isLoading || comments.length === 0) return;
    
    // Check if comment exists in loaded comments
    const commentExists = comments.some(c => c.id === scrollToCommentId);
    if (!commentExists) return;
    
    // Find and expand parent replies - recursive search through all levels
    const findCommentAndParents = (commentId: string): string[] => {
      const parentIds: string[] = [];
      
      // Check if it's a top-level comment
      const topLevel = threadedComments.find((t: CommentThread) => t.comment.id === commentId);
      if (topLevel) return parentIds;
      
      // Recursive function to search through nested replies
      const searchReplies = (threads: CommentThread[], ancestors: string[]): string[] | null => {
        for (const thread of threads) {
          // Check direct replies
          const foundInReplies = thread.replies.find((r: CommentThread) => r.comment.id === commentId);
          if (foundInReplies) {
            return [...ancestors, thread.comment.id];
          }
          
          // Search deeper in nested replies
          if (thread.replies.length > 0) {
            const result = searchReplies(thread.replies, [...ancestors, thread.comment.id]);
            if (result) return result;
          }
        }
        return null;
      };
      
      const result = searchReplies(threadedComments, []);
      return result || parentIds;
    };
    
    const parentIds = findCommentAndParents(scrollToCommentId);
    
    // Expand all parent comments to reveal the target comment
    if (parentIds.length > 0) {
      setExpandedReplies(prev => {
        const newSet = new Set(prev);
        parentIds.forEach((id: string) => newSet.add(id));
        return newSet;
      });
    }
    
    // Scroll after a longer delay to let DOM update after expanding replies
    const scrollToComment = () => {
      const commentElement = document.getElementById(`comment-${scrollToCommentId}`);
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedCommentId(scrollToCommentId);
        
        setTimeout(() => {
          setHighlightedCommentId(prev => prev === scrollToCommentId ? null : prev);
        }, 4000);
      } else {
        // If element not found yet, try again after a short delay
        setTimeout(scrollToComment, 100);
      }
    };
    
    // Longer delay to ensure DOM is ready after expanding replies
    setTimeout(scrollToComment, 300);
    
  }, [scrollToCommentId, scrollTrigger, isLoading, comments, threadedComments]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      // If we need to scroll to a specific comment, load more comments to ensure it's included
      const limit = scrollToCommentId ? 100 : COMMENTS_PER_PAGE;
      const loadedComments = await commentService.getPostComments(postId, limit);
      setComments(loadedComments);
      const threads = await commentService.getThreadedComments(postId, limit);
      setThreadedComments(threads);
      setHasMore(loadedComments.length >= limit);
      
      const authorIds = [...new Set([...loadedComments.map(c => c.authorId), postAuthorId])];
      await Promise.all(authorIds.map(fetchAuthorInfo));
      
      // Load user reactions for all comments
      if (userProfile) {
        await loadUserReactions(loadedComments);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserReactions = async (commentsToCheck: Comment[]) => {
    if (!userProfile) return;
    
    try {
      const reactions: { [commentId: string]: ReactionType | null } = {};
      const reactionCounts: { [commentId: string]: Partial<Record<ReactionType, number>> } = {};
      
      await Promise.all(
        commentsToCheck.map(async (comment) => {
          const reaction = await commentService.getUserCommentReaction(comment.id, userProfile.uid);
          reactions[comment.id] = reaction;
          reactionCounts[comment.id] = comment.reactionCounts || {};
        })
      );
      setUserReactions(reactions);
      setLocalReactionCounts(reactionCounts);
    } catch (error) {
      console.error('Failed to load user reactions:', error);
    }
  };

  // Handle reaction with optimistic update
  const handleCommentReaction = async (commentId: string, reactionType: ReactionType) => {
    if (!userProfile || isReacting) return;
    
    // Prevent picker from reopening
    setReactionJustSelected(true);
    
    // Clear all timeouts
    if (showReactionTimeoutRef.current) {
      clearTimeout(showReactionTimeoutRef.current);
      showReactionTimeoutRef.current = null;
    }
    if (hideReactionTimeoutRef.current) {
      clearTimeout(hideReactionTimeoutRef.current);
      hideReactionTimeoutRef.current = null;
    }
    
    setShowReactionPicker(null);
    setIsReacting(true);
    
    // Play animation
    setPlayingAnimation({ commentId, type: reactionType });
    setTimeout(() => setPlayingAnimation(null), 1000);
    
    // Reset the flag after a short delay
    setTimeout(() => setReactionJustSelected(false), 500);
    
    // Optimistic update - immediately show the change
    const previousReaction = userReactions[commentId];
    const previousCounts: Partial<Record<ReactionType, number>> = { ...(localReactionCounts[commentId] || {}) };
    
    // Update local state optimistically
    const newCounts: Partial<Record<ReactionType, number>> = { ...previousCounts };
    
    if (previousReaction === reactionType) {
      // Toggle off same reaction
      setUserReactions(prev => ({ ...prev, [commentId]: null }));
      newCounts[reactionType] = Math.max(0, (newCounts[reactionType] || 0) - 1);
    } else {
      // Set new reaction
      setUserReactions(prev => ({ ...prev, [commentId]: reactionType }));
      
      // Remove old reaction count
      if (previousReaction) {
        newCounts[previousReaction] = Math.max(0, (newCounts[previousReaction] || 0) - 1);
      }
      // Add new reaction count
      newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
    }
    
    setLocalReactionCounts(prev => ({ ...prev, [commentId]: newCounts }));
    
    try {
      if (previousReaction === reactionType) {
        // Remove reaction
        await commentService.removeCommentReaction(commentId, postId, userProfile.uid);
      } else {
        // Add/change reaction
        await commentService.addCommentReaction(commentId, postId, userProfile.uid, reactionType);
      }
    } catch (error: any) {
      // Revert on error
      setUserReactions(prev => ({ ...prev, [commentId]: previousReaction }));
      setLocalReactionCounts(prev => ({ ...prev, [commentId]: previousCounts }));
      toast.error(error instanceof PostError ? error.message : 'Failed to react to comment');
    } finally {
      setIsReacting(false);
    }
  };

  const getTotalCommentReactions = (commentId: string): number => {
    const counts = localReactionCounts[commentId] || {};
    return (Object.values(counts) as number[]).reduce((sum, count) => sum + (count || 0), 0);
  };

  const getTopCommentReactions = (commentId: string): ReactionType[] => {
    const counts = localReactionCounts[commentId] || {};
    return (Object.entries(counts) as [ReactionType, number][])
      .filter(([_, count]) => count && count > 0)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 3)
      .map(([type]) => type);
  };

  const loadMoreComments = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const oldestTimestamp = comments.length > 0 ? Math.min(...comments.map(c => c.createdAt)) : undefined;
      const moreComments = await commentService.getPostComments(postId, COMMENTS_PER_PAGE, oldestTimestamp);
      if (moreComments.length > 0) {
        setComments(prev => [...moreComments, ...prev]);
        const threads = await commentService.getThreadedComments(postId);
        setThreadedComments(threads);
        await Promise.all([...new Set(moreComments.map(c => c.authorId))].map(fetchAuthorInfo));
      }
      setHasMore(moreComments.length >= COMMENTS_PER_PAGE);
    } catch (error) {
      toast.error('Failed to load more comments');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const fetchAuthorInfo = async (userId: string) => {
    if (authorCache[userId]) return;
    try {
      const profile = await getCachedProfile(userId);
      if (profile) {
        setAuthorCache(prev => ({
          ...prev,
          [userId]: { displayName: profile.displayName || 'User', photoURL: profile.photoURL || '' }
        }));
      }
    } catch (error) {
      console.error('Failed to fetch author info:', error);
    }
  };

  const handleSubmit = async (parentId?: string) => {
    const content = parentId ? replyTexts[parentId] : (editingComment ? editingComment.content : newComment);
    if (!content?.trim() || !userProfile) return;
    
    const validation = CommentValidationLogic.validateContent(content);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid comment');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingComment) {
        await commentService.updateComment(postId, editingComment.id, content, userProfile.uid);
        setComments(prev => prev.map(c => 
          c.id === editingComment.id ? { ...c, content: content.trim(), editedAt: Date.now() } : c
        ));
        toast.success('Comment updated');
        setEditingComment(null);
      } else {
        const mentions = CommentValidationLogic.extractMentions(content);
        const newCommentData = await commentService.createComment(
          { postId, content: content.trim(), parentId, mentions },
          userProfile.uid
        );
        setComments(prev => [...prev, newCommentData]);
        setCommentCount(prev => prev + 1);
        onCommentCountChange?.(commentCount + 1);
        const threads = await commentService.getThreadedComments(postId);
        setThreadedComments(threads);
        setAuthorCache(prev => ({
          ...prev,
          [userProfile.uid]: { displayName: userProfile.displayName || 'User', photoURL: userProfile.photoURL || '' }
        }));
        
        if (parentId) {
          setExpandedReplies(prev => new Set([...prev, parentId]));
          setReplyTexts(prev => ({ ...prev, [parentId]: '' }));
          setReplyingToId(null);
        } else {
          setNewComment('');
        }
        toast.success(parentId ? 'Reply posted' : 'Comment posted');
      }
    } catch (error: any) {
      toast.error(error instanceof PostError ? error.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!userProfile) return;
    try {
      await commentService.deleteComment(postId, commentId, userProfile.uid);
      const hasReplies = comments.some(c => c.parentId === commentId);
      if (hasReplies) {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: '[Comment deleted]' } : c));
      } else {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentCount(prev => Math.max(0, prev - 1));
        onCommentCountChange?.(Math.max(0, commentCount - 1));
      }
      const threads = await commentService.getThreadedComments(postId);
      setThreadedComments(threads);
      toast.success('Comment deleted');
      setShowMenu(null);
    } catch (error: any) {
      toast.error(error instanceof PostError ? error.message : 'Failed to delete comment');
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getAuthorAvatar = (authorId: string): string => {
    const author = authorCache[authorId];
    return author?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(author?.displayName || 'User')}&background=random`;
  };

  const canEdit = (comment: Comment): boolean => {
    if (!userProfile || comment.authorId !== userProfile.uid) return false;
    return CommentValidationLogic.canEditComment(comment.createdAt, Date.now());
  };

  // Avatar sizes: top-level = 32px, nested = 28px
  const AVATAR_SIZE_TOP = 32;
  const AVATAR_SIZE_NESTED = 28;
  const INDENT_PER_LEVEL = 40; // Indentation per nesting level

  // Single comment component with Facebook-style thread lines
  const CommentItem: React.FC<{ 
    thread: CommentThread; 
    isLast?: boolean;
    parentHasMoreSiblings?: boolean;
  }> = ({ 
    thread, 
    isLast = false,
    parentHasMoreSiblings = false
  }) => {
    const { comment, replies, depth } = thread;
    const author = authorCache[comment.authorId];
    const isPostAuthor = comment.authorId === postAuthorId;
    const isCurrentUser = userProfile?.uid === comment.authorId;
    const isDeleted = comment.content === '[Comment deleted]';
    const hasReplies = replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const canReply = depth < MAX_NESTING_DEPTH && !isDeleted && userProfile;
    const showReplyInput = replyingToId === comment.id;
    const isNested = depth > 0;
    const isHighlighted = highlightedCommentId === comment.id;
    
    // Local hover state for this comment's reaction picker (prevents parent re-render)
    const [localHoveredReaction, setLocalHoveredReaction] = useState<ReactionType | null>(null);

    const avatarSize = isNested ? AVATAR_SIZE_NESTED : AVATAR_SIZE_TOP;
    const marginLeft = depth * INDENT_PER_LEVEL;
    
    // For nested comments, calculate where the parent's avatar center is
    // Parent avatar center = (depth-1) * INDENT + avatarSize/2
    const parentAvatarCenter = isNested ? (depth - 1) * INDENT_PER_LEVEL + (depth === 1 ? AVATAR_SIZE_TOP : AVATAR_SIZE_NESTED) / 2 : 0;

    return (
      <div 
        className="relative transition-all duration-300"
        id={`comment-${comment.id}`}
      >
        {/* Thread connector line for nested comments */}
        {isNested && (
          <>
            {/* Vertical line from parent - positioned at parent's avatar center */}
            <div 
              style={{ 
                position: 'absolute',
                left: `${parentAvatarCenter - 1}px`,
                top: '0',
                height: `${avatarSize / 2 + 4}px`, // Connect to middle of this comment's avatar
                width: '2px',
                backgroundColor: '#4b5563'
              }} 
            />
            {/* Horizontal line connecting to this comment's avatar */}
            <div 
              style={{ 
                position: 'absolute',
                left: `${parentAvatarCenter - 1}px`,
                top: `${avatarSize / 2 + 2}px`,
                width: `${marginLeft - parentAvatarCenter + 2}px`,
                height: '2px',
                backgroundColor: '#4b5563',
                borderBottomLeftRadius: '8px'
              }} 
            />
            {/* Continue vertical line for siblings below (if not last) */}
            {!isLast && (
              <div 
                style={{ 
                  position: 'absolute',
                  left: `${parentAvatarCenter - 1}px`,
                  top: `${avatarSize / 2 + 4}px`,
                  bottom: '0',
                  width: '2px',
                  backgroundColor: '#4b5563'
                }} 
              />
            )}
          </>
        )}

        <div style={{ marginLeft: `${marginLeft}px` }} className="py-1.5">
          <div className="flex gap-2 relative">
            {/* Avatar with thread line going down to replies */}
            <div className="relative flex-shrink-0">
              <img
                src={getAuthorAvatar(comment.authorId)}
                alt={author?.displayName || 'User'}
                style={{ width: avatarSize, height: avatarSize }}
                className="rounded-full object-cover"
              />
              {/* Vertical line going down from avatar to replies */}
              {hasReplies && isExpanded && (
                <div 
                  style={{ 
                    position: 'absolute',
                    left: `${avatarSize / 2 - 1}px`,
                    top: `${avatarSize}px`,
                    bottom: `-${8}px`,
                    width: '2px',
                    backgroundColor: '#4b5563'
                  }} 
                />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div 
                className={`inline-block max-w-full rounded-2xl px-3 py-2 transition-all duration-300 ${
                  isDeleted ? 'bg-nexus-800' : 'bg-nexus-800'
                } ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-nexus-900 shadow-lg shadow-blue-500/30' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[13px] text-gray-900 dark:text-white">
                    {author?.displayName || 'User'}
                  </span>
                  {isPostAuthor && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500 text-white rounded">
                      Author
                    </span>
                  )}
                </div>
                <p className={`text-[15px] whitespace-pre-wrap break-words ${
                  isDeleted ? 'text-gray-500 italic' : 'text-gray-900 dark:text-white'
                }`}>
                  {comment.content}
                </p>
              </div>
              
              {/* Reaction counts display */}
              {!isDeleted && getTotalCommentReactions(comment.id) > 0 && (
                <div className="flex items-center gap-1 mt-1 ml-3">
                  <div className="flex items-center -space-x-1">
                    {getTopCommentReactions(comment.id).map((type) => (
                        <img 
                          key={type} 
                          src={REACTION_STATIC[type]} 
                          alt={type}
                          className="w-4 h-4 object-contain"
                        />
                      ))}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    {getTotalCommentReactions(comment.id)}
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-3 mt-1 ml-1 text-xs">
                <span className="text-gray-500 dark:text-gray-400">{formatTimestamp(comment.createdAt)}</span>
                
                {!isDeleted && userProfile && (
                  <>
                    <div 
                      className="relative"
                      onMouseEnter={() => handleShowReactions(comment.id)}
                      onMouseLeave={handleHideReactions}
                    >
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Quick like on click
                          const currentReaction = userReactions[comment.id];
                          if (currentReaction) {
                            handleCommentReaction(comment.id, currentReaction);
                          } else {
                            handleCommentReaction(comment.id, 'like');
                          }
                        }}
                        className={`font-semibold text-xs hover:underline transition-colors ${
                          userReactions[comment.id] ? REACTION_COLORS[userReactions[comment.id]!] : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {userReactions[comment.id] 
                          ? userReactions[comment.id]!.charAt(0).toUpperCase() + userReactions[comment.id]!.slice(1) 
                          : 'Like'}
                      </button>
                      
                      {/* Reaction Picker Popup - shows on hover with delay */}
                      {showReactionPicker === comment.id && (
                        <div 
                          className="absolute bottom-full left-0 mb-2 z-50 reaction-picker-container"
                          onMouseEnter={() => {
                            if (hideReactionTimeoutRef.current) {
                              clearTimeout(hideReactionTimeoutRef.current);
                              hideReactionTimeoutRef.current = null;
                            }
                          }}
                          onMouseLeave={handleHideReactions}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-nexus-800 rounded-full shadow-xl border border-white/10 flex items-center px-2">
                            {(Object.keys(REACTION_GIFS) as ReactionType[]).map((type) => (
                              <button
                                key={type}
                                disabled={isReacting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommentReaction(comment.id, type);
                                }}
                                onMouseEnter={() => setLocalHoveredReaction(type)}
                                onMouseLeave={() => setLocalHoveredReaction(null)}
                                className={`-mx-2 transition-all duration-200 ease-out ${
                                  localHoveredReaction === type 
                                    ? 'scale-125 -translate-y-2 z-10' 
                                    : 'scale-100 translate-y-0'
                                } ${isReacting ? 'pointer-events-none opacity-50' : ''}`}
                              >
                                <img
                                  src={REACTION_GIFS[type]}
                                  alt={type}
                                  className="max-w-14 max-h-14"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {canReply && (
                      <button 
                        onClick={() => setReplyingToId(showReplyInput ? null : comment.id)}
                        className="font-semibold text-gray-500 dark:text-gray-400 hover:underline text-xs"
                      >
                        Reply
                      </button>
                    )}
                  </>
                )}
                
                {!isDeleted && (
                  <button className="font-semibold text-gray-500 dark:text-gray-400 hover:underline">Share</button>
                )}
                
                {comment.editedAt && !isDeleted && <span className="text-gray-400">Edited</span>}
                
                {!isDeleted && (
                  <div className="relative ml-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(showMenu === comment.id ? null : comment.id);
                      }}
                      className="p-1 rounded-full hover:bg-nexus-700 text-gray-400"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    
                    {showMenu === comment.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(null)} />
                        <div className="absolute right-0 bottom-full mb-1 bg-nexus-800 rounded-lg shadow-lg border border-white/10 py-1 z-50 min-w-[120px]">
                          {isCurrentUser && canEdit(comment) && (
                            <button
                              onClick={() => { setEditingComment({ id: comment.id, content: comment.content }); setShowMenu(null); }}
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-nexus-700 text-gray-700 dark:text-gray-200 text-sm"
                            >
                              <Edit size={14} /> Edit
                            </button>
                          )}
                          {isCurrentUser && (
                            <button
                              onClick={() => handleDelete(comment.id)}
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-nexus-700 text-red-600 text-sm"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                          {!isCurrentUser && (
                            <button
                              onClick={() => { onReportComment?.(comment.id); setShowMenu(null); }}
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-nexus-700 text-red-600 text-sm"
                            >
                              <Flag size={14} /> Report
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* View replies button */}
              {hasReplies && !isExpanded && (
                <button
                  onClick={() => setExpandedReplies(prev => new Set([...prev, comment.id]))}
                  className="flex items-center gap-2 mt-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700"
                >
                  <div className="w-6 h-[2px] bg-gray-500" />
                  View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
              
              {/* Inline reply input */}
              {showReplyInput && userProfile && (
                <div className="flex gap-2 mt-2">
                  <img
                    src={userProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.displayName || 'User')}&background=random`}
                    alt={userProfile.displayName || 'User'}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 flex items-center gap-2 bg-nexus-800 rounded-full px-3 py-1">
                    <input
                      type="text"
                      value={replyTexts[comment.id] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplyTexts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(comment.id); }}}
                      placeholder={`Reply to ${author?.displayName || 'User'}...`}
                      className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSubmit(comment.id)}
                      disabled={!replyTexts[comment.id]?.trim() || isSubmitting}
                      className={`p-1 rounded-full ${replyTexts[comment.id]?.trim() ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400'}`}
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Render nested replies */}
        {hasReplies && isExpanded && (
          <div className="relative">
            {replies.map((reply, index) => (
              <CommentItem 
                key={reply.comment.id}
                thread={reply} 
                isLast={index === replies.length - 1}
                parentHasMoreSiblings={!isLast}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const currentContent = editingComment ? editingComment.content : newComment;
  const isOverLimit = currentContent.length > MAX_COMMENT_LENGTH;

  return (
    <div className="bg-nexus-900">
      <style>{reactionPopupStyles}</style>
      {userProfile && (
        <div className="p-3 border-b border-white/10">
          {editingComment && (
            <div className="flex items-center gap-2 mb-2 text-sm text-blue-500">
              <Edit size={14} />
              <span>Editing comment</span>
              <button onClick={() => setEditingComment(null)} className="ml-auto text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
          
          <div className="flex gap-2">
            <img
              src={userProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.displayName || 'User')}&background=random`}
              alt={userProfile.displayName || 'User'}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
            
            <div className="flex-1 flex items-center gap-2 bg-nexus-800 rounded-full px-4 py-2">
              <input
                ref={inputRef}
                type="text"
                value={currentContent}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => editingComment ? setEditingComment({ ...editingComment, content: e.target.value }) : setNewComment(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }}}
                placeholder="Write a comment..."
                className={`flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none ${isOverLimit ? 'text-red-500' : ''}`}
                disabled={isSubmitting}
              />
              <button
                onClick={() => handleSubmit()}
                disabled={!currentContent.trim() || isOverLimit || isSubmitting}
                className={`p-1 rounded-full ${currentContent.trim() && !isOverLimit ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400'}`}
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="px-3 pb-3">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : threadedComments.length === 0 ? (
          <div className="py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <>
            {hasMore && (
              <button
                onClick={loadMoreComments}
                disabled={isLoadingMore}
                className="w-full py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700"
              >
                {isLoadingMore ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'View previous comments'}
              </button>
            )}
            {threadedComments.map((thread, index) => (
              <CommentItem 
                key={thread.comment.id}
                thread={thread} 
                isLast={index === threadedComments.length - 1}
                parentHasMoreSiblings={false}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
