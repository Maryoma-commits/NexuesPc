// Chat service for NexusPC Community
import { ref, push, set, onValue, query, orderByChild, limitToLast, endBefore, get, remove, update, serverTimestamp } from 'firebase/database';
import { database } from '../firebase.config';

// Message interface (stores only senderId, profiles fetched separately)
export interface Message {
  id?: string;
  text: string;
  senderId: string;
  timestamp: number;
  type: 'global' | 'dm';
  recipientId?: string; // For direct messages
  replyTo?: {
    messageId: string;
    text: string;
    senderId: string;
    senderName: string;
  };
  reactions?: {
    [emoji: string]: string[]; // emoji -> array of user IDs who reacted
  };
}

// Conversation interface (participants fetched dynamically)
export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: { [uid: string]: number };
}

// Send message to global chat
export const sendGlobalMessage = async (
  senderId: string, 
  text: string,
  replyTo?: { messageId: string; text: string; senderId: string; senderName: string }
) => {
  try {
    const messagesRef = ref(database, 'globalChat/messages');
    const newMessageRef = push(messagesRef);
    
    const messageData: Message = {
      text,
      senderId,
      timestamp: Date.now(),
      type: 'global',
      ...(replyTo && { replyTo })
    };
    
    await set(newMessageRef, messageData);
    return newMessageRef.key;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Listen to global chat messages (real-time, last N messages)
export const listenToGlobalChat = (callback: (messages: Message[]) => void, limit: number = 50) => {
  const messagesRef = ref(database, 'globalChat/messages');
  const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(limit));
  
  return onValue(messagesQuery, (snapshot) => {
    const messages: Message[] = [];
    
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key!,
        ...childSnapshot.val()
      });
    });
    
    callback(messages);
  });
};

// Load older global chat messages (one-time fetch)
export const loadOlderGlobalMessages = async (
  oldestTimestamp: number,
  limit: number = 50
): Promise<Message[]> => {
  const messagesRef = ref(database, 'globalChat/messages');
  const messagesQuery = query(
    messagesRef,
    orderByChild('timestamp'),
    endBefore(oldestTimestamp),
    limitToLast(limit)
  );
  
  const snapshot = await get(messagesQuery);
  const messages: Message[] = [];
  
  snapshot.forEach((childSnapshot) => {
    messages.push({
      id: childSnapshot.key!,
      ...childSnapshot.val()
    });
  });
  
  return messages;
};

