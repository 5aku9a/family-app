import { Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from '../src/context/AuthContext';
import { auth } from '../src/services/firebase';

export default function RootLayout() {
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });
    return unsubscribe;
  }, []);

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{marginTop: 10}}>Проверка входа...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      {user ? (
        // Пользователь вошел -> Показываем Табы
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="family/setup" options={{ title: 'Семья' }} />
          <Stack.Screen name="budget/add" options={{ presentation: 'modal', title: 'Операция' }} />
        </Stack>
      ) : (
        // Пользователя нет -> Показываем Вход/Регу
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
      )}
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});