import React, { useState, createContext, useContext } from 'react';
import { ReportModal } from './ReportModal';
import { BlockUserModal } from './BlockUserModal';

interface ModerationContextType {
  reportPost: (postId: string) => void;
  reportComment: (postId: string, commentId: string) => void;
  blockUser: (userId: string, userName: string) => void;
}

const ModerationContext = createContext<ModerationContextType | null>(null);

export const useModerationContext = () => {
  const context = useContext(ModerationContext);
  if (!context) {
    throw new Error('useModerationContext must be used within CommunityModerationProvider');
  }
  return context;
};

interface CommunityModerationProviderProps {
  children: React.ReactNode;
}

export const CommunityModerationProvider: React.FC<CommunityModerationProviderProps> = ({ children }) => {
  const [reportModal, setReportModal] = useState<{
    isOpen: boolean;
    postId?: string;
    commentId?: string;
    contentType: 'post' | 'comment';
  }>({
    isOpen: false,
    contentType: 'post'
  });

  const [blockModal, setBlockModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
  }>({
    isOpen: false,
    userId: '',
    userName: ''
  });

  const reportPost = (postId: string) => {
    setReportModal({
      isOpen: true,
      postId,
      contentType: 'post'
    });
  };

  const reportComment = (postId: string, commentId: string) => {
    setReportModal({
      isOpen: true,
      postId,
      commentId,
      contentType: 'comment'
    });
  };

  const blockUser = (userId: string, userName: string) => {
    setBlockModal({
      isOpen: true,
      userId,
      userName
    });
  };

  const closeReportModal = () => {
    setReportModal({
      isOpen: false,
      contentType: 'post'
    });
  };

  const closeBlockModal = () => {
    setBlockModal({
      isOpen: false,
      userId: '',
      userName: ''
    });
  };

  const contextValue: ModerationContextType = {
    reportPost,
    reportComment,
    blockUser
  };

  return (
    <ModerationContext.Provider value={contextValue}>
      {children}
      
      <ReportModal
        isOpen={reportModal.isOpen}
        onClose={closeReportModal}
        postId={reportModal.postId}
        commentId={reportModal.commentId}
        contentType={reportModal.contentType}
      />
      
      <BlockUserModal
        isOpen={blockModal.isOpen}
        onClose={closeBlockModal}
        userId={blockModal.userId}
        userName={blockModal.userName}
      />
    </ModerationContext.Provider>
  );
};