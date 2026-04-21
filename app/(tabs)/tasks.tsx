import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/services/firebase';
import { createTask, deleteTask, getTasks, updateTask } from '../../src/services/taskService';
import { ItemType, TaskItem } from '../../src/types/tasks';

// Локализация календаря
LocaleConfig.locales['ru'] = {
  monthNames: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  monthNamesShort: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
  dayNames: ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],
  dayNamesShort: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
  today: 'Сегодня'
};
LocaleConfig.defaultLocale = 'ru';

type TabType = 'all' | 'task' | 'event';

export default function TasksScreen() {
  const { user, userData } = useAuth();
  const [items, setItems] = useState<TaskItem[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Модалка
  const [modalVisible, setModalVisible] = useState(false);
  const [newType, setNewType] = useState<ItemType>('task');
  
  // Общие поля
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  // Логика времени
  const [hasTime, setHasTime] = useState(false);
  const [hours, setHours] = useState(new Date().getHours());
  const [minutes, setMinutes] = useState(0);
  
  const [showCalendar, setShowCalendar] = useState(false);

  // Поля для задачи
  const [selectedAssignee, setSelectedAssignee] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    if (user) {
      loadItems();
      if (userData?.familyId) loadMembers();
    }
  }, [user, userData?.familyId]);

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTasks(user.uid, userData?.familyId || null);
      setItems(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Ошибка', 'Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!userData?.familyId) return;
    try {
      const q = query(collection(db, 'members'), where('familyId', '==', userData.familyId));
      const snap = await getDocs(q);
      const members = snap.docs.map(d => ({ id: d.data().userId, name: d.data().displayName || d.data().email }));
      setFamilyMembers(members);
      const me = members.find(m => m.id === user!.uid);
      if (me) setSelectedAssignee(me);
    } catch (e) { console.error(e); }
  };

  const formatDateKey = (date: any): string => {
    if (!date) return '';
    let d: Date;
    if (date.toDate && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else {
      d = date;
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) {
      Alert.alert('Ошибка', 'Введите название');
      return;
    }
    
    if (!selectedDate) {
      Alert.alert('Ошибка', 'Выберите дату');
      return;
    }

    try {
      const formattedTime = hasTime 
        ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}` 
        : null;

      const taskData: Omit<TaskItem, 'id' | 'createdAt'> = {
        userId: user.uid,
        userName: userData?.displayName || user.email?.split('@')[0] || 'Аноним',
        familyId: userData?.familyId || null, 
        type: newType,
        title: newTitle,
        description: newDesc.trim() === '' ? null : newDesc, 
        date: Timestamp.fromDate(new Date(selectedDate)),
        status: 'pending',
        time: formattedTime ?? null, 
        assigneeId: selectedAssignee?.id ?? null, 
        assigneeName: selectedAssignee?.name ?? null, 
        color: null, // Цвет больше не используется
      };

      await createTask(taskData);
      
      setModalVisible(false);
      resetForm();
      loadItems();
    } catch (e: any) {
      console.error('Ошибка создания:', e);
      Alert.alert('Ошибка', e.message || 'Не удалось создать');
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setHasTime(false);
    setHours(new Date().getHours());
    setMinutes(0);
    setShowCalendar(false);
    setSelectedAssignee(familyMembers.find(m => m.id === user?.uid) || null);
  };

  const closeModal = () => {
    resetForm();
    setModalVisible(false);
  };

  const handleToggleStatus = async (item: TaskItem) => {
    try {
      await updateTask(item.id!, { status: item.status === 'pending' ? 'completed' : 'pending' });
      loadItems();
    } catch (e) { Alert.alert('Ошибка', 'Не удалось обновить'); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Удалить?', 'Вы уверены?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await deleteTask(id);
        loadItems();
      }}
    ]);
  };

  const filteredItems = items.filter(item => {
    const itemDateStr = formatDateKey(item.date);
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    const matchesDate = itemDateStr === selectedDate;
    return matchesTab && matchesDate;
  });

  const markedDates = items.reduce((acc: any, item) => {
    const itemDateStr = formatDateKey(item.date);
    
    if (!itemDateStr) return acc;

    if (!acc[itemDateStr]) {
      acc[itemDateStr] = { dots: [] };
    }
    
    const dotColor = item.type === 'task' ? '#FF9500' : '#007AFF';
    
    const exists = acc[itemDateStr].dots.some((d: any) => d.color === dotColor);
    if (!exists) {
      acc[itemDateStr].dots.push({ key: item.id, color: dotColor });
    }

    if (itemDateStr === selectedDate) {
      acc[itemDateStr].selected = true;
      acc[itemDateStr].selectedColor = '#007AFF';
    }
    return acc;
  }, {});
  
  if (!markedDates[selectedDate]) {
    markedDates[selectedDate] = { selected: true, selectedColor: '#007AFF' };
  } else if (!markedDates[selectedDate].selected) {
    markedDates[selectedDate].selected = true;
    markedDates[selectedDate].selectedColor = '#007AFF';
  }

  const renderItem = ({ item }: { item: TaskItem }) => {
    const isCompleted = item.status === 'completed';
    const isTask = item.type === 'task';

    return (
      <View style={[styles.card, isCompleted && styles.cardCompleted]}>
        {isTask ? (
          <TouchableOpacity onPress={() => handleToggleStatus(item)} style={styles.checkbox}>
            <Ionicons name={isCompleted ? 'checkbox' : 'square-outline'} size={24} color={isCompleted ? '#34C759' : '#999'} />
          </TouchableOpacity>
        ) : (
          <View style={styles.eventIconBox}>
            <Ionicons name="calendar" size={20} color="#999" />
          </View>
        )}
        
        <View style={styles.content}>
          <Text style={[styles.title, isCompleted && styles.textCompleted]}>{item.title}</Text>
          <View style={styles.meta}>
            {item.time && (
              <Text style={styles.timeText}>🕒 {item.time}</Text>
            )}
            {item.assigneeName && <Text style={styles.assignee}>👤 {item.assigneeName}</Text>}
            {!item.time && !item.assigneeName && (
               <Text style={{fontSize: 12, color: '#ccc'}}>Без времени</Text>
            )}
          </View>
        </View>

        <TouchableOpacity onPress={() => handleDelete(item.id!)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color="#999" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Планы</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        markingType="multi-dot"
        theme={{
          backgroundColor: '#ffffff',
          calendarBackground: '#ffffff',
          textSectionTitleColor: '#666',
          selectedDayBackgroundColor: '#007AFF',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#007AFF',
          dayTextColor: '#2d4150',
          textDisabledColor: '#d9e1e8',
          dotColor: '#FF9500',
          selectedDotColor: '#ffffff',
          arrowColor: '#007AFF',
          monthTextColor: '#007AFF',
          indicatorColor: '#007AFF',
          textDayFontWeight: '300',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '300',
          textDayFontSize: 16,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 14
        }}
      />

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'all' && styles.tabActive]} onPress={() => setActiveTab('all')}>
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Все</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'task' && styles.tabActive]} onPress={() => setActiveTab('task')}>
          <Text style={[styles.tabText, activeTab === 'task' && styles.tabTextActive]}>Задачи</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'event' && styles.tabActive]} onPress={() => setActiveTab('event')}>
          <Text style={[styles.tabText, activeTab === 'event' && styles.tabTextActive]}>События</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Нет планов на этот день</Text>}
        />
      )}

      {/* Модалка создания */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{newType === 'task' ? 'Новая задача' : 'Новое событие'}</Text>
                <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
              </View>

              <View style={styles.typeSelector}>
                <TouchableOpacity style={[styles.typeBtn, newType === 'task' && styles.typeBtnActive]} onPress={() => setNewType('task')}>
                  <Text style={newType === 'task' ? styles.typeBtnTextActive : styles.typeBtnText}>Задача</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeBtn, newType === 'event' && styles.typeBtnActive]} onPress={() => setNewType('event')}>
                  <Text style={newType === 'event' ? styles.typeBtnTextActive : styles.typeBtnText}>Событие</Text>
                </TouchableOpacity>
              </View>

              <TextInput style={styles.input} placeholder="Название" value={newTitle} onChangeText={setNewTitle} autoFocus />
              
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowCalendar(!showCalendar)}>
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={styles.dateText}>{selectedDate === new Date().toISOString().split('T')[0] ? 'Сегодня' : selectedDate}</Text>
              </TouchableOpacity>
              
              {showCalendar && (
                <View style={styles.calendarPopup}>
                  <Calendar
                    current={selectedDate}
                    onDayPress={(day) => {
                      setSelectedDate(day.dateString);
                      setShowCalendar(false);
                    }}
                    theme={{ selectedDayBackgroundColor: '#007AFF' }}
                  />
                </View>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Указать время?</Text>
                <Switch value={hasTime} onValueChange={setHasTime} trackColor={{ false: '#ccc', true: '#007AFF' }} thumbColor="#fff" />
              </View>

              {hasTime && (
                <View style={styles.timePickersRow}>
                  <View style={styles.pickerWrapper}>
                    <Text style={styles.pickerLabel}>Часы</Text>
                    <Picker selectedValue={hours} onValueChange={setHours} style={styles.picker} mode="dropdown">
                      {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                        <Picker.Item key={hour} label={hour.toString().padStart(2, '0')} value={hour} />
                      ))}
                    </Picker>
                  </View>
                  <Text style={styles.timeSeparator}>:</Text>
                  <View style={styles.pickerWrapper}>
                    <Text style={styles.pickerLabel}>Минуты</Text>
                    <Picker selectedValue={minutes} onValueChange={setMinutes} style={styles.picker} mode="dropdown">
                      {Array.from({ length: 60 }, (_, i) => i).map((min) => (
                        <Picker.Item key={min} label={min.toString().padStart(2, '0')} value={min} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              {/* ИСПРАВЛЕННЫЙ БЛОК УСЛОВИЯ */}
              {newType === 'task' ? (
                <>
                  <Text style={styles.label}>Исполнитель:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
                    {familyMembers.map(member => (
                      <TouchableOpacity
                        key={member.id}
                        style={[styles.memberChip, selectedAssignee?.id === member.id && styles.memberChipSelected]}
                        onPress={() => setSelectedAssignee(member)}
                      >
                        <Text style={[styles.memberChipText, selectedAssignee?.id === member.id && styles.memberChipTextSelected]}>
                          {member.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null} 
              {/* Конец исправления: добавлено ": null" и закрывающая скобка */}

              <TextInput style={[styles.input, styles.textArea]} placeholder="Описание" value={newDesc} onChangeText={setNewDesc} multiline />

              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
                <Text style={styles.saveBtnText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#007AFF' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#999' },
  tabTextActive: { color: '#007AFF' },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  cardCompleted: { opacity: 0.6, backgroundColor: '#f9f9f9' },
  checkbox: { marginRight: 12 },
  eventIconBox: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: '#f0f0f0' },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  textCompleted: { textDecorationLine: 'line-through', color: '#999' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  timeText: { fontSize: 12, color: '#666', fontWeight: '500' },
  assignee: { fontSize: 12, color: '#007AFF', fontWeight: '500' },
  deleteBtn: { padding: 8 },
  
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, minHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  
  typeSelector: { flexDirection: 'row', marginBottom: 16, backgroundColor: '#f0f0f0', borderRadius: 12, padding: 4 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  typeBtnText: { color: '#666', fontWeight: '600' },
  typeBtnTextActive: { color: '#007AFF', fontWeight: 'bold' },

  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 16, backgroundColor: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
  
  dateBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: '#fff' },
  dateText: { marginLeft: 10, fontSize: 16, color: '#333' },
  calendarPopup: { marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingVertical: 8 },
  switchLabel: { fontSize: 16, color: '#333', fontWeight: '500' },

  timePickersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 12 },
  pickerWrapper: { flex: 1, alignItems: 'center' },
  pickerLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  picker: { height: 50, width: '100%' },
  timeSeparator: { fontSize: 24, fontWeight: 'bold', color: '#333', marginHorizontal: 10 },

  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 4 },
  
  membersScroll: { marginBottom: 12, maxHeight: 50 },
  memberChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8 },
  memberChipSelected: { backgroundColor: '#007AFF' },
  memberChipText: { color: '#666', fontWeight: '600' },
  memberChipTextSelected: { color: '#fff' },

  saveBtn: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});