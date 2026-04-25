import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
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

export default function ProfileScreen() {
  const { user, userData, loading: authLoading, refreshUserData, signOutUser } = useAuth();
  
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [members, setMembers] = useState<(FamilyMember & { id: string })[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Отношения
  const [partnerEmailInput, setPartnerEmailInput] = useState('');
  const [isLinkModalVisible, setLinkModalVisible] = useState(false);
  const [linkingProcessing, setLinkingProcessing] = useState(false);
  const [isRelationshipModalVisible, setRelationshipModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  // Модалки
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setJoinModalVisible] = useState(false);
  const [isEditProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [isRoleModalVisible, setRoleModalVisible] = useState(false);
  
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<FamilyMember & { id: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Данные
  const [myAchievements, setMyAchievements] = useState<Achievement[]>([]);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [daysTogether, setDaysTogetherState] = useState(0);
  const [isLoadingPartner, setIsLoadingPartner] = useState(false);

  // Подписка на семью (название)
  useEffect(() => {
    if (!userData?.familyId) { setFamilyName(null); return; }
    const unsub = onSnapshot(doc(db, 'families', userData.familyId), (d) => {
      setFamilyName(d.exists() ? d.data().name : null);
    });
    return () => unsub();
  }, [userData?.familyId]);

  // Подписка на участников семьи
  useEffect(() => {
    if (!userData?.familyId) { setMembers([]); setLoadingMembers(false); return; }
    setLoadingMembers(true);
    const q = query(collection(db, 'members'), where('familyId', '==', userData.familyId));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map(d => ({ id: d.id, ...d.data() })) as (FamilyMember & { id: string })[];
      setMembers(mapped);
      setLoadingMembers(false);
    });
    return () => unsub();
  }, [userData?.familyId]);

  // Загрузка партнера и достижений
  useEffect(() => {
    if (!user) return;
    loadProfileData();
  }, [user, userData?.partnerId, userData?.relationshipStartDate, userData?.familyId, userData?.unlockedAchievements]);

  const loadProfileData = async () => {
    // 1. Партнер
    if (userData?.partnerId) {
      setIsLoadingPartner(true);
      try {
        const snap = await getDoc(doc(db, 'users', userData.partnerId));
        if (snap.exists()) {
          setPartnerData(snap.data());
        } else {
          setPartnerData(null);
        }
      } catch (e) {
        console.error("Ошибка загрузки партнера", e);
        setPartnerData(null);
      } finally {
        setIsLoadingPartner(false);
      }
    } else {
      setPartnerData(null);
      setIsLoadingPartner(false);
    }

    // 2. Дни вместе
    const days = getDaysTogether(userData?.relationshipStartDate || null);
    setDaysTogetherState(days);

    // 3. Достижения (заглушка статистики)
    const stats = { transactionsCount: 12, totalSpent: 15400, tasksCompleted: 3, messagesCount: 0 };
    const unlockedIds = userData?.unlockedAchievements || [];
    const newAchs = calculateAchievements(stats, days, !!userData?.familyId, unlockedIds);
    setMyAchievements(newAchs);
  };

  const handleLinkPartner = async () => {
    if (!partnerEmailInput.trim() || !user) return;
    setLinkingProcessing(true);
    try {
      await linkPartners(user.uid, partnerEmailInput.trim());
      setLinkModalVisible(false);
      setPartnerEmailInput('');
      Alert.alert('Успешно', 'Пара привязана!');
      
      // Принудительное обновление
      await refreshUserData();
      setTimeout(() => {
         loadProfileData();
      }, 500);
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
      Alert.alert('Готово', 'Дата сохранена!');
      loadProfileData();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setIsProcessing(false); }
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
          </View>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditProfileModalVisible(true)}>
          <Ionicons name="create-outline" size={18} color="#007AFF" /><Text style={styles.editBtnText}>Изменить имя</Text>
        </TouchableOpacity>
      </View>

      {/* ОТНОШЕНИЯ */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Отношения</Text>
          {userData?.partnerId && <Ionicons name="heart" size={20} color="#FF3B30" />}
        </View>

        {!userData?.partnerId ? (
          <View style={styles.emptyStateSmall}>
            <Text style={styles.emptyTextSmall}>Нет привязанного партнера</Text>
            <TouchableOpacity style={styles.linkBtn} onPress={() => setLinkModalVisible(true)}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.linkBtnText}>Привязать пару</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {isLoadingPartner ? (
              <ActivityIndicator style={{marginVertical: 20}} />
            ) : (
              <>
                <View style={styles.coupleRow}>
                  <View style={styles.miniAvatar}>
                    <Text style={styles.miniAvatarText}>{userData?.displayName?.[0] || '?'}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color="#ccc" style={{marginHorizontal: 8}} />
                  <View style={styles.miniAvatar}>
                    <Text style={styles.miniAvatarText}>{partnerData?.displayName?.[0] || '?'}</Text>
                  </View>
                  <View style={styles.daysBadge}>
                    <Text style={styles.daysBadgeText}>{daysTogether} дн.</Text>
                  </View>
                </View>
                
                <View style={styles.rowActions}>
                  <TouchableOpacity style={styles.smallAction} onPress={() => setRelationshipModalVisible(true)}>
                    <Ionicons name="calendar" size={16} color="#007AFF" />
                    <Text style={styles.smallActionText}>Дата: {formatDate(userData?.relationshipStartDate)}</Text>
                  </TouchableOpacity>
                </View>
                
                {myAchievements.length > 0 && (
                  <View style={styles.achPreview}>
                    <Text style={styles.achPreviewTitle}>Новые достижения:</Text>
                    <View style={styles.achRow}>
                      {myAchievements.slice(0, 3).map((ach) => (
                        <View key={ach.id} style={[styles.achDot, { backgroundColor: ach.color }]} />
                      ))}
                      {myAchievements.length > 3 && (
                        <View style={styles.achMore}><Text style={styles.achMoreText}>+{myAchievements.length - 3}</Text></View>
                      )}
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>

      {/* СЕМЬЯ */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Семья</Text>
        {!userData?.familyId ? (
          <View style={styles.emptyStateSmall}>
            <Text style={styles.emptyTextSmall}>Нет семьи</Text>
            <View style={styles.buttonsRowSmall}>
              <TouchableOpacity style={styles.btnSmall} onPress={() => setCreateModalVisible(true)}><Text style={styles.btnSmallText}>Создать</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnSmall, styles.btnSmallSec]} onPress={() => setJoinModalVisible(true)}><Text style={[styles.btnSmallText, {color:'#007AFF'}]}>Войти</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.familyName}>{familyName}</Text>
            
            {/* СПИСОК УЧАСТНИКОВ (ВОССТАНОВЛЕНО) */}
            <View style={styles.membersList}>
              {loadingMembers ? (
                <ActivityIndicator size="small" style={{marginTop: 10}} />
              ) : members.length === 0 ? (
                <Text style={styles.emptyTextSmall}>Загрузка участников...</Text>
              ) : (
                members.map(m => {
                  const isMe = m.userId === user?.uid;
                  const canManage = members.find(x => x.userId === user?.uid)?.role === 'owner' || members.find(x => x.userId === user?.uid)?.role === 'admin';
                  const isOwner = m.role === 'owner';

                  return (
                    <View key={m.id} style={styles.memberRow}>
                      <View style={styles.mAvatar}><Text style={styles.mAvatarText}>{m.displayName?.[0] || '?'}</Text></View>
                      <View style={styles.mInfo}>
                        <Text style={styles.mName}>{m.displayName}</Text>
                        <Text style={styles.mRole}>{isOwner ? 'Создатель' : m.role === 'admin' ? 'Админ' : 'Участник'}</Text>
                      </View>
                      {isMe && <View style={styles.meBadge}><Text style={styles.meBadgeText}>Вы</Text></View>}
                      
                      {!isMe && canManage && !isOwner && (
                        <TouchableOpacity onPress={() => handleRemoveMember(m.userId, m.displayName||'')} style={{marginLeft: 5}}>
                          <Ionicons name="close-circle" size={20} color="#FF3B30"/>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.familyActions}>
               <TouchableOpacity style={styles.familyActionBtn} onPress={handleShowCode}>
                 <Ionicons name="person-add" size={16} color="#007AFF" />
                 <Text style={styles.familyActionText}>Пригласить</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.familyActionBtn} onPress={handleLeaveFamily}>
                 <Ionicons name="log-out" size={16} color="#FF9500" />
                 <Text style={[styles.familyActionText, {color: '#FF9500'}]}>Выйти</Text>
               </TouchableOpacity>
               {members.find(m => m.userId === user?.uid)?.role === 'owner' && (
                 <TouchableOpacity style={styles.familyActionBtn} onPress={handleDeleteFamily}>
                   <Ionicons name="trash" size={16} color="#FF3B30" />
                   <Text style={[styles.familyActionText, {color: '#FF3B30'}]}>Удалить</Text>
                 </TouchableOpacity>
               )}
            </View>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="power" size={20} color="#fff" />
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
      
      <View style={{height: 60}} />

      {/* --- МОДАЛЬНЫЕ ОКНА --- */}
      
      {/* Link Modal */}
      <Modal visible={isLinkModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Привязать партнера</Text>
            <TextInput style={styles.input} placeholder="Email партнера" value={partnerEmailInput} onChangeText={setPartnerEmailInput} keyboardType="email-address" autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setLinkModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleLinkPartner} disabled={linkingProcessing} style={styles.confirmBtn}>
                {linkingProcessing ? <ActivityIndicator color="#fff"/> : <Text style={styles.confirmBtnText}>Привязать</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Modal */}
      <Modal visible={isRelationshipModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Дата начала отношений</Text>
            {showDatePicker && (
              <DateTimePicker 
                value={tempDate} 
                mode="date" 
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setTempDate(selectedDate);
                }}
              />
            )}
            {!showDatePicker && (
              <TouchableOpacity style={styles.datePickerBtn} onPress={()=>setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color="#007AFF" style={{marginRight: 8}}/>
                <Text style={{fontSize: 16}}>{tempDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={()=>setRelationshipModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRelationshipDate} disabled={isProcessing} style={styles.confirmBtn}>
                {isProcessing ? <ActivityIndicator color="#fff"/> : <Text style={styles.confirmBtnText}>OK</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Family Modal */}
      <Modal visible={isCreateModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Название семьи</Text>
            <TextInput style={styles.input} placeholder="Фамилия" value={newFamilyName} onChangeText={setNewFamilyName} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={()=>setCreateModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleCreateFamily} disabled={isProcessing || !newFamilyName} style={styles.confirmBtn}>
                {isProcessing ? <ActivityIndicator color="#fff"/> : <Text style={styles.confirmBtnText}>Создать</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Family Modal */}
      <Modal visible={isJoinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Код приглашения</Text>
            <TextInput style={[styles.input, {textAlign:'center', letterSpacing: 2, fontWeight:'bold'}]} placeholder="CODE" value={inviteCodeInput} onChangeText={(t)=>setInviteCodeInput(t.toUpperCase())} maxLength={8} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={()=>setJoinModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleJoinFamily} disabled={isProcessing || !inviteCodeInput} style={styles.confirmBtn}>
                {isProcessing ? <ActivityIndicator color="#fff"/> : <Text style={styles.confirmBtnText}>Войти</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={isEditProfileModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ваше имя</Text>
            <TextInput style={styles.input} placeholder="Имя" value={newDisplayName} onChangeText={setNewDisplayName} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={()=>setEditProfileModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateProfile} disabled={isProcessing || !newDisplayName} style={styles.confirmBtn}>
                {isProcessing ? <ActivityIndicator color="#fff"/> : <Text style={styles.confirmBtnText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Role Modal */}
      <Modal visible={isRoleModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Роль: {selectedMemberForRole?.displayName}</Text>
            <TouchableOpacity style={styles.roleOption} onPress={()=>handleChangeRole('admin')}><Text style={styles.roleOptionText}>Назначить админом</Text></TouchableOpacity>
            <TouchableOpacity style={styles.roleOption} onPress={()=>handleChangeRole('member')}><Text style={styles.roleOptionText}>Обычный участник</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.roleOption, {borderTopWidth:1, borderColor:'#eee'}]} onPress={()=>{
               if(selectedMemberForRole) handleRemoveMember(selectedMemberForRole.userId, selectedMemberForRole.displayName||'');
               setRoleModalVisible(false);
            }}><Text style={[styles.roleOptionText, {color:'#FF3B30'}]}>Удалить из семьи</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setRoleModalVisible(false)} style={styles.cancelBtnFull}><Text style={styles.cancelBtnText}>Закрыть</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  profileCard: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  email: { fontSize: 13, color: '#666' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F8FF', padding: 10, borderRadius: 8, marginTop: 10 },
  editBtnText: { color: '#007AFF', fontWeight: '600', marginLeft: 6 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  
  emptyStateSmall: { alignItems: 'center', paddingVertical: 10 },
  emptyTextSmall: { color: '#999', marginBottom: 10, textAlign: 'center' },
  linkBtn: { flexDirection: 'row', backgroundColor: '#FF3B30', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center' },
  linkBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 4 },
  
  coupleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center' },
  miniAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
  daysBadge: { marginLeft: 10, backgroundColor: '#FFF0F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FFCDD2' },
  daysBadgeText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 12 },
  
  rowActions: { borderTopWidth: 1, borderColor: '#f0f0f0', paddingTop: 10 },
  smallAction: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  smallActionText: { marginLeft: 6, color: '#666', fontSize: 14 },
  
  achPreview: { marginTop: 10, backgroundColor: '#FAFAFA', padding: 10, borderRadius: 8 },
  achPreviewTitle: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6 },
  achRow: { flexDirection: 'row', alignItems: 'center' },
  achDot: { width: 24, height: 24, borderRadius: 12, marginRight: 6 },
  achMore: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  achMoreText: { fontSize: 10, color: '#666', fontWeight: 'bold' },

  familyName: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#333' },
  membersList: { marginTop: 5 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  mAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  mAvatarText: { fontSize: 14, fontWeight: 'bold', color: '#555' },
  mInfo: { flex: 1 },
  mName: { fontSize: 14, fontWeight: '500' },
  mRole: { fontSize: 11, color: '#999' },
  meBadge: { backgroundColor: '#4CD964', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginRight: 8 },
  meBadgeText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  
  familyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: '#f0f0f0' },
  familyActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#EEE', marginRight: 5 },
  familyActionText: { marginLeft: 4, fontWeight: '600', fontSize: 12 },

  buttonsRowSmall: { flexDirection: 'row', gap: 10 },
  btnSmall: { backgroundColor: '#007AFF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnSmallSec: { backgroundColor: '#E5F1FF' },
  btnSmallText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  logoutBtn: { marginHorizontal: 16, backgroundColor: '#333', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 15, backgroundColor: '#FAFAFA' },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center', marginLeft: 10 },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtnFull: { width: '100%', padding: 15, alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderColor: '#eee' },
  roleOption: { width: '100%', padding: 15, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center' },
  roleOptionText: { fontSize: 16, marginLeft: 10, flex: 1 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginVertical: 10, width: '100%', justifyContent: 'center' },
});