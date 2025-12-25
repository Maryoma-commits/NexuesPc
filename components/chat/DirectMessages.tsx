// Direct Messages Component
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Smile, ArrowLeft, MoreVertical, Flag, Trash2, Loader2, Reply, X, Heart, Trash, Check, Image as ImageIcon, Monitor, ThumbsUp, Crown } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { auth, database } from '../../firebase.config';
import { ref, onValue } from 'firebase/database';
import { 
  sendDirectMessage, 
  listenToDirectMessages,
  loadOlderDirectMessages,
  listenToConversation,
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
  uploadChatImage,
  Message,
  Conversation 
} from '../../services/chatService';
import { UserProfile } from '../../services/authService';
import ReactionModal from './ReactionModal';
import BuildShareModal from './BuildShareModal';
import BuildPreviewCard from './BuildPreviewCard';
import Emoji from '../ui/Emoji';
import { BuildData } from '../../services/chatService';
import { ADMIN_UIDS } from '../../constants/adminConfig';

interface DirectMessagesProps {
  onNewMessage: () => void;
  preselectedUserId?: string | null;
  onClearPreselection?: () => void;
  onConversationChange?: (conversationId: string | null) => void;
  onLoadBuild?: (buildData: BuildData) => void;
  isOpen?: boolean;
}

