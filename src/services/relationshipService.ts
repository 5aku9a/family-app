import { Ionicons } from '@expo/vector-icons';
import { arrayUnion, collection, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export interface UserStats {
  daysTogether: number;
  totalExpenses: number;
  tasksCompleted: number;
  familyMembersCount: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  condition: (stats: UserStats) => boolean;
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_week',
    title: 'Первая неделя',
    description: 'Вы вместе уже 7 дней!',
    icon: 'heart',
    color: '#FF3B30',
    condition: (stats) => stats.daysTogether >= 7,
  },
  {
    id: 'first_month',
    title: 'Месяц вместе',
    description: '30 дней бок о бок.',
    icon: 'calendar',
    color: '#FF9500',
    condition: (stats) => stats.daysTogether >= 30,
  },
  {
    id: 'spender_10k',
    title: 'Первые 10к',
    description: 'Потрачено более 10,000 ₽ в бюджете.',
    icon: 'wallet',
    color: '#34C759',
    condition: (stats) => stats.totalExpenses >= 10000,
  },
  {
    id: 'task_master',
    title: 'Мастер задач',
    description: 'Выполнено 10 задач.',
    icon: 'checkbox',
    color: '#007AFF',
    condition: (stats) => stats.tasksCompleted >= 10,
  },
  {
    id: 'family_start',
    title: 'Начало пути',
    description: 'Семья из 2+ человек.',
    icon: 'people',
    color: '#AF52DE',
    condition: (stats) => stats.familyMembersCount >= 2,
  },
];


export const checkAndUnlockAchievements = async (
  userId: string,
  familyId: string
): Promise<string[]> => {
  try {

    let daysTogether = 0;
    const pairsQ = query(collection(db, 'pairs'), where('user1', '==', userId));
    const q1 = query(collection(db, 'pairs'), where('user1', '==', userId));
    const q2 = query(collection(db, 'pairs'), where('user2', '==', userId));
    
    let pairSnap = await getDocs(q1);
    if (pairSnap.empty) pairSnap = await getDocs(q2);
    
    if (!pairSnap.empty) {
      const pairData = pairSnap.docs[0].data();
      const startDate = pairData.startDate as Timestamp;
      if (startDate) {
        const start = startDate.toDate().getTime();
        const now = Date.now();
        daysTogether = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      }
    }

    let totalExpenses = 0;
    const budgetQ = query(collection(db, 'budget'), where('familyId', '==', familyId), where('type', '==', 'expense'));
    const budgetSnap = await getDocs(budgetQ);
    budgetSnap.forEach(doc => {
      totalExpenses += doc.data().amount || 0;
    });

    let tasksCompleted = 0;
    const tasksQ = query(collection(db, 'tasks_list'), where('familyId', '==', familyId), where('isCompleted', '==', true));
    const tasksSnap = await getDocs(tasksQ);
    tasksSnap.forEach(doc => {
       const data = doc.data();
       if (data.completedById === userId) {
         tasksCompleted++;
       }
    });

    let familyMembersCount = 0;
    const membersQ = query(collection(db, 'members'), where('familyId', '==', familyId));
    const membersSnap = await getDocs(membersQ);
    familyMembersCount = membersSnap.size;

    const stats: UserStats = {
      daysTogether,
      totalExpenses,
      tasksCompleted,
      familyMembersCount,
    };

    const userDoc = await getDoc(doc(db, 'users', userId));
    const currentUnlockedIds: string[] = userDoc.exists() 
      ? (userDoc.data()?.unlockedAchievements || []) 
      : [];


    const newUnlockedIds: string[] = [];
    for (const achievement of ALL_ACHIEVEMENTS) {
      if (!currentUnlockedIds.includes(achievement.id) && achievement.condition(stats)) {
        newUnlockedIds.push(achievement.id);
      }
    }


    if (newUnlockedIds.length > 0) {
      await updateDoc(doc(db, 'users', userId), {
        unlockedAchievements: arrayUnion(...newUnlockedIds),
      });
      console.log(`🏆 Открыты достижения: ${newUnlockedIds.join(', ')}`);
    }

    return newUnlockedIds;
  } catch (error) {
    console.error("Ошибка при проверке достижений:", error);
    return [];
  }
};