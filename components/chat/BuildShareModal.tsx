import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { getSavedBuilds, SavedBuild } from '../../utils/buildStorage';
import { BuildData } from '../../services/chatService';

interface BuildShareModalProps {
  onClose: () => void;
  onSelectBuild: (buildData: BuildData, caption: string) => void;
}

export default function BuildShareModal({ onClose, onSelectBuild }: BuildShareModalProps) {
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const [selectedBuild, setSelectedBuild] = useState<SavedBuild | null>(null);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    const builds = getSavedBuilds();
    setSavedBuilds(builds);
  }, []);

  const handleSend = () => {
    if (!selectedBuild) return;

    // Convert SavedBuild to BuildData format
    const buildData: BuildData = {
      name: selectedBuild.name,
      components: selectedBuild.components,
      totalPrice: selectedBuild.totalPrice,
      createdAt: selectedBuild.dateCreated // Fix: use dateCreated from SavedBuild
    };

    onSelectBuild(buildData, caption);
    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IQ', {
      style: 'currency',
      currency: 'IQD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const getCPU = (build: SavedBuild) => {
    return build.components.cpu?.name || 'No CPU';
  };

  const getGPU = (build: SavedBuild) => {
    return build.components.gpu?.name || 'No GPU';
  };

  const getComponentCount = (build: SavedBuild) => {
    return Object.keys(build.components).length;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Share PC Build
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {savedBuilds.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No saved builds found. Create a build in the PC Builder first!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedBuilds.map((build) => (
                <button
                  key={build.id}
                  onClick={() => setSelectedBuild(build)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedBuild?.id === build.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {build.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {getComponentCount(build)} components
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatPrice(build.totalPrice)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>🔹 {getCPU(build)}</p>
                    <p>🔹 {getGPU(build)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with caption input and send button */}
        {selectedBuild && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={handleSend}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Send size={18} />
              Share Build
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
