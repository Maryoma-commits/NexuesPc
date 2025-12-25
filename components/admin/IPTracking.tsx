// IP Tracking Component for Admin Dashboard
import { useState, useEffect } from 'react';
import { Globe, Users, Ban, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { getAllIPTracking, getUsersByIP, banIP, unbanIP, isIPBanned, IPInfo } from '../../services/ipTrackingService';
import { getUserProfile } from '../../services/authService';
import toast from 'react-hot-toast';
import { auth } from '../../firebase.config';

export default function IPTracking() {
  const [ipList, setIpList] = useState<IPInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIP, setExpandedIP] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<{ [userId: string]: any }>({});
  const [bannedIPs, setBannedIPs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadIPTracking();
  }, []);

  const loadIPTracking = async () => {
    setLoading(true);
    try {
      const ips = await getAllIPTracking();
      setIpList(ips);

      // Check ban status for each IP
      const banStatuses = new Set<string>();
      await Promise.all(
        ips.map(async (ipInfo) => {
          const isBanned = await isIPBanned(ipInfo.ip);
          if (isBanned) banStatuses.add(ipInfo.ip);
        })
      );
      setBannedIPs(banStatuses);
    } catch (error) {
      toast.error('Failed to load IP tracking data');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userIds: string[]) => {
    const details: { [userId: string]: any } = {};
    await Promise.all(
      userIds.map(async (uid) => {
        if (!userDetails[uid]) {
          const profile = await getUserProfile(uid);
          details[uid] = profile;
        }
      })
    );
    setUserDetails(prev => ({ ...prev, ...details }));
  };

  const handleExpandIP = async (ip: string) => {
    if (expandedIP === ip) {
      setExpandedIP(null);
    } else {
      setExpandedIP(ip);
      const users = await getUsersByIP(ip);
      await loadUserDetails(users);
    }
  };

  const handleBanIP = async (ip: string) => {
    const reason = prompt('Enter ban reason:');
    if (!reason || !auth.currentUser) return;

    try {
      await banIP(ip, reason, auth.currentUser.uid);
      setBannedIPs(prev => new Set(prev).add(ip));
      toast.success(`IP ${ip} banned successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to ban IP');
    }
  };

  const handleUnbanIP = async (ip: string) => {
    try {
      await unbanIP(ip);
      setBannedIPs(prev => {
        const newSet = new Set(prev);
        newSet.delete(ip);
        return newSet;
      });
      toast.success(`IP ${ip} unbanned successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to unban IP');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
        <div className="flex items-center gap-3 mb-2">
          <Globe className="text-blue-600 dark:text-blue-400" size={24} />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">IP Tracking</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor IP addresses and detect multi-accounting
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Globe className="text-blue-500" size={20} />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total IPs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{ipList.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-orange-500" size={20} />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Multi-Account IPs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {ipList.filter(ip => ip.users.length > 1).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Ban className="text-red-500" size={20} />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Banned IPs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{bannedIPs.size}</p>
            </div>
          </div>
        </div>
      </div>

      {/* IP List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {ipList.map((ipInfo) => {
                const isBanned = bannedIPs.has(ipInfo.ip);
                const isExpanded = expandedIP === ipInfo.ip;
                const isMultiAccount = ipInfo.users.length > 1;

                return (
                  <>
                    <tr key={ipInfo.ip} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isMultiAccount ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleExpandIP(ipInfo.ip)}
                          className="text-sm font-mono text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {ipInfo.ip}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Users size={16} className={isMultiAccount ? 'text-orange-500' : 'text-gray-400'} />
                          <span className={`text-sm font-medium ${isMultiAccount ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                            {ipInfo.users.length}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} />
                          {formatTime(ipInfo.lastSeen)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                            <Ban size={12} />
                            Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                            <CheckCircle size={12} />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {isBanned ? (
                          <button
                            onClick={() => handleUnbanIP(ipInfo.ip)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBanIP(ipInfo.ip)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Ban IP
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded User Details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Users on this IP:
                            </p>
                            {ipInfo.users.map(userId => {
                              const profile = userDetails[userId];
                              return (
                                <div key={userId} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg">
                                  <img
                                    src={profile?.photoURL || `https://ui-avatars.com/api/?name=${userId}&background=random`}
                                    alt={profile?.displayName || 'User'}
                                    className="w-8 h-8 rounded-full"
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {profile?.displayName || 'Loading...'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {profile?.email || userId}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
