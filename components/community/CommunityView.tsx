// Community View Component for NexusPC
// Main container for the Community Posts feature
// Requirements: Integration with existing system

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import CommunityFeed from './CommunityFeed';
import PostCreator from './PostCreator';
import TrendingSidebar from './TrendingSidebar';
import { ProductReference } from '../../types/community-posts';

interface CommunityViewProps {
  onClose?: () => void;
  onProductClick?: (product: ProductReference) => void;
  openPostCreator?: boolean;
  onPostCreatorOpened?: () => void;
  scrollToPostId?: string;
  scrollToCommentId?: string;
  scrollTrigger?: number; // Timestamp to force re-scroll
}

export default function CommunityView({ 
  onClose, 
  onProductClick,
  openPostCreator,
  onPostCreatorOpened,
  scrollToPostId,
  scrollToCommentId,
  scrollTrigger
}: CommunityViewProps) {
  const { user } = useAuth();
  const [showPostCreator, setShowPostCreator] = useState(false);

  // Handle external trigger to open post creator
  useEffect(() => {
    if (openPostCreator && user) {
      setShowPostCreator(true);
      onPostCreatorOpened?.();
    }
  }, [openPostCreator, user, onPostCreatorOpened]);

  const handleCreatePost = () => {
    if (!user) {
      // TODO: Show login modal
      return;
    }
    setShowPostCreator(true);
  };

  const handlePostCreated = () => {
    setShowPostCreator(false);
    // Feed will automatically update via real-time listeners
  };

  const handleAuthorClick = (authorId: string) => {
    // TODO: Navigate to user profile
    console.log('Navigate to user profile:', authorId);
  };

  const handlePostClick = (postId: string) => {
    // TODO: Navigate to post detail view
    console.log('Navigate to post:', postId);
  };

  const handleHashtagClick = (hashtag: string) => {
    // TODO: Search for hashtag
    console.log('Search hashtag:', hashtag);
  };

  return (
    <div className="min-h-screen bg-nexus-950 text-gray-100">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Feed */}
          <div className="flex-1 min-w-0">
            <CommunityFeed
              onPostClick={handlePostClick}
              onAuthorClick={handleAuthorClick}
              onProductClick={onProductClick}
              onCreatePost={handleCreatePost}
              onHashtagClick={handleHashtagClick}
              scrollToPostId={scrollToPostId}
              scrollToCommentId={scrollToCommentId}
              scrollTrigger={scrollTrigger}
            />
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <TrendingSidebar />
            </div>
          </div>
        </div>
      </div>

      {/* Post Creator Modal */}
      {showPostCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <PostCreator
              onPostCreated={handlePostCreated}
              onCancel={() => setShowPostCreator(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}