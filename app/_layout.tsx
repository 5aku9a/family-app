import { useFonts } from 'expo-font';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

// Предотвращаем автоматическое скрытие сплеш-скрина
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { user, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Скрываем сплеш-скрин только когда загрузка завершена И шрифты загружены
    if (!loading && fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading, fontsLoaded]);

  // Пока идет загрузка или шрифты не готовы — показываем индикатор
  if (loading || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F0FF" />
        <Text style={styles.loadingText}>Запуск систем...</Text>
      </View>
    );
  }

  // Если пользователь не авторизован — редирект на логин
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Если все ок — показываем приложение
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="finance/add" options={{ presentation: 'modal' }} />
      <Stack.Screen name="schedule/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B1120',
  },
  loadingText: {
    color: '#00F0FF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
});