/**
 * Robust price normalization and formatting utilities
 * Following best practices for handling international price formats
 */

export interface PriceData {
  /** Normalized numeric value (no thousands separators, decimal point format) */
  numericValue: number;
  /** Original raw price string */
  rawValue: string;
  /** Detected locale format */
  detectedLocale: 'US' | 'EU' | 'UNKNOWN';
  /** Currency code if detected */
  currency?: string;
}

/**
 * Step 1: Strip all non-numeric characters except decimal separators
 */
const stripNonNumeric = (priceStr: string): string => {
  if (!priceStr || typeof priceStr !== 'string') return '0';
  
  // Remove currency symbols, spaces, letters, but keep dots and commas
  return priceStr.replace(/[^\d.,]/g, '');
};

/**
 * Step 2: Detect locale format based on separator patterns
 */
const detectLocaleFormat = (cleanPrice: string): 'US' | 'EU' | 'UNKNOWN' => {
  if (!cleanPrice) return 'UNKNOWN';
  
  const dotIndex = cleanPrice.lastIndexOf('.');
  const commaIndex = cleanPrice.lastIndexOf(',');
  
  // If both separators exist, the last one is usually decimal
  if (dotIndex > -1 && commaIndex > -1) {
    return dotIndex > commaIndex ? 'US' : 'EU';
  }
  
  // If only one separator exists
  if (dotIndex > -1) {
    const afterDot = cleanPrice.substring(dotIndex + 1);
    // If 3+ digits after dot, it's likely thousands separator (EU style)
    // If 1-2 digits, it's likely decimal separator (US style)
    return afterDot.length > 2 ? 'EU' : 'US';
  }
  
  if (commaIndex > -1) {
    const afterComma = cleanPrice.substring(commaIndex + 1);
    // If 3+ digits after comma, it's likely thousands separator (US style)
    // If 1-2 digits, it's likely decimal separator (EU style)
    return afterComma.length > 2 ? 'US' : 'EU';
  }
  
  return 'UNKNOWN';
};

/**
 * Step 3: Normalize to standard format (decimal point, no thousands)
 */
const normalizeToStandard = (cleanPrice: string, locale: 'US' | 'EU' | 'UNKNOWN'): string => {
  if (!cleanPrice) return '0';
  
  switch (locale) {
    case 'US':
      // US: 1,234.56 -> 1234.56
      return cleanPrice.replace(/,/g, '');
      
    case 'EU':
      // EU: 1.234,56 -> 1234.56
      const lastCommaIndex = cleanPrice.lastIndexOf(',');
      if (lastCommaIndex > -1) {
        const beforeComma = cleanPrice.substring(0, lastCommaIndex).replace(/\./g, '');
        const afterComma = cleanPrice.substring(lastCommaIndex + 1);
        return `${beforeComma}.${afterComma}`;
      }
      // No comma, just remove dots used as thousands separators
      return cleanPrice.replace(/\./g, '');
      
    case 'UNKNOWN':
    default:
      // Best effort: assume single separator is decimal
      const dotIndex = cleanPrice.lastIndexOf('.');
      const commaIndex = cleanPrice.lastIndexOf(',');
      
      if (dotIndex > commaIndex && dotIndex > -1) {
        return cleanPrice.replace(/,/g, '');
      } else if (commaIndex > -1) {
        const beforeComma = cleanPrice.substring(0, commaIndex).replace(/\./g, '');
        const afterComma = cleanPrice.substring(commaIndex + 1);
        return `${beforeComma}.${afterComma}`;
      }
      
      return cleanPrice.replace(/[.,]/g, '');
  }
};

/**
 * Step 4: Convert to safe numeric type
 */
const toNumeric = (normalizedStr: string): number => {
  if (!normalizedStr) return 0;
  
  const num = parseFloat(normalizedStr);
  return isNaN(num) ? 0 : num;
};

