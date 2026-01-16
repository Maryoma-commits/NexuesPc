import React, { useState, useEffect } from 'react';
import { CommunityModerationProvider, useModerationContext } from './CommunityModerationProvider';
import PostCard from './PostCard';
import CommentSystem from './CommentSystem';
import { Post } from '../../types/community-posts';
import { postService } from '../../services/postService';
import { useAuth } from '../../contexts/AuthContext';

interface CommunityFeedWithModerationProps {
  posts: Post[];
  onPostUpdate?: () => void;
}

const CommunityFeedContent: React.FC<CommunityFeedWithModerationProps> = ({ 
  posts, 
  onPostUpdate 
}) => {
  const { userProfile } = useAuth();
  const { reportPost, reportComment, blockUser } = useModerationContext();
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const handleReportPost = (postId: string) => {
    reportPost(postId);
  };

  const handleReportComment = (commentId: string) => {
    // For this example, we'll need to track which post the comment belongs to
    // In a real implementation, you'd pass the postId along with the commentId
    const postId = 'current-post-id'; // This should be dynamically determined
    reportComment(postId, commentId);
  };

  const handleBlockUser = (userId: string, userName: string) => {
    blockUser(userId, userName);
  };

  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
    }
    setExpandedComments(newExpanded);
  };

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div key={post.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <PostCard
            post={post}
            currentUserId={userProfile?.uid}
            onReport={handleReportPost}
            onComment={() => toggleComments(post.id)}
          />
          
          {expandedComments.has(post.id) && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <CommentSystem
                postId={post.id}
                postAuthorId={post.authorId}
                initialCommentCount={post.commentCount}
                onReportComment={handleReportComment}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const CommunityFeedWithModeration: React.FC<CommunityFeedWithModerationProps> = (props) => {
  return (
    <CommunityModerationProvider>
      <CommunityFeedContent {...props} />
    </CommunityModerationProvider>
  );
};