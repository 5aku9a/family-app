import {
  Timestamp,
  collection, doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { Family, FamilyMember, InviteCode } from '../types/family';
import { db } from './firebase';

const FAMILIES_COL = 'families';
const MEMBERS_COL = 'members';
const CODES_COL = 'invite_codes';


export const createFamily = async (familyName: string, userId: string, userEmail: string, userName?: string) => {
  const batch = writeBatch(db);
  
  const familyRef = doc(collection(db, FAMILIES_COL));
  const familyData: Family = {
    id: familyRef.id,
    name: familyName,
    createdAt: Timestamp.now(),
  };
  batch.set(familyRef, familyData);

  const memberRef = doc(collection(db, MEMBERS_COL));
  const memberData: FamilyMember = {
    userId,
    email: userEmail,
    displayName: userName || userEmail.split('@')[0],
    role: 'owner',
    joinedAt: Timestamp.now(),
    familyId: familyRef.id,
  };
  batch.set(memberRef, memberData);

  const userRef = doc(db, 'users', userId);
  await batch.commit();
  await updateDoc(userRef, { familyId: familyRef.id });

  return familyData;
};


export const generateInviteCode = async (familyId: string) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const codeRef = doc(collection(db, CODES_COL));
  
  await setDoc(codeRef, {
    code,
    familyId,
    expiresAt: Timestamp.fromMillis(Date.now() + 1000 * 60 * 15), 
    isActive: true,
    createdAt: Timestamp.now(),
  });
  
  return code;
};


export const joinFamily = async (code: string, userId: string, userEmail: string, userName?: string) => {
  const q = query(
    collection(db, CODES_COL),
    where('code', '==', code.toUpperCase()),
    where('isActive', '==', true)
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) throw new Error('Код не найден или истек');
  
  const codeDoc = snapshot.docs[0];
  const codeData = codeDoc.data() as InviteCode;
  
  if (codeData.expiresAt.toDate() < new Date()) {
    throw new Error('Срок действия кода истек');
  }

  const familyId = codeData.familyId;

  const memberCheckQ = query(
    collection(db, MEMBERS_COL),
    where('familyId', '==', familyId),
    where('userId', '==', userId)
  );
  const memberCheck = await getDocs(memberCheckQ);
  if (!memberCheck.empty) throw new Error('Вы уже состоите в этой семье');

  const familyRef = doc(db, FAMILIES_COL, familyId);
  const familySnap = await getDoc(familyRef);
  if (!familySnap.exists()) throw new Error('Семья не найдена');

  const batch = writeBatch(db);

  const memberRef = doc(collection(db, MEMBERS_COL));
  const memberData: FamilyMember = {
    userId,
    email: userEmail,
    displayName: userName || userEmail.split('@')[0],
    role: 'member',
    joinedAt: Timestamp.now(),
    familyId: familyId,
  };
  batch.set(memberRef, memberData);

  const userRef = doc(db, 'users', userId);
  await batch.commit();
  await updateDoc(userRef, { familyId });
  
  return familySnap.data() as Family;
};


export const removeMember = async (targetUserId: string, familyId: string, actorUserId: string) => {
  const actorQ = query(
    collection(db, MEMBERS_COL),
    where('familyId', '==', familyId),
    where('userId', '==', actorUserId)
  );
  const actorSnap = await getDocs(actorQ);
  if (actorSnap.empty) throw new Error('Вы не состоите в семье');
  
  const actorData = actorSnap.docs[0].data();
  if (actorData.role !== 'owner' && actorData.role !== 'admin') throw new Error('Недостаточно прав');

  const memberQ = query(
    collection(db, MEMBERS_COL),
    where('familyId', '==', familyId),
    where('userId', '==', targetUserId)
  );
  const memberSnap = await getDocs(memberQ);
  
  if (memberSnap.empty) throw new Error('Пользователь не найден');
  
  const targetData = memberSnap.docs[0].data();
  if (targetData.role === 'owner') throw new Error('Нельзя удалить создателя семьи');

  const batch = writeBatch(db);
  memberSnap.forEach(docSnap => batch.delete(docSnap.ref));
  
  const userRef = doc(db, 'users', targetUserId);
  batch.update(userRef, { familyId: null });
  
  await batch.commit();
};


export const changeMemberRole = async (targetUserId: string, newRole: 'admin' | 'member', familyId: string, actorUserId: string) => {
  const actorQ = query(
    collection(db, MEMBERS_COL),
    where('familyId', '==', familyId),
    where('userId', '==', actorUserId)
  );
  const actorSnap = await getDocs(actorQ);
  if (actorSnap.empty) throw new Error('Вы не состоите в семье');
  
  const actorRole = actorSnap.docs[0].data().role;
  if (actorRole !== 'owner') throw new Error('Только создатель может менять роли');

  const memberQ = query(
    collection(db, MEMBERS_COL),
    where('familyId', '==', familyId),
    where('userId', '==', targetUserId)
  );
  const memberSnap = await getDocs(memberQ);
  if (memberSnap.empty) throw new Error('Пользователь не найден');

  const memberDoc = memberSnap.docs[0];
  if (memberDoc.data().role === 'owner') throw new Error('Нельзя изменить роль создателя');

  await updateDoc(memberDoc.ref, { role: newRole });
};


export const deleteFamily = async (familyId: string, userId: string) => {
  const ownerQ = query(
    collection(db, MEMBERS_COL),
    where('familyId', '==', familyId),
    where('userId', '==', userId)
  );
  const ownerSnap = await getDocs(ownerQ);
  if (ownerSnap.empty || ownerSnap.docs[0].data().role !== 'owner') {
    throw new Error('Только создатель может удалить семью');
  }

  const batch = writeBatch(db);

  const membersQ = query(collection(db, MEMBERS_COL), where('familyId', '==', familyId));
  const membersSnap = await getDocs(membersQ);
  membersSnap.forEach(docSnap => batch.delete(docSnap.ref));

  const codesQ = query(collection(db, CODES_COL), where('familyId', '==', familyId));
  const codesSnap = await getDocs(codesQ);
  codesSnap.forEach(docSnap => batch.delete(docSnap.ref));

  batch.delete(doc(db, FAMILIES_COL, familyId));

  await batch.commit();
  
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { familyId: null });
};

export const leaveFamily = async (userId: string, familyId: string) => {
  const memberQ = query(
    collection(db, MEMBERS_COL),
    where('familyId', '==', familyId),
    where('userId', '==', userId)
  );
  const memberSnap = await getDocs(memberQ);
  if (memberSnap.empty) return;

  const role = memberSnap.docs[0].data().role;
  
  if (role === 'owner') {
    throw new Error('Создатель не может выйти. Он должен удалить семью.');
  }

  const batch = writeBatch(db);
  memberSnap.forEach(docSnap => batch.delete(docSnap.ref));
  
  const userRef = doc(db, 'users', userId);
  await batch.commit();
  await updateDoc(userRef, { familyId: null });
};