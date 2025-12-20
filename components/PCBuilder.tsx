import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../types';
import { PCBuild, BuildComponent, CompatibilityCheck } from '../types-builder';
import { Cpu, Monitor, CircuitBoard, HardDrive, Zap, Fan, Box, AlertTriangle, CheckCircle, Plus, X, Loader2, ExternalLink } from 'lucide-react';

interface PCBuilderProps {
  products: Product[];
  onClose: () => void;
}

const PAGE_SIZE = 20; // Number of products to load at once

export const PCBuilder: React.FC<PCBuilderProps> = ({ products, onClose }) => {
  const [currentBuild, setCurrentBuild] = useState<PCBuild>({
    id: `build_${Date.now()}`,
    name: 'My PC Build',
    components: {
      cpu: { category: 'CPU', product: null, required: true },
      motherboard: { category: 'Motherboards', product: null, required: true },
      ram: { category: 'RAM', product: null, required: true },
      gpu: { category: 'GPU', product: null, required: false },
      storage: { category: 'Storage', product: null, required: true },
      psu: { category: 'Power Supply', product: null, required: true },
      cooler: { category: 'Cooler', product: null, required: false },
      case: { category: 'Case', product: null, required: false },
    },
    totalPrice: 0,
    compatibilityStatus: 'compatible',
    powerRequirement: 0,
    created: new Date(),
    updated: new Date()
  });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [socketFilter, setSocketFilter] = useState('');
  const [ramTypeFilter, setRamTypeFilter] = useState('');
  const [priceSort, setPriceSort] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  
  // Lazy loading state
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);
  const productsPanelRef = useRef<HTMLDivElement>(null);

  // Component icons mapping
  const componentIcons = {
    CPU: Cpu,
    GPU: Monitor,
    Motherboards: CircuitBoard,
    RAM: CircuitBoard,
    Storage: HardDrive,
    'Power Supply': Zap,
    Cooler: Fan,
    Case: Box,
  };

  // Filter products by category for selection
  const availableProducts = useMemo(() => {
    if (!selectedCategory) return [];
    
    
    let filtered = products.filter(p => {
      // Allow all stores in PC Builder
      // Exclude products with no price or price of 0
      if (!p.price || p.price <= 0) return false;
      
      // Strict category matching - must match exactly
      const productCategory = p.category?.toLowerCase();
      const targetCategory = selectedCategory.toLowerCase();
      
      // Handle different category names
      let matches = false;
      if (productCategory === targetCategory) {
        matches = true;
      } else if (targetCategory === 'storage' && (productCategory === 'ssd' || productCategory === 'hdd' || productCategory?.includes('storage'))) {
        matches = true;
      } else if (targetCategory === 'power supply' && (productCategory === 'power supply' || productCategory?.includes('psu'))) {
        matches = true;
      } else if (targetCategory === 'gpu' && (productCategory === 'gpu' || productCategory === 'graphics card' || productCategory?.includes('video'))) {
        matches = true;
      }
      
      // Early return if category doesn't match or out of stock
      if (!matches || p.inStock === false) return false;

      // COMPATIBILITY FILTERING: Apply socket compatibility
      const selectedMotherboard = currentBuild.components.motherboard.product;
      const selectedCPU = currentBuild.components.cpu.product;
      
      // CPU-Motherboard Socket Compatibility (both directions)
      if (selectedMotherboard && targetCategory === 'cpu') {
        // Motherboard selected, filtering CPUs
        const motherboardSocket = selectedMotherboard.compatibility_specs?.socket;
        const cpuSocket = p.compatibility_specs?.socket;
        
        if (motherboardSocket && cpuSocket) {
          const socketMatch = motherboardSocket.toLowerCase() === cpuSocket.toLowerCase();
          console.log('🔌 Socket Compatibility Check (MB→CPU):', {
            motherboardSocket,
            cpuSocket,
            productTitle: p.title,
            compatible: socketMatch
          });
          return socketMatch;
        }
        // If no socket specs available, hide the product when compatibility filtering is active
        return false;
      }
      
      if (selectedCPU && targetCategory === 'motherboards') {
        // CPU selected, filtering Motherboards
        const cpuSocket = selectedCPU.compatibility_specs?.socket;
        const motherboardSocket = p.compatibility_specs?.socket;
        
        if (cpuSocket && motherboardSocket) {
          const socketMatch = cpuSocket.toLowerCase() === motherboardSocket.toLowerCase();
          console.log('🔌 Socket Compatibility Check (CPU→MB):', {
            cpuSocket,
            motherboardSocket,
            productTitle: p.title,
            compatible: socketMatch
          });
          return socketMatch;
        }
        // If no socket specs available, hide the product when compatibility filtering is active
        return false;
      }
      
      // RAM Compatibility (both directions)
      if (selectedMotherboard && targetCategory === 'ram') {
        const motherboardRamType = selectedMotherboard.compatibility_specs?.ram_type;
        const ramType = p.compatibility_specs?.memory_type;
        
        if (motherboardRamType && ramType) {
          const ramMatch = motherboardRamType.toLowerCase() === ramType.toLowerCase();
          console.log('🧠 RAM Compatibility Check (MB→RAM):', {
            motherboardRamType,
            ramType,
            productTitle: p.title,
            compatible: ramMatch
          });
          return ramMatch;
        }
        // Hide products without compatibility specs when filtering is needed
        if (motherboardRamType && !ramType) {
          console.log('🚫 Hiding RAM without memory_type spec:', p.title);
          return false;
        }
        // If no RAM specs available when motherboard is selected, hide the product
        return false;
      }

      // RAM selected, filtering Motherboards
      const selectedRAM = currentBuild.components.ram.product;
      if (selectedRAM && targetCategory === 'motherboards') {
        const ramType = selectedRAM.compatibility_specs?.memory_type;
        const motherboardRamType = p.compatibility_specs?.ram_type;
        
        if (ramType && motherboardRamType) {
          const ramMatch = ramType.toLowerCase() === motherboardRamType.toLowerCase();
          console.log('🧠 RAM Compatibility Check (RAM→MB):', {
            ramType,
            motherboardRamType,
            productTitle: p.title,
            compatible: ramMatch
          });
          return ramMatch;
        }
        // Hide motherboards without compatibility specs when filtering is needed
        if (ramType && !motherboardRamType) {
          console.log('🚫 Hiding Motherboard without ram_type spec:', p.title);
          return false;
        }
        // If no specs available when RAM is selected, hide the product
        return false;
      }

      // No compatibility filtering active for this category - show all valid products
      return true;
    });


    if (searchQuery.trim()) {
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply store filtering
    if (storeFilter) {
      filtered = filtered.filter(p => 
        p.retailer?.toLowerCase() === storeFilter.toLowerCase()
      );
    }

    // Apply category-specific filtering
    if (selectedCategory === 'Motherboards' || selectedCategory === 'CPU') {
      // Socket filtering
      if (socketFilter) {
        filtered = filtered.filter(p => {
          const socket = p.compatibility_specs?.socket?.toLowerCase();
          return socket === socketFilter.toLowerCase();
        });
      }
    }

    if (selectedCategory === 'RAM') {
      // RAM type filtering
      if (ramTypeFilter) {
        filtered = filtered.filter(p => {
          const ramType = p.compatibility_specs?.memory_type?.toLowerCase();
          return ramType === ramTypeFilter.toLowerCase();
        });
      }
    }

    // Apply price sorting to all categories
    if (priceSort) {
      return [...filtered].sort((a, b) => {
        if (priceSort === 'price-low-high') {
          return (a.price || 0) - (b.price || 0);
        } else if (priceSort === 'price-high-low') {
          return (b.price || 0) - (a.price || 0);
        }
        return 0;
      });
    }

    return filtered.sort((a, b) => a.price - b.price);
  }, [products, selectedCategory, searchQuery, socketFilter, ramTypeFilter, priceSort, storeFilter, currentBuild]);

  // Get available stores from ALL products (global, not category-specific)
  const availableStores = useMemo(() => {
    const stores = new Set<string>();
    
    products.forEach(p => {
      if (p.retailer && p.price > 0) {
        stores.add(p.retailer);
      }
    });
    
    return Array.from(stores).sort();
  }, [products]);

  // Visible products with lazy loading
  const visibleProducts = useMemo(() => {
    return availableProducts.slice(0, visibleCount);
  }, [availableProducts, visibleCount]);

  const hasMoreProducts = availableProducts.length > visibleCount;

  // Reset visible count when category or filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    // Scroll to top of products panel when category changes
    if (productsPanelRef.current) {
      productsPanelRef.current.scrollTop = 0;
    }
  }, [selectedCategory, searchQuery, socketFilter, ramTypeFilter, priceSort, storeFilter]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreProducts) {
          console.log('📥 Loading more products...', visibleCount, '->', visibleCount + PAGE_SIZE);
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { 
        threshold: 0.1,
        root: productsPanelRef.current,
        rootMargin: '100px'
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget && hasMoreProducts) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMoreProducts, visibleCount]); // Re-run when hasMoreProducts or visibleCount changes

  // Get available sockets from current motherboard/CPU products
  const availableSockets = useMemo(() => {
    if (selectedCategory !== 'Motherboards' && selectedCategory !== 'CPU') return [];
    
    const sockets = new Set();
    const targetCategory = selectedCategory.toLowerCase();
    
    products.forEach(p => {
      if (p.category?.toLowerCase() === targetCategory && p.compatibility_specs?.socket) {
        sockets.add(p.compatibility_specs.socket);
      }
    });
    
    return Array.from(sockets).sort();
  }, [products, selectedCategory]);

  // Get available RAM types from current RAM products
  const availableRamTypes = useMemo(() => {
    if (selectedCategory !== 'RAM') return [];
    
    const ramTypes = new Set();
    products.forEach(p => {
      if (p.category?.toLowerCase() === 'ram' && p.compatibility_specs?.memory_type) {
        ramTypes.add(p.compatibility_specs.memory_type);
      }
    });
    
    return Array.from(ramTypes).sort();
  }, [products, selectedCategory]);

  // Calculate total price and power requirement
  const buildStats = useMemo(() => {
    const components = Object.values(currentBuild.components);
    const totalPrice = components.reduce((sum, comp) => sum + (comp.product?.price || 0), 0);
    const powerRequirement = components.reduce((sum, comp) => {
      // Only include GPU power requirement, not CPU TDP
      let power = 0;
      const specs = comp.product?.compatibility_specs;
      
      if (comp.category === 'GPU' && specs?.recommended_psu) {
        power = parseInt(specs.recommended_psu) || 0;
      } else if (comp.category !== 'CPU' && specs?.power_requirement) {
        power = parseInt(specs.power_requirement) || 0;
      }
      // Skip CPU TDP calculation
      
      return sum + power;
    }, 0);

    return { totalPrice, powerRequirement };
  }, [currentBuild]);

  // Basic compatibility checking
  const compatibilityCheck = useMemo((): CompatibilityCheck => {
    const warnings: any[] = [];
    const errors: any[] = [];

    const cpu = currentBuild.components.cpu.product;
    const motherboard = currentBuild.components.motherboard.product;
    const ram = currentBuild.components.ram.product;
    const psu = currentBuild.components.psu.product;

    // Check CPU-Motherboard socket compatibility
    if (cpu && motherboard) {
      const cpuSocket = cpu.compatibility_specs?.socket;
      const motherboardSocket = motherboard.compatibility_specs?.socket;
      
      if (cpuSocket && motherboardSocket && cpuSocket !== motherboardSocket) {
        errors.push({
          component1: 'CPU',
          component2: 'Motherboard',
          message: `Socket mismatch: ${cpuSocket} vs ${motherboardSocket}`,
          blocking: true
        });
      }
    }

    // Check RAM-Motherboard compatibility
    if (ram && motherboard) {
      const ramType = ram.compatibility_specs?.memory_type;
      const motherboardRamType = motherboard.compatibility_specs?.ram_type;
      
      if (ramType && motherboardRamType && ramType !== motherboardRamType) {
        errors.push({
          component1: 'RAM',
          component2: 'Motherboard',
          message: `Memory type mismatch: ${ramType} vs ${motherboardRamType}`,
          blocking: true
        });
      }
    }

    // Check PSU wattage against GPU requirements (warning only)
    const gpu = currentBuild.components.gpu.product;
    if (gpu && psu) {
      const gpuRecommendedPSU = parseInt(gpu.compatibility_specs?.recommended_psu) || 0;
      const psuWattage = parseInt(psu.compatibility_specs?.wattage) || 0;
      
      if (gpuRecommendedPSU > 0 && psuWattage > 0 && psuWattage < gpuRecommendedPSU) {
        warnings.push({
          component1: 'GPU',
          component2: 'PSU',
          message: `GPU recommends ${gpuRecommendedPSU}W PSU but selected PSU provides ${psuWattage}W`,
          severity: 'medium'
        });
      }
    }

    return {
      isCompatible: errors.length === 0,
      warnings,
      errors
    };
  }, [currentBuild, buildStats]);

  const handleComponentSelect = (product: Product) => {
    if (!selectedCategory) return;

    // Map category names to component keys
    const categoryToKeyMap: { [key: string]: keyof typeof currentBuild.components } = {
      'CPU': 'cpu',
      'GPU': 'gpu', 
      'Motherboards': 'motherboard',
      'RAM': 'ram',
      'Storage': 'storage',
      'Power Supply': 'psu',
      'Cooler': 'cooler',
      'Case': 'case'
    };

    const categoryKey = categoryToKeyMap[selectedCategory];
    if (!categoryKey) {
      console.error('Unknown category:', selectedCategory);
      return;
    }

    setCurrentBuild(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [categoryKey]: {
          ...prev.components[categoryKey],
          product
        }
      },
      updated: new Date()
    }));

    // Keep category open and clear search
    setSearchQuery('');
    // Don't close category - user can manually close or select another
  };

  const handleComponentRemove = (componentKey: keyof typeof currentBuild.components) => {
    setCurrentBuild(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [componentKey]: {
          ...prev.components[componentKey],
          product: null
        }
      },
      updated: new Date()
    }));
  };

  return (
    <div className="fixed inset-0 bg-nexus-900 z-50 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">PC Builder</h2>
            <p className="text-gray-400 text-xs">Build your perfect PC with compatibility checking</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors text-sm"
          >
            Close
          </button>
        </div>

        {/* Combined Stats Bar + Compatibility Status */}
        <div className="px-4 py-2 bg-white/5 border-b border-white/10 text-sm">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Total Price */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Total:</span>
              <span className="font-semibold text-nexus-accent">{buildStats.totalPrice.toLocaleString()} IQD</span>
            </div>

            {/* Right: Compatibility Warnings/Errors Only */}
            {(!compatibilityCheck.isCompatible || compatibilityCheck.warnings.length > 0) && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-yellow-400 text-xs max-w-2xl">
                  {compatibilityCheck.errors.map(e => e.message).concat(compatibilityCheck.warnings.map(w => w.message)).join(' • ')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex h-[calc(100vh-140px)]">
          {/* Left Panel - Component Grid */}
          <div className="w-1/3 p-4 border-r border-white/10">
            <div className="mb-3">
              <h3 className="text-md font-semibold text-white mb-2">Components</h3>
              
              {/* Global Store Filter */}
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-nexus-accent/50"
                style={{ 
                  backgroundColor: '#1f2937',
                  color: 'white',
                  border: '1px solid #4b5563'
                }}
              >
                <option value="" style={{ backgroundColor: '#1f2937', color: 'white' }}>🌐 All Stores</option>
                {availableStores.map(store => (
                  <option key={store} value={store} style={{ backgroundColor: '#1f2937', color: 'white' }}>
                    {store}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Single Column Layout */}
            <div className="space-y-3 h-full overflow-y-auto pr-2 mr-2 ml-2 pl-2">
              {Object.entries(currentBuild.components).map(([key, component]) => {
                const Icon = componentIcons[component.category];
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] ${
                      component.product
                        ? 'bg-nexus-accent/10 border-nexus-accent/30 hover:bg-nexus-accent/15 active:bg-nexus-accent/20'
                        : component.required
                        ? 'bg-white/5 border-white/20 hover:border-nexus-accent/50 hover:bg-white/10 active:bg-white/15'
                        : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 active:bg-white/15'
                    }`}
                    onClick={() => {
                      setSelectedCategory(component.category);
                      // Reset filters when switching categories (but keep store filter)
                      setSocketFilter('');
                      setRamTypeFilter('');
                      setPriceSort('');
                      // Don't reset storeFilter - keep it global
                      setSearchQuery('');
                    }}
                  >
                    <div className="flex gap-3 h-full">
                      {/* Component Icon/Image - Left */}
                      <div className="flex-shrink-0">
                        {component.product?.imageUrl ? (
                          <img 
                            src={component.product.imageUrl} 
                            alt={component.product.title}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                            <Icon className="w-6 h-6 text-nexus-accent" />
                          </div>
                        )}
                      </div>
                      
                      {/* Component Info - Right */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-white text-sm">{component.category}</span>
                            {component.product && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleComponentRemove(key as keyof typeof currentBuild.components);
                                }}
                                className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-colors ml-2"
                                title="Remove component"
                              >
                                <X className="w-3 h-3 text-red-400" />
                              </button>
                            )}
                          </div>
                          
                          {component.product ? (
                            <div className="text-xs text-gray-300 truncate mb-1">
                              {component.product.title}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              Click to select component
                            </div>
                          )}
                        </div>
                        
                        {component.product && (
                          <div className="mt-auto">
                            <div className="text-sm font-semibold text-nexus-accent">
                              {component.product.price.toLocaleString()} IQD
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel - Product Selection (2/3 width, 2 columns) */}
          <div className="w-2/3 p-4 overflow-y-auto" ref={productsPanelRef}>
            {selectedCategory ? (
              <div>
                {/* Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">
                      Select {selectedCategory}
                      <span className="ml-2 text-sm text-gray-400">
                        ({visibleProducts.length} of {availableProducts.length})
                      </span>
                    </h3>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      ← Back
                    </button>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${selectedCategory.toLowerCase()}...`}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-nexus-accent/50"
                  />
                  
                  {/* Sorting options */}
                  {selectedCategory && (
                    <div className="flex gap-3 mt-3">
                      {/* Socket Filter - For Motherboards and CPU */}
                      {(selectedCategory === 'Motherboards' || selectedCategory === 'CPU') && (
                        <select
                          value={socketFilter}
                          onChange={(e) => setSocketFilter(e.target.value)}
                          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-nexus-accent/50"
                          style={{ 
                            backgroundColor: '#1f2937',
                            color: 'white',
                            border: '1px solid #4b5563'
                          }}
                        >
                          <option value="" style={{ backgroundColor: '#1f2937', color: 'white' }}>All Sockets</option>
                          {availableSockets.map(socket => (
                            <option key={socket} value={socket} style={{ backgroundColor: '#1f2937', color: 'white' }}>
                              {socket}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* RAM Type Filter - For RAM */}
                      {selectedCategory === 'RAM' && (
                        <select
                          value={ramTypeFilter}
                          onChange={(e) => setRamTypeFilter(e.target.value)}
                          className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-nexus-accent/50"
                          style={{ 
                            backgroundColor: '#1f2937',
                            color: 'white',
                            border: '1px solid #4b5563'
                          }}
                        >
                          <option value="" style={{ backgroundColor: '#1f2937', color: 'white' }}>All RAM Types</option>
                          {availableRamTypes.map(ramType => (
                            <option key={ramType} value={ramType} style={{ backgroundColor: '#1f2937', color: 'white' }}>
                              {ramType}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {/* Price Sort - For all categories */}
                      <select
                        value={priceSort}
                        onChange={(e) => setPriceSort(e.target.value)}
                        className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-nexus-accent/50"
                        style={{ 
                          backgroundColor: '#1f2937',
                          color: 'white',
                          border: '1px solid #4b5563'
                        }}
                      >
                        <option value="" style={{ backgroundColor: '#1f2937', color: 'white' }}>Sort by Price</option>
                        <option value="price-low-high" style={{ backgroundColor: '#1f2937', color: 'white' }}>Price: Low to High</option>
                        <option value="price-high-low" style={{ backgroundColor: '#1f2937', color: 'white' }}>Price: High to Low</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Products Grid - 2 Columns */}
                <div className="grid grid-cols-2 gap-4">
                  {visibleProducts.map((product) => {
                    // Check if this product is currently selected in any component
                    const isSelected = Object.values(currentBuild.components).some(
                      component => component.product?.id === product.id
                    );
                    
                    return (
                      <div
                        key={product.id}
                        onClick={() => handleComponentSelect(product)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all transform hover:scale-[1.02] ${
                          isSelected 
                            ? 'bg-nexus-accent/20 border-nexus-accent hover:bg-nexus-accent/25 hover:border-nexus-accent' 
                            : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-nexus-accent/30'
                        }`}
                      >
                      <div className="flex gap-3 h-full">
                        {/* Product Image - Left */}
                        <div className="flex-shrink-0">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={product.title}
                              className="w-24 h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-24 h-24 bg-white/10 rounded-lg flex items-center justify-center">
                              <CircuitBoard className="w-10 h-10 text-gray-500" />
                            </div>
                          )}
                        </div>
                        
                        {/* Product Info - Right */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="font-medium text-white text-sm mb-2 line-clamp-2 leading-tight">
                              {product.title}
                            </div>
                            
                            <div className="text-xs text-gray-400 mb-2">
                              {product.brand} • {product.retailer}
                            </div>
                          </div>
                          
                          <div className="mt-auto">
                            <div className="flex items-end justify-between">
                              <div>
                                <div className="text-lg font-semibold text-nexus-accent">
                                  {product.price.toLocaleString()} IQD
                                </div>
                                
                                {/* Stock Status */}
                                {product.inStock !== false && (
                                  <div className="text-xs text-green-400 mt-1">In Stock</div>
                                )}
                              </div>

                              {/* View Product Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(product.link, '_blank', 'noopener,noreferrer');
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-nexus-accent/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1"
                                title="View on retailer website"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Loading indicator for infinite scroll */}
                {hasMoreProducts && (
                  <div 
                    ref={observerTarget}
                    className="flex items-center justify-center py-8"
                  >
                    <Loader2 className="w-6 h-6 text-nexus-accent animate-spin" />
                    <span className="ml-2 text-gray-400">Loading more products...</span>
                  </div>
                )}

                {/* No Results */}
                {availableProducts.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-500 mb-2">No products found</div>
                    <div className="text-sm text-gray-600">Try adjusting your search terms</div>
                  </div>
                )}

                {/* End of results indicator */}
                {!hasMoreProducts && availableProducts.length > 0 && (
                  <div className="text-center py-8">
                    <div className="text-gray-500 text-sm">
                      All {availableProducts.length} products loaded
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <CircuitBoard className="w-16 h-16 text-gray-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-300 mb-2">Select a Component</h3>
                <p className="text-gray-500">Choose a component category from the left panel to browse available products</p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};