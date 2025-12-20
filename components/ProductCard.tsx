import React from 'react';
import { Product } from '../types';
import { ExternalLink, ImageOff } from 'lucide-react';
import { formatPrice, calculateSavings } from '../services/priceUtils';
import { getProductImageUrl } from '../services/imageUtils';
import { FavoriteButton } from './ui/FavoriteButton';

interface ProductCardProps {
  product: Product;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, isFavorite = false, onToggleFavorite }) => {
  // Get the smart image URL (processed or original based on configuration)
  const imageResult = getProductImageUrl(product);
  const hasImage = Boolean(imageResult.url && imageResult.url !== '/placeholder.jpg');

  const savedAmount = product.compareAtPrice ? calculateSavings(product.compareAtPrice, product.price) : 0;
  const hasDiscount = savedAmount > 0;

  // Use the detected currency or default to IQD
  const currency = product.detectedCurrency || 'IQD';

  // Check if product has no price (price is 0)
  const hasNoPrice = product.price === 0;

  // Check if product is out of stock
  const isOutOfStock = product.inStock === false;

  // Format prices for display using the normalized values
  const formattedPrice = hasNoPrice ? null : formatPrice(product.price, currency);
  const formattedComparePrice = product.compareAtPrice ? formatPrice(product.compareAtPrice, currency) : null;
  const formattedSavedAmount = savedAmount > 0 ? formatPrice(savedAmount, currency) : null;

  // Transform retailer names for display
  const getDisplayRetailerName = (retailer: string): string => {
    const lower = retailer.toLowerCase();
    if (lower.includes('spniq')) return 'SpiderNet';
    if (lower.includes('3d-iraq') || lower.includes('3diraq')) return '3D';
    return retailer;
  };

  return (
    <div className="group relative bg-nexus-900 rounded-xl border border-white/5 hover:border-nexus-accent/40 overflow-hidden transition-all duration-500 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] hover:-translate-y-1 flex flex-col h-full">

      {/* Top Bar: Retailer & Discount */}
      <div className="absolute top-0 left-0 right-0 p-2.5 z-10 flex justify-between items-start pointer-events-none">
        {/* Retailer Logo */}
        <div>
          {product.retailer.toLowerCase().includes('jokercenter') ? (
            <div className="flex items-center gap-2 bg-neutral-900 px-2 py-1 rounded backdrop-blur-sm border border-white/10">
              <img
                src="/WebSitesLogo/jokercenter.webp"
                alt="JokerCenter"
                className="h-6 w-auto object-contain"
              />
              <span className="text-xs font-bold !text-white" style={{ color: '#ffffff' }}>JOKER CENTER</span>
            </div>
          ) : product.retailer.toLowerCase().includes('almanjam') ? (
            <div className="inline-flex items-center justify-center bg-opacity-90 rounded-md px-2 py-1 h-9" style={{ backgroundColor: '#16232C' }}>
              <img
                src="/WebSitesLogo/almanjam.png"
                alt="Almanjam"
                className="h-7 w-auto object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-[8px] font-bold text-white">ALMANJAM</span>`;
                  }
                }}
              />
            </div>
          ) : product.retailer.toLowerCase().includes('altajit') ? (
            <div className="rounded-lg px-2 py-1 h-8 flex items-center justify-center">
              <img
                src="/WebSitesLogo/altajit.png"
                alt="Altajit"
                className="h-12 w-auto max-w-48 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-[9px] font-bold text-gray-200 px-1.5">ALTAJIT</span>`;
                  }
                }}
              />
            </div>
          ) : product.retailer.toLowerCase().includes('galaxy') ? (
            <div className="rounded-lg px-2 py-1 h-8 flex items-center justify-center">
              <img
                src="/WebSitesLogo/galaxyiq.png"
                alt="Galaxy IQ"
                className="h-6 w-auto max-w-20 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-[9px] font-bold text-gray-200 px-1.5">GALAXY IQ</span>`;
                  }
                }}
              />
            </div>
          ) : product.retailer.toLowerCase().includes('spniq') ? (
            <div className="backdrop-blur-sm rounded-lg px-2 py-1 h-8 flex items-center justify-center shadow-lg bg-[#1D1D25]">
              <img
                src={`/WebSitesLogo/${product.retailer.toLowerCase().replace(/[-\s]/g, '').replace('3diraq', '3d-iraq').replace('spniq', 'SpiderNet')}.svg`}
                alt={product.retailer}
                className="h-7 w-auto max-w-24 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-[9px] font-bold text-gray-200 px-1.5">${getDisplayRetailerName(product.retailer).toUpperCase()}</span>`;
                  }
                }}
              />
            </div>
          ) : (
            <div className={`flex items-center justify-center ${product.retailer.toLowerCase().includes('globaliraq') || product.retailer.toLowerCase().includes('global')
              ? 'h-8' : product.retailer.toLowerCase().includes('alityan')
                ? 'h-12' : 'h-10'
              }`}>
              <img
                src={`/WebSitesLogo/${product.retailer.toLowerCase().replace(/[-\s]/g, '').replace('3diraq', '3d-iraq').replace('spniq', 'SpiderNet')}.svg`}
                alt={product.retailer}
                className={`w-auto object-contain ${product.retailer.toLowerCase().includes('globaliraq') || product.retailer.toLowerCase().includes('global')
                  ? 'h-12 max-w-28' : product.retailer.toLowerCase().includes('alityan')
                    ? 'h-10 max-w-24' : 'h-8 max-w-24'
                  }`}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const span = document.createElement('span');
                  span.className = 'text-[9px] font-bold text-gray-200';
                  span.textContent = getDisplayRetailerName(product.retailer).toUpperCase();
                  target.parentElement?.replaceChild(span, target);
                }}
              />
            </div>
          )}
        </div>

        {/* Right side: Badges only (Favorite moved to image) */}
        <div className="flex items-center gap-2">
          {/* Out of Stock Badge or Discount Badge */}
          {isOutOfStock ? (
            <div className="bg-gradient-to-r from-red-700 to-red-600 px-2.5 py-1 rounded-full shadow-lg shadow-red-900/20 flex items-center gap-1">
              <span className="text-[12px] font-bold !text-white" style={{ fontFamily: 'Tahoma, Arial, sans-serif', color: '#ffffff' }}>نفذ المخزون</span>
            </div>
          ) : !hasNoPrice && hasDiscount && formattedSavedAmount && (
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-2.5 py-1 rounded-full shadow-lg shadow-green-900/20 flex items-center gap-1 animate-in zoom-in duration-300">
              <span className="text-[12px] font-bold !text-white" style={{ fontFamily: 'Tahoma, Arial, sans-serif', color: '#ffffff' }}>وفر {formattedSavedAmount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Image Container */}
      <a href={product.url} target="_blank" rel="noopener noreferrer" className="block relative aspect-square w-full overflow-hidden group/image bg-white">
        {hasImage ? (
          <div className="w-full h-full relative">
            <img
              src={imageResult.url}
              alt={product.title}
              className="w-full h-full object-contain p-6 transition-transform duration-700 ease-out group-hover/image:scale-110"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden absolute inset-0 flex items-center justify-center text-gray-400 bg-white">
              <ImageOff size={24} />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-white">
            <ImageOff size={32} />
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />

        {/* Favorite Button - Bottom Right */}
        {onToggleFavorite && (
          <div className="absolute bottom-3 right-3 z-30">
            <div className="bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-lg hover:scale-[0.55] transition-transform duration-200 scale-50">
              <FavoriteButton
                isFavorite={isFavorite}
                onToggle={() => onToggleFavorite(product.id)}
              />
            </div>
          </div>
        )}
      </a>

      {/* Details Section */}
      <div className="p-4 flex flex-col flex-grow bg-gradient-to-b from-nexus-900 to-nexus-950">

        <a href={product.url} target="_blank" rel="noopener noreferrer" className="block mb-3">
          <h3 className="text-base font-semibold text-gray-200 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-nexus-accent transition-colors duration-300" title={product.title}>
            {product.title}
          </h3>
        </a>

        <div className="mt-auto flex items-end justify-between gap-2">
          {/* Price Block */}
          <div className="flex flex-col">
            <div className="flex flex-col">
              {!hasNoPrice && hasDiscount && formattedComparePrice && (
                <span className="text-xs text-gray-500 line-through decoration-red-500/50">
                  {formattedComparePrice} {currency}
                </span>
              )}
              <div className="flex items-baseline gap-1">
                {hasNoPrice ? (
                  <span className="text-lg font-semibold text-red-400 bg-clip-text" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
                    {isOutOfStock ? "غير متوفر" : "😑 السعر خاص"}
                  </span>
                ) : (
                  <>
                    <span className={`text-xl font-bold tracking-tight bg-clip-text text-transparent ${hasDiscount
                      ? 'bg-gradient-to-r from-red-400 to-rose-400'
                      : 'bg-gradient-to-r from-white to-gray-300'
                      }`}>
                      {formattedPrice}
                    </span>
                    <span className="text-xs font-semibold text-gray-600">{currency}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${isOutOfStock || hasNoPrice
              ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-nexus-accent to-blue-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105'
              }`}
          >
            <ExternalLink size={14} />
            <span>View</span>
          </a>
        </div>
      </div>
    </div>
  );
};