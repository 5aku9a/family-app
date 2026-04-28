import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { ChatMessage } from '../types/chat';
import { db } from './firebase';

const COLLECTION = 'chat_messages';
const TYPING_COLLECTION = 'typing_status';
const storage = getStorage();

export const sendMessage = async (
  familyId: string, 
  userId: string, 
  userName: string, 
  text: string,
  imageUri?: string | null
) => {
  if (!text.trim() && !imageUri) return;

  let imageUrl: string | null = null;

  if (imageUri) {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const filename = `chat_${familyId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `chat_images/${filename}`);
      
      await uploadBytes(storageRef, blob);
      imageUrl = await getDownloadURL(storageRef);
    } catch (e) {
      console.error("Ошибка загрузки фото:", e);
      throw new Error("Не удалось загрузить изображение");
    }
  }

  await addDoc(collection(db, COLLECTION), {
    familyId,
    userId,
    userName,
    text: text.trim(),
    imageUrl,
    createdAt: serverTimestamp(),
    readBy: [userId],
    reactions: {},
  });

  await deleteDoc(doc(db, TYPING_COLLECTION, familyId, userId));
};

export const subscribeToMessages = (familyId: string, callback: (messages: ChatMessage[]) => void) => {
  const q = query(
    collection(db, COLLECTION),
    where('familyId', '==', familyId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatMessage[];
    callback(messages);
  });
};

export const updateTypingStatus = async (familyId: string, userId: string, userName: string) => {
  if (!familyId) return;
  const ref = doc(db, 'typing_status', familyId, 'users', userId);
  await setDoc(ref, {
    userId,
    userName,
    timestamp: serverTimestamp()
  }, { merge: true });
};

export const subscribeToTyping = (familyId: string, currentUserId: string, callback: (users: string[]) => void) => {
  const parentRef = doc(db, TYPING_COLLECTION, familyId);
  const q = query(collection(parentRef, 'users'));
  
  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const typingUsers: string[] = [];
    
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data() as any;
      if (data.timestamp && data.userId !== currentUserId) {
        const lastTime = data.timestamp.toDate().getTime();
        if (now - lastTime < 2000) {
          typingUsers.push(data.userName);
        }
      }
    });
    
    callback(typingUsers);
  });
};

export const addReaction = async (messageId: string, userId: string, emoji: string) => {
  const msgRef = doc(db, COLLECTION, messageId);
  await runTransaction(db, async (transaction) => {
    const msgDoc = await transaction.get(msgRef);
    if (!msgDoc.exists()) throw "Сообщение не найдено";
    
    const data = msgDoc.data() as ChatMessage;
    const currentReactions = data.reactions || {};
    
    for (const key in currentReactions) {
      currentReactions[key] = currentReactions[key].filter(id => id !== userId);
      if (currentReactions[key].length === 0) delete currentReactions[key];
    }
    
    if (!currentReactions[emoji]) {
      currentReactions[emoji] = [];
    }
    currentReactions[emoji].push(userId);
    
    transaction.update(msgRef, { reactions: currentReactions });
  });
};