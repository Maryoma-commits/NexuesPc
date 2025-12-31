import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../types';
import { PCBuild, BuildComponent, CompatibilityCheck } from '../types-builder';
import { Cpu, Monitor, CircuitBoard, HardDrive, Zap, Fan, Box, AlertTriangle, CheckCircle, Plus, X, Loader2, ExternalLink, Save, FolderOpen, Share2, RotateCcw, MemoryStick, Gpu } from 'lucide-react';
import SaveBuildModal from './SaveBuildModal';
import LoadBuildsModal from './LoadBuildsModal';
import ShareBuildModal from './ShareBuildModal';
import { saveBuild, autoSaveBuild, SavedBuild, updateBuild, getAutoSavedBuild } from '../utils/buildStorage';
import { parseBuildFromURL, matchComponentsWithProducts } from '../utils/buildEncoder';

interface PCBuilderProps {
  products: Product[];
  onClose: () => void;
  initialBuildData?: any; // BuildData from chat
}

const PAGE_SIZE = 20; // Number of products to load at once

export const PCBuilder: React.FC<PCBuilderProps> = ({ products, onClose, initialBuildData }) => {
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

  // Save/Load/Share modals state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [buildName, setBuildName] = useState('My PC Build');
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(null);
  const [buildTags, setBuildTags] = useState<string[]>([]);
  const [buildNotes, setBuildNotes] = useState('');

  // Component icons mapping
  const componentIcons = {
    CPU: Cpu,
    GPU: Gpu,
    Motherboards: CircuitBoard,
    RAM: MemoryStick,
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
          return ramMatch;
        }
        // Hide products without compatibility specs when filtering is needed
        if (motherboardRamType && !ramType) {
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
          return ramMatch;
        }
        // Hide motherboards without compatibility specs when filtering is needed
        if (ramType && !motherboardRamType) {
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
          // Loading more products
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

    // Auto-navigate back to components view
    setSelectedCategory(null);
    setSearchQuery('');
    setSocketFilter('');
    setRamTypeFilter('');
    setPriceSort('');
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

  // Save/Load/Share handlers
  const handleSaveBuild = (name: string, saveAsNew: boolean = false, tags?: string[], notes?: string) => {
    const componentsForSave: any = {};
    Object.entries(currentBuild.components).forEach(([key, comp]) => {
      if (comp.product) {
        componentsForSave[key] = comp.product;
      }
    });

    // Update existing build or save new one
    if (currentBuildId && !saveAsNew) {
      // Update existing build
      updateBuild(currentBuildId, name, componentsForSave, buildStats.totalPrice, tags, notes);
    } else {
      // Save as new build
      const newBuild = saveBuild(name, componentsForSave, buildStats.totalPrice, tags, notes);
      setCurrentBuildId(newBuild.id);
    }
    
    setBuildName(name);
    setBuildTags(tags || []);
    setBuildNotes(notes || '');
    setShowSaveModal(false);
  };

  const handleLoadBuild = (build: SavedBuild) => {
    setBuildName(build.name);
    setCurrentBuildId(build.id);
    setBuildTags(build.tags || []);
    setBuildNotes(build.notes || '');
    
    // Load components into current build
    const newComponents = { ...currentBuild.components };
    Object.entries(build.components).forEach(([key, product]) => {
      if (product && newComponents[key as keyof typeof newComponents]) {
        newComponents[key as keyof typeof newComponents] = {
          ...newComponents[key as keyof typeof newComponents],
          product: product as Product
        };
      }
    });

    setCurrentBuild(prev => ({
      ...prev,
      components: newComponents,
      updated: new Date()
    }));

    setShowLoadModal(false);
  };


  const handleShareBuild = () => {
    setShowShareModal(true);
  };

  const handleResetBuild = () => {
    // Clear all components
    setCurrentBuild({
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
    
    // Reset build tracking
    setBuildName('My PC Build');
    setCurrentBuildId(null);
    
    // Go back to components view if in product selection
    setSelectedCategory(null);
  };

  // Load auto-saved or shared build on mount
  useEffect(() => {
    if (products.length === 0) return;
    
    const loadInitialBuild = async () => {
    
    // Priority 1: Check for build data from chat
    if (initialBuildData) {
      const newComponents = { ...currentBuild.components };
      
      // Convert BuildData format to PCBuilder format
      // BuildData uses: { name, price, image, retailer }
      // BUT also support legacy format where full Product objects are stored
      Object.entries(initialBuildData.components).forEach(([key, component]: [string, any]) => {
        if (component && newComponents[key as keyof typeof newComponents]) {
          // Check if this is already a full Product object (legacy format)
          if (component.id && component.title) {
            newComponents[key as keyof typeof newComponents] = {
              ...newComponents[key as keyof typeof newComponents],
              product: component as Product
            };
            return; // Skip matching, use directly
          }
          
          // Otherwise, it's the new BuildData format { name, price, image, retailer }
          // Find matching product by name/title, price, and retailer
          // First try exact match
          let matchedProduct = products.find(p => 
            p.title === component.name && 
            p.price === component.price &&
            p.retailer === component.retailer
          );
          
          // If exact match fails, try case-insensitive retailer match
          if (!matchedProduct) {
            matchedProduct = products.find(p => 
              p.title === component.name && 
              p.price === component.price &&
              p.retailer.toLowerCase() === component.retailer.toLowerCase()
            );
          }
          
          // If still no match, try without retailer (just title and price)
          if (!matchedProduct) {
            matchedProduct = products.find(p => 
              p.title === component.name && 
              p.price === component.price
            );
          }
          
          if (matchedProduct) {
            newComponents[key as keyof typeof newComponents] = {
              ...newComponents[key as keyof typeof newComponents],
              product: matchedProduct
            };
          }
        }
      });

      setCurrentBuild(prev => ({
        ...prev,
        components: newComponents,
        updated: new Date()
      }));

      setBuildName(initialBuildData.name || 'Shared Build');
      return; // Skip other load methods
    }
    
    // Priority 2: Check for shared build in URL
    const encodedBuild = parseBuildFromURL();
    if (encodedBuild) {
      const matchedComponents = matchComponentsWithProducts(encodedBuild, products);
      
      if (Object.keys(matchedComponents).length > 0) {
        const newComponents = { ...currentBuild.components };
        Object.entries(matchedComponents).forEach(([key, product]) => {
          if (newComponents[key as keyof typeof newComponents]) {
            newComponents[key as keyof typeof newComponents] = {
              ...newComponents[key as keyof typeof newComponents],
              product: product as Product
            };
          }
        });

        setCurrentBuild(prev => ({
          ...prev,
          components: newComponents,
          updated: new Date()
        }));

        // Use build name from URL if available, otherwise default to 'Shared Build'
        const sharedBuildName = encodedBuild.name || 'Shared Build';
        setBuildName(sharedBuildName);
        
        // Clean URL after loading
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      // Priority 3: Check for auto-save (localStorage)
      const autoSaved = getAutoSavedBuild();
      if (autoSaved && autoSaved.components) {
        const newComponents = { ...currentBuild.components };
        Object.entries(autoSaved.components).forEach(([key, product]) => {
          if (product && newComponents[key as keyof typeof newComponents]) {
            newComponents[key as keyof typeof newComponents] = {
              ...newComponents[key as keyof typeof newComponents],
              product: product as Product
            };
          }
        });

        setCurrentBuild(prev => ({
          ...prev,
          components: newComponents,
          updated: new Date()
        }));
      }
    }
    };
    
    loadInitialBuild();
  }, [products, initialBuildData]);

  // Auto-save on component change (including removals and reset)
  useEffect(() => {
    const componentsForSave: any = {};
    Object.entries(currentBuild.components).forEach(([key, comp]) => {
      if (comp.product) {
        componentsForSave[key] = comp.product;
      }
    });

    // Always auto-save, even if empty (to reflect removals/reset)
    autoSaveBuild(componentsForSave, buildStats.totalPrice);
  }, [currentBuild.components, buildStats.totalPrice]);

  return (
    <div className="fixed inset-0 bg-nexus-900 z-50 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              PC Builder
              {buildName && buildName !== 'My PC Build' && (
                <span className="text-sm font-normal text-nexus-accent">
                  • {buildName}
                </span>
              )}
            </h2>
            <p className="text-gray-400 text-xs">Build your PC</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 !text-white rounded-lg 
                       transition-colors text-sm flex items-center gap-2"
              title="Save Build"
            >
              <Save className="w-4 h-4 !text-white" />
              <span className="hidden sm:inline">Save</span>
            </button>
            
            <button
              onClick={() => setShowLoadModal(true)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 
                       transition-colors text-sm flex items-center gap-2"
              title="Load Build"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Load</span>
            </button>
            
            <button
              onClick={handleShareBuild}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 
                       transition-colors text-sm flex items-center gap-2"
              title="Share Build"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
            
            <button
              onClick={handleResetBuild}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg 
                       border border-red-600/30 hover:border-red-600/50 transition-colors text-sm 
                       flex items-center gap-2"
              title="Reset Build"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 
                       transition-colors text-sm"
            >
              Close
            </button>
          </div>
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

        <div className="h-[calc(100vh-140px)] overflow-hidden">
          {!selectedCategory ? (
            /* Components View - Full Width */
            <div className="w-full h-full p-6 overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Select Components</h3>
                <p className="text-gray-400 text-sm mb-4">Click on a component category to browse and select products</p>
                
                {/* Global Store Filter */}
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">🌐 All Stores</option>
                  {availableStores.map(store => (
                    <option key={store} value={store}>
                      {store}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Grid Layout - 4 columns, enhanced cards */}
              <div className="grid grid-cols-4 gap-6">
              {Object.entries(currentBuild.components).map(([key, component]) => {
                const Icon = componentIcons[component.category];
                return (
                  <div
                    key={key}
                    className={`group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer transform hover:scale-[1.05] hover:-translate-y-1 active:scale-[0.98] shadow-lg hover:shadow-2xl ${
                      component.product
                        ? 'bg-gradient-to-br from-nexus-accent/20 to-nexus-accent/10 border-nexus-accent/40 hover:border-nexus-accent/60 shadow-nexus-accent/20'
                        : component.required
                        ? 'bg-gradient-to-br from-white/10 to-white/5 border-white/30 hover:border-nexus-accent/50 hover:from-nexus-accent/10 hover:to-nexus-accent/5 shadow-white/10'
                        : 'bg-gradient-to-br from-white/5 to-white/2 border-white/20 hover:border-white/40 hover:from-white/10 hover:to-white/5 shadow-white/5'
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
                    {/* Required Badge */}
                    {component.required && !component.product && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
                        Required
                      </div>
                    )}
                    
                    {/* Selected Badge */}
                    {component.product && (
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Selected
                      </div>
                    )}

                    <div className="flex flex-col items-center text-center h-full">
                      {/* Component Info - Top (Category + Remove Button) */}
                      <div className="w-full mb-4">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-base tracking-wide">{component.category}</span>
                          {component.product && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleComponentRemove(key as keyof typeof currentBuild.components);
                              }}
                              className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:scale-110"
                              title="Remove component"
                            >
                              <X className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Component Icon/Image - Middle */}
                      <div className="mb-4 w-full flex items-center justify-center flex-1">
                        {component.product?.imageUrl ? (
                          <div className="relative">
                            <img 
                              src={component.product.imageUrl} 
                              alt={component.product.title}
                              className="w-28 h-28 object-contain rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>
                        ) : (
                          <div className="w-28 h-28 bg-gradient-to-br from-white/15 to-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-nexus-accent/30 transition-all duration-300">
                            <Icon className={`w-14 h-14 transition-all duration-300 ${
                              component.required ? 'text-nexus-accent group-hover:text-nexus-accent/80' : 'text-gray-400 group-hover:text-gray-300'
                            }`} />
                          </div>
                        )}
                      </div>
                      
                      {/* Product Info - Bottom */}
                      <div className="w-full mt-auto">
                        {component.product ? (
                          <>
                            <div className="text-sm text-gray-200 line-clamp-2 mb-3 h-10 leading-tight font-medium">
                              {component.product.title}
                            </div>
                            <div className="bg-gradient-to-r from-nexus-accent to-blue-400 bg-clip-text text-transparent text-lg font-bold">
                              {component.product.price.toLocaleString()} IQD
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {component.product.retailer}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm text-gray-400 h-10 flex items-center justify-center mb-3">
                              Click to browse {component.category.toLowerCase()}
                            </div>
                            <div className="flex items-center justify-center gap-2 text-nexus-accent group-hover:text-nexus-accent/80 transition-colors">
                              <Plus className="w-5 h-5" />
                              <span className="font-medium">Add Component</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            /* Product Selection View - Full Width */
            <div className="w-full h-full overflow-y-auto p-6" ref={productsPanelRef}>
              <div>
                {/* Header */}
                <div className="mb-6">
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
                          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Sockets</option>
                          {availableSockets.map(socket => (
                            <option key={socket} value={socket}>
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
                          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All RAM Types</option>
                          {availableRamTypes.map(ramType => (
                            <option key={ramType} value={ramType}>
                              {ramType}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {/* Price Sort - For all categories */}
                      <select
                        value={priceSort}
                        onChange={(e) => setPriceSort(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sort by Price</option>
                        <option value="price-low-high">Price: Low to High</option>
                        <option value="price-high-low">Price: High to Low</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Products Grid - 3 Columns Enhanced */}
                <div className="grid grid-cols-3 gap-6">
                  {visibleProducts.map((product) => {
                    // Check if this product is currently selected in any component
                    const isSelected = Object.values(currentBuild.components).some(
                      component => component.product?.id === product.id
                    );
                    
                    return (
                      <div
                        key={product.id}
                        onClick={() => handleComponentSelect(product)}
                        className={`group relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 transform hover:scale-[1.03] hover:-translate-y-1 shadow-lg hover:shadow-2xl ${
                          isSelected 
                            ? 'bg-gradient-to-br from-nexus-accent/25 to-nexus-accent/15 border-nexus-accent/50 hover:border-nexus-accent/70 shadow-nexus-accent/30' 
                            : 'bg-gradient-to-br from-white/8 to-white/3 hover:from-white/12 hover:to-white/6 border-white/15 hover:border-nexus-accent/40 shadow-white/10'
                        }`}
                      >
                        {/* Selected Badge */}
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 bg-nexus-accent text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Selected
                          </div>
                        )}

                        {/* Discount Badge */}
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                          <div className="absolute -top-2 -left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
                            -{Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}%
                          </div>
                        )}

                        <div className="flex gap-4 h-full">
                          {/* Product Image - Left */}
                          <div className="flex-shrink-0">
                            {product.imageUrl ? (
                              <div className="relative">
                                <img 
                                  src={product.imageUrl} 
                                  alt={product.title}
                                  className="w-28 h-28 object-contain rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              </div>
                            ) : (
                              <div className="w-28 h-28 bg-gradient-to-br from-white/15 to-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-nexus-accent/30 transition-all duration-300">
                                <CircuitBoard className="w-12 h-12 text-gray-400 group-hover:text-gray-300 transition-colors" />
                              </div>
                            )}
                          </div>
                          
                          {/* Product Info - Right */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="font-semibold text-white text-sm mb-3 line-clamp-2 leading-tight group-hover:text-nexus-accent/90 transition-colors">
                                {product.title}
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                                {product.brand && (
                                  <span className="bg-white/10 px-2 py-1 rounded-md font-medium">
                                    {product.brand}
                                  </span>
                                )}
                                <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md font-medium">
                                  {product.retailer}
                                </span>
                              </div>
                            </div>
                            
                            <div className="mt-auto">
                              <div className="flex items-end justify-between">
                                <div>
                                  {/* Price Display */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="text-lg font-bold bg-gradient-to-r from-nexus-accent to-blue-400 bg-clip-text text-transparent">
                                      {product.price.toLocaleString()} IQD
                                    </div>
                                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                                      <div className="text-sm text-gray-500 line-through">
                                        {product.compareAtPrice.toLocaleString()} IQD
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Stock Status */}
                                  <div className="flex items-center gap-2">
                                    {product.inStock !== false ? (
                                      <div className="flex items-center gap-1 text-xs text-green-400">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                        In Stock
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-xs text-red-400">
                                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                        Out of Stock
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* View Product Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(product.link, '_blank', 'noopener,noreferrer');
                                  }}
                                  className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-white/10 to-white/5 text-gray-300 border border-white/20 hover:from-nexus-accent/20 hover:to-nexus-accent/10 hover:border-nexus-accent/40 hover:text-white transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-md hover:shadow-lg"
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
            </div>
          )}
        </div>

        {/* Modals */}
        <SaveBuildModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveBuild}
          defaultName={buildName}
          isEditMode={currentBuildId !== null}
          existingTags={buildTags}
          existingNotes={buildNotes}
        />

        <LoadBuildsModal
          isOpen={showLoadModal}
          onClose={() => setShowLoadModal(false)}
          onLoadBuild={handleLoadBuild}
        />

        <ShareBuildModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          components={Object.fromEntries(
            Object.entries(currentBuild.components)
              .filter(([_, comp]) => comp.product)
              .map(([key, comp]) => [key, comp.product])
          )}
          totalPrice={buildStats.totalPrice}
          buildName={buildName}
        />
    </div>
  );
};