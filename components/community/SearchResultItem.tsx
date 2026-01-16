import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Image, Package } from 'lucide-react';
import { Post } from '../../types/community-posts';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase.config';

interface SearchResultItemProps {
  post: Post;
  onClick: (post: Post) => void;
  searchQuery?: string;
}

interface AuthorInfo {
  displayName: string;
  photoURL?: string;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({ post, onClick, searchQuery }) => {
  const [authorInfo, setAuthorInfo] = useState<AuthorInfo | null>(null);

  useEffect(() => {
    const fetchAuthorInfo = async () => {
      try {
        const userRef = ref(database, `users/${post.authorId}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setAuthorInfo({
            displayName: userData.displayName || userData.username || 'Unknown User',
            photoURL: userData.photoURL || userData.avatar
          });
        } else {
          setAuthorInfo({ displayName: 'Unknown User' });
        }
      } catch (error) {
        console.error('Failed to fetch author info:', error);
        setAuthorInfo({ displayName: 'Unknown User' });
      }
    };

    fetchAuthorInfo();
  }, [post.authorId]);
  // Truncate content for preview
  const maxLength = 120;
  const truncatedContent = post.content && post.content.length > maxLength 
    ? post.content.substring(0, maxLength) + '...' 
    : post.content || '';

  // Highlight search query in content
  const highlightText = (text: string, query?: string) => {
    if (!query || !text) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">{part}</mark>
        : part
    );
  };

  const images = post.images || [];
  const taggedProducts = post.taggedProducts || [];
  const likeCount = post.likeCount || 0;
  const commentCount = post.commentCount || 0;

  // Format relative time
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <button
      onClick={() => onClick(post)}
      className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        {images.length > 0 && (
          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img 
              src={images[0]} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Author and time */}
          <div className="flex items-center gap-2 mb-1">
            {authorInfo?.photoURL && (
              <img 
                src={authorInfo.photoURL} 
                alt="" 
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {authorInfo?.displayName || 'Loading...'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {getRelativeTime(post.createdAt)}
            </span>
          </div>

          {/* Preview text */}
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {highlightText(truncatedContent, searchQuery)}
          </p>

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-2">
            {/* Engagement stats */}
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5" />
                {likeCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                {commentCount}
              </span>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2">
              {images.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400">
                  <Image className="w-3.5 h-3.5" />
                  {images.length}
                </span>
              )}
              {taggedProducts.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-500 dark:text-green-400">
                  <Package className="w-3.5 h-3.5" />
                  {taggedProducts.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};
