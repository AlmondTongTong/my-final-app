// This is a one-time script to reset and recalculate talent scores.
// Run it from your project's root directory using: node reset_talents.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, query, where, Timestamp } = require('firebase/firestore');

// IMPORTANT: Copy your Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U",
  authDomain: "ahnstoppable-learning.firebaseapp.com",
  projectId: "ahnstoppable-learning"
};

const APP_ID = 'default-app-id'; // Use your app_id if you have a specific one

// --- SCRIPT START ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runReset() {
  console.log('Starting talent reset...');

  // 1. Reset all talent scores to 0
  const talentsRef = collection(db, `/artifacts/${APP_ID}/public/data/talents`);
  const talentsSnapshot = await getDocs(talentsRef);
  const batch = writeBatch(db);

  talentsSnapshot.forEach(doc => {
    batch.update(doc.ref, { totalTalents: 0 });
  });

  // 2. Clear all previous talent transactions
  const transactionsRef = collection(db, `/artifacts/${APP_ID}/public/data/talentTransactions`);
  const transactionsSnapshot = await getDocs(transactionsRef);
  transactionsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log('All talent scores reset to 0 and transactions cleared.');

  // 3. Recalculate scores from today 8 AM PST
  const now = new Date();
  const pstOffset = 7 * 60 * 60 * 1000; // PST is UTC-7
  const todayAt8PST = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  const cutoffTime = new Date(todayAt8PST.getTime() + (now.getTimezoneOffset() * 60 * 1000) + pstOffset);

  const cutoffTimestamp = Timestamp.fromDate(cutoffTime);

  console.log(`Recalculating scores for activities since ${cutoffTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);

  const newTalents = {};
  const newTransactions = [];

  // A. Recalculate from original posts
  const questionsQuery = query(collection(db, `/artifacts/${APP_ID}/public/data/questions`), where("timestamp", ">=", cutoffTimestamp));
  const questionsSnapshot = await getDocs(questionsQuery);

  questionsSnapshot.forEach(doc => {
    const data = doc.data();
    const studentName = data.name;
    if (!newTalents[studentName]) newTalents[studentName] = 0;
    newTalents[studentName] += 1;
    newTransactions.push({ name: studentName, points: 1, type: 'post_recalc', timestamp: data.timestamp });
  });

  // B. Recalculate from replies
  for (const doc of questionsSnapshot.docs) {
      const repliesQuery = query(collection(db, doc.ref.path, 'replies'), where("timestamp", ">=", cutoffTimestamp));
      const repliesSnapshot = await getDocs(repliesQuery);
      repliesSnapshot.forEach(replyDoc => {
          const replyData = replyDoc.data();
          const studentName = replyData.authorFullName;
          if (!newTalents[studentName]) newTalents[studentName] = 0;
          newTalents[studentName] += 1;
          newTransactions.push({ name: studentName, points: 1, type: 'reply_recalc', timestamp: replyData.timestamp });
      });
  }

  console.log('Recalculation complete. Updating database...');

  // 4. Apply new scores and transactions
  const finalBatch = writeBatch(db);
  for (const studentName in newTalents) {
    const talentDocRef = doc(db, `/artifacts/${APP_ID}/public/data/talents`, studentName);
    finalBatch.update(talentDocRef, { totalTalents: newTalents[studentName] });
  }
  newTransactions.forEach(t => {
    const newTransRef = doc(collection(transactionsRef)); // Auto-generate ID
    finalBatch.set(newTransRef, t);
  });

  await finalBatch.commit();

  console.log('SUCCESS: All talents have been reset and recalculated.');
  process.exit(0);
}

runReset().catch(e => {
  console.error("SCRIPT FAILED:", e);
  process.exit(1);
});