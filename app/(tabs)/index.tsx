import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { getDaysTogetherString } from '../../src/services/achievementService';
import { db } from '../../src/services/firebase';
import { CATEGORIES_CONFIG } from '../../src/types/budget';

const { width } = Dimensions.get('window');

// Типы для активности
type ActivityItem = {
  id: string;
  type: 'transaction' | 'task' | 'message';
  title: string;
  subtitle: string;
  amount?: number;
  time: string;
  icon: string;
  color: string;
};

export default function HomeScreen() {
  const { user, userData } = useAuth();
  const [daysString, setDaysString] = useState('Вместе');
  const [balance, setBalance] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!user || !userData?.familyId) return;

    // 1. Считаем дни
    if (userData.relationshipStartDate) {
      const d = userData.relationshipStartDate.toDate();
      setDaysString(getDaysTogetherString(d));
    } else {
      setDaysString("Укажите дату в профиле ❤️");
    }

    // 2. Получаем баланс (упрощенно: доход - расход за месяц)
    // В реальном проекте лучше хранить баланс отдельным полем или использовать облачные функции
    const qTrans = query(
      collection(db, 'transactions'),
      where('familyId', '==', userData.familyId),
      orderBy('date', 'desc'),
      limit(50) // Берем последние для расчета
    );
    const snapTrans = await getDocs(qTrans);
    let inc = 0;
    let exp = 0;
    snapTrans.forEach(doc => {
      const data = doc.data();
      if (data.type === 'income') inc += data.amount;
      else exp += data.amount;
    });
    setBalance(inc - exp);

    // 3. Формируем ленту активности (микс из транзакций и задач)
    const newActivities: ActivityItem[] = [];

    // Транзакции
    snapTrans.forEach(doc => {
      const data = doc.data();
      const date = data.date?.toDate ? data.date.toDate() : new Date();
      newActivities.push({
        id: doc.id,
        type: 'transaction',
        title: data.category || 'Транзакция',
        subtitle: data.comment || (data.serviceName ? `Подписка: ${data.serviceName}` : ''),
        amount: data.amount,
        time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        icon: data.iconName || CATEGORIES_CONFIG[data.category]?.icon || 'wallet',
        color: data.serviceColor || CATEGORIES_CONFIG[data.category]?.color || '#007AFF',
      });
    });

    // Задачи (можно добавить аналогичный запрос к tasks)
    // ... (код для задач, если нужно)

    setActivities(newActivities.slice(0, 5)); // Топ 5 событий
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [user, userData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* --- ШАПКА --- */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Привет, {userData?.displayName?.split(' ')[0] || 'Семья'}!</Text>
          <Text style={styles.dateText}>{daysString}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatarBtn}>
          <Text style={styles.avatarText}>{(userData?.displayName || 'U')[0]}</Text>
        </TouchableOpacity>
      </View>

      {/* --- ГЛАВНЫЙ ВИДЖЕТ: ДНИ ВМЕСТЕ --- */}
      <TouchableOpacity 
        style={styles.heroCard}
        onPress={() => router.push('/(tabs)/profile')}
        activeOpacity={0.9}
      >
        <View style={styles.heroIconBox}>
          <Ionicons name="heart" size={32} color="#FF3B30" />
        </View>
        <Text style={styles.heroValue}>{daysString}</Text>
        <Text style={styles.heroSubtitle}>История вашей любви</Text>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>Наши достижения</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* --- ФИНАНСОВЫЙ БЛОК --- */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Бюджет</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/finance')}>
            <Text style={styles.seeAll}>Все финансы</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.balanceCard}
          onPress={() => router.push('/(tabs)/finance')}
        >
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Текущий баланс</Text>
            <Ionicons name="wallet" size={24} color="#007AFF" />
          </View>
          <Text style={styles.balanceValue}>{balance.toLocaleString()} ₽</Text>
          <View style={styles.balanceFooter}>
            <Text style={styles.balanceHint}>Нажмите для деталей</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* --- ЛЕНТА АКТИВНОСТИ --- */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Активность</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/chat')}>
             <Text style={styles.seeAll}>Чат семьи</Text>
          </TouchableOpacity>
        </View>

        {activities.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Ionicons name="leaf-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>Пока тихо...</Text>
          </View>
        ) : (
          activities.map((item) => (
            <View key={item.id} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activitySubtitle}>{item.subtitle || item.time}</Text>
              </View>
              {item.amount !== undefined && (
                <Text style={[styles.activityAmount, item.amount >= 0 ? styles.income : styles.expense]}>
                  {item.amount >= 0 ? '+' : '-'}{Math.abs(item.amount)} ₽
                </Text>
              )}
              {!item.amount && <Text style={styles.activityTime}>{item.time}</Text>}
            </View>
          ))
        )}
      </View>

      {/* Отступ снизу для плавающих кнопок */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  dateText: { fontSize: 14, color: '#FF3B30', fontWeight: '600', marginTop: 4 },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  
  heroCard: { margin: 20, padding: 24, backgroundColor: '#FFF0F0', borderRadius: 24, alignItems: 'center', shadowColor: '#FF3B30', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  heroIconBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  heroValue: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 6 },
  heroSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  heroBadgeText: { color: '#fff', fontWeight: '600', marginRight: 6 },

  section: { marginBottom: 24, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  seeAll: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  
  balanceCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  balanceLabel: { fontSize: 14, color: '#666' },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  balanceFooter: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  balanceHint: { fontSize: 12, color: '#999', fontStyle: 'italic' },

  emptyActivity: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 16 },
  emptyText: { marginTop: 10, color: '#999' },
  
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  activityIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  activitySubtitle: { fontSize: 12, color: '#999', marginTop: 2 },
  activityAmount: { fontSize: 15, fontWeight: 'bold' },
  activityTime: { fontSize: 12, color: '#999' },
  income: { color: '#34C759' },
  expense: { color: '#FF3B30' },
});