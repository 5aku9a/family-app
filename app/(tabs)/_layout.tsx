import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Высота таб-бара: база 60 + отступ снизу
  const tabBarHeight = 60 + Math.max(20, insets.bottom);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          height: tabBarHeight,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 8,
          position: 'absolute',
          left: 0,
          right: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      {/* Расписание */}
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Расписание',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={24} color={color} />,
        }}
      />
      
      {/* Финансы */}
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Финансы',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={24} color={color} />,
        }}
      />

      {/* ГЛАВНАЯ (ЦЕНТРАЛЬНАЯ КНОПКА) */}
      <Tabs.Screen
        name="index"
        options={{
          title: '', // Скрываем текст
          tabBarIcon: ({ focused }) => (
            <View style={styles.centerButtonContainer}>
              <View style={[styles.centerButton, focused ? styles.centerButtonFocused : styles.centerButtonDefault]}>
                <Ionicons name="home" size={28} color="#fff" />
              </View>
            </View>
          ),
        }}
      />

      {/* Чат */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Чат',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={24} color={color} />,
        }}
      />

      {/* Профиль */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerButtonContainer: {
    top: -20, // Поднимаем кнопку над баром
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#fff', // Белая обводка для отделения от фона
  },
  centerButtonDefault: {
    backgroundColor: '#8E8E93', // Серый в неактивном состоянии
  },
  centerButtonFocused: {
    backgroundColor: '#007AFF', // Синий в активном состоянии
    transform: [{ scale: 1.05 }], // Легкое увеличение при выборе
  },
});