import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { deleteTransaction } from '../../src/services/budgetService';
import { db } from '../../src/services/firebase';
import { checkAndUnlockAchievements } from '../../src/services/relationshipService';
import { CATEGORIES_CONFIG, Transaction } from '../../src/types/budget';
import AddTransactionModal from '../finance/add';

const { width, height } = Dimensions.get('window');

type FilterType = 'all' | 'expense' | 'income';
type TimeFilter = 'month' | 'all';

export default function FinanceScreen() {
  const { user, userData } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterType>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [modalVisible, setModalVisible] = useState(false);
  
  const [stars, setStars] = useState<{id: number, top: number, left: number, size: number, opacity: number}[]>([]);
  useEffect(() => {
    const newStars = Array.from({ length: 40 }).map((_, i) => ({
      id: i, top: Math.random() * height, left: Math.random() * width,
      size: Math.random() * 2 + 0.5, opacity: Math.random() * 0.7 + 0.3,
    }));
    setStars(newStars);
  }, []);

  const handleModalClose = () => setModalVisible(false);
  
  const handleModalSuccess = () => {
    setModalVisible(false);
    if (user && userData?.familyId) {
      checkAndUnlockAchievements(user.uid, userData.familyId).catch(err => console.error(err));
    }
  };

  useEffect(() => {
    if (!user) return;
    if (!userData?.familyId) { setTransactions([]); setLoading(false); return; }

    setLoading(true);
    const q = query(
      collection(db, 'budget'),
      where('familyId', '==', userData.familyId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      
      if (timeFilter === 'month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        data = data.filter(t => {
          const tDate = t.date?.toDate ? t.date.toDate().getTime() : null;
          return tDate && tDate >= start && tDate <= end;
        });
      }
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, userData?.familyId, timeFilter]);

  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return transactions;
    return transactions.filter(t => t.type === activeTab);
  }, [transactions, activeTab]);

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const categoryStats = useMemo(() => {
    const targetData = activeTab === 'income' 
      ? transactions.filter(t => t.type === 'income')
      : transactions.filter(t => t.type === 'expense');
    const total = activeTab === 'income' ? stats.income : stats.expense;
    if (total === 0) return [];

    const groups: Record<string, number> = {};
    targetData.forEach(t => { groups[t.category] = (groups[t.category] || 0) + t.amount; });

    return Object.entries(groups)
      .map(([name, amount]) => ({
        name, amount, percent: (amount / total) * 100,
        config: CATEGORIES_CONFIG[name] || CATEGORIES_CONFIG['Другое']
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, activeTab, stats]);

  const handleDelete = (id: string) => {
    Alert.alert('Удалить?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => deleteTransaction(id) }
    ]);
  };

  if (!userData?.familyId && !loading) {
     return (
       <View style={styles.centerContainer}>
         <Ionicons name="diamond-outline" size={64} color="#334155" />
         <Text style={styles.centerText}>Доступ к ресурсам ограничен</Text>
         <Text style={styles.centerSub}>Требуется членство в экипаже</Text>
       </View>
     );
  }

  if (loading) return <ActivityIndicator size="large" color="#00F0FF" style={{ flex: 1, backgroundColor: '#0B1120' }} />;

  return (
    <View style={styles.container}>
      {stars.map(star => (
        <View key={star.id} style={[styles.star, { top: star.top, left: star.left, width: star.size, height: star.size, opacity: star.opacity }]} />
      ))}

      <ScrollView contentContainerStyle={{ paddingBottom: 100 + insets.bottom }} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ресурсы</Text>
          <View style={styles.timeFilter}>
            <TouchableOpacity style={[styles.timeBtn, timeFilter === 'month' && styles.timeBtnActive]} onPress={() => setTimeFilter('month')}>
              <Text style={[styles.timeBtnText, timeFilter === 'month' && styles.timeBtnTextActive]}>Мес</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.timeBtn, timeFilter === 'all' && styles.timeBtnActive]} onPress={() => setTimeFilter('all')}>
              <Text style={[styles.timeBtnText, timeFilter === 'all' && styles.timeBtnTextActive]}>Все</Text>
            </TouchableOpacity>
          </View>
        </View>


        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{activeTab === 'all' ? 'Баланс' : activeTab === 'expense' ? 'Расход' : 'Доход'}</Text>
          <Text style={[styles.balanceValue, stats.balance >= 0 ? styles.positive : styles.negative]}>
            {activeTab === 'expense' ? `-${stats.expense.toLocaleString()}` : activeTab === 'income' ? `+${stats.income.toLocaleString()}` : stats.balance.toLocaleString()} ₽
          </Text>
        </View>


        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, activeTab === 'all' && styles.tabActive]} onPress={() => setActiveTab('all')}>
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Все</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'expense' && styles.tabActive]} onPress={() => setActiveTab('expense')}>
            <Text style={[styles.tabText, activeTab === 'expense' && styles.tabTextActive]}>Расходы</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'income' && styles.tabActive]} onPress={() => setActiveTab('income')}>
            <Text style={[styles.tabText, activeTab === 'income' && styles.tabTextActive]}>Доходы</Text>
          </TouchableOpacity>
        </View>

        {activeTab !== 'all' && categoryStats.length > 0 && (
          <View style={styles.glassCard}>
            <Text style={styles.sectionTitle}>Структура</Text>
            {categoryStats.map((stat) => (
              <View style={styles.catRow} key={stat.name}>
                <View style={styles.catHeader}>
                  <View style={[styles.catIconBox, { backgroundColor: stat.config.color }]}>
                    <Ionicons name={stat.config.icon} size={16} color="#0B1120" />
                  </View>
                  <Text style={styles.catNameSmall}>{stat.name}</Text>
                  <Text style={styles.catAmount}>{stat.amount.toLocaleString()} ₽</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${stat.percent}%`, backgroundColor: stat.config.color }]} />
                </View>
              </View>
            ))}
          </View>
        )}
        

        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Журнал операций</Text>
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#334155" />
              <Text style={styles.emptyText}>Нет данных</Text>
            </View>
          ) : (
            filteredTransactions.map((item) => {
              const config = CATEGORIES_CONFIG[item.category] || CATEGORIES_CONFIG['Другое'];
              const isIncome = item.type === 'income';
              const dateStr = item.date?.toDate ? item.date.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
              return (
                <View key={item.id} style={styles.transactionItem}>
                  <View style={[styles.iconBox, { backgroundColor: config.color }]}>
                    <Ionicons name={config.icon} size={20} color="#0B1120" />
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.catName}>{item.category}</Text>
                    <Text style={styles.dateTime}>{dateStr} • {item.userName || 'User'}</Text>
                  </View>
                  <View style={styles.amountBox}>
                    <Text style={[styles.amount, isIncome ? styles.incomeText : styles.expenseText]}>
                      {isIncome ? '+' : '-'}{item.amount.toLocaleString()}
                    </Text>
                    <TouchableOpacity onPress={() => handleDelete(item.id!)}><Ionicons name="trash-outline" size={18} color="#64748B" /></TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>


      <TouchableOpacity style={[styles.fab, { bottom: 80 + insets.bottom }]} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={32} color="#0B1120" />
      </TouchableOpacity>

      <AddTransactionModal visible={modalVisible} onClose={handleModalClose} onSuccess={handleModalSuccess} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  star: { position: 'absolute', backgroundColor: '#fff', borderRadius: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#E2E8F0' },
  timeFilter: { flexDirection: 'row', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 20, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  timeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  timeBtnActive: { backgroundColor: 'rgba(0, 240, 255, 0.15)', borderColor: 'rgba(0, 240, 255, 0.3)', borderWidth: 1 },
  timeBtnText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  timeBtnTextActive: { color: '#00F0FF' },

  balanceCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', margin: 16, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  balanceLabel: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  balanceValue: { fontSize: 36, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  positive: { color: '#4CD964' },
  negative: { color: '#FF3B30' },

  tabs: { flexDirection: 'row', backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingHorizontal: 16, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#00F0FF' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#00F0FF' },

  glassCard: { backgroundColor: 'rgba(30, 41, 59, 0.4)', margin: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#E2E8F0', marginBottom: 12 },
  
  catRow: { marginBottom: 12 },
  catHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  catIconBox: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  catNameSmall: { fontSize: 14, fontWeight: '500', color: '#CBD5E1', flex: 1 },
  catAmount: { fontSize: 14, fontWeight: '700', color: '#fff' },
  progressBg: { height: 6, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  listContainer: { paddingHorizontal: 16, paddingBottom: 20 },
  transactionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoBox: { flex: 1 },
  catName: { fontSize: 16, fontWeight: '600', color: '#E2E8F0', marginBottom: 2 },
  dateTime: { fontSize: 12, color: '#64748B' },
  amountBox: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  incomeText: { color: '#4CD964' },
  expenseText: { color: '#FF3B30' },

  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#00F0FF', justifyContent: 'center', alignItems: 'center', shadowColor: '#00F0FF', shadowOpacity: 0.5, shadowRadius: 12, elevation: 10, zIndex: 999 },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B1120' },
  centerText: { fontSize: 18, fontWeight: 'bold', color: '#E2E8F0', marginTop: 16 },
  centerSub: { fontSize: 14, color: '#64748B', marginTop: 8 },
  emptyState: { alignItems: 'center', padding: 40, opacity: 0.6 },
  emptyText: { marginTop: 10, color: '#64748B', fontSize: 14 },
});