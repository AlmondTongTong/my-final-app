/* global __app_id, __initial_auth_token */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, query, where, addDoc, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const COURSES = ["ADV 375-01", "ADV 375-02", "ADV 461"];
const COURSE_STUDENTS = { "ADV 375-01": [ "Donovan, Robert", "Ellison, Alexis", "Futrell, Rylie", "George, Matthew", "Hammer, Olivia", "Kobayashi, Sena", "Lee, Byungho", "Mady, Gabriella", "Mawuenyega, Chloe", "Oved, Liam", "Sims, Ava", "Soke, Duru", "Walsh, William", "Warmington, Charles", "Yu, Wenbo" ], "ADV 375-02": [ "Alteio, Katherine", "Asatryan, Natalie", "Bondi, Ava", "Brown, Kylie", "Calabrese, Ella", "Dougherty, Quinn", "Dutton, Madeline", "Grabinger, Katharina", "Ju, Ashley", "Lahanas, Dean", "Lange, Bella-Soleil", "McQuilling, Louisa", "Milliman, Nicole", "Nizdil, Kennedy", "Salahieh, Zayd", "Shannon, Savannah", "Tang, Yuhan", "Walz, Lucy", "Wang, Michelle", "Wanke, Karsten" ], "ADV 461": [ "Bonk, Maya", "Burrow, Elizabeth", "Campos, Victoria", "Cantada, Cristian", "Chong, Timothy", "Chung, Sooa", "Cwiertnia, Zachary", "Fernandez, Francisco", "Fok, Alexis", "Gilbert, Jasmine", "Hall, Lily", "Hosea, Nicholas", "Jang, Da Eun", "Kim, Lynn", "Kim, Noelle", "Koning, William", "Lee, Edmund", "Lewandowski, Luke", "Leyson, Noah", "Lopez, Tatum", "Murphy, Alexander", "Swendsen, Katherine" ], };

const TalentGraph = ({ talents, type, getFirstName }) => {
    if (talents.length === 0) return <p className="text-gray-400">No talent data yet.</p>;
    const sortedTalents = [...talents].sort((a, b) => b.totalTalents - a.totalTalents);
    const maxScore = sortedTalents.length > 0 ? sortedTalents[0].totalTalents : 0;
    let displayData = [];
    if (type === 'admin') { displayData = sortedTalents; } 
    else if (type === 'student' && sortedTalents.length > 0) { const highest = sortedTalents[0]; const lowest = sortedTalents[sortedTalents.length - 1]; displayData = (highest.id === lowest.id) ? [highest] : [highest, lowest]; }
    return ( <div className="space-y-2"> {displayData.map(talent => ( <div key={talent.id} className="w-full"> <div className="flex justify-between text-sm text-gray-300 mb-1"> <span>{type === 'admin' ? getFirstName(talent.name) : (talent.id === sortedTalents[0].id ? 'Highest Score' : 'Lowest Score')}</span> <span>{talent.totalTalents}</span> </div> <div className="w-full bg-slate-600 rounded-full h-4"> <div className="bg-yellow-400 h-4 rounded-full" style={{ width: maxScore > 0 ? `${(talent.totalTalents / maxScore) * 100}%` : '0%' }} ></div> </div> </div> ))} </div> );
};

