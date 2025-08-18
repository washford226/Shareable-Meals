import { sqliteCache } from './sqliteCache';

/**
 * Cache Preloader - Initializes SQLite cache in background on app startup
 * This ensures cache is ready when users navigate to screens, eliminating delays
 */
class CachePreloader {
  private initStarted = false;
  
  /**
   * Start cache initialization in background (non-blocking)
   * Call this from App.tsx or root layout as early as possible
   */
  async startBackgroundInitialization(): Promise<void> {
    if (this.initStarted) return;
    
    this.initStarted = true;
    
    try {
      console.log('🚀 Starting background cache initialization...');
      
      // Initialize cache in background without blocking UI
      sqliteCache.initialize()
        .then(() => {
          console.log('✅ Background cache initialization completed');
        })
        .catch(error => {
          console.warn('⚠️ Background cache initialization failed (non-critical):', error);
        });
        
    } catch (error) {
      console.warn('Cache preloader failed:', error);
    }
  }

  /**
   * Warm up cache with user data (optional)
   * Call this after user authentication
   */
  async warmupUserCache(userId: string): Promise<void> {
    try {
      // Don't block UI - just start warming cache in background
      const { cachedDataService } = await import('./cachedDataService');
      
      // Pre-fetch commonly used data
      Promise.all([
        cachedDataService.getUserMeals(userId, false).catch(() => null),
        cachedDataService.getMealPlanForWeek(userId, new Date(), false).catch(() => null),
      ]).then(() => {
        console.log('📱 User cache warmup completed');
      }).catch(error => {
        console.warn('Cache warmup failed (non-critical):', error);
      });
      
    } catch (error) {
      console.warn('Cache warmup initialization failed:', error);
    }
  }
}

export const cachePreloader = new CachePreloader();
