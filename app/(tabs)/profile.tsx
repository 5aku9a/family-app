import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Dimensions,
  Modal,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import {
  changeMemberRole, createFamily, deleteFamily, generateInviteCode, joinFamily, leaveFamily, removeMember,
} from '../../src/services/familyService';
import { db } from '../../src/services/firebase';
import { Achievement, calculateAchievements, getDaysTogether, linkPartners } from '../../src/services/relationshipService';
import { FamilyMember } from '../../src/types/family';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, userData, loading: authLoading, refreshUserData, signOutUser } = useAuth();
  
  // Семья
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [members, setMembers] = useState<(FamilyMember & { id: string })[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Отношения и модалки
  const [partnerEmailInput, setPartnerEmailInput] = useState('');
  const [isLinkModalVisible, setLinkModalVisible] = useState(false);
  const [linkingProcessing, setLinkingProcessing] = useState(false);

  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setJoinModalVisible] = useState(false);
  const [isEditProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [isRoleModalVisible, setRoleModalVisible] = useState(false);
  const [isRelationshipModalVisible, setRelationshipModalVisible] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<FamilyMember & { id: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Достижения (локальное состояние для превью)
  const [myAchievements, setMyAchievements] = useState<Achievement[]>([]);
  const [daysTogether, setDaysTogether] = useState(0);

  useEffect(() => {
    if (!userData?.familyId) { setFamilyName(null); return; }
    const unsub = onSnapshot(doc(db, 'families', userData.familyId), (d) => {
      setFamilyName(d.exists() ? d.data().name : null);
    });
    return () => unsub();
  }, [userData?.familyId]);

  useEffect(() => {
    if (!userData?.familyId) { setMembers([]); setLoadingMembers(false); return; }
    setLoadingMembers(true);
    const q = query(collection(db, 'members'), where('familyId', '==', userData.familyId));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as (FamilyMember & { id: string })[]);
      setLoadingMembers(false);
    });
    return () => unsub();
  }, [userData?.familyId]);

  // Расчет ачивок при загрузке данных
  useEffect(() => {
    if (!user || !userData) return;
    
    const days = getDaysTogether(userData.relationshipStartDate || null);
    setDaysTogether(days);

    // Заглушки статистики (в идеале брать из реальных подсчетов)
    const stats = { transactionsCount: 5, totalSpent: 5000, tasksCompleted: 2, messagesCount: 10 };
    
    const unlockedIds = userData.unlockedAchievements || [];
    const newAchs = calculateAchievements(stats, days, !!userData.familyId, unlockedIds);
    
    // Показываем только последние 3 для превью
    setMyAchievements(newAchs.slice(0, 3));
  }, [userData]);

  const handleLinkPartner = async () => {
    if (!partnerEmailInput.trim() || !user) return;
    setLinkingProcessing(true);
    try {
      await linkPartners(user.uid, partnerEmailInput.trim());
      await refreshUserData();
      setLinkModalVisible(false);
      Alert.alert('Успешно', 'Партнер привязан!');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLinkingProcessing(false);
    }
  };

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim() || !user || !userData) return;
    setIsProcessing(true);
    try {
      await createFamily(newFamilyName.trim(), user.uid, userData.email, userData.displayName);
      setCreateModalVisible(false); setNewFamilyName(''); await refreshUserData();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setIsProcessing(false); }
  };

  const handleJoinFamily = async () => {
    if (!inviteCodeInput.trim() || !user || !userData) return;
    setIsProcessing(true);
    try {
      await joinFamily(inviteCodeInput.trim(), user.uid, userData.email, userData.displayName);
      setJoinModalVisible(false); setInviteCodeInput(''); await refreshUserData();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setIsProcessing(false); }
  };

  const handleUpdateProfile = async () => {
    if (!newDisplayName.trim() || !user) return;
    setIsProcessing(true);
    try {
      const { updateProfile } = require('firebase/auth');
      await updateProfile(user, { displayName: newDisplayName.trim() });
      await updateDoc(doc(db, 'users', user.uid), { displayName: newDisplayName.trim() });
      setEditProfileModalVisible(false); await refreshUserData();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setIsProcessing(false); }
  };

  const handleSaveRelationshipDate = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { relationshipStartDate: Timestamp.fromDate(tempDate) });
      await refreshUserData();
      setRelationshipModalVisible(false);
      Alert.alert('Готово', 'Дата обновлена!');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setIsProcessing(false); }
  };

  const openRelationshipModal = () => {
    const initialDate = userData?.relationshipStartDate?.toDate() || new Date();
    setTempDate(initialDate);
    setRelationshipModalVisible(true);
  };

  const handleShowCode = async () => {
    if (!userData?.familyId) return;
    try {
      const code = await generateInviteCode(userData.familyId);
      Alert.alert('Пригласить', `Код: ${code}`);
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  };

  const handleLeaveFamily = () => {
    Alert.alert('Выйти?', 'Доступ к бюджету будет потерян.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => {
          if (!userData?.familyId || !user) return;
          await leaveFamily(user.uid, userData.familyId); await refreshUserData();
      }}
    ]);
  };

  const handleDeleteFamily = () => {
    Alert.alert('Удалить семью?', 'Необратимо.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          if (!userData?.familyId || !user) return;
          await deleteFamily(userData.familyId, user.uid); await refreshUserData();
      }}
    ]);
  };

  const handleRemoveMember = (memberId: string, name: string) => {
    Alert.alert(`Удалить ${name}?`, '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          if (!userData?.familyId || !user) return;
          await removeMember(memberId, userData.familyId, user.uid);
      }}
    ]);
  };

  const handleChangeRole = async (newRole: 'admin' | 'member') => {
    if (!selectedMemberForRole || !userData?.familyId || !user) return;
    try {
      await changeMemberRole(selectedMemberForRole.userId, newRole, userData.familyId, user.uid);
      setRoleModalVisible(false); setSelectedMemberForRole(null);
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  };

  const handleLogout = async () => {
    Alert.alert('Выход', 'Точно?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => {
          await signOutUser(); setTimeout(() => router.replace('/login'), 500);
      }}
    ]);
  };

  if (authLoading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  const formatDate = (ts: any) => ts ? ts.toDate().toLocaleDateString('ru-RU') : 'Не указана';

  return (
    <ScrollView style={styles.container}>
      {/* Профиль */}
      <View style={styles.profileCard}>
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{userData?.displayName?.[0]?.toUpperCase() || '?'}</Text></View>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{userData?.displayName}</Text>
            <Text style={styles.email}>{userData?.email}</Text>
            {userData?.partnerName && <Text style={styles.partnerText}>❤️ {userData.partnerName}</Text>}
          </View>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditProfileModalVisible(true)}>
          <Ionicons name="create-outline" size={18} color="#007AFF" /><Text style={styles.editBtnText}>Изменить имя</Text>
        </TouchableOpacity>
      </View>

      {/* ОТНОШЕНИЯ (с привязкой и превью ачивок) */}
      <View style={styles.relationshipCard}>
        <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Отношения</Text>
            <Ionicons name="heart" size={24} color="#FF3B30" />
        </View>
        
        {/* Дата и Привязка */}
        <View style={styles.rowSpaceBetween}>
            <TouchableOpacity style={styles.dateBox} onPress={openRelationshipModal}>
                <Text style={styles.labelSmall}>Начало:</Text>
                <Text style={styles.valueSmall}>{formatDate(userData?.relationshipStartDate)}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={styles.linkBtnBox} 
                onPress={() => userData?.partnerId ? Alert.alert('Инфо', `Вы связаны с ${userData.partnerName}`) : setLinkModalVisible(true)}
            >
                <Ionicons name={userData?.partnerId ? "checkmark-circle" : "link"} size={24} color={userData?.partnerId ? "#34C759" : "#FF3B30"} />
                <Text style={[styles.linkBtnText, {color: userData?.partnerId ? "#34C759" : "#FF3B30"}]}>
                    {userData?.partnerId ? "Связаны" : "Привязать"}
                </Text>
            </TouchableOpacity>
        </View>

        {/* Мини-профили и Ачивки */}
        <View style={styles.achPreviewContainer}>
            <Text style={styles.sectionSubTitle}>Мы вместе {daysTogether} дн.</Text>
            
            <View style={styles.miniProfilesRow}>
                <View style={styles.miniAvatarBox}>
                    <View style={[styles.miniAvatar, {backgroundColor:'#007AFF'}]}>
                        <Text style={styles.miniAvatarText}>{userData?.displayName?.[0]||'?'}</Text>
                    </View>
                    <Text style={styles.miniName}>{userData?.displayName?.split(' ')[0]||'Я'}</Text>
                </View>
                <View style={styles.ampersand}><Text>&</Text></View>
                <View style={styles.miniAvatarBox}>
                    {userData?.partnerId ? (
                        <>
                            <View style={[styles.miniAvatar, {backgroundColor:'#FF3B30'}]}>
                                <Text style={styles.miniAvatarText}>{userData?.partnerName?.[0]||'P'}</Text>
                            </View>
                            <Text style={styles.miniName}>{userData?.partnerName?.split(' ')[0]||'Партнер'}</Text>
                        </>
                    ) : (
                        <>
                            <View style={[styles.miniAvatar, {backgroundColor:'#ccc'}]}>
                                <Ionicons name="person-add" size={20} color="#fff"/>
                            </View>
                            <Text style={styles.miniName}>Нет пары</Text>
                        </>
                    )}
                </View>
            </View>

            <View style={styles.achievementsRow}>
                {myAchievements.length > 0 ? (
                    myAchievements.map((ach, i) => (
                        <View key={i} style={[styles.achBadge, {backgroundColor: ach.color+'20'}]}>
                            <Ionicons name={ach.icon as any} size={16} color={ach.color} />
                        </View>
                    ))
                ) : (
                    <Text style={styles.noAchText}>Пока нет достижений</Text>
                )}
            </View>
            
            {myAchievements.length > 0 && (
                <Text style={styles.hintAch}>+ еще {(userData?.unlockedAchievements?.length || 0) + myAchievements.length} (всего)</Text>
            )}
        </View>
      </View>

      {/* Семья */}
      <View style={styles.familyCard}>
        <Text style={styles.cardTitle}>Семья</Text>
        {!userData?.familyId ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Нет семьи</Text>
            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => setCreateModalVisible(true)}><Text style={styles.actionButtonText}>Создать</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => setJoinModalVisible(true)}><Text style={[styles.actionButtonText, {color:'#007AFF'}]}>Войти</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.familyNameText}>{familyName}</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.smallActionBtn} onPress={handleShowCode}><Ionicons name="person-add" size={18} color="#007AFF" /><Text style={styles.smallActionText}>Код</Text></TouchableOpacity>
              <TouchableOpacity style={styles.smallActionBtn} onPress={handleLeaveFamily}><Ionicons name="log-out" size={18} color="#FF9500" /><Text style={[styles.smallActionText, {color:'#FF9500'}]}>Выйти</Text></TouchableOpacity>
              {members.find(m => m.userId === user?.uid)?.role === 'owner' && (
                 <TouchableOpacity style={styles.smallActionBtn} onPress={handleDeleteFamily}><Ionicons name="trash" size={18} color="#FF3B30" /><Text style={[styles.smallActionText, {color:'#FF3B30'}]}>Удалить</Text></TouchableOpacity>
              )}
            </View>
            <Text style={styles.membersTitle}>Участники</Text>
            {loadingMembers ? <ActivityIndicator /> : members.map(m => (
              <View key={m.id} style={styles.memberItem}>
                <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{m.displayName?.[0]}</Text></View>
                <View style={styles.memberInfo}><Text style={styles.memberName}>{m.displayName}</Text><Text style={styles.memberRole}>{m.role}</Text></View>
                {m.userId === user?.uid && <View style={styles.badge}><Text style={styles.badgeText}>Вы</Text></View>}
                {m.userId !== user?.uid && (members.find(x => x.userId === user?.uid)?.role === 'owner' || members.find(x => x.userId === user?.uid)?.role === 'admin') && m.role !== 'owner' && (
                   <TouchableOpacity onPress={() => handleRemoveMember(m.userId, m.displayName||'')}><Ionicons name="close-circle" size={24} color="#FF3B30" /></TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Ionicons name="power" size={20} color="#fff" /><Text style={styles.logoutText}>Выйти</Text></TouchableOpacity>
      <View style={{height: 40}} />

      {/* --- МОДАЛКИ --- */}
      
      {/* Привязка */}
      <Modal visible={isLinkModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Привязать партнера</Text>
            <TextInput style={styles.input} placeholder="Email партнера" value={partnerEmailInput} onChangeText={setPartnerEmailInput} keyboardType="email-address" />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setLinkModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleLinkPartner} disabled={linkingProcessing} style={styles.confirmBtn}>
                {linkingProcessing ? <ActivityIndicator color="#fff"/> : <Text style={styles.confirmBtnText}>Привязать</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Остальные модалки (Create, Join, Edit, Role, Date) - вставь свои из предыдущего кода */}
      {/* Для краткости опущены, но они должны быть здесь */}
       <Modal visible={isCreateModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Семья</Text><TextInput style={styles.input} value={newFamilyName} onChangeText={setNewFamilyName}/><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setCreateModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleCreateFamily} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
       <Modal visible={isJoinModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Вход</Text><TextInput style={styles.input} value={inviteCodeInput} onChangeText={(t)=>setInviteCodeInput(t.toUpperCase())}/><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setJoinModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleJoinFamily} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
       <Modal visible={isEditProfileModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Имя</Text><TextInput style={styles.input} value={newDisplayName} onChangeText={setNewDisplayName}/><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setEditProfileModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleUpdateProfile} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
       <Modal visible={isRoleModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Роль</Text><TouchableOpacity style={styles.roleOption} onPress={()=>handleChangeRole('admin')}><Text style={styles.roleOptionText}>Админ</Text></TouchableOpacity><TouchableOpacity style={styles.roleOption} onPress={()=>handleChangeRole('member')}><Text style={styles.roleOptionText}>Юзер</Text></TouchableOpacity><TouchableOpacity onPress={()=>setRoleModalVisible(false)} style={styles.cancelBtnFull}><Text style={styles.cancelBtnText}>Закрыть</Text></TouchableOpacity></View></View></Modal>
       <Modal visible={isRelationshipModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Дата</Text>{showDatePicker && <DateTimePicker value={tempDate} mode="date" onChange={(e,d)=>{setShowDatePicker(false); if(d) setTempDate(d);}}/>}<TouchableOpacity style={styles.datePickerBtn} onPress={()=>setShowDatePicker(true)}><Text>{tempDate.toLocaleDateString()}</Text></TouchableOpacity><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setRelationshipModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleSaveRelationshipDate} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  profileCard: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20 },
  relationshipCard: { backgroundColor: '#FFF0F0', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 20 },
  familyCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  email: { fontSize: 13, color: '#666' },
  partnerText: { fontSize: 12, color: '#FF3B30', marginTop: 4, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F8FF', padding: 10, borderRadius: 8, marginTop: 10 },
  editBtnText: { color: '#007AFF', fontWeight: '600', marginLeft: 4 },
  
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  rowSpaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  dateBox: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 12, marginRight: 10 },
  labelSmall: { fontSize: 12, color: '#666' },
  valueSmall: { fontSize: 15, fontWeight: 'bold', color: '#333', marginTop: 2 },
  linkBtnBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#FFCDD2' },
  linkBtnText: { marginLeft: 6, fontWeight: 'bold', fontSize: 13 },

  achPreviewContainer: { backgroundColor: '#fff', padding: 15, borderRadius: 12 },
  sectionSubTitle: { fontSize: 14, fontWeight: '600', color: '#FF3B30', textAlign: 'center', marginBottom: 15 },
  miniProfilesRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  miniAvatarBox: { alignItems: 'center' },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  miniAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  miniName: { fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' },
  ampersand: { marginHorizontal: 15, color: '#999', fontSize: 16, fontWeight: 'bold' },
  
  achievementsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, minHeight: 30 },
  achBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  noAchText: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  hintAch: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 },

  emptyState: { alignItems: 'center', padding: 20 },
  emptyText: { color: '#999', marginBottom: 15 },
  buttonsRow: { flexDirection: 'row', gap: 10 },
  actionButton: { backgroundColor: '#007AFF', padding: 10, borderRadius: 8 },
  secondaryButton: { backgroundColor: '#E5F1FF' },
  actionButtonText: { color: '#fff', fontWeight: 'bold' },
  
  familyNameText: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  smallActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#EEE' },
  smallActionText: { marginLeft: 4, fontSize: 12, fontWeight: '600' },
  membersTitle: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8 },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  memberAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  memberAvatarText: { fontSize: 14, fontWeight: 'bold', color: '#007AFF' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '500' },
  memberRole: { fontSize: 11, color: '#999' },
  badge: { backgroundColor: '#4CD964', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  logoutBtn: { marginHorizontal: 16, backgroundColor: '#333', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 15 },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center', marginLeft: 10 },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtnFull: { width: '100%', padding: 15, alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderColor: '#eee' },
  roleOption: { width: '100%', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  roleOptionText: { fontSize: 16, textAlign: 'center' },
  datePickerBtn: { padding: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', marginVertical: 10, width: '100%' },
});