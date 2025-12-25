// User Management Component for Admin Dashboard
import { useState, useEffect } from 'react';
import { Search, Filter, UserX, Ban, Trash2, Eye, Clock, Mail, Calendar, RefreshCw, RotateCcw } from 'lucide-react';
import { getAllUsers, getAllBannedUsers, getUserStats, BanInfo, resetNameChangeCooldown } from '../../services/adminService';
import { UserProfile } from '../../services/authService';
import toast from 'react-hot-toast';
import UserDetailsModal from './UserDetailsModal';
import DeleteUserModal from './DeleteUserModal';
import BanUserModal from './BanUserModal';

interface UserManagementProps {
  showBanned: boolean;
}

interface UserWithStats extends UserProfile {
  messageCount?: number;
  conversationCount?: number;
  banInfo?: BanInfo;
}

export default function UserManagement({ showBanned }: UserManagementProps) {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [bannedUsers, setBannedUsers] = useState<{ [uid: string]: BanInfo }>({});
  const [filteredUsers, setFilteredUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [signInFilter, setSignInFilter] = useState<'all' | 'google' | 'email'>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<UserWithStats | null>(null);
  const [banModalUser, setBanModalUser] = useState<UserWithStats | null>(null);
  const [resetCooldownUser, setResetCooldownUser] = useState<UserWithStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 20;

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async (showToast = false) => {
    setLoading(true);
    try {
      const [allUsers, banned] = await Promise.all([
        getAllUsers(),
        getAllBannedUsers()
      ]);

      setBannedUsers(banned);

      // Attach ban info to users
      const usersWithBanInfo = allUsers.map(user => ({
        ...user,
        banInfo: banned[user.uid] || undefined
      }));

      setUsers(usersWithBanInfo);
      setFilteredUsers(usersWithBanInfo);
      
      // Reset to first page after reload
      setCurrentPage(1);
      
      // Show success toast if manually refreshed
      if (showToast) {
        toast.success(`Refreshed! ${allUsers.length} users loaded`);
      }
    } catch (error: any) {
      toast.error('Failed to load users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter users
  useEffect(() => {
    let filtered = users;

    // Filter by banned status
    if (showBanned) {
      filtered = filtered.filter(user => user.banInfo);
    } else {
      filtered = filtered.filter(user => !user.banInfo);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        user =>
          user.displayName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    // Filter by sign-in method
    if (signInFilter !== 'all') {
      filtered = filtered.filter(user => {
        return signInFilter === 'google' 
          ? user.provider === 'google' 
          : user.provider === 'email' || !user.provider; // Default to email if no provider set
      });
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [users, searchQuery, signInFilter, showBanned]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const currentUsers = filteredUsers.slice(startIndex, startIndex + usersPerPage);

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Time ago
  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(timestamp);
  };

  // Check if user is online (active within last 90 seconds)
  const isUserOnline = (user: UserProfile) => {
    const seconds = Math.floor((Date.now() - user.lastOnline) / 1000);
    return user.isOnline && seconds < 90; // Consider online if active within 90 seconds
  };

  // Get sign-in method badge
  const getSignInBadge = (user: UserProfile) => {
    // Use provider field from user profile (set during signup)
    const isGoogle = user.provider === 'google';
    
    return isGoogle ? (
      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
        Google
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
        Email
      </span>
    );
  };

  const handleViewDetails = async (user: UserWithStats) => {
    try {
      const stats = await getUserStats(user.uid);
      setSelectedUser({ ...user, ...stats });
    } catch (error: any) {
      toast.error('Failed to load user details');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Sign-in Method Filter */}
          <select
            value={signInFilter}
            onChange={(e) => setSignInFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Sign-in Methods</option>
            <option value="google">Google Only</option>
            <option value="email">Email Only</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={() => loadUsers(true)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh user list"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Results Count */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {currentUsers.length} of {filteredUsers.length} users
        </p>
      </div>

      {/* User Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Sign-in
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Last Active
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {currentUsers.map((user) => (
              <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {/* User Avatar & Name */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="relative">
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-10 h-10 rounded-full"
                      />
                      {isUserOnline(user) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" title="Online now"></div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.displayName}
                      </div>
                      {user.banInfo && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {user.banInfo.permanent ? 'Permanently Banned' : 'Temporarily Banned'}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{user.email}</div>
                </td>

                {/* Sign-in Method */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {getSignInBadge(user)}
                </td>

                {/* Joined Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(user.createdAt)}
                </td>

                {/* Last Active */}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {isUserOnline(user) ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Online now
                    </span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      {timeAgo(user.lastOnline)}
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleViewDetails(user)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => setResetCooldownUser(user)}
                      className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                      title="Reset Name Change Cooldown"
                    >
                      <RotateCcw size={18} />
                    </button>
                    {!user.banInfo ? (
                      <button
                        onClick={() => setBanModalUser(user)}
                        className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                        title="Ban User"
                      >
                        <Ban size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setBanModalUser(user)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Unban User"
                      >
                        <UserX size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteModalUser(user)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete User"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <UserX size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {showBanned ? 'No banned users found' : 'No users found'}
          </p>
        </div>
      )}

      {/* Modals */}
      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {deleteModalUser && (
        <DeleteUserModal
          user={deleteModalUser}
          onClose={() => setDeleteModalUser(null)}
          onSuccess={loadUsers}
        />
      )}

      {banModalUser && (
        <BanUserModal
          user={banModalUser}
          onClose={() => setBanModalUser(null)}
          onSuccess={loadUsers}
        />
      )}

      {/* Reset Name Cooldown Confirmation */}
      {resetCooldownUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Reset Name Change Cooldown?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will allow <strong>{resetCooldownUser.displayName}</strong> to change their name immediately, bypassing the 7-day cooldown.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetCooldownUser(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await resetNameChangeCooldown(resetCooldownUser.uid);
                    toast.success('Name change cooldown reset successfully');
                    setResetCooldownUser(null);
                    loadUsers();
                  } catch (error: any) {
                    toast.error(error.message || 'Failed to reset cooldown');
                  }
                }}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Reset Cooldown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
