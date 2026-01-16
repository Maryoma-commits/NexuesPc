// Facebook-style Image Viewer Modal
// Shows image on left, post details + comments on right
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Post } from '../../types/community-posts';
import { postService } from '../../services/postService';
import { useAuth } from '../../contexts/AuthContext';
import PostCard from './PostCard';
import CommentSystem from './CommentSystem';

interface ImageViewerModalProps {
  postId: string;
  initialImageIndex?: number;
  onClose: () => void;
  onPostUpdated?: (post: Post) => void;
}

export default function ImageViewerModal({
  postId,
  initialImageIndex = 0,
  onClose,
  onPostUpdated
}: ImageViewerModalProps) {
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(initialImageIndex);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const fetchedPost = await postService.getPost(postId);
        setPost(fetchedPost);
      } catch (error) {
        console.error('Failed to fetch post:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [post?.images?.length]);

  const images = post?.images || [];

  const nextImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  const currentImage = images[currentImageIndex];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
      >
        <X size={24} />
      </button>

      {/* Left side - Image viewer (dark background) */}
      <div 
        className="flex-1 bg-black flex items-center justify-center relative overflow-hidden"
        onClick={(e) => {
          // Close modal when clicking on the background (not the image or buttons)
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Blurred background */}
        {currentImage && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ 
              backgroundImage: `url(${currentImage})`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              filter: 'blur(50px) brightness(0.3)',
              transform: 'scale(1.1)'
            }}
          />
        )}

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 z-20 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 z-20 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}

        {/* Main image */}
        {currentImage && (
          <img
            src={currentImage}
            alt={`Image ${currentImageIndex + 1}`}
            className="relative z-10 max-w-full max-h-full object-contain"
          />
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
            {currentImageIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Right side - Post details & comments */}
      <div className="w-[400px] bg-nexus-900 flex flex-col border-l border-white/10 overflow-hidden">
        {/* Post content (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {/* Post card without images */}
          <PostCard
            post={{ ...post, images: [] }}
            currentUserId={user?.uid}
            isInsideModal={true}
            onComment={() => {}}
          />
          
          {/* Comments section */}
          <div className="border-t border-white/10">
            <CommentSystem
              postId={post.id}
              postAuthorId={post.authorId}
              onCommentCountChange={(count) => {
                if (onPostUpdated) {
                  onPostUpdated({ ...post, commentCount: count });
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
