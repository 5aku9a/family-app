import { getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBubmIt-P6iUdWEIyF2ULJH1VR42_2yowA",
  authDomain: "familyapp-d67ad.firebaseapp.com",
  projectId: "familyapp-d67ad",
  storageBucket: "familyapp-d67ad.firebasestorage.app",
  messagingSenderId: "1091304596534",
  appId: "1:1091304596534:web:4d768a9a9439b2e3e1e497",
};

// Инициализация Firebase (проверяем, что приложение не инициализировано повторно)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Экспорт сервисов с типизацией
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export default app;