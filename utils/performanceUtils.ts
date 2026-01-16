// Performance Utilities for NexusPC Community Posts
// Provides lazy loading, performance monitoring, and optimization helpers
// Requirements: Performance optimization and caching

import { Post } from '../types/community-posts';

/**
 * Performance measurement result
 */
interface PerformanceMeasurement {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Performance monitor for tracking operation times
 */
class PerformanceMonitor {
  private measurements: PerformanceMeasurement[] = [];
  private readonly maxMeasurements = 1000;

  /**
   * Measure the execution time of a function
   */
  async measure<T>(name: string, fn: () => T | Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      this.recordMeasurement(name, performance.now() - start, metadata);
      return result;
    } catch (error) {
      this.recordMeasurement(name, performance.now() - start, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure synchronous function
   */
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const start = performance.now();
    try {
      const result = fn();
      this.recordMeasurement(name, performance.now() - start, metadata);
      return result;
    } catch (error) {
      this.recordMeasurement(name, performance.now() - start, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Record a measurement
   */
  recordMeasurement(name: string, duration: number, metadata?: Record<string, any>): void {
    this.measurements.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata
    });

    // Keep only recent measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements = this.measurements.slice(-this.maxMeasurements);
    }
  }

  /**
   * Get measurements by name
   */
  getMeasurements(name?: string): PerformanceMeasurement[] {
    if (name) {
      return this.measurements.filter(m => m.name === name);
    }
    return [...this.measurements];
  }

  /**
   * Get average duration for a measurement type
   */
  getAverageDuration(name: string): number {
    const measurements = this.getMeasurements(name);
    if (measurements.length === 0) return 0;
    
    const total = measurements.reduce((sum, m) => sum + m.duration, 0);
    return total / measurements.length;
  }

  /**
   * Get performance summary
   */
  getSummary(): Record<string, { count: number; avgDuration: number; maxDuration: number; minDuration: number }> {
    const summary: Record<string, { count: number; avgDuration: number; maxDuration: number; minDuration: number }> = {};
    
    for (const measurement of this.measurements) {
      if (!summary[measurement.name]) {
        summary[measurement.name] = {
          count: 0,
          avgDuration: 0,
          maxDuration: 0,
          minDuration: Infinity
        };
      }
      
      const entry = summary[measurement.name];
      entry.count++;
      entry.avgDuration = (entry.avgDuration * (entry.count - 1) + measurement.duration) / entry.count;
      entry.maxDuration = Math.max(entry.maxDuration, measurement.duration);
      entry.minDuration = Math.min(entry.minDuration, measurement.duration);
    }

    // Fix minDuration for entries with no measurements
    for (const key of Object.keys(summary)) {
      if (summary[key].minDuration === Infinity) {
        summary[key].minDuration = 0;
      }
    }

    return summary;
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements = [];
  }
}

/**
 * Lazy loading utilities for images and content
 */
export const LazyLoadUtils = {
  /**
   * Create an intersection observer for lazy loading
   */
  createLazyLoadObserver(
    onIntersect: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
  ): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onIntersect(entry);
          }
        });
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
        ...options
      }
    );
  },

  /**
   * Check if element is in viewport
   */
  isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
   * Calculate visible posts based on scroll position
   */
  calculateVisiblePosts(
    containerHeight: number,
    scrollTop: number,
    postHeight: number,
    totalPosts: number,
    buffer: number = 5
  ): { startIndex: number; endIndex: number; visibleCount: number } {
    const visibleCount = Math.ceil(containerHeight / postHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / postHeight) - buffer);
    const endIndex = Math.min(totalPosts, startIndex + visibleCount + buffer * 2);

    return { startIndex, endIndex, visibleCount };
  },

  /**
   * Debounce function for scroll handlers
   */
  debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Throttle function for scroll handlers
   */
  throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
};

/**
 * Image optimization utilities
 */
