// PriceUpdateNotification Component for NexusPC Community Posts
// Requirements: 5.3
import React, { FC } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Bell,
  X,
  ExternalLink
} from 'lucide-react';
import { 
  PriceUpdateNotification as PriceUpdate,
  ProductDisplayLogic
} from '../../services/productIntegrationService';

interface PriceUpdateNotificationItemProps {
  notification: PriceUpdate;
  onDismiss?: (id: string) => void;
  onViewProduct?: (productId: string) => void;
}

const PriceUpdateNotificationItem: FC<PriceUpdateNotificationItemProps> = ({
  notification,
  onDismiss,
  onViewProduct
}) => {
  const isPriceDecrease = notification.priceChange < 0;
  const formatPrice = ProductDisplayLogic.formatPrice;

  return (
    <div className={`relative p-4 rounded-lg border ${
      isPriceDecrease
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }`}>
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={() => onDismiss(notification.id)}
          className="absolute top-2 right-2 p-1 hover:bg-black/10 rounded-full transition-colors"
        >
          <X size={16} className="text-gray-500" />
        </button>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-full ${
          isPriceDecrease
            ? 'bg-green-100 dark:bg-green-800/30'
            : 'bg-red-100 dark:bg-red-800/30'
        }`}>
          {isPriceDecrease ? (
            <TrendingDown size={20} className="text-green-600 dark:text-green-400" />
          ) : (
            <TrendingUp size={20} className="text-red-600 dark:text-red-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Price {isPriceDecrease ? 'Drop' : 'Increase'} Alert
            </span>
          </div>

          <h4 className="mt-1 font-medium text-gray-900 dark:text-white truncate">
            {notification.productTitle}
          </h4>

          <div className="mt-2 flex items-center gap-3">
            {/* Old price */}
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(notification.oldPrice)}
            </span>

            {/* Arrow */}
            <span className="text-gray-400">→</span>

            {/* New price */}
            <span className={`text-sm font-semibold ${
              isPriceDecrease
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatPrice(notification.newPrice)}
            </span>

            {/* Percentage change */}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isPriceDecrease
                ? 'bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300'
            }`}>
              {isPriceDecrease ? '' : '+'}{notification.percentageChange}%
            </span>
          </div>

          {/* View product button */}
          {onViewProduct && (
            <button
              onClick={() => onViewProduct(notification.productId)}
              className="mt-3 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View product
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Export the item component as default
export default PriceUpdateNotificationItem;

// Component for displaying multiple price update notifications
interface PriceUpdateListProps {
  notifications: PriceUpdate[];
  onDismiss?: (id: string) => void;
  onViewProduct?: (productId: string) => void;
  onDismissAll?: () => void;
}

export function PriceUpdateList({
  notifications,
  onDismiss,
  onViewProduct,
  onDismissAll
}: PriceUpdateListProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <Bell size={18} className="text-blue-500" />
          Price Updates ({notifications.length})
        </h3>
        {onDismissAll && notifications.length > 1 && (
          <button
            onClick={onDismissAll}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Dismiss all
          </button>
        )}
      </div>

      {/* Notifications */}
      <div className="space-y-2">
        {notifications.map((notification) => (
          <PriceUpdateNotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
            onViewProduct={onViewProduct}
          />
        ))}
      </div>
    </div>
  );
}