// Send direct message
export const sendDirectMessage = async (
  senderId: string,
  recipientId: string,
  text: string,
  replyTo?: { messageId: string; text: string; senderId: string; senderName: string }
) => {
  try {
    // Create conversation ID (alphabetically sorted to ensure consistency)
    const conversationId = [senderId, recipientId].sort().join('_');
    
    // Add message first
    const messagesRef = ref(database, `directMessages/${conversationId}/messages`);
    const newMessageRef = push(messagesRef);
    
    const messageData: Message = {
      text,
      senderId,
      recipientId,
      timestamp: Date.now(),
      type: 'dm',
      ...(replyTo && { replyTo })
    };
    
    await set(newMessageRef, messageData);
    
    // DON'T remove deletion timestamps - keep them for filtering
    // The conversation will reappear because getUserConversations checks for new messages
    
    // Update conversation metadata
    await updateConversationMetadata(conversationId, senderId, recipientId, text);
    
    return newMessageRef.key;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Update conversation metadata
const updateConversationMetadata = async (
  conversationId: string,
  senderId: string,
  recipientId: string,
  lastMessage: string
) => {
  const conversationRef = ref(database, `conversations/${conversationId}`);
  const snapshot = await get(conversationRef);
  
  let unreadCount = { [senderId]: 0, [recipientId]: 0 };
  let lastReadTimestamp = { [senderId]: 0, [recipientId]: 0 };
  
  if (snapshot.exists()) {
    const existing = snapshot.val();
    unreadCount = existing.unreadCount || unreadCount;
    lastReadTimestamp = existing.lastReadTimestamp || lastReadTimestamp;
    
    // Only increment unread if message is sent AFTER recipient's last read time
    const messageTime = Date.now();
    const recipientLastRead = lastReadTimestamp[recipientId] || 0;
    
    if (messageTime > recipientLastRead) {
      unreadCount[recipientId] = (unreadCount[recipientId] || 0) + 1;
    }
  } else {
    // New conversation - recipient hasn't read it yet
    unreadCount[recipientId] = 1;
  }
  
  await update(conversationRef, {
    lastMessage,
    lastMessageTime: Date.now(),
    unreadCount,
    lastReadTimestamp,
    participants: [senderId, recipientId]
  });
};

// Listen to direct messages (real-time, last N messages)
export const listenToDirectMessages = (
  userId: string,
  otherUserId: string,
  callback: (messages: Message[]) => void,
  limit: number = 50
) => {
  const conversationId = [userId, otherUserId].sort().join('_');
  const messagesRef = ref(database, `directMessages/${conversationId}/messages`);
  const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(limit));
  const myDeletedRef = ref(database, `users/${userId}/deletedConversations/${conversationId}`);
  const theirDeletedRef = ref(database, `users/${otherUserId}/deletedConversations/${conversationId}`);
  
  let unsubscribeMessages: (() => void) | null = null;
  
  // Get BOTH users' deletion timestamps
  Promise.all([get(myDeletedRef), get(theirDeletedRef)]).then(([mySnapshot, theirSnapshot]) => {
    const myDeletionTime = mySnapshot.exists() ? mySnapshot.val() : 0;
    const theirDeletionTime = theirSnapshot.exists() ? theirSnapshot.val() : 0;
    
    // Use the LATEST deletion timestamp (most recent deletion by either user)
    // This ensures fresh start for both users
    const effectiveDeletionTime = Math.max(myDeletionTime, theirDeletionTime);
    
    unsubscribeMessages = onValue(messagesQuery, (snapshot) => {
      const messages: Message[] = [];
      
      snapshot.forEach((childSnapshot) => {
        const msg = childSnapshot.val();
        
        // Only include messages sent AFTER the most recent deletion
        if (msg.timestamp > effectiveDeletionTime) {
          messages.push({
            id: childSnapshot.key!,
            ...msg
          });
        }
      });
      
      callback(messages);
    });
  });
  
  return () => {
    if (unsubscribeMessages) {
      unsubscribeMessages();
    }
  };
};

// Load older direct messages (one-time fetch)
export const loadOlderDirectMessages = async (
  userId: string,
  otherUserId: string,
  oldestTimestamp: number,
  limit: number = 50
): Promise<Message[]> => {
  const conversationId = [userId, otherUserId].sort().join('_');
  const messagesRef = ref(database, `directMessages/${conversationId}/messages`);
  const messagesQuery = query(
    messagesRef,
    orderByChild('timestamp'),
    endBefore(oldestTimestamp),
    limitToLast(limit)
  );
  
  const snapshot = await get(messagesQuery);
  const messages: Message[] = [];
  
  snapshot.forEach((childSnapshot) => {
    messages.push({
      id: childSnapshot.key!,
      ...childSnapshot.val()
    });
  });
  
  return messages;
};

// Get user conversations (showing only if there are new messages after deletion)
export const getUserConversations = (userId: string, callback: (conversations: Conversation[]) => void) => {
  const conversationsRef = ref(database, 'conversations');
  const deletedRef = ref(database, `users/${userId}/deletedConversations`);
  
  let unsubscribeConversations: (() => void) | null = null;
  let unsubscribeDeleted: (() => void) | null = null;
  let deletedConvIds = new Map<string, number>(); // Map conversation ID to deletion timestamp
  let conversationsCache: any = null;
  
  // Function to filter and send conversations
  const filterAndCallback = () => {
    if (!conversationsCache) return;
    
    const conversations: Conversation[] = [];
    
    conversationsCache.forEach((childSnapshot: any) => {
      const conv = childSnapshot.val();
      const participants = childSnapshot.key!.split('_');
      const convId = childSnapshot.key!;
      
      // Check if user is a participant
      if (participants.includes(userId)) {
        const deletionTime = deletedConvIds.get(convId) || 0;
        
        // Show conversation if:
        // 1. Never deleted (deletionTime === 0), OR
        // 2. Has new messages after deletion (lastMessageTime > deletionTime)
        if (deletionTime === 0 || conv.lastMessageTime > deletionTime) {
          // Recalculate unread count based on lastReadTimestamp
          const lastReadTimestamp = conv.lastReadTimestamp?.[userId] || 0;
          const lastMessageTime = conv.lastMessageTime || 0;
          const storedUnreadCount = conv.unreadCount?.[userId] || 0;
          
          // If we have a lastReadTimestamp and the last message was sent BEFORE we last read,
          // then there are no unread messages (even if storedUnreadCount says otherwise)
          let actualUnreadCount = storedUnreadCount;
          if (lastReadTimestamp > 0 && lastMessageTime <= lastReadTimestamp) {
            actualUnreadCount = 0;
          }
          
          conversations.push({
            id: convId,
            participants,
            participantNames: conv.participantNames || {},
            participantPhotos: conv.participantPhotos || {},
            lastMessage: conv.lastMessage || '',
            lastMessageTime: conv.lastMessageTime || 0,
            unreadCount: {
              ...conv.unreadCount,
              [userId]: actualUnreadCount
            }
          });
        }
      }
    });
    
    // Sort by last message time
    conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    
    callback(conversations);
  };
  
  // Listen to deleted conversations list for real-time updates
  unsubscribeDeleted = onValue(deletedRef, (deletedSnapshot) => {
    deletedConvIds = new Map<string, number>();
    if (deletedSnapshot.exists()) {
      deletedSnapshot.forEach((child) => {
        // Store both conversation ID and deletion timestamp
        deletedConvIds.set(child.key!, child.val());
      });
    }
    
    // Re-filter conversations with updated deleted list
    filterAndCallback();
  });
  
  // Listen to conversations
  unsubscribeConversations = onValue(conversationsRef, (snapshot) => {
    // Cache the snapshot data
    conversationsCache = [];
    snapshot.forEach((childSnapshot) => {
      conversationsCache.push(childSnapshot);
    });
    
    // Filter and callback
    filterAndCallback();
  });
  
  // Return combined unsubscribe function
  return () => {
    if (unsubscribeConversations) {
      unsubscribeConversations();
    }
    if (unsubscribeDeleted) {
      unsubscribeDeleted();
    }
  };
};

// Mark conversation as read (and store last read timestamp)
export const markConversationAsRead = async (conversationId: string, userId: string) => {
  try {
    const now = Date.now();
    const updates = {
      [`unreadCount/${userId}`]: 0,
      [`lastReadTimestamp/${userId}`]: now
    };
    await update(ref(database, `conversations/${conversationId}`), updates);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Delete message (only own messages)
export const deleteMessage = async (messageId: string, messageType: 'global' | 'dm', conversationId?: string) => {
  try {
    if (messageType === 'global') {
      await remove(ref(database, `globalChat/messages/${messageId}`));
    } else if (conversationId) {
      await remove(ref(database, `directMessages/${conversationId}/messages/${messageId}`));
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Report message
export const reportMessage = async (messageId: string, reportedBy: string, reason: string) => {
  try {
    const reportRef = ref(database, `reports/${messageId}`);
    await set(reportRef, {
      messageId,
      reportedBy,
      reason,
      timestamp: Date.now()
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Block user
export const blockUser = async (userId: string, blockedUserId: string) => {
  try {
    const blockRef = ref(database, `users/${userId}/blockedUsers/${blockedUserId}`);
    await set(blockRef, true);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Unblock user
export const unblockUser = async (userId: string, blockedUserId: string) => {
  try {
    await remove(ref(database, `users/${userId}/blockedUsers/${blockedUserId}`));
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Check if user is blocked
export const isUserBlocked = async (userId: string, otherUserId: string): Promise<boolean> => {
  try {
    const snapshot = await get(ref(database, `users/${userId}/blockedUsers/${otherUserId}`));
    return snapshot.exists();
  } catch (error: any) {
    return false;
  }
};

// Delete conversation for a specific user (only removes from their view)
export const deleteConversationForUser = async (userId: string, conversationId: string) => {
  try {
    // Store deletion timestamp - used to filter messages (Instagram/Facebook style)
    const deletionTimestamp = Date.now();
    const deletedRef = ref(database, `users/${userId}/deletedConversations/${conversationId}`);
    await set(deletedRef, deletionTimestamp);
    
    // Reset unread count for this user
    await update(ref(database, `conversations/${conversationId}/unreadCount`), {
      [userId]: 0
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Typing status interface
export interface TypingStatus {
  userId: string;
  displayName: string;
  timestamp: number;
}

// Set typing status in global chat
export const setGlobalTypingStatus = async (userId: string, displayName: string, isTyping: boolean) => {
  try {
    const typingRef = ref(database, `globalChat/typing/${userId}`);
    
    if (isTyping) {
      await set(typingRef, {
        userId,
        displayName,
        timestamp: Date.now()
      });
    } else {
      await remove(typingRef);
    }
  } catch (error: any) {
    console.error('Error setting typing status:', error);
  }
};

// Listen to global typing status
export const listenToGlobalTyping = (callback: (typingUsers: TypingStatus[]) => void) => {
  const typingRef = ref(database, 'globalChat/typing');
  
  return onValue(typingRef, (snapshot) => {
    const typingUsers: TypingStatus[] = [];
    const now = Date.now();
    
    snapshot.forEach((childSnapshot) => {
      const status = childSnapshot.val();
      // Only show users who typed within last 3 seconds
      if (status && (now - status.timestamp) < 3000) {
        typingUsers.push(status);
      }
    });
    
    callback(typingUsers);
  });
};

// Set typing status in direct message
export const setDMTypingStatus = async (
  userId: string,
  otherUserId: string,
  displayName: string,
  isTyping: boolean
) => {
  try {
    const conversationId = [userId, otherUserId].sort().join('_');
    const typingRef = ref(database, `directMessages/${conversationId}/typing/${userId}`);
    
    if (isTyping) {
      await set(typingRef, {
        userId,
        displayName,
        timestamp: Date.now()
      });
    } else {
      await remove(typingRef);
    }
  } catch (error: any) {
    console.error('Error setting DM typing status:', error);
  }
};

// Listen to DM typing status
export const listenToDMTyping = (
  userId: string,
  otherUserId: string,
  callback: (isTyping: boolean, displayName: string) => void
) => {
  const conversationId = [userId, otherUserId].sort().join('_');
  const typingRef = ref(database, `directMessages/${conversationId}/typing/${otherUserId}`);
  
  return onValue(typingRef, (snapshot) => {
    const now = Date.now();
    const status = snapshot.val();
    
    if (status && (now - status.timestamp) < 3000) {
      callback(true, status.displayName);
    } else {
      callback(false, '');
    }
  });
};

// ============================================
// MESSAGE REACTIONS
// ============================================

/**
 * Toggle a reaction on a message (add if not exists, remove if exists)
 * @param messageId - The message ID to react to
 * @param emoji - The emoji to react with (e.g., "❤️", "😊", "👍")
 * @param userId - The user ID who is reacting
 * @param isGlobal - True for global chat, false for DMs
 * @param conversationId - Required for DMs (e.g., "uid1_uid2")
 */
export const toggleReaction = async (
  messageId: string,
  emoji: string,
  userId: string,
  isGlobal: boolean,
  conversationId?: string
) => {
  try {
    // Determine the message path
    const messagePath = isGlobal
      ? `globalChat/messages/${messageId}`
      : `directMessages/${conversationId}/messages/${messageId}`;
    
    const messageRef = ref(database, messagePath);
    const snapshot = await get(messageRef);
    
    if (!snapshot.exists()) {
      throw new Error('Message not found');
    }
    
    const message = snapshot.val();
    const reactions = message.reactions || {};
    
    // FIRST: Check if they clicked the same emoji they already have (before removing anything)
    const userAlreadyHasThisEmoji = reactions[emoji]?.includes(userId);
    
    // SECOND: Remove user's existing reaction from ANY emoji (user can only have one reaction)
    Object.keys(reactions).forEach(existingEmoji => {
      const userIds = reactions[existingEmoji] || [];
      const userIndex = userIds.indexOf(userId);
      
      if (userIndex > -1) {
        // User has reacted with this emoji - remove it
        userIds.splice(userIndex, 1);
        
        // If no one else reacted with this emoji, delete it
        if (userIds.length === 0) {
          delete reactions[existingEmoji];
        } else {
          reactions[existingEmoji] = userIds;
        }
      }
    });
    
    // THIRD: If they clicked a DIFFERENT emoji (not the one they had), add it
    if (!userAlreadyHasThisEmoji) {
      // User is adding a new reaction (or switching to a different one)
      const emojiReactions = reactions[emoji] || [];
      reactions[emoji] = [...emojiReactions, userId];
    }
    // If userAlreadyHasThisEmoji was true, we already removed it above, so clicking same emoji = remove
    
    // Update the message with new reactions
    // If reactions object is empty, remove it entirely
    if (Object.keys(reactions).length === 0) {
      await update(messageRef, { reactions: null });
    } else {
      await update(messageRef, { reactions });
    }
    
  } catch (error: any) {
    throw new Error(error.message);
  }
};

/**
 * Get reaction count for a specific emoji on a message
 * @param reactions - The reactions object from a message
 * @param emoji - The emoji to count
 * @returns The number of users who reacted with this emoji
 */
export const getReactionCount = (reactions: { [emoji: string]: string[] } | undefined, emoji: string): number => {
  if (!reactions || !reactions[emoji]) return 0;
  return reactions[emoji].length;
};

/**
 * Check if a user has reacted with a specific emoji
 * @param reactions - The reactions object from a message
 * @param emoji - The emoji to check
 * @param userId - The user ID to check
 * @returns True if the user has reacted with this emoji
 */
export const hasUserReacted = (
  reactions: { [emoji: string]: string[] } | undefined,
  emoji: string,
  userId: string
): boolean => {
  if (!reactions || !reactions[emoji]) return false;
  return reactions[emoji].includes(userId);
};
