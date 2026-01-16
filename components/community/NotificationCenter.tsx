// Notification Center Component for NexusPC Community Posts
// Facebook-style notification UI
// Requirements: 9.5, 9.6, 9.9, 9.10

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Settings, 
  X, 
  Check, 
  Trash2, 
  Heart, 
  MessageCircle, 
  AtSign, 
  UserPlus,
  Smile,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { communityNotificationService } from '../../services/communityNotificationService';
import { 
  notificationPreferencesService,
  NotificationPreferences 
} from '../../services/notificationPreferencesService';
import { Notification, NotificationType } from '../../types/community-posts';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick?: (notification: Notification) => void;
  embedded?: boolean; // When true, renders without backdrop/positioning (for use in UnifiedNotificationBadge)
}

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

// Get notification icon with colored background (Facebook style)
const getNotificationIconBadge = (type: NotificationType) => {
  switch (type) {
    case 'like':
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
          <Heart className="w-3.5 h-3.5 text-white fill-white" />
        </div>
      );
    case 'comment':
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
          <MessageCircle className="w-3.5 h-3.5 text-white fill-white" />
        </div>
      );
    case 'mention':
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
          <AtSign className="w-3.5 h-3.5 text-white" />
        </div>
      );
    case 'follow':
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
          <UserPlus className="w-3.5 h-3.5 text-white" />
        </div>
      );
    case 'reaction':
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
          <Smile className="w-3.5 h-3.5 text-white" />
        </div>
      );
    default:
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
          <Bell className="w-3.5 h-3.5 text-white" />
        </div>
      );
  }
};

