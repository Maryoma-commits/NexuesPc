// User Profile Component
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Camera, Save, X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUserProfile, updateUserProfile, uploadProfilePicture, UserProfile as UserProfileType } from '../../services/authService';
import { auth } from '../../firebase.config';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfile({ isOpen, onClose }: UserProfileProps) {
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    if (!auth.currentUser) return;
    
    try {
      const userProfile = await getUserProfile(auth.currentUser.uid);
      if (userProfile) {
        setProfile(userProfile);
        setDisplayName(userProfile.displayName);
        setPhotoURL(userProfile.photoURL);
      }
    } catch (err: any) {
      setError('Failed to load profile');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const downloadURL = await uploadProfilePicture(file);
      setPhotoURL(downloadURL);
      toast.success('Profile picture uploaded');
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    setLoading(true);
    setError('');

    try {
      await updateUserProfile(auth.currentUser.uid, {
        displayName,
        photoURL
      });
      toast.success('Profile updated successfully');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Edit Profile
        </h2>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Profile Picture */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <img
              src={photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-full shadow-lg transition-colors"
            >
              {uploading ? (
                <div className="animate-spin">
                  <Upload size={16} />
                </div>
              ) : (
                <Camera size={16} />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {uploading ? 'Uploading...' : 'Click camera to upload photo'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Max 5MB • JPEG, PNG, GIF, WebP
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Display Name
            </label>
            <div className="relative">
              <User size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
