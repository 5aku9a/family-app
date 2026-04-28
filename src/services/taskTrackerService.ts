import { Timestamp, addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export interface TaskStatus {
  id?: string;
  familyId: string;
  scheduleItemId: string;
  assignedTo: string;
  isCompleted: boolean;
  completedAt?: Timestamp | null;
  completedBy?: string | null;
}

const COL = 'tasks_list';

export const initTaskTracking = async (data: Omit<TaskStatus, 'id' | 'isCompleted' | 'completedAt' | 'completedBy'>) => {
  await addDoc(collection(db, COL), {
    ...data,
    isCompleted: false,
    completedAt: null,
    completedBy: null,
  });
};

export const getTaskStatuses = async (familyId: string) => {
  const q = query(collection(db, COL), where('familyId', '==', familyId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskStatus));
};

export const completeTask = async (statusId: string, userId: string, userName: string) => {
  await updateDoc(doc(db, COL, statusId), {
    isCompleted: true,
    completedAt: Timestamp.now(),
    completedBy: userName,
  });
};

export const resetTask = async (statusId: string) => {
  await updateDoc(doc(db, COL, statusId), {
    isCompleted: false,
    completedAt: null,
    completedBy: null,
  });
};