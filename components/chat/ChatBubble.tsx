// Floating Chat Bubble Component
import { useState, useEffect } from 'react';
import { MessageCircle, X, Mail } from 'lucide-react';
import { auth } from '../../firebase.config';
import { useAuth } from '../../contexts/AuthContext';
import { resendVerificationEmail } from '../../services/authService';
import { BuildData, setCurrentlyViewingGlobalChat } from '../../services/chatService';
import AuthModal from '../auth/AuthModal';
import ChatWindow from './ChatWindow';

interface ChatBubbleProps {
  onLoadBuild?: (buildData: BuildData) => void;
}

export default function ChatBubble({ onLoadBuild }: ChatBubbleProps = {}) {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showVerificationWarning, setShowVerificationWarning] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (!user) {
      setIsOpen(false);
    }
  }, [user]);

  const handleBubbleClick = () => {
    // Don't do anything if still loading auth state
    if (loading) return;
    
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Check if email is verified (for email/password users)
    if (user.providerData[0]?.providerId === 'password' && !user.emailVerified) {
      setShowVerificationWarning(true);
      return;
    }

    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0); // Reset unread count when opening
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Immediately clear viewing status when closing chat
    if (auth.currentUser) {
      setCurrentlyViewingGlobalChat(auth.currentUser.uid, false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      await resendVerificationEmail();
      setResendMessage('✅ Verification email sent! Check your inbox.');
    } catch (err: any) {
      setResendMessage('❌ ' + err.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Bubble */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Chat Window */}
        {isOpen && user && (
          <div className="mb-4 animate-in slide-in-from-bottom-5 duration-300">
            <ChatWindow
              onClose={handleClose}
              onNewMessage={() => {
                if (!isOpen) {
                  setUnreadCount(prev => prev + 1);
                }
              }}
              onLoadBuild={onLoadBuild}
              isOpen={isOpen}
            />
          </div>
        )}

        {/* Chat Bubble Button */}
        <button
          data-chat-bubble
          onClick={handleBubbleClick}
          className="
            relative bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
            text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-110
            w-16 h-16
          "
          aria-label="Open chat"
        >
          {isOpen ? (
            <X size={28} className="mx-auto" />
          ) : (
            <>
              <MessageCircle size={28} className="mx-auto" />
              {unreadCount > 0 && !isOpen && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </>
          )}
        </button>

        {/* Online indicator - only show when chat is closed */}
        {user && !isOpen && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          setIsOpen(true);
        }}
      />

      {/* Email Verification Warning Modal */}
      {showVerificationWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowVerificationWarning(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-yellow-600 dark:text-yellow-400" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Verify Your Email
              </h3>

              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Please verify your email address before accessing the chat. Check your inbox for the verification link.
              </p>

              {resendMessage && (
                <p className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                  {resendMessage}
                </p>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? 'Sending...' : 'Resend Verification Email'}
                </button>

                <button
                  onClick={() => {
                    setShowVerificationWarning(false);
                    window.location.reload(); // Reload to check if verified
                  }}
                  className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-3 rounded-lg transition-colors"
                >
                  I've Verified - Refresh
                </button>

                <button
                  onClick={() => setShowVerificationWarning(false)}
                  className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white py-2 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
