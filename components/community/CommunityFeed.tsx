// CommunityFeed Component for NexusPC Community Posts
// Requirements: 2.1, 2.5, 2.8, 2.9
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RefreshCw, 
  Filter, 
  Users, 
  Clock,
  ChevronDown,
  Loader2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { postService } from '../../services/postService';
import { followService } from '../../services/followService';
import { FeedLogic } from '../../utils/feedUtils';
import PostCard from './PostCard';
import PostDetailModal from './PostDetailModal';
import ImageViewerModal from './ImageViewerModal';
import PostCreator from './PostCreator';
import { 
  Post, 
  FeedFilters,
  ProductReference
} from '../../types/community-posts';
import { TrendingSidebar } from './TrendingSidebar';
import { SearchModal } from './SearchModal';
import { SearchBar } from './SearchBar';

// Feed tab types
type FeedTab = 'recent' | 'following';

interface CommunityFeedProps {
  userId?: string; // For user-specific feeds
  onPostClick?: (postId: string) => void;
  onAuthorClick?: (authorId: string) => void;
  onProductClick?: (product: ProductReference) => void;
  onCreatePost?: () => void;
  onHashtagClick?: (hashtag: string) => void;
  scrollToPostId?: string; // Post ID to scroll to
  scrollToCommentId?: string; // Comment ID to scroll to
  scrollTrigger?: number; // Timestamp to force re-scroll
}

// Skeleton loading component
const PostSkeleton: React.FC = () => (
  <div className="bg-nexus-800 rounded-lg shadow border border-white/10 overflow-hidden animate-pulse">
    {/* Header skeleton */}
    <div className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-nexus-700" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-nexus-700 rounded mb-2" />
        <div className="h-3 w-24 bg-nexus-700 rounded" />
      </div>
    </div>
    {/* Content skeleton */}
    <div className="px-4 pb-3 space-y-2">
      <div className="h-4 w-full bg-nexus-700 rounded" />
      <div className="h-4 w-3/4 bg-nexus-700 rounded" />
      <div className="h-4 w-1/2 bg-nexus-700 rounded" />
    </div>
    {/* Image skeleton */}
    <div className="aspect-video bg-nexus-700" />
    {/* Actions skeleton */}
    <div className="p-4 flex gap-4">
      <div className="h-8 w-20 bg-nexus-700 rounded" />
      <div className="h-8 w-20 bg-nexus-700 rounded" />
      <div className="h-8 w-20 bg-nexus-700 rounded" />
    </div>
  </div>
);