// Individual notification item component (Facebook style)
function NotificationItem({ notification, onRead, onDelete, onClick }: NotificationItemProps) {
  const { getCachedProfile } = useAuth();
  const [fromUserName, setFromUserName] = useState<string>('Someone');
  const [fromUserPhoto, setFromUserPhoto] = useState<string>('');
  const [showMenu, setShowMenu] = useState(false);

  // Fetch the user's display name and photo
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (notification.fromUserId) {
        try {
          const profile = await getCachedProfile(notification.fromUserId);
          if (profile?.displayName) {
            setFromUserName(profile.displayName);
          }
          if (profile?.photoURL) {
            setFromUserPhoto(profile.photoURL);
          }
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
        }
      }
    };
    fetchUserInfo();
  }, [notification.fromUserId, getCachedProfile]);

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleClick = () => {
    if (!notification.read) {
      onRead(notification.id);
    }
    if (onClick) {
      onClick(notification);
    }
  };

  const userAvatar = fromUserPhoto || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(fromUserName)}&background=random&size=56`;

  return (
    <div className="relative group">
      <div
        className={`flex items-start gap-3 px-2 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${
          !notification.read 
            ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
        onClick={handleClick}
      >
        {/* Avatar with notification type badge */}
        <div className="relative flex-shrink-0">
          <img
            src={userAvatar}
            alt={fromUserName}
            className="w-14 h-14 rounded-full object-cover"
          />
          {/* Notification type badge - positioned at bottom right of avatar */}
          <div className="absolute -bottom-0.5 -right-0.5">
            {getNotificationIconBadge(notification.type)}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 py-0.5">
          <p className={`text-[15px] leading-5 ${!notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
            <span className="font-semibold">{fromUserName}</span>{' '}
            <span className={!notification.read ? '' : 'text-gray-500 dark:text-gray-400'}>{notification.message}</span>
          </p>
          <p className={`text-[13px] mt-0.5 ${!notification.read ? 'text-blue-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
            {getTimeAgo(notification.createdAt)}
          </p>
        </div>

        {/* Unread indicator dot */}
        {!notification.read && (
          <div className="flex-shrink-0 self-center">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          </div>
        )}

        {/* Options button - appears on hover */}
        <div 
          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full bg-white dark:bg-gray-700 shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          
          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[200px]">
                {!notification.read && (
                  <button
                    onClick={() => { onRead(notification.id); setShowMenu(false); }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-[15px]"
                  >
                    <Check className="w-5 h-5" />
                    Mark as read
                  </button>
                )}
                <button
                  onClick={() => { onDelete(notification.id); setShowMenu(false); }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-[15px]"
                >
                  <Trash2 className="w-5 h-5" />
                  Remove this notification
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Group notifications by time period
const groupNotificationsByTime = (notifications: Notification[]) => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const oneWeek = 7 * oneDay;

  const groups: { label: string; notifications: Notification[] }[] = [];
  const newNotifs: Notification[] = [];
  const todayNotifs: Notification[] = [];
  const thisWeekNotifs: Notification[] = [];
  const earlierNotifs: Notification[] = [];

  notifications.forEach(n => {
    const age = now - n.createdAt;
    if (age < oneHour) {
      newNotifs.push(n);
    } else if (age < oneDay) {
      todayNotifs.push(n);
    } else if (age < oneWeek) {
      thisWeekNotifs.push(n);
    } else {
      earlierNotifs.push(n);
    }
  });

  if (newNotifs.length > 0) groups.push({ label: 'New', notifications: newNotifs });
  if (todayNotifs.length > 0) groups.push({ label: 'Today', notifications: todayNotifs });
  if (thisWeekNotifs.length > 0) groups.push({ label: 'This Week', notifications: thisWeekNotifs });
  if (earlierNotifs.length > 0) groups.push({ label: 'Earlier', notifications: earlierNotifs });

  return groups;
};

// Main NotificationCenter component
export default function NotificationCenter({ isOpen, onClose, onNotificationClick, embedded = false }: NotificationCenterProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  // Load notifications
  useEffect(() => {
    if (!user || !isOpen) return;

    setLoading(true);
    const unsubscribe = communityNotificationService.listenToNotifications(
      user.uid,
      (notifs) => {
        setNotifications(notifs);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isOpen]);

  // Load preferences
  useEffect(() => {
    if (!user) return;
    notificationPreferencesService.getPreferences(user.uid).then(setPreferences);
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    if (!user) return;
    await communityNotificationService.markAsRead(user.uid, id);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await communityNotificationService.markAllAsRead(user.uid);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await communityNotificationService.deleteNotification(user.uid, id);
  };

  const handleClearAll = async () => {
    if (!user) return;
    try {
      await communityNotificationService.clearAllNotifications(user.uid);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  const handleSavePreferences = async (newPrefs: NotificationPreferences) => {
    if (!user) return;
    await notificationPreferencesService.updatePreferences(user.uid, newPrefs);
    setPreferences(newPrefs);
    setShowPreferences(false);
  };

  if (!isOpen) return null;

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const groupedNotifications = groupNotificationsByTime(filteredNotifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Content that's shared between embedded and standalone modes
  const notificationContent = (
    <>
      {/* Filter Tabs */}
      <div className="px-4 py-2 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-[15px] font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-1.5 rounded-full text-[15px] font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Unread
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowPreferences(true)}
          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Notification settings"
        >
          <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-center">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="pb-2">
            {groupedNotifications.map((group) => (
              <div key={group.label}>
                {/* Section Header */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                    {group.label}
                  </h2>
                  {group.label === 'New' && unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-blue-500 hover:text-blue-600 text-[13px] font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                
                {/* Notification Items */}
                {group.notifications.map((notification) => (
                  <div key={notification.id}>
                    <NotificationItem
                      notification={notification}
                      onRead={handleMarkAsRead}
                      onDelete={handleDelete}
                      onClick={onNotificationClick}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          <button
            onClick={handleClearAll}
            className="w-full py-2 text-center text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-[14px] font-medium transition-colors"
          >
            Clear all notifications
          </button>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && preferences && (
        <NotificationPreferencesModal
          preferences={preferences}
          onSave={handleSavePreferences}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </>
  );

  // Embedded mode - just return the content for use inside UnifiedNotificationBadge
  if (embedded) {
    return (
      <div className="flex flex-col h-full max-h-[450px]">
        {notificationContent}
      </div>
    );
  }

  // Standalone mode - full panel with backdrop
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Notification Panel */}
      <div className="fixed right-4 top-16 w-[360px] max-h-[calc(100vh-80px)] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPreferences(true)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Notification settings"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </div>

        {notificationContent}
      </div>
    </>
  );
}

// Notification Preferences Modal
interface NotificationPreferencesModalProps {
  preferences: NotificationPreferences;
  onSave: (prefs: NotificationPreferences) => void;
  onClose: () => void;
}

function NotificationPreferencesModal({ preferences, onSave, onClose }: NotificationPreferencesModalProps) {
  const [prefs, setPrefs] = useState(preferences);

  const togglePref = (key: keyof NotificationPreferences) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Settings */}
        <div className="p-4 space-y-4">
          <PreferenceToggle
            label="Likes"
            description="When someone likes your post"
            icon={<Heart className="w-5 h-5 text-red-500" />}
            enabled={prefs.likes}
            onToggle={() => togglePref('likes')}
          />
          <PreferenceToggle
            label="Comments"
            description="When someone comments on your post"
            icon={<MessageCircle className="w-5 h-5 text-green-500" />}
            enabled={prefs.comments}
            onToggle={() => togglePref('comments')}
          />
          <PreferenceToggle
            label="Mentions"
            description="When someone mentions you"
            icon={<AtSign className="w-5 h-5 text-purple-500" />}
            enabled={prefs.mentions}
            onToggle={() => togglePref('mentions')}
          />
          <PreferenceToggle
            label="Follows"
            description="When someone follows you"
            icon={<UserPlus className="w-5 h-5 text-cyan-500" />}
            enabled={prefs.follows}
            onToggle={() => togglePref('follows')}
          />
          <PreferenceToggle
            label="Reactions"
            description="When someone reacts to your post"
            icon={<Smile className="w-5 h-5 text-yellow-500" />}
            enabled={prefs.reactions}
            onToggle={() => togglePref('reactions')}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(prefs)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}

// Preference Toggle Component
interface PreferenceToggleProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: () => void;
}

function PreferenceToggle({ label, description, icon, enabled, onToggle }: PreferenceToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`w-11 h-6 rounded-full transition-colors relative ${
          enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}