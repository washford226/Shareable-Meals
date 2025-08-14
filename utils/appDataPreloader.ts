import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { cachedDataService } from './cachedDataService';
import { supabase } from './supabase';

class AppDataPreloader {
  private isPreloading = false;
  private lastPreloadTime = 0;
  private readonly PRELOAD_COOLDOWN = 5 * 60 * 1000; // 5 minutes
  private appStateSubscription: any = null;

  async preloadAppData(): Promise<void> {
    if (this.isPreloading) {
      console.log('🔄 Preloading already in progress, skipping...');
      return;
    }

    const now = Date.now();
    if (now - this.lastPreloadTime < this.PRELOAD_COOLDOWN) {
      console.log('🕐 Preload cooldown active, skipping...');
      return;
    }

    try {
      this.isPreloading = true;
      this.lastPreloadTime = now;
      
      console.log('🚀 Starting app data preload...');

      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.log('👤 No authenticated user, skipping preload');
        return;
      }

      const userId = userData.user.id;
      const today = new Date();

      // Preload all critical data in parallel
      await Promise.all([
        cachedDataService.preloadWeekData(userId, today),
        this.preloadUserProfileSilently(userId),
      ]);

      console.log('✅ App data preloaded successfully');
    } catch (error) {
      console.error('❌ Error during app data preload:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  private async preloadUserProfileSilently(userId: string): Promise<void> {
    try {
      await cachedDataService.getUserProfile(userId);
    } catch (error) {
      // Silent failure for background preloading
      console.warn('Profile preload failed:', error);
    }
  }

  async backgroundSync(): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      console.log('🔄 Starting background sync...');
      await cachedDataService.backgroundSync(userData.user.id);
    } catch (error) {
      console.warn('Background sync failed:', error);
    }
  }

  startAppStateMonitoring(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      // App became active - preload data
      setTimeout(() => {
        this.preloadAppData();
      }, 1000); // Wait 1 second after app becomes active
    } else if (nextAppState === 'background') {
      // App went to background - trigger background sync
      setTimeout(() => {
        this.backgroundSync();
      }, 2000); // Wait 2 seconds before background sync
    }
  }

  stopAppStateMonitoring(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

// Export singleton instance
export const appDataPreloader = new AppDataPreloader();

/**
 * React hook to enable automatic data preloading
 */
export const useDataPreloader = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    // Start monitoring app state changes
    appDataPreloader.startAppStateMonitoring();

    // Initial preload when hook mounts
    const timer = setTimeout(() => {
      appDataPreloader.preloadAppData();
    }, 2000); // Wait 2 seconds after app start

    return () => {
      clearTimeout(timer);
      appDataPreloader.stopAppStateMonitoring();
    };
  }, [enabled]);
};
