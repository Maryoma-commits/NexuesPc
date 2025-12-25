// Ban User Modal - Ban/Unban users with temporary options
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Ban, UserX, Clock } from 'lucide-react';
import { UserProfile } from '../../services/authService';
import { banUser, unbanUser, BanInfo } from '../../services/adminService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface BanUserModalProps {
  user: UserProfile & { banInfo?: BanInfo };
  onClose: () => void;
  onSuccess: () => void;
}

export default function BanUserModal({ user, onClose, onSuccess }: BanUserModalProps) {
  const { currentUser } = useAuth();
  const [reason, setReason] = useState('');
  const [banType, setBanType] = useState<'permanent' | 'temporary'>('permanent');
  const [duration, setDuration] = useState<number>(24); // hours
  const [loading, setLoading] = useState(false);

  const isBanned = !!user.banInfo;

  const handleBan = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the ban');
      return;
    }

    if (!currentUser) return;

    setLoading(true);
    try {
      await banUser(
        user.uid,
        currentUser.uid,
        reason,
        banType === 'permanent',
        banType === 'temporary' ? duration : undefined
      );
      toast.success(`${user.displayName} has been banned`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to ban user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async () => {
    setLoading(true);
    try {
      await unbanUser(user.uid);
      toast.success(`${user.displayName} has been unbanned`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to unban user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBanExpiry = (expiresAt: number) => {
    const date = new Date(expiresAt);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`${isBanned ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'} p-2 rounded-full`}>
              {isBanned ? (
                <UserX size={24} className="text-green-600 dark:text-green-400" />
              ) : (
                <Ban size={24} className="text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isBanned ? 'Unban User' : 'Ban User'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{user.displayName}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
            </div>
          </div>

          {isBanned ? (
            // Show current ban info
            <div className="space-y-3">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                  Currently Banned
                </p>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <p><strong>Reason:</strong> {user.banInfo!.reason}</p>
                  <p><strong>Type:</strong> {user.banInfo!.permanent ? 'Permanent' : 'Temporary'}</p>
                  {user.banInfo!.expiresAt && (
                    <p><strong>Expires:</strong> {formatBanExpiry(user.banInfo!.expiresAt)}</p>
                  )}
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Click "Unban User" below to restore this user's access to messaging.
              </p>
            </div>
          ) : (
            // Ban form
            <div className="space-y-4">
              {/* Ban Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Ban Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="banType"
                      value="permanent"
                      checked={banType === 'permanent'}
                      onChange={(e) => setBanType(e.target.value as any)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Permanent Ban</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        User cannot send messages until manually unbanned
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="banType"
                      value="temporary"
                      checked={banType === 'temporary'}
                      onChange={(e) => setBanType(e.target.value as any)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Temporary Ban</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        User is automatically unbanned after duration expires
                      </p>
                      {banType === 'temporary' && (
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-gray-400" />
                          <select
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value={1}>1 Hour</option>
                            <option value={3}>3 Hours</option>
                            <option value={6}>6 Hours</option>
                            <option value={12}>12 Hours</option>
                            <option value={24}>24 Hours</option>
                            <option value={48}>2 Days</option>
                            <option value={72}>3 Days</option>
                            <option value={168}>1 Week</option>
                            <option value={336}>2 Weeks</option>
                            <option value={720}>1 Month</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for Ban <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Spamming, harassment, inappropriate content..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  ⚠️ Banned users cannot send messages in global chat or direct messages
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {isBanned ? (
            <button
              onClick={handleUnban}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Unbanning...
                </>
              ) : (
                <>
                  <UserX size={18} />
                  Unban User
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleBan}
              disabled={loading || !reason.trim()}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Banning...
                </>
              ) : (
                <>
                  <Ban size={18} />
                  Ban User
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
