// Friends Service - Manage friend requests and friends list
import { ref, push, set, get, remove, onValue, query, orderByChild, equalTo, update } from 'firebase/database';
import { database } from '../firebase.config';

export interface FriendRequest {
  id?: string;
  from: string;
  to: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'declined';
}

export interface Friend {
  userId: string;
  timestamp: number; // When friendship was established
}

// Send friend request
export const sendFriendRequest = async (fromUserId: string, toUserId: string): Promise<void> => {
  try {
    // Check if already friends
    const friendsRef = ref(database, `friends/${fromUserId}/${toUserId}`);
    const snapshot = await get(friendsRef);
    if (snapshot.exists()) {
      throw new Error('Already friends');
    }

    // Check if request already exists
    const requestsRef = ref(database, `friendRequests/${toUserId}`);
    const requestsSnapshot = await get(requestsRef);
    if (requestsSnapshot.exists()) {
      const requests = requestsSnapshot.val();
      for (const reqId in requests) {
        if (requests[reqId].from === fromUserId && requests[reqId].status === 'pending') {
          throw new Error('Friend request already sent');
        }
      }
    }

    // Create friend request
    const newRequestRef = push(ref(database, `friendRequests/${toUserId}`));
    await set(newRequestRef, {
      from: fromUserId,
      to: toUserId,
      timestamp: Date.now(),
      status: 'pending'
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Accept friend request
export const acceptFriendRequest = async (requestId: string, fromUserId: string, toUserId: string): Promise<void> => {
  try {
    // Add to both users' friends lists
    await set(ref(database, `friends/${toUserId}/${fromUserId}`), Date.now());
    await set(ref(database, `friends/${fromUserId}/${toUserId}`), Date.now());

    // Update request status
    await update(ref(database, `friendRequests/${toUserId}/${requestId}`), {
      status: 'accepted'
    });

    // Remove request after a short delay (for UI feedback)
    setTimeout(async () => {
      await remove(ref(database, `friendRequests/${toUserId}/${requestId}`));
    }, 1000);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Decline friend request
export const declineFriendRequest = async (requestId: string, toUserId: string): Promise<void> => {
  try {
    await remove(ref(database, `friendRequests/${toUserId}/${requestId}`));
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Remove friend
export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
  try {
    await remove(ref(database, `friends/${userId}/${friendId}`));
    await remove(ref(database, `friends/${friendId}/${userId}`));
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Listen to friend requests
export const listenToFriendRequests = (userId: string, callback: (requests: FriendRequest[]) => void): (() => void) => {
  const requestsRef = ref(database, `friendRequests/${userId}`);
  
  const unsubscribe = onValue(requestsRef, (snapshot) => {
    const requests: FriendRequest[] = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const id in data) {
        if (data[id].status === 'pending') {
          requests.push({ id, ...data[id] });
        }
      }
    }
    callback(requests);
  });

  return unsubscribe;
};

// Get friends list
export const listenToFriends = (userId: string, callback: (friends: string[]) => void): (() => void) => {
  const friendsRef = ref(database, `friends/${userId}`);
  
  const unsubscribe = onValue(friendsRef, (snapshot) => {
    const friends: string[] = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const friendId in data) {
        friends.push(friendId);
      }
    }
    callback(friends);
  });

  return unsubscribe;
};

// Check if users are friends
export const areFriends = async (userId: string, friendId: string): Promise<boolean> => {
  try {
    const friendsRef = ref(database, `friends/${userId}/${friendId}`);
    const snapshot = await get(friendsRef);
    return snapshot.exists();
  } catch (error) {
    return false;
  }
};

// Check if friend request is pending (sent by current user)
export const hasPendingRequest = async (fromUserId: string, toUserId: string): Promise<string | null> => {
  try {
    const requestsRef = ref(database, `friendRequests/${toUserId}`);
    const snapshot = await get(requestsRef);
    if (snapshot.exists()) {
      const requests = snapshot.val();
      for (const reqId in requests) {
        if (requests[reqId].from === fromUserId && requests[reqId].status === 'pending') {
          return reqId; // Return request ID
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Cancel friend request
export const cancelFriendRequest = async (requestId: string, toUserId: string): Promise<void> => {
  try {
    await remove(ref(database, `friendRequests/${toUserId}/${requestId}`));
  } catch (error: any) {
    throw new Error(error.message);
  }
};
