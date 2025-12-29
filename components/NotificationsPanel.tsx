// Notifications Panel Component
import React, { useEffect, useState } from 'react';
import { X, Bell, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  listenToNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  Notification 
} from '../services/notificationService';
import { auth } from '../firebase.config';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick: (notification: Notification) => void;
  onCountChange: (count: number) => void;
}

export default function NotificationsPanel({ 
  isOpen, 
  onClose, 
  onNotificationClick,
  onCountChange 
}: NotificationsPanelProps) {
  const { profileCache } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = listenToNotifications(auth.currentUser.uid, (notifs) => {
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!auth.currentUser) return;
    
    // Mark as read
    await markNotificationAsRead(auth.currentUser.uid, notification.id);
    
    // Navigate to message
    onNotificationClick(notification);
    onClose();
  };

  const handleMarkAllRead = async () => {
    if (!auth.currentUser) return;
    await markAllNotificationsAsRead(auth.currentUser.uid);
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    await deleteNotification(auth.currentUser.uid, notificationId);
  };

  const handleClearAll = async () => {
    if (!auth.currentUser) return;
    await clearAllNotifications(auth.currentUser.uid);
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Dropdown Panel - Positioned absolutely below button */}
      <div 
        className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-96 max-h-[600px] flex flex-col z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h2>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold text-white bg-yellow-500 rounded-full">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No notifications</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                You'll see replies to your messages here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <img
                      src={notification.fromUserPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.fromUserName)}&background=random`}
                      alt={notification.fromUserName}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                    />
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {notification.fromUserName}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {getTimeAgo(notification.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Replied to your message
                      </p>
                      
                      {/* Original message preview */}
                      <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-1">
                          "{notification.originalMessageText}"
                        </p>
                      </div>
                      
                      {/* Reply preview */}
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
                        {notification.messageText}
                      </p>
                      
                      {/* Badge */}
                      <div className="flex items-center gap-2 mt-2">
                        {!notification.read && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                            New
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {notification.conversationType === 'global' ? 'Global Chat' : 'Direct Message'}
                        </span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(notification.id, e)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors flex-shrink-0"
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
