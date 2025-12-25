// Admin service for NexusPC - User management and moderation
import { ref, get, remove, set, update, query, orderByChild, limitToLast } from 'firebase/database';
import { database, auth } from '../firebase.config';
import { UserProfile } from './authService';
import { deleteUser } from 'firebase/auth';
import { Message } from './chatService';

// Ban interface
export interface BanInfo {
  bannedAt: number;
  bannedBy: string;
  reason: string;
  expiresAt?: number; // Optional: timestamp when ban expires (for temporary bans)
  permanent: boolean;
}

// User statistics interface
export interface UserStats {
  messageCount: number;
  conversationCount: number;
  lastActive: number;
}

// Get all users
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) return [];
    
    const usersData = snapshot.val();
    return Object.values(usersData);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Get user statistics
export const getUserStats = async (uid: string): Promise<UserStats> => {
  try {
    // Count messages in global chat
    const globalMessagesRef = ref(database, 'globalChat/messages');
    const globalSnapshot = await get(globalMessagesRef);
    let globalMessageCount = 0;
    
    if (globalSnapshot.exists()) {
      const messages = globalSnapshot.val();
      globalMessageCount = Object.values(messages).filter(
        (msg: any) => msg.senderId === uid
      ).length;
    }

    // Count DM messages and conversations
    const dmRef = ref(database, 'directMessages');
    const dmSnapshot = await get(dmRef);
    let dmMessageCount = 0;
    let conversationCount = 0;
    
    if (dmSnapshot.exists()) {
      const conversations = dmSnapshot.val();
      Object.entries(conversations).forEach(([convId, convData]: [string, any]) => {
        if (convId.includes(uid)) {
          conversationCount++;
          if (convData.messages) {
            dmMessageCount += Object.values(convData.messages).filter(
              (msg: any) => msg.senderId === uid
            ).length;
          }
        }
      });
    }

    // Get last active from user profile
    const userRef = ref(database, `users/${uid}`);
    const userSnapshot = await get(userRef);
    const lastActive = userSnapshot.exists() ? userSnapshot.val().lastOnline : 0;

    return {
      messageCount: globalMessageCount + dmMessageCount,
      conversationCount,
      lastActive
    };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Delete user (with options)
export const deleteUserAccount = async (
  uid: string,
  deleteMessages: boolean = false
): Promise<void> => {
  try {
    // 1. Delete user profile
    await remove(ref(database, `users/${uid}`));

    // 2. Handle messages
    if (deleteMessages) {
      // Delete all user's messages from global chat
      const globalMessagesRef = ref(database, 'globalChat/messages');
      const globalSnapshot = await get(globalMessagesRef);
      
      if (globalSnapshot.exists()) {
        const messages = globalSnapshot.val();
        const deletePromises = Object.entries(messages)
          .filter(([_, msg]: [string, any]) => msg.senderId === uid)
          .map(([msgId, _]) => remove(ref(database, `globalChat/messages/${msgId}`)));
        
        await Promise.all(deletePromises);
      }

      // Delete all DM conversations involving this user
      const dmRef = ref(database, 'directMessages');
      const dmSnapshot = await get(dmRef);
      
      if (dmSnapshot.exists()) {
        const conversations = dmSnapshot.val();
        const deleteConvPromises = Object.keys(conversations)
          .filter(convId => convId.includes(uid))
          .map(convId => remove(ref(database, `directMessages/${convId}`)));
        
        await Promise.all(deleteConvPromises);
      }

      // Delete conversation metadata
      const convRef = ref(database, 'conversations');
      const convSnapshot = await get(convRef);
      
      if (convSnapshot.exists()) {
        const convMetadata = convSnapshot.val();
        const deleteMetaPromises = Object.keys(convMetadata)
          .filter(convId => convId.includes(uid))
          .map(convId => remove(ref(database, `conversations/${convId}`)));
        
        await Promise.all(deleteMetaPromises);
      }
    } else {
      // Anonymize messages (keep them but change sender info)
      const globalMessagesRef = ref(database, 'globalChat/messages');
      const globalSnapshot = await get(globalMessagesRef);
      
      if (globalSnapshot.exists()) {
        const messages = globalSnapshot.val();
        const anonymizePromises = Object.entries(messages)
          .filter(([_, msg]: [string, any]) => msg.senderId === uid)
          .map(([msgId, _]) => 
            update(ref(database, `globalChat/messages/${msgId}`), {
              senderId: 'deleted_user',
              text: '[Message from deleted user]'
            })
          );
        
        await Promise.all(anonymizePromises);
      }

      // Note: DMs are kept as-is with original senderId for context
    }

    // 3. Keep ban active if user is banned (prevents them from messaging if they somehow sign back in)
    // Don't remove from bannedUsers - let ban persist

    // 4. Clean up typing indicators
    await remove(ref(database, `globalChat/typing/${uid}`));

    // 5. Note: Firebase Auth deletion requires Firebase Admin SDK (server-side)
    // Client-side JavaScript cannot delete other users from Authentication
    // The user's profile is deleted from database, but they can still sign in
    // To fully delete: Must manually delete from Firebase Console → Authentication
    
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Ban user
export const banUser = async (
  uid: string,
  bannedBy: string,
  reason: string,
  permanent: boolean = true,
  durationHours?: number
): Promise<void> => {
  try {
    const banInfo: BanInfo = {
      bannedAt: Date.now(),
      bannedBy,
      reason,
      permanent,
      ...(durationHours && !permanent && { 
        expiresAt: Date.now() + (durationHours * 60 * 60 * 1000) 
      })
    };

    await set(ref(database, `bannedUsers/${uid}`), banInfo);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Unban user
export const unbanUser = async (uid: string): Promise<void> => {
  try {
    await remove(ref(database, `bannedUsers/${uid}`));
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Check if user is banned
export const checkBanStatus = async (uid: string): Promise<BanInfo | null> => {
  try {
    const banRef = ref(database, `bannedUsers/${uid}`);
    const snapshot = await get(banRef);
    
    if (!snapshot.exists()) return null;
    
    const banInfo: BanInfo = snapshot.val();
    
    // Check if temporary ban has expired
    if (!banInfo.permanent && banInfo.expiresAt && Date.now() > banInfo.expiresAt) {
      await unbanUser(uid);
      return null;
    }
    
    return banInfo;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Get all banned users
export const getAllBannedUsers = async (): Promise<{ [uid: string]: BanInfo }> => {
  try {
    const bannedRef = ref(database, 'bannedUsers');
    const snapshot = await get(bannedRef);
    
    if (!snapshot.exists()) return {};
    
    return snapshot.val();
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Get system statistics
export const getSystemStats = async () => {
  try {
    // Total users
    const usersRef = ref(database, 'users');
    const usersSnapshot = await get(usersRef);
    const totalUsers = usersSnapshot.exists() ? Object.keys(usersSnapshot.val()).length : 0;
    
    // Online users
    let onlineUsers = 0;
    if (usersSnapshot.exists()) {
      onlineUsers = Object.values(usersSnapshot.val()).filter(
        (user: any) => user.isOnline
      ).length;
    }

    // Total messages
    const globalMessagesRef = ref(database, 'globalChat/messages');
    const globalSnapshot = await get(globalMessagesRef);
    const globalMessages = globalSnapshot.exists() ? Object.keys(globalSnapshot.val()).length : 0;

    let dmMessages = 0;
    let totalConversations = 0;
    const dmRef = ref(database, 'directMessages');
    const dmSnapshot = await get(dmRef);
    
    if (dmSnapshot.exists()) {
      const conversations = dmSnapshot.val();
      totalConversations = Object.keys(conversations).length;
      
      Object.values(conversations).forEach((conv: any) => {
        if (conv.messages) {
          dmMessages += Object.keys(conv.messages).length;
        }
      });
    }

    // New users today
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    let newUsersToday = 0;
    
    if (usersSnapshot.exists()) {
      newUsersToday = Object.values(usersSnapshot.val()).filter(
        (user: any) => user.createdAt > oneDayAgo
      ).length;
    }

    return {
      totalUsers,
      onlineUsers,
      totalMessages: globalMessages + dmMessages,
      globalMessages,
      dmMessages,
      totalConversations,
      newUsersToday,
      bannedUsers: (await getAllBannedUsers()).length || 0
    };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// ============================================
// MESSAGE MODERATION FUNCTIONS
// ============================================

// Report interface
export interface Report {
  messageId: string;
  reportedBy: string;
  reason: string;
  timestamp: number;
  message?: Message; // The actual message (fetched separately)
  messageType?: 'global' | 'dm';
  conversationId?: string;
}

// Get all global messages (for admin moderation)
export const getAllGlobalMessages = async (limit: number = 100): Promise<Message[]> => {
  try {
    const messagesRef = ref(database, 'globalChat/messages');
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(limit));
    const snapshot = await get(messagesQuery);
    
    const messages: Message[] = [];
    snapshot.forEach((childSnapshot) => {
      messages.push({
        id: childSnapshot.key!,
        ...childSnapshot.val()
      });
    });
    
    return messages.reverse(); // Newest first
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Get all DM messages (for admin moderation)
export const getAllDMMessages = async (limit: number = 100): Promise<(Message & { conversationId: string })[]> => {
  try {
    const dmRef = ref(database, 'directMessages');
    const snapshot = await get(dmRef);
    
    const messages: (Message & { conversationId: string })[] = [];
    
    if (snapshot.exists()) {
      const conversations = snapshot.val();
      
      // Collect all messages from all conversations
      Object.entries(conversations).forEach(([convId, convData]: [string, any]) => {
        if (convData.messages) {
          Object.entries(convData.messages).forEach(([msgId, msgData]: [string, any]) => {
            messages.push({
              id: msgId,
              conversationId: convId,
              ...msgData
            });
          });
        }
      });
    }
    
    // Sort by timestamp (newest first) and limit
    messages.sort((a, b) => b.timestamp - a.timestamp);
    return messages.slice(0, limit);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Get all reported messages
export const getAllReports = async (): Promise<Report[]> => {
  try {
    const reportsRef = ref(database, 'reports');
    const snapshot = await get(reportsRef);
    
    const reports: Report[] = [];
    
    if (snapshot.exists()) {
      const reportsData = snapshot.val();
      
      // Fetch message details for each report
      for (const [messageId, reportData] of Object.entries(reportsData)) {
        const report = reportData as Report;
        
        // Try to find the message in global chat first
        let message: Message | null = null;
        let messageType: 'global' | 'dm' = 'global';
        let conversationId: string | undefined;
        
        const globalMsgRef = ref(database, `globalChat/messages/${messageId}`);
        const globalSnapshot = await get(globalMsgRef);
        
        if (globalSnapshot.exists()) {
          message = { id: messageId, ...globalSnapshot.val() };
        } else {
          // Search in DMs
          const dmRef = ref(database, 'directMessages');
          const dmSnapshot = await get(dmRef);
          
          if (dmSnapshot.exists()) {
            const conversations = dmSnapshot.val();
            
            for (const [convId, convData] of Object.entries(conversations)) {
              const conv = convData as any;
              if (conv.messages && conv.messages[messageId]) {
                message = { id: messageId, ...conv.messages[messageId] };
                messageType = 'dm';
                conversationId = convId;
                break;
              }
            }
          }
        }
        
        reports.push({
          messageId,
          reportedBy: report.reportedBy,
          reason: report.reason,
          timestamp: report.timestamp,
          message: message || undefined,
          messageType,
          conversationId
        });
      }
    }
    
    // Sort by timestamp (newest first)
    reports.sort((a, b) => b.timestamp - a.timestamp);
    return reports;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Admin delete message (can delete any message)
export const adminDeleteMessage = async (
  messageId: string,
  messageType: 'global' | 'dm',
  conversationId?: string
) => {
  try {
    if (messageType === 'global') {
      await remove(ref(database, `globalChat/messages/${messageId}`));
    } else if (conversationId) {
      await remove(ref(database, `directMessages/${conversationId}/messages/${messageId}`));
    }
    
    // Also remove the report if it exists
    await remove(ref(database, `reports/${messageId}`));
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Dismiss a report (remove from reports list without deleting message)
export const dismissReport = async (messageId: string) => {
  try {
    await remove(ref(database, `reports/${messageId}`));
  } catch (error: any) {
    throw new Error(error.message);
  }
};
