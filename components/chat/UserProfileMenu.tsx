// User Profile Menu for Chat Avatars
import { MessageCircle, UserPlus, UserMinus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { sendFriendRequest, areFriends, removeFriend, hasPendingRequest, cancelFriendRequest } from '../../services/friendsService';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../../firebase.config';

interface UserProfileMenuProps {
  userId: string;
  userName: string;
  userPhoto: string;
  position: { x: number; y: number };
  onClose: () => void;
  onSendMessage: () => void;
  isCurrentUser: boolean;
}

export default function UserProfileMenu({
  userId,
  userName,
  userPhoto,
  position,
  onClose,
  onSendMessage,
  isCurrentUser
}: UserProfileMenuProps) {
  const { profileCache } = useAuth();
  
  // Check if user is online (within 90 seconds)
  const isUserOnline = (): boolean => {
    const profile = profileCache[userId];
    if (!profile || !profile.lastOnline) return false;
    const now = Date.now();
    const seconds = Math.floor((now - profile.lastOnline) / 1000);
    return profile.isOnline && seconds < 90;
  };

  // Format last active time
  const timeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Active just now';
    if (seconds < 3600) return `Active ${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `Active ${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `Active ${Math.floor(seconds / 86400)}d ago`;
    return `Active ${Math.floor(seconds / 604800)}w ago`;
  };

  const [isFriend, setIsFriend] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkFriendship = async () => {
      if (auth.currentUser) {
        const friends = await areFriends(auth.currentUser.uid, userId);
        setIsFriend(friends);
        
        if (!friends) {
          const requestId = await hasPendingRequest(auth.currentUser.uid, userId);
          setPendingRequestId(requestId);
        }
      }
    };
    checkFriendship();
  }, [userId]);

  const handleAddFriend = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await sendFriendRequest(auth.currentUser.uid, userId);
      const requestId = await hasPendingRequest(auth.currentUser.uid, userId);
      setPendingRequestId(requestId);
      toast.success('Friend request sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send friend request');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!auth.currentUser || !pendingRequestId) return;
    setLoading(true);
    try {
      await cancelFriendRequest(pendingRequestId, userId);
      setPendingRequestId(null);
      toast.success('Friend request cancelled');
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel request');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await removeFriend(auth.currentUser.uid, userId);
      setIsFriend(false);
      toast.success('Friend removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove friend');
    } finally {
      setLoading(false);
    }
  };
  
  if (isCurrentUser) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Menu */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[200px]"
        style={{ 
          left: `${position.x}px`, 
          top: `${position.y}px`,
          transform: 'translateY(-50%)'
        }}
      >
        {/* User Info */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="relative">
            <img
              src={userPhoto}
              alt={userName}
              className="w-10 h-10 rounded-full object-cover"
            />
            {isUserOnline() && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full z-10" title="Online"></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {userName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isUserOnline() ? 'Online now' : timeAgo(profileCache[userId]?.lastOnline || Date.now())}
            </p>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => {
            onSendMessage();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
        >
          <MessageCircle size={16} />
          Send Message
        </button>

        {isFriend ? (
          <button
            onClick={handleRemoveFriend}
            disabled={loading}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            <UserMinus size={16} className="text-red-500" />
            Remove Friend
          </button>
        ) : pendingRequestId ? (
          <button
            onClick={handleCancelRequest}
            disabled={loading}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            <X size={16} className="text-orange-500" />
            Cancel Request
          </button>
        ) : (
          <button
            onClick={handleAddFriend}
            disabled={loading}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            <UserPlus size={16} className="text-green-500" />
            Add Friend
          </button>
        )}
      </div>
    </>
  );
}
