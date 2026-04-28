import { Timestamp } from 'firebase/firestore';

export interface Family {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface FamilyMember {
  userId: string;
  email: string;
  displayName?: string;
  role: 'owner' | 'admin' | 'member'; 
  joinedAt: Timestamp;
  familyId: string;
}

export interface InviteCode {
  code: string;
  familyId: string;
  expiresAt: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
}
