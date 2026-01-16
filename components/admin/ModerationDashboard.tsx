import React, { useState, useEffect } from 'react';
import { Shield, Flag, Eye, EyeOff, Trash2, Ban, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { moderationService } from '../../services/moderationService';
import { ContentReport, ModerationAction } from '../../types/community-posts';
import toast from 'react-hot-toast';

interface ModerationDashboardProps {
  currentUserId: string;
}

export const ModerationDashboard: React.FC<ModerationDashboardProps> = ({ currentUserId }) => {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'reviewed' | 'dismissed' | 'all'>('pending');
  const [actionReason, setActionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadReports();
  }, [filter]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const filterValue = filter === 'all' ? undefined : filter;
      const reportsList = await moderationService.getReports(filterValue);
      setReports(reportsList);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModerationAction = async (
    reportId: string,
    action: 'hide' | 'delete' | 'ban' | 'warn' | 'dismiss'
  ) => {
    if (!actionReason.trim() && action !== 'dismiss') {
      toast.error('Please provide a reason for this action');
      return;
    }

    setIsProcessing(true);
    try {
      await moderationService.takeModerationAction(
        reportId,
        action,
        currentUserId,
        actionReason.trim() || 'No reason provided'
      );

      toast.success(`Action ${action} completed successfully`);
      setSelectedReport(null);
      setActionReason('');
      await loadReports();
    } catch (error: any) {
      console.error('Failed to take moderation action:', error);
      toast.error(error.message || 'Failed to complete action');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'reviewed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'dismissed':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Flag className="w-4 h-4 text-blue-500" />;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Content Moderation Dashboard
        </h1>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(['pending', 'reviewed', 'dismissed', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === status
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Reports ({reports.length})
          </h2>
          
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-20 animate-pulse" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No reports found for the selected filter
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedReport?.id === report.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.status)}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {report.postId ? 'Post' : 'Comment'} Report
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    <strong>Reason:</strong> {report.reason}
                  </p>
                  
                  {report.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {report.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Report Details & Actions */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          {selectedReport ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Report Details
                </h3>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedReport.status)}
                  <span className="text-sm capitalize text-gray-600 dark:text-gray-400">
                    {selectedReport.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Content Type
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedReport.postId ? 'Post' : 'Comment'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Report Reason
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedReport.reason}
                  </p>
                </div>

                {selectedReport.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Additional Details
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedReport.description}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reported At
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedReport.createdAt)}
                  </p>
                </div>

                {selectedReport.reviewedBy && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Reviewed By
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedReport.reviewedBy} at {formatDate(selectedReport.reviewedAt!)}
                    </p>
                  </div>
                )}
              </div>

              {selectedReport.status === 'pending' && (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Action Reason
                    </label>
                    <textarea
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Provide a reason for your moderation action..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleModerationAction(selectedReport.id, 'hide')}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
                    >
                      <EyeOff className="w-4 h-4" />
                      Hide
                    </button>

                    <button
                      onClick={() => handleModerationAction(selectedReport.id, 'delete')}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>

                    <button
                      onClick={() => handleModerationAction(selectedReport.id, 'warn')}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Warn
                    </button>

                    <button
                      onClick={() => handleModerationAction(selectedReport.id, 'ban')}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-red-800 hover:bg-red-900 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
                    >
                      <Ban className="w-4 h-4" />
                      Ban User
                    </button>

                    <button
                      onClick={() => handleModerationAction(selectedReport.id, 'dismiss')}
                      disabled={isProcessing}
                      className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      Dismiss Report
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Select a report to view details and take action
            </div>
          )}
        </div>
      </div>
    </div>
  );
};