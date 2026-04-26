import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/services/firebase';
import { CATEGORIES_CONFIG } from '../../src/types/budget';

const { width } = Dimensions.get('window');

export default function IndexScreen() {
  const { user, userData } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Отступ снизу: высота таб-бара (60) + отступ безопасной зоны + небольшой запас
  const FAB_BOTTOM = 70 + insets.bottom;

  useEffect(() => {
    if (!userData?.familyId && !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const familyId = userData?.familyId || user?.uid;
    
    // 1. Транзакции (последние 5)
    const qTrans = query(
      collection(db, 'budget'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc'),
      limit(5)
    );
    
    // 2. Ближайшие элементы расписания
    const qSchedule = query(
      collection(db, 'schedule'),
      where('familyId', '==', familyId),
      orderBy('startTime', 'asc'),
      limit(3)
    );

    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecentTransactions(data);
      
      // Подсчет баланса за месяц
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      
      let income = 0;
      let expense = 0;

      data.forEach((t: any) => {
        if (t.date && t.date.toDate) {
          const tTime = t.date.toDate().getTime();
          if (tTime >= startMonth) {
            if (t.type === 'income') income += (t.amount || 0);
            if (t.type === 'expense') expense += (t.amount || 0);
          }
        }
      });
      
      setBalance(income - expense);
      setLoading(false);
    }, (err) => {
      console.error("Ошибка транзакций:", err);
      setLoading(false);
    });

    const unsubSchedule = onSnapshot(qSchedule, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUpcomingItems(data);
    }, (err) => {
      console.error("Ошибка расписания:", err);
    });

    return () => { unsubTrans(); unsubSchedule(); };
  }, [userData?.familyId, user]);

  if (loading) return <ActivityIndicator size="large" color="#00F0FF" style={{ flex: 1, backgroundColor: '#0B1120' }} />;

  return (
    <View style={styles.container}>
      {/* Звездный фон (упрощенный для главной) */}
      <View style={styles.starsBg} />

      <ScrollView 
        contentContainerStyle={{ paddingBottom: FAB_BOTTOM + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Приветствие */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Привет,</Text>
            <Text style={styles.userName}>{userData?.displayName?.split(' ')[0] || 'Пилот'}!</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatarBtn}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarText}>{userData?.displayName?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Карточка баланса */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Баланс за этот месяц</Text>
          <Text style={styles.balanceValue}>{balance.toLocaleString()} ₽</Text>
          
          <View style={styles.balanceStats}>
            <View style={styles.statItem}>
              <Ionicons name="arrow-up-circle" size={20} color="#4CD964" />
              <Text style={styles.statText}>Доходы</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="arrow-down-circle" size={20} color="#FF3B30" />
              <Text style={styles.statText}>Расходы</Text>
            </View>
          </View>
        </View>

        {/* Быстрые действия */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: 'rgba(255, 59, 48, 0.15)', borderColor: 'rgba(255, 59, 48, 0.3)' }]} 
            onPress={() => router.push('/finance')}
          >
            <Ionicons name="card" size={24} color="#FF3B30" />
            <Text style={[styles.actionText, { color: '#FF3B30' }]}>Расход</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: 'rgba(0, 122, 255, 0.15)', borderColor: 'rgba(0, 122, 255, 0.3)' }]} 
            onPress={() => router.push('/schedule')}
          >
            <Ionicons name="checkbox-outline" size={24} color="#007AFF" />
            <Text style={[styles.actionText, { color: '#007AFF' }]}>Задача</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: 'rgba(255, 149, 0, 0.15)', borderColor: 'rgba(255, 149, 0, 0.3)' }]} 
            onPress={() => router.push('/schedule')}
          >
            <Ionicons name="calendar-outline" size={24} color="#FF9500" />
            <Text style={[styles.actionText, { color: '#FF9500' }]}>Событие</Text>
          </TouchableOpacity>
        </View>

        {/* Ближайшее в расписании */}
        {upcomingItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>На орбите</Text>
              <TouchableOpacity onPress={() => router.push('/schedule')}>
                <Text style={styles.seeAll}>Все</Text>
              </TouchableOpacity>
            </View>
            
            {upcomingItems.map((item: any) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.itemCard}
                onPress={() => router.push(`/schedule/${item.id}`)}
              >
                <View style={[styles.itemIconBox, { backgroundColor: `${item.color || '#007AFF'}20` }]}>
                  <Ionicons 
                    name={item.type === 'task' ? 'checkbox-outline' : 'calendar-outline'} 
                    size={20} 
                    color={item.color || '#007AFF'} 
                  />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.itemDate}>
                    {item.startTime?.toDate ? item.startTime.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    {item.assigneeName && ` • ${item.assigneeName}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Последние транзакции */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Журнал операций</Text>
            <TouchableOpacity onPress={() => router.push('/finance')}>
              <Text style={styles.seeAll}>Все</Text>
            </TouchableOpacity>
          </View>
          
          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#475569" />
              <Text style={styles.emptyText}>Пока нет операций</Text>
            </View>
          ) : (
            recentTransactions.map((t: any) => {
              const config = CATEGORIES_CONFIG[t.category] || { icon: 'wallet', color: '#999' };
              return (
                <View key={t.id} style={styles.transCard}>
                  <View style={[styles.transIcon, { backgroundColor: config.color }]}>
                    <Ionicons name={config.icon as any} size={18} color="#fff" />
                  </View>
                  <View style={styles.transInfo}>
                    <Text style={styles.transCat}>{t.category}</Text>
                    {t.userName ? (
                      <Text style={styles.transUser}>{t.userName}</Text>
                    ) : (
                      <Text style={styles.transDate}>{t.date?.toDate ? t.date.toDate().toLocaleDateString('ru-RU') : ''}</Text>
                    )}
                  </View>
                  <Text style={[styles.transAmount, t.type === 'income' ? styles.income : styles.expense]}>
                    {t.type === 'income' ? '+' : '-'}{t.amount} ₽
                  </Text>
                </View>
              );
            })
          )}
        </View>
        
        {/* Подпись автора внизу */}
      </ScrollView>

      {/* Плавающая кнопка (FAB) */}
      <TouchableOpacity 
        style={[styles.fab, { bottom: FAB_BOTTOM }]} 
        onPress={() => router.push('/finance')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#0B1120" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  starsBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }, // Можно заменить на компонент со звездами
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50 },
  greeting: { fontSize: 16, color: '#94A3B8', fontWeight: '500' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#E2E8F0', marginTop: 2 },
  avatarBtn: { padding: 4 },
  avatarSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00F0FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#0B1120', fontWeight: 'bold', fontSize: 18 },
  
  // Balance Card
  balanceCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', marginHorizontal: 16, borderRadius: 24, padding: 24, shadowColor: '#1a1716', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  balanceLabel: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  balanceValue: { color: '#fff', fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  balanceStats: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statText: { color: '#E2E8F0', fontWeight: '600', fontSize: 14 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Quick Actions
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 24, gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, gap: 8, borderWidth: 1 },
  actionText: { fontWeight: '700', fontSize: 13 },

  // Sections
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#E2E8F0' },
  seeAll: { color: '#00F0FF', fontSize: 14, fontWeight: '600' },

  // Items (Schedule)
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  itemIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#E2E8F0', marginBottom: 4 },
  itemDate: { fontSize: 12, color: '#94A3B8' },

  // Transactions
  transCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  transIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  transInfo: { flex: 1 },
  transCat: { fontSize: 15, fontWeight: '600', color: '#E2E8F0', marginBottom: 2 },
  transUser: { fontSize: 12, color: '#00F0FF', fontWeight: '500' },
  transDate: { fontSize: 12, color: '#64748B' },
  transAmount: { fontSize: 15, fontWeight: 'bold', color: '#E2E8F0' },
  income: { color: '#4CD964' },
  expense: { color: '#FF3B30' },

  emptyState: { padding: 30, alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#334155' },
  emptyText: { color: '#64748B', marginTop: 10, fontSize: 14 },

  // Footer
  footer: { alignItems: 'center', marginTop: 40, marginBottom: 20 },
  footerText: { color: '#475569', fontSize: 12, letterSpacing: 1 },

  // FAB
  fab: { 
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 1000,
  },
});