
import React from 'react';
import { SlidersHorizontal, TrendingUp, ArrowDownWideNarrow, ArrowUpNarrowWide, Store, CheckCircle2 } from 'lucide-react';
import { SortOption } from '../types';

interface SidebarProps {
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  resultCount: number;
  retailers: { name: string; count: number }[];
  selectedRetailer: string;
  onRetailerChange: (retailer: string) => void;
  showOutOfStock: boolean;
  onToggleOutOfStock: () => void;
  showOnDiscountOnly: boolean;
  onToggleDiscountOnly: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  sortOption, 
  onSortChange, 
  resultCount,
  retailers,
  selectedRetailer,
  onRetailerChange,
  showOutOfStock,
  onToggleOutOfStock,
  showOnDiscountOnly,
  onToggleDiscountOnly
}) => {
  
  // Transform retailer names for display
  const getDisplayRetailerName = (retailer: string): string => {
    const lower = retailer.toLowerCase();
    if (lower.includes('spniq')) return 'SpiderNet';
    if (lower.includes('3d-iraq') || lower.includes('3diraq')) return '3D';
    return retailer;
  };
  return (
    <div className="w-full lg:w-72 flex-shrink-0 space-y-4 sticky top-28 animate-slide-up max-h-[calc(100vh-8rem)] overflow-y-auto">
      

      {/* Retailers */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-2">
            <Store size={14} className="text-nexus-accent" />
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Retailers</h3>
        </div>
        <div className="space-y-2">
            {retailers.map((r) => {
                const isActive = selectedRetailer === r.name;
                return (
                    <button
                        key={r.name}
                        onClick={() => onRetailerChange(r.name)}
                        className={`group w-full flex items-center justify-between p-2 rounded-lg border transition-all duration-300 ${
                            isActive
                            ? 'bg-nexus-accent/10 border-nexus-accent/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                            : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                        }`}
                    >
                        <span className={`text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                            {getDisplayRetailerName(r.name)}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                            isActive 
                            ? 'bg-nexus-accent text-nexus-950' 
                            : 'bg-black/30 text-gray-500'
                        }`}>
                            {r.count}
                        </span>
                    </button>
                );
            })}
        </div>
      </div>

      {/* Stock Toggle */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-2">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Show Products</span>
        </div>
        
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-transparent">
          <span className="text-sm font-medium text-gray-400">
            In Stock Only
          </span>
          
          {/* Cyber Toggle Switch */}
          <div className="cyber-toggle">
            <input 
              id="stockToggle"
              className="cyber-input" 
              type="checkbox"
              checked={!showOutOfStock}
              onChange={onToggleOutOfStock}
            />
            <label htmlFor="stockToggle" className="cyber-label">
              <div className="cyber-core">
                <div className="cyber-toggle-circle"></div>
              </div>
              <div className="cyber-power-line"></div>
              <div className="cyber-power-ring">
                <div
                  style={{"--x": "10%", "--y": "20%", "--px": "15px", "--py": "-10px", "--delay": "0.1s"} as React.CSSProperties}
                  className="ring-particle"
                ></div>
                <div
                  style={{"--x": "70%", "--y": "30%", "--px": "-10px", "--py": "15px", "--delay": "0.3s"} as React.CSSProperties}
                  className="ring-particle"
                ></div>
                <div
                  style={{"--x": "40%", "--y": "80%", "--px": "20px", "--py": "10px", "--delay": "0.5s"} as React.CSSProperties}
                  className="ring-particle"
                ></div>
                <div
                  style={{"--x": "90%", "--y": "60%", "--px": "-15px", "--py": "-15px", "--delay": "0.7s"} as React.CSSProperties}
                  className="ring-particle"
                ></div>
              </div>
              <div className="cyber-particles">
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
              </div>
            </label>
          </div>
        </div>
        
        {/* Discount Toggle */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-transparent mt-2">
          <span className="text-sm font-medium text-gray-400">
            On Discount Only
          </span>
          
          {/* Cyber Toggle Switch */}
          <div className="cyber-toggle">
            <input 
              id="discountToggle"
              className="cyber-input" 
              type="checkbox"
              checked={showOnDiscountOnly}
              onChange={onToggleDiscountOnly}
            />
            <label htmlFor="discountToggle" className="cyber-label">
              <div className="cyber-core">
                <div className="cyber-toggle-circle"></div>
              </div>
              <div className="cyber-power-line"></div>
              <div className="cyber-power-ring">
                <div
                  style={{"--x": "10%", "--y": "20%", "--px": "15px", "--py": "-10px", "--delay": "0.1s"} as React.CSSProperties}
                  className="ring-particle"
                ></div>
                <div
                  style={{"--x": "70%", "--y": "30%", "--px": "-10px", "--py": "15px", "--delay": "0.3s"} as React.CSSProperties}
                  className="ring-particle"
                ></div>
                <div
                  style={{"--x": "40%", "--y": "80%", "--px": "20px", "--py": "10px", "--delay": "0.5s"} as React.CSSProperties}
                  className="ring-particle"
                ></div>
                <div
                  style={{"--x": "90%", "--y": "60%", "--px": "-15px", "--py": "-15px", "--delay": "0.7s"} as React.CSSProperties}
                  className="ring-particle"
                ></div>
              </div>
              <div className="cyber-particles">
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Sort */}
      <div>
        <div className="flex items-center gap-2 mb-2 px-2">
            <SlidersHorizontal size={14} className="text-nexus-secondary" />
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Sort By</h3>
        </div>
        <div className="space-y-2">
            {[
                { id: 'best-selling', label: 'Best Selling', icon: TrendingUp },
                { id: 'price-asc', label: 'Price: Low to High', icon: ArrowDownWideNarrow },
                { id: 'price-desc', label: 'Price: High to Low', icon: ArrowUpNarrowWide },
            ].map((option) => {
                const isActive = sortOption === option.id;
                const Icon = option.icon;
                return (
                    <button
                        key={option.id}
                        onClick={() => onSortChange(option.id as SortOption)}
                        className={`group w-full flex items-center gap-3 p-2 rounded-lg border transition-all duration-300 ${
                            isActive 
                            ? 'bg-nexus-secondary/10 border-nexus-secondary/50 text-white shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                            : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:border-white/10'
                        }`}
                    >
                        <Icon size={16} className={`${isActive ? 'text-nexus-secondary' : 'text-gray-500 group-hover:text-gray-300'}`} />
                        <span className="text-sm font-medium flex-1 text-left">{option.label}</span>
                        {isActive && <CheckCircle2 size={16} className="text-nexus-secondary" />}
                    </button>
                )
            })}
        </div>
      </div>
    </div>
  );
};
