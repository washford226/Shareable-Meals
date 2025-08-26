import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const SCANNER_USAGE_KEY = 'scanner_usage';

// Future implementation - currently no limits
const MAX_DAILY_SCANS = {
  nutrition: 999, // Currently unlimited
  barcode: 999,   // Currently unlimited
};

export interface ScannerUsageData {
  date: string;
  nutritionScans: number;
  barcodeScans: number;
}

export class ScannerUsageTracker {
  private static instance: ScannerUsageTracker;

  static getInstance(): ScannerUsageTracker {
    if (!ScannerUsageTracker.instance) {
      ScannerUsageTracker.instance = new ScannerUsageTracker();
    }
    return ScannerUsageTracker.instance;
  }

  private getTodayKey(): string {
    return format(new Date(), 'yyyy-MM-dd');
  }

  async getTodaysUsage(): Promise<ScannerUsageData> {
    try {
      const todayKey = this.getTodayKey();
      const data = await AsyncStorage.getItem(`${SCANNER_USAGE_KEY}_${todayKey}`);
      
      if (data) {
        return JSON.parse(data);
      }
      
      return {
        date: todayKey,
        nutritionScans: 0,
        barcodeScans: 0,
      };
    } catch (error) {
      console.error('Error getting scanner usage:', error);
      return {
        date: this.getTodayKey(),
        nutritionScans: 0,
        barcodeScans: 0,
      };
    }
  }

  async canUseScannerType(type: 'nutrition' | 'barcode'): Promise<boolean> {
    try {
      const usage = await this.getTodaysUsage();
      const limit = MAX_DAILY_SCANS[type];
      const used = type === 'nutrition' ? usage.nutritionScans : usage.barcodeScans;
      
      return used < limit;
    } catch (error) {
      console.error('Error checking scanner availability:', error);
      return true; // Default to allowing usage
    }
  }

  async incrementScannerUsage(type: 'nutrition' | 'barcode'): Promise<{
    success: boolean;
    remaining: number;
    error?: string;
  }> {
    try {
      const canUse = await this.canUseScannerType(type);
      
      if (!canUse) {
        const limit = MAX_DAILY_SCANS[type];
        return {
          success: false,
          remaining: 0,
          error: `Daily ${type} scan limit of ${limit} reached.`
        };
      }

      const todayKey = this.getTodayKey();
      const currentUsage = await this.getTodaysUsage();
      
      if (type === 'nutrition') {
        currentUsage.nutritionScans += 1;
      } else {
        currentUsage.barcodeScans += 1;
      }
      
      await AsyncStorage.setItem(
        `${SCANNER_USAGE_KEY}_${todayKey}`, 
        JSON.stringify(currentUsage)
      );
      
      const limit = MAX_DAILY_SCANS[type];
      const used = type === 'nutrition' ? currentUsage.nutritionScans : currentUsage.barcodeScans;
      const remaining = limit - used;
      
      return {
        success: true,
        remaining,
      };
    } catch (error) {
      console.error('Error incrementing scanner usage:', error);
      return {
        success: false,
        remaining: 0,
        error: 'Failed to track scanner usage'
      };
    }
  }

  // For future implementation when limits are added
  async getScannerStats(): Promise<{
    nutritionScans: number;
    barcodeScans: number;
    nutritionRemaining: number;
    barcodeRemaining: number;
    nutritionLimit: number;
    barcodeLimit: number;
  }> {
    const usage = await this.getTodaysUsage();
    
    return {
      nutritionScans: usage.nutritionScans,
      barcodeScans: usage.barcodeScans,
      nutritionRemaining: MAX_DAILY_SCANS.nutrition - usage.nutritionScans,
      barcodeRemaining: MAX_DAILY_SCANS.barcode - usage.barcodeScans,
      nutritionLimit: MAX_DAILY_SCANS.nutrition,
      barcodeLimit: MAX_DAILY_SCANS.barcode,
    };
  }

  // Clean up old usage data
  async cleanupOldData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const scannerKeys = allKeys.filter(key => key.startsWith(SCANNER_USAGE_KEY));
      const todayKey = this.getTodayKey();
      
      // Remove keys older than 7 days
      const keysToRemove = scannerKeys.filter(key => {
        const dateStr = key.replace(`${SCANNER_USAGE_KEY}_`, '');
        if (dateStr === todayKey) return false; // Keep today
        
        try {
          const keyDate = new Date(dateStr);
          const daysDiff = (new Date().getTime() - keyDate.getTime()) / (1000 * 3600 * 24);
          return daysDiff > 7;
        } catch {
          return true; // Remove invalid keys
        }
      });
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`Cleaned up ${keysToRemove.length} old scanner usage entries`);
      }
    } catch (error) {
      console.error('Error cleaning up old scanner usage data:', error);
    }
  }
}

export const scannerUsageTracker = ScannerUsageTracker.getInstance();
