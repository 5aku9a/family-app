export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; 
  color: string;
  unlockedAt?: Date; 
  isSecret?: boolean; 
}

export interface FamilyMemberProfile {
  userId: string;
  displayName: string;
  email?: string;
  avatarColor?: string;
  role: 'admin' | 'member';
  joinedAt: Date;
  achievements: Achievement[];
  stats: {
    transactionsCount: number;
    totalSpent: number;
    tasksCompleted: number;
    daysInFamily: number;
  };
}

export interface RelationshipData {
  startDate: Date;
  partnerName?: string; 
}