import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + Math.max(20, insets.bottom);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00F0FF',
        tabBarInactiveTintColor: '#5E6C85',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)', // Более плотный фон вместо blur
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          height: tabBarHeight,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 8,
          position: 'absolute',
          left: 0,
          right: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -5 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 4,
        },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Орбита',
          tabBarIcon: ({ color, size }) => <Ionicons name="planet-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Ресурсы',
          tabBarIcon: ({ color, size }) => <Ionicons name="diamond-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <View style={styles.centerButtonContainer}>
              <View style={[styles.centerButton, focused ? styles.centerButtonFocused : styles.centerButtonDefault]}>
                <Ionicons name="rocket" size={28} color="#fff" />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Связь',
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={24} color={color} />, // Исправлено имя иконки
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Капитан',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerButtonContainer: { top: -22, alignItems: 'center', justifyContent: 'center' },
  centerButton: {
    width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00F0FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 12,
    borderWidth: 4, borderColor: '#0F172A',
  },
  centerButtonDefault: { backgroundColor: '#334155', transform: [{ scale: 1 }] },
  centerButtonFocused: { backgroundColor: '#00F0FF', transform: [{ scale: 1.1 }], shadowOpacity: 0.8 },
});