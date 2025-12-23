import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { auth, database } from '../../firebase.config';
import { toggleReaction } from '../../services/chatService';
import Emoji from '../ui/Emoji';

interface ReactionModalProps {
  messageId: string;
  reactions: { [emoji: string]: string[] };
  isGlobal: boolean;
  conversationId?: string;
  onClose: () => void;
}

export default function ReactionModal({
  messageId,
  reactions: initialReactions,
  isGlobal,
  conversationId,
  onClose
}: ReactionModalProps) {
  const { getCachedProfile, profileCache } = useAuth();
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [reactions, setReactions] = useState(initialReactions);

  // Listen to real-time reaction updates
  useEffect(() => {
    const messagePath = isGlobal
      ? `globalChat/messages/${messageId}`
      : `directMessages/${conversationId}/messages/${messageId}`;
    
    const messageRef = ref(database, messagePath);
    
    const unsubscribe = onValue(messageRef, (snapshot) => {
      if (snapshot.exists()) {
        const message = snapshot.val();
        if (message.reactions) {
          setReactions(message.reactions);
        } else {
          // No reactions left - close modal
          onClose();
        }
      } else {
        // Message deleted - close modal
        onClose();
      }
    });

    return () => unsubscribe();
  }, [messageId, isGlobal, conversationId]);

  // Fetch all user profiles
  useEffect(() => {
    const allUserIds = new Set<string>();
    Object.values(reactions).forEach(userIds => {
      userIds.forEach(uid => allUserIds.add(uid));
    });
    
    // Fetch profiles for all users
    allUserIds.forEach(uid => getCachedProfile(uid));
  }, [reactions]);

  // Calculate total reactions
  const totalReactions = Object.values(reactions).reduce((sum, userIds) => sum + userIds.length, 0);
  const uniqueEmojis = Object.keys(reactions);

  // Get users for selected tab
  const getUsersForTab = () => {
    if (selectedTab === 'all') {
      // Show all users with their emoji
      const allUsers: { userId: string; emoji: string }[] = [];
      Object.entries(reactions).forEach(([emoji, userIds]) => {
        userIds.forEach(uid => allUsers.push({ userId: uid, emoji }));
      });
      return allUsers;
    } else {
      // Show users for specific emoji
      const userIds = reactions[selectedTab] || [];
      return userIds.map(uid => ({ userId: uid, emoji: selectedTab }));
    }
  };

  const usersToShow = getUsersForTab();

  const handleRemoveReaction = async (emoji: string) => {
    try {
      if (auth.currentUser) {
        await toggleReaction(messageId, emoji, auth.currentUser.uid, isGlobal, conversationId);
        // Modal will auto-update via Firebase real-time listener in useEffect
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Message reactions
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-4 border-b border-gray-200 dark:border-gray-700">
            {/* All tab */}
            <button
              onClick={() => setSelectedTab('all')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                selectedTab === 'all'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              All {totalReactions}
            </button>

            {/* Emoji tabs */}
            {uniqueEmojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => setSelectedTab(emoji)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 ${
                  selectedTab === emoji
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Emoji emoji={emoji} size={20} />
                <span>{reactions[emoji].length}</span>
              </button>
            ))}
          </div>

          {/* User List */}
          <div className="max-h-96 overflow-y-auto p-4">
            {usersToShow.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No reactions yet
              </p>
            ) : (
              <div className="space-y-2">
                {usersToShow.map(({ userId, emoji }) => {
                  const profile = profileCache[userId];
                  const displayName = profile?.displayName || 'Unknown User';
                  const photoURL = profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
                  const isCurrentUser = userId === auth.currentUser?.uid;

                  return (
                    <div
                      key={`${userId}-${emoji}`}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {/* Avatar */}
                        <img
                          src={photoURL}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        
                        {/* Name and action text */}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {displayName}
                          </p>
                          {isCurrentUser && (
                            <button
                              onClick={() => handleRemoveReaction(emoji)}
                              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                            >
                              Click to remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Emoji */}
                      <Emoji emoji={emoji} size={32} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
