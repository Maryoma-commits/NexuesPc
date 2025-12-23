// Main Chat Window Component
import { useState, useEffect } from 'react';
import { X, MessageSquare, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase.config';
import { getUserConversations } from '../../services/chatService';
import GlobalChat from './GlobalChat';
import DirectMessages from './DirectMessages';

interface ChatWindowProps {
  onClose: () => void;
  onNewMessage: () => void;
}

export default function ChatWindow({ onClose, onNewMessage }: ChatWindowProps) {
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'global' | 'dms'>('global');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

  const handleOpenDM = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('dms');
  };

  const handleGlobalMessage = () => {
    if (activeTab !== 'global') {
      setGlobalUnreadCount(prev => prev + 1);
    }
    onNewMessage(); // For ChatBubble
  };

  const handleDMMessage = () => {
    if (activeTab !== 'dms') {
      setDmUnreadCount(prev => prev + 1);
    }
    onNewMessage(); // For ChatBubble
  };

  const handleTabChange = (tab: 'global' | 'dms') => {
    setActiveTab(tab);
    // Reset unread count when switching to tab
    if (tab === 'global') {
      setGlobalUnreadCount(0);
    } else {
      setDmUnreadCount(0);
    }
  };

  // Track total DM unread count
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = getUserConversations(auth.currentUser.uid, (convs) => {
      // Calculate total unread count across all DM conversations
      const totalUnread = convs.reduce((sum, conv) => {
        const myUnread = conv.unreadCount?.[auth.currentUser!.uid] || 0;
        return sum + myUnread;
      }, 0);
      
      // Update DM badge count (only when not viewing DMs)
      if (activeTab !== 'dms') {
        setDmUnreadCount(totalUnread);
      }
    });

    return () => unsubscribe();
  }, [activeTab]);

  return (
    <div className="w-96 h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
        <h3 className="font-bold text-lg">NexusPC Chat</h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Show loading skeleton while auth is initializing */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 mx-auto"></div>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <button
              onClick={() => handleTabChange('global')}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 font-medium transition-colors relative
                ${activeTab === 'global'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              <MessageSquare size={18} />
              Global Chat
              {globalUnreadCount > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {globalUnreadCount > 9 ? '9+' : globalUnreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('dms')}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 font-medium transition-colors relative
                ${activeTab === 'dms'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
            >
              <Users size={18} />
              Direct Messages
              {dmUnreadCount > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {dmUnreadCount > 9 ? '9+' : dmUnreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'global' ? (
              <GlobalChat 
                onNewMessage={handleGlobalMessage} 
                onOpenDM={handleOpenDM}
              />
            ) : (
              <DirectMessages 
                onNewMessage={handleDMMessage}
                preselectedUserId={selectedUserId}
                onClearPreselection={() => setSelectedUserId(null)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
