import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { arrayUnion, collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { changeMemberRole, createFamily, deleteFamily, generateInviteCode, joinFamily, leaveFamily, removeMember } from '../../src/services/familyService';
import { db } from '../../src/services/firebase';
import { Achievement, ALL_ACHIEVEMENTS } from '../../src/services/relationshipService';
import { FamilyMember } from '../../src/types/family';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, userData, loading: authLoading, refreshUserData, signOutUser } = useAuth();
  
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [members, setMembers] = useState<(FamilyMember & { id: string })[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Отношения
  const [localPartnerId, setLocalPartnerId] = useState<string | null>(null);
  const [localStartDate, setLocalStartDate] = useState<Timestamp | null>(null);

  // UI флаги
  const [isRelationshipExpanded, setIsRelationshipExpanded] = useState(false);
  const [isRelationshipModalVisible, setRelationshipModalVisible] = useState(false);
  const [isMilestonesModalVisible, setMilestonesModalVisible] = useState(false);
  const [isAchievementsModalVisible, setAchievementsModalVisible] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  // Достижения
  const [myUnlockedIds, setMyUnlockedIds] = useState<string[]>([]);
  const [isCheckingAchievements, setIsCheckingAchievements] = useState(false);

  // Модалки семьи
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setJoinModalVisible] = useState(false);
  const [isEditProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [isRoleModalVisible, setRoleModalVisible] = useState(false);
  
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<FamilyMember & { id: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Подписка на семью
  useEffect(() => {
    if (!userData?.familyId) { setFamilyName(null); return; }
    const unsub = onSnapshot(doc(db, 'families', userData.familyId), (d) => {
      setFamilyName(d.exists() ? d.data().name : null);
    });
    return () => unsub();
  }, [userData?.familyId]);

  // 2. Подписка на участников
  useEffect(() => {
    if (!userData?.familyId) { 
      setMembers([]); 
      setLoadingMembers(false); 
      return; 
    }
    setLoadingMembers(true);
    const q = query(collection(db, 'members'), where('familyId', '==', userData.familyId));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as (FamilyMember & { id: string })[]);
      setLoadingMembers(false);
    }, (err) => {
      console.error(err);
      setLoadingMembers(false);
    });
    return () => unsub();
  }, [userData?.familyId]);

  // 3. Подписка на пару (общий документ pairs)
  useEffect(() => {
    if (!user) return;
    const q1 = query(collection(db, 'pairs'), where('user1', '==', user.uid));
    const q2 = query(collection(db, 'pairs'), where('user2', '==', user.uid));

    let unsub1: () => void;
    let unsub2: () => void;

    const handleSnapshot = (snapshot: any) => {
      if (!snapshot.empty) {
        const pairDoc = snapshot.docs[0];
        const data = pairDoc.data();
        const partnerId = data.user1 === user.uid ? data.user2 : data.user1;
        setLocalPartnerId(partnerId);
        setLocalStartDate(data.startDate);
      } else {
        setLocalPartnerId(null);
        setLocalStartDate(null);
      }
    };

    unsub1 = onSnapshot(q1, (snap) => {
      handleSnapshot(snap);
    });
    
    // Дополнительная подписка на случай если пользователь user2
    unsub2 = onSnapshot(q2, (snap) => {
       if (snap.empty && unsub1) { 
         // Если первый запрос пуст, второй уже обрабатывается или тоже пуст
         // Логика handleSnapshot внутри unsub1 уже сбрасывает состояние если пусто, 
         // но для надежности можно продублировать проверку здесь если нужно
       } else if (!snap.empty) {
         handleSnapshot(snap);
       }
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  
  // 4. Подписка на достижения и их ПРОВЕРКА при изменении данных
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const unlocked = docSnap.data()?.unlockedAchievements || [];
        const currentIds = Array.isArray(unlocked) ? unlocked : [];
        setMyUnlockedIds(currentIds);
        
        // Запускаем проверку достижений только если данные загрузились и мы еще не проверяли в этой сессии активно
        if (!isCheckingAchievements && localStartDate) {
           checkAndUnlockAchievements(currentIds);
        }
      }
    });
    return () => unsub();
  }, [user, localStartDate, isCheckingAchievements]);

  
  // Функция проверки и разблокировки достижений
  const checkAndUnlockAchievements = async (currentIds: string[]) => {
    if (!localStartDate || !user) return;
    
    setIsCheckingAchievements(true);
    const newAchievements: string[] = [];
    const days = Math.floor((Date.now() - localStartDate.toDate().getTime()) / (1000 * 60 * 60 * 24));

    // 1. Проверка на наличие отношений (Первый шаг)
    const firstStepId = 'first_step'; // Убедитесь, что такой ID есть в ALL_ACHIEVEMENTS
    if (!currentIds.includes(firstStepId)) {
       // Находим достижение в списке, чтобы убедиться что оно существует
       const ach = ALL_ACHIEVEMENTS.find(a => a.id === firstStepId);
       if (ach) newAchievements.push(firstStepId);
    }

    // 2. Проверка дней вместе
    const milestones = [10, 30, 50, 100, 200, 300, 365, 500, 730, 1000];
    for (const milestone of milestones) {
      const achId = `days_${milestone}`; // Формат ID должен совпадать с relationshipService
      if (days >= milestone && !currentIds.includes(achId)) {
        const ach = ALL_ACHIEVEMENTS.find(a => a.id === achId);
        if (ach) newAchievements.push(achId);
      }
    }

    // Если есть новые достижения, сохраняем
    if (newAchievements.length > 0) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          unlockedAchievements: arrayUnion(...newAchievements)
        });
        Alert.alert('🎉 Новые достижения!', `Вы открыли: ${newAchievements.length} шт.`);
      } catch (e) {
        console.error("Ошибка обновления достижений", e);
      }
    }
    setIsCheckingAchievements(false);
  };

  // Вычисляем имя партнёра
  const localPartnerName = useMemo(() => {
    if (!localPartnerId) return null;
    const member = members.find(m => m.userId === localPartnerId);
    return member?.displayName || 'Партнер';
  }, [localPartnerId, members]);

  const hasRelationship = !!(localPartnerId && localStartDate);
  
  const daysCount = useMemo(() => {
    if (!localStartDate) return 0;
    const start = localStartDate.toDate().getTime();
    const diff = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  }, [localStartDate]);

  const handleUpdateProfile = async () => {
    if (!newDisplayName.trim() || !user) return;
    setIsProcessing(true);
    try {
      const { updateProfile } = require('firebase/auth');
      await updateProfile(user, { displayName: newDisplayName.trim() });
      await updateDoc(doc(db, 'users', user.uid), { displayName: newDisplayName.trim() });
      setEditProfileModalVisible(false); 
      await refreshUserData();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
    finally { setIsProcessing(false); }
  };

  const openRelationshipModal = () => {
    if (hasRelationship) {
      setTempDate(localStartDate!.toDate());
      setSelectedPartnerId(localPartnerId);
    } else {
      setTempDate(new Date());
      setSelectedPartnerId(null);
    }
    setRelationshipModalVisible(true);
  };

  const findPairDocId = async (uid1: string, uid2: string) => {
    const q = query(collection(db, 'pairs'), where('user1', 'in', [uid1, uid2]));
    const snap = await getDocs(q);
    const pairDoc = snap.docs.find((doc: any) => {
      const d = doc.data();
      return (d.user1 === uid1 && d.user2 === uid2) || (d.user1 === uid2 && d.user2 === uid1);
    });
    return pairDoc?.id;
  };

  const handleSaveRelationship = async () => {
    if (!user || !selectedPartnerId) {
      Alert.alert('Ошибка', 'Выберите партнера');
      return;
    }
    if (selectedPartnerId === user.uid) {
      Alert.alert('Ошибка', 'Нельзя выбрать себя');
      return;
    }

    setIsProcessing(true);
    try {
      const uids = [user.uid, selectedPartnerId].sort();
      const pairId = uids.join('_');
      const newTs = Timestamp.fromDate(tempDate);

      await setDoc(doc(db, 'pairs', pairId), {
        user1: uids[0],
        user2: uids[1],
        startDate: newTs,
      }, { merge: true });

      setRelationshipModalVisible(false);
      setIsRelationshipExpanded(true);
      // Принудительная проверка достижений после создания пары
      setTimeout(() => checkAndUnlockAchievements(myUnlockedIds), 1000);
      Alert.alert('Успешно', `Пара создана с ${localPartnerName}`);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRelationship = async () => {
    if (!user || !localPartnerId) return;
    Alert.alert('Разорвать отношения?', 'Данные о паре будут удалены.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          try {
            const pairId = await findPairDocId(user.uid, localPartnerId);
            if (pairId) {
              await deleteDoc(doc(db, 'pairs', pairId));
            }
          } catch (e: any) {
            Alert.alert('Ошибка', e.message);
          }
      }}
    ]);
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

  const handleShowCode = async () => {
    if (!userData?.familyId) return;
    try {
      const code = await generateInviteCode(userData.familyId);
      Alert.alert('Код приглашения', code);
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  };

  const handleLeaveFamily = () => {
    Alert.alert('Выйти из семьи?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => {
          if (!userData?.familyId || !user) return;
          await leaveFamily(user.uid, userData.familyId);
          await refreshUserData();
      }}
    ]);
  };

  const handleDeleteFamily = () => {
    Alert.alert('Удалить семью?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          if (!userData?.familyId || !user) return;
          await deleteFamily(userData.familyId, user.uid);
          await refreshUserData();
      }}
    ]);
  };

  const handleRemoveMember = (mid: string, name: string) => {
    Alert.alert(`Удалить ${name}?`, '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          if (!userData?.familyId || !user) return;
          await removeMember(mid, userData.familyId, user.uid);
      }}
    ]);
  };

  const handleChangeRole = async (role: 'admin' | 'member') => {
    if (!selectedMemberForRole || !userData?.familyId || !user) return;
    try {
      await changeMemberRole(selectedMemberForRole.userId, role, userData.familyId, user.uid);
      setRoleModalVisible(false); setSelectedMemberForRole(null);
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  };

  const handleLogout = async () => {
    Alert.alert('Выход', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => {
          await signOutUser();
          setTimeout(() => router.replace('/login'), 500);
      }}
    ]);
  };

  if (authLoading) return <ActivityIndicator size="large" style={{flex:1}} />;

  const milestones = [10, 30, 50, 100, 200, 300, 365, 500, 730, 1000];
  const getMilestoneData = (days: number) => {
    if (!localStartDate) return null;
    const start = localStartDate.toDate();
    const target = new Date(start);
    target.setDate(start.getDate() + days);
    return {
      days,
      label: days === 365 ? '1 год' : days === 730 ? '2 года' : days === 1000 ? '1000 дней' : `${days} дней`,
      date: target,
      isReached: daysCount >= days
    };
  };

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
        <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setIsRelationshipExpanded(!isRelationshipExpanded)}>
          <View style={styles.headerLeft}>
            <Ionicons name={hasRelationship ? "heart" : "heart-outline"} size={22} color={hasRelationship ? "#FF3B30" : "#999"} />
            <Text style={[styles.sectionTitle, {marginLeft: 10}]}>
              {hasRelationship ? `Вместе ${daysCount} дн.` : "Отношения"}
            </Text>
          </View>
          <Ionicons name={isRelationshipExpanded ? "chevron-up" : "chevron-down"} size={24} color="#999" />
        </TouchableOpacity>

        {isRelationshipExpanded && (
          <View style={styles.expandedContent}>
            {!hasRelationship ? (
              <View style={styles.emptyStateSmall}>
                <Text style={styles.emptyTextSmall}>Пара не выбрана</Text>
                <TouchableOpacity style={styles.linkBtn} onPress={openRelationshipModal}>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.linkBtnText}>Добавить пару</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.coupleRow}>
                  <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{userData?.displayName?.[0]||'?'}</Text></View>
                  <Ionicons name="arrow-forward" size={16} color="#ccc" style={{marginHorizontal:8}}/>
                  <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{localPartnerName?.[0]||'?'}</Text></View>
                  <View style={styles.daysBadge}><Text style={styles.daysBadgeText}>{daysCount} дн.</Text></View>
                </View>
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity style={styles.actionButtonSecondary} onPress={openRelationshipModal}>
                    <Ionicons name="calendar" size={18} color="#007AFF"/><Text style={styles.actionButtonText}>Изменить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButtonSecondary} onPress={()=>setMilestonesModalVisible(true)}>
                    <Ionicons name="trophy" size={18} color="#FF9500"/><Text style={styles.actionButtonText}>Этапы</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButtonSecondary, {borderColor: '#FF3B30'}]} onPress={handleDeleteRelationship}>
                    <Ionicons name="trash" size={18} color="#FF3B30"/><Text style={[styles.actionButtonText, {color: '#FF3B30'}]}>Удалить</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* ДОСТИЖЕНИЯ */}
      <View style={styles.sectionCard}>
        <TouchableOpacity style={styles.achievementsButton} onPress={()=>setAchievementsModalVisible(true)}>
          <View style={styles.achBtnLeft}>
            <Ionicons name="medal" size={24} color="#FFD700"/>
            <View style={styles.achBtnText}>
              <Text style={styles.achBtnTitle}>Мои достижения</Text>
              <Text style={styles.achBtnSub}>{myUnlockedIds.length} из {ALL_ACHIEVEMENTS.length}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999"/>
        </TouchableOpacity>
      </View>

      {/* СЕМЬЯ */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Семья</Text></View>
        {!userData?.familyId ? (
          <View style={styles.emptyStateSmall}>
            <Text style={styles.emptyTextSmall}>Нет семьи</Text>
            <View style={styles.buttonsRowSmall}>
              <TouchableOpacity style={styles.btnSmall} onPress={()=>setCreateModalVisible(true)}><Text style={styles.btnSmallText}>Создать</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnSmall, styles.btnSmallSec]} onPress={()=>setJoinModalVisible(true)}><Text style={[styles.btnSmallText,{color:'#007AFF'}]}>Войти</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.familyName}>{familyName}</Text>
            <View style={styles.membersList}>
              {loadingMembers ? <ActivityIndicator/> : members.length > 0 ? members.map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <View style={styles.mAvatar}><Text style={styles.mAvatarText}>{(m.displayName||'U')[0]}</Text></View>
                  <View style={styles.mInfo}>
                    <Text style={styles.mName}>{m.displayName}</Text>
                    <Text style={styles.mRole}>{m.role==='owner'?'Создатель':m.role==='admin'?'Админ':'Участник'}</Text>
                  </View>
                  {m.userId === user?.uid && <Text style={styles.meBadge}>Вы</Text>}
                  {m.userId !== user?.uid && members.find(x=>x.userId===user?.uid)?.role==='owner' && m.role!=='owner' && (
                    <TouchableOpacity onPress={()=>handleRemoveMember(m.userId, m.displayName||'')}><Ionicons name="close-circle" size={20} color="#FF3B30"/></TouchableOpacity>
                  )}
                </View>
              )) : <Text style={{color:'#999', padding:20}}>Пусто</Text>}
            </View>
            <View style={styles.familyActions}>
              <TouchableOpacity style={styles.familyActionBtn} onPress={handleShowCode}><Ionicons name="person-add" size={16} color="#007AFF"/><Text style={styles.familyActionText}>Код</Text></TouchableOpacity>
              <TouchableOpacity style={styles.familyActionBtn} onPress={handleLeaveFamily}><Ionicons name="log-out" size={16} color="#FF9500"/><Text style={[styles.familyActionText,{color:'#FF9500'}]}>Выйти</Text></TouchableOpacity>
              {members.find(m=>m.userId===user?.uid)?.role==='owner' && (
                <TouchableOpacity style={styles.familyActionBtn} onPress={handleDeleteFamily}><Ionicons name="trash" size={16} color="#FF3B30"/><Text style={[styles.familyActionText,{color:'#FF3B30'}]}>Удалить</Text></TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Ionicons name="power" size={20} color="#fff"/><Text style={styles.logoutText}>Выйти</Text></TouchableOpacity>
      <View style={{height:60}}/>

      {/* МОДАЛКИ */}
      <Modal visible={isRelationshipModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{hasRelationship ? 'Изменить отношения' : 'Новая пара'}</Text>
            {!hasRelationship && (
              <>
                <Text style={styles.label}>Партнер:</Text>
                <ScrollView style={{maxHeight:100, width:'100%', marginBottom:15, borderWidth:1, borderColor:'#eee', borderRadius:8}}>
                  {members.filter(m => m.userId !== user?.uid).map(m => (
                    <TouchableOpacity key={m.id} style={[styles.partnerOption, selectedPartnerId === m.userId && styles.partnerOptionActive]}
                      onPress={() => setSelectedPartnerId(m.userId)}>
                      <Text style={[styles.partnerOptionText, selectedPartnerId === m.userId && styles.partnerOptionTextActive]}>{m.displayName}</Text>
                      {selectedPartnerId === m.userId && <Ionicons name="checkmark-circle" size={20} color="#007AFF"/>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            {hasRelationship && (
              <View style={{alignItems: 'center', marginBottom: 15}}>
                <Text>Ваш партнёр: {localPartnerName}</Text>
              </View>
            )}
            <Text style={styles.label}>Дата начала:</Text>
            {!showDatePicker && (
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar" size={20} color="#007AFF" style={{marginRight:8}}/>
                <Text>{tempDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            )}
            {showDatePicker && (
              <DateTimePicker value={tempDate} mode="date" onChange={(e, d) => { setShowDatePicker(false); if (d) setTempDate(d); }}/>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setRelationshipModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRelationship} disabled={isProcessing || (!hasRelationship && !selectedPartnerId)} style={styles.confirmBtn}>
                {isProcessing ? <ActivityIndicator color="#fff"/> : <Text style={styles.confirmBtnText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isMilestonesModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Этапы</Text><TouchableOpacity onPress={()=>setMilestonesModalVisible(false)}><Ionicons name="close" size={24} color="#666"/></TouchableOpacity></View>
            <ScrollView style={{width:'100%', maxHeight:400}}>
              {milestones.map(days=>{
                const d=getMilestoneData(days); if(!d)return null;
                return (
                  <View key={days} style={styles.milestoneRow}>
                    <View style={[styles.milestoneIconBox,{backgroundColor:d.isReached?'#E8F5E9':'#F5F5F5'}]}>
                      <Ionicons name={d.isReached?"checkmark-circle":"lock-closed"} size={24} color={d.isReached?"#34C759":"#999"}/>
                    </View>
                    <View style={styles.milestoneInfo}>
                      <Text style={{fontWeight:'bold', color:d.isReached?'#333':'#999'}}>{d.label}</Text>
                      <Text style={{fontSize:12, color:'#666'}}>{d.isReached?'Было: ':'Будет: '}{d.date.toLocaleDateString()}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isAchievementsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Достижения</Text><TouchableOpacity onPress={()=>setAchievementsModalVisible(false)}><Ionicons name="close" size={24} color="#666"/></TouchableOpacity></View>
            <ScrollView style={{width:'100%', maxHeight:400}}>
              {ALL_ACHIEVEMENTS.map((ach: Achievement)=>{
                const ok = myUnlockedIds.includes(ach.id);
                return (
                  <View key={ach.id} style={[styles.achievementItem, ok&&styles.achievementItemUnlocked]}>
                    <View style={[styles.achIconBox,{backgroundColor:ok?`${ach.color}20`:'#eee'}]}>
                      <Ionicons name={(ok?ach.icon:'lock-closed') as any} size={24} color={ok?ach.color:'#999'}/>
                    </View>
                    <View style={styles.achInfo}>
                      <Text style={[styles.achTitle,!ok&&{color:'#999'}]}>{ach.title}</Text>
                      <Text style={[styles.achDesc,!ok&&{color:'#CCC'}]}>{ach.description}</Text>
                    </View>
                    {ok&&<Ionicons name="checkmark-circle" size={24} color="#34C759"/>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isCreateModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Семья</Text><TextInput style={styles.input} value={newFamilyName} onChangeText={setNewFamilyName}/><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setCreateModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleCreateFamily} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={isJoinModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Вход</Text><TextInput style={styles.input} value={inviteCodeInput} onChangeText={t=>setInviteCodeInput(t.toUpperCase())}/><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setJoinModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleJoinFamily} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={isEditProfileModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Имя</Text><TextInput style={styles.input} value={newDisplayName} onChangeText={setNewDisplayName}/><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setEditProfileModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleUpdateProfile} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={isRoleModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Роль</Text><TouchableOpacity style={styles.roleOption} onPress={()=>handleChangeRole('admin')}><Text style={styles.roleOptionText}>Админ</Text></TouchableOpacity><TouchableOpacity style={styles.roleOption} onPress={()=>handleChangeRole('member')}><Text style={styles.roleOptionText}>Юзер</Text></TouchableOpacity><TouchableOpacity onPress={()=>setRoleModalVisible(false)} style={styles.cancelBtnFull}><Text style={styles.cancelBtnText}>Закрыть</Text></TouchableOpacity></View></View></Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  profileCard: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 0, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  email: { fontSize: 13, color: '#666' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F8FF', padding: 10, borderRadius: 8, marginTop: 10 },
  editBtnText: { color: '#007AFF', fontWeight: '600', marginLeft: 6 },
  collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  expandedContent: { paddingHorizontal: 20, paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  emptyStateSmall: { alignItems: 'center', paddingVertical: 20 },
  emptyTextSmall: { color: '#999', marginBottom: 5, textAlign: 'center' },
  linkBtn: { flexDirection: 'row', backgroundColor: '#FF3B30', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center' },
  linkBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 4 },
  coupleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, marginBottom: 15 },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center' },
  miniAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#007AFF' },
  daysBadge: { marginLeft: 10, backgroundColor: '#FFF0F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FFCDD2' },
  daysBadgeText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 12 },
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  actionButtonSecondary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#EEE' },
  actionButtonText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: '#333' },
  achievementsButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  achBtnLeft: { flexDirection: 'row', alignItems: 'center' },
  achBtnText: { marginLeft: 12 },
  achBtnTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  achBtnSub: { fontSize: 12, color: '#999', marginTop: 2 },
  achievementItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  achievementItemUnlocked: { backgroundColor: '#FAFAFA', borderColor: '#34C759' },
  achIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  achInfo: { flex: 1 },
  achTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  achDesc: { fontSize: 13, color: '#666' },
  familyName: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#333', paddingHorizontal: 20, paddingTop: 20 },
  membersList: { marginTop: 5, paddingHorizontal: 20 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  mAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  mAvatarText: { fontSize: 14, fontWeight: 'bold', color: '#555' },
  mInfo: { flex: 1 },
  mName: { fontSize: 14, fontWeight: '500' },
  mRole: { fontSize: 11, color: '#999' },
  meBadge: { fontSize: 10, backgroundColor: '#4CD964', color: '#fff', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginRight: 8 },
  familyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: '#f0f0f0', paddingHorizontal: 20, paddingBottom: 20 },
  familyActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#EEE' },
  familyActionText: { marginLeft: 4, fontWeight: '600', fontSize: 12 },
  buttonsRowSmall: { flexDirection: 'row', gap: 10 },
  btnSmall: { backgroundColor: '#007AFF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnSmallSec: { backgroundColor: '#E5F1FF' },
  btnSmallText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  logoutBtn: { marginHorizontal: 16, backgroundColor: '#333', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, alignItems: 'center', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  label: { fontSize: 14, fontWeight: '600', color: '#666', alignSelf: 'flex-start', marginBottom: 8, marginTop: 5 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 15, backgroundColor: '#FAFAFA' },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#007AFF', borderRadius: 8, alignItems: 'center', marginLeft: 10 },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtnFull: { width: '100%', padding: 15, alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderColor: '#eee' },
  roleOption: { width: '100%', padding: 15, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center' },
  roleOptionText: { fontSize: 16, marginLeft: 10, flex: 1 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginVertical: 10, width: '100%', justifyContent: 'center' },
  partnerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  partnerOptionActive: { backgroundColor: '#F0F8FF' },
  partnerOptionText: { fontSize: 15, color: '#333' },
  partnerOptionTextActive: { fontWeight: 'bold', color: '#007AFF' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  milestoneIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  milestoneInfo: { flex: 1 },
});