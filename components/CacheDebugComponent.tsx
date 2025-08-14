import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { cachedDataService } from '../utils/cachedDataService';
import { sqliteCache } from '../utils/sqliteCache';

interface CacheDebugProps {
  visible: boolean;
  onClose: () => void;
}

const CacheDebugComponent: React.FC<CacheDebugProps> = ({ visible, onClose }) => {
  const [cacheStats, setCacheStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    if (visible) {
      loadCacheStats();
    }
  }, [visible]);

  const loadCacheStats = async () => {
    try {
      setLoading(true);
      const stats = await cachedDataService.getCacheInfo();
      setCacheStats(stats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all cached data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await sqliteCache.clearCache();
              Alert.alert('Success', 'Cache cleared successfully');
              loadCacheStats();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          }
        }
      ]
    );
  };

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: `${theme.background}F0` }]}>
      <View style={[styles.modal, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            Cache Debug Info
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Cache Statistics
            </Text>
            
            {loading ? (
              <Text style={[styles.infoText, { color: theme.subtext }]}>
                Loading...
              </Text>
            ) : (
              <>
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    Timestamp:
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {cacheStats.timestamp || 'N/A'}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    User Profiles:
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {cacheStats.user_profiles_cache || 0}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    Meals:
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {cacheStats.meals_cache || 0}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    Meal Plans:
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {cacheStats.meal_plan_cache || 0}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    Macro Meals:
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {cacheStats.macro_meals_cache || 0}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: theme.subtext }]}>
                    Meal Ingredients:
                  </Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {cacheStats.meal_ingredients_cache || 0}
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Actions
            </Text>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={loadCacheStats}
            >
              <Ionicons name="refresh" size={16} color={theme.buttonText} />
              <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
                Refresh Stats
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.danger }]}
              onPress={clearCache}
            >
              <Ionicons name="trash" size={16} color={theme.buttonText} />
              <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>
                Clear Cache
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={[styles.infoText, { color: theme.subtext }]}>
              This debug panel shows the current state of the SQLite cache.
              Cache helps improve app performance by storing frequently accessed data locally.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 14,
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
});

export default CacheDebugComponent;
