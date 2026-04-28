import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { createFamily, joinFamily } from '../../src/services/familyService';

export default function FamilySetupScreen() {
  const { user, userData } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!familyName.trim() || !user || !userData) return;
    setLoading(true);
    try {
      await createFamily(familyName.trim(), user.uid, userData.email, userData.displayName);
      router.replace('/(tabs)'); 
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать семью');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim() || !user || !userData) return;
    setLoading(true);
    try {
      await joinFamily(inviteCode.trim().toUpperCase(), user.uid, userData.email, userData.displayName);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Код неверен или истек');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Ionicons name="people-circle" size={80} color="#007AFF" />
          <Text style={styles.title}>Настройка семьи</Text>
          <Text style={styles.subtitle}>
            {mode === 'create' 
              ? 'Введите фамилию или название вашей семьи, чтобы начать вести общий бюджет.' 
              : 'Введите код приглашения от главы семьи.'}
          </Text>
        </View>

        {mode === 'create' ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Например: Ивановы"
              value={familyName}
              onChangeText={setFamilyName}
              autoFocus
            />
            <TouchableOpacity 
              style={[styles.btnPrimary, (!familyName || loading) && styles.btnDisabled]} 
              onPress={handleCreate}
              disabled={!familyName || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Создать семью</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.inputCode}
              placeholder="ABC123"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={6}
              keyboardType="default"
              autoFocus
            />
            <TouchableOpacity 
              style={[styles.btnPrimary, (!inviteCode || loading) && styles.btnDisabled]} 
              onPress={handleJoin}
              disabled={!inviteCode || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Вступить</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.switchContainer}>
          <Text style={styles.switchText}>
            {mode === 'create' ? 'Уже есть код приглашения?' : 'Нет кода?'}
          </Text>
          <TouchableOpacity onPress={() => {
            setMode(mode === 'create' ? 'join' : 'create');
            setFamilyName('');
            setInviteCode('');
          }}>
            <Text style={styles.switchLink}>
              {mode === 'create' ? 'Вступить по коду' : 'Создать новую'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', marginTop: 15, color: '#333' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginTop: 10, lineHeight: 22 },
  form: { gap: 15 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 16, borderRadius: 12, fontSize: 18, backgroundColor: '#f9f9f9' },
  inputCode: { borderWidth: 1, borderColor: '#ddd', padding: 16, borderRadius: 12, fontSize: 24, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4, backgroundColor: '#f9f9f9' },
  btnPrimary: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  switchContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  switchText: { color: '#666', fontSize: 16 },
  switchLink: { color: '#007AFF', fontSize: 16, fontWeight: '600', marginLeft: 5 },
});