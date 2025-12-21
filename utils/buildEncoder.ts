// Build Encoder - Encode/Decode PC builds for URL sharing

export interface EncodedComponent {
  id: string;
  site: string;
}

export interface EncodedBuild {
  name?: string; // Build name
  cpu?: EncodedComponent;
  gpu?: EncodedComponent;
  motherboard?: EncodedComponent;
  ram?: EncodedComponent;
  storage?: EncodedComponent;
  psu?: EncodedComponent;
  case?: EncodedComponent;
  cooler?: EncodedComponent;
  monitor?: EncodedComponent;
  laptop?: EncodedComponent;
  mouse?: EncodedComponent;
  keyboard?: EncodedComponent;
  headset?: EncodedComponent;
}

// Encode build components to URL-safe string
export function encodeBuild(components: any, buildName?: string): string {
  try {
    const encoded: EncodedBuild = {};
    
    // Add build name if provided
    if (buildName && buildName !== 'My PC Build') {
      encoded.name = buildName;
    }
    
    Object.entries(components).forEach(([category, product]: [string, any]) => {
      if (product && product.id && product.retailer) {
        encoded[category as keyof EncodedBuild] = {
          id: product.id,
          site: product.retailer,
        };
        console.log(`🔗 Encoding ${category}:`, { id: product.id, retailer: product.retailer, title: product.title });
      } else if (product) {
        console.warn(`⚠️ Cannot encode ${category} - missing id or retailer:`, product);
      }
    });
    
    const json = JSON.stringify(encoded);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    
    console.log(`✅ Encoded build:`, { name: encoded.name, componentsCount: Object.keys(encoded).length - (encoded.name ? 1 : 0), base64Length: base64.length });
    
    return base64;
  } catch (error) {
    console.error('Error encoding build:', error);
    return '';
  }
}

// Decode URL string back to component references
export function decodeBuild(encodedString: string): EncodedBuild | null {
  try {
    const json = decodeURIComponent(escape(atob(encodedString)));
    const decoded = JSON.parse(json);
    
    return decoded;
  } catch (error) {
    console.error('Error decoding build:', error);
    return null;
  }
}

// Generate shareable URL
export function generateShareURL(components: any, buildName?: string): string {
  const encoded = encodeBuild(components, buildName);
  if (!encoded) return '';
  
  const baseUrl = window.location.origin;
  return `${baseUrl}/?build=${encoded}`;
}

// Parse build from URL
export function parseBuildFromURL(): EncodedBuild | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const buildData = params.get('build');
    
    if (!buildData) return null;
    
    return decodeBuild(buildData);
  } catch (error) {
    console.error('Error parsing build from URL:', error);
    return null;
  }
}

// Match encoded components with product database
export function matchComponentsWithProducts(
  encodedBuild: EncodedBuild,
  allProducts: any[]
): any {
  const matchedComponents: any = {};
  
  Object.entries(encodedBuild).forEach(([category, encoded]) => {
    if (!encoded) return;
    
    const product = allProducts.find(
      p => p.id === encoded.id && p.retailer === encoded.site
    );
    
    if (product) {
      matchedComponents[category] = product;
      console.log(`✅ Matched ${category}:`, product.title);
    } else {
      console.warn(`⚠️ Could not find product for ${category}:`, encoded);
    }
  });
  
  console.log(`📦 Matched ${Object.keys(matchedComponents).length} components`);
  
  return matchedComponents;
}

// Validate encoded build structure
export function isValidEncodedBuild(encoded: any): encoded is EncodedBuild {
  if (!encoded || typeof encoded !== 'object') return false;
  
  const validCategories = [
    'cpu', 'gpu', 'motherboard', 'ram', 'storage', 
    'psu', 'case', 'cooler', 'monitor', 'laptop',
    'mouse', 'keyboard', 'headset'
  ];
  
  return Object.keys(encoded).every(key => validCategories.includes(key));
}
