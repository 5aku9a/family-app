import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { addTransaction } from '../../src/services/budgetService';
import { sendFamilyNotification } from '../../src/services/notificationService';
import { CATEGORIES_CONFIG } from '../../src/types/budget';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'expense' | 'income' | 'subscription';
}

export default function AddTransactionModal({ visible, onClose, onSuccess, initialMode = 'expense' }: Props) {
  const { user, userData } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'expense' | 'income' | 'subscription'>(initialMode as any);
  const [selectedKey, setSelectedKey] = useState<string>('');
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState(new Date().toISOString().split('T')[0]);

  const POPULAR_SERVICES = [
    { key: 'yandex_plus', name: 'Яндекс Плюс', color: '#FC3F1D', icon: 'play-circle' },
    { key: 'kinopoisk', name: 'Кинопоиск', color: '#FF6600', icon: 'film' },
    { key: 'spotify', name: 'Spotify', color: '#1DB954', icon: 'musical-notes' },
    { key: 'netflix', name: 'Netflix', color: '#B20710', icon: 'tv' },
    { key: 'youtube', name: 'YouTube Premium', color: '#FF0000', icon: 'logo-youtube' },
    { key: 'apple_music', name: 'Apple Music', color: '#FF2D55', icon: 'logo-apple' },
    { key: 'telegram', name: 'Telegram Premium', color: '#2AABEE', icon: 'send' },
    { key: 'other_sub', name: 'Другое', color: '#8E8E93', icon: 'star' },
  ];

  const INCOME_CATEGORIES = ['Зарплата', 'Премия', 'Подарок', 'Инвестиции', 'Возврат', 'Фриланс', 'Другое'];

  const EXPENSE_CATEGORIES = Object.keys(CATEGORIES_CONFIG).filter(
    cat => !['Зарплата', 'Премия', 'Подарок', 'Инвестиции', 'Возврат', 'Фриланс'].includes(cat)
  );

  useEffect(() => {
    if (visible) {
      setMode(initialMode as any);
      setAmount('');
      setComment('');
      setSelectedKey('');
      setError(null);
      setIsRecurring(false);
      setBillingPeriod('monthly');
      setNextBillingDate(new Date().toISOString().split('T')[0]);
      
      if (initialMode === 'income') setSelectedKey(INCOME_CATEGORIES[0]);
      else if (initialMode === 'subscription') setSelectedKey(POPULAR_SERVICES[0].key);
      else setSelectedKey(EXPENSE_CATEGORIES[0]);
    }
  }, [visible, initialMode]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!amount || !selectedKey || !user) {
      setError('Заполните сумму и выберите категорию');
      return;
    }

    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Введите корректную сумму');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let category = '';
      let serviceName = '';
      let finalComment = comment;
      let displayCategory = ''; 

      if (mode === 'income') {
        category = selectedKey;
        displayCategory = selectedKey;
      } else if (mode === 'subscription') {
        const service = POPULAR_SERVICES.find(s => s.key === selectedKey);
        category = 'Подписки'; 
        serviceName = service?.name || 'Сервис';
        displayCategory = serviceName; 
        finalComment = `${comment} (${serviceName})`.trim();
      } else {
        category = selectedKey;
        displayCategory = selectedKey;
      }

      const displayName = user.displayName || user.email?.split('@')[0] || 'Астронавт';
      const transactionData: any = {
        userId: user.uid,
        userName: displayName,
        familyId: userData?.familyId || '', 
        type: mode === 'income' ? 'income' : 'expense',
        amount: numAmount,
        category: displayCategory, 
        comment: finalComment,
        date: Timestamp.now(),
      };

      if (mode === 'subscription') {
        transactionData.isRecurring = true;
        transactionData.billingPeriod = billingPeriod;
        
        const dateObj = new Date(nextBillingDate);
        if (!isNaN(dateObj.getTime())) {
          transactionData.nextBillingDate = Timestamp.fromDate(dateObj);
        } else {
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          transactionData.nextBillingDate = Timestamp.fromDate(nextMonth);
        }
      }

      await addTransaction(transactionData);

      if (userData?.familyId) {
        if (mode === 'expense' && numAmount >= 5000) {
          await sendFamilyNotification(
            userData.familyId,
            'large_expense',
            'Крупный расход',
            `${displayName} потратил ${numAmount.toLocaleString()} ₽ на ${displayCategory}`,
            user.uid,
            displayName
          );
        } else if (mode === 'income' && numAmount >= 50000) {
          await sendFamilyNotification(
            userData.familyId,
            'large_income',
            'Крупное поступление',
            `${displayName} получил ${numAmount.toLocaleString()} ₽ (${displayCategory})`,
            user.uid,
            displayName
          );
        }
      }
      
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Ошибка сохранения:', err);
      setError(err.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const renderGrid = () => {
    if (mode === 'income') {
      return (
        <View style={styles.categoriesGrid}>
          {INCOME_CATEGORIES.map((cat) => {
            const config = CATEGORIES_CONFIG[cat] || { icon: 'cash', color: '#34C759' };
            const isSelected = selectedKey === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.catItem, 
                  isSelected && { backgroundColor: `${config.color}20`, borderColor: config.color }
                ]}
                onPress={() => setSelectedKey(cat)}
              >
                <Ionicons name={config.icon as any} size={24} color={isSelected ? config.color : '#64748B'} />
                <Text style={[styles.catText, isSelected && { color: config.color, fontWeight: 'bold' }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (mode === 'subscription') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesScroll}>
          {POPULAR_SERVICES.map((s) => {
            const isSelected = selectedKey === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.serviceChip, 
                  isSelected && { borderColor: s.color, backgroundColor: `${s.color}20` }
                ]}
                onPress={() => setSelectedKey(s.key)}
              >
                <Ionicons name={s.icon as any} size={24} color={isSelected ? s.color : '#64748B'} />
                <Text style={[styles.serviceChipText, isSelected && { color: s.color, fontWeight: 'bold' }]}>{s.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    }

    return (
      <View style={styles.categoriesGrid}>
        {EXPENSE_CATEGORIES.map((cat) => {
          const config = CATEGORIES_CONFIG[cat] || { icon: 'cart', color: '#FF9500' };
          const isSelected = selectedKey === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catItem, 
                isSelected && { backgroundColor: `${config.color}20`, borderColor: config.color }
              ]}
              onPress={() => setSelectedKey(cat)}
            >
              <Ionicons name={config.icon as any} size={24} color={isSelected ? config.color : '#ffffff'} />
              <Text style={[styles.catText, isSelected && { color: config.color, fontWeight: 'bold' }]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={[styles.modal, { paddingBottom: Math.max(20, insets.bottom) }]}>
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {mode === 'income' ? 'Приход ресурсов' : mode === 'subscription' ? 'Новая подписка' : 'Расход ресурсов'}
            </Text>
            <TouchableOpacity onPress={handleClose}><Ionicons name="close" size={28} color="#ffffff" /></TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            
            <View style={styles.modeSelector}>
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'expense' && styles.modeBtnActive]} 
                onPress={() => { setMode('expense'); setSelectedKey(EXPENSE_CATEGORIES[0]); }}
              >
                <Text style={mode === 'expense' ? styles.modeTextActive : styles.modeText}>Расход</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'subscription' && styles.modeBtnActive]} 
                onPress={() => { setMode('subscription'); setSelectedKey(POPULAR_SERVICES[0].key); }}
              >
                <Text style={mode === 'subscription' ? styles.modeTextActive : styles.modeText}>Подписка</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modeBtn, mode === 'income' && styles.modeBtnActive]} 
                onPress={() => { setMode('income'); setSelectedKey(INCOME_CATEGORIES[0]); }}
              >
                <Text style={mode === 'income' ? styles.modeTextActive : styles.modeText}>Доход</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.amountInput}
              placeholder="0 ₽"
              placeholderTextColor="#707985"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(text) => { setAmount(text); setError(null); }}
              autoFocus
            />

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>
              {mode === 'income' ? 'Источник' : mode === 'subscription' ? 'Сервис' : 'Категория'}
            </Text>
            
            {renderGrid()}

            {mode === 'subscription' && (
              <View style={styles.recurringSection}>
                <Text style={styles.subLabel}>Периодичность:</Text>
                <View style={styles.periodRow}>
                  <TouchableOpacity 
                    style={[styles.periodBtn, billingPeriod === 'monthly' && styles.periodBtnActive]} 
                    onPress={() => setBillingPeriod('monthly')}
                  >
                    <Text style={billingPeriod === 'monthly' ? styles.periodTextActive : styles.periodText}>Ежемесячно</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.periodBtn, billingPeriod === 'yearly' && styles.periodBtnActive]} 
                    onPress={() => setBillingPeriod('yearly')}
                  >
                    <Text style={billingPeriod === 'yearly' ? styles.periodTextActive : styles.periodText}>Ежегодно</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.subLabel}>Дата следующего списания:</Text>
                <TextInput 
                  style={styles.dateInput} 
                  value={nextBillingDate} 
                  onChangeText={setNextBillingDate} 
                  placeholder="YYYY-MM-DD" 
                  placeholderTextColor="#707985"
                />
              </View>
            )}

            <Text style={styles.label}>Комментарий</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Например: Семейный тариф"
              placeholderTextColor="#707985"
              value={comment}
              onChangeText={setComment}
            />

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveText}>Сохранить</Text>}
            </TouchableOpacity>
            
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modal: { backgroundColor: '#0F172A', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#E2E8F0' },
  
  formContainer: { padding: 20 },
  
  modeSelector: { flexDirection: 'row', marginBottom: 20, padding: 4, backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  modeBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  modeBtnActive: { backgroundColor: 'rgba(0, 240, 255, 0.15)', borderColor: 'rgba(0, 240, 255, 0.3)', borderWidth: 1 },
  modeText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  modeTextActive: { color: '#00F0FF', fontWeight: 'bold' },
  
  amountInput: { fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#fff', letterSpacing: 1 },
  
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: 10, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.2)' },
  errorText: { color: '#FF3B30', marginLeft: 8, fontSize: 14 },

  label: { fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catItem: { width: '30%', alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: 'rgba(30, 41, 59, 0.4)', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  catText: { marginTop: 5, fontSize: 12, color: '#94A3B8', textAlign: 'center', fontWeight: '500' },
  
  servicesScroll: { maxHeight: 70, marginBottom: 10 },
  serviceChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(30, 41, 59, 0.4)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  serviceChipText: { marginLeft: 6, fontSize: 13, color: '#94A3B8' },
  
  commentInput: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14, fontSize: 16, marginBottom: 20, backgroundColor: 'rgba(15, 23, 42, 0.5)', color: '#E2E8F0' },
  
  saveBtn: { backgroundColor: '#00F0FF', padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#00F0FF', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { color: '#0F172A', fontSize: 18, fontWeight: 'bold' },

  recurringSection: { backgroundColor: 'rgba(255, 149, 0, 0.1)', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.2)' },
  subLabel: { fontSize: 13, fontWeight: '600', color: '#FF9500', marginBottom: 6, marginTop: 8 },
  periodRow: { flexDirection: 'row', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.2)' },
  periodBtn: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#FF9500' },
  periodText: { fontSize: 13, color: '#94A3B8' },
  periodTextActive: { fontSize: 13, color: '#0F172A', fontWeight: 'bold' },
  dateInput: { borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.2)', borderRadius: 12, padding: 10, fontSize: 14, backgroundColor: 'rgba(15, 23, 42, 0.5)', color: '#E2E8F0' },
});