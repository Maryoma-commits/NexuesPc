// Lazy Image Loading Hook for NexusPC Community Posts
// Provides lazy loading functionality for images with intersection observer
// Requirements: Performance optimization - image lazy loading

import { useState, useEffect, useRef, useCallback, RefObject, ImgHTMLAttributes } from 'react';
import { imageCache } from '../services/cacheService';
import { ImageOptimizationUtils } from './performanceUtils';

interface UseLazyImageOptions {
  threshold?: number;
  rootMargin?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

interface UseLazyImageResult {
  src: string;
  isLoaded: boolean;
  isError: boolean;
  ref: RefObject<HTMLImageElement>;
}

/**
 * Hook for lazy loading images with intersection observer
 */
export function useLazyImage(
  imageSrc: string,
  options: UseLazyImageOptions = {}
): UseLazyImageResult {
  const {
    threshold = 0.1,
    rootMargin = '100px',
    placeholder = ImageOptimizationUtils.createPlaceholder(400, 300),
    onLoad,
    onError
  } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [src, setSrc] = useState(placeholder);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Check if image is already cached
  useEffect(() => {
    if (imageCache.isLoaded(imageSrc)) {
      setSrc(imageSrc);
      setIsLoaded(true);
    } else if (imageCache.hasFailed(imageSrc)) {
      setIsError(true);
    }
  }, [imageSrc]);

  // Set up intersection observer
  useEffect(() => {
    if (isLoaded || isError) return;

    const element = imgRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Start loading the image
            loadImage();
            // Stop observing
            observerRef.current?.unobserve(element);
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [imageSrc, isLoaded, isError, threshold, rootMargin]);

  const loadImage = useCallback(async () => {
    try {
      const success = await imageCache.preload(imageSrc);
      if (success) {
        setSrc(imageSrc);
        setIsLoaded(true);
        onLoad?.();
      } else {
        setIsError(true);
        onError?.();
      }
    } catch {
      setIsError(true);
      onError?.();
    }
  }, [imageSrc, onLoad, onError]);

  return {
    src,
    isLoaded,
    isError,
    ref: imgRef
  };
}

/**
 * Hook for preloading multiple images
 */
export function useImagePreloader(imageUrls: string[]) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (imageUrls.length === 0) {
      setIsComplete(true);
      return;
    }

    let mounted = true;

    const preloadImages = async () => {
      const results = await imageCache.preloadMany(imageUrls);
      
      if (!mounted) return;

      let loaded = 0;
      let failed = 0;
      
      results.forEach((success) => {
        if (success) loaded++;
        else failed++;
      });

      setLoadedCount(loaded);
      setFailedCount(failed);
      setIsComplete(true);
    };

    preloadImages();

    return () => {
      mounted = false;
    };
  }, [imageUrls.join(',')]);

  return {
    loadedCount,
    failedCount,
    totalCount: imageUrls.length,
    isComplete,
    progress: imageUrls.length > 0 ? loadedCount / imageUrls.length : 1
  };
}

/**
 * Component props for lazy image
 */
export interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  placeholderSrc?: string;
  onImageLoad?: () => void;
  onImageError?: () => void;
}

/**
 * Get optimized image props for lazy loading
 */
export function getLazyImageProps(
  src: string,
  alt: string,
  options?: {
    width?: number;
    height?: number;
    className?: string;
  }
): ImgHTMLAttributes<HTMLImageElement> {
  const { width, height, className } = options || {};

  return {
    src,
    alt,
    loading: 'lazy' as const,
    decoding: 'async' as const,
    width,
    height,
    className,
    // Generate srcset for responsive images
    srcSet: ImageOptimizationUtils.generateSrcSet(src),
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
  };
}
