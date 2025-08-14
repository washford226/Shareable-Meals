import { useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Hook to optimize screen performance by deferring heavy operations
 * until after the screen transition completes
 */
export function useScreenPerformance() {
  const interactionHandle = useRef<any>(null);

  const runAfterInteractions = useCallback((callback: () => void) => {
    if (interactionHandle.current) {
      InteractionManager.clearInteractionHandle(interactionHandle.current);
    }
    
    interactionHandle.current = InteractionManager.runAfterInteractions(() => {
      callback();
      interactionHandle.current = null;
    });
  }, []);

  const cancelPendingInteractions = useCallback(() => {
    if (interactionHandle.current) {
      InteractionManager.clearInteractionHandle(interactionHandle.current);
      interactionHandle.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingInteractions();
    };
  }, [cancelPendingInteractions]);

  return {
    runAfterInteractions,
    cancelPendingInteractions,
  };
}

/**
 * Hook for lazy loading data after screen mount
 */
export function useLazyLoad<T>(
  fetchFunction: () => Promise<T>,
  dependencies: any[] = []
) {
  const { runAfterInteractions } = useScreenPerformance();

  const lazyFetch = useCallback(() => {
    runAfterInteractions(() => {
      fetchFunction();
    });
  }, [fetchFunction, runAfterInteractions]);

  useEffect(() => {
    lazyFetch();
  }, [...dependencies, lazyFetch]);

  return lazyFetch;
}
