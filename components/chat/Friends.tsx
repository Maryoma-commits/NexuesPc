// Friends Component - Manage friends and friend requests
import { useState, useEffect } from 'react';
import { Users, UserPlus, Check, X, MessageCircle, UserMinus, Crown } from 'lucide-react';
import { auth } from '../../firebase.config';
import { useAuth } from '../../contexts/AuthContext';
import { 
  listenToFriendRequests, 
  listenToFriends, 
  acceptFriendRequest, 
  declineFriendRequest,
  removeFriend,
  FriendRequest 
} from '../../services/friendsService';
import toast from 'react-hot-toast';
import { ADMIN_UIDS } from '../../constants/adminConfig';

interface FriendsProps {
  onOpenDM: (userId: string) => void;
}

export default function Friends({ onOpenDM }: FriendsProps) {
  const { profileCache, getCachedProfile } = useAuth();
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeRequests = listenToFriendRequests(auth.currentUser.uid, (requests) => {
      setFriendRequests(requests);
      setLoading(false);
    });

    const unsubscribeFriends = listenToFriends(auth.currentUser.uid, (friendIds) => {
      setFriends(friendIds);
      // Fetch profiles for all friends
      friendIds.forEach(id => getCachedProfile(id));
      setLoading(false);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeFriends();
    };
  }, []);

  const handleAcceptRequest = async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request.id!, request.from, request.to);
      toast.success('Friend request accepted!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept request');
    }
  };

  const handleDeclineRequest = async (request: FriendRequest) => {
    try {
      await declineFriendRequest(request.id!, request.to);
      toast.success('Friend request declined');
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline request');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!auth.currentUser) return;
    try {
      await removeFriend(auth.currentUser.uid, friendId);
      toast.success('Friend removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove friend');
    }
  };

  // Check if user is online
  const isUserOnline = (userId: string): boolean => {
    const profile = profileCache[userId];
    if (!profile || !profile.lastOnline) return false;
    const now = Date.now();
    const seconds = Math.floor((now - profile.lastOnline) / 1000);
    return profile.isOnline && seconds < 90;
  };

  // Check if user is admin
  const isUserAdmin = (userId: string): boolean => {
    return ADMIN_UIDS.includes(userId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with Tabs */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'friends'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users size={18} />
              Friends ({friends.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors relative ${
              activeTab === 'requests'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <UserPlus size={18} />
              Requests
              {friendRequests.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {friendRequests.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {activeTab === 'friends' ? (
          // Friends List
          <div className="p-2">
            {friends.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No friends yet</p>
                <p className="text-sm">Add friends from Global Chat!</p>
              </div>
            ) : (
              friends.map((friendId) => {
                const profile = profileCache[friendId];
                const name = profile?.displayName || 'User';
                const photo = profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                
                return (
                  <div
                    key={friendId}
                    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-2 ${
                      isUserAdmin(friendId) ? 'border-l-4 border-yellow-500 bg-yellow-50/30 dark:bg-yellow-900/10' : ''
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={photo}
                        alt={name}
                        className={`w-12 h-12 rounded-full object-cover ${isUserAdmin(friendId) ? 'ring-2 ring-yellow-500' : ''}`}
                      />
                      {isUserOnline(friendId) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" title="Online"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {isUserAdmin(friendId) && (
                          <Crown size={10} className="text-yellow-500" title="Admin" />
                        )}
                        <p className="font-medium text-gray-900 dark:text-white truncate">{name}</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isUserOnline(friendId) ? 'Online now' : 'Offline'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onOpenDM(friendId)}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
                        title="Send Message"
                      >
                        <MessageCircle size={18} className="text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleRemoveFriend(friendId)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                        title="Remove Friend"
                      >
                        <UserMinus size={18} className="text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // Friend Requests
          <div className="p-2">
            {friendRequests.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <UserPlus size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No pending requests</p>
                <p className="text-sm">Friend requests will appear here</p>
              </div>
            ) : (
              friendRequests.map((request) => {
                const profile = profileCache[request.from];
                const name = profile?.displayName || 'User';
                const photo = profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                
                return (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-2"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={photo}
                        alt={name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Wants to be friends</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request)}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        title="Accept"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        title="Decline"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