const isWithinClassTime = (courseName) => {
    const now = new Date();
    const losAngelesTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const day = losAngelesTime.getDay(), hour = losAngelesTime.getHours(), minute = losAngelesTime.getMinutes();
    const currentTimeInMinutes = hour * 60 + minute;
    switch(courseName) {
        case "ADV 375-01": if (day === 1 || day === 4) { const startTime = 8 * 60, endTime = 9 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        case "ADV 375-02": if (day === 1 || day === 4) { const startTime = 12 * 60, endTime = 13 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        case "ADV 461": if (day === 3) { const startTime = 12 * 60, endTime = 15 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        default: return false;
    }
};

const ContentForm = ({ type, onAddContent, isEnabled }) => {
  const [text, setText] = useState('');
  const handleSubmit = (event) => { event.preventDefault(); onAddContent(text, type); setText(''); };
  return ( <form onSubmit={handleSubmit} className="flex space-x-2"> <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={type === 'question' ? "Leave a Question or Comment" : "What do you think?"} disabled={!isEnabled} className="flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-lg" /> <button type="submit" disabled={!isEnabled || !text.trim()} className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50">Add</button> </form> );
};

const AdminLoginForm = ({ onAdminLogin }) => {
    const [password, setPassword] = useState('');
    const handleLogin = () => { onAdminLogin(password); };
    return ( <div className="flex space-x-2"> <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="p-2 border bg-slate-700 border-slate-500 rounded-lg text-sm" /> <button onClick={handleLogin} className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg">Login</button> </div> );
};

const App = () => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const token = useMemo(() => typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null, []);
  
  const firebaseConfig = useMemo(() => ({ apiKey: "AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U", authDomain: "ahnstoppable-learning.firebaseapp.com", projectId: "ahnstoppable-learning", storageBucket: "ahnstoppable-learning.firebasestorage.app", messagingSenderId: "365013467715", appId: "1:365013467715:web:113e63c822fae43123caf6", measurementId: "G-MT9ETH31MY" }), []);

  const [db, setDb] = useState(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0]);
  const [questionsLog, setQuestionsLog] = useState([]);
  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const ADMIN_PASSWORD = '0811';
  
  const [adminSelectedDate, setAdminSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [studentSelectedDate, setStudentSelectedDate] = useState('');
  const [talentsLog, setTalentsLog] = useState([]);
  const [myTotalTalents, setMyTotalTalents] = useState(0);

  const [adminSelectedStudent, setAdminSelectedStudent] = useState('');
  const [adminStudentLog, setAdminStudentLog] = useState([]);
  
  const [isClassActive, setIsClassActive] = useState(false);
  const [gradedPosts, setGradedPosts] = useState(new Set());
  const [talentTransactions, setTalentTransactions] = useState([]);
  // --- NEW FEATURE 1: State for daily progress tracking ---
  const [dailyProgress, setDailyProgress] = useState({ question: false, comment: false });
  
  const showMessage = useCallback((msg) => { setMessage(msg); setShowMessageBox(true); setTimeout(() => { setShowMessageBox(false); setMessage(''); }, 3000); }, []);
  const getFirstName = useCallback((fullName) => { if (!fullName) return ''; const parts = fullName.split(', '); return parts.length > 1 ? parts[1] : parts[0]; }, []);

  useEffect(() => { const initializeFirebase = async () => { try { const app = initializeApp(firebaseConfig); const auth = getAuth(app); setDb(getFirestore(app)); if (token) { await signInWithCustomToken(auth, token); } else { await signInAnonymously(auth); } setIsFirebaseConnected(true); } catch (e) { console.error("Firebase initialization failed:", e); } }; initializeFirebase(); }, [token, firebaseConfig]);
  useEffect(() => { const checkTime = () => setIsClassActive(isWithinClassTime(selectedCourse)); checkTime(); const interval = setInterval(checkTime, 30000); return () => clearInterval(interval); }, [selectedCourse]);
  useEffect(() => { if (!isFirebaseConnected || !db) return; const publicDataPath = `/artifacts/${appId}/public/data`; const talentsQuery = query(collection(db, `${publicDataPath}/talents`), where("course", "==", selectedCourse)); const unsubTalents = onSnapshot(talentsQuery, (snap) => setTalentsLog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); return () => unsubTalents(); }, [isFirebaseConnected, db, selectedCourse, appId]);

  useEffect(() => {
    if (!isFirebaseConnected || !db || !isAdmin) return;
    const publicDataPath = `/artifacts/${appId}/public/data`;
    setAdminSelectedStudent(''); setAdminStudentLog([]); setGradedPosts(new Set());
    const questionsQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("date", "==", adminSelectedDate));
    const unsubQuestions = onSnapshot(questionsQuery, (snap) => setQuestionsLog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubQuestions();
  }, [isFirebaseConnected, db, selectedCourse, adminSelectedDate, appId, isAdmin]);

  useEffect(() => {
      if (!isFirebaseConnected || !db || !isAdmin || !adminSelectedStudent) { setAdminStudentLog([]); return; };
      const publicDataPath = `/artifacts/${appId}/public/data`;
      const studentLogQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("name", "==", adminSelectedStudent));
      const unsubLog = onSnapshot(studentLogQuery, (snap) => setAdminStudentLog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp)));
      return () => unsubLog();
  }, [isFirebaseConnected, db, selectedCourse, adminSelectedStudent, appId, isAdmin]);

  const [studentActivityLog, setStudentActivityLog] = useState([]);
  useEffect(() => {
    if (!isFirebaseConnected || !db || isAdmin || !nameInput) {
       setStudentActivityLog([]); setMyTotalTalents(0); setTalentTransactions([]); setDailyProgress({ question: false, comment: false }); return;
    }
    const publicDataPath = `/artifacts/${appId}/public/data`;
    const transactionsQuery = query(collection(db, `${publicDataPath}/talentTransactions`), where("name", "==", nameInput));
    const unsubTransactions = onSnapshot(transactionsQuery, (snap) => setTalentTransactions(snap.docs.map(doc => doc.data()).sort((a,b) => b.timestamp - a.timestamp)));
    const talentDocRef = doc(db, `${publicDataPath}/talents`, nameInput);
    const unsubMyTalent = onSnapshot(talentDocRef, (doc) => { if (doc.exists()) { setMyTotalTalents(doc.data().totalTalents); } else { setMyTotalTalents(0); } });

    let unsubActivity = () => {};
    if (studentSelectedDate) {
      const activityQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("name", "==", nameInput), where("date", "==", studentSelectedDate));
      unsubActivity = onSnapshot(activityQuery, (snap) => {
        const activities = snap.docs.map(doc => doc.data());
        setStudentActivityLog(activities.sort((a,b) => b.timestamp - a.timestamp));
        // --- NEW FEATURE 1: Calculate daily progress ---
        const hasQuestion = activities.some(act => act.type === 'question');
        const hasComment = activities.some(act => act.type === 'comment');
        setDailyProgress({ question: hasQuestion, comment: hasComment });
      });
    } else { setStudentActivityLog([]); setDailyProgress({ question: false, comment: false }); }
    
    return () => { unsubActivity(); unsubMyTalent(); unsubTransactions(); };
  }, [isFirebaseConnected, db, selectedCourse, nameInput, studentSelectedDate, appId, isAdmin]);

  const modifyTalent = async (studentName, amount, type, logId) => {
      if (!db) return;
      const publicDataPath = `/artifacts/${appId}/public/data`;
      const talentDocRef = doc(db, `${publicDataPath}/talents`, studentName);
      const transactionColRef = collection(db, `${publicDataPath}/talentTransactions`);
      try {
          const docSnap = await getDoc(talentDocRef);
          let currentTalents = docSnap.exists() ? docSnap.data().totalTalents || 0 : 0;
          const newTotal = currentTalents + amount;
          if (newTotal < 0) { showMessage("Talent cannot go below 0."); return; }
          if (docSnap.exists()) { await updateDoc(talentDocRef, { totalTalents: newTotal }); } 
          else { await setDoc(talentDocRef, { name: studentName, course: selectedCourse, totalTalents: newTotal }); }
          if(type !== 'automatic') showMessage(`${getFirstName(studentName)} received ${amount > 0 ? '+1' : '-1'} Talent!`);
          await addDoc(transactionColRef, { name: studentName, points: amount, type: type, timestamp: serverTimestamp() });
          if(logId) setGradedPosts(prev => new Set(prev).add(logId));
      } catch(e) { console.error("Error modifying talent: ", e); }
  };

  const handleAddContent = async (text, type) => {
    if (!db || !nameInput.trim() || !text.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const publicDataPath = `/artifacts/${appId}/public/data`;
    try {
      await addDoc(collection(db, `${publicDataPath}/questions`), { name: nameInput, text, type, course: selectedCourse, date: today, timestamp: serverTimestamp() });
      showMessage("Submission complete! ✅");
      await modifyTalent(nameInput, 1, 'automatic');
    } catch (e) { showMessage("Submission failed. ❌"); }
  };

  const handleAdminLogin = (password) => { if (password === ADMIN_PASSWORD) { setIsAdmin(true); showMessage("Admin Login successful! 🔑"); } else { showMessage("Incorrect password. 🚫"); } };
  const isNameEntered = nameInput.trim().length > 0;
  const isReadyToParticipate = isNameEntered && !!studentSelectedDate && isClassActive;

  // --- NEW FEATURE 2: Helper to process daily progress for all students ---
  const adminDailyProgress = useMemo(() => {
    return questionsLog.reduce((acc, log) => {
        if (!acc[log.name]) { acc[log.name] = { question: false, comment: false }; }
        if (log.type === 'question') acc[log.name].question = true;
        if (log.type === 'comment') acc[log.name].comment = true;
        return acc;
    }, {});
  }, [questionsLog]);

  const MainContent = () => (
    <div className="w-full max-w-lg p-6 bg-slate-800 text-white rounded-xl shadow-lg box-shadow-custom">
      {isAdmin ? (
        <>
          <h1 className="text-3xl font-bold text-center mb-4 text-orange-500">Admin Dashboard</h1>
          <button onClick={() => setIsAdmin(false)} className="mb-4 p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700">Back to student view</button>
          <div className="flex flex-wrap justify-center gap-2 mb-6"> {COURSES.map((course) => <button key={course} onClick={() => setSelectedCourse(course)} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>)} </div>
          <select value={adminSelectedStudent} onChange={(e) => setAdminSelectedStudent(e.target.value)} className="p-3 mb-6 w-full border bg-slate-700 border-slate-500 rounded-lg text-lg"> <option value="">-- View Daily Log --</option> {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)} </select>

          {adminSelectedStudent ? (
            <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
              <h3 className="text-xl font-semibold">All Logs for {getFirstName(adminSelectedStudent)}</h3>
              <div className="flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg"> <img src="/talent-coin.png" alt="Talent coin" className="w-6 h-6 mr-2" /> <p className="font-bold text-lg">Total Talents: {talentsLog.find(t => t.id === adminSelectedStudent)?.totalTalents || 0}</p> </div>
              <ul>{adminStudentLog.map((log) => ( <li key={log.id} className="p-2 border-b border-slate-700 text-gray-300 flex justify-between items-center"> <span className="flex-1 mr-2"><span className="font-bold">{log.date}</span> [{log.type}]: {log.text}</span> <div className="flex items-center space-x-1"> {gradedPosts.has(log.id) && <span className="text-green-500 text-xl">✅</span>} <button onClick={() => modifyTalent(log.name, -1, 'penalty', log.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 flex-shrink-0">-1</button> <button onClick={() => modifyTalent(log.name, 1, 'bonus', log.id)} className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded hover:bg-yellow-600 flex-shrink-0">+1</button> </div> </li> ))}</ul>
            </div>
          ) : (
            <>
              <div className="flex justify-center items-center space-x-2 mb-6"> <label className="text-gray-300 text-lg">View Logs for Date:</label> <input type="date" value={adminSelectedDate} onChange={(e) => setAdminSelectedDate(e.target.value)} className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-lg"/> </div>
              {/* --- NEW FEATURE 2: Admin Daily Progress View --- */}
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
                <h3 className="text-xl font-semibold mb-2">Daily Requirement Progress for {adminSelectedDate}</h3>
                <ul className="space-y-1 text-sm">{Object.entries(adminDailyProgress).map(([name, progress]) => ( <li key={name} className="flex justify-between items-center"> <span>{getFirstName(name)}:</span> <span> {progress.question ? '✅' : '❌'} Q / {progress.comment ? '✅' : '❌'} C </span> </li> ))}</ul>
              </div>
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
                <h3 className="text-xl font-semibold">❓ Daily Posts</h3>
                <ul>{questionsLog.map((log) => ( <li key={log.id} className="p-2 border-b border-slate-700 text-gray-300 flex justify-between items-center"> <span className="flex-1 mr-2">{log.name} [{log.type}]: {log.text}</span> <div className="flex items-center space-x-1"> {gradedPosts.has(log.id) && <span className="text-green-500 text-xl">✅</span>} <button onClick={() => modifyTalent(log.name, -1, 'penalty', log.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 flex-shrink-0">-1</button> <button onClick={() => modifyTalent(log.name, 1, 'bonus', log.id)} className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded hover:bg-yellow-600 flex-shrink-0">+1</button> </div> </li> ))}</ul>
              </div>
            </>
          )}
          <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> <h3 className="text-xl font-semibold text-gray-100 mb-4">🏆 {selectedCourse} Talent Leaderboard</h3> <TalentGraph talents={talentsLog} type="admin" getFirstName={getFirstName} /> </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-center mb-1">Ahnstoppable Learning:<br /><span className="text-orange-500">Freely Ask, Freely Learn</span></h1>
          <div className="flex flex-wrap justify-center gap-2 my-6"> {COURSES.map((course) => <button key={course} onClick={() => { setSelectedCourse(course); setNameInput(''); setStudentSelectedDate(''); }} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>)} </div>
          <select value={nameInput} onChange={(e) => {setNameInput(e.target.value); setStudentSelectedDate(new Date().toISOString().slice(0,10));}} disabled={!isFirebaseConnected} className="p-3 mb-6 w-full border bg-slate-700 border-slate-500 rounded-lg text-lg"> <option value="">Select your name...</option> {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)} </select>
          
          <div className={`${!isNameEntered || !isFirebaseConnected ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-center items-center space-x-2 my-4"> <label className="text-gray-300 text-lg">View My Posts for Date:</label> <input type="date" value={studentSelectedDate} onChange={(e) => setStudentSelectedDate(e.target.value)} className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-lg"/> </div>
            {/* --- NEW FEATURE 1: Daily Requirement UI --- */}
            <div className="text-center p-3 bg-slate-700 text-white rounded-lg mb-4">
                <p className="font-bold">Daily Requirement: 2 Talents (1 Q + 1 C)</p>
                <p className="text-sm">Today's Progress: 
                    <span className="mx-1">{dailyProgress.question ? '[✅ Question]' : '[❌ Question]'}</span>
                    <span className="mx-1">{dailyProgress.comment ? '[✅ Comment]' : '[❌ Comment]'}</span>
                </p>
            </div>

            {!isClassActive && isNameEntered && !!studentSelectedDate && <div className="text-center p-3 bg-red-800 text-white rounded-lg mb-4"><p>You can only submit responses during class time.</p></div>}
            <div className={`p-4 border border-slate-600 rounded-xl mb-6 ${!isReadyToParticipate ? 'opacity-50 pointer-events-none' : ''}`}>
              <ContentForm type="question" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} />
              <div className="my-4 border-t border-slate-700"></div>
              <ContentForm type="comment" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} />
            </div>
            <div className="flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg"> <img src="/talent-coin.png" alt="Talent coin" className="w-6 h-6 mr-2" /> <p className="font-bold text-lg">My Total Talents: {myTotalTalents}</p> </div>
            
            <div className="text-left p-4 border border-slate-600 rounded-xl mt-2">
              <h3 className="text-xl font-semibold text-gray-100 mb-2">My Talent History</h3>
              <ul className="text-sm space-y-1">{talentTransactions.map((log, i) => ( <li key={i} className={`p-1 flex justify-between items-center ${log.points > 0 ? 'text-green-400' : 'text-red-400'}`}> <span><span className="font-bold">{log.points > 0 ? `+${log.points}` : log.points}</span>: {log.type}</span> <span className="text-xs text-gray-500">({log.timestamp?.toDate().toLocaleDateString()})</span> </li> ))}</ul>
            </div>

            {studentSelectedDate && <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> <h3 className="text-xl font-semibold">My Posts for {studentSelectedDate}</h3> <ul>{studentActivityLog.map((log, i) => <li key={i} className="p-2 border-b border-slate-700 text-gray-300">[{log.type}]: {log.text}</li>)}</ul> </div> }
            
            <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> <h3 className="text-xl font-semibold text-gray-100 mb-4">Class Score Range</h3> <TalentGraph talents={talentsLog} type="student" getFirstName={getFirstName} /> </div>
          </div>
          <div className="flex flex-col items-center mt-8 p-4 border-t border-slate-600"> <p className="text-md font-medium text-gray-200 mb-2">Admin Login</p> <AdminLoginForm onAdminLogin={handleAdminLogin} /> </div>
        </>
      )}
    </div>
  );

  const PhotoGallery = () => ( <> <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap"> {[...Array(7)].map((_, i) => <img key={i} src={`/photo${i + 1}.jpg`} alt={`Gallery ${i + 1}`} className="h-24 sm:h-32 w-auto rounded-lg shadow-lg" />)} </div> <div className="flex justify-center items-center flex-grow my-4"><MainContent /></div> <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap"> {[...Array(7)].map((_, i) => <img key={i} src={`/photo${i + 8}.jpg`} alt={`Gallery ${i + 8}`} className="h-24 sm:h-32 w-auto rounded-lg shadow-lg" />)} </div> </> );
  return ( <div className="min-h-screen w-full bg-custom-beige-bg flex flex-col justify-between p-2 sm:p-4"> <PhotoGallery /> {showMessageBox && ( <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white p-6 rounded-xl text-center z-50"> {message} </div> )} </div> );
};

export default App;