// Delete User Modal - Confirmation and options for deleting users
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../../services/authService';
import { deleteUserAccount } from '../../services/adminService';
import toast from 'react-hot-toast';

interface DeleteUserModalProps {
  user: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteUserModal({ user, onClose, onSuccess }: DeleteUserModalProps) {
  const [deleteMessages, setDeleteMessages] = useState<'anonymize' | 'delete'>('anonymize');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteUserAccount(user.uid, deleteMessages === 'delete');
      toast.success(`User ${user.displayName} has been deleted`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to delete user: ' + error.message);
    } finally {
      setLoading(false);
    }
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
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
              <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete User</h2>
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
          {/* Warning */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 font-medium mb-2">
              ⚠️ This action cannot be undone!
            </p>
            <p className="text-red-700 dark:text-red-300 text-sm mb-3">
              You are about to delete <strong>{user.displayName}</strong> ({user.email})
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded p-3 mt-3">
              <p className="text-yellow-800 dark:text-yellow-200 text-xs font-medium mb-1">
                ℹ️ Important Note:
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                This removes the user from the database only. They can still sign in until you manually delete them from Firebase Console → Authentication.
              </p>
            </div>
          </div>

          {/* Message Handling Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              What should happen to their messages?
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  name="deleteMessages"
                  value="anonymize"
                  checked={deleteMessages === 'anonymize'}
                  onChange={(e) => setDeleteMessages(e.target.value as any)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Keep Messages (Anonymize)</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Messages will remain but show as "[Message from deleted user]"
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  name="deleteMessages"
                  value="delete"
                  checked={deleteMessages === 'delete'}
                  onChange={(e) => setDeleteMessages(e.target.value as any)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Delete All Messages</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Permanently removes all their messages and conversations
                  </p>
                </div>
              </label>
            </div>
          </div>

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
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={18} />
                Delete User
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
