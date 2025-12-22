// User Profile Menu for Chat Avatars
import { MessageCircle } from 'lucide-react';

interface UserProfileMenuProps {
  userId: string;
  userName: string;
  userPhoto: string;
  position: { x: number; y: number };
  onClose: () => void;
  onSendMessage: () => void;
  isCurrentUser: boolean;
}

export default function UserProfileMenu({
  userId,
  userName,
  userPhoto,
  position,
  onClose,
  onSendMessage,
  isCurrentUser
}: UserProfileMenuProps) {
  
  if (isCurrentUser) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Menu */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[200px]"
        style={{ 
          left: `${position.x}px`, 
          top: `${position.y}px`,
          transform: 'translateY(-50%)'
        }}
      >
        {/* User Info */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <img
            src={userPhoto}
            alt={userName}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {userName}
            </p>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => {
            onSendMessage();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
        >
          <MessageCircle size={16} />
          Send Message
        </button>
      </div>
    </>
  );
}
