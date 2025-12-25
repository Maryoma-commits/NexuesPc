import { useState } from 'react';
import { Cpu, Monitor, ChevronDown, ChevronUp } from 'lucide-react';
import { BuildData } from '../../services/chatService';

interface BuildPreviewCardProps {
  buildData: BuildData;
  isSender: boolean;
}

export default function BuildPreviewCard({ buildData, isSender }: BuildPreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div 
      className={`w-full max-w-[280px] rounded-lg border-2 overflow-hidden ${
        isSender 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Compact Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 cursor-pointer hover:bg-opacity-80 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`p-2 rounded-lg ${isSender ? 'bg-blue-600' : 'bg-gray-600'}`}>
            <Monitor size={24} className="text-white" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 dark:text-white truncate">
              {buildData.name}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getComponentCount()} components
            </p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
              {formatPrice(buildData.totalPrice)}
            </p>
          </div>

          {/* Expand icon */}
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {/* Compact Preview - CPU & GPU */}
        {!isExpanded && (
          <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex items-center gap-2 truncate">
              <Cpu size={14} className="flex-shrink-0" />
              <span className="truncate">{getCPU()}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              <Monitor size={14} className="flex-shrink-0" />
              <span className="truncate">{getGPU()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded View - All Components */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2 max-h-96 overflow-y-auto">
          {Object.entries(buildData.components).map(([category, component]: [string, any]) => (
            <div 
              key={category}
              className="flex items-start gap-2 p-2 rounded bg-white dark:bg-gray-700/50"
            >
              {/* Component Image */}
              <img
                src={component.imageUrl || component.image || ''}
                alt={component.title || component.name || 'Component'}
                className="w-12 h-12 object-contain rounded flex-shrink-0"
              />

              {/* Component Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                  {getCategoryIcon(category)} {category}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {component.title || component.name || 'Component'}
                </p>
                <div className="flex items-center justify-between mt-1">
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

          {/* Total */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 dark:text-white">Total</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatPrice(buildData.totalPrice)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
