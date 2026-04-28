/** @type {import('firebase-functions/v1').CloudFunction} */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function sendNotification(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;

  const message = {
    notification: { title, body },
    data, 
    tokens: tokens,
  };

  try {
    await admin.messaging().sendEachForMulticast(message);
    console.log(`Уведомление отправлено: ${title}`);
  } catch (error) {
    console.error("Ошибка отправки уведомления:", error);
  }
}

exports.onNewChatMessage = functions.firestore
  .document('chat_messages/{messageId}')
  .onCreate(async (snap, context) => {
    const msg = snap.data();
    const familyId = msg.familyId;
    const senderId = msg.userId;
    const senderName = msg.userName || 'Кто-то';

    if (!familyId) return;

    const membersSnap = await db.collection('members').where('familyId', '==', familyId).get();
    const tokens = [];
    
    for (const doc of membersSnap.docs) {
      const member = doc.data();
      if (member.userId !== senderId && member.pushToken) {
        tokens.push(member.pushToken);
      }
    }

    if (tokens.length > 0) {
      await sendNotification(
        tokens, 
        "💬 Новое сообщение", 
        `${senderName}: ${msg.text.substring(0, 50)}...`,
        { type: 'chat', messageId: snap.id, familyId }
      );
    }
  });

exports.onLargeExpense = functions.firestore
  .document('budget/{transId}')
  .onCreate(async (snap, context) => {
    const trans = snap.data();
    if (trans.type !== 'expense' || trans.amount < 5000) return;

    const familyId = trans.familyId;
    const userName = trans.userName || 'Кто-то';

    const membersSnap = await db.collection('members').where('familyId', '==', familyId).get();
    const tokens = membersSnap.docs
      .map(d => d.data().pushToken)
      .filter(t => t);

    if (tokens.length > 0) {
      await sendNotification(
        tokens,
        "💸 Крупная трата",
        `${userName} потратил ${trans.amount} ₽ на "${trans.category}"`,
        { type: 'budget', transactionId: snap.id }
      );
    }
  });


exports.onTaskCompleted = functions.firestore
  .document('tasks_list/{taskId}') 
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();


    if (!before.isCompleted && after.isCompleted) {
      const familyId = after.familyId;
      const completedBy = after.completedBy || 'Кто-то';
      const taskTitle = after.title || 'Задача';

      const membersSnap = await db.collection('members').where('familyId', '==', familyId).get();
      const tokens = membersSnap.docs
        .map(d => d.data().pushToken)
        .filter(t => t);

      if (tokens.length > 0) {
        await sendNotification(
          tokens,
          "✅ Задача выполнена",
          `${completedBy} выполнил задачу: "${taskTitle}"`,
          { type: 'schedule', taskId: context.params.taskId }
        );
      }
    }
  });