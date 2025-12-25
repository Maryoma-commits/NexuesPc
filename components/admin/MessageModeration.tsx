import { useState, useEffect, useRef } from 'react';
import { Search, Trash2, AlertTriangle, MessageSquare, Mail, Eye, Ban, X, Check, ExternalLink, RefreshCw, Monitor } from 'lucide-react';
import ConversationViewerModal from './ConversationViewerModal';
import { 
  getAllGlobalMessages, 
  getAllDMMessages, 
  getAllReports, 
  adminDeleteMessage,
  dismissReport,
  Report 
} from '../../services/adminService';
import { Message } from '../../services/chatService';
import { getUserProfile, UserProfile } from '../../services/authService';
import { banUser } from '../../services/adminService';
import { ref, onValue, onChildAdded, onChildRemoved, onChildChanged, get } from 'firebase/database';
import { database, auth } from '../../firebase.config';
import toast from 'react-hot-toast';

type TabType = 'all' | 'global' | 'dm' | 'reported';

export default function MessageModeration() {
  const [activeTab, setActiveTab] = useState<TabType>('reported');
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const [dmMessages, setDmMessages] = useState<(Message & { conversationId: string })[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileCache, setProfileCache] = useState<{ [uid: string]: UserProfile }>({});
  const listenersRef = useRef<(() => void)[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<{
    conversationId: string;
    participant1: UserProfile;
    participant2: UserProfile;
  } | null>(null);
  
  // Load data based on active tab
  useEffect(() => {
    loadData();
    setupRealtimeListeners();
    
    // Cleanup listeners on unmount or tab change
    return () => {
      listenersRef.current.forEach(unsubscribe => unsubscribe());
      listenersRef.current = [];
    };
  }, [activeTab]);

  // Setup real-time listeners for auto-updates (only when messages added/removed/changed)
  const setupRealtimeListeners = () => {
    // Clear existing listeners
    listenersRef.current.forEach(unsubscribe => unsubscribe());
    listenersRef.current = [];

    if (activeTab === 'reported') {
      // Listen to reports (use child events to avoid unnecessary reloads)
      const reportsRef = ref(database, 'reports');
      const unsubAdd = onChildAdded(reportsRef, () => loadData());
      const unsubRem = onChildRemoved(reportsRef, () => loadData());
      listenersRef.current.push(unsubAdd, unsubRem);
    } else if (activeTab === 'global' || activeTab === 'all') {
      // Listen to global MESSAGES only (child_added and child_removed)
      const globalRef = ref(database, 'globalChat/messages');
      const unsubAdd = onChildAdded(globalRef, () => loadData());
      const unsubRem = onChildRemoved(globalRef, () => loadData());
      listenersRef.current.push(unsubAdd, unsubRem);
    }
    
    if (activeTab === 'dm' || activeTab === 'all') {
      // For DMs, listen to MESSAGES nodes within each conversation (not the conversation root)
      // This avoids triggering on typing indicators or metadata changes
      const dmRef = ref(database, 'directMessages');
      
      // First, get all existing conversations and set up listeners for their messages
      get(dmRef).then((snapshot) => {
        if (snapshot.exists()) {
          const conversations = snapshot.val();
          
          Object.keys(conversations).forEach((convId) => {
            // Listen to messages node within each conversation
            const messagesRef = ref(database, `directMessages/${convId}/messages`);
            
            const unsubAdd = onChildAdded(messagesRef, () => {
              loadData();
            });
            
            const unsubRem = onChildRemoved(messagesRef, () => {
              loadData();
            });
            
            listenersRef.current.push(unsubAdd, unsubRem);
          });
        }
      });
      
      // Also listen for NEW conversations being created
      const unsubNewConv = onChildAdded(dmRef, (snapshot) => {
        const convId = snapshot.key;
        if (convId) {
          // Set up listener for this new conversation's messages
          const messagesRef = ref(database, `directMessages/${convId}/messages`);
          
          const unsubAdd = onChildAdded(messagesRef, () => {
            loadData();
          });
          
          const unsubRem = onChildRemoved(messagesRef, () => {
            loadData();
          });
          
          listenersRef.current.push(unsubAdd, unsubRem);
        }
      });
      
      listenersRef.current.push(unsubNewConv);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'reported') {
        const reportsData = await getAllReports();
        setReports(reportsData);
        
        // Cache profiles for reported messages
        const userIds = new Set<string>();
        reportsData.forEach(r => {
          if (r.message?.senderId) userIds.add(r.message.senderId);
          userIds.add(r.reportedBy);
        });
        await cacheProfiles(Array.from(userIds));
      } else if (activeTab === 'global' || activeTab === 'all') {
        const messages = await getAllGlobalMessages(200);
        setGlobalMessages(messages);
        
        // Cache profiles
        const userIds = new Set<string>();
        messages.forEach(m => userIds.add(m.senderId));
        await cacheProfiles(Array.from(userIds));
      }
      
      if (activeTab === 'dm' || activeTab === 'all') {
        const messages = await getAllDMMessages(200);
        setDmMessages(messages);
        
        // Cache profiles
        const userIds = new Set<string>();
        messages.forEach(m => {
          userIds.add(m.senderId);
          if (m.recipientId) userIds.add(m.recipientId);
        });
        await cacheProfiles(Array.from(userIds));
      }
    } catch (error: any) {
      toast.error('Failed to load messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const cacheProfiles = async (userIds: string[]) => {
    const profiles: { [uid: string]: UserProfile } = {};
    
    for (const uid of userIds) {
      if (!profileCache[uid]) {
        try {
          const profile = await getUserProfile(uid);
          if (profile) profiles[uid] = profile;
        } catch (error) {
          console.error(`Failed to fetch profile for ${uid}`, error);
        }
      }
    }
    
    setProfileCache(prev => ({ ...prev, ...profiles }));
  };

  const handleDeleteMessage = async (messageId: string, messageType: 'global' | 'dm', conversationId?: string) => {
    if (!confirm('Delete this message? This action cannot be undone.')) return;
    
    try {
      await adminDeleteMessage(messageId, messageType, conversationId);
      toast.success('Message deleted successfully');
      loadData(); // Reload
    } catch (error: any) {
      toast.error('Failed to delete message: ' + error.message);
    }
  };

  const handleDismissReport = async (messageId: string) => {
    try {
      await dismissReport(messageId);
      toast.success('Report dismissed');
      loadData(); // Reload
    } catch (error: any) {
      toast.error('Failed to dismiss report: ' + error.message);
    }
  };

  const handleBanUser = async (userId: string, userName: string) => {
    const reason = prompt('Enter ban reason:');
    if (!reason || !reason.trim()) return;
    
    try {
      const adminUid = auth.currentUser?.uid || 'admin';
      await banUser(userId, adminUid, reason, true); // uid, bannedBy, reason, permanent
      toast.success(`User ${userName} has been banned`);
    } catch (error: any) {
      toast.error('Failed to ban user: ' + error.message);
    }
  };

  const handleDeleteAllInTab = async () => {
    const tabName = activeTab === 'reported' ? 'Reported Messages' : 
                    activeTab === 'all' ? 'All Messages' : 
                    activeTab === 'global' ? 'Global Chat Messages' : 
                    'Direct Messages';
    
    const count = activeTab === 'reported' ? reports.length :
                  activeTab === 'all' ? allMessages.length :
                  activeTab === 'global' ? globalMessages.length :
                  dmMessages.length;
    
    if (!confirm(`⚠️ DELETE ALL ${count} MESSAGES in "${tabName}"?\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" in the next prompt to confirm.`)) {
      return;
    }
    
    const confirmation = prompt('Type "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      toast.error('Deletion cancelled');
      return;
    }
    
    try {
      setLoading(true);
      let deletedCount = 0;
      
      if (activeTab === 'reported') {
        // Delete all reported messages
        for (const report of reports) {
          if (report.message) {
            await adminDeleteMessage(report.messageId, report.messageType || 'global', report.conversationId);
            deletedCount++;
          }
          await dismissReport(report.messageId);
        }
      } else if (activeTab === 'global') {
        // Delete all global messages
        for (const msg of globalMessages) {
          await adminDeleteMessage(msg.id!, 'global');
          deletedCount++;
        }
      } else if (activeTab === 'dm') {
        // Delete all DM messages (grouped by conversation)
        const conversations = groupDMsByConversation(dmMessages);
        for (const msg of conversations) {
          await adminDeleteMessage(msg.id!, 'dm', msg.conversationId);
          deletedCount++;
        }
      } else if (activeTab === 'all') {
        // Delete all messages (global + DM)
        for (const msg of globalMessages) {
          await adminDeleteMessage(msg.id!, 'global');
          deletedCount++;
        }
        const conversations = groupDMsByConversation(dmMessages);
        for (const msg of conversations) {
          await adminDeleteMessage(msg.id!, 'dm', msg.conversationId);
          deletedCount++;
        }
      }
      
      toast.success(`Successfully deleted ${deletedCount} messages`);
      loadData();
    } catch (error: any) {
      toast.error('Failed to delete messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter messages by search query
  const filterMessages = (messages: Message[]) => {
    if (!searchQuery.trim()) return messages;
    
    return messages.filter(msg => {
      const profile = profileCache[msg.senderId];
      const userName = profile?.displayName?.toLowerCase() || '';
      const text = msg.text?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      
      return userName.includes(query) || text.includes(query);
    });
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

  const handleOpenConversation = async (conversationId: string, senderId: string, recipientId: string) => {
    const participant1 = profileCache[senderId];
    const participant2 = profileCache[recipientId];
    
    if (!participant1 || !participant2) {
      toast.error('Failed to load user profiles');
      return;
    }
    
    setSelectedConversation({
      conversationId,
      participant1,
      participant2
    });
  };

  // Get message count for a conversation
  const getConversationMessageCount = (conversationId: string) => {
    return dmMessages.filter(msg => msg.conversationId === conversationId).length;
  };

  const renderMessageRow = (
    msg: Message, 
    messageType: 'global' | 'dm', 
    conversationId?: string,
    isReported: boolean = false
  ) => {
    const profile = profileCache[msg.senderId];
    const recipientProfile = msg.recipientId ? profileCache[msg.recipientId] : null;
    const messageCount = messageType === 'dm' && conversationId ? getConversationMessageCount(conversationId) : 0;
    
    return (
      <tr key={msg.id} className={`border-b dark:border-gray-700 ${isReported ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
        {/* User */}
        <td className="px-6 py-4 whitespace-nowrap">
          {messageType === 'dm' && recipientProfile ? (
            <div 
              className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors"
              onClick={() => handleOpenConversation(conversationId!, msg.senderId, msg.recipientId!)}
              title="Click to view conversation"
            >
              <div className="flex -space-x-2">
                <img
                  src={profile?.photoURL || `https://ui-avatars.com/api/?name=${msg.senderId}`}
                  alt={profile?.displayName || 'User'}
                  className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                />
                <img
                  src={recipientProfile.photoURL}
                  alt={recipientProfile.displayName}
                  className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                />
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                  {profile?.displayName || 'Unknown'} ↔️ {recipientProfile.displayName}
                  <ExternalLink size={14} className="text-gray-400" />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  💬 DM • Click to view
                  {messageCount > 0 && (
                    <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">
                      {messageCount} messages
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center">
              <img
                src={profile?.photoURL || `https://ui-avatars.com/api/?name=${msg.senderId}`}
                alt={profile?.displayName || 'User'}
                className="w-8 h-8 rounded-full"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {profile?.displayName || 'Unknown User'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  🌐 Global
                </div>
              </div>
            </div>
          )}
        </td>

        {/* Message */}
        <td className="px-6 py-4">
          <div className="max-w-md">
            {msg.imageUrl ? (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Eye size={16} />
                <span>Image message</span>
                <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  View
                </a>
              </div>
            ) : msg.buildData ? (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Monitor size={16} />
                <span>🖥️ PC Build: {msg.buildData.name}</span>
              </div>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                {msg.text}
              </p>
            )}
          </div>
        </td>

        {/* Time */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          {formatDate(msg.timestamp)}
        </td>

        {/* Actions */}
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          {messageType === 'global' ? (
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => handleBanUser(msg.senderId, profile?.displayName || 'User')}
                className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400"
                title="Ban user"
              >
                <Ban size={18} />
              </button>
              <button
                onClick={() => handleDeleteMessage(msg.id!, messageType, conversationId)}
                className="text-red-600 hover:text-red-900 dark:text-red-400"
                title="Delete message"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">
              Click row to manage
            </div>
          )}
        </td>
      </tr>
    );
  };

  const renderReportedMessages = () => {
    if (reports.length === 0) {
      return (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No reported messages</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            All reports have been handled or dismissed.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {reports.map((report) => {
          const reporterProfile = profileCache[report.reportedBy];
          const senderProfile = report.message ? profileCache[report.message.senderId] : null;

          return (
            <div key={report.messageId} className="bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-lg p-4">
              {/* Report Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
                  <img
                    src={reporterProfile?.photoURL || `https://ui-avatars.com/api/?name=${report.reportedBy}`}
                    alt={reporterProfile?.displayName || 'Reporter'}
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Reported by {reporterProfile?.displayName || 'Unknown User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(report.timestamp)} • {report.messageType === 'dm' ? 'Direct Message' : 'Global Chat'}
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 px-2 py-1 rounded">
                  {report.reason}
                </span>
              </div>

              {/* Reported Message */}
              {report.message ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <img
                      src={senderProfile?.photoURL || `https://ui-avatars.com/api/?name=${report.message.senderId}`}
                      alt={senderProfile?.displayName || 'User'}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {senderProfile?.displayName || 'Unknown User'}
                    </span>
                  </div>
                  {report.message.imageUrl ? (
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Eye size={16} />
                      <span>Image message</span>
                      <a href={report.message.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View Image
                      </a>
                    </div>
                  ) : report.message.buildData ? (
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Monitor size={16} />
                      <span className="font-medium">🖥️ PC Build: {report.message.buildData.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({Object.keys(report.message.buildData.components).length} components, 
                        {report.message.buildData.totalPrice.toLocaleString()} IQD)
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {report.message.text}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Message has been deleted
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {report.message && (
                  <>
                    <button
                      onClick={() => handleDeleteMessage(
                        report.messageId,
                        report.messageType || 'global',
                        report.conversationId
                      )}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Delete Message
                    </button>
                    <button
                      onClick={() => handleBanUser(
                        report.message!.senderId,
                        senderProfile?.displayName || 'User'
                      )}
                      className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Ban size={16} />
                      Ban User
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDismissReport(report.messageId)}
                  className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  Dismiss Report
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Group DM messages by conversation (show one row per conversation with latest message)
  const groupDMsByConversation = (messages: (Message & { conversationId: string })[]) => {
    const conversations = new Map<string, (Message & { conversationId: string })>();
    
    messages.forEach(msg => {
      const existing = conversations.get(msg.conversationId);
      if (!existing || msg.timestamp > existing.timestamp) {
        conversations.set(msg.conversationId, msg);
      }
    });
    
    return Array.from(conversations.values()).sort((a, b) => b.timestamp - a.timestamp);
  };

  const displayDmMessages = activeTab === 'dm' || activeTab === 'all' 
    ? groupDMsByConversation(dmMessages)
    : [];

  const allMessages = activeTab === 'all' 
    ? [...globalMessages, ...displayDmMessages].sort((a, b) => b.timestamp - a.timestamp)
    : activeTab === 'global'
    ? globalMessages
    : displayDmMessages;

  const filteredMessages = filterMessages(allMessages);

  return (
    <>
      {/* Conversation Viewer Modal */}
      {selectedConversation && (
        <ConversationViewerModal
          conversationId={selectedConversation.conversationId}
          participant1={selectedConversation.participant1}
          participant2={selectedConversation.participant2}
          onClose={() => setSelectedConversation(null)}
          onSuccess={() => {
            setSelectedConversation(null);
            loadData(); // Reload messages after changes
          }}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Message Moderation</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Review and moderate messages across the platform
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* Delete All Button (conditionally shown) */}
          {((activeTab === 'reported' && reports.length > 0) ||
            (activeTab === 'all' && allMessages.length > 0) ||
            (activeTab === 'global' && globalMessages.length > 0) ||
            (activeTab === 'dm' && dmMessages.length > 0)) && (
            <button
              onClick={handleDeleteAllInTab}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Delete all messages in current tab"
            >
              <Trash2 size={18} />
              Delete All
            </button>
          )}
          
          {/* Refresh Button */}
          <button
            onClick={() => {
              loadData();
              toast.success('Messages refreshed');
            }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh messages"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setActiveTab('reported')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'reported'
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} />
              Reported ({reports.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={18} />
              All Messages
            </div>
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'global'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={18} />
              Global Chat
            </div>
          </button>
          <button
            onClick={() => setActiveTab('dm')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'dm'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mail size={18} />
              Direct Messages
            </div>
          </button>
        </nav>
      </div>

      {/* Search (only for non-reported tabs) */}
      {activeTab !== 'reported' && (
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by user or message content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading messages...</p>
        </div>
      )}

      {/* Content */}
      {!loading && activeTab === 'reported' ? (
        renderReportedMessages()
      ) : !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No messages found
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => {
                  const isDM = 'conversationId' in msg;
                  return renderMessageRow(
                    msg,
                    isDM ? 'dm' : 'global',
                    isDM ? (msg as any).conversationId : undefined
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  );
}
