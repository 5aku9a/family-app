import { Timestamp } from 'firebase/firestore';
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  type: 'personal' | 'family'; 
  unlockedAt?: Timestamp;
  isSecret?: boolean;
}

const PERSONAL_ACHIEVEMENTS: Omit<Achievement, 'unlockedAt' | 'type'>[] = [
  { id: 'p_first_step', title: 'Первый шаг', description: 'Первая личная транзакция', icon: 'wallet', color: '#34C759' },
  { id: 'p_saver', title: 'Копилка', description: 'Личные накопления 10к', icon: 'piggy-bank', color: '#FFD700' },
  { id: 'p_planner', title: 'Организатор', description: 'Выполнил 5 личных задач', icon: 'checkbox', color: '#007AFF' },
];

const FAMILY_ACHIEVEMENTS: Omit<Achievement, 'unlockedAt' | 'type'>[] = [
  { id: 'f_month_love', title: 'Месяц любви', description: '1 месяц вместе', icon: 'heart', color: '#FF3B30' },
  { id: 'f_budget_master', title: 'Бюджет под контролем', description: 'Семейный баланс > 50к', icon: 'trending-up', color: '#AF52DE' },
  { id: 'f_teamwork', title: 'Команда', description: 'Все члены семьи выполнили задачи', icon: 'people', color: '#FF9500' },
  { id: 'f_year_together', title: 'Год вместе', description: '365 дней бок о бок', icon: 'trophy', color: '#FF3B30', isSecret: true },
];

export const checkPersonalAchievements = (
  stats: { transactionsCount: number; totalSpent: number; tasksCompleted: number; messagesCount?: number },
  daysTogether: number,
  hasFamily: boolean,
  existingIds: string[]
): Achievement[] => {
  const unlocked: Achievement[] = [];
  const now = Timestamp.now();

  const check = (base: any, condition: boolean) => {
    if (condition && !existingIds.includes(base.id)) {
      unlocked.push({ ...base, type: 'personal', unlockedAt: now });
    }
  };

  check(PERSONAL_ACHIEVEMENTS.find(a => a.id === 'p_first_step'), stats.transactionsCount >= 1);
  check(PERSONAL_ACHIEVEMENTS.find(a => a.id === 'p_saver'), stats.totalSpent >= 10000); 
  check(PERSONAL_ACHIEVEMENTS.find(a => a.id === 'p_planner'), stats.tasksCompleted >= 5);

  return unlocked;
};

export const checkFamilyAchievements = (
  familyStats: { balance: number; daysTogether: number; allTasksDone: boolean },
  existingIds: string[]
): Achievement[] => {
  const unlocked: Achievement[] = [];
  const now = Timestamp.now();

  const check = (base: any, condition: boolean) => {
    if (condition && !existingIds.includes(base.id)) {
      unlocked.push({ ...base, type: 'family', unlockedAt: now });
    }
  };

  check(FAMILY_ACHIEVEMENTS.find(a => a.id === 'f_month_love'), familyStats.daysTogether >= 30);
  check(FAMILY_ACHIEVEMENTS.find(a => a.id === 'f_budget_master'), familyStats.balance >= 50000);
  check(FAMILY_ACHIEVEMENTS.find(a => a.id === 'f_teamwork'), familyStats.allTasksDone);
  check(FAMILY_ACHIEVEMENTS.find(a => a.id === 'f_year_together'), familyStats.daysTogether >= 365);

  return unlocked;
};