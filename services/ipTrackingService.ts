// IP Tracking Service
import { ref, set, get, remove, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../firebase.config';

export interface IPRecord {
  ip: string;
  userAgent: string;
  timestamp: number;
  action: string;
}

export interface IPInfo {
  ip: string;
  users: string[];
  lastSeen: number;
}

// Track user IP via Vercel serverless function
export const trackUserIP = async (userId: string, action: string = 'auth'): Promise<string> => {
  try {
    // Call Vercel API to get IP
    const response = await fetch('/api/track-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action })
    });

    if (!response.ok) {
      throw new Error('Failed to track IP');
    }

    const { data } = await response.json();

    // Store IP data in Firebase
    const ipRef = ref(database, `ipTracking/${data.ip.replace(/\./g, '_')}/${userId}`);
    await set(ipRef, {
      timestamp: data.timestamp,
      userAgent: data.userAgent,
      action: data.action
    });

    // Also store user's current IP in their profile
    const userIpRef = ref(database, `users/${userId}/currentIP`);
    await set(userIpRef, data.ip);

    return data.ip; // Return IP for ban checking

  } catch (error: any) {
    console.error('IP tracking error:', error);
    // Return empty string on error - don't block auth
    return '';
  }
};

// Get all users sharing an IP
export const getUsersByIP = async (ip: string): Promise<string[]> => {
  try {
    const ipKey = ip.replace(/\./g, '_');
    const ipRef = ref(database, `ipTracking/${ipKey}`);
    const snapshot = await get(ipRef);

    if (snapshot.exists()) {
      return Object.keys(snapshot.val());
    }
    return [];
  } catch (error) {
    console.error('Error fetching users by IP:', error);
    return [];
  }
};

// Get all IPs used by a user
export const getIPsByUser = async (userId: string): Promise<string[]> => {
  try {
    const trackingRef = ref(database, 'ipTracking');
    const snapshot = await get(trackingRef);

    const ips: string[] = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const ipKey in data) {
        if (data[ipKey][userId]) {
          ips.push(ipKey.replace(/_/g, '.'));
        }
      }
    }
    return ips;
  } catch (error) {
    console.error('Error fetching IPs by user:', error);
    return [];
  }
};

// Get all tracked IPs with user counts
export const getAllIPTracking = async (): Promise<IPInfo[]> => {
  try {
    const trackingRef = ref(database, 'ipTracking');
    const snapshot = await get(trackingRef);

    const ipList: IPInfo[] = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const ipKey in data) {
        const users = Object.keys(data[ipKey]);
        const timestamps = Object.values(data[ipKey]).map((record: any) => record.timestamp);
        const lastSeen = Math.max(...timestamps);

        ipList.push({
          ip: ipKey.replace(/_/g, '.'),
          users,
          lastSeen
        });
      }
    }

    // Sort by number of users (most first)
    ipList.sort((a, b) => b.users.length - a.users.length);
    return ipList;
  } catch (error) {
    console.error('Error fetching all IP tracking:', error);
    return [];
  }
};

// Check if IP is banned
export const isIPBanned = async (ip: string): Promise<boolean> => {
  try {
    const ipKey = ip.replace(/\./g, '_');
    const banRef = ref(database, `bannedIPs/${ipKey}`);
    const snapshot = await get(banRef);
    return snapshot.exists();
  } catch (error) {
    return false;
  }
};

// Ban an IP address
export const banIP = async (ip: string, reason: string, bannedBy: string): Promise<void> => {
  try {
    const ipKey = ip.replace(/\./g, '_');
    const banRef = ref(database, `bannedIPs/${ipKey}`);
    await set(banRef, {
      reason,
      bannedBy,
      timestamp: Date.now()
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Unban an IP address
export const unbanIP = async (ip: string): Promise<void> => {
  try {
    const ipKey = ip.replace(/\./g, '_');
    await remove(ref(database, `bannedIPs/${ipKey}`));
  } catch (error: any) {
    throw new Error(error.message);
  }
};
