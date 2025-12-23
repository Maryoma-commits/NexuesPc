// Direct Messages Component
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Smile, ArrowLeft, MoreVertical, Flag, Trash2, Loader2, Reply, X, Heart, Trash } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth, database } from '../../firebase.config';
import { ref, onValue } from 'firebase/database';
import { 
  sendDirectMessage, 
  listenToDirectMessages,
  loadOlderDirectMessages,
  getUserConversations, 
  markConversationAsRead,
  deleteMessage,
  reportMessage,
  blockUser,
  isUserBlocked,
  setDMTypingStatus,
  listenToDMTyping,
  deleteConversationForUser,
  toggleReaction,
  Message,
  Conversation 
} from '../../services/chatService';
import { UserProfile } from '../../services/authService';
import ReactionModal from './ReactionModal';
import Emoji from '../ui/Emoji';

interface DirectMessagesProps {
  onNewMessage: () => void;
  preselectedUserId?: string | null;
  onClearPreselection?: () => void;
}

export default function DirectMessages({ onNewMessage, preselectedUserId, onClearPreselection }: DirectMessagesProps) {
  const { userProfile: currentUserProfile, getCachedProfile, profileCache } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [inputDirection, setInputDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [otherUserTypingName, setOtherUserTypingName] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState<string | null>(null); // messageId of open picker
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ x: number; y: number } | null>(null);
  const [reactionModalOpen, setReactionModalOpen] = useState<{ messageId: string; reactions: { [emoji: string]: string[] } } | null>(null);
  const [fullEmojiPickerOpen, setFullEmojiPickerOpen] = useState<{ messageId: string; position: { x: number; y: number } } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [deleteConfirmConvId, setDeleteConfirmConvId] = useState<string | null>(null);
  const [, setTick] = useState(0); // Force re-render for timestamp updates
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previousScrollHeight = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTime = useRef<number>(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    let previousConvCount = 0;
    let previousLastMessageTimes: { [key: string]: number } = {};

    // Load conversations
    const unsubscribe = getUserConversations(auth.currentUser.uid, (convs) => {
      setConversations(convs);
      
      // Check for new messages in conversations
      if (previousConvCount > 0) {
        convs.forEach(conv => {
          const prevTime = previousLastMessageTimes[conv.id] || 0;
          if (conv.lastMessageTime > prevTime) {
            // New message in this conversation
            // Check if it's not the currently selected conversation
            if (conv.id !== selectedConversation) {
              onNewMessage(); // Notify parent
            }
          }
        });
      }
      
      // Update tracking
      previousConvCount = convs.length;
      previousLastMessageTimes = {};
      convs.forEach(conv => {
        previousLastMessageTimes[conv.id] = conv.lastMessageTime;
      });
      
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
  }, [selectedConversation]);

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
      
      // Just fetch the profile for display, don't create conversation entry yet
      // Conversation will be created automatically when first message is sent
      getCachedProfile(preselectedUserId);
      
      if (onClearPreselection) {
        onClearPreselection();
      }
    }
  }, [preselectedUserId]);

  useEffect(() => {
    if (!selectedConversation || !auth.currentUser) return;

    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    // Reset state when switching conversations
    setHasMoreMessages(true);
    setLoadingOlder(false);
    setMessages([]); // Clear old messages
    
    let isFirstLoad = true; // Track if this is the first load for this conversation

    let previousMsgCount = 0;

    // Listen to messages
    const unsubscribe = listenToDirectMessages(auth.currentUser.uid, otherUserId, (msgs) => {
      // Check for new messages from others (not first load, not your own message)
      if (!isFirstLoad && msgs.length > previousMsgCount) {
        const newestMessage = msgs[msgs.length - 1];
        if (newestMessage.senderId !== auth.currentUser?.uid) {
          onNewMessage(); // New message from someone else
          
          // ✅ FIX: Mark as read immediately when you receive a message while viewing
          markConversationAsRead(selectedConversation, auth.currentUser.uid);
          
          // Auto-scroll if you're near the bottom (instant, no animation)
          // Check current scroll position in real-time
          const container = messagesContainerRef.current;
          if (container) {
            const scrolledToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
            if (scrolledToBottom) {
              setTimeout(() => scrollToBottom(true), 100);
            }
          }
        }
      }
      
      previousMsgCount = msgs.length;
      setMessages(msgs);
      
      // Extract unique user IDs and fetch their profiles
      const uniqueUserIds = [...new Set(msgs.map(m => m.senderId))];
      fetchUserProfiles(uniqueUserIds);
      
      // Scroll to bottom on first load (when opening conversation)
      if (isFirstLoad) {
        isFirstLoad = false; // Mark as loaded
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        }, 50);
      }
    });

    // Mark as read when opening conversation
    markConversationAsRead(selectedConversation, auth.currentUser.uid);

    // Listen to typing status
    const typingUnsubscribe = listenToDMTyping(auth.currentUser.uid, otherUserId, (isTyping, displayName) => {
      setIsOtherUserTyping(isTyping);
      setOtherUserTypingName(displayName);
      
      // Auto-scroll to show typing indicator if at bottom (instant)
      // Check current scroll position in real-time
      if (isTyping) {
        const container = messagesContainerRef.current;
        if (container) {
          const scrolledToBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
          if (scrolledToBottom) {
            setTimeout(() => scrollToBottom(true), 100);
          }
        }
      }
    });

    return () => {
      unsubscribe();
      typingUnsubscribe();
    };
  }, [selectedConversation]);

  // Fetch user profiles using global cache
  const fetchUserProfiles = async (userIds: string[]) => {
    // Fetch all profiles in parallel using cached system
    await Promise.all(
      userIds.map(async (uid) => {
        await getCachedProfile(uid);
      })
    );
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

  const scrollToBottom = (instant = false) => {
    const now = Date.now();
    // Prevent multiple scrolls within 300ms
    if (now - lastScrollTime.current < 300) {
      return;
    }
    lastScrollTime.current = now;
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  };

  // Handle scroll to load older messages
  const handleScroll = async () => {
    const container = messagesContainerRef.current;
    if (!container || loadingOlder || !hasMoreMessages || !selectedConversation) return;

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

        // Get other user ID
        const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
        if (!otherUserId) {
          setLoadingOlder(false);
          return;
        }

        // Load older messages
        const olderMessages = await loadOlderDirectMessages(auth.currentUser!.uid, otherUserId, oldestTimestamp, 50);
        
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

    if (!selectedConversation || !auth.currentUser || !currentUserProfile) return;

    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing status
    setDMTypingStatus(auth.currentUser.uid, otherUserId, currentUserProfile.displayName, true);

    // Clear typing status after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (auth.currentUser && currentUserProfile) {
        setDMTypingStatus(auth.currentUser.uid, otherUserId, currentUserProfile.displayName, false);
      }
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !currentUserProfile || !selectedConversation || loading) return;

    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    // Clear typing status
    setDMTypingStatus(auth.currentUser.uid, otherUserId, currentUserProfile.displayName, false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Check if user is blocked
    const blocked = await isUserBlocked(auth.currentUser.uid, otherUserId);
    if (blocked) {
      alert('You have blocked this user');
      return;
    }

    setLoading(true);
    try {
      // Prepare reply data if replying
      const replyData = replyingTo ? {
        messageId: replyingTo.id!,
        text: replyingTo.text,
        senderId: replyingTo.senderId,
        senderName: profileCache[replyingTo.senderId]?.displayName || 'User'
      } : undefined;

      await sendDirectMessage(auth.currentUser.uid, otherUserId, newMessage.trim(), replyData);
      setNewMessage('');
      setReplyingTo(null);
      setShowEmojiPicker(false);
      inputRef.current?.focus();
      
      // Auto-scroll to bottom when you send a message (instant)
      setTimeout(() => scrollToBottom(true), 100);
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

  const handleDeleteConversation = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the conversation
    setDeleteConfirmConvId(conversationId);
  };

  const confirmDeleteConversation = async () => {
    if (!auth.currentUser || !deleteConfirmConvId) return;
    
    try {
      await deleteConversationForUser(auth.currentUser.uid, deleteConfirmConvId);
      
      // If the deleted conversation is currently selected, clear selection
      if (selectedConversation === deleteConfirmConvId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      
      setDeleteConfirmConvId(null);
    } catch (error) {
      console.error('Error deleting conversation:', error);
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
    const profile = profileCache[otherUserId!];
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
      <>
        {/* Delete Confirmation Modal - Rendered via portal */}
        {deleteConfirmConvId && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Delete Conversation?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This will remove the conversation from your view only. The other person will still see it.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmConvId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteConversation}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
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
                    <div key={conv.id} className="relative group">
                      <button
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
                        <span className="text-xs text-gray-400 group-hover:opacity-0 transition-opacity">
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      </button>
                      
                      {/* Delete button - appears on hover, replaces timestamp */}
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500 bg-gray-200 dark:bg-gray-600 rounded-full transition-all"
                        title="Delete conversation"
                      >
                        <Trash size={16} className="text-gray-700 dark:text-white hover:text-white" />
                      </button>
                    </div>
                  );
                })
              )}
          </div>
        </div>
      </div>
      </>
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
          onClick={() => {
            // Mark as read before closing
            if (selectedConversation && auth.currentUser) {
              markConversationAsRead(selectedConversation, auth.currentUser.uid);
            }
            setSelectedConversation(null);
          }}
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
        
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-lg mb-2">👋 Start a conversation!</p>
            <p className="text-sm">Send your first message</p>
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
                <img
                  src={senderPhoto}
                  alt={senderName}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />

                <div className={`${isOwnMessage ? 'flex-1 min-w-0 flex flex-col items-end' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
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
                            if (auth.currentUser && msg.id && selectedConversation) {
                              toggleReaction(msg.id, '❤️', auth.currentUser.uid, false, selectedConversation);
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
        {isOtherUserTyping && isAtBottom && (
          <div className="flex gap-3 animate-fadeIn">
            {/* Avatar - use other user's avatar */}
            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {selectedConversation && (() => {
                const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
                const otherUserProfile = otherUserId ? profileCache[otherUserId] : null;
                const photoURL = otherUserProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUserTypingName)}&background=random`;
                return <img src={photoURL} alt={otherUserTypingName} className="w-full h-full object-cover" />;
              })()}
            </div>
            
            {/* Typing bubble */}
            <div className="inline-block px-4 py-2 rounded-2xl rounded-tl-none bg-gray-100 dark:bg-gray-700">
              <div className="flex items-center gap-2">
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
                  emojiStyle="facebook"
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

      {/* Delete Confirmation Modal - Rendered via portal */}
      {deleteConfirmConvId && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Delete Conversation?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This will remove the conversation from your view only. The other person will still see it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmConvId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteConversation}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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

      {/* Reaction Modal */}
      {reactionModalOpen && (
        <ReactionModal
          messageId={reactionModalOpen.messageId}
          reactions={reactionModalOpen.reactions}
          isGlobal={false}
          conversationId={selectedConversation || undefined}
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
                if (auth.currentUser && fullEmojiPickerOpen.messageId && selectedConversation) {
                  toggleReaction(fullEmojiPickerOpen.messageId, emojiData.emoji, auth.currentUser.uid, false, selectedConversation);
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
                  if (auth.currentUser && reactionPickerOpen && selectedConversation) {
                    toggleReaction(reactionPickerOpen, emoji, auth.currentUser.uid, false, selectedConversation);
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
