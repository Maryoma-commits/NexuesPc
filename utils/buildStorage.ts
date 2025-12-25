// Build Storage Utility - Wrapper for Firebase build storage
// Re-exports from Firebase service for backward compatibility
import { auth } from '../firebase.config';
import * as FirebaseStorage from '../services/buildStorageService';

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
  tags?: string[];
  notes?: string;
}

// Helper to get current user ID
function getCurrentUserId(): string | null {
  return auth.currentUser?.uid || null;
}

// Get all saved builds (async wrapper)
export function getSavedBuilds(): SavedBuild[] {
  // This function needs to be async but is called synchronously in components
  // Return empty array and let components handle the async version
  console.warn('getSavedBuilds() is deprecated. Use getSavedBuildsAsync() instead.');
  return [];
}

// New async version
export async function getSavedBuildsAsync(): Promise<SavedBuild[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];
  return FirebaseStorage.getSavedBuilds(userId);
}

// Save a new build (sync wrapper that returns immediately)
export function saveBuild(name: string, components: SavedBuild['components'], totalPrice: number, tags?: string[], notes?: string): SavedBuild {
  const userId = getCurrentUserId();
  const now = Date.now();
  const buildId = `build_${now}`;
  
  const newBuild: SavedBuild = {
    id: buildId,
    name,
    dateCreated: now,
    dateModified: now,
    components,
    totalPrice,
    tags,
    notes,
  };
  
  if (userId) {
    // Fire and forget - save to Firebase
    FirebaseStorage.saveBuild(userId, name, components, totalPrice, tags, notes).catch(console.error);
  }
  
  return newBuild;
}

// Update existing build
export function updateBuild(id: string, name: string, components: SavedBuild['components'], totalPrice: number, tags?: string[], notes?: string): boolean {
  const userId = getCurrentUserId();
  if (!userId) return false;
  
  // Fire and forget
  FirebaseStorage.updateBuild(userId, id, name, components, totalPrice, tags, notes).catch(console.error);
  return true;
}

// Delete a build
export function deleteBuild(id: string): boolean {
  const userId = getCurrentUserId();
  if (!userId) return false;
  
  // Fire and forget
  FirebaseStorage.deleteBuild(userId, id).catch(console.error);
  return true;
}

// Get a specific build
export function getBuild(id: string): SavedBuild | null {
  console.warn('getBuild() is deprecated. Use getBuildAsync() instead.');
  return null;
}

// New async version
export async function getBuildAsync(id: string): Promise<SavedBuild | null> {
  const userId = getCurrentUserId();
  if (!userId) return null;
  return FirebaseStorage.getBuild(userId, id);
}

// Auto-save current build (for recovery) - localStorage only
const AUTOSAVE_KEY = 'nexuspc_autosave';

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

// Get auto-saved build - localStorage only
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

// Clear auto-save - localStorage only
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