export default function DirectMessages({ onNewMessage, preselectedUserId, onClearPreselection, onConversationChange, onLoadBuild, isOpen = true }: DirectMessagesProps) {
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
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState<string | null>(null); // messageId of open picker
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ x: number; y: number } | null>(null);
  const [reactionModalOpen, setReactionModalOpen] = useState<{ messageId: string; reactions: { [emoji: string]: string[] } } | null>(null);
  const [fullEmojiPickerOpen, setFullEmojiPickerOpen] = useState<{ messageId: string; position: { x: number; y: number } } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [deleteConfirmConvId, setDeleteConfirmConvId] = useState<string | null>(null);
  const [currentConversationMetadata, setCurrentConversationMetadata] = useState<Conversation | null>(null);
  const [, setTick] = useState(0); // Force re-render for timestamp updates
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<string | null>(null);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTime = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Message cache: Store messages for each conversation to avoid loading flashes
  const messageCache = useRef<{ [conversationId: string]: Message[] }>({});
  const activeListeners = useRef<{ [conversationId: string]: () => void }>({});
  const selectedConversationRef = useRef<string | null>(null);

  // Check if user is online (within 90 seconds)
  const isUserOnline = (userId: string): boolean => {
    const profile = profileCache[userId];
    if (!profile || !profile.lastOnline) return false;
    const now = Date.now();
    const seconds = Math.floor((now - profile.lastOnline) / 1000);
    return profile.isOnline && seconds < 90;
  };

  // Check if a user is admin
  const isUserAdmin = (userId: string): boolean => {
    return ADMIN_UIDS.includes(userId);
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

  useEffect(() => {
    if (!auth.currentUser) return;
    let previousConvCount = 0;
    let previousLastMessageTimes: { [key: string]: number } = {};

    const unsubscribe = getUserConversations(auth.currentUser.uid, (convs) => {
      setConversations(convs);
      if (previousConvCount > 0) {
        convs.forEach(conv => {
          const prevTime = previousLastMessageTimes[conv.id] || 0;
          if (conv.lastMessageTime > prevTime && conv.id !== selectedConversation) {
            onNewMessage();
          }
        });
      }
      previousConvCount = convs.length;
      previousLastMessageTimes = {};
      convs.forEach(conv => { previousLastMessageTimes[conv.id] = conv.lastMessageTime; });
      const allParticipantIds = new Set<string>();
      convs.forEach(conv => conv.participants.forEach(uid => { if (uid !== auth.currentUser?.uid) allParticipantIds.add(uid); }));
      if (allParticipantIds.size > 0) fetchUserProfiles(Array.from(allParticipantIds));
    });
    loadAllUsers();
    return () => unsubscribe();
  }, [selectedConversation]);

  useEffect(() => {
    const interval = setInterval(() => setTick(prev => prev + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-send pending messages when connection returns
  useEffect(() => {
    const handleOnline = async () => {
      const pendingMessages = messages.filter(m => m.status === 'pending' && m.tempId);
      
      for (const msg of pendingMessages) {
        if (!auth.currentUser || !selectedConversation) continue;
        
        const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
        if (!otherUserId) continue;

        // Mark as sending
        setMessages(prev => prev.map(m => 
          m.tempId === msg.tempId ? { ...m, status: 'sent' } : m
        ));

        try {
          await sendDirectMessage(auth.currentUser.uid, otherUserId, msg.text, msg.replyTo);
          // Remove optimistic message (real one comes from Firebase)
          setMessages(prev => prev.filter(m => m.tempId !== msg.tempId));
        } catch (error) {
          // Keep as pending if still fails
          setMessages(prev => prev.map(m => 
            m.tempId === msg.tempId ? { ...m, status: 'pending' } : m
          ));
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [messages, selectedConversation]);

  useEffect(() => {
    if (preselectedUserId && auth.currentUser) {
      const conversationId = [auth.currentUser.uid, preselectedUserId].sort().join('_');
      setSelectedConversation(conversationId);
      getCachedProfile(preselectedUserId);
      if (onClearPreselection) onClearPreselection();
    }
  }, [preselectedUserId]);

  // Setup listeners for all conversations (keep them active in background)
  useEffect(() => {
    if (!auth.currentUser || conversations.length === 0) return;

    conversations.forEach((conv) => {
      const otherUserId = conv.participants.find(id => id !== auth.currentUser?.uid);
      if (!otherUserId || activeListeners.current[conv.id]) return; // Skip if listener already active

      let isFirstLoad = true;
      let previousMsgCount = 0;

      const unsubscribe = listenToDirectMessages(auth.currentUser!.uid, otherUserId, (msgs) => {
        // Cache messages for this conversation
        messageCache.current[conv.id] = msgs;

        // Always update displayed messages if this is the selected conversation
        // Use ref to check current selection (not closure)
        if (selectedConversationRef.current === conv.id) {
          setMessages(msgs);
        }
        
        if (!isFirstLoad && msgs.length > previousMsgCount) {
          const newestMessage = msgs[msgs.length - 1];
          if (newestMessage.senderId !== auth.currentUser?.uid) {
            onNewMessage();
            if (selectedConversationRef.current === conv.id) {
              // Mark as read immediately (instant for sender)
              const currentTime = Date.now();
              
              // Optimistic update: Immediately update local state
              setCurrentConversationMetadata(prev => prev ? {
                ...prev,
                lastReadTimestamp: {
                  ...prev.lastReadTimestamp,
                  [auth.currentUser!.uid]: currentTime
                }
              } : null);
              
              // Update Firebase (will propagate to sender)
              markConversationAsRead(conv.id, auth.currentUser!.uid);
            }
          }
        }

        previousMsgCount = msgs.length;
        const uniqueUserIds = [...new Set(msgs.map(m => m.senderId))];
        fetchUserProfiles(uniqueUserIds);
        isFirstLoad = false;
      });

      activeListeners.current[conv.id] = unsubscribe;
    });

    // Cleanup: Remove listeners for conversations that no longer exist
    return () => {
      const currentConvIds = new Set(conversations.map(c => c.id));
      Object.keys(activeListeners.current).forEach(convId => {
        if (!currentConvIds.has(convId)) {
          activeListeners.current[convId]?.();
          delete activeListeners.current[convId];
          delete messageCache.current[convId];
        }
      });
    };
  }, [conversations]);

  // Handle conversation selection (use cached messages immediately)
  useEffect(() => {
    if (!selectedConversation || !auth.currentUser) {
      onConversationChange?.(null);
      return;
    }
    
    // Update ref so listeners can access current selection
    selectedConversationRef.current = selectedConversation;
    
    // Notify parent component about conversation change
    onConversationChange?.(selectedConversation);
    
    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    // Load cached messages immediately (no loading flash)
    if (messageCache.current[selectedConversation]) {
      setMessages(messageCache.current[selectedConversation]);
    } else {
      setMessages([]); // First time loading this conversation
    }

    setHasMoreMessages(true);
    setLoadingOlder(false);

    // Optimistic update: Immediately update local state
    setCurrentConversationMetadata(prev => prev ? {
      ...prev,
      lastReadTimestamp: {
        ...prev.lastReadTimestamp,
        [auth.currentUser.uid]: Date.now()
      }
    } : null);
    // Then update Firebase in background (only if chat is open)
    if (isOpen) {
      markConversationAsRead(selectedConversation, auth.currentUser.uid);
    }
    
    const readInterval = setInterval(() => {
      if (isOpen && !document.hidden && document.hasFocus() && selectedConversation && auth.currentUser) {
        markConversationAsRead(selectedConversation, auth.currentUser.uid);
      }
    }, 3000);

    const onFocus = () => {
      if (isOpen && !document.hidden && selectedConversation && auth.currentUser) {
        markConversationAsRead(selectedConversation, auth.currentUser.uid);
      }
    };
    window.addEventListener('focus', onFocus);
    
    const onVisibilityChange = () => {
      if (!document.hidden && isOpen && selectedConversation && auth.currentUser) {
        markConversationAsRead(selectedConversation, auth.currentUser.uid);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const convUnsubscribe = listenToConversation(selectedConversation, (conv) => setCurrentConversationMetadata(conv));
    const typingUnsubscribe = listenToDMTyping(auth.currentUser.uid, otherUserId, (isTyping, displayName) => {
      setIsOtherUserTyping(isTyping);
      setOtherUserTypingName(displayName);
    });

    return () => {
      convUnsubscribe();
      typingUnsubscribe();
      clearInterval(readInterval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [selectedConversation]);

  const fetchUserProfiles = async (userIds: string[]) => {
    await Promise.all(userIds.map(uid => getCachedProfile(uid)));
  };

  const loadAllUsers = async () => {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        if (user.uid !== auth.currentUser?.uid) users.push(user);
      });
      setAllUsers(users);
    });
  };

  const scrollToBottom = (instant = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (instant) {
      container.scrollTop = 0; // Reversed
      return;
    }
    const now = Date.now();
    if (now - lastScrollTime.current < 300) return;
    lastScrollTime.current = now;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = async () => {
    const container = messagesContainerRef.current;
    if (!container || loadingOlder || !hasMoreMessages || !selectedConversation) return;

    const isAtBottom = container.scrollTop > -50;
    setIsAtBottom(isAtBottom);

    const scrollFromBottom = Math.abs(container.scrollTop);
    const scrollLimit = container.scrollHeight - container.clientHeight;
    
    if (scrollFromBottom > scrollLimit - 100) {
      setLoadingOlder(true);
      try {
        const oldestTimestamp = messages[0]?.timestamp;
        if (!oldestTimestamp) {
          setLoadingOlder(false);
          return;
        }
        const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
        if (!otherUserId) {
          setLoadingOlder(false);
          return;
        }
        const olderMessages = await loadOlderDirectMessages(auth.currentUser!.uid, otherUserId, oldestTimestamp, 50);
        if (olderMessages.length === 0) {
          setHasMoreMessages(false);
        } else {
          const uniqueUserIds = [...new Set(olderMessages.map(m => m.senderId))];
          await fetchUserProfiles(uniqueUserIds);
          setMessages(prev => [...olderMessages, ...prev]);
        }
      } catch (error) {
        toast.error('Failed to load older messages');
      } finally {
        setLoadingOlder(false);
      }
    }
  };

  const detectTextDirection = (text: string): 'ltr' | 'rtl' => {
    if (!text.trim()) return 'ltr';
    const rtlRegex = /[\u0600-\u06FF\u0590-\u05FF]/;
    return rtlRegex.test(text) ? 'rtl' : 'ltr';
  };

  const triggerTypingStatus = () => {
    if (!selectedConversation || !auth.currentUser || !currentUserProfile) return;
    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setDMTypingStatus(auth.currentUser.uid, otherUserId, currentUserProfile.displayName, true);
    typingTimeoutRef.current = setTimeout(() => {
      if (auth.currentUser && currentUserProfile) {
        setDMTypingStatus(auth.currentUser.uid, otherUserId, currentUserProfile.displayName, false);
      }
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    setInputDirection(detectTextDirection(value));
    triggerTypingStatus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
      setImageFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleCancelImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendImage = async () => {
    if (!imageFile || !auth.currentUser || !selectedConversation) return;

    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    setUploadingImage(true);
    try {
      const imageUrl = await uploadChatImage(imageFile);
      
      const messageText = newMessage.trim() || '';
      const replyData = replyingTo ? { messageId: replyingTo.id!, text: replyingTo.text, senderId: replyingTo.senderId, senderName: profileCache[replyingTo.senderId]?.displayName || 'User' } : undefined;

      await sendDirectMessage(auth.currentUser.uid, otherUserId, messageText, replyData, imageUrl);
      
      setNewMessage('');
      setReplyingTo(null);
      setImagePreview(null);
      setImageFile(null);
      setShowEmojiPicker(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast.success('Image sent');
      scrollToBottom(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (imagePreview && imageFile) {
      await handleSendImage();
      return;
    }
    
    // If no text, send thumbs up emoji
    if (!newMessage.trim()) {
      if (!auth.currentUser || !selectedConversation || loading) return;
      
      const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
      if (!otherUserId) return;
      
      const messageText = 'ðŸ‘';
      const replyData = replyingTo ? {
        messageId: replyingTo.id!,
        text: replyingTo.text,
        senderId: replyingTo.senderId,
        senderName: profileCache[replyingTo.senderId]?.displayName || 'User'
      } : undefined;

      try {
        setLoading(true);
        await sendDirectMessage(auth.currentUser.uid, otherUserId, messageText, replyData);
        setReplyingTo(null);
        onNewMessage();
      } catch (error: any) {
        toast.error(error.message || 'Failed to send message');
      } finally {
        setLoading(false);
      }
      return;
    }
    
    if (!auth.currentUser || !currentUserProfile || !selectedConversation || loading) return;
    
    const otherUserId = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
    if (!otherUserId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setDMTypingStatus(auth.currentUser.uid, otherUserId, currentUserProfile.displayName, false);

    const blocked = await isUserBlocked(auth.currentUser.uid, otherUserId);
    if (blocked) { 
      toast.error('You have blocked this user'); 
      return; 
    }
    
    // Store message text and reply data
    const messageText = newMessage.trim();
    const replyData = replyingTo ? { messageId: replyingTo.id!, text: replyingTo.text, senderId: replyingTo.senderId, senderName: profileCache[replyingTo.senderId]?.displayName || 'User' } : undefined;
    
    // Check if offline - mark as pending (will auto-send when online)
    const isOffline = !navigator.onLine;
    
    // Create optimistic message (shows immediately)
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      tempId,
      text: messageText,
      senderId: auth.currentUser.uid,
      timestamp: Date.now(),
      type: 'dm',
      recipientId: otherUserId,
      replyTo: replyData,
      status: isOffline ? 'pending' : 'sent'
    };
    
    // Add to messages immediately
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Clear input immediately for better UX
    setNewMessage('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setLoading(true);
    scrollToBottom(true);
    
    // If offline, don't send yet - will auto-send when online
    if (isOffline) {
      setLoading(false);
      return;
    }
    
    try {
      await sendDirectMessage(auth.currentUser.uid, otherUserId, messageText, replyData, undefined);
      // Remove optimistic message (real one will come from Firebase listener)
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
      inputRef.current?.focus();
    } catch (error: any) {
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
      // Show error toast
      toast.error(error.message || 'Failed to send message');
    } finally { 
      setLoading(false); 
    }
  };

  const handleReply = (message: Message) => { setReplyingTo(message); setContextMenu(null); inputRef.current?.focus(); };
  const handleCancelReply = () => setReplyingTo(null);
  const handleDeleteConversation = (conversationId: string, e: React.MouseEvent) => { e.stopPropagation(); setDeleteConfirmConvId(conversationId); };
  const confirmDeleteConversation = async () => {
    if (!auth.currentUser || !deleteConfirmConvId) return;
    try {
      await deleteConversationForUser(auth.currentUser.uid, deleteConfirmConvId);
      if (selectedConversation === deleteConfirmConvId) { setSelectedConversation(null); setMessages([]); }
      setDeleteConfirmConvId(null);
      toast.success('Conversation deleted');
    } catch (error) { 
      toast.error('Failed to delete conversation. Please try again.');
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => { 
    setNewMessage(prev => prev + emojiData.emoji); 
    triggerTypingStatus();
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
      toast.success('Message deleted');
    } catch (error) { 
      toast.error('Failed to delete message. Please try again.');
    }
  };

  const handleReportMessage = async (messageId: string) => {
    if (!auth.currentUser) return;
    const reason = prompt('Why are you reporting this message?');
    if (!reason) return;
    try { 
      await reportMessage(messageId, auth.currentUser.uid, reason); 
      toast.success('Message reported. Thank you!'); 
      setContextMenu(null); 
    } catch (error) { 
      toast.error('Failed to report message. Please try again.');
    }
  };

  const handleShareBuild = async (buildData: BuildData, caption: string) => {
    if (!auth.currentUser || !selectedConversation) return;
    
    try {
      setLoading(true);
      const otherUserId = selectedConversation.replace(auth.currentUser.uid, '').replace('_', '');
      
      await sendDirectMessage(
        auth.currentUser.uid,
        otherUserId,
        caption,
        replyingTo ? {
          messageId: replyingTo.id!,
          text: replyingTo.text,
          senderId: replyingTo.senderId,
          senderName: profileCache[replyingTo.senderId]?.displayName || 'User'
        } : undefined,
        undefined, // no imageUrl
        buildData // pass build data
      );
      
      setReplyingTo(null);
      onNewMessage();
      toast.success('PC Build shared!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to share build');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (userId: string) => {
    if (!auth.currentUser) return;
    if (!confirm('Are you sure you want to block this user?')) return;
    try { 
      await blockUser(auth.currentUser.uid, userId); 
      toast.success('User blocked successfully'); 
      setSelectedConversation(null); 
    } catch (error) { 
      toast.error('Failed to block user. Please try again.');
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

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    } else { alert('Message is too old to view or has been deleted'); }
  };

  const getOtherUser = (conversation: Conversation) => {
    const otherUserId = conversation.participants.find(id => id !== auth.currentUser?.uid);
    const profile = profileCache[otherUserId!];
    return { id: otherUserId, name: profile?.displayName || 'User', photo: profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || 'User')}&background=random` };
  };

  const otherUserIdMetadata = selectedConversation?.split('_').find(id => id !== auth.currentUser?.uid);
  const otherUserLastRead = currentConversationMetadata?.lastReadTimestamp?.[otherUserIdMetadata || ''] || 0;
  const lastSeenMessageId = messages.length > 0 ? [...messages].reverse().find(m => m.senderId === auth.currentUser?.uid && m.timestamp <= otherUserLastRead)?.id : null;

  if (!selectedConversation) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {deleteConfirmConvId && createPortal(<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"><div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4"><h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Delete Conversation?</h3><p className="text-sm text-gray-600 dark:text-gray-400 mb-6">This will remove the conversation from your view only. The other person will still see it.</p><div className="flex gap-3"><button onClick={() => setDeleteConfirmConvId(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white">Cancel</button><button onClick={confirmDeleteConversation} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button></div></div></div>, document.body)}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Messages</h3></div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="p-2">
            {conversations.length === 0 ? (<div className="text-center text-gray-500 dark:text-gray-400 py-8"><p className="text-lg mb-2">ðŸ’¬ No conversations yet</p><p className="text-sm">Start a chat from Global Chat!</p></div>) : (
              conversations.map((conv) => {
                const ou = getOtherUser(conv);
                const unreadCount = conv.unreadCount[auth.currentUser?.uid || ''] || 0;
                return (
                  <div key={conv.id} className="relative group">
                    <button 
                      onClick={() => setSelectedConversation(conv.id)} 
                      className={`w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ${isUserAdmin(ou.id) ? 'border-l-4 border-yellow-500 bg-yellow-50/30 dark:bg-yellow-900/10' : ''}`}
                    >
                      <div className="relative">
                        <img src={ou.photo} alt={ou.name} className="w-12 h-12 rounded-full object-cover" />
                        {isUserOnline(ou.id) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" title="Online"></div>
                        )}
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-1">
                          {isUserAdmin(ou.id) && (
                            <Crown size={10} className="text-yellow-500" title="Admin" />
                          )}
                          <span 
                            className={`font-medium ${isUserAdmin(ou.id) ? '' : 'text-gray-900 dark:text-white'}`}
                            style={isUserAdmin(ou.id) ? {
                              background: 'linear-gradient(90deg, #7835F7, #A855F7, #EAB308, #FCD34D, #EAB308, #A855F7, #7835F7)',
                              backgroundSize: '200% auto',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              animation: 'gradientShift 4s ease-in-out infinite',
                              fontWeight: 600
                            } : {}}
                          >
                            {ou.name}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.lastMessage}</p>
                      </div>
                      <span className="text-xs text-gray-400 group-hover:opacity-0 transition-opacity">
                        {formatTime(conv.lastMessageTime)}
                      </span>
                    </button>
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
    );
  }

  const otherUser = conversations.find(c => c.id === selectedConversation) ? getOtherUser(conversations.find(c => c.id === selectedConversation)!) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <button onClick={() => { if (selectedConversation && auth.currentUser) markConversationAsRead(selectedConversation, auth.currentUser.uid); setSelectedConversation(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"><ArrowLeft size={20} /></button>
        {otherUser && (
          <>
            <div className="relative flex-shrink-0">
              <img src={otherUser.photo} alt={otherUser.name} className="w-10 h-10 rounded-full object-cover" />
              {isUserOnline(otherUser.id) && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full z-10" title="Online"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1">
                {isUserAdmin(otherUser.id) && (
                  <Crown size={14} className="text-yellow-500" title="Admin" />
                )}
                <span 
                  className={`font-medium ${isUserAdmin(otherUser.id) ? '' : 'text-gray-900 dark:text-white'}`}
                  style={isUserAdmin(otherUser.id) ? {
                    background: 'linear-gradient(90deg, #7835F7, #A855F7, #EAB308, #FCD34D, #EAB308, #A855F7, #7835F7)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animation: 'gradientShift 4s ease-in-out infinite',
                    fontWeight: 600
                  } : {}}
                >
                  {otherUser.name}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isUserOnline(otherUser.id) ? 'Online now' : timeAgo(profileCache[otherUser.id]?.lastOnline || Date.now())}
              </p>
            </div>
          </>
        )}
      </div>

      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 space-y-4 space-y-reverse flex flex-col-reverse">
        <div ref={messagesEndRef} />

        {isOtherUserTyping && (
          <div className="flex gap-3 animate-fadeIn mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {selectedConversation && (() => {
                const oid = selectedConversation.split('_').find(id => id !== auth.currentUser?.uid);
                const op = oid ? profileCache[oid] : null;
                const purl = op?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUserTypingName)}&background=random`;
                return <img src={purl} alt={otherUserTypingName} className="w-full h-full object-cover" />;
              })()}
            </div>
            <div className="inline-block px-4 py-2 rounded-2xl rounded-tl-none bg-gray-100 dark:bg-gray-700"><div className="flex items-center gap-2"><div className="flex gap-1"><span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span><span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span><span className="inline-block w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span></div></div></div>
          </div>
        )}

        {[...messages].reverse().map((msg) => {
            const isOwn = msg.senderId === auth.currentUser?.uid;
            const sp = isOwn ? currentUserProfile : profileCache[msg.senderId];
            const sn = sp?.displayName || 'User';
            const sph = sp?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(sn)}&background=random`;
            const isHighlighted = highlightedMessageId === msg.id;
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`flex gap-3 transition-all duration-500 ${isOwn ? 'flex-row-reverse' : ''} ${msg.reactions && Object.keys(msg.reactions).length > 0 ? 'mb-4' : 'mb-1'} ${isHighlighted ? 'bg-blue-500/20 rounded-lg p-2 ring-2 ring-blue-500 ring-opacity-50 scale-[1.02]' : ''}`}>
                <div className="flex-shrink-0">
                  <div className="relative">
                    <img src={sph} alt={sn} className={`w-8 h-8 rounded-full object-cover ${isUserAdmin(msg.senderId) ? 'ring-2 ring-yellow-500' : ''}`} />
                    {isUserOnline(msg.senderId) && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" title="Online"></div>
                    )}
                  </div>
                </div>
                <div className={`${isOwn ? 'flex-1 min-w-0 flex flex-col items-end' : 'flex-1 min-w-0 flex flex-col items-start'}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {!isOwn && isUserAdmin(msg.senderId) && (
                      <Crown size={12} className="text-yellow-500" title="Admin" />
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="relative group inline-block">
                    <div className="relative overflow-visible flex flex-col">
                      {msg.replyTo && (<button onClick={() => scrollToMessage(msg.replyTo!.messageId)} className={`px-3 pt-2 pb-3 text-[13px] line-clamp-1 max-w-sm bg-[#3E4042] text-gray-300 hover:bg-[#4E5052] transition-colors rounded-[18px] mb-[-10px] relative z-0 opacity-80 cursor-pointer`} style={{ direction: detectTextDirection(msg.replyTo.text), textAlign: detectTextDirection(msg.replyTo.text) === 'rtl' ? 'right' : 'left' }}>{msg.replyTo.text}</button>)}
                      {msg.text && (
                        <div className={`${msg.imageUrl ? 'mb-2' : ''} ${isOwn ? 'flex justify-end' : ''}`}>
                          <div 
                            className={`px-3 py-2 max-w-[212px] break-words leading-relaxed shadow-md relative z-10 rounded-[18px] inline-block ${isOwn ? 'bg-[#7835F7] text-white' : isUserAdmin(msg.senderId) ? 'bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-white border border-yellow-500' : 'bg-gray-200 dark:bg-[#3E4042] text-gray-900 dark:text-white'}`} 
                            style={{ 
                              wordBreak: 'break-word', 
                              overflowWrap: 'break-word', 
                              direction: detectTextDirection(msg.text), 
                              textAlign: detectTextDirection(msg.text) === 'rtl' ? 'right' : 'left', 
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                              ...(isUserAdmin(msg.senderId) && !isOwn ? { boxShadow: '0 0 10px rgba(234, 179, 8, 0.3)' } : {})
                            }}
                          >
                            {msg.text}
                          </div>
                        </div>
                      )}
                      {msg.imageUrl && (
                        <div className={`relative max-w-[180px] overflow-hidden rounded-[18px] ${msg.buildData ? 'mb-2' : ''} ${isOwn ? 'ml-auto' : 'mr-auto'}`}>
                          <img 
                            src={msg.imageUrl} 
                            alt="Shared image"
                            onClick={() => setImageLightbox(msg.imageUrl!)}
                            className="w-full h-auto max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity rounded-[18px]"
                          />
                        </div>
                      )}
                      {msg.buildData && (
                        <div className="relative">
                          <BuildPreviewCard 
                            buildData={msg.buildData} 
                            isSender={isOwn}
                            onLoadBuild={onLoadBuild}
                          />
                        </div>
                      )}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (() => {
                        const tr = Object.values(msg.reactions).reduce((sum, uids) => sum + uids.length, 0);
                        const ue = Object.keys(msg.reactions);
                        return (
                          <button onClick={() => { if (msg.id && msg.reactions) setReactionModalOpen({ messageId: msg.id, reactions: msg.reactions }); }} className={`absolute ${isOwn ? 'right-0' : 'left-0'} -bottom-3 flex items-center gap-[5px] pl-1 pr-1.5 py-0.5 rounded-full transition-all hover:scale-110 bg-[#3E4043] shadow-md z-10 w-max`} title={`${tr} reactions`}><div className="flex items-center gap-0 flex-shrink-0">{ue.map(e => (<div key={e} className="flex-shrink-0"><Emoji emoji={e} size={16} /></div>))}</div>{tr > 1 && (<span className="text-white text-[12px] font-normal leading-none flex-shrink-0">{tr}</span>)}</button>
                        );
                      })()}
                      <div className={`absolute ${isOwn ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 ${(reactionPickerOpen === msg.id || fullEmojiPickerOpen?.messageId === msg.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} pointer-events-none z-10`}>
                        <div className="flex gap-1 pointer-events-auto mt-1">
                          <button onClick={(e) => { e.stopPropagation(); if (reactionPickerOpen === msg.id) { setReactionPickerOpen(null); setReactionPickerPosition(null); } else { const rect = e.currentTarget.getBoundingClientRect(); setReactionPickerPosition({ x: rect.left, y: rect.top }); setReactionPickerOpen(msg.id!); } }} className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors" title="React"><Smile size={16} className="text-white" /></button>
                          <button onClick={() => handleReply(msg)} className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors" title="Reply"><Reply size={16} className="text-white" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setContextMenu({ messageId: msg.id!, x: e.clientX, y: e.clientY }); }} className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors" title="More"><MoreVertical size={16} className="text-white" /></button>
                        </div>
                      </div>
                    </div>
                    {isOwn && msg.status !== 'failed' && msg.status !== 'pending' && (
                      <div className={`flex justify-end ${msg.reactions && Object.keys(msg.reactions).length > 0 ? 'mt-4' : 'mt-1'}`}>
                        {msg.id === lastSeenMessageId ? (<img src={otherUser?.photo} alt="Seen" className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-white/20" title={`Seen by ${otherUser?.name}`} />) : (msg.timestamp > otherUserLastRead && msg.id === [...messages].reverse().find(m => m.senderId === auth.currentUser?.uid)?.id) ? (<span className="text-xs text-gray-500 dark:text-gray-400">Sent</span>) : null}
                      </div>
                    )}
                    {msg.status === 'pending' && msg.tempId && (
                      <div className="mt-1 flex items-center justify-end">
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">Sending...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        {messages.length === 0 && (<div className="text-center text-gray-500 dark:text-gray-400 mt-8"><p className="text-lg mb-2">ðŸ‘‹ Start a conversation!</p><p className="text-sm">Send your first message</p></div>)}
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img src={imagePreview} alt="Preview" className="max-w-xs max-h-48 rounded-lg border-2 border-blue-500" />
            <button
              type="button"
              onClick={handleCancelImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}
        
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Left side icons */}
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0 w-9 h-9 flex items-center justify-center"
              style={{ color: '#0066d9' }}
              title="Upload image"
            >
              <ImageIcon size={20} />
            </button>
            
            <button
              type="button"
              onClick={() => setShowBuildModal(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0 w-9 h-9 flex items-center justify-center"
              style={{ color: '#0066d9' }}
              title="Share PC Build"
            >
              <Monitor size={20} />
            </button>
          </div>
          
          {/* Input field */}
          <div className="relative flex-1 flex items-center">
            <textarea 
              ref={inputRef} 
              value={newMessage} 
              onChange={handleInputChange} 
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} 
              placeholder={imagePreview ? "Add a caption (optional)..." : "Type a message..."} 
              rows={1} 
              dir={inputDirection} 
              className="w-full px-4 py-2 pr-10 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none dark:text-white resize-none overflow-hidden" 
              style={{ maxHeight: '100px' }} 
            />
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors"
              title="Emoji"
            >
              <Smile size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
            {/* Emoji Picker Portal */}
            {showEmojiPicker && createPortal(
              <>
                <div 
                  className="fixed inset-0 z-[100]" 
                  onClick={() => setShowEmojiPicker(false)} 
                />
                <div 
                  className="fixed z-[101]"
                  style={{
                    bottom: '80px',
                    right: '20px',
                  }}
                >
                  <EmojiPicker 
                    onEmojiClick={handleEmojiClick} 
                    theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} 
                    height={400} 
                    width={280} 
                    emojiStyle="facebook" 
                  />
                </div>
              </>,
              document.body
            )}
          </div>
          
          {/* Right side icons */}
          <button 
              type="submit" 
              disabled={loading || uploadingImage} 
              className={`rounded-full transition-colors flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700 w-9 h-9 flex items-center justify-center ${(loading || uploadingImage) ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ color: '#0066d9' }}
              title={newMessage.trim() || imagePreview ? "Send" : "Send thumbs up"}
            >
              {uploadingImage ? (
                <Loader2 size={24} className="animate-spin" />
              ) : newMessage.trim() || imagePreview ? (
                <img src="/send-message.png" alt="Send" className="w-6 h-6" />
              ) : (
                <img src="/thumbsup.png" alt="Like" className="w-[32px] h-[32px]" />
              )}
          </button>
        </div>
      </form>
      
      {imageLightbox && createPortal(
        <div 
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
          onClick={() => setImageLightbox(null)}
        >
          <button
            onClick={() => setImageLightbox(null)}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>
          <img 
            src={imageLightbox} 
            alt="Full size" 
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {contextMenu && (<><div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} /><div className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[150px]" style={{ right: window.innerWidth - contextMenu.x + 10, top: contextMenu.y, left: 'auto' }}>{messages.find(m => m.id === contextMenu.messageId)?.senderId === auth.currentUser?.uid && (<button onClick={() => handleDeleteMessage(contextMenu.messageId)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"><Trash2 size={16} />Delete</button>)}<button onClick={() => handleReportMessage(contextMenu.messageId)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Flag size={16} />Report</button></div></>)}
      {reactionModalOpen && (<ReactionModal messageId={reactionModalOpen.messageId} reactions={reactionModalOpen.reactions} isGlobal={false} conversationId={selectedConversation || undefined} onClose={() => setReactionModalOpen(null)} />)}
      
      {/* Build Share Modal */}
      {showBuildModal && (
        <BuildShareModal
          onClose={() => setShowBuildModal(false)}
          onSelectBuild={handleShareBuild}
        />
      )}
      {fullEmojiPickerOpen && createPortal(<><div className="fixed inset-0 z-[100]" onClick={() => setFullEmojiPickerOpen(null)} /><div className="fixed z-[101]" style={{ left: `${fullEmojiPickerOpen.position.x}px`, top: `${fullEmojiPickerOpen.position.y - 450}px`, transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}><EmojiPicker onEmojiClick={(ed) => { if (auth.currentUser && fullEmojiPickerOpen.messageId && selectedConversation) { toggleReaction(fullEmojiPickerOpen.messageId, ed.emoji, auth.currentUser.uid, false, selectedConversation); setFullEmojiPickerOpen(null); } }} theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} height={400} width={350} emojiStyle="facebook" searchPlaceHolder="Search emoji..." previewConfig={{ showPreview: false }} /></div></>, document.body)}
      {reactionPickerOpen && reactionPickerPosition && createPortal(<><div className="fixed inset-0 z-[100]" onClick={() => { setReactionPickerOpen(null); setReactionPickerPosition(null); }} /><div className="fixed z-[999] bg-gray-800/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg flex gap-2 items-center min-w-max" style={{ left: `${reactionPickerPosition.x}px`, top: `${reactionPickerPosition.y - 50}px`, transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>{['â¤ï¸', 'ðŸ˜‚', 'ðŸ˜®', 'ðŸ˜¢', 'ðŸ˜¡', 'ðŸ‘'].map(e => (<button key={e} onClick={() => { if (auth.currentUser && reactionPickerOpen && selectedConversation) { toggleReaction(reactionPickerOpen, e, auth.currentUser.uid, false, selectedConversation); setReactionPickerOpen(null); setReactionPickerPosition(null); } }} className="hover:scale-125 transition-transform" title={`React with ${e}`}><Emoji emoji={e} size={32} /></button>))}<button onClick={(e) => { if (reactionPickerOpen && reactionPickerPosition) { setFullEmojiPickerOpen({ messageId: reactionPickerOpen, position: reactionPickerPosition }); setReactionPickerOpen(null); setReactionPickerPosition(null); } }} className="w-8 h-8 rounded-full bg-gray-600 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-500 dark:hover:bg-gray-600 transition-all hover:scale-110 flex-shrink-0" title="More reactions"><span className="text-white text-2xl font-normal leading-none">+</span></button></div></>, document.body)}
    </div>
  );
}
