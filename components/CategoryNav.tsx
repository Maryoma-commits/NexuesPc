
import React, { useState, useCallback } from 'react';
import {
  ChevronDown,
  Grid3X3,
  Monitor,
  MemoryStick,
  Cpu,
  CircuitBoard,
  Zap,
  Box,
  HardDrive,
  Fan,
  Laptop,
  Mouse,
  Keyboard,
  Headphones,
  Gamepad2
} from 'lucide-react';

interface CategoryNavProps {
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
  productCounts: { [category: string]: number };
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategory,
  onCategorySelect,
  productCounts
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const handleDropdownClick = useCallback((categoryId: string) => {
    if (isDropdownOpen === categoryId) {
      setIsDropdownOpen(null);
    } else {
      setIsDropdownOpen(categoryId);
    }
  }, [isDropdownOpen]);

  // Function to get icon for each category
  const getCategoryIcon = (categoryId: string | null) => {
    switch (categoryId) {
      case null: return <Grid3X3 className="w-4 h-4" />;
      case 'GPU': return <Gamepad2 className="w-4 h-4" />;
      case 'RAM': return <MemoryStick className="w-4 h-4" />;
      case 'Laptop RAM': return <MemoryStick className="w-4 h-4" />;
      case 'CPU': return <Cpu className="w-4 h-4" />;
      case 'Motherboards': return <CircuitBoard className="w-4 h-4" />;
      case 'Power Supply': return <Zap className="w-4 h-4" />;
      case 'Case': return <Box className="w-4 h-4" />;
      case 'Storage': return <HardDrive className="w-4 h-4" />;
      case 'Cooler': return <Fan className="w-4 h-4" />;
      case 'Fans': return <Fan className="w-4 h-4" />;
      case 'Thermals': return <Zap className="w-4 h-4" />;
      case 'Monitor': return <Monitor className="w-4 h-4" />;
      case 'Laptop': return <Laptop className="w-4 h-4" />;
      case 'Mouse': return <Mouse className="w-4 h-4" />;
      case 'Keyboard': return <Keyboard className="w-4 h-4" />;
      case 'Headset': return <Headphones className="w-4 h-4" />;
      default: return <Grid3X3 className="w-4 h-4" />;
    }
  };

  const categories = [
    { id: null, label: 'All', count: Object.values(productCounts).reduce((a: number, b: number) => a + b, 0) },
    { id: 'GPU', label: 'GPUs', count: productCounts['GPU'] || 0 },
    {
      id: 'RAM',
      label: 'RAM',
      count: (productCounts['RAM'] || 0) + (productCounts['Laptop RAM'] || 0),
      isDropdown: true,
      children: [
        { id: 'RAM', label: 'Desktop RAM', count: productCounts['RAM'] || 0 },
        { id: 'Laptop RAM', label: 'Laptop RAM', count: productCounts['Laptop RAM'] || 0 }
      ]
    },
    { id: 'CPU', label: 'CPUs', count: productCounts['CPU'] || 0 },
    { id: 'Motherboards', label: 'Motherboards', count: productCounts['Motherboards'] || 0 },
    { id: 'Power Supply', label: 'PSUs', count: productCounts['Power Supply'] || 0 },
    { id: 'Case', label: 'Cases', count: productCounts['Case'] || 0 },
    { id: 'Storage', label: 'Storage', count: productCounts['Storage'] || 0 },
    { id: 'Cooler', label: 'Coolers', count: productCounts['Cooler'] || 0 },
    { id: 'Monitor', label: 'Monitors', count: productCounts['Monitor'] || 0 },
    { id: 'Laptop', label: 'Laptops', count: productCounts['Laptop'] || 0 },
    {
      id: 'Accessories',
      label: 'More',
      count: (productCounts['Mouse'] || 0) + (productCounts['Keyboard'] || 0) + (productCounts['Headset'] || 0) + (productCounts['Fans'] || 0) + (productCounts['Thermals'] || 0),
      isDropdown: true,
      children: [
        { id: 'Fans', label: 'Fans', count: productCounts['Fans'] || 0 },
        { id: 'Thermals', label: 'Thermals', count: productCounts['Thermals'] || 0 },
        { id: 'Mouse', label: 'Mouse', count: productCounts['Mouse'] || 0 },
        { id: 'Keyboard', label: 'Keyboard', count: productCounts['Keyboard'] || 0 },
        { id: 'Headset', label: 'Headsets', count: productCounts['Headset'] || 0 }
      ]
    }
  ];

  const isActive = (category: any) => {
    return selectedCategory === category.id ||
      (category.children && category.children.some((child: any) => child.id === selectedCategory));
  };

  return (
    <nav className="mx-4 mb-6 relative z-10">
      <div className="flex items-center justify-center flex-wrap gap-2">
        {categories.map((category) => (
          <div
            key={category.id || 'all'}
            className="relative"
            onMouseEnter={() => setHoveredCategory(category.id)}
            onMouseLeave={() => setHoveredCategory(null)}
          >
            <button
              onClick={() => category.isDropdown ? handleDropdownClick(category.id!) : onCategorySelect(category.id)}
              className={`
                relative px-4 py-2 rounded-full transition-all duration-200 
                flex items-center gap-2 text-sm font-medium
                ${isActive(category)
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10'
                }
              `}
            >
              {getCategoryIcon(category.id)}
              <span>{category.label}</span>

              {category.isDropdown && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isDropdownOpen === category.id ? 'rotate-180' : ''}`}
                />
              )}

              {/* Count badge - only show on hover */}
              {category.count > 0 && hoveredCategory === category.id && !isActive(category) && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/80 text-white font-medium animate-fade-in">
                  {category.count}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {category.isDropdown && category.children && (
              <div
                className={`
                  absolute top-full left-1/2 -translate-x-1/2 mt-2 
                  bg-slate-800/95 backdrop-blur-md border border-white/10 
                  rounded-xl shadow-xl shadow-black/20 z-20 min-w-[140px]
                  transition-all duration-200 ease-out
                  ${isDropdownOpen === category.id
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 -translate-y-2 pointer-events-none'
                  }
                `}
              >
                <div className="p-1">
                  {category.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => {
                        onCategorySelect(child.id);
                        setIsDropdownOpen(null);
                      }}
                      className={`
                        w-full px-3 py-2 rounded-lg text-left
                        flex items-center gap-2 text-sm font-medium
                        transition-all duration-150
                        ${selectedCategory === child.id
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      {getCategoryIcon(child.id)}
                      <span className="flex-1">{child.label}</span>
                      <span className="text-[10px] text-gray-500">{child.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
};