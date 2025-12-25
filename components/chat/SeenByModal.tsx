// Seen By Modal - Shows who viewed a message (Admin only)
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye } from 'lucide-react';
import { getSeenByUsers, Message } from '../../services/chatService';
import { getUserProfile, UserProfile } from '../../services/authService';

interface SeenByModalProps {
  message: Message;
  onClose: () => void;
}

interface SeenByUser {
  userId: string;
  timestamp: number;
  profile?: UserProfile;
}

export default function SeenByModal({ message, onClose }: SeenByModalProps) {
  const [seenByUsers, setSeenByUsers] = useState<SeenByUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeenByUsers();
  }, [message.id]);

  const loadSeenByUsers = async () => {
    setLoading(true);
    try {
      const seenBy = getSeenByUsers(message);
      
      // Fetch user profiles for each viewer
      const usersWithProfiles = await Promise.all(
        seenBy.map(async (seen) => {
          const profile = await getUserProfile(seen.userId);
          return {
            ...seen,
            profile: profile || undefined
          };
        })
      );

      // Sort by timestamp (most recent first)
      usersWithProfiles.sort((a, b) => b.timestamp - a.timestamp);
      setSeenByUsers(usersWithProfiles);
    } catch (error) {
      console.error('Failed to load seen by users:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Seen by {seenByUsers.length}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : seenByUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No one has seen this message yet
            </div>
          ) : (
            <div className="space-y-3">
              {seenByUsers.map((seen) => (
                <div
                  key={seen.userId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {/* Avatar */}
                  <img
                    src={seen.profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(seen.userId)}&background=random`}
                    alt={seen.profile?.displayName || 'User'}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  
                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {seen.profile?.displayName || 'Unknown User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimestamp(seen.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
