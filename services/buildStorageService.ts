// Firebase Build Storage Service - Save/Load PC builds to Firebase per user
import { ref, set, get, update, remove, query, orderByChild } from 'firebase/database';
import { database } from '../firebase.config';

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

// Get all saved builds for a user
export async function getSavedBuilds(userId: string): Promise<SavedBuild[]> {
  try {
    const buildsRef = ref(database, `users/${userId}/savedBuilds`);
    const snapshot = await get(buildsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const buildsObj = snapshot.val();
    const builds: SavedBuild[] = Object.values(buildsObj);
    
    // Sort by date modified (newest first)
    return builds.sort((a, b) => b.dateModified - a.dateModified);
  } catch (error) {
    console.error('Error loading saved builds:', error);
    return [];
  }
}

// Save a new build
export async function saveBuild(
  userId: string,
  name: string,
  components: SavedBuild['components'],
  totalPrice: number,
  tags?: string[],
  notes?: string
): Promise<SavedBuild> {
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
  
  try {
    const buildRef = ref(database, `users/${userId}/savedBuilds/${buildId}`);
    await set(buildRef, newBuild);
    return newBuild;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to save build');
  }
}

// Update existing build
export async function updateBuild(
  userId: string,
  id: string,
  name: string,
  components: SavedBuild['components'],
  totalPrice: number,
  tags?: string[],
  notes?: string
): Promise<boolean> {
  try {
    const buildRef = ref(database, `users/${userId}/savedBuilds/${id}`);
    const snapshot = await get(buildRef);
    
    if (!snapshot.exists()) {
      return false;
    }
    
    const existingBuild = snapshot.val();
    const updatedBuild: SavedBuild = {
      ...existingBuild,
      name,
      components,
      totalPrice,
      tags,
      notes,
      dateModified: Date.now(),
    };
    
    await set(buildRef, updatedBuild);
    return true;
  } catch (error) {
    console.error('Error updating build:', error);
    return false;
  }
}

// Delete a build
export async function deleteBuild(userId: string, buildId: string): Promise<boolean> {
  try {
    const buildRef = ref(database, `users/${userId}/savedBuilds/${buildId}`);
    await remove(buildRef);
    return true;
  } catch (error) {
    console.error('Error deleting build:', error);
    return false;
  }
}

// Get a specific build
export async function getBuild(userId: string, buildId: string): Promise<SavedBuild | null> {
  try {
    const buildRef = ref(database, `users/${userId}/savedBuilds/${buildId}`);
    const snapshot = await get(buildRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val();
  } catch (error) {
    console.error('Error loading build:', error);
    return null;
  }
}

// Note: Auto-save is handled in localStorage (see buildStorage.ts)
// Keeping it in browser for instant recovery without network calls

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

// Migration removed - site not yet public, no need to migrate localStorage builds
