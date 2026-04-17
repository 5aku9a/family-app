import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AddTransactionModal from '../../components/AddTransactionModal'; // Путь из app/(tabs) в components
import { useAuth } from '../../src/context/AuthContext';
import { deleteTransaction, getTransactions } from '../../src/services/budgetService';
import { Transaction } from '../../src/types/budget';

export default function BudgetScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (user) loadTransactions();
  }, [user]);

  const loadTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTransactions(user.uid);
      setTransactions(data);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Удалить?', 'Вы уверены?', [
      { text: 'Отмена', style: 'cancel' },
      { 
        text: 'Удалить', 
        style: 'destructive', 
        onPress: async () => {
          await deleteTransaction(id);
          loadTransactions();
        } 
      }
    ]);
  };

  const balance = transactions.reduce((acc, item) => {
    return item.type === 'income' ? acc + (item.amount || 0) : acc - (item.amount || 0);
  }, 0);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={60} color="#ccc" />
      <Text style={styles.emptyText}>Нет операций</Text>
      <Text style={styles.emptySubtext}>Нажмите +, чтобы добавить первую</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Общий баланс</Text>
        <Text style={[styles.balanceValue, balance >= 0 ? styles.positive : styles.negative]}>
          {balance.toFixed(2)} ₽
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => {
            const isIncome = item.type === 'income';
            let dateStr = '...';
            try {
              if (item.date && typeof item.date.toDate === 'function') {
                dateStr = item.date.toDate().toLocaleDateString('ru-RU');
              } else if (item.date) {
                 dateStr = new Date(item.date.seconds * 1000).toLocaleDateString('ru-RU');
              }
            } catch (e) { dateStr = 'Ошибка даты'; }

            return (
              <View style={styles.item}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, isIncome ? styles.incomeBg : styles.expenseBg]}>
                    <Ionicons name={isIncome ? 'arrow-down' : 'arrow-up'} size={20} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.itemCategory}>{item.category}</Text>
                    <Text style={styles.itemDate}>{dateStr}</Text>
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={[styles.itemAmount, isIncome ? styles.positive : styles.negative]}>
                    {isIncome ? '+' : '-'}{item.amount} ₽
                  </Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id!)}>
                    <Ionicons name="trash-outline" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Модальное окно */}
      <AddTransactionModal 
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={loadTransactions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  balanceCard: { backgroundColor: '#007AFF', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  balanceValue: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: 5 },
  positive: { color: '#4CD964' },
  negative: { color: '#FF3B30' },
  item: { backgroundColor: '#fff', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  incomeBg: { backgroundColor: '#4CD964' },
  expenseBg: { backgroundColor: '#FF3B30' },
  itemCategory: { fontSize: 16, fontWeight: '600', color: '#333' },
  itemDate: { fontSize: 12, color: '#999', marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 18, color: '#666', marginTop: 10, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5 },
});