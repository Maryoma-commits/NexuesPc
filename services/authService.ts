// Authentication service for NexusPC Chat
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendEmailVerification,
  User,
  onAuthStateChanged
} from 'firebase/auth';
import { ref, set, get, update } from 'firebase/database';
import { auth, database } from '../firebase.config';

// Providers
const googleProvider = new GoogleAuthProvider();

// User profile interface
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio: string;
  createdAt: number;
  lastOnline: number;
}

// Sign in with email/password
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if email is verified
    if (!result.user.emailVerified) {
      throw new Error('Please verify your email before signing in. Check your inbox for verification link.');
    }
    
    await updateUserOnlineStatus(result.user.uid, true);
    return result.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Sign up with email/password
export const signUpWithEmail = async (email: string, password: string, displayName: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    
    // Send verification email
    await sendEmailVerification(result.user);
    
    // Create user profile in database
    await createUserProfile(result.user, displayName);
    
    // Sign out immediately - user must verify email first
    await signOut(auth);
    
    return result.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // Check if user profile exists, create if not
    const userRef = ref(database, `users/${result.user.uid}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
      await createUserProfile(result.user);
    } else {
      await updateUserOnlineStatus(result.user.uid, true);
    }
    
    return result.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};


// Sign out
export const signOutUser = async () => {
  try {
    if (auth.currentUser) {
      await updateUserOnlineStatus(auth.currentUser.uid, false);
    }
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Create user profile in database
const createUserProfile = async (user: User, customDisplayName?: string) => {
  const userProfile: UserProfile = {
    uid: user.uid,
    displayName: customDisplayName || user.displayName || 'Anonymous',
    email: user.email || '',
    photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(customDisplayName || user.displayName || 'User')}&background=random`,
    bio: '',
    createdAt: Date.now(),
    lastOnline: Date.now()
  };
  
  await set(ref(database, `users/${user.uid}`), userProfile);
};

// Update user profile
export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  try {
    // Update in Realtime Database
    await update(ref(database, `users/${uid}`), updates);
    
    // Also update Firebase Auth profile if displayName or photoURL changed
    if (auth.currentUser && (updates.displayName || updates.photoURL)) {
      const authUpdates: any = {};
      if (updates.displayName) authUpdates.displayName = updates.displayName;
      if (updates.photoURL) authUpdates.photoURL = updates.photoURL;
      await updateProfile(auth.currentUser, authUpdates);
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Update user online status
const updateUserOnlineStatus = async (uid: string, isOnline: boolean) => {
  await update(ref(database, `users/${uid}`), {
    lastOnline: Date.now(),
    isOnline
  });
};

// Get user profile
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const snapshot = await get(ref(database, `users/${uid}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Auth state observer
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Resend verification email
export const resendVerificationEmail = async () => {
  if (!auth.currentUser) {
    throw new Error('No user signed in');
  }
  
  if (auth.currentUser.emailVerified) {
    throw new Error('Email already verified');
  }
  
  try {
    await sendEmailVerification(auth.currentUser);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Check if email is verified
export const isEmailVerified = (): boolean => {
  return auth.currentUser?.emailVerified || false;
};
