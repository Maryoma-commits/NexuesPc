import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { generateShareURL } from '../utils/buildEncoder';
import { exportBuildAsText, SavedBuild } from '../utils/buildStorage';

interface ShareBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: any;
  totalPrice: number;
  buildName?: string;
}

export default function ShareBuildModal({ isOpen, onClose, components, totalPrice, buildName }: ShareBuildModalProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [textExported, setTextExported] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const url = generateShareURL(components, buildName);
      setShareUrl(url);
      setCopied(false);
      setTextExported(false);
    }
  }, [isOpen, components, buildName]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportText = () => {
    const mockBuild: SavedBuild = {
      id: 'temp',
      name: buildName || 'My PC Build',
      dateCreated: Date.now(),
      dateModified: Date.now(),
      components,
      totalPrice,
    };

    const text = exportBuildAsText(mockBuild);
    
    // Create blob and download
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${buildName || 'pc-build'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTextExported(true);
    setTimeout(() => setTextExported(false), 2000);
  };

  const handleCopyText = async () => {
    const mockBuild: SavedBuild = {
      id: 'temp',
      name: buildName || 'My PC Build',
      dateCreated: Date.now(),
      dateModified: Date.now(),
      components,
      totalPrice,
    };

    const text = exportBuildAsText(mockBuild);
    
    try {
      await navigator.clipboard.writeText(text);
      setTextExported(true);
      setTimeout(() => setTextExported(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(shareUrl, '_blank');
  };

  if (!isOpen) return null;

  const componentCount = Object.values(components).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Your Build
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Build Summary */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              {buildName || 'My PC Build'}
            </h3>
            <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>💰 {totalPrice.toLocaleString()} IQD</span>
              <span>📦 {componentCount} components</span>
            </div>
          </div>

          {/* Share URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopyUrl}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              💡 Anyone with this link can view and import your build
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleOpenInNewTab}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 
                       dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 
                       text-gray-700 dark:text-gray-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </button>
            <button
              onClick={handleCopyText}
              className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg 
                       transition-colors ${
                         textExported
                           ? 'bg-green-600 text-white border-green-600'
                           : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                       }`}
            >
              {textExported ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy as Text
                </>
              )}
            </button>
          </div>

          {/* Export */}
          <div>
            <button
              onClick={handleExportText}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 
                       bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700
                       text-white rounded-lg transition-all font-medium"
            >
              <Download className="w-4 h-4" />
              Download as Text File
            </button>
          </div>

          {/* Social Sharing Hint */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              📱 <strong>Share on social media:</strong> Copy the link and share it on WhatsApp, 
              Facebook, or Discord to get feedback on your build!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                     dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg 
                     transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
