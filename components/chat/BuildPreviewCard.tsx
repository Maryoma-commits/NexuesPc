import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, Monitor, X, Download } from 'lucide-react';
import { BuildData } from '../../services/chatService';

interface BuildPreviewCardProps {
  buildData: BuildData;
  isSender: boolean;
  onLoadBuild?: (buildData: BuildData) => void;
}

export default function BuildPreviewCard({ buildData, isSender, onLoadBuild }: BuildPreviewCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IQ', {
      style: 'currency',
      currency: 'IQD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const getCPU = () => {
    const cpu = buildData.components.cpu;
    return cpu?.name || cpu?.title || 'No CPU';
  };

  const getGPU = () => {
    const gpu = buildData.components.gpu;
    return gpu?.name || gpu?.title || 'No GPU';
  };

  const getComponentCount = () => {
    return Object.keys(buildData.components).length;
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      cpu: '🔹',
      gpu: '🎮',
      ram: '💾',
      motherboard: '🔧',
      storage: '💿',
      psu: '⚡',
      cooler: '❄️',
      case: '📦'
    };
    return icons[category] || '🔹';
  };

  return (
    <>
      {/* Build Preview Card - Compact */}
      <div 
        onClick={() => setIsModalOpen(true)}
        className={`w-full max-w-[200px] rounded-lg border-2 overflow-hidden cursor-pointer hover:shadow-lg transition-all ${
          isSender 
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="p-3">
          {/* Icon */}
          <div className="flex items-center justify-center mb-2">
            <div className={`p-1.5 rounded-lg ${isSender ? 'bg-blue-600' : 'bg-gray-600'}`}>
              <Monitor size={20} className="text-white" />
            </div>
          </div>

          {/* Build Name */}
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate mb-1 text-center">
            {buildData.name}
          </h4>

          {/* Price */}
          <p className="text-base font-bold text-blue-600 dark:text-blue-400 mb-1 text-center">
            {formatPrice(buildData.totalPrice)}
          </p>

          {/* Component Count */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
            {getComponentCount()} components
          </p>

          {/* Compact Preview - CPU & GPU */}
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu size={12} className="flex-shrink-0" />
              <span className="truncate">{getCPU()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Monitor size={12} className="flex-shrink-0" />
              <span className="truncate">{getGPU()}</span>
            </div>
          </div>

          {/* Click to view hint */}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
            Click to view details
          </p>
        </div>
      </div>

      {/* Modal - Full Build Details */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          
          {/* Modal Content */}
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">
                  {buildData.name}
                </h3>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {formatPrice(buildData.totalPrice)}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="ml-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Components List */}
            <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(80vh-180px)]">
              {Object.entries(buildData.components).map(([category, component]: [string, any]) => (
                <div 
                  key={category}
                  className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                >
                  {/* Component Image */}
                  <img
                    src={component.imageUrl || component.image || ''}
                    alt={component.title || component.name || 'Component'}
                    className="w-20 h-20 object-contain rounded flex-shrink-0"
                  />

                  {/* Component Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
                      {getCategoryIcon(category)} {category}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mt-1">
                      {component.title || component.name || 'Component'}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {formatPrice(component.price || 0)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {component.retailer || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              {/* Load Build Button */}
              {onLoadBuild && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadBuild(buildData);
                    setIsModalOpen(false);
                  }}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                           transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Load Build in PC Builder
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
