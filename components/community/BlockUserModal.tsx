import React, { useState } from 'react';
import { X, UserX, AlertTriangle } from 'lucide-react';
import { moderationService } from '../../services/moderationService';
import toast from 'react-hot-toast';

interface BlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onUserBlocked?: () => void;
}

export const BlockUserModal: React.FC<BlockUserModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  onUserBlocked
}) => {
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlock = async () => {
    setIsBlocking(true);
    
    try {
      await moderationService.blockUser('current-user-id', userId); // This should come from auth context
      
      toast.success(`${userName} has been blocked. You will no longer see their content.`);
      onUserBlocked?.();
      onClose();
      
    } catch (error: any) {
      console.error('Failed to block user:', error);
      toast.error(error.message || 'Failed to block user. Please try again.');
    } finally {
      setIsBlocking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Block User
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-200">
              <p className="font-medium mb-1">Are you sure you want to block {userName}?</p>
              <ul className="space-y-1 text-xs">
                <li>• You won't see their posts or comments</li>
                <li>• They won't be able to follow you or see your content</li>
                <li>• Any existing follow relationships will be removed</li>
                <li>• You can unblock them later from your settings</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={isBlocking}
            >
              Cancel
            </button>
            <button
              onClick={handleBlock}
              disabled={isBlocking}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isBlocking ? 'Blocking...' : 'Block User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};