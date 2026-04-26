import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Dimensions,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { auth } from '../src/services/firebase';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Если уже авторизован - сразу кидаем в приложение
  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Редирект сработает через useEffect при изменении user
    } catch (e: any) {
      let errorMessage = 'Ошибка при входе';

      if (e.code === 'auth/user-not-found') {
        errorMessage = 'Пользователь не найден';
      } else if (e.code === 'auth/wrong-password') {
        errorMessage = 'Неверный пароль';
      } else if (e.code === 'auth/invalid-email') {
        errorMessage = 'Некорректный email';
      } else if (e.code === 'auth/user-disabled') {
        errorMessage = 'Аккаунт заблокирован';
      } else if (e.code === 'auth/too-many-requests') {
        errorMessage = 'Слишком много попыток. Попробуйте позже.';
      }

      Alert.alert('Ошибка входа', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Звездный фон (декор) */}
      <View style={styles.starField}>
        {[...Array(30)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.star,
              {
                top: Math.random() * height,
                left: Math.random() * width,
                width: Math.random() * 2 + 1,
                height: Math.random() * 2 + 1,
                opacity: Math.random(),
              },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Логотип */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Ionicons name="rocket" size={50} color="#00F0FF" />
            </View>
            <Text style={styles.title}>FamilySpace</Text>
            <Text style={styles.subtitle}>Вход на борт</Text>
          </View>

          {/* Форма */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={22} color="#5E6C85" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#5E6C85"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={22} color="#5E6C85" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Пароль"
                placeholderTextColor="#5E6C85"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0B1120" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>ВОЙТИ</Text>
                  <Ionicons name="arrow-forward" size={20} color="#0B1120" style={{marginLeft: 8}} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.registerBtn} 
              onPress={() => router.push('/register')}
            >
              <Text style={styles.registerText}>Нет аккаунта? </Text>
              <Text style={styles.registerLink}>Создать</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120', position: 'relative' },
  starField: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 },
  star: { position: 'absolute', backgroundColor: '#fff', borderRadius: 99 },
  content: { flex: 1, zIndex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  
  header: { alignItems: 'center', marginBottom: 40 },
  logoBox: { 
    width: 90, height: 90, borderRadius: 45, 
    backgroundColor: 'rgba(0, 240, 255, 0.1)', 
    justifyContent: 'center', alignItems: 'center', 
    marginBottom: 20, 
    borderWidth: 2, borderColor: 'rgba(0, 240, 255, 0.3)',
    shadowColor: '#00F0FF', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', letterSpacing: 1, marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center' },

  formCard: { 
    backgroundColor: 'rgba(30, 41, 59, 0.7)', 
    borderRadius: 24, padding: 24, 
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15, elevation: 10
  },
  
  inputGroup: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: 'rgba(15, 23, 42, 0.8)', 
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, 
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' 
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#fff' },

  loginBtn: { 
    backgroundColor: '#00F0FF', 
    paddingVertical: 16, borderRadius: 16, 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    marginTop: 8, 
    shadowColor: '#00F0FF', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#0B1120', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },

  registerBtn: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  registerText: { color: '#94A3B8', fontSize: 14 },
  registerLink: { color: '#00F0FF', fontSize: 14, fontWeight: 'bold' },
});