
export interface Product {
  id: string;
  title: string;
  price: number; // Always normalized numeric value
  compareAtPrice?: number; // Always normalized numeric value
  discountPercentage?: number;
  retailer: string;
  url: string;
  imageUrl?: string;
  brand?: string;
  specs?: string[];
  rating?: number;
  // Raw price data for display formatting
  rawPrice?: string;
  rawCompareAtPrice?: string;
  detectedCurrency?: string;
  inStock?: boolean; // Stock availability
  category?: string; // Product category
  compatibility_specs?: CompatibilitySpecs; // PC component compatibility specifications
}

// Compatibility specifications for PC components
export interface CompatibilitySpecs {
  // CPU specifications
  socket?: string; // e.g., "LGA1851", "LGA1700", "AM4", "AM5"
  cores?: number;
  threads?: number;
  tdp?: number; // Thermal Design Power in watts
  integrated_graphics?: boolean;

  // GPU specifications  
  memory_size?: string; // e.g., "8GB", "12GB"
  memory_type?: string; // e.g., "GDDR6", "GDDR6X"
  power_requirement?: number; // Power consumption in watts
  length?: number; // Card length in mm
  pcie_slots?: number; // Number of slots occupied

  // Motherboard specifications
  form_factor?: string; // e.g., "ATX", "Micro-ATX", "Mini-ITX"
  max_ram?: string; // e.g., "128GB"
  ram_slots?: number; // Number of RAM slots
  ram_type?: string; // e.g., "DDR4", "DDR5"

  // RAM specifications
  memory_type?: string; // e.g., "DDR4", "DDR5" 
  speed?: number; // Speed in MHz
  capacity?: string; // e.g., "16GB", "32GB"
  kit_size?: string; // e.g., "2x8GB", "2x16GB"

  // Power Supply specifications
  wattage?: number;
  efficiency?: string; // e.g., "80+ Gold"
  modular?: string; // "Fully", "Semi", "Non-Modular"

  // Storage specifications
  interface?: string; // e.g., "M.2 NVMe", "SATA"
  capacity?: string; // e.g., "1TB", "500GB"
  form_factor?: string; // e.g., "2280", "2.5\""
}

export type SortOption = 'best-selling' | 'price-asc' | 'price-desc';

export interface SearchState {
  query: string;
  results: Product[];
  isLoading: boolean;
  error: string | null;
  sortBy: SortOption;
}

export interface FilterState {
  minPrice: number | null;
  maxPrice: number | null;
  retailers: string[];
}
