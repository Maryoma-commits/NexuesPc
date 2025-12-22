// Global Chat Room Component
import { useState, useEffect, useRef } from 'react';
import { Send, Smile, MoreVertical, Flag, Trash2 } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { auth } from '../../firebase.config';
import { sendGlobalMessage, listenToGlobalChat, deleteMessage, reportMessage, Message } from '../../services/chatService';
import { getUserProfile, UserProfile } from '../../services/authService';
import UserProfileMenu from './UserProfileMenu';

interface GlobalChatProps {
  onNewMessage: () => void;
  onOpenDM?: (userId: string) => void;
}

export default function GlobalChat({ onNewMessage, onOpenDM }: GlobalChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userProfiles, setUserProfiles] = useState<{ [uid: string]: UserProfile }>({});
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [userMenu, setUserMenu] = useState<{ userId: string; userName: string; userPhoto: string; x: number; y: number } | null>(null);
  const [, setTick] = useState(0); // Force re-render for timestamp updates
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Load user profile
    getUserProfile(auth.currentUser.uid).then(setUserProfile);

    // Listen to messages
    const unsubscribe = listenToGlobalChat((msgs) => {
      setMessages(msgs);
      setMessagesLoading(false);
      onNewMessage();
      scrollToBottom();
      
      // Extract unique user IDs and fetch their profiles
      const uniqueUserIds = [...new Set(msgs.map(m => m.senderId))];
      fetchUserProfiles(uniqueUserIds);
    });

    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update timestamps every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || loading) return;

    setLoading(true);
    try {
      await sendGlobalMessage(auth.currentUser.uid, newMessage.trim());
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

  const handleDeleteMessage = async (messageId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteMessage(messageId, 'global');
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

  const handleAvatarClick = (e: React.MouseEvent, userId: string, userName: string, userPhoto: string) => {
    e.stopPropagation();
    if (userId === auth.currentUser?.uid) return; // Don't show menu for own avatar
    
    const rect = e.currentTarget.getBoundingClientRect();
    setUserMenu({
      userId,
      userName,
      userPhoto,
      x: rect.right + 10,
      y: rect.top + rect.height / 2
    });
  };

  const handleSendDirectMessage = (userId: string) => {
    if (onOpenDM) {
      onOpenDM(userId);
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {messagesLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-sm">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-lg mb-2">👋 Welcome to NexusPC Chat!</p>
            <p className="text-sm">Be the first to say hello!</p>
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
                {/* Avatar */}
                <img
                  src={senderPhoto}
                  alt={senderName}
                  onClick={(e) => handleAvatarClick(e, msg.senderId, senderName, senderPhoto)}
                  className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ${!isOwnMessage ? 'cursor-pointer hover:ring-2 hover:ring-blue-500' : ''}`}
                  title={!isOwnMessage ? 'Click for options' : ''}
                />

                {/* Message */}
                <div className={`flex-1 ${isOwnMessage ? 'flex flex-col items-end' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {isOwnMessage ? 'You' : senderName}
                    </span>
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

                    {/* Context Menu Button */}
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
            
            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
            >
              <Smile size={20} className="text-gray-500 dark:text-gray-400" />
            </button>

            {/* Emoji Picker */}
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

          {/* Send Button */}
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

      {/* User Profile Menu */}
      {userMenu && (
        <UserProfileMenu
          userId={userMenu.userId}
          userName={userMenu.userName}
          userPhoto={userMenu.userPhoto}
          position={{ x: userMenu.x, y: userMenu.y }}
          onClose={() => setUserMenu(null)}
          onSendMessage={() => handleSendDirectMessage(userMenu.userId)}
          isCurrentUser={userMenu.userId === auth.currentUser?.uid}
        />
      )}
    </div>
  );
}
