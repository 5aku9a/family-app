import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SpaceBackground from '../../components/SpaceBackground';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/services/firebase';
import { sendFamilyNotification } from '../../src/services/notificationService';

const { width } = Dimensions.get('window');
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type ItemType = 'task' | 'event';
interface ScheduleItem { id: string; familyId: string; type: ItemType; title: string; description?: string; startTime: Timestamp; assigneeName?: string; color?: string; completed?: boolean; }

export default function ScheduleScreen() {
  const { user, userData } = useAuth();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState<ItemType>('task');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [time, setTime] = useState(new Date());
  const [showTimePick, setShowTimePick] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!userData?.familyId) { setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, 'schedule'), where('familyId', '==', userData.familyId), orderBy('startTime', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [userData?.familyId]);

  const selectedDayItems = useMemo(() => {
    return items.filter(item => {
      const d = item.startTime.toDate();
      return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
    });
  }, [items, selectedDate]);

  const getIndicatorsForDay = (day: number) => {
    return items.filter(item => {
      const d = item.startTime.toDate();
      return d.getDate() === day && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

    const handleAdd = async () => {
    if (!title.trim() || !userData?.familyId || !user) return;
    setIsProcessing(true);
    try {
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(time.getHours(), time.getMinutes());
      const newItemData: any = {
        familyId: userData.familyId, type, title: title.trim(), description: desc.trim() || null,
        startTime: Timestamp.fromDate(startDateTime), createdAt: Timestamp.now(),
        color: type === 'event' ? '#FF9500' : '#00F0FF',
      };
      if (type === 'task') {
        newItemData.assigneeId = user.uid;
        newItemData.assigneeName = user.displayName || 'User';
      }
      Object.keys(newItemData).forEach(key => { if (newItemData[key] === undefined) delete newItemData[key]; });
      
      const docRef = await addDoc(collection(db, 'schedule'), newItemData);

      const displayName = user.displayName || user.email?.split('@')[0] || 'Астронавт';
      await sendFamilyNotification(
        userData.familyId,
        type === 'task' ? 'new_task' : 'new_event',
        type === 'task' ? 'Новая задача' : 'Новое событие',
        `${displayName}: ${title.trim()}`,
        user.uid,
        displayName
      );
  
      setModalVisible(false); setTitle(''); setDesc('');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setIsProcessing(false); }
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Удалить?', `"${title}"`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => { try { await deleteDoc(doc(db, 'schedule', id)); } catch(e){} } }
    ]);
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const days = [];
    for (let i = 0; i < offset; i++) days.push(<View key={`e-${i}`} style={styles.dayCell} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;
      const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      const dayItems = getIndicatorsForDay(d);
      days.push(
        <TouchableOpacity key={d} style={[styles.dayCell, isSelected && styles.selectedDayCell]} onPress={() => setSelectedDate(new Date(year, month, d))}>
          <Text style={[styles.dayNum, isSelected && styles.selectedDayText, isToday && styles.todayText]}>{d}</Text>
          <View style={styles.indicators}>
            {dayItems.some(i => i.type === 'task') && <View style={[styles.dot, { backgroundColor: '#00F0FF' }]} />}
            {dayItems.some(i => i.type === 'event') && <View style={[styles.dot, { backgroundColor: '#FF9500' }]} />}
          </View>
        </TouchableOpacity>
      );
    }
    return days;
  };

  if (loading) return <ActivityIndicator size="large" color="#00F0FF" style={{ flex: 1, backgroundColor: '#0B1120' }} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <SpaceBackground />
      
      <View style={styles.container}>
        <View style={styles.calendarWrapper}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)}><Ionicons name="chevron-back" size={24} color="#00F0FF" /></TouchableOpacity>
            <Text style={styles.monthTitle}>{currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)}><Ionicons name="chevron-forward" size={24} color="#00F0FF" /></TouchableOpacity>
          </View>
          <View style={styles.weekDaysRow}>{DAYS.map(day => <Text key={day} style={styles.weekDayText}>{day}</Text>)}</View>
          <View style={styles.daysGrid}>{renderCalendar()}</View>
        </View>

        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>{selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          {selectedDayItems.length === 0 ? (
            <View style={styles.emptyState}><Ionicons name="cloud-offline-outline" size={40} color="#475569" /><Text style={styles.emptyText}>Нет событий</Text></View>
          ) : (
            <ScrollView nestedScrollEnabled={true} style={styles.itemsList}>
              {selectedDayItems.map(item => (
                <TouchableOpacity key={item.id} style={[styles.card, { borderLeftColor: item.color || '#00F0FF' }]} onPress={() => item.type === 'task' ? router.push(`/schedule/${item.id}`) : null}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconBox, { backgroundColor: `${item.color || '#00F0FF'}20` }]}>
                      <Ionicons name={item.type === 'task' ? (item.completed ? 'checkmark-circle' : 'checkbox-outline') : 'calendar-outline'} size={20} color={item.color || '#00F0FF'} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardTitle, item.completed && { textDecorationLine: 'line-through' }]}>{item.title}</Text>
                      <Text style={styles.cardSub}>{item.startTime.toDate().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})} {item.assigneeName && `• ${item.assigneeName}`}</Text>
                    </View>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(item.id, item.title); }}><Ionicons name="trash-outline" size={18} color="#FF3B30" /></TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <TouchableOpacity style={[styles.fab, { bottom: 127 }]} onPress={() => { setType('task'); setModalVisible(true); }}>
        <Ionicons name="add" size={32} color="#0B1120" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Новое событие</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
            </View>
            <View style={styles.typeSelector}>
              <TouchableOpacity style={[styles.typeBtn, type === 'task' && styles.typeBtnActive]} onPress={() => setType('task')}>
                <Ionicons name="checkbox" size={20} color={type === 'task' ? '#fff' : '#00F0FF'} /><Text style={[styles.typeText, type === 'task' && styles.typeTextActive]}>Задача</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, type === 'event' && styles.typeBtnActive]} onPress={() => setType('event')}>
                <Ionicons name="calendar" size={20} color={type === 'event' ? '#fff' : '#FF9500'} /><Text style={[styles.typeText, type === 'event' && styles.typeTextActive]}>Событие</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Название" placeholderTextColor="#64748B" value={title} onChangeText={setTitle} autoFocus />
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Описание" placeholderTextColor="#64748B" multiline value={desc} onChangeText={setDesc} />
            <View style={styles.dateTimeRow}>
              <Text style={styles.dateLabel}>{selectedDate.toLocaleDateString()}</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimePick(true)}>
                <Ionicons name="time-outline" color="#00F0FF" size={20} /><Text style={styles.timeBtnText}>{time.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}</Text>
              </TouchableOpacity>
            </View>
            {showTimePick && <DateTimePicker value={time} mode="time" onChange={(e, d) => { setShowTimePick(false); if(d) setTime(d); }} textColor="#fff" />}
            <TouchableOpacity style={[styles.saveBtn, (!title || isProcessing) && styles.saveBtnDisabled]} onPress={handleAdd} disabled={!title || isProcessing}>
              {isProcessing ? <ActivityIndicator color="#0B1120" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B1120' },
  container: { flex: 1, padding: 16 },
  
  calendarWrapper: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  monthTitle: { fontSize: 18, fontWeight: 'bold', color: '#E2E8F0' },
  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  weekDayText: { width: 40, textAlign: 'center', fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  dayCell: { width: (width - 64) / 7, height: 50, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  selectedDayCell: { backgroundColor: '#00F0FF', borderRadius: 25 },
  dayNum: { fontSize: 15, fontWeight: '600', color: '#E2E8F0' },
  selectedDayText: { color: '#0B1120' },
  todayText: { color: '#FF9500', fontWeight: 'bold' },
  indicators: { flexDirection: 'row', marginTop: 4, gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  listContainer: { flex: 1 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#E2E8F0', marginBottom: 12, textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#64748B', marginTop: 8 },
  itemsList: { flexGrow: 0, maxHeight: 400 },
  
  card: { backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: 12, padding: 12, marginBottom: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#E2E8F0', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#94A3B8' },

  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#00F0FF', justifyContent: 'center', alignItems: 'center', shadowColor: '#00F0FF', shadowOpacity: 0.5, shadowRadius: 12, elevation: 10, zIndex: 1000 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#E2E8F0' },
  typeSelector: { flexDirection: 'row', backgroundColor: '#0F172A', borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 10 },
  typeBtnActive: { backgroundColor: '#334155' },
  typeText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: '#64748B' },
  typeTextActive: { color: '#fff' },
  input: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16, color: '#E2E8F0' },
  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 },
  dateLabel: { fontSize: 16, color: '#E2E8F0', fontWeight: '500' },
  timeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  timeBtnText: { marginLeft: 6, fontSize: 15, fontWeight: '600', color: '#00F0FF' },
  saveBtn: { backgroundColor: '#00F0FF', padding: 16, borderRadius: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#0B1120', fontSize: 16, fontWeight: 'bold' },
});