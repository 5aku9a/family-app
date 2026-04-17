import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import {
  createFamily,
  generateInviteCode,
  joinFamily,
  leaveFamily,
  removeMember,
  changeMemberRole,
  deleteFamily,
} from '../../src/services/familyService';
import { db } from '../../src/services/firebase';
import { FamilyMember } from '../../src/types/family';

export default function ProfileScreen() {
  const { user, userData, loading: authLoading, refreshUserData, signOutUser } = useAuth();
  
  // Состояния данных
  const [members, setMembers] = useState<(FamilyMember & { id: string })[]>([]);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Состояния модальных окон
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  
  // Временные данные для форм
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedMember, setSelectedMember] = useState<(FamilyMember & { id: string }) | null>(null);
  
  // Состояния загрузки действий
  const [actionLoading, setActionLoading] = useState(false);

  // Подписка на изменения имени семьи
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

  // Подписка на список участников
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

    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(data as any);
      setLoadingMembers(false);
    }, (error) => {
      console.error("Ошибка подписки:", error);
      setLoadingMembers(false);
    });

    return () => unsubscribeMembers();
  }, [userData?.familyId]);

  // Обработчики открытия модальных окон
  const openCreateModal = () => {
    setNewFamilyName('');
    setCreateModalVisible(true);
  };

  const openJoinModal = () => {
    setInviteCodeInput('');
    setJoinModalVisible(true);
  };

  const openEditProfile = () => {
    setNewDisplayName(userData?.displayName || '');
    setEditProfileModalVisible(true);
  };

  const openRoleModal = (member: any) => {
    setSelectedMember(member);
    setRoleModalVisible(true);
  };

  // Действия
  const handleCreateFamily = async () => {
    if (!newFamilyName.trim() || !user) return;
    setActionLoading(true);
    try {
      await createFamily(newFamilyName.trim(), user.uid, userData?.email || '', userData?.displayName);
      setCreateModalVisible(false);
      await refreshUserData(); // Обновляем контекст
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!inviteCodeInput.trim() || !user) return;
    setActionLoading(true);
    try {
      await joinFamily(inviteCodeInput.trim(), user.uid, userData?.email || '', userData?.displayName);
      setJoinModalVisible(false);
      await refreshUserData(); // Обновляем контекст
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newDisplayName.trim() || !user) return;
    setActionLoading(true);
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
      setActionLoading(false);
    }
  };

  const handleChangeRole = async (newRole: 'admin' | 'member') => {
    if (!selectedMember || !userData?.familyId || !user) return;
    setActionLoading(true);
    try {
      await changeMemberRole(selectedMember.userId, newRole, userData.familyId, user.uid);
      setRoleModalVisible(false);
      setSelectedMember(null);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!userData?.familyId || !user) return;
    Alert.alert('Удалить участника?', 'Этот пользователь потеряет доступ к семье.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await removeMember(memberId, userData.familyId!, user.uid);
          } catch (e: any) {
            Alert.alert('Ошибка', e.message);
          } finally {
            setActionLoading(false);
          }
        }
      }
    ]);
  };

  const handleDeleteFamily = async () => {
    if (!userData?.familyId || !user) return;
    Alert.alert('Удалить семью?', 'Это действие необратимо. Все участники будут удалены, история транзакций семьи останется, но будет недоступна.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await deleteFamily(userData.familyId, user.uid);
            await refreshUserData(); // Сбросит familyId в null
          } catch (e: any) {
            Alert.alert('Ошибка', e.message);
          } finally {
            setActionLoading(false);
          }
        }
      }
    ]);
  };

  const handleLeaveFamily = async () => {
    if (!userData?.familyId || !user) return;
    Alert.alert('Выйти из семьи?', 'Вы потеряете доступ к общему бюджету.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await leaveFamily(user.uid, userData.familyId);
            await refreshUserData();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message);
          } finally {
            setActionLoading(false);
          }
        }
      }
    ]);
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
            // Принудительный редирект
            setTimeout(() => {
              // @ts-ignore
              import('expo-router').then(({ router }) => router.replace('/login'));
            }, 500);
          } catch (e) {
            Alert.alert('Ошибка', 'Не удалось выйти');
          }
        }
      }
    ]);
  };

  if (authLoading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  // Экран "Нет семьи"
  if (userData && !userData.familyId) {
    return (
      <View style={styles.container}>
        {/* Шапка профиля */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userData?.displayName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.name}>{userData?.displayName}</Text>
          <Text style={styles.email}>{userData?.email}</Text>
          <TouchableOpacity style={styles.editBtnSmall} onPress={openEditProfile}>
            <Ionicons name="create-outline" size={18} color="#007AFF" />
            <Text style={styles.editBtnText}>Ред.</Text>
          </TouchableOpacity>
        </View>

        {/* Блок настройки семьи */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Настройка семьи</Text>
          <Text style={styles.cardSubtitle}>Создайте новую семью или вступите в существующую по коду</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={openCreateModal}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Создать семью</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={openJoinModal}>
            <Ionicons name="log-in" size={24} color="#007AFF" />
            <Text style={[styles.actionButtonText, {color: '#007AFF'}]}>Вступить по коду</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="power" size={20} color="#fff" />
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>

        {/* Модальные окна */}
        <Modal visible={createModalVisible} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Название семьи</Text>
              <TextInput
                style={styles.input}
                placeholder="Например: Ивановы"
                value={newFamilyName}
                onChangeText={setNewFamilyName}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, actionLoading && styles.btnDisabled]} 
                  onPress={handleCreateFamily}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Создать</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={joinModalVisible} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Код приглашения</Text>
              <TextInput
                style={[styles.input, { textAlign: 'center', letterSpacing: 4, fontSize: 20 }]}
                placeholder="ABC123"
                value={inviteCodeInput}
                onChangeText={(text) => setInviteCodeInput(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setJoinModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, actionLoading && styles.btnDisabled]} 
                  onPress={handleJoinFamily}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Вступить</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={editProfileModalVisible} transparent animationType="slide">
           <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Ваше имя</Text>
              <TextInput
                style={styles.input}
                placeholder="Имя"
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditProfileModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, actionLoading && styles.btnDisabled]} 
                  onPress={handleUpdateProfile}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Сохранить</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // Экран "Есть семья"
  return (
    <ScrollView style={styles.container}>
      {/* Шапка профиля */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userData?.displayName?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.name}>{userData?.displayName}</Text>
        <Text style={styles.email}>{userData?.email}</Text>
        <TouchableOpacity style={styles.editBtnSmall} onPress={openEditProfile}>
          <Ionicons name="create-outline" size={18} color="#007AFF" />
          <Text style={styles.editBtnText}>Ред.</Text>
        </TouchableOpacity>
      </View>

      {/* Блок Семья */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {familyName ? `Семья "${familyName}"` : "Моя семья"}
        </Text>
        
        <TouchableOpacity style={styles.actionRow} onPress={() => {
          generateInviteCode(userData.familyId!).then(code => 
            Alert.alert('Код приглашения', `Отправьте этот код:\n\n🔑 ${code}\n\n(Действует 15 мин)`)
          ).catch(e => Alert.alert('Ошибка', e.message));
        }}>
          <Ionicons name="person-add" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Пригласить участника</Text>
        </TouchableOpacity>
        
        {members.find(m => m.userId === user?.uid)?.role === 'owner' ? (
          <TouchableOpacity style={styles.actionRow} onPress={handleDeleteFamily}>
            <Ionicons name="trash" size={24} color="#FF3B30" />
            <Text style={[styles.actionText, { color: '#FF3B30' }]}>Удалить семью</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionRow} onPress={handleLeaveFamily}>
            <Ionicons name="log-out" size={24} color="#FF3B30" />
            <Text style={[styles.actionText, { color: '#FF3B30' }]}>Выйти из семьи</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.membersTitle}>Участники ({members.length})</Text>
        
        {loadingMembers ? (
          <ActivityIndicator size="small" style={{marginTop: 10}} />
        ) : members.length === 0 ? (
          <Text style={styles.emptyText}>Пока нет участников</Text>
        ) : (
          members.map((member) => {
            const isMe = member.userId === user?.uid;
            const isOwner = userData?.familyId && members.find(m => m.role === 'owner')?.userId === userData.familyId; // Упрощенно
            const currentRole = members.find(m => m.userId === user?.uid)?.role;
            const canManage = (currentRole === 'owner' || currentRole === 'admin') && !isMe;

            return (
              <View key={member.id} style={styles.memberItem}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{member.displayName?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.displayName}</Text>
                  <Text style={styles.memberRole}>
                    {member.role === 'owner' ? 'Создатель' : member.role === 'admin' ? 'Администратор' : 'Участник'}
                  </Text>
                </View>
                {isMe && <View style={styles.badge}><Text style={styles.badgeText}>Вы</Text></View>}
                
                {canManage && member.role !== 'owner' && (
                  <TouchableOpacity onPress={() => openRoleModal(member)} style={styles.menuBtn}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="power" size={20} color="#fff" />
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
      
      <View style={{height: 40}} />

      {/* Модальное окно роли */}
      <Modal visible={roleModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRoleModalVisible(false)}>
          <View style={styles.roleModalContent}>
            <Text style={styles.modalTitle}>Управление: {selectedMember?.displayName}</Text>
            
            <TouchableOpacity 
              style={styles.roleOption} 
              onPress={() => handleChangeRole('admin')}
              disabled={selectedMember?.role === 'admin'}
            >
              <Text style={[styles.roleOptionText, selectedMember?.role === 'admin' && styles.roleOptionDisabled]}>
                Назначить администратором
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.roleOption} 
              onPress={() => handleChangeRole('member')}
              disabled={selectedMember?.role === 'member'}
            >
              <Text style={[styles.roleOptionText, selectedMember?.role === 'member' && styles.roleOptionDisabled]}>
                Сделать участником
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.roleOption, styles.deleteOption]} onPress={() => handleRemoveMember(selectedMember!.userId)}>
              <Text style={styles.roleOptionTextDanger}>Удалить из семьи</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRoleModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Модальное окно редактирования (дублируется для надежности, можно вынести в отдельный компонент) */}
       <Modal visible={editProfileModalVisible} transparent animationType="slide">
           <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Ваше имя</Text>
              <TextInput
                style={styles.input}
                placeholder="Имя"
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditProfileModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.confirmBtn, actionLoading && styles.btnDisabled]} 
                  onPress={handleUpdateProfile}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Сохранить</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { alignItems: 'center', padding: 20, backgroundColor: '#fff', paddingBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  email: { fontSize: 14, color: '#666', marginBottom: 5 },
  editBtnSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E5F1FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  editBtnText: { color: '#007AFF', marginLeft: 4, fontSize: 14, fontWeight: '600' },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, margin: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  cardSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  actionText: { fontSize: 16, marginLeft: 10, color: '#333' },
  
  actionButton: { flexDirection: 'row', backgroundColor: '#007AFF', padding: 15, borderRadius: 12, width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  secondaryButton: { backgroundColor: '#E5F1FF' },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  
  membersTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 10, color: '#666' },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '500', color: '#333' },
  memberRole: { fontSize: 12, color: '#999' },
  badge: { backgroundColor: '#4CD964', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  menuBtn: { padding: 5 },
  
  logoutBtn: { marginHorizontal: 16, backgroundColor: '#333', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  
  emptyText: { textAlign: 'center', color: '#999', fontStyle: 'italic', marginTop: 10 },
  btnDisabled: { opacity: 0.6 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  roleModalContent: { backgroundColor: '#fff', margin: 40, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20, backgroundColor: '#f9f9f9' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
  confirmBtn: { flex: 1, backgroundColor: '#007AFF', padding: 15, borderRadius: 12, alignItems: 'center', marginLeft: 10 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },