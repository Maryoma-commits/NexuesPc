// Global Chat Room Component
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Smile, MoreVertical, Flag, Trash2, Loader2, Reply, X, Heart } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase.config';
import { sendGlobalMessage, listenToGlobalChat, loadOlderGlobalMessages, deleteMessage, reportMessage, setGlobalTypingStatus, listenToGlobalTyping, toggleReaction, Message, TypingStatus } from '../../services/chatService';
import { getUserProfile, UserProfile } from '../../services/authService';
import UserProfileMenu from './UserProfileMenu';
import ReactionModal from './ReactionModal';
import Emoji from '../ui/Emoji';

interface GlobalChatProps {
  onNewMessage: () => void;
  onOpenDM?: (userId: string) => void;
}

export default function GlobalChat({ onNewMessage, onOpenDM }: GlobalChatProps) {
  const { userProfile: currentUserProfile, getCachedProfile, profileCache } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [inputDirection, setInputDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingStatus[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState<string | null>(null); // messageId of open picker
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ x: number; y: number } | null>(null);
  const [reactionModalOpen, setReactionModalOpen] = useState<{ messageId: string; reactions: { [emoji: string]: string[] } } | null>(null);
  const [fullEmojiPickerOpen, setFullEmojiPickerOpen] = useState<{ messageId: string; position: { x: number; y: number } } | null>(null);
  const [userMenu, setUserMenu] = useState<{ userId: string; userName: string; userPhoto: string; x: number; y: number } | null>(null);
  const [, setTick] = useState(0); // Force re-render for timestamp updates
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previousScrollHeight = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    let previousMessageCount = 0;
    let isFirstLoad = true;

    // Listen to messages
    const unsubscribe = listenToGlobalChat(async (msgs) => {
      // Check for new messages from others
      if (!isFirstLoad && msgs.length > previousMessageCount) {
        const newestMessage = msgs[msgs.length - 1];
        if (newestMessage.senderId !== auth.currentUser?.uid) {
          onNewMessage(); // New message from someone else
          
          // Auto-scroll if you're near the bottom (instant, no animation)
          // Check current scroll position in real-time
          const container = messagesContainerRef.current;
          if (container) {
            const scrolledToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
            if (scrolledToBottom) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
              }, 100);
            }
          }
        }
      }
      
      setMessages(msgs);
      previousMessageCount = msgs.length;
      
      // Extract unique user IDs and fetch their profiles from cache
      const uniqueUserIds = [...new Set(msgs.map(m => m.senderId))];
      await fetchUserProfiles(uniqueUserIds);
      
      // Only hide loading after profiles are fetched
      setMessagesLoading(false);
      
      // Scroll to bottom on initial load only
      if (isFirstLoad) {
        isFirstLoad = false;
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        }, 0);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to typing status
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = listenToGlobalTyping((users) => {
      // Filter out current user
      const otherUsers = users.filter(u => u.userId !== auth.currentUser?.uid);
      setTypingUsers(otherUsers);
      
      // Auto-scroll to show typing indicator if at bottom
      if (isAtBottom && otherUsers.length > 0) {
        setTimeout(() => scrollToBottom(), 100);
      }
    });

    return () => unsubscribe();
  }, [isAtBottom]);

  // Fetch user profiles using global cache
  const fetchUserProfiles = async (userIds: string[]) => {
    // Fetch all profiles in parallel using cached system
    await Promise.all(
      userIds.map(async (uid) => {
        await getCachedProfile(uid);
      })
    );
  };

  // Removed auto-scroll on message updates - user controls scroll position manually

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

  // Handle scroll to load older messages
  const handleScroll = async () => {
    const container = messagesContainerRef.current;
    if (!container || loadingOlder || !hasMoreMessages) return;

    // Check if user is at bottom (within 100px)
    const scrolledToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setIsAtBottom(scrolledToBottom);

    // Check if scrolled to top (within 50px)
    if (container.scrollTop < 50) {
      setLoadingOlder(true);
      const oldScrollHeight = container.scrollHeight;
      const oldScrollTop = container.scrollTop;

      try {
        // Get oldest message timestamp
        const oldestTimestamp = messages[0]?.timestamp;
        if (!oldestTimestamp) {
          setLoadingOlder(false);
          return;
        }

        // Load older messages
        const olderMessages = await loadOlderGlobalMessages(oldestTimestamp, 50);
        
        if (olderMessages.length === 0) {
          setHasMoreMessages(false);
          setLoadingOlder(false);
        } else {
          // Fetch profiles for new messages
          const uniqueUserIds = [...new Set(olderMessages.map(m => m.senderId))];
          await fetchUserProfiles(uniqueUserIds);
          
          // Prepend older messages
          setMessages(prev => [...olderMessages, ...prev]);
          
          // Restore scroll position immediately with multiple fallbacks
          requestAnimationFrame(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight;
              const heightDifference = newScrollHeight - oldScrollHeight;
              container.scrollTop = oldScrollTop + heightDifference;
              
              // Double-check after images/content loads
              requestAnimationFrame(() => {
                const finalScrollHeight = container.scrollHeight;
                const finalHeightDiff = finalScrollHeight - oldScrollHeight;
                container.scrollTop = oldScrollTop + finalHeightDiff;
                setLoadingOlder(false);
              });
            }
          });
        }
      } catch (error) {
        console.error('Error loading older messages:', error);
        setLoadingOlder(false);
      }
    }
  };

  // Detect text direction based on content (Arabic RTL, English LTR)
  const detectTextDirection = (text: string): 'ltr' | 'rtl' => {
    if (!text.trim()) return 'ltr';
    // Arabic Unicode range: \u0600-\u06FF, Hebrew: \u0590-\u05FF
    const rtlRegex = /[\u0600-\u06FF\u0590-\u05FF]/;
    return rtlRegex.test(text) ? 'rtl' : 'ltr';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Detect and set text direction
    setInputDirection(detectTextDirection(value));

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing status
    if (auth.currentUser && currentUserProfile) {
      setGlobalTypingStatus(auth.currentUser.uid, currentUserProfile.displayName, true);

      // Clear typing status after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (auth.currentUser && currentUserProfile) {
          setGlobalTypingStatus(auth.currentUser.uid, currentUserProfile.displayName, false);
        }
      }, 2000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || loading) return;

    setLoading(true);
    
    // Clear typing status
    if (currentUserProfile && auth.currentUser) {
      setGlobalTypingStatus(auth.currentUser.uid, currentUserProfile.displayName, false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      // Prepare reply data if replying
      const replyData = replyingTo ? {
        messageId: replyingTo.id!,
        text: replyingTo.text,
        senderId: replyingTo.senderId,
        senderName: profileCache[replyingTo.senderId]?.displayName || 'User'
      } : undefined;

      await sendGlobalMessage(auth.currentUser.uid, newMessage.trim(), replyData);
      setNewMessage('');
      setReplyingTo(null);
      setShowEmojiPicker(false);
      inputRef.current?.focus();
      
      // Auto-scroll to bottom when you send a message (instant)
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setContextMenu(null);
    inputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
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
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4"
      >
        {/* Loading older messages indicator */}
        {loadingOlder && (
          <div className="text-center py-2">
            <Loader2 className="inline-block animate-spin text-blue-600 dark:text-blue-400" size={20} />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading older messages...</span>
          </div>
        )}
        
        {/* No more messages indicator */}
        {!hasMoreMessages && messages.length > 0 && (
          <div className="text-center py-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">• Beginning of conversation •</span>
          </div>
        )}
        
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
            
            // Use current user profile from context if it's own message, otherwise use global cached profile
            const senderProfile = isOwnMessage ? currentUserProfile : profileCache[msg.senderId];
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
                <div className={`${isOwnMessage ? 'flex-1 min-w-0 flex flex-col items-end' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {isOwnMessage ? 'You' : senderName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  <div className="relative group inline-block">
                    <div className="relative inline-block">
                      <div
                        className={`
                          px-4 py-2 rounded-2xl max-w-sm break-words leading-relaxed
                          ${isOwnMessage
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none'
                          }
                        `}
                        style={{ 
                          wordBreak: 'break-word', 
                          overflowWrap: 'break-word', 
                          direction: 'rtl', 
                          textAlign: 'right',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                        }}
                      >
                        {/* Reply indicator */}
                        {msg.replyTo && (
                          <div className={`text-xs mb-2 pb-2 border-l-2 pl-2 ${isOwnMessage ? 'border-white/30' : 'border-gray-400 dark:border-gray-500'}`}>
                            <div className={`font-medium ${isOwnMessage ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'}`}>
                              Replying to {msg.replyTo.senderName}
                            </div>
                            <div className={`line-clamp-2 break-words ${isOwnMessage ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                              {msg.replyTo.text}
                            </div>
                          </div>
                        )}
                        {msg.text}
                      </div>

                      {/* Reactions Display - Overlapping message bubble like Facebook */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (() => {
                        // Calculate total reaction count
                        const totalReactions = Object.values(msg.reactions).reduce((sum, userIds) => sum + userIds.length, 0);
                        const uniqueEmojis = Object.keys(msg.reactions);
                        
                        return (
                          <button
                            onClick={() => {
                              // Click opens reaction modal to see who reacted
                              if (msg.id && msg.reactions) {
                                setReactionModalOpen({ messageId: msg.id, reactions: msg.reactions });
                              }
                            }}
                            className="absolute left-2 -bottom-3 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium transition-all hover:scale-105 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                            title={`${totalReactions} ${totalReactions === 1 ? 'reaction' : 'reactions'}`}
                          >
                            {/* Show all unique emojis */}
                            {uniqueEmojis.map(emoji => (
                              <Emoji key={emoji} emoji={emoji} size={16} />
                            ))}
                            
                            {/* Show count only if more than 1 total reaction */}
                            {totalReactions > 1 && (
                              <span className="text-gray-600 dark:text-gray-400 ml-1">
                                {totalReactions}
                              </span>
                            )}
                          </button>
                        );
                      })()}
                    </div>

                    {/* Action Buttons - Positioned absolutely relative to message bubble */}
                    <div className={`absolute ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'} bottom-0 opacity-0 group-hover:opacity-100 pointer-events-none z-10`}>
                      <div className="flex gap-1 pointer-events-auto mt-1">
                        <button
                          onClick={() => {
                            if (auth.currentUser && msg.id) {
                              toggleReaction(msg.id, '❤️', auth.currentUser.uid, true);
                            }
                          }}
                          className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors"
                          title="Like"
                        >
                          <Heart size={16} className="text-white" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (reactionPickerOpen === msg.id) {
                              setReactionPickerOpen(null);
                              setReactionPickerPosition(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setReactionPickerPosition({ x: rect.left, y: rect.top });
                              setReactionPickerOpen(msg.id!);
                            }
                          }}
                          className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors"
                          title="React"
                        >
                          <Smile size={16} className="text-white" />
                        </button>
                        <button
                          onClick={() => handleReply(msg)}
                          className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors"
                          title="Reply"
                        >
                          <Reply size={16} className="text-white" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ messageId: msg.id!, x: e.clientX, y: e.clientY });
                          }}
                          className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors"
                          title="More"
                        >
                          <MoreVertical size={16} className="text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing Indicator - Inside messages area like Facebook */}
        {typingUsers.length > 0 && isAtBottom && (
          <div className="flex gap-3 animate-fadeIn">
            {/* Avatars - show up to 3 typing users' avatars */}
            <div className="flex -space-x-2 flex-shrink-0">
              {typingUsers.slice(0, 3).map((typingUser) => {
                const userProfile = profileCache[typingUser.userId];
                const photoURL = userProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(typingUser.displayName)}&background=random`;
                return (
                  <div key={typingUser.userId} className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden border-2 border-white dark:border-gray-800">
                    <img src={photoURL} alt={typingUser.displayName} className="w-full h-full object-cover" />
                  </div>
                );
              })}
            </div>
            
            {/* Message content with name */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {typingUsers.length === 1
                    ? typingUsers[0].displayName
                    : typingUsers.length === 2
                    ? `${typingUsers[0].displayName} and ${typingUsers[1].displayName}`
                    : `${typingUsers[0].displayName} and ${typingUsers.length - 1} others`
                  }
                </span>
              </div>
              
              {/* Typing bubble */}
              <div className="inline-block px-4 py-2 rounded-2xl rounded-tl-none bg-gray-100 dark:bg-gray-700">
                <div className="flex gap-1">
                  <span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Bar */}
      {replyingTo && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Replying to {profileCache[replyingTo.senderId]?.displayName || 'User'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {replyingTo.text}
            </div>
          </div>
          <button
            onClick={handleCancelReply}
            className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Cancel reply"
          >
            <X size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type a message..."
              rows={1}
              dir={inputDirection}
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
                  emojiStyle="facebook"
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

      {/* Reaction Modal */}
      {reactionModalOpen && (
        <ReactionModal
          messageId={reactionModalOpen.messageId}
          reactions={reactionModalOpen.reactions}
          isGlobal={true}
          onClose={() => setReactionModalOpen(null)}
        />
      )}

      {/* Full Emoji Picker Portal */}
      {fullEmojiPickerOpen && createPortal(
        <>
          {/* Backdrop to close picker */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setFullEmojiPickerOpen(null)}
          />
          {/* Emoji Picker */}
          <div 
            className="fixed z-50"
            style={{
              left: `${fullEmojiPickerOpen.position.x}px`,
              top: `${fullEmojiPickerOpen.position.y - 450}px`, // 450px above button (picker height)
              transform: 'translateX(-50%)', // Center horizontally
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(emojiData: EmojiClickData) => {
                if (auth.currentUser && fullEmojiPickerOpen.messageId) {
                  toggleReaction(fullEmojiPickerOpen.messageId, emojiData.emoji, auth.currentUser.uid, true);
                  setFullEmojiPickerOpen(null);
                }
              }}
              theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
              height={400}
              width={350}
              emojiStyle="facebook"
              searchPlaceHolder="Search emoji..."
              previewConfig={{ showPreview: false }}
            />
          </div>
        </>,
        document.body
      )}

      {/* Reaction Picker Portal - Rendered outside to prevent clipping */}
      {reactionPickerOpen && reactionPickerPosition && createPortal(
        <>
          {/* Backdrop to close picker */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setReactionPickerOpen(null);
              setReactionPickerPosition(null);
            }}
          />
          {/* Reaction Picker */}
          <div 
            className="fixed z-50 bg-gray-800/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg flex gap-2 items-center"
            style={{
              left: `${reactionPickerPosition.x}px`,
              top: `${reactionPickerPosition.y - 50}px`, // 50px above button
              transform: 'translateX(-50%)', // Center horizontally
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {['❤️', '😂', '😮', '😢', '😡', '👍'].map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  if (auth.currentUser && reactionPickerOpen) {
                    toggleReaction(reactionPickerOpen, emoji, auth.currentUser.uid, true);
                    setReactionPickerOpen(null);
                    setReactionPickerPosition(null);
                  }
                }}
                className="hover:scale-125 transition-transform"
                title={`React with ${emoji}`}
              >
                <Emoji emoji={emoji} size={32} />
              </button>
            ))}
            {/* Plus button for more emojis */}
            <button
              onClick={(e) => {
                if (reactionPickerOpen && reactionPickerPosition) {
                  // Open full emoji picker at the same position
                  setFullEmojiPickerOpen({
                    messageId: reactionPickerOpen,
                    position: reactionPickerPosition
                  });
                  // Close quick reaction picker
                  setReactionPickerOpen(null);
                  setReactionPickerPosition(null);
                }
              }}
              className="w-8 h-8 rounded-full bg-gray-600 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-500 dark:hover:bg-gray-600 transition-all hover:scale-110 flex-shrink-0"
              title="More reactions"
            >
              <span className="text-white text-2xl font-normal leading-none">+</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
