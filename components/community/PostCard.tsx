// PostCard Component for NexusPC Community Posts
// Requirements: 2.2, 2.3, 2.4, 2.6, 2.7
import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  Clock,
  Globe,
  Users,
  Lock,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Flag,
  Bookmark,
  History
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { engagementService } from '../../services/engagementService';
import { getUserProfile } from '../../services/authService';
import { 
  Post, 
  PostPrivacy, 
  ProductReference,
  ReactionType,
  PostEditHistory
} from '../../types/community-posts';
import { HashtagDisplay } from './HashtagDisplay';

// Reaction emoji mapping (Facebook-style)
const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😠'
};

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

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onAuthorClick?: (authorId: string) => void;
  onProductClick?: (product: ProductReference) => void;
  onHashtagClick?: (hashtag: string) => void;
  isInsideModal?: boolean;
  onImageClick?: (postId: string) => void;
}

interface AuthorInfo {
  displayName: string;
  photoURL: string;
}

export default function PostCard({
  post,
  currentUserId,
  onLike,
  onComment,
  onShare,
  onEdit,
  onDelete,
  onReport,
  onAuthorClick,
  onProductClick,
  onHashtagClick,
  isInsideModal = false,
  onImageClick
}: PostCardProps) {
  // State
  const [authorInfo, setAuthorInfo] = useState<AuthorInfo | null>(null);
  const [localReactionCounts, setLocalReactionCounts] = useState<Partial<Record<ReactionType, number>>>(post.reactionCounts || {});
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);
  const [playingAnimation, setPlayingAnimation] = useState<ReactionType | null>(null);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [reactionsModalFilter, setReactionsModalFilter] = useState<ReactionType | 'all'>('all');
  const [reactorsList, setReactorsList] = useState<Array<{ userId: string; displayName: string; photoURL: string; reactionType: ReactionType }>>([]);
  const [loadingReactors, setLoadingReactors] = useState(false);
  const [reactionJustSelected, setReactionJustSelected] = useState(false);
  const hideReactionsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const showReactionsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const isAuthor = currentUserId === post.authorId;

  // Handle showing reactions with delay on show
  const handleShowReactions = () => {
    // Don't show if a reaction was just selected
    if (reactionJustSelected) return;
    
    if (hideReactionsTimeoutRef.current) {
      clearTimeout(hideReactionsTimeoutRef.current);
      hideReactionsTimeoutRef.current = null;
    }
    // Add delay before showing
    showReactionsTimeoutRef.current = setTimeout(() => {
      setShowReactions(true);
    }, 700);
  };

  const handleHideReactions = () => {
    // Cancel show timeout if still pending
    if (showReactionsTimeoutRef.current) {
      clearTimeout(showReactionsTimeoutRef.current);
      showReactionsTimeoutRef.current = null;
    }
    hideReactionsTimeoutRef.current = setTimeout(() => {
      setShowReactions(false);
      setHoveredReaction(null);
    }, 500);
  };

  // Close reactions on click outside
  useEffect(() => {
    if (!showReactions) return;
    
    const handleClickOutside = () => {
      if (hideReactionsTimeoutRef.current) {
        clearTimeout(hideReactionsTimeoutRef.current);
      }
      setShowReactions(false);
      setHoveredReaction(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showReactions]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideReactionsTimeoutRef.current) {
        clearTimeout(hideReactionsTimeoutRef.current);
      }
      if (showReactionsTimeoutRef.current) {
        clearTimeout(showReactionsTimeoutRef.current);
      }
    };
  }, []);

  // Fetch author info
  useEffect(() => {
    const fetchAuthor = async () => {
      try {
        const profile = await getUserProfile(post.authorId);
        if (profile) {
          setAuthorInfo({
            displayName: profile.displayName || 'User',
            photoURL: profile.photoURL || ''
          });
        }
      } catch (error) {
        console.error('Failed to fetch author info:', error);
      }
    };
    fetchAuthor();
  }, [post.authorId]);

  // Listen to real-time reaction count updates
  useEffect(() => {
    const unsubscribe = engagementService.listenToReactionCounts(
      post.id,
      (counts) => {
        setLocalReactionCounts(counts);
      }
    );
    return () => unsubscribe();
  }, [post.id]);

  // Listen to real-time user reaction updates
  useEffect(() => {
    if (!currentUserId) return;
    
    const unsubscribe = engagementService.listenToUserReaction(
      post.id,
      currentUserId,
      (reactionType) => {
        setUserReaction(reactionType);
      }
    );
    return () => unsubscribe();
  }, [post.id, currentUserId]);

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
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
  };

  // Get privacy icon
  const getPrivacyIcon = (privacy: PostPrivacy) => {
    switch (privacy) {
      case 'public': return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      );
      case 'friends': return <Users size={12} className="text-gray-400" />;
      case 'private': return <Lock size={12} className="text-gray-400" />;
    }
  };

  // Handle like - uses reaction system with optimistic update
  const handleLike = async () => {
    if (!currentUserId || isLiking) return;
    
    setIsLiking(true);
    
    // Optimistic update - immediately show the change
    const previousReaction = userReaction;
    if (userReaction) {
      // If user has any reaction, remove it
      setUserReaction(null);
    } else {
      // If no reaction, add 'like'
      setUserReaction('like');
    }
    
    try {
      // If user has a reaction, toggle it off; otherwise add 'like'
      const result = await engagementService.toggleReaction(post.id, currentUserId, userReaction || 'like');
      // Sync with actual result (in case of any discrepancy)
      setUserReaction(result.reactionType);
      onLike?.(post.id);
    } catch (error: any) {
      // Revert on error
      setUserReaction(previousReaction);
      console.error('Failed to like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  // Handle reaction with optimistic update
  const handleReaction = async (reactionType: ReactionType) => {
    if (!currentUserId || isLiking) return;
    
    // Prevent picker from reopening
    setReactionJustSelected(true);
    
    // Clear all timeouts
    if (showReactionsTimeoutRef.current) {
      clearTimeout(showReactionsTimeoutRef.current);
      showReactionsTimeoutRef.current = null;
    }
    if (hideReactionsTimeoutRef.current) {
      clearTimeout(hideReactionsTimeoutRef.current);
      hideReactionsTimeoutRef.current = null;
    }
    
    setShowReactions(false);
    setIsLiking(true);
    
    // Reset the flag after a short delay
    setTimeout(() => setReactionJustSelected(false), 500);
    
    // Optimistic update - immediately show the change
    const previousReaction = userReaction;
    if (userReaction === reactionType) {
      setUserReaction(null); // Toggle off same reaction
    } else {
      setUserReaction(reactionType); // Set new reaction
    }
    
    try {
      const result = await engagementService.toggleReaction(post.id, currentUserId, reactionType);
      // Sync with actual result
      setUserReaction(result.reactionType);
      onLike?.(post.id);
    } catch (error: any) {
      // Revert on error
      setUserReaction(previousReaction);
      console.error('Failed to react:', error);
    } finally {
      setIsLiking(false);
    }
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IQ', {
      style: 'currency',
      currency: 'IQD',
      maximumFractionDigits: 0
    }).format(price);
  };

  // Use local reaction counts for display (optimistic updates)
  const reactionCounts = localReactionCounts;

  // Get total reactions
  const getTotalReactions = (): number => {
    const values = Object.values(localReactionCounts) as number[];
    return values.reduce((sum, count) => sum + (count || 0), 0);
  };

  // Get top reactions for display
  const getTopReactions = (): ReactionType[] => {
    return (Object.entries(localReactionCounts) as [ReactionType, number][])
      .filter(([_, count]) => count && count > 0)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 3)
      .map(([type]) => type);
  };

  // Load reactors list for modal
  const loadReactors = async () => {
    setLoadingReactors(true);
    try {
      const { ref, get } = await import('firebase/database');
      const { database } = await import('../../firebase.config');
      
      const reactionsRef = ref(database, `posts/${post.id}/reactions`);
      const snapshot = await get(reactionsRef);
      
      if (!snapshot.exists()) {
        setReactorsList([]);
        return;
      }
      
      const reactionsData = snapshot.val();
      const userIds = Object.keys(reactionsData);
      
      // Fetch user profiles
      const reactors: Array<{ userId: string; displayName: string; photoURL: string; reactionType: ReactionType }> = [];
      
      for (const oderId of userIds) {
        const reaction = reactionsData[oderId];
        const profile = await getUserProfile(oderId);
        reactors.push({
          userId: oderId,
          displayName: profile?.displayName || 'User',
          photoURL: profile?.photoURL || `https://ui-avatars.com/api/?name=User&background=random`,
          reactionType: reaction.type
        });
      }
      
      setReactorsList(reactors);
    } catch (error) {
      console.error('Failed to load reactors:', error);
    } finally {
      setLoadingReactors(false);
    }
  };

  // Open reactions modal
  const handleOpenReactionsModal = () => {
    setShowReactionsModal(true);
    setReactionsModalFilter('all');
    loadReactors();
  };

  // Filter reactors by type
  const filteredReactors = reactionsModalFilter === 'all' 
    ? reactorsList 
    : reactorsList.filter(r => r.reactionType === reactionsModalFilter);

  // Safe images array
  const images = post.images || [];

  // Lightbox navigation
  const nextImage = () => {
    if (images.length === 0) return;
    setLightboxIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length === 0) return;
    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Handle keyboard navigation in lightbox
  useEffect(() => {
    if (!showLightbox) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLightbox(false);
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLightbox, images.length]);

  const authorAvatar = authorInfo?.photoURL || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(authorInfo?.displayName || 'User')}&background=random`;

  return (
    <div className={isInsideModal 
      ? "bg-nexus-900 overflow-hidden" 
      : "bg-nexus-900 rounded-lg shadow overflow-hidden"
    }>
      {/* Header - Author info (Requirement 2.2) */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onAuthorClick?.(post.authorId)}
            className="flex-shrink-0"
          >
            <img
              src={authorAvatar}
              alt={authorInfo?.displayName || 'User'}
              className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-blue-500 transition-all"
            />
          </button>
          <div>
            <button
              onClick={() => onAuthorClick?.(post.authorId)}
              className="font-semibold text-gray-900 dark:text-white hover:underline"
            >
              {authorInfo?.displayName || 'Loading...'}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatTimestamp(post.createdAt)}</span>
              {post.editedAt && (
                <>
                  <span>•</span>
                  <button 
                    onClick={() => setShowEditHistory(true)}
                    className="hover:underline flex items-center gap-1"
                  >
                    <History size={12} />
                    Edited
                  </button>
                </>
              )}
              <span>•</span>
              {getPrivacyIcon(post.privacy)}
            </div>
          </div>
        </div>

        {/* Menu button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full hover:bg-nexus-700 text-gray-500"
          >
            <MoreHorizontal size={20} />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)} 
              />
              <div className="absolute right-0 top-full mt-1 bg-nexus-800 rounded-lg shadow-lg border border-white/10 py-1 z-20 min-w-[160px]">
                {isAuthor ? (
                  <>
                    <button
                      onClick={() => { onEdit?.(post.id); setShowMenu(false); }}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-nexus-700 text-gray-200"
                    >
                      <Edit size={16} />
                      <span>Edit post</span>
                    </button>
                    <button
                      onClick={() => { onDelete?.(post.id); setShowMenu(false); }}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-nexus-700 text-red-600"
                    >
                      <Trash2 size={16} />
                      <span>Delete post</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setShowMenu(false); }}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-nexus-700 text-gray-200"
                    >
                      <Bookmark size={16} />
                      <span>Save post</span>
                    </button>
                    <button
                      onClick={() => { onReport?.(post.id); setShowMenu(false); }}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-nexus-700 text-red-600"
                    >
                      <Flag size={16} />
                      <span>Report post</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <HashtagDisplay 
          content={post.content}
          onHashtagClick={onHashtagClick}
          className="text-gray-900 dark:text-white whitespace-pre-wrap break-words"
        />
      </div>

      {/* Images (Requirements 2.3, 2.6) */}
      {images.length > 0 && (
        <>
          {/* 1 image: Full width with edge-color background like Facebook */}
          {images.length === 1 && (
            <button
              onClick={() => {
                if (isInsideModal) {
                  setLightboxIndex(0);
                  setShowLightbox(true);
                } else {
                  onImageClick?.(post.id);
                }
              }}
              className="relative overflow-hidden w-full"
            >
              {/* Full blurred background stretched to fill */}
              <div 
                className="absolute inset-0"
                style={{ 
                  backgroundImage: `url(${images[0]})`,
                  backgroundSize: '100% 100%',
                  backgroundPosition: 'center',
                  filter: 'blur(50px) brightness(0.9)',
                  transform: 'scale(1.1)'
                }}
              />
              {/* Main image */}
              <img
                src={images[0]}
                alt="Post image"
                className="relative z-10 w-full h-auto max-h-[600px] object-contain hover:opacity-90 transition-opacity"
              />
            </button>
          )}
          
          {/* 2 images: Side by side, equal height */}
          {images.length === 2 && (
            <div className="grid grid-cols-2 gap-0.5 aspect-[2/1]">
              {images.map((imageUrl, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (isInsideModal) {
                      setLightboxIndex(index);
                      setShowLightbox(true);
                    } else {
                      onImageClick?.(post.id);
                    }
                  }}
                  className="relative overflow-hidden bg-nexus-800"
                >
                  <img
                    src={imageUrl}
                    alt={`Post image ${index + 1}`}
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
              ))}
            </div>
          )}
          
          {/* 3 images: First on top (full width), two on bottom */}
          {images.length === 3 && (
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => {
                  if (isInsideModal) {
                    setLightboxIndex(0);
                    setShowLightbox(true);
                  } else {
                    onImageClick?.(post.id);
                  }
                }}
                className="relative overflow-hidden bg-nexus-800 aspect-video"
              >
                <img
                  src={images[0]}
                  alt="Post image 1"
                  className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                />
              </button>
              <div className="grid grid-cols-2 gap-0.5 aspect-[2/1]">
                {images.slice(1, 3).map((imageUrl, index) => (
                  <button
                    key={index + 1}
                    onClick={() => {
                      if (isInsideModal) {
                        setLightboxIndex(index + 1);
                        setShowLightbox(true);
                      } else {
                        onImageClick?.(post.id);
                      }
                    }}
                    className="relative overflow-hidden bg-nexus-800"
                  >
                    <img
                      src={imageUrl}
                      alt={`Post image ${index + 2}`}
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* 4 images: 2x2 grid */}
          {images.length === 4 && (
            <div className="grid grid-cols-2 gap-0.5 aspect-square">
              {images.map((imageUrl, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (isInsideModal) {
                      setLightboxIndex(index);
                      setShowLightbox(true);
                    } else {
                      onImageClick?.(post.id);
                    }
                  }}
                  className="relative overflow-hidden bg-nexus-800"
                >
                  <img
                    src={imageUrl}
                    alt={`Post image ${index + 1}`}
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
              ))}
            </div>
          )}
          
          {/* 5+ images: 2 on top (2 cols), 3 on bottom (3 cols), last has +N overlay if more */}
          {images.length >= 5 && (
            <div className="flex flex-col gap-0.5">
              {/* Top row: 2 images */}
              <div className="grid grid-cols-2 gap-0.5 aspect-[2/1]">
                {images.slice(0, 2).map((imageUrl, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (isInsideModal) {
                        setLightboxIndex(index);
                        setShowLightbox(true);
                      } else {
                        onImageClick?.(post.id);
                      }
                    }}
                    className="relative overflow-hidden bg-nexus-800"
                  >
                    <img
                      src={imageUrl}
                      alt={`Post image ${index + 1}`}
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                ))}
              </div>
              {/* Bottom row: 3 images */}
              <div className="grid grid-cols-3 gap-0.5 aspect-[3/1]">
                {images.slice(2, 5).map((imageUrl, index) => (
                  <button
                    key={index + 2}
                    onClick={() => {
                      if (isInsideModal) {
                        setLightboxIndex(index + 2);
                        setShowLightbox(true);
                      } else {
                        onImageClick?.(post.id);
                      }
                    }}
                    className="relative overflow-hidden bg-nexus-800"
                  >
                    <img
                      src={imageUrl}
                      alt={`Post image ${index + 3}`}
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                    />
                    {/* Show +N overlay on the last visible image (5th) if more than 5 */}
                    {index === 2 && images.length > 5 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-3xl font-bold">
                          +{images.length - 5}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tagged Products (Requirement 2.4) */}
      {(post.taggedProducts?.length || 0) > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Tagged Products
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {post.taggedProducts?.map((product) => (
              <button
                key={product.productId}
                onClick={() => onProductClick?.(product)}
                className="flex-shrink-0 flex items-center gap-2 bg-nexus-800 rounded-lg p-2 hover:bg-nexus-700 transition-colors border border-white/10"
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-12 h-12 object-contain rounded bg-white"
                  />
                )}
                <div className="text-left min-w-0 max-w-[150px]">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {product.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {product.retailer}
                  </p>
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {formatPrice(product.price)}
                  </p>
                </div>
                <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Engagement metrics - Facebook style */}
      {(getTotalReactions() > 0 || post.commentCount > 0) && (
        <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          {/* Left side: Reactions */}
          <button 
            className="flex items-center gap-1 hover:underline"
            onClick={handleOpenReactionsModal}
            disabled={getTotalReactions() === 0}
          >
            {getTotalReactions() > 0 && (
              <>
                {getTopReactions().length > 0 && (
                  <div className="flex -space-x-0.5">
                    {getTopReactions().map((type, index) => (
                      <img 
                        key={type} 
                        src={REACTION_STATIC[type]} 
                        alt={type}
                        className="w-[18px] h-[18px] object-contain"
                        style={{ zIndex: 10 - index }}
                      />
                    ))}
                  </div>
                )}
                <span className="ml-1">
                  {getTotalReactions()}
                </span>
              </>
            )}
          </button>
          
          {/* Right side: Comments count */}
          <div className="flex items-center gap-4">
            {post.commentCount > 0 && (
              <button 
                onClick={() => onComment?.(post.id)}
                className="hover:underline"
              >
                {post.commentCount} comment{post.commentCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action buttons - Facebook style */}
      <div className="px-2 py-1 flex items-center">
        {/* Like button with reactions */}
        <div className="relative flex-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleLike(); }}
            onMouseEnter={handleShowReactions}
            onMouseLeave={handleHideReactions}
            disabled={isLiking || !currentUserId}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg hover:bg-nexus-700 transition-colors ${
              userReaction ? REACTION_COLORS[userReaction] : 'text-gray-600 dark:text-gray-300'
            } ${!currentUserId ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {userReaction ? (
              <img
                src={REACTION_STATIC[userReaction]}
                alt={userReaction}
                className="w-5 h-5 object-contain"
              />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            )}
            <span className="font-medium text-sm">
              {userReaction ? userReaction.charAt(0).toUpperCase() + userReaction.slice(1) : 'Like'}
            </span>
          </button>
          
          {/* Reactions popup - Facebook style */}
          {showReactions && currentUserId && (
            <div 
              className="absolute bottom-full left-0 pb-2 z-20"
              style={{
                animation: 'reactionPopup 0.2s ease-out'
              }}
              onMouseEnter={handleShowReactions}
              onMouseLeave={handleHideReactions}
              onClick={(e) => e.stopPropagation()}
            >
              <style>{`
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
              `}</style>
              <div className="bg-nexus-800 rounded-full shadow-xl border border-white/10 flex items-center px-2">
                {(Object.keys(REACTION_GIFS) as ReactionType[]).map((type) => (
                  <button
                    key={type}
                    disabled={isLiking}
                    onClick={() => {
                      if (isLiking) return;
                      setPlayingAnimation(type);
                      handleReaction(type);
                      setTimeout(() => setPlayingAnimation(null), 1000);
                    }}
                    onMouseEnter={() => setHoveredReaction(type)}
                    onMouseLeave={() => setHoveredReaction(null)}
                    className={`-mx-2 transition-all duration-200 ease-out ${
                      hoveredReaction === type 
                        ? 'scale-125 -translate-y-2 z-10' 
                        : 'scale-100 translate-y-0'
                    } ${isLiking ? 'pointer-events-none opacity-50' : ''}`}
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

        {/* Comment button */}
        <button
          onClick={() => onComment?.(post.id)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg hover:bg-nexus-700 transition-colors text-gray-300"
        >
          <MessageCircle size={20} />
          <span className="font-medium text-sm">Comment</span>
        </button>

        {/* Share button */}
        <button
          onClick={() => onShare?.(post.id)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg hover:bg-nexus-700 transition-colors text-gray-300"
        >
          <Share2 size={20} />
          <span className="font-medium text-sm">Share</span>
        </button>
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setShowLightbox(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 text-white text-sm">
            {lightboxIndex + 1} / {images.length}
          </div>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          {/* Main image */}
          <img
            src={images[lightboxIndex]}
            alt={`Post image ${lightboxIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((img, index) => (
                <button
                  key={index}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(index); }}
                  className={`w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                    index === lightboxIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit History Modal */}
      {showEditHistory && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditHistory(false)}
        >
          <div 
            className="bg-nexus-900 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <History size={20} />
                Edit History
              </h3>
              <button
                onClick={() => setShowEditHistory(false)}
                className="p-1 rounded-full hover:bg-nexus-700 text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* History list */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Current version */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                  <span>Current Version</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{formatTimestamp(post.editedAt || post.createdAt)}</span>
                </div>
                <p className="text-white whitespace-pre-wrap break-words">
                  {post.content}
                </p>
                {post.images && post.images.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {post.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />
                    ))}
                  </div>
                )}
              </div>
              
              {/* Previous versions */}
              {post.editHistory && post.editHistory.length > 0 ? (
                [...post.editHistory].reverse().map((history, index) => (
                  <div key={index} className="border-l-4 border-gray-300 dark:border-gray-600 pl-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                      <span>Previous Version</span>
                      <span>•</span>
                      <span>{formatTimestamp(history.editedAt)}</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {history.content}
                    </p>
                    {history.images && history.images.length > 0 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto">
                        {history.images.map((img, i) => (
                          <img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  <p>No previous versions available</p>
                  <p className="text-sm mt-1">This is the first edit of this post</p>
                </div>
              )}
              
              {/* Original post */}
              {(!post.editHistory || post.editHistory.length === 0) && post.editedAt && (
                <div className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 opacity-60">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Original • {formatTimestamp(post.createdAt)}
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    Original content not available
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reactions Modal - Facebook style "Who reacted" */}
      {showReactionsModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowReactionsModal(false)}
        >
          <div 
            className="bg-nexus-900 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reactions
              </h3>
              <button
                onClick={() => setShowReactionsModal(false)}
                className="p-1 rounded-full hover:bg-nexus-700 text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Filter tabs */}
            <div className="flex border-b border-white/10 overflow-x-auto">
              <button
                onClick={() => setReactionsModalFilter('all')}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  reactionsModalFilter === 'all'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                All {getTotalReactions()}
              </button>
              {(Object.entries(localReactionCounts) as [ReactionType, number][])
                .filter(([_, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setReactionsModalFilter(type)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                      reactionsModalFilter === type
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <img src={REACTION_STATIC[type]} alt={type} className="w-5 h-5" />
                    {count}
                  </button>
                ))}
            </div>
            
            {/* Reactors list */}
            <div className="overflow-y-auto max-h-[50vh]">
              {loadingReactors ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredReactors.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No reactions yet
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredReactors.map((reactor) => (
                    <div 
                      key={reactor.userId}
                      className="flex items-center gap-3 p-4 hover:bg-nexus-800"
                    >
                      <div className="relative">
                        <button
                          onClick={() => {
                            setShowReactionsModal(false);
                            onAuthorClick?.(reactor.userId);
                          }}
                        >
                          <img
                            src={reactor.photoURL}
                            alt={reactor.displayName}
                            className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-blue-500 transition-all"
                          />
                        </button>
                        {/* Reaction badge */}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-nexus-900 flex items-center justify-center shadow-sm">
                          <img 
                            src={REACTION_STATIC[reactor.reactionType]} 
                            alt={reactor.reactionType}
                            className="w-4 h-4"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => {
                            setShowReactionsModal(false);
                            onAuthorClick?.(reactor.userId);
                          }}
                          className="font-medium text-gray-900 dark:text-white hover:underline truncate block"
                        >
                          {reactor.displayName}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Pure functions for testing (without React/Firebase dependency)
export const PostDisplayLogic = {
  /**
   * Format timestamp to relative time string
   * @param timestamp - Unix timestamp in milliseconds
   * @returns Formatted time string
   */
  formatTimestamp(timestamp: number): string {
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
  },

  /**
   * Check if post has all required display fields
   * @param post - Post object to validate
   * @returns Object with validation results
   */
  validatePostDisplayFields(post: Post): {
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
  },

  /**
   * Calculate image grid layout based on image count
   * @param imageCount - Number of images
   * @returns Grid layout configuration
   */
  calculateImageGridLayout(imageCount: number): {
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
  },

  /**
   * Get top reactions from reaction counts
   * @param reactionCounts - Map of reaction types to counts
   * @param limit - Maximum number of reactions to return
   * @returns Array of top reaction types
   */
  getTopReactions(
    reactionCounts: Partial<Record<ReactionType, number>>,
    limit: number = 3
  ): ReactionType[] {
    return Object.entries(reactionCounts)
      .filter(([_, count]) => count && count > 0)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, limit)
      .map(([type]) => type as ReactionType);
  },

  /**
   * Calculate total engagement (likes + reactions)
   * @param likeCount - Number of likes
   * @param reactionCounts - Map of reaction types to counts
   * @returns Total engagement count
   */
  calculateTotalEngagement(
    likeCount: number,
    reactionCounts: Partial<Record<ReactionType, number>>
  ): number {
    const totalReactions = Object.values(reactionCounts)
      .reduce((sum, count) => sum + (count || 0), 0);
    return likeCount + totalReactions;
  },

  /**
   * Check if images should display in responsive grid
   * @param images - Array of image URLs
   * @returns Whether grid layout should be used
   */
  shouldUseGridLayout(images: string[]): boolean {
    return images.length > 1;
  },

  /**
   * Validate image URLs are present and valid
   * @param images - Array of image URLs
   * @returns Validation result
   */
  validateImages(images: string[]): {
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
};
