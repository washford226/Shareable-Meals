import { renderHook, act } from '@testing-library/react-native';
import { useScreenPerformance, useLazyLoad } from '../../utils/performanceUtils';

// Mock InteractionManager with simpler implementation
jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => {
      const handle = { cancel: jest.fn() };
      if (callback && typeof callback === 'function') {
        setTimeout(callback, 0);
      }
      return handle;
    }),
    clearInteractionHandle: jest.fn(),
  },
}));

describe('performanceUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useScreenPerformance', () => {
    it('should provide runAfterInteractions function', () => {
      const { result } = renderHook(() => useScreenPerformance());
      
      expect(result.current.runAfterInteractions).toBeDefined();
      expect(typeof result.current.runAfterInteractions).toBe('function');
    });

    it('should provide cancelPendingInteractions function', () => {
      const { result } = renderHook(() => useScreenPerformance());
      
      expect(result.current.cancelPendingInteractions).toBeDefined();
      expect(typeof result.current.cancelPendingInteractions).toBe('function');
    });

    it('should execute callback when runAfterInteractions is called', async () => {
      const mockCallback = jest.fn();
      
      const { result } = renderHook(() => useScreenPerformance());
      
      act(() => {
        result.current.runAfterInteractions(mockCallback);
      });
      
      // Wait for async callback
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle multiple calls without throwing', () => {
      const { result } = renderHook(() => useScreenPerformance());
      
      expect(() => {
        act(() => {
          result.current.runAfterInteractions(jest.fn());
          result.current.runAfterInteractions(jest.fn());
        });
      }).not.toThrow();
    });

    it('should handle cancelPendingInteractions without throwing', () => {
      const { result } = renderHook(() => useScreenPerformance());
      
      expect(() => {
        act(() => {
          result.current.cancelPendingInteractions();
        });
      }).not.toThrow();
    });

    it('should cleanup on unmount', () => {
      const { result, unmount } = renderHook(() => useScreenPerformance());
      
      act(() => {
        result.current.runAfterInteractions(jest.fn());
      });
      
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('useLazyLoad', () => {
    it('should call fetch function on mount', async () => {
      const mockFetchFunction = jest.fn().mockResolvedValue('test-data');
      
      renderHook(() => useLazyLoad(mockFetchFunction));
      
      // Wait for async execution
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      expect(mockFetchFunction).toHaveBeenCalled();
    });

    it('should re-fetch when dependencies change', async () => {
      const mockFetchFunction = jest.fn().mockResolvedValue('test-data');
      
      // First render with initial dependency
      const { rerender } = renderHook(
        (props: { dependency?: string } = {}) => useLazyLoad(mockFetchFunction, [props.dependency || 'initial'])
      );
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      expect(mockFetchFunction).toHaveBeenCalledTimes(1);
      
      // Re-render with different dependency
      rerender({ dependency: 'changed' });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      expect(mockFetchFunction).toHaveBeenCalledTimes(2);
    });

    it('should return a lazyFetch function', () => {
      const mockFetchFunction = jest.fn().mockResolvedValue('test-data');
      
      const { result } = renderHook(() => useLazyLoad(mockFetchFunction));
      
      expect(result.current).toBeDefined();
      expect(typeof result.current).toBe('function');
    });

    it('should handle fetch function that throws errors', async () => {
      // Mock console.error to suppress error output during test
      const originalError = console.error;
      console.error = jest.fn();
      
      const mockFetchFunction = jest.fn().mockImplementation(() => 
        Promise.reject(new Error('Fetch failed'))
      );
      
      // Should not throw during render
      expect(() => {
        renderHook(() => useLazyLoad(mockFetchFunction));
      }).not.toThrow();
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      expect(mockFetchFunction).toHaveBeenCalled();
      
      // Restore console.error
      console.error = originalError;
    });

    it('should work without dependencies', async () => {
      const mockFetchFunction = jest.fn().mockResolvedValue('test-data');
      
      renderHook(() => useLazyLoad(mockFetchFunction));
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      expect(mockFetchFunction).toHaveBeenCalledTimes(1);
    });
  });
});