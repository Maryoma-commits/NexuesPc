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
  createdAt: number;
  lastOnline: number;
  provider?: 'google' | 'email'; // Sign-in provider
}

// Sign in with email/password
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if email is verified
    if (!result.user.emailVerified) {
      throw new Error('Please verify your email before signing in. Check your inbox for verification link.');
    }
    
    // Always update provider to ensure it's correct (in case of migration)
    const userRef = ref(database, `users/${result.user.uid}`);
    await update(userRef, { provider: 'email' });
    
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
    await createUserProfile(result.user, displayName, 'email');
    
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
    
    let isNewUser = false;
    
    if (!snapshot.exists()) {
      // Use generic name for new Google users (will be set via onboarding)
      await createUserProfile(result.user, 'User', 'google');
      isNewUser = true;
    } else {
      // Always update provider to ensure it's correct (in case of migration)
      await update(userRef, { provider: 'google' });
      await updateUserOnlineStatus(result.user.uid, true);
    }
    
    return { user: result.user, isNewUser };
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
const createUserProfile = async (user: User, customDisplayName?: string, provider: 'google' | 'email' = 'email') => {
  const userProfile: UserProfile = {
    uid: user.uid,
    displayName: customDisplayName || user.displayName || 'Anonymous',
    email: user.email || '',
    // Always use default avatar (never Google photo)
    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(customDisplayName || user.displayName || 'User')}&background=random`,
    createdAt: Date.now(),
    lastOnline: Date.now(),
    provider
  };
  
  await set(ref(database, `users/${user.uid}`), userProfile);
  return userProfile;
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
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Auto-update provider field based on actual Firebase Auth provider
      const provider = user.providerData[0]?.providerId;
      const providerType = provider === 'google.com' ? 'google' : 'email';
      
      // Check if user profile exists
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        // Update existing user with provider
        await update(userRef, { 
          provider: providerType,
          lastOnline: Date.now()
        });
      }
      // If profile doesn't exist, it will be created during sign-up/sign-in flow
    }
    callback(user);
  });
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

// Upload profile picture to ImgBB
export const uploadProfilePicture = async (file: File): Promise<string> => {
  if (!auth.currentUser) {
    throw new Error('No user signed in');
  }

  // Validate file
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (file.size > maxSize) {
    throw new Error('Image must be less than 5MB');
  }
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, GIF, and WebP images are allowed');
  }

  try {
    // Get ImgBB API key from environment
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
    if (!apiKey) {
      throw new Error('ImgBB API key not configured');
    }

    // Convert file to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64String = result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Upload to ImgBB
    const formData = new FormData();
    formData.append('image', base64);
    formData.append('name', `${auth.currentUser.uid}_${Date.now()}`);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload to ImgBB');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    // Return the permanent URL
    return data.data.url;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to upload image');
  }
};
