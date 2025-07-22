import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  RefreshControl,
  ActivityIndicator 
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Report {
  report_id: number;
  user_id: string;
  meal_id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter_username?: string;
  meal_title?: string;
}

const AdminReportsScreen: React.FC = () => {
  const { theme } = useTheme();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      const { data, error: fetchError } = await supabase
        .from('reports')
        .select(`
          *,
          user_profiles!reports_user_id_fkey(username),
          meals!reports_meal_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching reports:', fetchError);
        throw new Error(fetchError.message || 'Failed to fetch reports');
      }

      const formattedReports = data?.map(report => ({
        ...report,
        reporter_username: report.user_profiles?.username || 'Unknown',
        meal_title: report.meals?.name || `Meal ID: ${report.meal_id}`,
      })) || [];

      setReports(formattedReports);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage = error?.message || 'An unexpected error occurred while fetching reports';
      setError(errorMessage);
      
      // Auto-retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchReports(isRefresh);
        }, delay);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchReports();
  }, [fetchReports]);

  const onRefresh = useCallback(() => {
    fetchReports(true);
  }, [fetchReports]);

  const handleReportAction = useCallback(async (reportId: number, action: 'Resolved' | 'Dismissed') => {
    if (actionLoading === reportId) return; // Prevent double-tap

    if (action === 'Resolved') {
      // Show options for resolving
      Alert.alert(
        'Resolve Report',
        'How would you like to resolve this report?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Hide Meal',
            onPress: () => handleResolveWithMealAction(reportId, 'hide_meal'),
          },
          {
            text: 'Ban User',
            onPress: () => handleResolveWithMealAction(reportId, 'ban_user'),
            style: 'destructive',
          },
          {
            text: 'Mark Resolved Only',
            onPress: () => updateReportStatus(reportId, 'Resolved'),
          },
        ]
      );
    } else {
      // Direct dismiss
      updateReportStatus(reportId, 'Dismissed');
    }
  }, [actionLoading]);

  const navigateToMealDetails = useCallback(async (reportId: number) => {
    if (actionLoading === reportId) return; // Prevent double-tap
    
    try {
      setActionLoading(reportId);
      
      // Get the meal_id from the report
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('meal_id')
        .eq('report_id', reportId)
        .single();

      if (reportError) {
        console.error('Error fetching report details:', reportError);
        Alert.alert('Error', 'Failed to fetch report details. Please try again.');
        return;
      }

      // Navigate to admin meal view screen
      router.push(`./meal-details?mealId=${reportData.meal_id}&reportId=${reportId}`);
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred while navigating to meal details');
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading]);

  const handleResolveWithMealAction = useCallback(async (reportId: number, actionType: 'hide_meal' | 'ban_user') => {
    if (actionLoading === reportId) return; // Prevent double-tap
    
    try {
      setActionLoading(reportId);
      
      // First get the report details to know which meal and user
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('meal_id, user_id')
        .eq('report_id', reportId)
        .single();

      if (reportError) {
        console.error('Error fetching report details:', reportError);
        throw new Error('Failed to fetch report details');
      }

      if (actionType === 'hide_meal') {
        // Set meal's forever_invis to true
        const { error: mealError } = await supabase
          .from('meals')
          .update({ forever_invis: true })
          .eq('id', reportData.meal_id);

        if (mealError) {
          console.error('Error hiding meal:', mealError);
          throw new Error('Failed to hide meal');
        }
      } else if (actionType === 'ban_user') {
        // Set user's ban column to true
        const { error: banError } = await supabase
          .from('user_profiles')
          .update({ ban: true })
          .eq('id', reportData.user_id);

        if (banError) {
          console.error('Error banning user:', banError);
          throw new Error('Failed to ban user');
        }
      }

      // Update report status to resolved
      await updateReportStatus(reportId, 'Resolved');
      
      const actionText = actionType === 'hide_meal' ? 'Meal hidden and report resolved' : 'User banned and report resolved';
      Alert.alert('Success', actionText);
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred while processing the action');
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading]);

  const updateReportStatus = useCallback(async (reportId: number, status: 'Resolved' | 'Dismissed') => {
    if (actionLoading === reportId) return; // Prevent double-tap
    
    try {
      setActionLoading(reportId);
      
      const { error } = await supabase
        .from('reports')
        .update({ status: status })
        .eq('report_id', reportId);

      if (error) {
        console.error('Error updating report:', error);
        throw new Error('Failed to update report status');
      }

      // Refresh the reports list
      fetchReports();
      if (status === 'Dismissed') {
        Alert.alert('Success', 'Report dismissed successfully');
      }
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred while updating report status');
    } finally {
      setActionLoading(null);
    }
  }, [fetchReports, actionLoading]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#FFA500'; // Orange
      case 'resolved':
        return '#4CAF50'; // Green
      case 'dismissed':
        return '#9E9E9E'; // Gray
      default:
        return theme.text;
    }
  };

  const renderReportItem = useCallback(({ item }: { item: Report }) => {
    const isActionLoading = actionLoading === item.report_id;
    
    return (
      <View style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.reportHeader}>
          <Text style={[styles.reportType, { color: theme.text }]}>Report</Text>
          <Text style={[styles.reportStatus, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        
        <Text style={[styles.reportDetail, { color: theme.text }]}>
          Reporter: {item.reporter_username}
        </Text>
        
        {item.meal_title && (
          <Text style={[styles.reportDetail, { color: theme.text }]}>
            Meal: {item.meal_title}
          </Text>
        )}
        
        <Text style={[styles.reportDescription, { color: theme.text }]}>
          {item.reason}
        </Text>
        
        <Text style={[styles.reportDate, { color: theme.subtext }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>

        {item.status === 'Pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: '#2196F3', opacity: isActionLoading ? 0.6 : 1 }
              ]}
              onPress={() => navigateToMealDetails(item.report_id)}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.actionButtonText}>View Meal</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: '#4CAF50', opacity: isActionLoading ? 0.6 : 1 }
              ]}
              onPress={() => handleReportAction(item.report_id, 'Resolved')}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.actionButtonText}>Resolve</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                { backgroundColor: '#9E9E9E', opacity: isActionLoading ? 0.6 : 1 }
              ]}
              onPress={() => handleReportAction(item.report_id, 'Dismissed')}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.actionButtonText}>Dismiss</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [theme, actionLoading, getStatusColor, navigateToMealDetails, handleReportAction]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Reports</Text>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && !error && (
        <View style={[styles.retryBanner, { backgroundColor: theme.card, borderColor: theme.primary }]}>
          <Text style={[styles.retryBannerText, { color: theme.primary }]}>
            Retrying... (Attempt {retryCount})
          </Text>
        </View>
      )}

      <FlatList
        data={reports}
        renderItem={renderReportItem}
        keyExtractor={(item) => item.report_id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {loading ? (
              <>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.emptyText, { color: theme.subtext, marginTop: 16 }]}>
                  Loading reports...
                </Text>
              </>
            ) : (
              <Text style={[styles.emptyText, { color: theme.subtext }]}>
                No reports found
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  errorBannerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  retryBanner: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
  },
  reportCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportType: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportStatus: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  reportDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  reportDate: {
    fontSize: 12,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default AdminReportsScreen;
