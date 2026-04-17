import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ВСТАВЬТЕ СЮДА ВАШИ РЕАЛЬНЫЕ ДАННЫЕ ИЗ КОНСОЛИ FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBubmIt-P6iUdWEIyF2ULJH1VR42_2yowA",
  authDomain: "familyapp-d67ad.firebaseapp.com",
  projectId: "familyapp-d67ad",
  storageBucket: "familyapp-d67ad.firebasestorage.app",
  messagingSenderId: "1091304596534",
  appId: "1:1091304596534:web:4d768a9a9439b2e3e1e497",  
};

// Инициализация
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Экспорты сервисов
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;