import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Dimensions,
  FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/services/firebase';
import { ChatMessage } from '../../src/types/chat';

const { width, height } = Dimensions.get('window');

export default function ChatScreen() {
  const { user, userData } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);

  const [stars, setStars] = useState<{id: number, top: number, left: number, size: number, opacity: number}[]>([]);
  useEffect(() => {
    const newStars = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      top: Math.random() * height,
      left: Math.random() * width,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.7 + 0.3,
    }));
    setStars(newStars);
  }, []);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();

    if (!user || !userData?.familyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const familyId = userData.familyId;

    const q = query(
      collection(db, 'chat_messages'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(data);
      setLoading(false);
      if (data.length > 0) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    }, (error) => {
      console.error("Ошибка подписки:", error);
      setLoading(false);
    });

    const typingRef = query(collection(db, 'typing_status', familyId, 'users'));
    const unsubTyping = onSnapshot(typingRef, (snapshot) => {
      const now = Date.now();
      const users: string[] = [];
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.userId !== user.uid && data.timestamp) {
          const t = data.timestamp.toDate().getTime();
          if (now - t < 3000) users.push(data.userName || 'Кто-то');
        }
      });
      setTypingUsers(users);
    });

    return () => {
      unsubscribe();
      unsubTyping();
    };
  }, [user, userData?.familyId]);

  const handleTextChange = (text: string) => {
    setNewMessage(text);
    if (userData?.familyId && user) {
      const familyId = userData.familyId;
      const ref = doc(db, 'typing_status', familyId, 'users', user.uid);
      import('firebase/firestore').then(({ setDoc }) => {
        setDoc(ref, {
          userId: user.uid,
          userName: userData.displayName || user.email,
          timestamp: serverTimestamp()
        }, { merge: true });
      });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        deleteDoc(doc(db, 'typing_status', userData.familyId!, 'users', user.uid)).catch(() => {});
      }, 2000);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !userData?.familyId) return;
    
    const textToSend = newMessage;
    setNewMessage('');
    const familyId = userData.familyId;
    const senderName = userData.displayName || user.email || 'Астронавт';
    
    try {
      const messageData = {
        familyId: familyId,
        userId: user.uid,
        userName: senderName,
        text: textToSend.trim(),
        createdAt: serverTimestamp(),
        readBy: [user.uid],
        reactions: {}
      };

      const chatRef = collection(db, 'chat_messages');
      await addDoc(chatRef, messageData);

      await addDoc(collection(db, 'notifications'), {
        familyId: familyId,
        type: 'new_message',
        title: 'Новое сообщение',
        message: `${senderName}: ${textToSend.trim().substring(0, 50)}${textToSend.length > 50 ? '...' : ''}`,
        timestamp: serverTimestamp(),
        read: false,
        senderId: user.uid
      });

      await deleteDoc(doc(db, 'typing_status', familyId, 'users', user.uid));
    } catch (e: any) {
      console.error(e);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
      setNewMessage(textToSend);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Alert.alert('Инфо', 'Для отправки фото необходимо настроить Firebase Storage.');
    }
  };

  const sendReaction = async (emoji: string) => {
    if (!selectedMessageId || !user) return;
    try {
      const msgRef = doc(db, 'chat_messages', selectedMessageId);
      await runTransaction(db, async (transaction) => {
        const msgDoc = await transaction.get(msgRef);
        if (!msgDoc.exists()) throw new Error("Сообщение не найдено");
        const data = msgDoc.data() as ChatMessage;
        const currentReactions = data.reactions || {};
        for (const key in currentReactions) {
          currentReactions[key] = currentReactions[key].filter(id => id !== user.uid);
          if (currentReactions[key].length === 0) delete currentReactions[key];
        }
        if (!currentReactions[emoji]) currentReactions[emoji] = [];
        currentReactions[emoji].push(user.uid);
        transaction.update(msgRef, { reactions: currentReactions });
      });
      setShowReactionModal(false);
      setSelectedMessageId(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Ошибка', 'Не удалось добавить реакцию');
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.userId === user?.uid;
    const reactions = item.reactions || {};
    const hasReactions = Object.keys(reactions).length > 0;

    return (
      <Pressable 
        onLongPress={() => {
          setSelectedMessageId(item.id!);
          setShowReactionModal(true);
        }} 
        style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}
      >
        {!isMe && (
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{(item.userName || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && <Text style={styles.senderName}>{item.userName}</Text>}
          <Text style={[styles.messageText, isMe && styles.myMessageText]}>{item.text}</Text>
          <Text style={[styles.timeText, isMe && styles.myTimeText]}>{formatTime(item.createdAt)}</Text>
          {hasReactions && (
            <View style={styles.reactionsContainer}>
              {Object.entries(reactions).map(([emoji, userIds]) => (
                <View key={emoji} style={[
                  styles.reactionBadge, 
                  (userIds as string[]).includes(user?.uid || '') && styles.reactionBadgeActive
                ]}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={styles.reactionCount}>{(userIds as string[]).length}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  if (!userData?.familyId) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color="#475569" />
        <Text style={styles.centerText}>Связь недоступна</Text>
        <Text style={styles.centerSub}>Требуется подключение к семейной сети</Text>
      </View>
    );
  }

  const TAB_BAR_HEIGHT = 60 + Math.max(20, insets.bottom);

  return (
    <View style={styles.outerContainer}>
      {stars.map(star => (
        <View key={star.id} style={[styles.star, { top: star.top, left: star.left, width: star.size, height: star.size, opacity: star.opacity }]} />
      ))}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Связь</Text>
            {typingUsers.length > 0 && (
              <Text style={styles.typingText}>{typingUsers.join(', ')} печатает...</Text>
            )}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#00F0FF" style={{ flex: 1 }} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id!}
            contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + 80 }]} 
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={[styles.inputWrapper, { bottom: TAB_BAR_HEIGHT }]}>
          <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
            <Ionicons name="camera" size={24} color="#94A3B8" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="Сообщение..."
            placeholderTextColor="#64748B"
            value={newMessage}
            onChangeText={handleTextChange}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity 
            style={[styles.sendBtn, (!newMessage.trim()) && styles.sendBtnDisabled]} 
            onPress={handleSend}
            disabled={!newMessage.trim()}
          >
            <Ionicons name="send" size={20} color={newMessage.trim() ? '#0B1120' : '#64748B'} />
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      <Modal visible={showReactionModal} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => { setShowReactionModal(false); setSelectedMessageId(null); }}
        >
          <View style={styles.reactionPicker}>
            {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
              <TouchableOpacity 
                key={emoji} 
                onPress={() => sendReaction(emoji)} 
                style={styles.reactionOption}
              >
                <Text style={{fontSize: 28}}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#0B1120' },
  container: { flex: 1 },
  star: { position: 'absolute', backgroundColor: '#fff', borderRadius: 50 },
  
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    paddingTop: 50,
    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.05)' 
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#E2E8F0' },
  typingText: { fontSize: 12, color: '#00F0FF', fontStyle: 'italic', marginTop: 2 },
  
  listContent: { padding: 16 },
  
  messageRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  
  avatarBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  avatarText: { color: '#E2E8F0', fontWeight: 'bold', fontSize: 14 },
  
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18, borderWidth: 1 },
  myBubble: { backgroundColor: 'rgba(0, 240, 255, 0.15)', borderColor: 'rgba(0, 240, 255, 0.3)', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderColor: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: 4 },
  
  senderName: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginBottom: 2 },
  messageText: { fontSize: 15, color: '#E2E8F0', lineHeight: 20 },
  myMessageText: { color: '#E2E8F0' },
  
  timeText: { fontSize: 10, color: '#64748B', marginTop: 4, textAlign: 'right' },
  myTimeText: { color: '#94A3B8' },
  
  reactionsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, justifyContent: 'flex-end', gap: 4 },
  reactionBadge: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  reactionBadgeActive: { backgroundColor: 'rgba(0, 240, 255, 0.15)', borderColor: 'rgba(0, 240, 255, 0.3)' },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 9, color: '#94A3B8', marginLeft: 2, fontWeight: '600' },
  
  inputWrapper: { 
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row', 
    padding: 10, 
    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.1)', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  attachBtn: { padding: 10, marginRight: 5, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  input: { 
    flex: 1, 
    backgroundColor: '#1E293B', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    maxHeight: 100, 
    fontSize: 16, 
    marginRight: 10, 
    minHeight: 44,
    color: '#E2E8F0',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00F0FF', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#334155' },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B1120' },
  centerText: { fontSize: 16, color: '#E2E8F0', fontWeight: 'bold' },
  centerSub: { fontSize: 14, color: '#64748B', marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', paddingBottom: 80 },
  reactionPicker: { 
    flexDirection: 'row', 
    backgroundColor: '#1E293B', 
    marginHorizontal: 20, 
    marginBottom: 20,
    padding: 10, 
    borderRadius: 35, 
    justifyContent: 'space-around', 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', 
    shadowOpacity: 0.5, 
    shadowRadius: 15, 
    elevation: 15 
  },
  reactionOption: { padding: 8 },
});