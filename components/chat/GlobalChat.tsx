// Global Chat Room Component
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Smile, MoreVertical, Flag, Trash2, Loader2, Reply, X, Heart, Paperclip, Image as ImageIcon } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase.config';
import { sendGlobalMessage, listenToGlobalChat, loadOlderGlobalMessages, deleteMessage, reportMessage, setGlobalTypingStatus, listenToGlobalTyping, toggleReaction, uploadChatImage, Message, TypingStatus } from '../../services/chatService';
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
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState<string | null>(null); // messageId of open picker
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ x: number; y: number } | null>(null);
  const [reactionModalOpen, setReactionModalOpen] = useState<{ messageId: string; reactions: { [emoji: string]: string[] } } | null>(null);
  const [fullEmojiPickerOpen, setFullEmojiPickerOpen] = useState<{ messageId: string; position: { x: number; y: number } } | null>(null);
  const [userMenu, setUserMenu] = useState<{ userId: string; userName: string; userPhoto: string; x: number; y: number } | null>(null);
  const [, setTick] = useState(0); // Force re-render for timestamp updates
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    let isFirstLoad = true;
    let previousMessageCount = 0;

    const unsubscribe = listenToGlobalChat(async (msgs) => {
      if (!isFirstLoad && msgs.length > previousMessageCount) {
        const newestMessage = msgs[msgs.length - 1];
        if (newestMessage.senderId !== auth.currentUser?.uid) {
          onNewMessage();
        }
      }
      
      setMessages(msgs);
      previousMessageCount = msgs.length;
      
      const uniqueUserIds = [...new Set(msgs.map(m => m.senderId))];
      await fetchUserProfiles(uniqueUserIds);
      setMessagesLoading(false);
      isFirstLoad = false;
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = listenToGlobalTyping((users) => {
      const otherUsers = users.filter(u => u.userId !== auth.currentUser?.uid);
      setTypingUsers(otherUsers);
    });
    return () => unsubscribe();
  }, []);

  const fetchUserProfiles = async (userIds: string[]) => {
    await Promise.all(userIds.map(uid => getCachedProfile(uid)));
  };

  useEffect(() => {
    const interval = setInterval(() => setTick(prev => prev + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-send pending messages when connection returns
  useEffect(() => {
    const handleOnline = async () => {
      const pendingMessages = messages.filter(m => m.status === 'pending' && m.tempId);
      
      for (const msg of pendingMessages) {
        if (!auth.currentUser) continue;

        // Mark as sending
        setMessages(prev => prev.map(m => 
          m.tempId === msg.tempId ? { ...m, status: 'sent' } : m
        ));

        try {
          await sendGlobalMessage(auth.currentUser.uid, msg.text, msg.replyTo);
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
  }, [messages]);

  const scrollToBottom = (instant = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (instant) {
      container.scrollTop = 0; // In flex-col-reverse, 0 is the bottom
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = async () => {
    const container = messagesContainerRef.current;
    if (!container || loadingOlder || !hasMoreMessages) return;

    // In flex-col-reverse, physical top is maximum scroll distance
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

        const olderMessages = await loadOlderGlobalMessages(oldestTimestamp, 50);
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
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (auth.currentUser && currentUserProfile) {
      setGlobalTypingStatus(auth.currentUser.uid, currentUserProfile.displayName, true);
      typingTimeoutRef.current = setTimeout(() => {
        if (auth.currentUser && currentUserProfile) {
          setGlobalTypingStatus(auth.currentUser.uid, currentUserProfile.displayName, false);
        }
      }, 2000);
    }
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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
      return;
    }

    // Validate file size
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview
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
    if (!imageFile || !auth.currentUser) return;

    setUploadingImage(true);
    try {
      const imageUrl = await uploadChatImage(imageFile);
      
      // Send message with image
      const messageText = newMessage.trim() || '';
      const replyData = replyingTo ? {
        messageId: replyingTo.id!,
        text: replyingTo.text,
        senderId: replyingTo.senderId,
        senderName: profileCache[replyingTo.senderId]?.displayName || 'User'
      } : undefined;

      await sendGlobalMessage(auth.currentUser.uid, messageText, replyData, imageUrl);
      
      // Clear everything
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
    
    // If there's an image preview, send the image instead
    if (imagePreview && imageFile) {
      await handleSendImage();
      return;
    }
    
    if (!newMessage.trim() || !auth.currentUser || loading) return;

    // Clear typing status immediately on send
    if (currentUserProfile && auth.currentUser) {
      setGlobalTypingStatus(auth.currentUser.uid, currentUserProfile.displayName, false);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Store message text and reply data
    const messageText = newMessage.trim();
    const replyData = replyingTo ? {
      messageId: replyingTo.id!,
      text: replyingTo.text,
      senderId: replyingTo.senderId,
      senderName: profileCache[replyingTo.senderId]?.displayName || 'User'
    } : undefined;

    // Check if offline - mark as pending (will auto-send when online)
    const isOffline = !navigator.onLine;
    
    // Create optimistic message (shows immediately)
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      tempId,
      text: messageText,
      senderId: auth.currentUser.uid,
      timestamp: Date.now(),
      type: 'global',
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
      await sendGlobalMessage(auth.currentUser.uid, messageText, replyData, undefined);
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

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setContextMenu(null);
    inputRef.current?.focus();
  };

  const handleCancelReply = () => setReplyingTo(null);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    triggerTypingStatus();
    inputRef.current?.focus();
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteMessage(messageId, 'global');
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

  const handleAvatarClick = (e: React.MouseEvent, userId: string, userName: string, userPhoto: string) => {
    e.stopPropagation();
    if (userId === auth.currentUser?.uid) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setUserMenu({ userId, userName, userPhoto, x: rect.right + 10, y: rect.top + rect.height / 2 });
  };

  const handleSendDirectMessage = (userId: string) => {
    if (onOpenDM) onOpenDM(userId);
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
    } else {
      alert('Message is too old to view or has been deleted');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages Container with flex-col-reverse */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 flex flex-col-reverse space-y-4 space-y-reverse"
      >
        <div ref={messagesEndRef} />

        {/* Typing Indicator - Physically first in DOM = Bottom of reversed list */}
        {typingUsers.length > 0 && (
          <div className="flex gap-3 animate-fadeIn mb-2">
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
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {typingUsers.length === 1 ? typingUsers[0].displayName : typingUsers.length === 2 ? `${typingUsers[0].displayName} and ${typingUsers[1].displayName}` : `${typingUsers[0].displayName} and ${typingUsers.length - 1} others`}
                </span>
              </div>
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

        {/* Messages list - REVERSED order for flex-col-reverse */}
        {!messagesLoading && [...messages].reverse().map((msg) => {
            const isOwnMessage = msg.senderId === auth.currentUser?.uid;
            const senderProfile = isOwnMessage ? currentUserProfile : profileCache[msg.senderId];
            const senderName = senderProfile?.displayName || 'User';
            const senderPhoto = senderProfile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`;
            const isHighlighted = highlightedMessageId === msg.id;
            
            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`flex gap-3 transition-all duration-500 ${isOwnMessage ? 'flex-row-reverse' : ''} ${msg.reactions && Object.keys(msg.reactions).length > 0 ? 'mb-4' : 'mb-1'} ${isHighlighted ? 'bg-blue-500/20 rounded-lg p-2 ring-2 ring-blue-500 ring-opacity-50 scale-[1.02]' : ''}`}
              >
                <img
                  src={senderPhoto}
                  alt={senderName}
                  onClick={(e) => handleAvatarClick(e, msg.senderId, senderName, senderPhoto)}
                  className={`w-8 h-8 rounded-full object-cover flex-shrink-0 ${!isOwnMessage ? 'cursor-pointer hover:ring-2 hover:ring-blue-500' : ''}`}
                  title={!isOwnMessage ? 'Click for options' : ''}
                />
                <div className={`${isOwnMessage ? 'flex-1 min-w-0 flex flex-col items-end' : 'flex-1 min-w-0 flex flex-col items-start'}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{isOwnMessage ? 'You' : senderName}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(msg.timestamp)}</span>
                  </div>
                  {msg.replyTo && (
                    <button
                      onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                      className={`flex items-center gap-1 mb-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors ${isOwnMessage ? 'flex-row-reverse mr-1' : 'ml-1'}`}
                    >
                      <Reply size={12} className={isOwnMessage ? '' : 'transform scale-x-[-1]'} />
                      <span>{isOwnMessage ? 'You' : senderName} replied to {msg.replyTo.senderName}</span>
                    </button>
                  )}
                  <div className="relative group inline-block">
                    <div className="relative overflow-visible flex flex-col">
                      {msg.replyTo && (
                        <button
                          onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                          className={`px-3 pt-2 pb-3 text-[13px] line-clamp-1 max-w-sm bg-[#3E4042] text-gray-300 hover:bg-[#4E5052] transition-colors rounded-[18px] mb-[-10px] relative z-0 opacity-80 cursor-pointer`}
                          style={{ direction: detectTextDirection(msg.replyTo.text), textAlign: detectTextDirection(msg.replyTo.text) === 'rtl' ? 'right' : 'left' }}
                        >
                          {msg.replyTo.text}
                        </button>
                      )}
                      {msg.imageUrl && (
                        <div className={`relative max-w-sm overflow-hidden rounded-[18px] mb-2 ${isOwnMessage ? 'ml-auto' : 'mr-auto'}`}>
                          <img 
                            src={msg.imageUrl} 
                            alt="Shared image"
                            onClick={() => setImageLightbox(msg.imageUrl!)}
                            className="w-full h-auto max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity rounded-[18px]"
                          />
                        </div>
                      )}
                      {msg.text && (
                        <div
                          className={`px-4 py-2 max-w-sm break-words leading-relaxed shadow-md relative z-10 rounded-[18px] ${isOwnMessage ? 'bg-[#7835F7] text-white' : 'bg-gray-200 dark:bg-[#3E4042] text-gray-900 dark:text-white'}`}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word', direction: detectTextDirection(msg.text), textAlign: detectTextDirection(msg.text) === 'rtl' ? 'right' : 'left', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                        >
                          {msg.text}
                        </div>
                      )}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (() => {
                        const totalReactions = Object.values(msg.reactions).reduce((sum, userIds) => sum + userIds.length, 0);
                        const uniqueEmojis = Object.keys(msg.reactions);
                        return (
                          <button
                            onClick={() => { if (msg.id && msg.reactions) setReactionModalOpen({ messageId: msg.id, reactions: msg.reactions }); }}
                            className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} -bottom-3 flex items-center gap-[5px] pl-1 pr-1.5 py-0.5 rounded-full transition-all hover:scale-110 bg-[#3E4043] shadow-md z-10 w-max`}
                            title={`${totalReactions} ${totalReactions === 1 ? 'reaction' : 'reactions'}`}
                          >
                            <div className="flex items-center gap-0 flex-shrink-0">
                              {uniqueEmojis.map(emoji => (<div key={emoji} className="flex-shrink-0"><Emoji emoji={emoji} size={16} /></div>))}
                            </div>
                            {totalReactions > 1 && (<span className="text-white text-[12px] font-normal leading-none flex-shrink-0">{totalReactions}</span>)}
                          </button>
                        );
                      })()}
                    </div>
                    <div className={`absolute ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'} bottom-0 ${(reactionPickerOpen === msg.id || fullEmojiPickerOpen?.messageId === msg.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} pointer-events-none z-10`}>
                      <div className="flex gap-1 pointer-events-auto mt-1">
                        <button onClick={(e) => { e.stopPropagation(); if (reactionPickerOpen === msg.id) { setReactionPickerOpen(null); setReactionPickerPosition(null); } else { const rect = e.currentTarget.getBoundingClientRect(); setReactionPickerPosition({ x: rect.left, y: rect.top }); setReactionPickerOpen(msg.id!); } }} className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors" title="React"><Smile size={16} className="text-white" /></button>
                        <button onClick={() => handleReply(msg)} className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors" title="Reply"><Reply size={16} className="text-white" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setContextMenu({ messageId: msg.id!, x: e.clientX, y: e.clientY }); }} className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors" title="More"><MoreVertical size={16} className="text-white" /></button>
                      </div>
                    </div>
                  </div>
                  {msg.status === 'pending' && msg.tempId && isOwnMessage && (
                    <div className="mt-1 flex items-center justify-end">
                      <span className="text-xs text-gray-500 dark:text-gray-400 italic">Sending...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {/* Older messages indicator - Physically at the end of DOM = Top of reversed list */}
        {loadingOlder && (
          <div className="text-center py-2">
            <Loader2 className="inline-block animate-spin text-blue-600 dark:text-blue-400" size={20} />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading older messages...</span>
          </div>
        )}

        {messagesLoading && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-sm">Loading messages...</p>
          </div>
        )}
        
        {!messagesLoading && messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-lg mb-2">👋 Welcome to Chat!</p>
            <p className="text-sm">Be the first to say hello!</p>
          </div>
        )}
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

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
        {/* Image Preview */}
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
        
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Upload image"
          >
            <Paperclip size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
          
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
              placeholder={imagePreview ? "Add a caption (optional)..." : "Type a message..."}
              rows={1}
              dir={inputDirection}
              className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              style={{ maxHeight: '100px' }}
            />
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
              <Smile size={20} className="text-gray-500 dark:text-gray-400" />
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
          <button 
            type="submit" 
            disabled={(!newMessage.trim() && !imagePreview) || loading || uploadingImage} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploadingImage ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Uploading...</span>
              </>
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </form>
      
      {/* Image Lightbox */}
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

      {/* Portals and Menus */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[150px]" style={{ right: window.innerWidth - contextMenu.x + 10, top: contextMenu.y, left: 'auto' }}>
            {messages.find(m => m.id === contextMenu.messageId)?.senderId === auth.currentUser?.uid && (
              <button onClick={() => handleDeleteMessage(contextMenu.messageId)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"><Trash2 size={16} />Delete</button>
            )}
            <button onClick={() => handleReportMessage(contextMenu.messageId)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Flag size={16} />Report</button>
          </div>
        </>
      )}

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

      {reactionModalOpen && (
        <ReactionModal
          messageId={reactionModalOpen.messageId}
          reactions={reactionModalOpen.reactions}
          isGlobal={true}
          onClose={() => setReactionModalOpen(null)}
        />
      )}

      {fullEmojiPickerOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setFullEmojiPickerOpen(null)} />
          <div className="fixed z-[101]" style={{ left: `${fullEmojiPickerOpen.position.x}px`, top: `${fullEmojiPickerOpen.position.y - 450}px`, transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>
            <EmojiPicker onEmojiClick={(emojiData: EmojiClickData) => { if (auth.currentUser && fullEmojiPickerOpen.messageId) { toggleReaction(fullEmojiPickerOpen.messageId, emojiData.emoji, auth.currentUser.uid, true); setFullEmojiPickerOpen(null); } }} theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} height={400} width={350} emojiStyle="facebook" searchPlaceHolder="Search emoji..." previewConfig={{ showPreview: false }} />
          </div>
        </>,
        document.body
      )}

      {reactionPickerOpen && reactionPickerPosition && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => { setReactionPickerOpen(null); setReactionPickerPosition(null); }} />
          <div className="fixed z-[101] bg-gray-800/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg flex gap-2 items-center" style={{ left: `${reactionPickerPosition.x}px`, top: `${reactionPickerPosition.y - 50}px`, transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>
            {['❤️', '😂', '😮', '😢', '😡', '👍'].map(emoji => (
              <button key={emoji} onClick={() => { if (auth.currentUser && reactionPickerOpen) { toggleReaction(reactionPickerOpen, emoji, auth.currentUser.uid, true); setReactionPickerOpen(null); setReactionPickerPosition(null); } }} className="hover:scale-125 transition-transform" title={`React with ${emoji}`}><Emoji emoji={emoji} size={32} /></button>
            ))}
            <button onClick={(e) => { if (reactionPickerOpen && reactionPickerPosition) { setFullEmojiPickerOpen({ messageId: reactionPickerOpen, position: reactionPickerPosition }); setReactionPickerOpen(null); setReactionPickerPosition(null); } }} className="w-8 h-8 rounded-full bg-gray-600 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-500 dark:hover:bg-gray-600 transition-all hover:scale-110 flex-shrink-0" title="More reactions"><span className="text-white text-2xl font-normal leading-none">+</span></button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}