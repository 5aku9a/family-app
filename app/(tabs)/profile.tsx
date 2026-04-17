import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import {
  changeMemberRole,
  createFamily,
  deleteFamily,
  generateInviteCode,
  joinFamily,
  leaveFamily,
  removeMember,
} from '../../src/services/familyService';
import { db } from '../../src/services/firebase';
import { FamilyMember } from '../../src/types/family';

export default function ProfileScreen() {
  const { user, userData, loading: authLoading, refreshUserData, signOutUser } = useAuth();
  
  // Состояния семьи
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [members, setMembers] = useState<(FamilyMember & { id: string })[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Состояния модальных окон
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setJoinModalVisible] = useState(false);
  const [isEditProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [isRoleModalVisible, setRoleModalVisible] = useState(false);
  
  // Временные данные для форм
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<FamilyMember & { id: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Подписка на данные семьи (имя)
  useEffect(() => {
    if (!userData?.familyId) {
      setFamilyName(null);
      return;
    }
    const unsubFamily = onSnapshot(doc(db, 'families', userData.familyId), (docSnap) => {
      if (docSnap.exists()) {
        setFamilyName(docSnap.data().name);
      } else {
        setFamilyName(null);
      }
    });
    return () => unsubFamily();
  }, [userData?.familyId]);

  // Подписка на участников
  useEffect(() => {
    if (!userData?.familyId) {
      setMembers([]);
      setLoadingMembers(false);
      return;
    }

    setLoadingMembers(true);
    const { collection, query, where } = require('firebase/firestore');
    
    const membersQuery = query(
      collection(db, 'members'),
      where('familyId', '==', userData.familyId)
    );

    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot: any) => {
      const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setMembers(data);
      setLoadingMembers(false);
    }, (error: any) => {
      console.error("Ошибка подписки на участников:", error);
      setLoadingMembers(false);
    });

    return () => unsubscribeMembers();
  }, [userData?.familyId]);

  // --- Обработчики действий ---

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim() || !user || !userData) return;
    setIsProcessing(true);
    try {
      await createFamily(newFamilyName.trim(), user.uid, userData.email, userData.displayName);
      setCreateModalVisible(false);
      setNewFamilyName('');
      await refreshUserData(); // Обновляем контекст
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!inviteCodeInput.trim() || !user || !userData) return;
    setIsProcessing(true);
    try {
      await joinFamily(inviteCodeInput.trim(), user.uid, userData.email, userData.displayName);
      setJoinModalVisible(false);
      setInviteCodeInput('');
      await refreshUserData(); // Обновляем контекст
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newDisplayName.trim() || !user) return;
    setIsProcessing(true);
    try {
      const { updateProfile } = require('firebase/auth');
      const { doc, updateDoc } = require('firebase/firestore');
      
      // Обновляем в Auth
      await updateProfile(user, { displayName: newDisplayName.trim() });
      // Обновляем в Firestore
      await updateDoc(doc(db, 'users', user.uid), { 
        displayName: newDisplayName.trim() 
      });
      
      setEditProfileModalVisible(false);
      await refreshUserData();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowCode = async () => {
    if (!userData?.familyId) return;
    try {
      const code = await generateInviteCode(userData.familyId);
      Alert.alert(
        'Пригласить участника',
        `Отправьте этот код другу:\n\n🔑 ${code}\n\n(Действует 15 минут)`,
        [{ text: 'Понятно' }]
      );
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  const handleLeaveFamily = () => {
    Alert.alert('Выйти из семьи?', 'Вы потеряете доступ к общему бюджету.', [
      { text: 'Отмена', style: 'cancel' },
      { 
        text: 'Выйти', 
        style: 'destructive', 
        onPress: async () => {
          if (!userData?.familyId || !user) return;
          try {
            await leaveFamily(user.uid, userData.familyId);
            await refreshUserData();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message);
          }
        } 
      }
    ]);
  };

  const handleDeleteFamily = () => {
    Alert.alert('Удалить семью?', 'Это действие необратимо. Все участники будут удалены, история сохранится только у вас лично.', [
      { text: 'Отмена', style: 'cancel' },
      { 
        text: 'Удалить', 
        style: 'destructive', 
        onPress: async () => {
          if (!userData?.familyId || !user) return;
          try {
            await deleteFamily(userData.familyId, user.uid);
            await refreshUserData();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message);
          }
        } 
      }
    ]);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(`Удалить ${memberName}?`, 'Этот пользователь потеряет доступ к семье.', [
      { text: 'Отмена', style: 'cancel' },
      { 
        text: 'Удалить', 
        style: 'destructive', 
        onPress: async () => {
          if (!userData?.familyId || !user) return;
          try {
            await removeMember(memberId, userData.familyId, user.uid);
          } catch (e: any) {
            Alert.alert('Ошибка', e.message);
          }
        } 
      }
    ]);
  };

  const openRoleModal = (member: FamilyMember & { id: string }) => {
    setSelectedMemberForRole(member);
    setRoleModalVisible(true);
  };

  const handleChangeRole = async (newRole: 'admin' | 'member') => {
    if (!selectedMemberForRole || !userData?.familyId || !user) return;
    try {
      await changeMemberRole(selectedMemberForRole.userId, newRole, userData.familyId, user.uid);
      setRoleModalVisible(false);
      setSelectedMemberForRole(null);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Выход', 'Вы точно хотите выйти из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      { 
        text: 'Выйти', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await signOutUser();
            // Небольшая задержка для уверенности, что контекст очистился
            setTimeout(() => {
              router.replace('/login');
            }, 500);
          } catch (e: any) {
            Alert.alert('Ошибка', 'Не удалось выйти');
          }
        } 
      }
    ]);
  };

  if (authLoading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  return (
    <ScrollView style={styles.container}>
      {/* --- БЛОК ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ --- */}
      <View style={styles.profileCard}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userData?.displayName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{userData?.displayName}</Text>
            <Text style={styles.email}>{userData?.email}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.editBtn} 
          onPress={() => {
            setNewDisplayName(userData?.displayName || '');
            setEditProfileModalVisible(true);
          }}
        >
          <Ionicons name="create-outline" size={20} color="#007AFF" />
          <Text style={styles.editBtnText}>Редактировать профиль</Text>
        </TouchableOpacity>
      </View>

      {/* --- БЛОК СЕМЬИ --- */}
      <View style={styles.familyCard}>
        <Text style={styles.cardTitle}>Семья</Text>

        {!userData?.familyId ? (
          // Состояние: Нет семьи
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>Вы не состоите в семье</Text>
            <View style={styles.buttonsRow}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => setCreateModalVisible(true)}
              >
                <Ionicons name="add-circle" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Создать</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.secondaryButton]} 
                onPress={() => setJoinModalVisible(true)}
              >
                <Ionicons name="log-in" size={24} color="#007AFF" />
                <Text style={[styles.actionButtonText, {color: '#007AFF'}]}>Войти</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Состояние: Семья есть
          <>
            <Text style={styles.familyNameText}>{familyName || 'Загрузка...'}</Text>
            
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.smallActionBtn} onPress={handleShowCode}>
                <Ionicons name="person-add" size={20} color="#007AFF" />
                <Text style={styles.smallActionText}>Пригласить</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.smallActionBtn} onPress={handleLeaveFamily}>
                <Ionicons name="log-out" size={20} color="#FF9500" />
                <Text style={[styles.smallActionText, {color: '#FF9500'}]}>Выйти</Text>
              </TouchableOpacity>

              {members.find(m => m.userId === user?.uid)?.role === 'owner' && (
                <TouchableOpacity style={styles.smallActionBtn} onPress={handleDeleteFamily}>
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                  <Text style={[styles.smallActionText, {color: '#FF3B30'}]}>Удалить семью</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.membersTitle}>Участники ({members.length})</Text>
            
            {loadingMembers ? (
              <ActivityIndicator size="small" style={{marginTop: 10}} />
            ) : (
              members.map((member) => {
                const isMe = member.userId === user?.uid;
                const canManage = members.find(m => m.userId === user?.uid)?.role === 'owner' || 
                                  members.find(m => m.userId === user?.uid)?.role === 'admin';
                const isOwner = member.role === 'owner';

                return (
                  <View key={member.id} style={styles.memberItem}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{member.displayName?.[0]?.toUpperCase() || '?'}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.displayName}</Text>
                      <Text style={styles.memberRole}>
                        {isOwner ? 'Создатель' : member.role === 'admin' ? 'Администратор' : 'Участник'}
                      </Text>
                    </View>
                    
                    {isMe && <View style={styles.badge}><Text style={styles.badgeText}>Вы</Text></View>}
                    
                    {!isMe && canManage && !isOwner && (
                      <TouchableOpacity onPress={() => openRoleModal(member)}>
                        <Ionicons name="ellipsis-vertical" size={24} color="#666" />
                      </TouchableOpacity>
                    )}
                    {!isMe && canManage && !isOwner && (
                       // Для простоты удаляем через то же меню или отдельной кнопкой, здесь добавим удаление по долгому тапу или иконке
                       // Добавим иконку удаления рядом с меню для явности
                       <TouchableOpacity onPress={() => handleRemoveMember(member.id, member.displayName || '')} style={{marginLeft: 10}}>
                         <Ionicons name="close-circle" size={24} color="#FF3B30" />
                       </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </View>

      {/* Кнопка выхода из аккаунта */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="power" size={20} color="#fff" />
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
      
      <View style={{height: 40}} />

      {/* --- МОДАЛЬНЫЕ ОКНА --- */}
      
      {/* Создание семьи */}
      <Modal visible={isCreateModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Новая семья</Text>
            <TextInput
              style={styles.input}
              placeholder="Фамилия или название"
              value={newFamilyName}
              onChangeText={setNewFamilyName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleCreateFamily} 
                disabled={isProcessing || !newFamilyName.trim()}
                style={styles.confirmBtn}
              >
                {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Создать</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Вступление по коду */}
      <Modal visible={isJoinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Вход в семью</Text>
            <TextInput
              style={[styles.input, { textAlign: 'center', letterSpacing: 4, fontWeight: 'bold' }]}
              placeholder="CODE123"
              value={inviteCodeInput}
              onChangeText={(t) => setInviteCodeInput(t.toUpperCase())}
              maxLength={8}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleJoinFamily} 
                disabled={isProcessing || !inviteCodeInput.trim()}
                style={styles.confirmBtn}
              >
                {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Войти</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Редактирование профиля */}
      <Modal visible={isEditProfileModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Изменить имя</Text>
            <TextInput
              style={styles.input}
              placeholder="Ваше имя"
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setEditProfileModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleUpdateProfile} 
                disabled={isProcessing || !newDisplayName.trim()}
                style={styles.confirmBtn}
              >
                {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Изменение роли */}
      <Modal visible={isRoleModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Управление: {selectedMemberForRole?.displayName}
            </Text>
            
            {selectedMemberForRole?.role !== 'admin' ? (
              <TouchableOpacity 
                style={styles.roleOption} 
                onPress={() => handleChangeRole('admin')}
              >
                <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
                <Text style={styles.roleOptionText}>Назначить администратором</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.roleOption} 
                onPress={() => handleChangeRole('member')}
              >
                <Ionicons name="person" size={24} color="#666" />
                <Text style={styles.roleOptionText}>Снять права админа</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.roleOption, { borderTopWidth: 1, borderColor: '#eee', marginTop: 10 }]} 
              onPress={() => handleRemoveMember(selectedMemberForRole!.id, selectedMemberForRole!.displayName || '')}
            >
              <Ionicons name="trash" size={24} color="#FF3B30" />
              <Text style={[styles.roleOptionText, { color: '#FF3B30' }]}>Удалить из семьи</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setRoleModalVisible(false); setSelectedMemberForRole(null); }} 
              style={styles.cancelBtnFull}
            >
              <Text style={styles.cancelBtnText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  
  // Карточки
  profileCard: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  familyCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  
  // Профиль
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  email: { fontSize: 14, color: '#666', marginTop: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#F0F8FF', borderRadius: 8 },
  editBtnText: { color: '#007AFF', fontWeight: '600', marginLeft: 6 },

  // Семья
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontSize: 16, color: '#666', marginVertical: 10 },
  buttonsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionButton: { flexDirection: 'row', backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center' },
  secondaryButton: { backgroundColor: '#E5F1FF' },
  actionButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 6 },
  
  familyNameText: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  smallActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#EEE' },
  smallActionText: { marginLeft: 4, fontWeight: '600', fontSize: 13 },
  
  membersTitle: { fontSize: 16, fontWeight: '600', color: '#666', marginBottom: 10 },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '500', color: '#333' },
  memberRole: { fontSize: 12, color: '#999' },
  badge: { backgroundColor: '#4CD964', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Выход
  logoutBtn: { marginHorizontal: 16, backgroundColor: '#333', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },

  // Модальные окна
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: '#FAFAFA' },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center', marginLeft: 10 },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtnFull: { width: '100%', padding: 15, alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderColor: '#eee' },
  
  roleOption: { flexDirection: 'row', alignItems: 'center', width: '100%', padding: 15 },
  roleOptionText: { fontSize: 16, marginLeft: 15, color: '#333', flex: 1 },
});