// PostDetailModal - Opens a post in a modal with comments expanded
// Used when clicking on comment notifications (Facebook-style)
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { postService } from '../../services/postService';
import { Post } from '../../types/community-posts';
import PostCard from './PostCard';
import CommentSystem from './CommentSystem';
import { useAuth } from '../../contexts/AuthContext';

interface PostDetailModalProps {
  postId: string;
  commentId?: string; // Comment to scroll to and highlight
  onClose: () => void;
  onPostUpdated?: (post: Post) => void; // Callback when post is updated (like, comment count, etc.)
}

export default function PostDetailModal({ postId, commentId, onClose, onPostUpdated }: PostDetailModalProps) {
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the post
  useEffect(() => {
    const loadPost = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadedPost = await postService.getPost(postId);
        setPost(loadedPost);
      } catch (err: any) {
        console.error('Failed to load post:', err);
        setError('Failed to load post');
      } finally {
        setIsLoading(false);
      }
    };

    loadPost();
  }, [postId]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Reload post data to get latest counts when something changes
  const refreshPost = async () => {
    try {
      const updatedPost = await postService.getPost(postId);
      setPost(updatedPost);
      onPostUpdated?.(updatedPost);
    } catch (err) {
      console.error('Failed to refresh post:', err);
    }
  };

  // Handle comment count change
  const handleCommentCountChange = (count: number) => {
    if (post) {
      const updatedPost = { ...post, commentCount: count };
      setPost(updatedPost);
      onPostUpdated?.(updatedPost);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[700px] mx-4 bg-nexus-900 rounded-xl shadow-2xl overflow-hidden border border-white/10">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-nexus-900 border-b border-white/10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Post</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[80vh] overflow-y-auto" style={{ overflow: 'overlay' } as React.CSSProperties}>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          )}

          {error && (
            <div className="p-6 text-center">
              <p className="text-red-500">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          )}

          {!isLoading && !error && post && (
            <>
              {/* Post Card */}
              <PostCard
                post={post}
                currentUserId={user?.uid}
                onLike={refreshPost}
                onComment={() => {}}
                onShare={() => {}}
                isInsideModal={true}
              />

              {/* Comments - Always expanded */}
              <div className="border-t border-gray-200 dark:border-gray-700">
                <CommentSystem
                  postId={post.id}
                  postAuthorId={post.authorId}
                  initialCommentCount={post.commentCount}
                  scrollToCommentId={commentId}
                  scrollTrigger={Date.now()}
                  onCommentCountChange={handleCommentCountChange}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
