// Unified Notification Badge Component for NexusPC
// Merges chat and community notifications into a single list

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Heart, 
  MessageCircle, 
  AtSign, 
  UserPlus, 
  Smile,
  Reply,
  Trash2,
  MoreHorizontal,
  Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  listenToNotifications as listenToChatNotifications,
  markNotificationAsRead as markChatAsRead,
  markAllNotificationsAsRead as markAllChatAsRead,
  markAllNotificationsAsSeen as markAllChatAsSeen,
  deleteNotification as deleteChatNotification,
  clearAllNotifications as clearAllChatNotifications,
  Notification as ChatNotification 
} from '../services/notificationService';
import { communityNotificationService } from '../services/communityNotificationService';
import { 
  notificationPreferencesService,
  NotificationPreferences 
} from '../services/notificationPreferencesService';
import { Notification as CommunityNotification, NotificationType } from '../types/community-posts';

interface UnifiedNotificationBadgeProps {
  onChatNotificationClick?: (notification: ChatNotification) => void;
  onCommunityNotificationClick?: (notification: CommunityNotification) => void;
  className?: string;
}

// Unified notification type that can be either chat or community
type UnifiedNotification = {
  id: string;
  source: 'chat' | 'community';
  timestamp: number;
  read: boolean;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto?: string;
  message: string;
  type: string;
  original: ChatNotification | CommunityNotification;
};

