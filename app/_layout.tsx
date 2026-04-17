import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

function RootLayoutNav() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {user ? (
        // Если пользователь вошел - показываем табы
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      ) : (
        // Если нет - показываем экран входа
        <>
          <Stack.Screen name="login" options={{ title: 'Вход' }} />
          <Stack.Screen name="register" options={{ title: 'Регистрация' }} />
        </>
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}