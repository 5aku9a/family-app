import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { formatDaysString, getDaysTogether } from '../../src/services/relationshipService';

const { width } = Dimensions.get('window');

// Выносим компонент наружу, чтобы избежать ошибок области видимости
const StatCard = ({ title, value, icon, color, onPress }: any) => (
  <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <View style={styles.statInfo}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  </TouchableOpacity>
);

export default function HomeScreen() {
  const { user, userData, refreshUserData } = useAuth();
  const [daysString, setDaysString] = useState('');
  const [showRelationship, setShowRelationship] = useState(false);
  const [stats] = useState({ balance: 12500, tasks: 3, messages: 15 });

  // Принудительное обновление при возврате на экран
  useFocusEffect(
    useCallback(() => {
      if (refreshUserData) refreshUserData();
    }, [])
  );

  useEffect(() => {
    if (userData?.partnerId && userData?.relationshipStartDate) {
      setShowRelationship(true);
      const days = getDaysTogether(userData.relationshipStartDate);
      setDaysString(formatDaysString(days));
    } else {
      setShowRelationship(false);
      setDaysString("");
    }
  }, [userData]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Привет, {userData?.displayName || 'Семья'}! 👋</Text>
          {showRelationship && (
            <Text style={styles.dateText}>❤️ {daysString}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <View style={styles.avatarPlaceholder}>
            <Text style={{color:'#fff', fontWeight:'bold'}}>{(userData?.displayName || 'U')[0]}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {showRelationship && (
        <TouchableOpacity 
          style={styles.heroCard}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Ionicons name="heart" size={32} color="#FF3B30" />
          <Text style={styles.heroValue}>{daysString}</Text>
          <Text style={styles.heroLabel}>Вы потрясающая пара!</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Обзор</Text>
      <View style={styles.statsGrid}>
        <StatCard title="Баланс" value={`${stats.balance.toLocaleString()} ₽`} icon="wallet" color="#007AFF" onPress={() => router.push('/(tabs)/finance')} />
        <StatCard title="Задачи" value={stats.tasks} icon="checkbox" color="#34C759" onPress={() => router.push('/(tabs)/tasks')} />
        <StatCard title="Сообщения" value={stats.messages} icon="chatbubbles" color="#5856D6" onPress={() => router.push('/(tabs)/chat')} />
      </View>

      <Text style={styles.sectionTitle}>Быстро</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/finance')}>
          <Ionicons name="add-circle" size={30} color="#FF6B6B" /><Text style={styles.actionText}>Расход</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/tasks')}>
          <Ionicons name="create-outline" size={30} color="#007AFF" /><Text style={styles.actionText}>Задача</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/chat')}>
          <Ionicons name="send" size={30} color="#5856D6" /><Text style={styles.actionText}>Чат</Text>
        </TouchableOpacity>
      </View>
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  dateText: { fontSize: 14, color: '#FF3B30', fontWeight: '600', marginTop: 4 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  heroCard: { margin: 20, padding: 20, backgroundColor: '#FFF0F0', borderRadius: 20, alignItems: 'center', shadowColor: '#FF3B30', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  heroValue: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', marginTop: 5 },
  heroLabel: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginHorizontal: 20, marginBottom: 12, marginTop: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 24 },
  statCard: { width: (width - 56) / 2, backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2, borderLeftWidth: 4 },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statInfo: { flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20 },
  actionBtn: { alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, width: (width - 60) / 3, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  actionText: { marginTop: 8, fontSize: 12, color: '#666', fontWeight: '600' },
});