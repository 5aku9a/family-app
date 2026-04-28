import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export type ScheduleType = 'task' | 'event';

export interface ScheduleItem {
  id?: string;
  familyId: string;
  type: ScheduleType;
  title: string;
  description?: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  assigneeId?: string;
  assigneeName?: string;
  location?: string;
  color?: string;
  createdAt: Timestamp;
}

const COL = 'schedule';

export const addToSchedule = async (item: Omit<ScheduleItem, 'id' | 'createdAt'>) => {
  const ref = await addDoc(collection(db, COL), { ...item, createdAt: Timestamp.now() });
  return ref.id;
};

export const getFamilySchedule = async (familyId: string) => {
  const q = query(
    collection(db, COL), 
    where('familyId', '==', familyId),
    orderBy('startTime', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem));
};

export const updateScheduleItem = async (id: string, data: Partial<ScheduleItem>) => {
  await updateDoc(doc(db, COL, id), data);
};

export const deleteScheduleItem = async (id: string) => {
  await deleteDoc(doc(db, COL, id));
};