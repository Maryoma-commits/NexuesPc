// Chat service for NexusPC Community
import { ref, push, set, onValue, query, orderByChild, limitToLast, get, remove, update } from 'firebase/database';
import { database } from '../firebase.config';

// Message interface (stores only senderId, profiles fetched separately)
export interface Message {
  id?: string;
  text: string;
  senderId: string;
  timestamp: number;
  type: 'global' | 'dm';
  recipientId?: string; // For direct messages
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
export const sendGlobalMessage = async (senderId: string, text: string) => {
  try {
    const messagesRef = ref(database, 'globalChat/messages');
    const newMessageRef = push(messagesRef);
    
    const messageData: Message = {
      text,
      senderId,
      timestamp: Date.now(),
      type: 'global'
    };
    
    await set(newMessageRef, messageData);
    return newMessageRef.key;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Listen to global chat messages
export const listenToGlobalChat = (callback: (messages: Message[]) => void, limit: number = 100) => {
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

// Send direct message
export const sendDirectMessage = async (
  senderId: string,
  recipientId: string,
  text: string
) => {
  try {
    // Create conversation ID (alphabetically sorted to ensure consistency)
    const conversationId = [senderId, recipientId].sort().join('_');
    
    // Add message
    const messagesRef = ref(database, `directMessages/${conversationId}/messages`);
    const newMessageRef = push(messagesRef);
    
    const messageData: Message = {
      text,
      senderId,
      recipientId,
      timestamp: Date.now(),
      type: 'dm'
    };
    
    await set(newMessageRef, messageData);
    
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
  
  if (snapshot.exists()) {
    const existing = snapshot.val();
    unreadCount = existing.unreadCount || unreadCount;
    unreadCount[recipientId] = (unreadCount[recipientId] || 0) + 1;
  }
  
  await update(conversationRef, {
    lastMessage,
    lastMessageTime: Date.now(),
    unreadCount,
    participants: [senderId, recipientId]
  });
};

// Listen to direct messages
export const listenToDirectMessages = (
  userId: string,
  otherUserId: string,
  callback: (messages: Message[]) => void,
  limit: number = 100
) => {
  const conversationId = [userId, otherUserId].sort().join('_');
  const messagesRef = ref(database, `directMessages/${conversationId}/messages`);
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

// Get user conversations
export const getUserConversations = (userId: string, callback: (conversations: Conversation[]) => void) => {
  const conversationsRef = ref(database, 'conversations');
  
  return onValue(conversationsRef, (snapshot) => {
    const conversations: Conversation[] = [];
    
    snapshot.forEach((childSnapshot) => {
      const conv = childSnapshot.val();
      const participants = childSnapshot.key!.split('_');
      
      // Only include conversations where user is a participant
      if (participants.includes(userId)) {
        conversations.push({
          id: childSnapshot.key!,
          participants,
          participantNames: conv.participantNames || {},
          participantPhotos: conv.participantPhotos || {},
          lastMessage: conv.lastMessage || '',
          lastMessageTime: conv.lastMessageTime || 0,
          unreadCount: conv.unreadCount || {}
        });
      }
    });
    
    // Sort by last message time
    conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    
    callback(conversations);
  });
};

// Mark conversation as read
export const markConversationAsRead = async (conversationId: string, userId: string) => {
  try {
    await update(ref(database, `conversations/${conversationId}/unreadCount`), {
      [userId]: 0
    });
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
