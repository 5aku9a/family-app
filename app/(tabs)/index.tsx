import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { collection, limit, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/services/firebase';
import { formatDaysString, getDaysTogether } from '../../src/services/relationshipService';

const { width } = Dimensions.get('window');

// Типы для данных
interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Timestamp;
  comment?: string;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: Timestamp;
  assigneeName?: string;
}

export default function HomeScreen() {
  const { user, userData, refreshUserData } = useAuth();
  
  // Состояния отношений
  const [daysString, setDaysString] = useState('');
  const [showRelationship, setShowRelationship] = useState(false);

  // Состояния финансов
  const [balance, setBalance] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loadingFinance, setLoadingFinance] = useState(false);

  // Состояния задач
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Обновление данных при фокусе экрана
  useFocusEffect(
    useCallback(() => {
      if (refreshUserData) refreshUserData();
    }, [])
  );

  // Логика отношений
  useEffect(() => {
    // Используем безопасный доступ через any или проверяем наличие поля, если типы не обновлены
    const hasPartner = !!(userData as any)?.partnerId;
    const startDate = userData?.relationshipStartDate;

    if (hasPartner && startDate) {
      setShowRelationship(true);
      const days = getDaysTogether(startDate);
      setDaysString(formatDaysString(days));
    } else {
      setShowRelationship(false);
      setDaysString("");
    }
  }, [userData]);

  // Логика финансов (по FamilyID)
  useEffect(() => {
    if (!userData?.familyId) {
      setBalance(0);
      setRecentTransactions([]);
      return;
    }

    setLoadingFinance(true);
    // Запрос требует индекс (familyId + date), но он обычно создается автоматически по ссылке из ошибки
    // Или можно использовать только где familyId, а сортировку сделать в JS, если индекс не создается
    const q = query(
      collection(db, 'transactions'),
      where('familyId', '==', userData.familyId),
      limit(50) // Берем чуть больше, чтобы отсортировать в JS если нужно, но orderBy лучше для производительности
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalIncome = 0;
      let totalExpense = 0;
      const transactions: Transaction[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        const t: Transaction = { id: doc.id, ...data };
        transactions.push(t);

        if (t.type === 'income') totalIncome += (t.amount || 0);
        if (t.type === 'expense') totalExpense += (t.amount || 0);
      });

      // Сортировка по дате в JS (если убрали orderBy из запроса для упрощения)
      transactions.sort((a, b) => {
        const dateA = a.date?.toMillis ? a.date.toMillis() : 0;
        const dateB = b.date?.toMillis ? b.date.toMillis() : 0;
        return dateB - dateA;
      });

      setBalance(totalIncome - totalExpense);
      setRecentTransactions(transactions.slice(0, 5)); // Показываем топ 5
      setLoadingFinance(false);
    }, (error) => {
      console.error("Ошибка загрузки финансов:", error);
      setLoadingFinance(false);
    });

    return () => unsubscribe();
  }, [userData?.familyId]);

  // Логика задач (по FamilyID)
  useEffect(() => {
    if (!userData?.familyId) {
      setActiveTasks([]);
      return;
    }

    setLoadingTasks(true);
    // Убрали orderBy и сложные фильтры, чтобы не требовался индекс
    // Фильтруем только по familyId и completed
    const q = query(
      collection(db, 'tasks'),
      where('familyId', '==', userData.familyId),
      where('completed', '==', false)
      // orderBy убран, чтобы избежать ошибки индекса. Сортируем ниже в JS.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks: Task[] = [];
      snapshot.docs.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() } as Task);
      });

      // Сортировка в JS: сначала те, у которых есть дата, потом по алфавиту
      tasks.sort((a, b) => {
        const dateA = a.dueDate?.toMillis ? a.dueDate.toMillis() : Infinity;
        const dateB = b.dueDate?.toMillis ? b.dueDate.toMillis() : Infinity;
        return dateA - dateB;
      });

      setActiveTasks(tasks.slice(0, 3)); // Показываем топ 3
      setLoadingTasks(false);
    }, (error) => {
      console.error("Ошибка загрузки задач:", error);
      setLoadingTasks(false);
    });

    return () => unsubscribe();
  }, [userData?.familyId]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (ts: Timestamp) => {
    if (!ts) return '';
    return ts.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Шапка */}
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

      {/* Блок отношений */}
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

      {/* Финансы */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Бюджет</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/finance')}>
            <Text style={styles.sectionLink}>Все</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.balanceCard}>
          {loadingFinance ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <>
              <Text style={styles.balanceLabel}>Общий баланс</Text>
              <Text style={[styles.balanceValue, balance < 0 && styles.negativeBalance]}>
                {formatMoney(balance)}
              </Text>
              
              {recentTransactions.length > 0 ? (
                <View style={styles.transactionsList}>
                  {recentTransactions.map(t => (
                    <View key={t.id} style={styles.transactionItem}>
                      <View style={[styles.tIconBox, { backgroundColor: t.type === 'income' ? '#E8F5E9' : '#FFEBEE' }]}>
                        <Ionicons 
                          name={t.type === 'income' ? 'arrow-down' : 'arrow-up'} 
                          size={16} 
                          color={t.type === 'income' ? '#34C759' : '#FF3B30'} 
                        />
                      </View>
                      <View style={styles.tInfo}>
                        <Text style={styles.tCategory}>{t.category}</Text>
                        <Text style={styles.tDate}>{formatDate(t.date)}</Text>
                      </View>
                      <Text style={[styles.tAmount, { color: t.type === 'income' ? '#34C759' : '#333' }]}>
                        {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Нет транзакций</Text>
              )}
            </>
          )}
        </View>
      </View>

      {/* Задачи */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Задачи</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.sectionLink}>Все</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tasksCard}>
          {loadingTasks ? (
            <ActivityIndicator color="#007AFF" />
          ) : activeTasks.length > 0 ? (
            activeTasks.map(task => (
              <View key={task.id} style={styles.taskItem}>
                <View style={styles.taskCheckbox}>
                  <Ionicons name="square-outline" size={20} color="#007AFF" />
                </View>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {task.dueDate && (
                    <Text style={styles.taskDue}>
                      до {task.dueDate.toDate().toLocaleDateString('ru-RU')}
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Все задачи выполнены! 🎉</Text>
          )}
        </View>
      </View>

      {/* Кнопка быстрого действия (FAB) */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          Alert.alert(
            "Быстрое действие",
            "Что хотите добавить?",
            [
              { text: "Расход", onPress: () => router.push('/finance/add') }, // Проверьте путь
              { text: "Задачу", onPress: () => router.push('/tasks/add') },   // Проверьте путь
              { text: "Отмена", style: "cancel" }
            ]
          );
        }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <View style={{height: 80}} />
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

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sectionLink: { fontSize: 14, color: '#007AFF', fontWeight: '600' },

  balanceCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  balanceLabel: { fontSize: 14, color: '#999' },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: '#333', marginVertical: 10 },
  negativeBalance: { color: '#FF3B30' },
  
  transactionsList: { marginTop: 15 },
  transactionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  tIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  tInfo: { flex: 1 },
  tCategory: { fontSize: 15, fontWeight: '500', color: '#333' },
  tDate: { fontSize: 12, color: '#999', marginTop: 2 },
  tAmount: { fontSize: 15, fontWeight: 'bold' },

  tasksCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  taskItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  taskCheckbox: { marginRight: 12 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 15, color: '#333' },
  taskDue: { fontSize: 12, color: '#999', marginTop: 2 },

  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', marginVertical: 10, fontStyle: 'italic' },

  fab: { position: 'absolute', bottom: 20, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#007AFF', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
});