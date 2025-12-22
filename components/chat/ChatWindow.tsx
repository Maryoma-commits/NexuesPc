// Main Chat Window Component
import { useState } from 'react';
import { X, MessageSquare, Users } from 'lucide-react';
import GlobalChat from './GlobalChat';
import DirectMessages from './DirectMessages';

interface ChatWindowProps {
  onClose: () => void;
  onNewMessage: () => void;
}

export default function ChatWindow({ onClose, onNewMessage }: ChatWindowProps) {
  const [activeTab, setActiveTab] = useState<'global' | 'dms'>('global');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleOpenDM = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('dms');
  };

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

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <button
          onClick={() => setActiveTab('global')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 font-medium transition-colors
            ${activeTab === 'global'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
        >
          <MessageSquare size={18} />
          Global Chat
        </button>
        <button
          onClick={() => setActiveTab('dms')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 font-medium transition-colors
            ${activeTab === 'dms'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
        >
          <Users size={18} />
          Direct Messages
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'global' ? (
          <GlobalChat 
            onNewMessage={onNewMessage} 
            onOpenDM={handleOpenDM}
          />
        ) : (
          <DirectMessages 
            onNewMessage={onNewMessage}
            preselectedUserId={selectedUserId}
            onClearPreselection={() => setSelectedUserId(null)}
          />
        )}
      </div>
    </div>
  );
}
