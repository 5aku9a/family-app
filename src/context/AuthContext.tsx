import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';

export interface UserData {
  displayName: string;
  email: string;
  familyId: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
  refreshUserData: () => Promise<void>; // Новая функция
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Функция загрузки данных пользователя
  const loadUserData = useCallback(async (currentUser: User) => {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setUserData({
          displayName: data.displayName || currentUser.email?.split('@')[0] || 'Пользователь',
          email: currentUser.email || '',
          familyId: data.familyId || null,
          photoURL: data.photoURL || null,
        });
      } else {
        setUserData({
          displayName: currentUser.email?.split('@')[0] || 'Пользователь',
          email: currentUser.email || '',
          familyId: null,
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      setUserData({
        displayName: currentUser.email?.split('@')[0] || 'Пользователь',
        email: currentUser.email || '',
        familyId: null,
      });
    }
  }, []);

  // Публичная функция для принудительного обновления
  const refreshUserData = useCallback(async () => {
    if (user) {
      await loadUserData(user);
    }
  }, [user, loadUserData]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserData(currentUser);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadUserData]);

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
    } catch (error) {
      console.error('Ошибка выхода:', error);
      throw error;
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setUserData({
          displayName: data.displayName || user.email?.split('@')[0] || 'Пользователь',
          email: user.email || '',
          familyId: data.familyId || null,
          photoURL: data.photoURL || null,
        });
      }
    } catch (error) {
      console.error('Ошибка обновления данных:', error);
    }
  };
  
  return (
    <AuthContext.Provider value={{ user, userData, loading, signOutUser, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};