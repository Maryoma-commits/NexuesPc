// Statistics Component - System overview and analytics
import { useState, useEffect } from 'react';
import { Users, MessageSquare, Shield, TrendingUp, Activity, MessageCircle } from 'lucide-react';
import { getSystemStats } from '../../services/adminService';
import toast from 'react-hot-toast';

interface Stats {
  totalUsers: number;
  onlineUsers: number;
  totalMessages: number;
  globalMessages: number;
  dmMessages: number;
  totalConversations: number;
  newUsersToday: number;
  bannedUsers: number;
}

export default function Statistics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getSystemStats();
      setStats(data);
    } catch (error: any) {
      toast.error('Failed to load statistics: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Failed to load statistics</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'blue',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Online Now',
      value: stats.onlineUsers,
      icon: Activity,
      color: 'green',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Total Messages',
      value: stats.totalMessages,
      icon: MessageSquare,
      color: 'purple',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Conversations',
      value: stats.totalConversations,
      icon: MessageCircle,
      color: 'indigo',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      title: 'New Users Today',
      value: stats.newUsersToday,
      icon: TrendingUp,
      color: 'cyan',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      iconColor: 'text-cyan-600 dark:text-cyan-400'
    },
    {
      title: 'Banned Users',
      value: stats.bannedUsers,
      icon: Shield,
      color: 'red',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Statistics</h2>
        <button
          onClick={loadStats}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {stat.value.toLocaleString()}
                </p>
              </div>
              <div className={`${stat.bgColor} p-3 rounded-full`}>
                <stat.icon size={24} className={stat.iconColor} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Message Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Message Breakdown
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Global Chat Messages</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.globalMessages.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full"
              style={{
                width: `${stats.totalMessages > 0 ? (stats.globalMessages / stats.totalMessages) * 100 : 0}%`
              }}
            ></div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-gray-600 dark:text-gray-400">Direct Messages</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.dmMessages.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{
                width: `${stats.totalMessages > 0 ? (stats.dmMessages / stats.totalMessages) * 100 : 0}%`
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* User Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          User Activity
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Active Users</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.onlineUsers} / {stats.totalUsers}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{
                width: `${stats.totalUsers > 0 ? (stats.onlineUsers / stats.totalUsers) * 100 : 0}%`
              }}
            ></div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-gray-600 dark:text-gray-400">Avg Messages per User</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.totalUsers > 0 ? Math.round(stats.totalMessages / stats.totalUsers) : 0}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Avg Conversations per User</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.totalUsers > 0 ? (stats.totalConversations / stats.totalUsers).toFixed(1) : 0}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4">
          <p className="text-sm opacity-90 mb-1">Growth Rate</p>
          <p className="text-2xl font-bold">
            {stats.totalUsers > 0 ? ((stats.newUsersToday / stats.totalUsers) * 100).toFixed(1) : 0}%
          </p>
          <p className="text-xs opacity-75 mt-1">Today</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4">
          <p className="text-sm opacity-90 mb-1">Activity Rate</p>
          <p className="text-2xl font-bold">
            {stats.totalUsers > 0 ? ((stats.onlineUsers / stats.totalUsers) * 100).toFixed(1) : 0}%
          </p>
          <p className="text-xs opacity-75 mt-1">Online</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-4">
          <p className="text-sm opacity-90 mb-1">Engagement</p>
          <p className="text-2xl font-bold">
            {stats.totalMessages > 0 ? ((stats.dmMessages / stats.totalMessages) * 100).toFixed(0) : 0}%
          </p>
          <p className="text-xs opacity-75 mt-1">DMs</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-4">
          <p className="text-sm opacity-90 mb-1">Ban Rate</p>
          <p className="text-2xl font-bold">
            {stats.totalUsers > 0 ? ((stats.bannedUsers / stats.totalUsers) * 100).toFixed(1) : 0}%
          </p>
          <p className="text-xs opacity-75 mt-1">Banned</p>
        </div>
      </div>
    </div>
  );
}
