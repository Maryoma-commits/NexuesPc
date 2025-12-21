// Build Storage Utility - Save/Load PC builds to localStorage

export interface SavedBuild {
  id: string;
  name: string;
  dateCreated: number;
  dateModified: number;
  components: {
    cpu?: any;
    gpu?: any;
    motherboard?: any;
    ram?: any;
    storage?: any;
    psu?: any;
    case?: any;
    cooler?: any;
    monitor?: any;
    laptop?: any;
    mouse?: any;
    keyboard?: any;
    headset?: any;
  };
  totalPrice: number;
  tags?: string[]; // "Gaming", "Workstation", "Budget", etc.
  notes?: string; // User notes/description
}

const STORAGE_KEY = 'nexuspc_saved_builds';
const AUTOSAVE_KEY = 'nexuspc_autosave';

// Get all saved builds
export function getSavedBuilds(): SavedBuild[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading saved builds:', error);
    return [];
  }
}

// Save a new build
export function saveBuild(name: string, components: SavedBuild['components'], totalPrice: number, tags?: string[], notes?: string): SavedBuild {
  const builds = getSavedBuilds();
  const now = Date.now();
  
  const newBuild: SavedBuild = {
    id: `build_${now}`,
    name,
    dateCreated: now,
    dateModified: now,
    components,
    totalPrice,
    tags,
    notes,
  };
  
  builds.push(newBuild);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
  
  return newBuild;
}

// Update existing build
export function updateBuild(id: string, name: string, components: SavedBuild['components'], totalPrice: number, tags?: string[], notes?: string): boolean {
  const builds = getSavedBuilds();
  const index = builds.findIndex(b => b.id === id);
  
  if (index === -1) return false;
  
  builds[index] = {
    ...builds[index],
    name,
    components,
    totalPrice,
    tags,
    notes,
    dateModified: Date.now(),
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
  return true;
}

// Delete a build
export function deleteBuild(id: string): boolean {
  const builds = getSavedBuilds();
  const filtered = builds.filter(b => b.id !== id);
  
  if (filtered.length === builds.length) return false;
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

// Get a specific build
export function getBuild(id: string): SavedBuild | null {
  const builds = getSavedBuilds();
  return builds.find(b => b.id === id) || null;
}

// Auto-save current build (for recovery)
export function autoSaveBuild(components: SavedBuild['components'], totalPrice: number): void {
  try {
    const autoSave = {
      components,
      totalPrice,
      timestamp: Date.now(),
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(autoSave));
  } catch (error) {
    console.error('Auto-save failed:', error);
  }
}

// Get auto-saved build
export function getAutoSavedBuild(): { components: SavedBuild['components']; totalPrice: number } | null {
  try {
    const data = localStorage.getItem(AUTOSAVE_KEY);
    if (!data) return null;
    
    const autoSave = JSON.parse(data);
    const ageInHours = (Date.now() - autoSave.timestamp) / (1000 * 60 * 60);
    
    // Only return if less than 24 hours old
    if (ageInHours > 24) {
      localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    
    return {
      components: autoSave.components,
      totalPrice: autoSave.totalPrice,
    };
  } catch (error) {
    console.error('Error loading auto-save:', error);
    return null;
  }
}

// Clear auto-save
export function clearAutoSave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

// Export build as text
export function exportBuildAsText(build: SavedBuild): string {
  const lines = [
    `🖥️ ${build.name}`,
    `💰 Total: ${build.totalPrice.toLocaleString()} IQD`,
    `📅 Created: ${new Date(build.dateCreated).toLocaleDateString()}`,
    '',
    '📦 Components:',
  ];
  
  Object.entries(build.components).forEach(([category, product]) => {
    if (product) {
      const categoryName = category.toUpperCase();
      lines.push(`  ${categoryName}: ${product.title} - ${product.price.toLocaleString()} IQD (${product.retailer})`);
    }
  });
  
  return lines.join('\n');
}

// Get storage usage info
export function getStorageInfo(): { buildsCount: number; storageSize: string } {
  const builds = getSavedBuilds();
  const data = localStorage.getItem(STORAGE_KEY) || '';
  const sizeInKB = (new Blob([data]).size / 1024).toFixed(2);
  
  return {
    buildsCount: builds.length,
    storageSize: `${sizeInKB} KB`,
  };
}