/**
 * Extract currency from original price string
 */
const extractCurrency = (originalStr: string): string | undefined => {
  if (!originalStr) return undefined;
  
  const currencyPatterns = [
    /USD/i,
    /EUR?/i,
    /IQD/i,
    /د\.ع/,
    /\$/,
    /€/,
    /£/,
    /¥/
  ];
  
  for (const pattern of currencyPatterns) {
    const match = originalStr.match(pattern);
    if (match) {
      const found = match[0];
      if (found === 'د.ع') return 'IQD';
      if (found === '$') return 'USD';
      if (found === '€') return 'EUR';
      if (found === '£') return 'GBP';
      if (found === '¥') return 'JPY';
      return found.toUpperCase();
    }
  }
  
  return undefined;
};

/**
 * Main price parsing function
 * Converts any price string to normalized numeric value
 */
export const parsePrice = (priceInput: string | number | null | undefined): PriceData => {
  // Handle numeric input
  if (typeof priceInput === 'number') {
    return {
      numericValue: isNaN(priceInput) ? 0 : priceInput,
      rawValue: String(priceInput),
      detectedLocale: 'UNKNOWN'
    };
  }
  
  // Handle null/undefined
  if (!priceInput) {
    return {
      numericValue: 0,
      rawValue: '0',
      detectedLocale: 'UNKNOWN'
    };
  }
  
  const rawValue = String(priceInput);
  
  // Step 1: Strip non-numeric
  const cleaned = stripNonNumeric(rawValue);
  
  // Step 2: Detect locale
  const locale = detectLocaleFormat(cleaned);
  
  // Step 3: Normalize
  const normalized = normalizeToStandard(cleaned, locale);
  
  // Step 4: Convert to numeric
  const numericValue = toNumeric(normalized);
  
  // Extract currency
  const currency = extractCurrency(rawValue);
  
  return {
    numericValue,
    rawValue,
    detectedLocale: locale,
    currency
  };
};

/**
 * Format price for display with proper locale formatting
 */
export const formatPrice = (
  numericValue: number, 
  currency: string = 'IQD',
  locale: 'US' | 'EU' = 'US'
): string => {
  if (isNaN(numericValue) || numericValue < 0) return '0';
  
  // Round to 2 decimal places for display
  const rounded = Math.round(numericValue * 100) / 100;
  
  if (locale === 'EU') {
    // EU format: 1.234,56
    const parts = rounded.toFixed(2).split('.');
    const wholePart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimalPart = parts[1];
    
    // Only show decimals if not .00
    if (decimalPart === '00') {
      return wholePart;
    }
    return `${wholePart},${decimalPart}`;
  } else {
    // US format: 1,234.56
    const parts = rounded.toFixed(2).split('.');
    const wholePart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const decimalPart = parts[1];
    
    // Only show decimals if not .00
    if (decimalPart === '00') {
      return wholePart;
    }
    return `${wholePart}.${decimalPart}`;
  }
};

/**
 * Calculate discount percentage between two prices
 */
export const calculateDiscount = (originalPrice: number, salePrice: number): number => {
  if (!originalPrice || !salePrice || originalPrice <= salePrice) return 0;
  
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
};

/**
 * Calculate savings amount
 */
export const calculateSavings = (originalPrice: number, salePrice: number): number => {
  if (!originalPrice || !salePrice || originalPrice <= salePrice) return 0;
  
  return originalPrice - salePrice;
};

/**
 * Batch process multiple prices for consistent normalization
 */
export const batchParseprices = (prices: (string | number | null | undefined)[]): PriceData[] => {
  return prices.map(price => parsePrice(price));
};

/**
 * Validate if a price string can be parsed reliably
 */
export const isValidPrice = (priceInput: string | number | null | undefined): boolean => {
  const parsed = parsePrice(priceInput);
  return parsed.numericValue > 0 && parsed.detectedLocale !== 'UNKNOWN';
};