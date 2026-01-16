// Notification Badge Component for NexusPC Community Posts
// Displays notification count and provides access to notification center
// Requirements: 9.5, 9.9

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { communityNotificationService } from '../../services/communityNotificationService';
import { notificationPreferencesService } from '../../services/notificationPreferencesService';
import NotificationCenter from './NotificationCenter';
import { Notification } from '../../types/community-posts';

interface NotificationBadgeProps {
  onNotificationClick?: (notification: Notification) => void;
  className?: string;
}

export default function NotificationBadge({ 
  onNotificationClick, 
  className = '' 
}: NotificationBadgeProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCenter, setShowCenter] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    // Listen to notifications for unread count
    const unsubscribe = communityNotificationService.listenToNotifications(
      user.uid,
      (notifications, count) => {
        const previousCount = unreadCount;
        setUnreadCount(count);
        
        // Show animation for new notifications
        if (count > previousCount && previousCount > 0) {
          setHasNewNotifications(true);
          setTimeout(() => setHasNewNotifications(false), 2000);
        }
        
        // Update last active timestamp when user is active
        notificationPreferencesService.updateLastActive(user.uid);
      }
    );

    return unsubscribe;
  }, [user?.uid, unreadCount]);

  const handleBadgeClick = () => {
    setShowCenter(!showCenter);
    setHasNewNotifications(false);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    setShowCenter(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        onClick={handleBadgeClick}
        className={`relative p-2 rounded-full transition-all duration-200 ${
          showCenter
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
        } ${hasNewNotifications ? 'animate-pulse' : ''}`}
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className={`w-5 h-5 transition-transform ${hasNewNotifications ? 'animate-bounce' : ''}`} />
        
        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span 
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-white rounded-full transition-all duration-200 ${
              hasNewNotifications 
                ? 'bg-red-500 animate-pulse scale-110' 
                : 'bg-blue-500'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        
        {/* New notification indicator dot */}
        {hasNewNotifications && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping" />
        )}
      </button>

      {/* Notification Center */}
      <NotificationCenter
        isOpen={showCenter}
        onClose={() => setShowCenter(false)}
        onNotificationClick={handleNotificationClick}
      />
    </div>
  );
}