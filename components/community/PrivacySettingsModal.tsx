// Privacy Settings Modal for NexusPC Community Posts
// Requirement 1.6: Privacy controls and post visibility
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Globe, 
  Users, 
  Lock, 
  Eye, 
  EyeOff, 
  Settings,
  Info,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { followService } from '../../services/followService';
import { PostPrivacy } from '../../types/community-posts';

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrivacyChange?: (privacy: PostPrivacy) => void;
  currentPrivacy?: PostPrivacy;
}

interface PrivacyOption {
  value: PostPrivacy;
  label: string;
  icon: React.ReactNode;
  description: string;
  details: string;
  color: string;
}

const PRIVACY_OPTIONS: PrivacyOption[] = [
  {
    value: 'public',
    label: 'Public',
    icon: <Globe size={20} />,
    description: 'Anyone can see this post',
    details: 'Your post will be visible to all users, including those who don\'t follow you. It may appear in discovery feeds and search results.',
    color: 'text-green-600 dark:text-green-400'
  },
  {
    value: 'friends',
    label: 'Friends Only',
    icon: <Users size={20} />,
    description: 'Only people you follow can see this post',
    details: 'Your post will only be visible to users you are following. It won\'t appear in public feeds or search results for non-friends.',
    color: 'text-blue-600 dark:text-blue-400'
  },
  {
    value: 'private',
    label: 'Only Me',
    icon: <Lock size={20} />,
    description: 'Only you can see this post',
    details: 'Your post will be completely private and only visible to you. Use this for drafts or personal notes.',
    color: 'text-orange-600 dark:text-orange-400'
  }
];

export default function PrivacySettingsModal({ 
  isOpen, 
  onClose, 
  onPrivacyChange,
  currentPrivacy = 'public'
}: PrivacySettingsModalProps) {
  const { userProfile } = useAuth();
  const [selectedPrivacy, setSelectedPrivacy] = useState<PostPrivacy>(currentPrivacy);
  const [profileIsPrivate, setProfileIsPrivate] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Load user profile privacy settings
  useEffect(() => {
    if (isOpen && userProfile) {
      loadProfileSettings();
    }
  }, [isOpen, userProfile]);

  const loadProfileSettings = async () => {
    if (!userProfile) return;

    try {
      const profileData = await followService.getUserProfileWithStats(userProfile.uid);
      if (profileData) {
        setProfileIsPrivate(profileData.profile.isPrivate || false);
        setFollowerCount(profileData.followerCount);
        setFollowingCount(profileData.followingCount);
      }
    } catch (error) {
      console.error('Failed to load profile settings:', error);
    }
  };

  const handlePrivacySelect = (privacy: PostPrivacy) => {
    setSelectedPrivacy(privacy);
    if (onPrivacyChange) {
      onPrivacyChange(privacy);
    }
  };

  const handleProfilePrivacyToggle = async () => {
    if (!userProfile) return;

    setIsUpdatingProfile(true);
    try {
      const newPrivacySetting = !profileIsPrivate;
      await followService.setProfilePrivacy(userProfile.uid, newPrivacySetting);
      setProfileIsPrivate(newPrivacySetting);
      
      toast.success(
        newPrivacySetting 
          ? 'Profile set to private - new followers will need approval'
          : 'Profile set to public - anyone can follow you'
      );
    } catch (error: any) {
      toast.error('Failed to update profile privacy');
      console.error('Profile privacy update error:', error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="text-gray-600 dark:text-gray-300" size={24} />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Privacy Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Post Privacy Section */}
          {onPrivacyChange && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Post Visibility
              </h3>
              <div className="space-y-3">
                {PRIVACY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handlePrivacySelect(option.value)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedPrivacy === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={option.color}>
                        {option.icon}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </h4>
                          {selectedPrivacy === option.value && (
                            <Check size={16} className="text-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {option.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          {option.details}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Profile Privacy Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Profile Privacy
            </h3>
            
            {/* Profile Stats */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Followers</span>
                <span className="font-medium text-gray-900 dark:text-white">{followerCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">Following</span>
                <span className="font-medium text-gray-900 dark:text-white">{followingCount}</span>
              </div>
            </div>

            {/* Private Profile Toggle */}
            <div className="flex items-start gap-3">
              <button
                onClick={handleProfilePrivacyToggle}
                disabled={isUpdatingProfile}
                className={`flex-shrink-0 w-12 h-6 rounded-full transition-colors relative ${
                  profileIsPrivate 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300 dark:bg-gray-600'
                } ${isUpdatingProfile ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform absolute top-0.5 ${
                  profileIsPrivate ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {profileIsPrivate ? (
                    <EyeOff size={16} className="text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Eye size={16} className="text-green-600 dark:text-green-400" />
                  )}
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {profileIsPrivate ? 'Private Profile' : 'Public Profile'}
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {profileIsPrivate 
                    ? 'New followers need your approval to see your posts'
                    : 'Anyone can follow you and see your public posts'
                  }
                </p>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">Privacy Tips:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Private profiles require approval for new followers</li>
                    <li>• Friends-only posts are only visible to people you follow</li>
                    <li>• You can change post privacy anytime within 24 hours</li>
                    <li>• Private posts are never visible in search or discovery</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}