import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { arrayUnion, collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { changeMemberRole, createFamily, deleteFamily, generateInviteCode, joinFamily, leaveFamily, removeMember } from '../../src/services/familyService';
import { db } from '../../src/services/firebase';
import { ALL_ACHIEVEMENTS } from '../../src/services/relationshipService';
import { FamilyMember } from '../../src/types/family';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, userData, loading: authLoading, refreshUserData, signOutUser } = useAuth();
  const insets = useSafeAreaInsets(); // Отступы для челки и нижней панели

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

  // Генерация звезд
  const [stars, setStars] = useState<{id: number, top: number, left: number, size: number, opacity: number}[]>([]);
  useEffect(() => {
    const newStars = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      top: Math.random() * height,
      left: Math.random() * width,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.7 + 0.3,
    }));
    setStars(newStars);
  }, []);

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

  // 3. Подписка на пару
  useEffect(() => {
    if (!user) return;
    const q1 = query(collection(db, 'pairs'), where('user1', '==', user.uid));
    const q2 = query(collection(db, 'pairs'), where('user2', '==', user.uid));

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

    const unsub1 = onSnapshot(q1, handleSnapshot);
    const unsub2 = onSnapshot(q2, (snap) => {
       if (!snap.empty) handleSnapshot(snap);
    });

    return () => { unsub1(); unsub2(); };
  }, [user]);

  // 4. Подписка на достижения и проверка
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const unlocked = docSnap.data()?.unlockedAchievements || [];
        const currentIds = Array.isArray(unlocked) ? unlocked : [];
        setMyUnlockedIds(currentIds);
        
        if (!isCheckingAchievements && localStartDate) {
           checkAndUnlockAchievements(currentIds);
        }
      }
    });
    return () => unsub();
  }, [user, localStartDate, isCheckingAchievements]);

  const checkAndUnlockAchievements = async (currentIds: string[]) => {
    if (!localStartDate || !user) return;
    
    setIsCheckingAchievements(true);
    const newAchievements: string[] = [];
    const days = Math.floor((Date.now() - localStartDate.toDate().getTime()) / (1000 * 60 * 60 * 24));

    if (days >= 7 && !currentIds.includes('first_week')) newAchievements.push('first_week');
    if (days >= 30 && !currentIds.includes('first_month')) newAchievements.push('first_month');
    
    if (!currentIds.includes('first_step')) {
       if (ALL_ACHIEVEMENTS.find(a => a.id === 'first_step')) {
          newAchievements.push('first_step');
       }
    }

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
            if (pairId) await deleteDoc(doc(db, 'pairs', pairId));
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

  if (authLoading) return <ActivityIndicator size="large" color="#00F0FF" style={{flex:1, backgroundColor: '#0B1120'}} />;

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
    <View style={styles.container}>
      {/* Звездный фон */}
      {stars.map(star => (
        <View
          key={star.id}
          style={[
            styles.star,
            { top: star.top, left: star.left, width: star.size, height: star.size, opacity: star.opacity }
          ]}
        />
      ))}

      <ScrollView 
        // ДОБАВЛЕНО: paddingTop для учета челки
        contentContainerStyle={{ 
          paddingTop: insets.top, 
          paddingBottom: 100 + insets.bottom 
        }}
        showsVerticalScrollIndicator={false}
      >
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
            <Ionicons name="create-outline" size={18} color="#00F0FF" /><Text style={styles.editBtnText}>Изменить имя</Text>
          </TouchableOpacity>
        </View>

        {/* ОТНОШЕНИЯ */}
        <View style={styles.sectionCard}>
          <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setIsRelationshipExpanded(!isRelationshipExpanded)}>
            <View style={styles.headerLeft}>
              <Ionicons name={hasRelationship ? "heart" : "heart-outline"} size={22} color={hasRelationship ? "#FF3B30" : "#64748B"} />
              <Text style={[styles.sectionTitle, {marginLeft: 10, color: '#E2E8F0'}]}>
                {hasRelationship ? `Вместе ${daysCount} дн.` : "Отношения"}
              </Text>
            </View>
            <Ionicons name={isRelationshipExpanded ? "chevron-up" : "chevron-down"} size={24} color="#94A3B8" />
          </TouchableOpacity>

          {isRelationshipExpanded && (
            <View style={styles.expandedContent}>
              {!hasRelationship ? (
                <View style={styles.emptyStateSmall}>
                  <Text style={styles.emptyTextSmall}>Пара не выбрана</Text>
                  <TouchableOpacity style={styles.linkBtn} onPress={openRelationshipModal}>
                    <Ionicons name="add-circle" size={20} color="#0B1120" />
                    <Text style={styles.linkBtnText}>Добавить пару</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.coupleRow}>
                    <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{userData?.displayName?.[0]||'?'}</Text></View>
                    <Ionicons name="arrow-forward" size={16} color="#64748B" style={{marginHorizontal:8}}/>
                    <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{localPartnerName?.[0]||'?'}</Text></View>
                    <View style={styles.daysBadge}><Text style={styles.daysBadgeText}>{daysCount} дн.</Text></View>
                  </View>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity style={styles.actionButtonSecondary} onPress={openRelationshipModal}>
                      <Ionicons name="calendar" size={18} color="#00F0FF"/><Text style={styles.actionButtonText}>Изменить</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButtonSecondary} onPress={()=>setMilestonesModalVisible(true)}>
                      <Ionicons name="trophy" size={18} color="#FFD700"/><Text style={styles.actionButtonText}>Этапы</Text>
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
            <Ionicons name="chevron-forward" size={20} color="#94A3B8"/>
          </TouchableOpacity>
        </View>

        {/* СЕМЬЯ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, {color: '#E2E8F0'}]}>Семья</Text></View>
          {!userData?.familyId ? (
            <View style={styles.emptyStateSmall}>
              <Text style={styles.emptyTextSmall}>Нет семьи</Text>
              <View style={styles.buttonsRowSmall}>
                <TouchableOpacity style={styles.btnSmall} onPress={()=>setCreateModalVisible(true)}><Text style={styles.btnSmallText}>Создать</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnSmall, styles.btnSmallSec]} onPress={()=>setJoinModalVisible(true)}><Text style={[styles.btnSmallText,{color:'#00F0FF'}]}>Войти</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.familyName, {color: '#94A3B8'}]}>{familyName}</Text>
              <View style={styles.membersList}>
                {loadingMembers ? <ActivityIndicator color="#00F0FF"/> : members.length > 0 ? members.map(m => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={styles.mAvatar}><Text style={styles.mAvatarText}>{(m.displayName||'U')[0]}</Text></View>
                    <View style={styles.mInfo}>
                      <Text style={[styles.mName, {color: '#E2E8F0'}]}>{m.displayName}</Text>
                      <Text style={styles.mRole}>{m.role==='owner'?'Создатель':m.role==='admin'?'Админ':'Участник'}</Text>
                    </View>
                    {m.userId === user?.uid && <Text style={styles.meBadge}>Вы</Text>}
                    {m.userId !== user?.uid && members.find(x=>x.userId===user?.uid)?.role==='owner' && m.role!=='owner' && (
                      <TouchableOpacity onPress={()=>handleRemoveMember(m.userId, m.displayName||'')}><Ionicons name="close-circle" size={20} color="#FF3B30"/></TouchableOpacity>
                    )}
                  </View>
                )) : <Text style={{color:'#64748B', padding:20}}>Пусто</Text>}
              </View>
              <View style={styles.familyActions}>
                <TouchableOpacity style={styles.familyActionBtn} onPress={handleShowCode}><Ionicons name="person-add" size={16} color="#00F0FF"/><Text style={styles.familyActionText}>Код</Text></TouchableOpacity>
                <TouchableOpacity style={styles.familyActionBtn} onPress={handleLeaveFamily}><Ionicons name="log-out" size={16} color="#FF9500"/><Text style={[styles.familyActionText,{color:'#FF9500'}]}>Выйти</Text></TouchableOpacity>
                {members.find(m=>m.userId===user?.uid)?.role==='owner' && (
                  <TouchableOpacity style={styles.familyActionBtn} onPress={handleDeleteFamily}><Ionicons name="trash" size={16} color="#FF3B30"/><Text style={[styles.familyActionText,{color:'#FF3B30'}]}>Удалить</Text></TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Ionicons name="power" size={20} color="#fff"/><Text style={styles.logoutText}>Выйти</Text></TouchableOpacity>
        
        {/* FOOTER: Created by 5aku9a */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Created by </Text>
          <Text style={styles.footerHighlight}>5aku9a</Text>
        </View>

        <View style={{height: 20}}/>
      </ScrollView>

      {/* МОДАЛКИ (стили обновлены ниже) */}
      <Modal visible={isRelationshipModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{hasRelationship ? 'Изменить отношения' : 'Новая пара'}</Text>
            {!hasRelationship && (
              <>
                <Text style={styles.label}>Партнер:</Text>
                <ScrollView style={{maxHeight:100, width:'100%', marginBottom:15, borderWidth:1, borderColor:'#334155', borderRadius:8}}>
                  {members.filter(m => m.userId !== user?.uid).map(m => (
                    <TouchableOpacity key={m.id} style={[styles.partnerOption, selectedPartnerId === m.userId && styles.partnerOptionActive]}
                      onPress={() => setSelectedPartnerId(m.userId)}>
                      <Text style={[styles.partnerOptionText, selectedPartnerId === m.userId && styles.partnerOptionTextActive]}>{m.displayName}</Text>
                      {selectedPartnerId === m.userId && <Ionicons name="checkmark-circle" size={20} color="#00F0FF"/>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            {hasRelationship && (
              <View style={{alignItems: 'center', marginBottom: 15}}>
                <Text style={{color: '#E2E8F0'}}>Ваш партнёр: {localPartnerName}</Text>
              </View>
            )}
            <Text style={styles.label}>Дата начала:</Text>
            {!showDatePicker && (
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar" size={20} color="#00F0FF" style={{marginRight:8}}/>
                <Text style={{color: '#E2E8F0'}}>{tempDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            )}
            {showDatePicker && (
              <DateTimePicker value={tempDate} mode="date" onChange={(e, d) => { setShowDatePicker(false); if (d) setTempDate(d); }} textColor="#E2E8F0" />
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setRelationshipModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRelationship} disabled={isProcessing || (!hasRelationship && !selectedPartnerId)} style={styles.confirmBtn}>
                {isProcessing ? <ActivityIndicator color="#0B1120"/> : <Text style={styles.confirmBtnText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isMilestonesModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Этапы</Text><TouchableOpacity onPress={()=>setMilestonesModalVisible(false)}><Ionicons name="close" size={24} color="#94A3B8"/></TouchableOpacity></View>
            <ScrollView style={{width:'100%', maxHeight:400}}>
              {milestones.map(days=>{
                const d=getMilestoneData(days); if(!d)return null;
                return (
                  <View key={days} style={styles.milestoneRow}>
                    <View style={[styles.milestoneIconBox,{backgroundColor:d.isReached?'rgba(52, 199, 89, 0.2)':'rgba(100, 116, 139, 0.2)'}]}>
                      <Ionicons name={d.isReached?"checkmark-circle":"lock-closed"} size={24} color={d.isReached?"#4CD964":"#64748B"}/>
                    </View>
                    <View style={styles.milestoneInfo}>
                      <Text style={{fontWeight:'bold', color:d.isReached?'#E2E8F0':'#64748B'}}>{d.label}</Text>
                      <Text style={{fontSize:12, color:'#94A3B8'}}>{d.isReached?'Было: ':'Будет: '}{d.date.toLocaleDateString()}</Text>
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
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Достижения</Text><TouchableOpacity onPress={()=>setAchievementsModalVisible(false)}><Ionicons name="close" size={24} color="#94A3B8"/></TouchableOpacity></View>
            <ScrollView style={{width:'100%', maxHeight:400}}>
              {ALL_ACHIEVEMENTS.map((ach)=>{
                const ok = myUnlockedIds.includes(ach.id);
                return (
                  <View key={ach.id} style={[styles.achievementItem, ok&&styles.achievementItemUnlocked]}>
                    <View style={[styles.achIconBox,{backgroundColor:ok?`${ach.color}20`:'#1E293B'}]}>
                      <Ionicons name={(ok?ach.icon:'lock-closed') as any} size={24} color={ok?ach.color:'#64748B'}/>
                    </View>
                    <View style={styles.achInfo}>
                      <Text style={[styles.achTitle,!ok&&{color:'#64748B'}]}>{ach.title}</Text>
                      <Text style={[styles.achDesc,!ok&&{color:'#475569'}]}>{ach.description}</Text>
                    </View>
                    {ok&&<Ionicons name="checkmark-circle" size={24} color="#4CD964"/>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Остальные модалки */}
      <Modal visible={isCreateModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Семья</Text><TextInput style={styles.input} value={newFamilyName} onChangeText={setNewFamilyName} placeholderTextColor="#64748B" /><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setCreateModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleCreateFamily} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={isJoinModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Вход</Text><TextInput style={styles.input} value={inviteCodeInput} onChangeText={t=>setInviteCodeInput(t.toUpperCase())} placeholderTextColor="#64748B" /><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setJoinModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleJoinFamily} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={isEditProfileModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Имя</Text><TextInput style={styles.input} value={newDisplayName} onChangeText={setNewDisplayName} placeholderTextColor="#64748B" /><View style={styles.modalButtons}><TouchableOpacity onPress={()=>setEditProfileModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Отмена</Text></TouchableOpacity><TouchableOpacity onPress={handleUpdateProfile} style={styles.confirmBtn}><Text style={styles.confirmBtnText}>ОК</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={isRoleModalVisible} transparent><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Роль</Text><TouchableOpacity style={styles.roleOption} onPress={()=>handleChangeRole('admin')}><Text style={styles.roleOptionText}>Админ</Text></TouchableOpacity><TouchableOpacity style={styles.roleOption} onPress={()=>handleChangeRole('member')}><Text style={styles.roleOptionText}>Юзер</Text></TouchableOpacity><TouchableOpacity onPress={()=>setRoleModalVisible(false)} style={styles.cancelBtnFull}><Text style={styles.cancelBtnText}>Закрыть</Text></TouchableOpacity></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  star: { position: 'absolute', backgroundColor: '#fff', borderRadius: 50 },
  
  profileCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', margin: 16, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sectionCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#00F0FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#0B1120' },
  userInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#E2E8F0' },
  email: { fontSize: 13, color: '#94A3B8' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 240, 255, 0.1)', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: 'rgba(0, 240, 255, 0.2)' },
  editBtnText: { color: '#00F0FF', fontWeight: '600', marginLeft: 6 },
  
  collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  expandedContent: { paddingHorizontal: 20, paddingBottom: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  emptyStateSmall: { alignItems: 'center', paddingVertical: 20 },
  emptyTextSmall: { color: '#94A3B8', marginBottom: 5, textAlign: 'center' },
  linkBtn: { flexDirection: 'row', backgroundColor: '#00F0FF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center' },
  linkBtnText: { color: '#0B1120', fontWeight: 'bold', marginLeft: 4 },
  
  coupleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, marginBottom: 15 },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 240, 255, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 240, 255, 0.3)' },
  miniAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#00F0FF' },
  daysBadge: { marginLeft: 10, backgroundColor: 'rgba(255, 59, 48, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.3)' },
  daysBadgeText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 12 },
  
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  actionButtonSecondary: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.5)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  actionButtonText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: '#E2E8F0' },
  
  achievementsButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  achBtnLeft: { flexDirection: 'row', alignItems: 'center' },
  achBtnText: { marginLeft: 12 },
  achBtnTitle: { fontSize: 16, fontWeight: 'bold', color: '#E2E8F0' },
  achBtnSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  
  achievementItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  achievementItemUnlocked: { backgroundColor: 'rgba(0, 240, 255, 0.05)', borderColor: 'rgba(52, 199, 89, 0.3)' },
  achIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  achInfo: { flex: 1 },
  achTitle: { fontSize: 16, fontWeight: 'bold', color: '#E2E8F0', marginBottom: 4 },
  achDesc: { fontSize: 13, color: '#94A3B8' },
  
  familyName: { fontSize: 16, fontWeight: '600', marginBottom: 10, paddingHorizontal: 20, paddingTop: 20 },
  membersList: { marginTop: 5, paddingHorizontal: 20 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  mAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  mAvatarText: { fontSize: 14, fontWeight: 'bold', color: '#E2E8F0' },
  mInfo: { flex: 1 },
  mName: { fontSize: 14, fontWeight: '500' },
  mRole: { fontSize: 11, color: '#64748B' },
  meBadge: { fontSize: 10, backgroundColor: '#4CD964', color: '#0B1120', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginRight: 8, fontWeight: 'bold' },
  
  familyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 20, paddingBottom: 20 },
  familyActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  familyActionText: { marginLeft: 4, fontWeight: '600', fontSize: 12, color: '#E2E8F0' },
  
  buttonsRowSmall: { flexDirection: 'row', gap: 10 },
  btnSmall: { backgroundColor: '#00F0FF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnSmallSec: { backgroundColor: 'rgba(0, 240, 255, 0.1)', borderWidth: 1, borderColor: 'rgba(0, 240, 255, 0.3)' },
  btnSmallText: { color: '#0B1120', fontWeight: 'bold', fontSize: 12 },
  
  logoutBtn: { marginHorizontal: 16, backgroundColor: '#EF4444', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  logoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },

  // Footer Styles
  footerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, opacity: 0.6 },
  footerText: { fontSize: 12, color: '#64748B', fontWeight: '400' },
  footerHighlight: { fontSize: 12, color: '#00F0FF', fontWeight: '700', letterSpacing: 0.5, textShadowColor: 'rgba(0, 240, 255, 0.5)', textShadowOffset: {width: 0, height: 0}, textShadowRadius: 4 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1E293B', width: '85%', borderRadius: 16, padding: 20, alignItems: 'center', maxHeight: '85%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#E2E8F0', marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#94A3B8', alignSelf: 'flex-start', marginBottom: 8, marginTop: 5 },
  input: { width: '100%', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, marginBottom: 15, backgroundColor: '#0F172A', color: '#E2E8F0' },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#94A3B8', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#00F0FF', borderRadius: 8, alignItems: 'center', marginLeft: 10 },
  confirmBtnText: { color: '#0B1120', fontWeight: 'bold' },
  cancelBtnFull: { width: '100%', padding: 15, alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderColor: '#334155' },
  roleOption: { width: '100%', padding: 15, borderBottomWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center' },
  roleOptionText: { fontSize: 16, marginLeft: 10, flex: 1, color: '#E2E8F0' },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#0F172A', borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginVertical: 10, width: '100%', justifyContent: 'center' },
  partnerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  partnerOptionActive: { backgroundColor: 'rgba(0, 240, 255, 0.1)' },
  partnerOptionText: { fontSize: 15, color: '#E2E8F0' },
  partnerOptionTextActive: { fontWeight: 'bold', color: '#00F0FF' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  milestoneIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  milestoneInfo: { flex: 1 },
});