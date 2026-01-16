import React, { useState } from 'react';
import { X, Flag, AlertTriangle } from 'lucide-react';
import { moderationService } from '../../services/moderationService';
import toast from 'react-hot-toast';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  commentId?: string;
  contentType: 'post' | 'comment';
}

const REPORT_REASONS = [
  'Spam or unwanted content',
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Violence or threats',
  'Inappropriate or adult content',
  'Misinformation or fake news',
  'Copyright violation',
  'Other'
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  postId,
  commentId,
  contentType
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedReason) {
      toast.error('Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const reason = selectedReason === 'Other' ? customReason : selectedReason;
      
      await moderationService.reportContent(
        {
          postId,
          commentId,
          reason,
          description: description.trim() || undefined
        },
        'current-user-id' // This should come from auth context
      );
      
      toast.success('Content reported successfully. Thank you for helping keep our community safe.');
      onClose();
      
      // Reset form
      setSelectedReason('');
      setCustomReason('');
      setDescription('');
      
    } catch (error: any) {
      console.error('Failed to report content:', error);
      toast.error(error.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Report {contentType}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium mb-1">Help us understand the issue</p>
              <p>Your report will be reviewed by our moderation team. False reports may result in account restrictions.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Why are you reporting this {contentType}?
            </label>
            <div className="space-y-2">
              {REPORT_REASONS.map((reason) => (
                <label key={reason} className="flex items-center">
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mr-3 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Please specify the reason
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter your reason..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                maxLength={500}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional details (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context that might help our review..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              maxLength={1000}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {description.length}/1000 characters
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedReason || isSubmitting || (selectedReason === 'Other' && !customReason.trim())}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};