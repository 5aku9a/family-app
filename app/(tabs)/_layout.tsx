import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/services/firebase';

const { width } = Dimensions.get('window');

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + Math.max(20, insets.bottom);
  const { user, userData } = useAuth();
  
  const [activeNotification, setActiveNotification] = useState<any>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!user || !userData?.familyId) return;

    const q = query(
      collection(db, 'notifications'),
      where('familyId', '==', userData.familyId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.senderId === user.uid) return;

          setActiveNotification(data);
          
          Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(4000),
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })
          ]).start(() => setActiveNotification(null));
        }
      });
    });

    return () => unsubscribe();
  }, [user, userData?.familyId]);

  return (
    <View style={{ flex: 1 }}>
      {activeNotification && (
        <Animated.View style={[styles.notificationContainer, { opacity: fadeAnim, top: insets.top + 10 }]}>
          <View style={styles.notificationContent}>
            <Ionicons 
              name={
                activeNotification.type === 'new_message' ? 'chatbubble' :
                activeNotification.type === 'large_expense' ? 'warning' :
                activeNotification.type === 'new_event' ? 'calendar' : 'star'
              } 
              size={24} 
              color="#00F0FF" 
            />
            <View style={styles.notificationTexts}>
              <Text style={styles.notificationTitle}>{activeNotification.title}</Text>
              <Text style={styles.notificationMessage} numberOfLines={2}>{activeNotification.message}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#00F0FF',
          tabBarInactiveTintColor: '#5E6C85',
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)', 
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
            tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={24} color={color} />, 
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
    </View>
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
  
  notificationContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  notificationContent: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    alignItems: 'center',
  },
  notificationTexts: {
    marginLeft: 12,
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#CBD5E1',
  },
});