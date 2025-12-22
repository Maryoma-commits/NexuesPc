// Direct Messages Component
import { useState, useEffect, useRef } from 'react';
import { Send, Smile, ArrowLeft, Search, MoreVertical, Flag, Trash2 } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { auth, database } from '../../firebase.config';
import { ref, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { 
  sendDirectMessage, 
  listenToDirectMessages, 
  getUserConversations, 
  markConversationAsRead,
  deleteMessage,
  reportMessage,
  blockUser,
  isUserBlocked,
  Message,
  Conversation 
} from '../../services/chatService';
import { getUserProfile, UserProfile } from '../../services/authService';

interface DirectMessagesProps {
  onNewMessage: () => void;
  preselectedUserId?: string | null;
  onClearPreselection?: () => void;
}

export default function DirectMessages({ onNewMessage, preselectedUserId, onClearPreselection }: DirectMessagesProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userProfiles, setUserProfiles] = useState<{ [uid: string]: UserProfile }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [, setTick] = useState(0); // Force re-render for timestamp updates
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Load user profile
    getUserProfile(auth.currentUser.uid).then(setUserProfile);

    // Load conversations
    const unsubscribe = getUserConversations(auth.currentUser.uid, (convs) => {
      setConversations(convs);
      onNewMessage();
      
      // Extract all participant IDs and fetch their profiles
      const allParticipantIds = new Set<string>();
      convs.forEach(conv => {
        conv.participants.forEach(uid => {
          if (uid !== auth.currentUser?.uid) {
            allParticipantIds.add(uid);
          }
        });
      });
      
      if (allParticipantIds.size > 0) {
        fetchUserProfiles(Array.from(allParticipantIds));
      }
    });

    // Load all users for search
    loadAllUsers();

    return () => unsubscribe();
  }, []);

  // Update timestamps every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle preselected user (from Global Chat avatar click)
  useEffect(() => {
    if (preselectedUserId && auth.currentUser) {
      const conversationId = [auth.currentUser.uid, preselectedUserId].sort().join('_');
      setSelectedConversation(conversationId);
      
      // Load the other user's profile if conversation doesn't exist
      const existingConv = conversations.find(c => c.id === conversationId);
      if (!existingConv) {
        // Fetch user profile and add to conversations temporarily
        getUserProfile(preselectedUserId).then((profile) => {
          if (profile) {
            // Cache the profile
            setUserProfiles(prev => ({ ...prev, [preselectedUserId]: profile }));
            
            const tempConv: Conversation = {
              id: conversationId,
              participants: [auth.currentUser!.uid, preselectedUserId],
              lastMessage: '',
              lastMessageTime: Date.now(),
              unreadCount: {}
            };
            setConversations(prev => [tempConv, ...prev]);
          }
        });
      }
      
      if (onClearPreselection) {
        onClearPreselection();
      }
    }
  }, [preselectedUserId, conversations]);

  useEffect(() => {
    if (!selectedConversation || !auth.currentUser) return;

    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    // Listen to messages
    const unsubscribe = listenToDirectMessages(auth.currentUser.uid, otherUserId, (msgs) => {
      setMessages(msgs);
      scrollToBottom();
      
      // Extract unique user IDs and fetch their profiles
      const uniqueUserIds = [...new Set(msgs.map(m => m.senderId))];
      fetchUserProfiles(uniqueUserIds);
    });

    // Mark as read
    markConversationAsRead(selectedConversation, auth.currentUser.uid);

    return () => unsubscribe();
  }, [selectedConversation]);

  // Fetch user profiles for the given user IDs
  const fetchUserProfiles = async (userIds: string[]) => {
    const profiles: { [uid: string]: UserProfile } = {};
    
    for (const uid of userIds) {
      // Skip if already cached
      if (userProfiles[uid]) {
        profiles[uid] = userProfiles[uid];
        continue;
      }
      
      try {
        const profile = await getUserProfile(uid);
        if (profile) {
          profiles[uid] = profile;
        }
      } catch (error) {
        console.error(`Error fetching profile for ${uid}:`, error);
      }
    }
    
    setUserProfiles(prev => ({ ...prev, ...profiles }));
  };

  const loadAllUsers = async () => {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        if (user.uid !== auth.currentUser?.uid) {
          users.push(user);
        }
      });
      setAllUsers(users);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !userProfile || !selectedConversation || loading) return;

    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    // Check if user is blocked
    const blocked = await isUserBlocked(auth.currentUser.uid, otherUserId);
    if (blocked) {
      alert('You have blocked this user');
      return;
    }

    setLoading(true);
    try {
      await sendDirectMessage(auth.currentUser.uid, otherUserId, newMessage.trim());
      setNewMessage('');
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  const handleSelectUser = (userId: string) => {
    if (!auth.currentUser) return;
    const conversationId = [auth.currentUser.uid, userId].sort().join('_');
    setSelectedConversation(conversationId);
    setShowUserSearch(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!auth.currentUser || !selectedConversation) return;
    try {
      await deleteMessage(messageId, 'dm', selectedConversation);
      setContextMenu(null);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleReportMessage = async (messageId: string) => {
    if (!auth.currentUser) return;
    const reason = prompt('Why are you reporting this message?');
    if (!reason) return;

    try {
      await reportMessage(messageId, auth.currentUser.uid, reason);
      alert('Message reported. Thank you!');
      setContextMenu(null);
    } catch (error) {
      console.error('Error reporting message:', error);
    }
  };

  const handleBlockUser = async (userId: string) => {
    if (!auth.currentUser) return;
    if (!confirm('Are you sure you want to block this user?')) return;

    try {
      await blockUser(auth.currentUser.uid, userId);
      alert('User blocked successfully');
      setSelectedConversation(null);
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getOtherUser = (conversation: Conversation) => {
    const otherUserId = conversation.participants.find(id => id !== auth.currentUser?.uid);
    const profile = userProfiles[otherUserId!];
    return {
      id: otherUserId,
      name: profile?.displayName || 'User',
      photo: profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || 'User')}&background=random`
    };
  };

  const filteredUsers = allUsers.filter(user =>
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Conversation List View
  if (!selectedConversation) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Messages</h3>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-2">
            {conversations.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <p className="text-lg mb-2">💬 No conversations yet</p>
                <p className="text-sm">Start a chat from Global Chat!</p>
              </div>
            ) : (
                conversations.map((conv) => {
                  const otherUser = getOtherUser(conv);
                  const unreadCount = conv.unreadCount[auth.currentUser?.uid || ''] || 0;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <div className="relative">
                        <img
                          src={otherUser.photo}
                          alt={otherUser.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {otherUser.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {conv.lastMessage}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatTime(conv.lastMessageTime)}
                      </span>
                    </button>
                  );
                })
              )}
          </div>
        </div>
      </div>
    );
  }

  // Chat View
  const currentConv = conversations.find(c => c.id === selectedConversation);
  const otherUser = currentConv ? getOtherUser(currentConv) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <button
          onClick={() => setSelectedConversation(null)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        {otherUser && (
          <>
            <img
              src={otherUser.photo}
              alt={otherUser.name}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                {otherUser.name}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-lg mb-2">👋 Start a conversation!</p>
            <p className="text-sm">Send your first message</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.senderId === auth.currentUser?.uid;
            const senderProfile = userProfiles[msg.senderId];
            const senderName = senderProfile?.displayName || 'User';
            const senderPhoto = senderProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`;
            
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
              >
                <img
                  src={senderPhoto}
                  alt={senderName}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />

                <div className={`flex-1 ${isOwnMessage ? 'flex flex-col items-end' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  <div className="relative group">
                    <div
                      className={`
                        inline-block px-4 py-2 rounded-2xl max-w-xs break-words
                        ${isOwnMessage
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none'
                        }
                      `}
                    >
                      {msg.text}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({ messageId: msg.id!, x: e.clientX, y: e.clientY });
                      }}
                      className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                    >
                      <MoreVertical size={16} className="text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              style={{ maxHeight: '100px' }}
            />
            
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
            >
              <Smile size={20} className="text-gray-500 dark:text-gray-400" />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-10">
                <EmojiPicker 
                  onEmojiClick={handleEmojiClick}
                  theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                  height={400}
                  width={280}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </form>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[150px]"
            style={{ 
              right: window.innerWidth - contextMenu.x + 10,
              top: contextMenu.y,
              left: 'auto'
            }}
          >
            {messages.find(m => m.id === contextMenu.messageId)?.senderId === auth.currentUser?.uid && (
              <button
                onClick={() => handleDeleteMessage(contextMenu.messageId)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <button
              onClick={() => handleReportMessage(contextMenu.messageId)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <Flag size={16} />
              Report
            </button>
          </div>
        </>
      )}
    </div>
  );
}
