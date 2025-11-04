import React from 'react';
import Constants from 'expo-constants';
import { useRevenueCat } from '../context/RevenueCatContext';
import { AdPlaceholder } from './AdPlaceholder';

// Only import and use Google Mobile Ads if not in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

interface AdBannerProps {
  style?: any;
}

export function AdBanner({ style }: AdBannerProps) {
  const { isPremium } = useRevenueCat();

  // Don't show ads to premium users
  if (isPremium) {
    return null;
  }

  // In Expo Go, always show placeholder
  if (isExpoGo) {
    return <AdPlaceholder style={style} />;
  }

  // For development build/production, dynamically import the real ad component
  try {
    const { RealAdBanner } = require('./RealAdBanner');
    return <RealAdBanner style={style} />;
  } catch (error) {
    console.log('Real ads not available, showing placeholder');
    return <AdPlaceholder style={style} />;
  }
}