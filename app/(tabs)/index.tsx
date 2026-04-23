import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { user, userData, refreshUserData } = useAuth(); // Добавили refreshUserData
  const [daysString, setDaysString] = useState('');
  const [showRelationship, setShowRelationship] = useState(false);
  const [stats, setStats] = useState({ balance: 0, tasks: 0, messages: 0 });

  // Принудительно обновляем данные при каждом возврате на экран
  useFocusEffect(
    useCallback(() => {
      const updateData = async () => {
        await refreshUserData();
      };
      updateData();
    }, [])
  );

  useEffect(() => {
    // Проверяем наличие партнера
    const hasPartner = !!userData?.partnerId;
    const hasDate = !!userData?.relationshipStartDate;

    if (hasPartner && hasDate) {
      setShowRelationship(true);
      
      const startDate = userData.relationshipStartDate.toDate();
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - startDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      setDaysString(formatDays(diffDays));
    } else {
      setShowRelationship(false);
      setDaysString("");
    }

    setStats({ balance: 12500, tasks: 3, messages: 15 });
  }, [userData]); // Зависимость от userData теперь должна срабатывать после refreshUserData

  const formatDays = (totalDays: number): string => {
    if (totalDays === 0) return "Вместе сегодня!";
    if (totalDays === 1) return "Вместе 1 день";
    
    const years = Math.floor(totalDays / 365);
    const remainingDaysAfterYear = totalDays % 365;
    const months = Math.floor(remainingDaysAfterYear / 30);
    const days = remainingDaysAfterYear % 30;

    let result = "";
    if (years > 0) result += `${years} г. `;
    if (months > 0) result += `${months} мес. `;
    if (days > 0 || (years === 0 && months === 0)) result += `${days} дн.`;
    
    return `Вместе ${result.trim()}`;
  };

  // ... остальной код рендера без изменений ...
  // (StatCard компонент и JSX возвращаются как у вас в коде выше)
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ... ваш JSX ... */}
      {/* Убедитесь, что блок showRelationship отображается корректно */}
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
      
      {/* ... остальной контент ... */}
       <Text style={styles.sectionTitle}>Обзор</Text>
      <View style={styles.statsGrid}>
        {/* ... карточки ... */}
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

// ... стили без изменений ...
const styles = StyleSheet.create({
   // ... ваши стили ...
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