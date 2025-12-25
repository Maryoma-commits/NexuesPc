import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Ban, Eye, Download, AlertTriangle } from 'lucide-react';
import { Message } from '../../services/chatService';
import { UserProfile } from '../../services/authService';
import { adminDeleteMessage, banUser } from '../../services/adminService';
import { ref, get, remove, onValue } from 'firebase/database';
import { database, auth } from '../../firebase.config';
import toast from 'react-hot-toast';

interface ConversationViewerModalProps {
  conversationId: string;
  participant1: UserProfile;
  participant2: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConversationViewerModal({
  conversationId,
  participant1,
  participant2,
  onClose,
  onSuccess
}: ConversationViewerModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [conversationStarted, setConversationStarted] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    setupRealtimeListener();
    
    return () => {
      // Cleanup listener on unmount
      if ((window as any).__conversationListener) {
        (window as any).__conversationListener();
        delete (window as any).__conversationListener;
      }
    };
  }, [conversationId]);

  // Setup real-time listener for auto-updates
  const setupRealtimeListener = () => {
    const messagesRef = ref(database, `directMessages/${conversationId}/messages`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messagesList: Message[] = [];
        
        Object.entries(messagesData).forEach(([id, data]: [string, any]) => {
          messagesList.push({ id, ...data });
        });
        
        // Sort by timestamp (oldest first for conversation view)
        messagesList.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messagesList);
        
        // Get first message timestamp
        if (messagesList.length > 0) {
          setConversationStarted(messagesList[0].timestamp);
        }
        
        // Scroll to bottom when new messages arrive
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setMessages([]);
      }
      setLoading(false);
    });
    
    // Store listener for cleanup
    (window as any).__conversationListener = unsubscribe;
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const messagesRef = ref(database, `directMessages/${conversationId}/messages`);
      const snapshot = await get(messagesRef);
      
      if (snapshot.exists()) {
        const messagesData = snapshot.val();
        const messagesList: Message[] = [];
        
        Object.entries(messagesData).forEach(([id, data]: [string, any]) => {
          messagesList.push({ id, ...data });
        });
        
        // Sort by timestamp (oldest first for conversation view)
        messagesList.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messagesList);
        
        // Get first message timestamp
        if (messagesList.length > 0) {
          setConversationStarted(messagesList[0].timestamp);
        }
      }
    } catch (error: any) {
      toast.error('Failed to load messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message? This action cannot be undone.')) return;
    
    try {
      await adminDeleteMessage(messageId, 'dm', conversationId);
      toast.success('Message deleted');
      // Real-time listener will auto-update, no need to reload
    } catch (error: any) {
      toast.error('Failed to delete message: ' + error.message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMessages.size === 0) {
      toast.error('No messages selected');
      return;
    }

    if (!confirm(`Delete ${selectedMessages.size} selected messages? This action cannot be undone.`)) return;
    
    try {
      const deletePromises = Array.from(selectedMessages).map(msgId =>
        adminDeleteMessage(msgId, 'dm', conversationId)
      );
      
      await Promise.all(deletePromises);
      toast.success(`Deleted ${selectedMessages.size} messages`);
      setSelectedMessages(new Set());
      // Real-time listener will auto-update, no need to reload
    } catch (error: any) {
      toast.error('Failed to delete messages: ' + error.message);
    }
  };

  const handleDeleteConversation = async () => {
    if (!confirm('Delete entire conversation? This will remove ALL messages. This action cannot be undone.')) return;
    
    try {
      // Delete conversation and messages
      const messagesRef = ref(database, `directMessages/${conversationId}`);
      await remove(messagesRef);
      
      // Delete conversation metadata
      const conversationRef = ref(database, `conversations/${conversationId}`);
      await remove(conversationRef);
      
      toast.success('Conversation deleted');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to delete conversation: ' + error.message);
    }
  };

  const handleBanUser = async (user: UserProfile) => {
    const reason = prompt(`Enter ban reason for ${user.displayName}:`);
    if (!reason || !reason.trim()) return;
    
    try {
      const adminUid = auth.currentUser?.uid || 'admin';
      await banUser(user.uid, adminUid, reason, true);
      toast.success(`User ${user.displayName} has been banned`);
    } catch (error: any) {
      toast.error('Failed to ban user: ' + error.message);
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    const newSelection = new Set(selectedMessages);
    if (newSelection.has(messageId)) {
      newSelection.delete(messageId);
    } else {
      newSelection.add(messageId);
    }
    setSelectedMessages(newSelection);
  };

  const selectAll = () => {
    if (selectedMessages.size === messages.length) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(messages.map(m => m.id!)));
    }
  };

  const exportConversation = () => {
    const text = messages.map(msg => {
      const sender = msg.senderId === participant1.uid ? participant1.displayName : participant2.displayName;
      const date = new Date(msg.timestamp).toLocaleString();
      return `[${date}] ${sender}: ${msg.text || '[Image]'}`;
    }).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation_${conversationId}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Conversation exported');
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                <img
                  src={participant1.photoURL}
                  alt={participant1.displayName}
                  className="w-12 h-12 rounded-full border-2 border-white dark:border-gray-800"
                />
                <img
                  src={participant2.photoURL}
                  alt={participant2.displayName}
                  className="w-12 h-12 rounded-full border-2 border-white dark:border-gray-800"
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {participant1.displayName} ↔️ {participant2.displayName}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Conversation ID: {conversationId}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {messages.length} messages • Started {conversationStarted ? new Date(conversationStarted).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleBanUser(participant1)}
              className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Ban size={16} />
              Ban {participant1.displayName}
            </button>
            <button
              onClick={() => handleBanUser(participant2)}
              className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Ban size={16} />
              Ban {participant2.displayName}
            </button>
            <button
              onClick={exportConversation}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedMessages.size === 0}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} />
              Delete Selected ({selectedMessages.size})
            </button>
            <button
              onClick={handleDeleteConversation}
              className="px-3 py-1.5 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors flex items-center gap-2 text-sm"
            >
              <AlertTriangle size={16} />
              Delete All
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No messages in this conversation</p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={selectedMessages.size === messages.length && messages.length > 0}
                  onChange={selectAll}
                  className="rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Select All ({messages.length})
                </span>
              </div>

              {/* Message List */}
              {messages.map((msg) => {
                const isParticipant1 = msg.senderId === participant1.uid;
                const sender = isParticipant1 ? participant1 : participant2;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 p-3 rounded-lg transition-colors ${
                      selectedMessages.has(msg.id!)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedMessages.has(msg.id!)}
                      onChange={() => toggleMessageSelection(msg.id!)}
                      className="rounded mt-1"
                    />

                    {/* Avatar */}
                    <img
                      src={sender.photoURL}
                      alt={sender.displayName}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                    />

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {sender.displayName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(msg.timestamp)}
                        </span>
                      </div>
                      {msg.imageUrl ? (
                        <div className="space-y-2">
                          <a
                            href={msg.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <img
                              src={msg.imageUrl}
                              alt="Message attachment"
                              className="max-w-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                            />
                          </a>
                          {msg.text && (
                            <p className="text-sm text-gray-700 dark:text-gray-300">{msg.text}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                          {msg.text}
                        </p>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteMessage(msg.id!)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 flex-shrink-0"
                      title="Delete message"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
