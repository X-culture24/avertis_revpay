import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import { colors } from '@/theme/theme';
import { apiService } from '@/services/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'invoice' | 'sync' | 'system' | 'compliance' | 'payment';
  timestamp: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
}

const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [invoiceNotifs, setInvoiceNotifs] = useState(true);
  const [syncNotifs, setSyncNotifs] = useState(true);
  const [complianceNotifs, setComplianceNotifs] = useState(true);

  useEffect(() => {
    loadNotifications();
    loadNotificationSettings();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await apiService.get('/notifications/list/');
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const response = await apiService.get('/notifications/settings/');
      const settings = response.data.settings;
      setPushEnabled(settings.push_enabled);
      setEmailEnabled(settings.email_enabled);
      setInvoiceNotifs(settings.invoice_notifications);
      setSyncNotifs(settings.sync_notifications);
      setComplianceNotifs(settings.compliance_notifications);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await apiService.post(`/notifications/${notificationId}/read/`);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.post('/notifications/mark-all-read/');
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete(`/notifications/${notificationId}/delete/`);
              setNotifications(prev => prev.filter(n => n.id !== notificationId));
            } catch (error) {
              console.error('Error deleting notification:', error);
              Alert.alert('Error', 'Failed to delete notification');
            }
          },
        },
      ]
    );
  };

  const clearAllNotifications = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete('/notifications/clear-all/');
              setNotifications([]);
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications');
            }
          },
        },
      ]
    );
  };

  const saveNotificationSettings = async () => {
    try {
      const response = await apiService.post('/notifications/settings/', {
        push_enabled: pushEnabled,
        email_enabled: emailEnabled,
        invoice_notifications: invoiceNotifs,
        sync_notifications: syncNotifs,
        compliance_notifications: complianceNotifs,
      });
      
      if (response.success) {
        Alert.alert('Success', 'Notification settings saved successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to save settings');
      }
    } catch (error: any) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'Failed to save notification settings');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invoice': return '📄';
      case 'sync': return '🔄';
      case 'system': return '⚙️';
      case 'compliance': return '📊';
      case 'payment': return '💰';
      default: return '🔔';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      case 'low': return colors.textSecondary;
      default: return colors.text;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={markAllAsRead}
          disabled={unreadCount === 0}
        >
          <Text style={[styles.actionButtonText, unreadCount === 0 && styles.disabledText]}>
            Mark All Read
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={clearAllNotifications}
          disabled={notifications.length === 0}
        >
          <Text style={[styles.actionButtonText, notifications.length === 0 && styles.disabledText]}>
            Clear All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <View style={styles.section}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>You're all caught up!</Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.unreadCard,
              ]}
              onPress={() => markAsRead(notification.id)}
            >
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationIcon}>
                  {getNotificationIcon(notification.type)}
                </Text>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationTitleRow}>
                    <Text style={styles.notificationTitle}>
                      {notification.title}
                    </Text>
                    {!notification.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {formatTimestamp(notification.timestamp)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteNotification(notification.id)}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Settings</Text>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <Text style={styles.settingDescription}>
            Receive push notifications on your device
          </Text>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Email Notifications</Text>
            <Switch
              value={emailEnabled}
              onValueChange={setEmailEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <Text style={styles.settingDescription}>
            Receive notifications via email
          </Text>
        </View>

        <Text style={styles.subsectionTitle}>Notification Types</Text>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Invoice Updates</Text>
            <Switch
              value={invoiceNotifs}
              onValueChange={setInvoiceNotifs}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Sync Status</Text>
            <Switch
              value={syncNotifs}
              onValueChange={setSyncNotifs}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Compliance Alerts</Text>
            <Switch
              value={complianceNotifs}
              onValueChange={setComplianceNotifs}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveNotificationSettings}
        >
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 10,
  },
  badge: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  disabledText: {
    color: colors.textSecondary,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: '#f8f9ff',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 5,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: 5,
  },
  deleteButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 5,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationsScreen;
