import { Timestamp } from 'firebase/firestore';

export interface UserData {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  familyId?: string | null;
  role?: 'admin' | 'member' | 'owner';
  
  partnerId?: string | null;
  partnerName?: string | null;
  partnerEmail?: string | null;
  relationshipStartDate?: Timestamp | null;
  linkedAt?: Timestamp | null;
  
  unlockedAchievements?: string[];
}