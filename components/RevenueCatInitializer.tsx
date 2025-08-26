import { useEffect } from 'react';
import { revenueCatManager } from '../utils/revenueCat';
import { supabase } from '../utils/supabase';

export const useRevenueCatInitialization = () => {
  useEffect(() => {
    const initializeRevenueCat = async () => {
      try {
        // Get current user ID if authenticated
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;
        
        console.log('Initializing RevenueCat with user ID:', userId);
        await revenueCatManager.initialize(userId);
        
        console.log('RevenueCat initialized successfully');
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
        // Don't throw here - app should still work without RevenueCat
      }
    };

    initializeRevenueCat();
  }, []);
};

// Component version for easy integration
export const RevenueCatInitializer: React.FC = () => {
  useRevenueCatInitialization();
  return null; // This component renders nothing
};