export default function UnifiedNotificationBadge({ 
  onChatNotificationClick,
  onCommunityNotificationClick,
  className = '' 
}: UnifiedNotificationBadgeProps) {
  const { user, getCachedProfile } = useAuth();
  const [chatNotifications, setChatNotifications] = useState<ChatNotification[]>([]);
  const [communityNotifications, setCommunityNotifications] = useState<CommunityNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string; photo: string }>>({});

  // Listen to chat notifications
  useEffect(() => {
    if (!user?.uid) {
      setChatNotifications([]);
      return;
    }
    return listenToChatNotifications(user.uid, setChatNotifications);
  }, [user?.uid]);

  // Listen to community notifications
  useEffect(() => {
    if (!user?.uid) {
      setCommunityNotifications([]);
      return;
    }
    return communityNotificationService.listenToNotifications(user.uid, (notifs) => {
      setCommunityNotifications(notifs);
      notificationPreferencesService.updateLastActive(user.uid);
    });
  }, [user?.uid]);

  // Load preferences
  useEffect(() => {
    if (!user?.uid) return;
    notificationPreferencesService.getPreferences(user.uid).then(setPreferences);
  }, [user?.uid]);

  // When panel opens, mark all notifications as seen in Firebase
  useEffect(() => {
    if (!showNotifications || !user?.uid) return;
    
    // Mark all as seen
    Promise.all([
      markAllChatAsSeen(user.uid),
      communityNotificationService.markAllAsSeen(user.uid)
    ]).catch(err => console.error('Error marking as seen:', err));
  }, [showNotifications, user?.uid]);

  // Badge count = notifications that haven't been seen yet
  const badgeCount = 
    chatNotifications.filter(n => !n.seen).length +
    communityNotifications.filter(n => !(n as any).seen).length;

  // Fetch user profiles for community notifications
  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = communityNotifications
        .map(n => n.fromUserId)
        .filter((id, i, arr) => id && arr.indexOf(id) === i && !userProfiles[id]);
      
      for (const userId of userIds) {
        try {
          const profile = await getCachedProfile(userId);
          if (profile) {
            setUserProfiles(prev => ({
              ...prev,
              [userId]: { name: profile.displayName || 'Someone', photo: profile.photoURL || '' }
            }));
          }
        } catch (e) { /* ignore */ }
      }
    };
    fetchProfiles();
  }, [communityNotifications, getCachedProfile]);


  // Merge and sort all notifications
  const unifiedNotifications: UnifiedNotification[] = [
    ...chatNotifications.map(n => ({
      id: `chat-${n.id}`,
      source: 'chat' as const,
      timestamp: n.timestamp,
      read: n.read,
      fromUserId: n.fromUserId,
      fromUserName: n.fromUserName,
      fromUserPhoto: n.fromUserPhoto,
      message: `replied to your message`,
      type: 'reply',
      original: n
    })),
    ...communityNotifications.map(n => ({
      id: `community-${n.id}`,
      source: 'community' as const,
      timestamp: n.createdAt,
      read: n.read,
      fromUserId: n.fromUserId,
      fromUserName: userProfiles[n.fromUserId]?.name || 'Someone',
      fromUserPhoto: userProfiles[n.fromUserId]?.photo || '',
      message: n.message,
      type: n.type,
      original: n
    }))
  ].sort((a, b) => b.timestamp - a.timestamp);

  const filteredNotifications = filter === 'unread' 
    ? unifiedNotifications.filter(n => !n.read)
    : unifiedNotifications;

  const totalUnreadCount = unifiedNotifications.filter(n => !n.read).length;

  // Group by time
  const groupByTime = (notifications: UnifiedNotification[]) => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const week = 7 * day;

    const groups: { label: string; items: UnifiedNotification[] }[] = [];
    const newItems: UnifiedNotification[] = [];
    const todayItems: UnifiedNotification[] = [];
    const weekItems: UnifiedNotification[] = [];
    const earlierItems: UnifiedNotification[] = [];

    notifications.forEach(n => {
      const age = now - n.timestamp;
      if (age < hour) newItems.push(n);
      else if (age < day) todayItems.push(n);
      else if (age < week) weekItems.push(n);
      else earlierItems.push(n);
    });

    if (newItems.length) groups.push({ label: 'New', items: newItems });
    if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
    if (weekItems.length) groups.push({ label: 'This Week', items: weekItems });
    if (earlierItems.length) groups.push({ label: 'Earlier', items: earlierItems });

    return groups;
  };

  const groupedNotifications = groupByTime(filteredNotifications);

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
      case 'post_like': // Legacy support
        return <Heart className="w-3.5 h-3.5 text-white fill-white" />;
      case 'comment':
      case 'post_comment': // Legacy support
      case 'comment_reply': // Legacy support
        return <MessageCircle className="w-3.5 h-3.5 text-white fill-white" />;
      case 'mention': return <AtSign className="w-3.5 h-3.5 text-white" />;
      case 'follow': return <UserPlus className="w-3.5 h-3.5 text-white" />;
      case 'reaction':
      case 'post_reaction': // Legacy support
        return <Smile className="w-3.5 h-3.5 text-white" />;
      case 'reply': return <Reply className="w-3.5 h-3.5 text-white" />;
      default: return <Bell className="w-3.5 h-3.5 text-white" />;
    }
  };

  const getIconBgColor = (type: string) => {
    switch (type) {
      case 'like':
      case 'post_like': // Legacy support
        return 'bg-gradient-to-br from-blue-400 to-blue-600';
      case 'comment':
      case 'post_comment': // Legacy support
      case 'comment_reply': // Legacy support
        return 'bg-gradient-to-br from-green-400 to-green-600';
      case 'mention': return 'bg-gradient-to-br from-purple-400 to-purple-600';
      case 'follow': return 'bg-gradient-to-br from-cyan-400 to-cyan-600';
      case 'reaction':
      case 'post_reaction': // Legacy support
        return 'bg-gradient-to-br from-yellow-400 to-orange-500';
      case 'reply': return 'bg-gradient-to-br from-yellow-400 to-yellow-600';
      default: return 'bg-gradient-to-br from-gray-400 to-gray-600';
    }
  };

  const handleNotificationClick = async (notification: UnifiedNotification) => {
    if (!user?.uid) return;

    // Mark as read
    if (!notification.read) {
      if (notification.source === 'chat') {
        await markChatAsRead(user.uid, (notification.original as ChatNotification).id);
      } else {
        await communityNotificationService.markAsRead(user.uid, (notification.original as CommunityNotification).id);
      }
    }

    // Trigger callback
    if (notification.source === 'chat' && onChatNotificationClick) {
      onChatNotificationClick(notification.original as ChatNotification);
    } else if (notification.source === 'community' && onCommunityNotificationClick) {
      onCommunityNotificationClick(notification.original as CommunityNotification);
    }

    setShowNotifications(false);
  };

  const handleDelete = async (notification: UnifiedNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;

    if (notification.source === 'chat') {
      await deleteChatNotification(user.uid, (notification.original as ChatNotification).id);
    } else {
      await communityNotificationService.deleteNotification(user.uid, (notification.original as CommunityNotification).id);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.uid) return;
    await Promise.all([
      markAllChatAsRead(user.uid),
      communityNotificationService.markAllAsRead(user.uid)
    ]);
  };

  const handleClearAll = async () => {
    if (!user?.uid) return;
    await Promise.all([
      clearAllChatNotifications(user.uid),
      communityNotificationService.clearAllNotifications(user.uid)
    ]);
  };

  const handleSavePreferences = async (newPrefs: NotificationPreferences) => {
    if (!user?.uid) return;
    await notificationPreferencesService.updatePreferences(user.uid, newPrefs);
    setPreferences(newPrefs);
    setShowPreferences(false);
  };


  return (
    <div className={`relative ${className}`}>
      {/* Bell Button */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className={`relative p-2 rounded-full transition-all duration-200 ${
          showNotifications
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
        title={`Notifications${totalUnreadCount > 0 ? ` (${totalUnreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-white bg-blue-500 rounded-full">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
          <div className="absolute top-full right-0 mt-2 w-[380px] max-h-[550px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPreferences(true)}
                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 pb-2 flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Unread
              </button>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
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
                      <div className="px-4 py-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{group.label}</h3>
                        {group.label === 'New' && totalUnreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-blue-500 hover:text-blue-600 text-xs font-medium"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      {group.items.map((notification) => (
                        <div key={notification.id}>
                          <NotificationItem
                            notification={notification}
                            onClick={() => handleNotificationClick(notification)}
                            onDelete={(e) => handleDelete(notification, e)}
                            getTimeAgo={getTimeAgo}
                            getNotificationIcon={getNotificationIcon}
                            getIconBgColor={getIconBgColor}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {unifiedNotifications.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                <button
                  onClick={handleClearAll}
                  className="w-full py-2 text-center text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Preferences Modal */}
      {showPreferences && preferences && (
        <PreferencesModal
          preferences={preferences}
          onSave={handleSavePreferences}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </div>
  );
}


// Individual notification item
interface NotificationItemProps {
  notification: UnifiedNotification;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  getTimeAgo: (timestamp: number) => string;
  getNotificationIcon: (type: string) => React.ReactNode;
  getIconBgColor: (type: string) => string;
}

function NotificationItem({ 
  notification, 
  onClick, 
  onDelete, 
  getTimeAgo, 
  getNotificationIcon, 
  getIconBgColor 
}: NotificationItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  
  const avatar = notification.fromUserPhoto || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.fromUserName)}&background=random&size=56`;

  return (
    <div className="relative group">
      <div
        className={`flex items-start gap-3 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors ${
          !notification.read 
            ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
        onClick={onClick}
      >
        {/* Avatar with type badge */}
        <div className="relative flex-shrink-0">
          <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
          <div className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full ${getIconBgColor(notification.type)} flex items-center justify-center`}>
            {getNotificationIcon(notification.type)}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-5 ${!notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
            <span className="font-semibold">{notification.fromUserName}</span>{' '}
            <span className={!notification.read ? '' : 'text-gray-500 dark:text-gray-400'}>{notification.message}</span>
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${!notification.read ? 'text-blue-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
              {getTimeAgo(notification.timestamp)}
            </span>
          </div>
        </div>

        {/* Unread dot */}
        {!notification.read && (
          <div className="flex-shrink-0 self-center">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
          </div>
        )}

        {/* Options button */}
        <div 
          className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-full bg-white dark:bg-gray-700 shadow hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[160px]">
                <button
                  onClick={(e) => { onDelete(e); setShowMenu(false); }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Preferences modal
interface PreferencesModalProps {
  preferences: NotificationPreferences;
  onSave: (prefs: NotificationPreferences) => void;
  onClose: () => void;
}

function PreferencesModal({ preferences, onSave, onClose }: PreferencesModalProps) {
  const [prefs, setPrefs] = useState(preferences);

  const togglePref = (key: keyof NotificationPreferences) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const items = [
    { key: 'likes' as const, label: 'Likes', icon: <Heart className="w-4 h-4 text-red-500" /> },
    { key: 'comments' as const, label: 'Comments', icon: <MessageCircle className="w-4 h-4 text-green-500" /> },
    { key: 'mentions' as const, label: 'Mentions', icon: <AtSign className="w-4 h-4 text-purple-500" /> },
    { key: 'follows' as const, label: 'Follows', icon: <UserPlus className="w-4 h-4 text-cyan-500" /> },
    { key: 'reactions' as const, label: 'Reactions', icon: <Smile className="w-4 h-4 text-yellow-500" /> },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {items.map(({ key, label, icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {icon}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
              </div>
              <button
                onClick={() => togglePref(key)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  prefs[key] ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  prefs[key] ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            Cancel
          </button>
          <button onClick={() => onSave(prefs)} className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Save
          </button>
        </div>
      </div>
    </>
  );
}
