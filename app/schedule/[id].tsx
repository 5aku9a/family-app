import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/services/firebase';
import { checkAndUnlockAchievements } from '../../src/services/relationshipService';
import { ScheduleItem } from '../../src/services/scheduleService';
import { completeTask, resetTask, TaskStatus } from '../../src/services/taskTrackerService';

export default function TaskStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, userData } = useAuth();
  
  const [task, setTask] = useState<(ScheduleItem & { id: string }) | null>(null);
  const [status, setStatus] = useState<(TaskStatus & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !userData?.familyId) return;

    const unsubTask = onSnapshot(doc(db, 'schedule', id), (docSnap) => {
      if (docSnap.exists()) {
        setTask({ id: docSnap.id, ...docSnap.data() } as ScheduleItem & { id: string });
      } else {
        Alert.alert('Ошибка', 'Задача не найдена');
      }
    });

    const q = query(
      collection(db, 'tasks_list'),
      where('familyId', '==', userData.familyId),
      where('scheduleItemId', '==', id)
    );
    
    const unsubStatus = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const doc = snap.docs[0];
        setStatus({ id: doc.id, ...doc.data() } as TaskStatus & { id: string });
      } else {
        setStatus(null);
      }
    });

    setLoading(false);
    return () => { unsubTask(); unsubStatus(); };
  }, [id, userData?.familyId]);

  const toggleStatus = async () => {
    if (!status || !user || !userData?.familyId) return;
    try {
      if (status.isCompleted) {
        await resetTask(status.id);
      } else {
        await completeTask(status.id, user.uid, user.displayName || 'User');
        await checkAndUnlockAchievements(user.uid, userData.familyId);
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  if (loading || !task) return <ActivityIndicator size="large" style={{flex:1}} />;

  const isDone = status?.isCompleted;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#333"/></TouchableOpacity>
        <Text style={styles.title}>Статус задачи</Text>
        <View style={{width: 24}}/>
      </View>

      <View style={styles.card}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <Text style={styles.taskDate}>{task.startTime.toDate().toLocaleString()}</Text>
        {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
      </View>

      <View style={styles.statusSection}>
        <Text style={styles.sectionLabel}>Выполнение</Text>
        
        <TouchableOpacity 
          style={[styles.statusCard, isDone && styles.statusCardDone]} 
          onPress={toggleStatus}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isDone ? 'checkmark-circle' : 'ellipse-outline'} 
            size={40} 
            color={isDone ? '#34C759' : '#ccc'} 
          />
          <View style={styles.statusInfo}>
            <Text style={[styles.statusText, isDone && styles.statusTextDone]}>
              {isDone ? 'Выполнено' : 'На выполнении'}
            </Text>
            {isDone && status.completedBy && (
              <Text style={styles.completedBy}>Выполнил: {status.completedBy}</Text>
            )}
          </View>
        </TouchableOpacity>

        {isDone && (
          <TouchableOpacity style={styles.resetBtn} onPress={toggleStatus}>
            <Text style={styles.resetBtnText}>Вернуть в работу</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 16 },
  taskTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  taskDate: { fontSize: 14, color: '#999', marginTop: 8 },
  taskDesc: { fontSize: 15, color: '#666', marginTop: 12, lineHeight: 22 },
  statusSection: { paddingHorizontal: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#999', marginBottom: 12, textTransform: 'uppercase' },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 16 },
  statusCardDone: { backgroundColor: '#E8F5E9' },
  statusInfo: { marginLeft: 16, flex: 1 },
  statusText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statusTextDone: { color: '#34C759' },
  completedBy: { fontSize: 13, color: '#666', marginTop: 4 },
  resetBtn: { alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 12 },
  resetBtnText: { color: '#FF3B30', fontWeight: '600' },
});