export const ImageOptimizationUtils = {
  /**
   * Generate srcset for responsive images
   */
  generateSrcSet(baseUrl: string, widths: number[] = [320, 640, 960, 1280]): string {
    // For ImgBB URLs, we can't resize, so return the original
    if (baseUrl.includes('imgbb.com') || baseUrl.includes('ibb.co')) {
      return baseUrl;
    }

    return widths
      .map((width) => `${baseUrl}?w=${width} ${width}w`)
      .join(', ');
  },

  /**
   * Get optimal image size based on container
   */
  getOptimalImageSize(containerWidth: number): number {
    const sizes = [320, 640, 960, 1280, 1920];
    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetWidth = containerWidth * devicePixelRatio;

    return sizes.find((size) => size >= targetWidth) || sizes[sizes.length - 1];
  },

  /**
   * Create placeholder data URL for lazy loading
   */
  createPlaceholder(width: number, height: number, color: string = '#e5e7eb'): string {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect fill='${encodeURIComponent(color)}' width='100%25' height='100%25'/%3E%3C/svg%3E`;
  },

  /**
   * Check if image URL is valid
   */
  isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  /**
   * Extract image dimensions from URL if available
   */
  extractDimensions(url: string): { width?: number; height?: number } {
    const widthMatch = url.match(/[?&]w=(\d+)/);
    const heightMatch = url.match(/[?&]h=(\d+)/);

    return {
      width: widthMatch ? parseInt(widthMatch[1], 10) : undefined,
      height: heightMatch ? parseInt(heightMatch[1], 10) : undefined
    };
  }
};

/**
 * Query optimization utilities for Firebase
 */
export const QueryOptimizationUtils = {
  /**
   * Calculate optimal page size based on network conditions
   */
  getOptimalPageSize(connectionType?: string): number {
    // Default page size
    const defaultSize = 20;

    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return defaultSize;
    }

    const connection = (navigator as any).connection;
    if (!connection) return defaultSize;

    // Adjust based on connection type
    switch (connection.effectiveType) {
      case 'slow-2g':
      case '2g':
        return 10;
      case '3g':
        return 15;
      case '4g':
      default:
        return defaultSize;
    }
  },

  /**
   * Determine if prefetching should be enabled
   */
  shouldPrefetch(): boolean {
    if (typeof navigator === 'undefined') return true;

    // Check for data saver mode
    const connection = (navigator as any).connection;
    if (connection?.saveData) return false;

    // Check for slow connection
    if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') {
      return false;
    }

    return true;
  },

  /**
   * Calculate query limit based on available data
   */
  calculateQueryLimit(
    currentCount: number,
    targetCount: number,
    maxLimit: number = 100
  ): number {
    const needed = targetCount - currentCount;
    return Math.min(Math.max(needed, 20), maxLimit);
  },

  /**
   * Generate optimized query parameters
   */
  generateQueryParams(options: {
    page: number;
    pageSize: number;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    filters?: Record<string, any>;
  }): Record<string, any> {
    const { page, pageSize, sortField, sortDirection, filters } = options;

    return {
      orderBy: sortField,
      limitToLast: sortDirection === 'desc' ? pageSize : undefined,
      limitToFirst: sortDirection === 'asc' ? pageSize : undefined,
      startAt: page > 0 ? page * pageSize : undefined,
      ...filters
    };
  }
};

/**
 * Memory optimization utilities
 */
export const MemoryOptimizationUtils = {
  /**
   * Trim posts array to prevent memory bloat
   */
  trimPosts(posts: Post[], maxCount: number = 500): Post[] {
    if (posts.length <= maxCount) return posts;
    return posts.slice(0, maxCount);
  },

  /**
   * Create a lightweight post reference
   */
  createPostReference(post: Post): { id: string; createdAt: number } {
    return {
      id: post.id,
      createdAt: post.createdAt
    };
  },

  /**
   * Estimate memory usage of posts array
   */
  estimateMemoryUsage(posts: Post[]): number {
    // Rough estimation: ~1KB per post on average
    return posts.length * 1024;
  },

  /**
   * Check if memory cleanup is needed
   */
  shouldCleanup(posts: Post[], threshold: number = 500): boolean {
    return posts.length > threshold;
  }
};

// Export singleton performance monitor
export const performanceMonitor = new PerformanceMonitor();

// Export class for testing
export { PerformanceMonitor };
export type { PerformanceMeasurement };
