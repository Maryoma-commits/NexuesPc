// Global Authentication Context
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User } from 'firebase/auth';
import { ref, onValue, off } from 'firebase/database';
import { auth, database } from '../firebase.config';
import { onAuthChange, UserProfile, getUserProfile } from '../services/authService';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  getCachedProfile: (userId: string) => Promise<UserProfile | null>;
  profileCache: { [userId: string]: UserProfile };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  getCachedProfile: async () => null,
  profileCache: {}
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileCache, setProfileCache] = useState<{ [userId: string]: UserProfile }>({});
  const [activeListeners, setActiveListeners] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Load user profile
        try {
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);
          // Also cache current user's profile
          setProfileCache(prev => ({ ...prev, [currentUser.uid]: profile }));
        } catch (error) {
          console.error('Error loading user profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
        // Clear cache on logout
        setProfileCache({});
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Get cached profile or fetch if not cached, with real-time listener
  const getCachedProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    // Return from cache if available
    if (profileCache[userId]) {
      return profileCache[userId];
    }

    // Fetch profile
    try {
      const profile = await getUserProfile(userId);
      if (profile) {
        // Cache it
        setProfileCache(prev => ({ ...prev, [userId]: profile }));

        // Set up real-time listener if not already active
        if (!activeListeners.has(userId)) {
          const profileRef = ref(database, `users/${userId}`);
          
          const listener = onValue(profileRef, (snapshot) => {
            const updatedProfile = snapshot.val();
            if (updatedProfile) {
              setProfileCache(prev => ({ ...prev, [userId]: updatedProfile }));
              
              // Update current user profile if it's the logged-in user
              if (userId === auth.currentUser?.uid) {
                setUserProfile(updatedProfile);
              }
            }
          });

          setActiveListeners(prev => new Set(prev).add(userId));
          
          // Note: Listeners are intentionally not cleaned up
          // They remain active for real-time updates throughout the session
        }

        return profile;
      }
    } catch (error) {
      console.error(`Error fetching profile for ${userId}:`, error);
    }

    return null;
  }, [profileCache, activeListeners]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, getCachedProfile, profileCache }}>
      {children}
    </AuthContext.Provider>
  );
}
