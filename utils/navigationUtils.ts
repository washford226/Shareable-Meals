import { useCallback, useRef } from 'react';

/**
 * Hook to defer expensive operations after navigation to improve perceived performance
 * @param operation - The expensive operation to defer
 * @param delay - Delay in milliseconds (default: 100ms)
 */
export const useDeferredOperation = (operation: () => void | Promise<void>, delay: number = 100) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const execute = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      operation();
    }, delay);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [operation, delay]);

  return execute;
};

/**
 * Utility to create optimized navigation handlers that provide immediate visual feedback
 * @param router - Expo router instance
 */
export const createOptimizedNavigation = (router: any) => {
  return {
    push: (route: string, params?: any) => {
      // Immediate navigation without waiting for async operations
      router.push({ pathname: route, params });
    },
    replace: (route: string, params?: any) => {
      router.replace({ pathname: route, params });
    },
    back: () => {
      router.back();
    }
  };
};

/**
 * Batch state updates to reduce re-renders
 */
export const batchUpdates = (updates: (() => void)[]) => {
  // Use React's automatic batching (React 18+)
  updates.forEach(update => update());
};

/**
 * Debounce function for search and filter operations
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for scroll and touch events
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number = 100
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Optimize heavy lists by implementing virtual scrolling thresholds
 */
export const getOptimalPageSize = (itemHeight: number = 100, screenHeight: number = 800) => {
  // Calculate how many items fit on screen + buffer
  const itemsOnScreen = Math.ceil(screenHeight / itemHeight);
  return itemsOnScreen * 3; // 3x buffer for smooth scrolling
};

/**
 * Cache management for frequently accessed data
 */
class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 5 * 60 * 1000) { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }

  delete(key: string) {
    this.cache.delete(key);
  }
}

export const cache = new SimpleCache();