export default function CommunityFeed({
  userId,
  onPostClick,
  onAuthorClick,
  onProductClick,
  onCreatePost,
  onHashtagClick,
  scrollToPostId,
  scrollToCommentId,
  scrollTrigger
}: CommunityFeedProps) {
  const { user } = useAuth();
  
  // State
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<FeedTab>('recent');
  const [filters, setFilters] = useState<FeedFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [postDetailModal, setPostDetailModal] = useState<{ postId: string; commentId?: string } | null>(null);
  const [imageViewerModal, setImageViewerModal] = useState<{ postId: string; imageIndex?: number } | null>(null);
  
  // Refs
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const lastViewedTimestamp = useRef<number>(Date.now());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const PAGE_SIZE = 20;

  // Load initial posts
  const loadPosts = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
        setPage(0);
        setError(null);
      }

      const feedQuery = {
        userId: user?.uid || '',
        feedType: 'discover' as const,
        limit: PAGE_SIZE,
        filters
      };

      let fetchedPosts = await postService.getFeedPosts(feedQuery);
      
      // If Following tab is active, filter to only show posts from users we follow
      if (activeTab === 'following' && user?.uid) {
        const followingList = await followService.getFollowing(user.uid);
        const followingSet = new Set(followingList);
        fetchedPosts = fetchedPosts.filter(post => followingSet.has(post.authorId));
      }
      
      // Sort chronologically (newest first) - Requirement 2.1
      const sortedPosts = FeedLogic.sortByChronological(fetchedPosts);
      
      if (reset) {
        setPosts(sortedPosts);
        lastViewedTimestamp.current = Date.now();
        setNewPostsCount(0);
      } else {
        setPosts(sortedPosts);
      }
      
      setHasMore(sortedPosts.length >= PAGE_SIZE);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.uid, activeTab, filters]);

  // Load more posts (pagination) - Requirement 2.5
  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const nextPage = page + 1;
      const lastPost = posts[posts.length - 1];
      
      const feedQuery = {
        userId: user?.uid || '',
        feedType: 'discover' as const,
        limit: PAGE_SIZE,
        startAfter: lastPost?.createdAt.toString(),
        filters
      };

      let morePosts = await postService.getFeedPosts(feedQuery);
      
      // If Following tab is active, filter to only show posts from users we follow
      if (activeTab === 'following' && user?.uid) {
        const followingList = await followService.getFollowing(user.uid);
        const followingSet = new Set(followingList);
        morePosts = morePosts.filter(post => followingSet.has(post.authorId));
      }
      
      if (morePosts.length > 0) {
        // Merge and sort - maintains chronological order
        const merged = FeedLogic.mergeNewPosts(posts, morePosts);
        setPosts(merged);
        setPage(nextPage);
        setHasMore(morePosts.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
      
    } catch (err: any) {
      console.error('Failed to load more posts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, posts, user?.uid, activeTab, filters]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPosts(true);
  }, [loadPosts]);

  // Set up real-time listener - Requirement 2.9
  useEffect(() => {
    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Set up new listener
    const unsubscribe = postService.listenToPosts((newPosts) => {
      const sortedNewPosts = FeedLogic.sortByChronological(newPosts);
      
      // Count new posts since last view
      const newCount = FeedLogic.countNewPosts(sortedNewPosts, lastViewedTimestamp.current);
      
      if (newCount > 0 && !isLoading) {
        setNewPostsCount(newCount);
      }
      
      // Merge with existing posts
      setPosts(prev => {
        const merged = FeedLogic.mergeNewPosts(prev, sortedNewPosts);
        return merged;
      });
    }, 50);

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [isLoading]);

  // Initial load
  useEffect(() => {
    loadPosts(true);
  }, [activeTab, filters]);

  // Scroll to specific post when scrollToPostId changes
  useEffect(() => {
    if (scrollToPostId && posts.length > 0) {
      // If there's a comment to scroll to, open the modal
      if (scrollToCommentId) {
        setPostDetailModal({ postId: scrollToPostId, commentId: scrollToCommentId });
      } else {
        // Just scroll to the post
        setTimeout(() => {
          const postElement = document.getElementById(`post-${scrollToPostId}`);
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            postElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
            setTimeout(() => {
              postElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
            }, 2000);
          }
        }, 300);
      }
    }
  }, [scrollToPostId, scrollToCommentId, posts.length]);

  // Set up intersection observer for infinite scroll - Requirement 2.5
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMorePosts();
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, isLoading, loadMorePosts]);

  // Handle new posts banner click
  const handleShowNewPosts = () => {
    lastViewedTimestamp.current = Date.now();
    setNewPostsCount(0);
    feedContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle post actions
  const handleLike = (postId: string) => {
    // Handled by PostCard internally
  };

  const handleComment = (postId: string) => {
    // Open post detail modal instead of expanding inline
    setPostDetailModal({ postId });
  };

  const handleShare = (postId: string) => {
    // TODO: Implement share functionality
  };

  const handleEdit = (postId: string) => {
    const postToEdit = posts.find(p => p.id === postId);
    if (postToEdit) {
      setEditingPost(postToEdit);
    }
  };

  const handleEditComplete = (updatedPost: Post) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    setEditingPost(null);
    toast.success('Post updated');
  };

  const handleDelete = async (postId: string) => {
    if (!user?.uid) return;
    
    try {
      await postService.deletePost(postId, user.uid);
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success('Post deleted');
    } catch (err: any) {
      console.error('Failed to delete post:', err);
      toast.error('Failed to delete post');
    }
  };

  const handleReport = (postId: string) => {
    // TODO: Implement report functionality
  };

  const handleHashtagClick = (hashtag: string) => {
    setSearchQuery(hashtag);
    setShowSearchModal(true);
  };

  // Filter options
  const timeRangeOptions: { label: string; value: FeedFilters['timeRange'] }[] = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'day' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' }
  ];

  return (
    <div className="max-w-2xl mx-auto" ref={feedContainerRef}>
      {/* Search Bar */}
      <div className="sticky top-0 z-20 bg-nexus-900 border-b border-white/10 p-4">
        <SearchBar 
          onSearchFocus={() => setShowSearchModal(true)}
          className="w-full"
        />
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-nexus-900 border-b border-white/10">
        <div className="flex items-center justify-between px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'recent'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Clock size={16} className="inline mr-1.5" />
              Recent
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'following'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Users size={16} className="inline mr-1.5" />
              Following
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-full hover:bg-nexus-800 text-gray-400 disabled:opacity-50"
              title="Refresh feed"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            
            {/* Filter button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-full hover:bg-nexus-800 ${
                showFilters ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
              }`}
              title="Filter posts"
            >
              <Filter size={18} />
            </button>
          </div>
        </div>

        {/* Filter dropdown */}
        {showFilters && (
          <div className="px-4 py-3 bg-nexus-800 border-t border-white/10">
            <div className="flex flex-wrap gap-4">
              {/* Time range filter */}
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Time Range
                </label>
                <select
                  value={filters.timeRange || 'all'}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    timeRange: e.target.value as FeedFilters['timeRange'] 
                  }))}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-white/10 bg-nexus-700 text-white"
                >
                  {timeRangeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New posts banner */}
      {newPostsCount > 0 && (
        <button
          onClick={handleShowNewPosts}
          className="w-full py-2 bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          {newPostsCount} new post{newPostsCount !== 1 ? 's' : ''} - Click to see
        </button>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 m-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-500" size={20} />
          <div className="flex-1">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
          <button
            onClick={() => loadPosts(true)}
            className="text-red-600 dark:text-red-400 text-sm font-medium hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Posts list */}
      <div className="p-4 space-y-4">
        {/* Loading skeleton - Requirement 2.8 */}
        {isLoading && posts.length === 0 && (
          <>
            {Array.from({ length: FeedLogic.calculateSkeletonCount() }).map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </>
        )}

        {/* Posts */}
        {!isLoading && posts.length === 0 && !error && (
          <div className="text-center py-12">
            {activeTab === 'following' ? (
              // Show following empty state
              <>
                <Users size={48} className="mx-auto mb-4 text-gray-400 opacity-50" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  No posts from people you follow
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                  Follow more people to see their posts here
                </p>
                <button
                  onClick={() => setActiveTab('recent')}
                  className="px-4 py-2 bg-nexus-700 text-white rounded-lg hover:bg-nexus-600 transition-colors"
                >
                  Browse Recent Posts
                </button>
              </>
            ) : filters.timeRange && filters.timeRange !== 'all' ? (
              // Show filtered empty state
              <>
                <Clock size={48} className="mx-auto mb-4 text-gray-400 opacity-50" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  No posts found for{' '}
                  {filters.timeRange === 'day' && 'today'}
                  {filters.timeRange === 'week' && 'this week'}
                  {filters.timeRange === 'month' && 'this month'}
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                  Try selecting a different time range or check back later
                </p>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, timeRange: 'all' }))}
                  className="px-4 py-2 bg-nexus-700 text-white rounded-lg hover:bg-nexus-600 transition-colors"
                >
                  Show All Posts
                </button>
              </>
            ) : (
              // Show default empty state
              <>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No posts yet. Be the first to share something!
                </p>
                {onCreatePost && (
                  <button
                    onClick={onCreatePost}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Create Post
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {posts.map((post) => (
          <div 
            key={post.id} 
            id={`post-${post.id}`}
            className="rounded-lg overflow-hidden transition-all duration-300"
          >
            <PostCard
              post={post}
              currentUserId={user?.uid}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReport={handleReport}
              onAuthorClick={onAuthorClick}
              onProductClick={onProductClick}
              onHashtagClick={onHashtagClick}
              onImageClick={(postId) => {
                // Open Facebook-style image viewer for posts with images
                const clickedPost = posts.find(p => p.id === postId);
                if (clickedPost?.images && clickedPost.images.length > 0) {
                  setImageViewerModal({ postId, imageIndex: 0 });
                } else {
                  setPostDetailModal({ postId });
                }
              }}
            />
          </div>
        ))}

        {/* Load more trigger - Requirement 2.5 */}
        <div ref={loadMoreRef} className="h-10">
          {isLoadingMore && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm">
                Loading more posts...
              </span>
            </div>
          )}
        </div>

        {/* End of feed */}
        {!hasMore && posts.length > 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
            You've reached the end of the feed
          </div>
        )}
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        initialQuery={searchQuery}
      />

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <PostCreator
              onPostCreated={handleEditComplete}
              onCancel={() => setEditingPost(null)}
              initialContent={editingPost.content}
              taggedProducts={editingPost.taggedProducts}
              editMode={true}
              editPostId={editingPost.id}
              existingImages={editingPost.images}
            />
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {postDetailModal && (
        <PostDetailModal
          postId={postDetailModal.postId}
          commentId={postDetailModal.commentId}
          onClose={() => setPostDetailModal(null)}
          onPostUpdated={(updatedPost) => {
            setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
          }}
        />
      )}

      {/* Image Viewer Modal (Facebook-style) */}
      {imageViewerModal && (
        <ImageViewerModal
          postId={imageViewerModal.postId}
          initialImageIndex={imageViewerModal.imageIndex}
          onClose={() => setImageViewerModal(null)}
          onPostUpdated={(updatedPost) => {
            setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
          }}
        />
      )}
    </div>
  );
}
