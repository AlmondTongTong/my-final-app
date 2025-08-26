/* global __app_id */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, query, where, addDoc, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc, orderBy } from 'firebase/firestore';

const COURSES = ["ADV 375-01", "ADV 375-02", "ADV 461"];
const COURSE_STUDENTS = { "ADV 375-01": [ "Donovan, Robert", "Ellison, Alexis", "Futrell, Rylie", "George, Matthew", "Hammer, Olivia", "Kobayashi, Sena", "Lee, Byungho", "Mady, Gabriella", "Mawuenyega, Chloe", "Oved, Liam", "Sims, Ava", "Soke, Duru", "Walsh, William", "Warmington, Charles", "Yu, Wenbo" ], "ADV 375-02": [ "Alteio, Katherine", "Asatryan, Natalie", "Bondi, Ava", "Brown, Kylie", "Calabrese, Ella", "Dougherty, Quinn", "Dutton, Madeline", "Grabinger, Katharina", "Ju, Ashley", "Lahanas, Dean", "Lange, Bella-Soleil", "McQuilling, Louisa", "Milliman, Nicole", "Nizdil, Kennedy", "Salahieh, Zayd", "Shannon, Savannah", "Tang, Yuhan", "Walz, Lucy", "Wang, Michelle", "Wanke, Karsten" ], "ADV 461": [ "Bonk, Maya", "Burrow, Elizabeth", "Campos, Victoria", "Cantada, Cristian", "Chong, Timothy", "Chung, Sooa", "Cwiertnia, Zachary", "Fernandez, Francisco", "Fok, Alexis", "Gilbert, Jasmine", "Hall, Lily", "Hosea, Nicholas", "Jang, Da Eun", "Kim, Lynn", "Kim, Noelle", "Koning, William", "Lee, Edmund", "Lewandowski, Luke", "Leyson, Noah", "Lopez, Tatum", "Murphy, Alexander", "Swendsen, Katherine" ], };

const isWithinClassTime = (courseName) => {
    const now = new Date(); const losAngelesTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const day = losAngelesTime.getDay(), hour = losAngelesTime.getHours(), minute = losAngelesTime.getMinutes(); const currentTimeInMinutes = hour * 60 + minute;
    switch(courseName) {
        case "ADV 375-01": if (day === 1 || day === 4) { const startTime = 8 * 60, endTime = 9 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        case "ADV 375-02": if (day === 1 || day === 4) { const startTime = 12 * 60, endTime = 13 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        case "ADV 461": if (day === 3) { const startTime = 12 * 60, endTime = 15 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        default: return false;
    }
};

const TalentGraph = ({ talentsData, type, selectedCourse, getFirstName }) => {
    const displayData = useMemo(() => {
        const courseRoster = COURSE_STUDENTS[selectedCourse] || [];
        const talentMap = new Map(talentsData.map(t => [t.id, t.totalTalents]));
        const allStudents = courseRoster.map(name => ({ id: name, name: name, totalTalents: talentMap.get(name) || 0, }));
        const sorted = allStudents.sort((a, b) => b.totalTalents - a.totalTalents);
        if (type === 'admin') { return sorted; } 
        else if (type === 'student' && sorted.length > 0) { const highest = sorted[0]; const lowest = sorted[sorted.length - 1]; return highest.id === lowest.id ? [highest] : [highest, lowest]; }
        return [];
    }, [talentsData, selectedCourse, type]);
    if (displayData.length === 0) return <p className="text-gray-400">No talent data yet.</p>;
    const maxScore = displayData.length > 0 ? displayData[0].totalTalents : 0;
    return ( <div className="space-y-2"> {displayData.map(talent => ( <div key={talent.id} className="w-full"> <div className="flex justify-between text-sm text-gray-300 mb-1"> <span>{type === 'admin' ? getFirstName(talent.name) : (talent.id === displayData[0].id ? 'Highest Score' : 'Lowest Score')}</span> <span>{talent.totalTalents}</span> </div> <div className="w-full bg-slate-600 rounded-full h-4"> <div className="bg-yellow-400 h-4 rounded-full" style={{ width: maxScore > 0 ? `${(talent.totalTalents / maxScore) * 100}%` : '0%' }} ></div> </div> </div> ))} </div> );
};

const ContentForm = React.memo(({ type, onAddContent, isEnabled, placeholder }) => { const [text, setText] = useState(''); const handleSubmit = (event) => { event.preventDefault(); if (text.trim()) { onAddContent(text, type); setText(''); } }; return ( <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2"> <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} disabled={!isEnabled} className="flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-lg resize-none h-24" /> <button type="submit" disabled={!isEnabled || !text.trim()} className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 self-end sm:self-center" > Add </button> </form> ); });
const AdminLoginForm = ({ onAdminLogin }) => { const [password, setPassword] = useState(''); const handleLogin = () => { onAdminLogin(password); }; return ( <div className="flex space-x-2"> <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="p-2 border bg-slate-700 border-slate-500 rounded-lg text-sm" /> <button onClick={handleLogin} className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg">Login</button> </div> ); };
const PinAuth = React.memo(({ nameInput, isPinRegistered, onLogin, onRegister, getFirstName }) => { const [pinInput, setPinInput] = useState(''); const [pinConfirmationInput, setPinConfirmationInput] = useState(''); const handleLoginClick = () => { onLogin(pinInput); setPinInput(''); }; const handleRegisterClick = () => { onRegister(pinInput, pinConfirmationInput); setPinInput(''); setPinConfirmationInput(''); }; if (!nameInput) return null; return isPinRegistered ? ( <div className="my-4 p-4 bg-slate-700 rounded-lg animate-fade-in"> <p className="text-center text-white mb-2 font-semibold">Enter your 4-digit PIN, {getFirstName(nameInput)}.</p> <div className="flex space-x-2"> <input type="password" inputMode="numeric" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="flex-1 p-3 border bg-slate-600 border-slate-500 rounded-lg text-lg text-center"/> <button onClick={handleLoginClick} className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold">Login</button> </div> </div> ) : ( <div className="my-4 p-4 bg-slate-700 rounded-lg animate-fade-in"> <p className="text-center text-white mb-2 font-semibold">First time? Create your 4-digit PIN.<br/><span className="text-sm font-normal">(Use the last 4 digits of your Student ID)</span></p> <div className="space-y-2"> <input type="password" inputMode="numeric" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Create 4-digit PIN" className="w-full p-3 border bg-slate-600 border-slate-500 rounded-lg text-lg text-center"/> <input type="password" inputMode="numeric" maxLength="4" value={pinConfirmationInput} onChange={(e) => setPinConfirmationInput(e.target.value)} placeholder="Confirm PIN" className="w-full p-3 border bg-slate-600 border-slate-500 rounded-lg text-lg text-center"/> <button onClick={handleRegisterClick} className="w-full p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold">Register & Start</button> </div> </div> ); });

const App = () => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const [db, setDb] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0]);
  const [isAdmin, setIsAdmin] = useState(false);
  const ADMIN_PASSWORD = '0811';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPinRegistered, setIsPinRegistered] = useState(false);
  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [isClassActive, setIsClassActive] = useState(false);
  const [talentsLog, setTalentsLog] = useState([]);
  const [studentSelectedDate, setStudentSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyProgress, setDailyProgress] = useState({ question_comment: 0, reasoning: 0 });
  const [myTotalTalents, setMyTotalTalents] = useState(0);
  const [talentTransactions, setTalentTransactions] = useState([]);
  const [studentActivityLog, setStudentActivityLog] = useState([]);
  const [studentFeedbackLog, setStudentFeedbackLog] = useState([]);
  const [clickedButton, setClickedButton] = useState(null);
  const [adminSelectedDate, setAdminSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adminSelectedStudent, setAdminSelectedStudent] = useState('');
  const [adminStudentLog, setAdminStudentLog] = useState([]);
  const [questionsLog, setQuestionsLog] = useState([]);
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [gradedPosts, setGradedPosts] = useState(new Set());
  const [allPostsLog, setAllPostsLog] = useState([]);
  
  const showMessage = useCallback((msg) => { setMessage(msg); setShowMessageBox(true); setTimeout(() => { setShowMessageBox(false); setMessage(''); }, 3000); }, []);
  const getFirstName = useCallback((fullName) => { if (!fullName) return ''; const parts = fullName.split(', '); return parts.length > 1 ? parts[1] : parts[0]; }, []);

  useEffect(() => { const firebaseConfig = { apiKey: "AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U", authDomain: "ahnstoppable-learning.firebaseapp.com", projectId: "ahnstoppable-learning" }; const app = initializeApp(firebaseConfig); const auth = getAuth(app); setDb(getFirestore(app)); signInAnonymously(auth).catch(console.error); }, []);
  useEffect(() => { if (!db || !nameInput) { setIsPinRegistered(false); return; } const checkPin = async () => { const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput); const docSnap = await getDoc(pinDocRef); setIsPinRegistered(docSnap.exists()); }; checkPin(); }, [db, nameInput, appId]);
  const handleNameChange = (newName) => { setNameInput(newName); setIsAuthenticated(false); };

  const handlePinLogin = useCallback(async (pin) => { if (!db || !nameInput) return showMessage("Please select your name first."); const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput); try { const docSnap = await getDoc(pinDocRef); if (docSnap.exists() && docSnap.data().pin === pin) { setIsAuthenticated(true); showMessage(`Welcome, ${getFirstName(nameInput)}!`); } else { showMessage("Incorrect PIN."); } } catch (e) { showMessage("Login error.");} }, [db, nameInput, appId, getFirstName, showMessage]);
  const handlePinRegister = useCallback(async (pin, confirmation) => { if (!db || !nameInput) return showMessage("Please select your name first."); if (pin.length !== 4) return showMessage("PIN must be 4 digits."); if (pin !== confirmation) return showMessage("PINs do not match."); const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput); try { await setDoc(pinDocRef, { pin }); setIsAuthenticated(true); showMessage(`PIN registered! Welcome, ${getFirstName(nameInput)}!`); } catch (e) { showMessage("Error registering PIN."); } }, [db, nameInput, appId, getFirstName, showMessage]);

  useEffect(() => { const checkTime = () => setIsClassActive(isWithinClassTime(selectedCourse)); checkTime(); const interval = setInterval(checkTime, 30000); return () => clearInterval(interval); }, [selectedCourse]);
  useEffect(() => { if (!db) return; const talentsQuery = query(collection(db, `/artifacts/${appId}/public/data/talents`), where("course", "==", selectedCourse)); const unsub = onSnapshot(talentsQuery, (snap) => setTalentsLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))); return () => unsub(); }, [db, selectedCourse, appId]);

  useEffect(() => { if (!db || !isAdmin) return; const questionsQuery = query(collection(db, `/artifacts/${appId}/public/data/questions`), where("course", "==", selectedCourse), where("date", "==", adminSelectedDate), orderBy("timestamp", "desc")); const unsubQ = onSnapshot(questionsQuery, (snap) => setQuestionsLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))); const feedbackQuery = query(collection(db, `/artifacts/${appId}/public/data/feedback`), where("course", "==", selectedCourse), where("date", "==", adminSelectedDate), orderBy("timestamp", "desc")); const unsubF = onSnapshot(feedbackQuery, (snap) => setFeedbackLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))); return () => { unsubQ(); unsubF(); }; }, [db, selectedCourse, adminSelectedDate, appId, isAdmin]);
  useEffect(() => { if (!db || !isAdmin || !adminSelectedStudent) { setAdminStudentLog([]); return; }; const logQuery = query(collection(db, `/artifacts/${appId}/public/data/questions`), where("course", "==", selectedCourse), where("name", "==", adminSelectedStudent), orderBy("timestamp", "desc")); const unsub = onSnapshot(logQuery, (snap) => setAdminStudentLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))); return () => unsub(); }, [db, selectedCourse, adminSelectedStudent, appId, isAdmin]);

  useEffect(() => {
    if (!db || isAdmin || !nameInput || !isAuthenticated) { setStudentActivityLog([]); setAllPostsLog([]); setMyTotalTalents(0); setTalentTransactions([]); setDailyProgress({ question_comment: 0, reasoning: 0 }); setStudentFeedbackLog([]); return; }
    const transactionsQuery = query(collection(db, `/artifacts/${appId}/public/data/talentTransactions`), where("name", "==", nameInput), orderBy("timestamp", "desc")); const unsubT = onSnapshot(transactionsQuery, (snap) => setTalentTransactions(snap.docs.map(d => d.data())));
    const talentDocRef = doc(db, `/artifacts/${appId}/public/data/talents`, nameInput); const unsubM = onSnapshot(talentDocRef, (d) => setMyTotalTalents(d.exists() ? d.data().totalTalents : 0));
    
    const activityQuery = query(collection(db, `/artifacts/${appId}/public/data/questions`), where("course", "==", selectedCourse), where("name", "==", nameInput), where("date", "==", studentSelectedDate), orderBy("timestamp", "desc"));
    const unsubA = onSnapshot(activityQuery, (snap) => {
      const activities = snap.docs.map(d => ({id: d.id, ...d.data()}));
      setStudentActivityLog(activities);
      setDailyProgress({ question_comment: activities.filter(a => a.type === 'question_comment').length, reasoning: activities.filter(a => a.type === 'reasoning').length });
    });
    const allPostsQuery = query(collection(db, `/artifacts/${appId}/public/data/questions`), where("course", "==", selectedCourse), where("date", "==", studentSelectedDate), orderBy("timestamp", "desc"));
    const unsubAll = onSnapshot(allPostsQuery, (snap) => setAllPostsLog(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const feedbackQuery = query(collection(db, `/artifacts/${appId}/public/data/feedback`), where("course", "==", selectedCourse), where("name", "==", nameInput), where("date", "==", studentSelectedDate), orderBy("timestamp", "desc"));
    const unsubF = onSnapshot(feedbackQuery, (snap) => setStudentFeedbackLog(snap.docs.map(d => d.data())));

    return () => { unsubA(); unsubM(); unsubT(); unsubF(); unsubAll(); };
  }, [db, selectedCourse, nameInput, studentSelectedDate, appId, isAdmin, isAuthenticated]);

  const modifyTalent = useCallback(async (studentName, amount, type, logId) => { if (!db) return; const talentDocRef = doc(db, `/artifacts/${appId}/public/data/talents`, studentName); const transactionColRef = collection(db, `/artifacts/${appId}/public/data/talentTransactions`); try { const docSnap = await getDoc(talentDocRef); let currentTalents = docSnap.exists() ? docSnap.data().totalTalents || 0 : 0; const newTotal = currentTalents + amount; if (newTotal < 0) { showMessage("Talent cannot go below 0."); return; } if (docSnap.exists()) { await updateDoc(talentDocRef, { totalTalents: newTotal }); } else { await setDoc(talentDocRef, { name: studentName, course: selectedCourse, totalTalents: newTotal }); } if(type !== 'automatic') showMessage(`${getFirstName(studentName)} received ${amount > 0 ? '+1' : '-1'} Talent!`); await addDoc(transactionColRef, { name: studentName, points: amount, type: type, timestamp: serverTimestamp() }); if(logId) setGradedPosts(prev => new Set(prev).add(logId)); } catch(e) { console.error("Error modifying talent: ", e); } }, [db, appId, selectedCourse, getFirstName, showMessage]);
  const handleAddContent = useCallback(async (text, type) => { if (!db || !nameInput.trim() || !text.trim()) return; const today = new Date().toISOString().slice(0, 10); try { const docRef = await addDoc(collection(db, `/artifacts/${appId}/public/data/questions`), { name: nameInput, text, type, course: selectedCourse, date: today, timestamp: serverTimestamp(), studentLiked: false, adminLiked: false }); showMessage("Submission complete! ✅"); await modifyTalent(nameInput, 1, 'automatic', docRef.id); } catch (e) { showMessage("Submission failed. ❌"); } }, [db, nameInput, selectedCourse, appId, modifyTalent, showMessage]);
  const handleFeedback = useCallback(async (status) => { if (!db || !nameInput.trim()) return showMessage("Please select your name first."); setClickedButton(status); setTimeout(() => setClickedButton(null), 1500); try { await addDoc(collection(db, `/artifacts/${appId}/public/data/feedback`), { name: nameInput, status, course: selectedCourse, date: new Date().toISOString().slice(0, 10), timestamp: serverTimestamp() }); showMessage("Feedback submitted!"); } catch (e) { showMessage("Failed to submit feedback."); } }, [db, nameInput, selectedCourse, appId, showMessage]);
  const handleAdminLogin = (password) => { if (password === ADMIN_PASSWORD) { setIsAdmin(true); showMessage("Admin Login successful! 🔑"); } else { showMessage("Incorrect password. 🚫"); } };
  const handleReply = useCallback(async (logId, replyText) => { if (!db || !replyText.trim()) return; const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId); try { await updateDoc(questionDocRef, { reply: replyText }); showMessage("Reply sent!"); } catch (e) { showMessage("Failed to send reply."); console.error(e); } }, [db, appId, showMessage]);
  const handleStudentLike = useCallback(async (logId) => { if(!db) return; const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId); try { await updateDoc(questionDocRef, { studentLiked: true }); } catch (e) { console.error("Error (student like):", e) } }, [db, appId]);
  const handleAdminLike = useCallback(async (logId) => { if(!db) return; const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId); try { await updateDoc(questionDocRef, { adminLiked: true }); showMessage("Liked!"); } catch (e) { console.error("Error (admin like):", e) } }, [db, appId, showMessage]);
  
  const isNameEntered = nameInput.trim().length > 0;
  const isReadyToParticipate = isAuthenticated && isClassActive;

  const adminDailyProgress = useMemo(() => { const roster = COURSE_STUDENTS[selectedCourse] || []; const initialProgress = roster.reduce((acc, studentName) => { acc[studentName] = { question_comment: 0, reasoning: 0 }; return acc; }, {}); questionsLog.forEach(log => { if (initialProgress[log.name]) { if (log.type === 'question_comment') initialProgress[log.name].question_comment++; if (log.type === 'reasoning') initialProgress[log.name].reasoning++; } }); return initialProgress; }, [questionsLog, selectedCourse]);
  const ReplyForm = ({ log, onReply }) => { const [replyText, setReplyText] = useState(''); const handleSend = () => { onReply(log.id, replyText); setReplyText(''); }; return ( <div className="mt-2 flex items-center space-x-2"> <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Reply to ${getFirstName(log.name)}...`} className="flex-1 p-2 border bg-slate-600 border-slate-500 rounded-lg text-sm" /> <button onClick={handleSend} className="p-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg">Send</button> <button onClick={() => onReply(log.id, "Addressed in class")} className="p-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg whitespace-nowrap">Addressed in Class</button> </div> ); };

  const MainContent = () => (
    <div className="w-full max-w-lg p-6 bg-slate-800 text-white rounded-xl shadow-lg box-shadow-custom">
      {isAdmin ? (
        <>
          <h1 className="text-3xl font-bold text-center mb-4">''Ahn''stoppable Learning</h1>
          <button onClick={() => setIsAdmin(false)} className="mb-4 p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700">Back to student view</button>
          <div className="flex flex-wrap justify-center gap-2 mb-6"> {COURSES.map((course) => <button key={course} onClick={() => setSelectedCourse(course)} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>)} </div>
          <select value={adminSelectedStudent} onChange={(e) => setAdminSelectedStudent(e.target.value)} className="p-3 mb-6 w-full border bg-slate-700 border-slate-500 rounded-lg text-lg"> <option value="">-- View Daily Log --</option> {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)} </select>
          {adminSelectedStudent ? (
            <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
              <h3 className="text-xl font-semibold">All Logs for {getFirstName(adminSelectedStudent)}</h3>
              <div className="flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg"> <img src="/talent-coin.png" alt="Talent coin" className="w-6 h-6 mr-2" /> <p className="font-bold text-lg">Total Talents: {talentsLog.find(t => t.id === adminSelectedStudent)?.totalTalents || 0}</p> </div>
              <ul>{adminStudentLog.map((log) => ( <li key={log.id} className="p-2 border-b border-slate-700 text-gray-300"> <div className="flex justify-between items-start"> <span className="flex-1 mr-2"><span className="font-bold">{log.date}</span> [{log.type}]: {log.text}</span> <div className="flex items-center space-x-1 flex-shrink-0"> <button onClick={() => !log.adminLiked && handleAdminLike(log.id)} disabled={log.adminLiked} className="text-2xl disabled:opacity-50">{log.adminLiked ? '👍' : '👍'}</button> {gradedPosts.has(log.id) && <span className="text-green-500 text-xl">✅</span>} <button onClick={() => modifyTalent(log.name, -1, 'penalty', log.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700">-1</button> <button onClick={() => modifyTalent(log.name, 1, 'bonus', log.id)} className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded hover:bg-yellow-600">+1</button> </div> </div> {log.reply && <div className="mt-2 p-2 bg-slate-700 rounded-lg text-sm text-gray-300"><b>Reply:</b> {log.reply} {log.studentLiked && <span className="ml-2">👍 by student</span>}</div>} <ReplyForm log={log} onReply={handleReply} /> </li> ))}</ul>
            </div>
          ) : (
            <>
              <div className="flex justify-center items-center space-x-2 mb-6"> <label className="text-gray-300 text-lg">View Logs for Date:</label> <input type="date" value={adminSelectedDate} onChange={(e) => setAdminSelectedDate(e.target.value)} className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-lg"/> </div>
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> <h3 className="text-xl font-semibold mb-2">Daily Requirement Progress</h3> <ul className="space-y-1 text-sm h-40 overflow-y-auto">{Object.entries(adminDailyProgress).map(([name, progress]) => { const qcMet = progress.question_comment >= 2; const rMet = progress.reasoning >= 2; return ( <li key={name} className="flex justify-between items-center pr-2"> <span>{getFirstName(name)}:</span> <span> <span className={qcMet ? 'text-green-400' : 'text-red-400'}>{qcMet ? '✅' : '❌'} {progress.question_comment}/2 Q/C</span> / <span className={rMet ? 'text-green-400' : 'text-red-400'}>{rMet ? '✅' : '❌'} {progress.reasoning}/2 R</span> </span> </li> ); })}</ul> </div>
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> <h3 className="text-xl font-semibold">🚦 Daily Understanding Check</h3> <ul className="h-24 overflow-y-auto">{feedbackLog.map((log) => ( <li key={log.id} className="p-2 border-b border-slate-700 text-gray-300">({log.timestamp?.toDate().toLocaleTimeString()}) {getFirstName(log.name)}: {log.status}</li> ))}</ul> </div>
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> <h3 className="text-xl font-semibold">❓ Daily Posts</h3> <ul>{questionsLog.map((log) => ( <li key={log.id} className="p-2 border-b border-slate-700 text-gray-300"> <div className="flex justify-between items-start"> <span className="flex-1 mr-2">{getFirstName(log.name)} [{log.type}]: {log.text} {log.adminLiked && <span className="ml-2">👍</span>}</span> <div className="flex items-center space-x-1 flex-shrink-0"> <button onClick={() => !log.adminLiked && handleAdminLike(log.id)} disabled={log.adminLiked} className="text-2xl disabled:opacity-50">{log.adminLiked ? '👍' : '👍'}</button> {gradedPosts.has(log.id) && <span className="text-green-500 text-xl">✅</span>} <button onClick={() => modifyTalent(log.name, -1, 'penalty', log.id)} className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700">-1</button> <button onClick={() => modifyTalent(log.name, 1, 'bonus', log.id)} className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded hover:bg-yellow-600">+1</button> </div> </div> {log.reply && <div className="mt-2 p-2 bg-slate-700 rounded-lg text-sm text-gray-300"><b>Reply:</b> {log.reply} {log.studentLiked && <span className="ml-2">👍 by student</span>}</div>} <ReplyForm log={log} onReply={handleReply} /></li> ))}</ul> </div>
            </>
          )}
          <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> <h3 className="text-xl font-semibold text-gray-100 mb-4">🏆 {selectedCourse} Talent Leaderboard</h3> <TalentGraph talentsData={talentsLog} type="admin" selectedCourse={selectedCourse} getFirstName={getFirstName} /> </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-center mb-1">''Ahn''stoppable Learning:<br /><span className="text-orange-500">Freely Ask, Freely Learn</span></h1>
          <div className="flex flex-wrap justify-center gap-2 my-6"> {COURSES.map((course) => <button key={course} onClick={() => { setSelectedCourse(course); handleNameChange(''); }} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>)} </div>
          <select value={nameInput} onChange={(e) => handleNameChange(e.target.value)} disabled={isAuthenticated} className="p-3 mb-2 w-full border bg-slate-700 border-slate-500 rounded-lg text-lg disabled:opacity-50"> <option value="">Select your name...</option> {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)} </select>
          {isNameEntered && !isAuthenticated && <PinAuth nameInput={nameInput} isPinRegistered={isPinRegistered} onLogin={handlePinLogin} onRegister={handlePinRegister} getFirstName={getFirstName} />}

          {isAuthenticated && (
            <div className="mt-4 animate-fade-in">
              <div className="flex justify-center items-center space-x-2 my-4"> <label className="text-gray-300 text-lg">View Logs for Date:</label> <input type="date" value={studentSelectedDate} onChange={(e) => setStudentSelectedDate(e.target.value)} className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-lg"/> </div>
              {!isClassActive && <div className="text-center p-3 bg-red-800 text-white rounded-lg mb-4"><p>You can only submit new responses during class time.</p></div>}
              
              <div className={`p-4 border border-slate-600 rounded-xl mb-6 ${!isReadyToParticipate ? 'opacity-50 pointer-events-none' : ''}`}>
                <p className="text-xl font-medium text-center text-gray-200">Understanding Check</p>
                <div className="flex justify-center space-x-4 mt-2">
                  <button onClick={() => handleFeedback('Not Understood 🙁')} className={`p-4 w-16 h-16 rounded-full bg-red-500 flex justify-center items-center text-2xl ${clickedButton === 'Not Understood 🙁' ? 'ring-4 ring-orange-500' : ''}`}>🙁</button>
                  <button onClick={() => handleFeedback('Confused 🤔')} className={`p-4 w-16 h-16 rounded-full bg-yellow-400 flex justify-center items-center text-2xl ${clickedButton === 'Confused 🤔' ? 'ring-4 ring-orange-500' : ''}`}>🤔</button>
                  <button onClick={() => handleFeedback('Got It! ✅')} className={`p-4 w-16 h-16 rounded-full bg-green-500 flex justify-center items-center text-2xl ${clickedButton === 'Got It! ✅' ? 'ring-4 ring-orange-500' : ''}`}>✅</button>
                </div>
              </div>
              <div className="text-center p-3 bg-slate-700 text-white rounded-lg mb-4"> <p className="font-bold">Daily Requirement: 4 Talents (2 Q/C + 2 Reasoning)</p> <p className="text-sm">Today's Progress: <span className={`mx-1 ${dailyProgress.question_comment >= 2 ? 'text-green-400' : 'text-red-400'}`}>[{dailyProgress.question_comment}/2 Q/C]</span> <span className={`mx-1 ${dailyProgress.reasoning >= 2 ? 'text-green-400' : 'text-red-400'}`}>[{dailyProgress.reasoning}/2 Reasoning]</span></p> </div>
              
              <div className={`p-4 border border-slate-600 rounded-xl mb-6 ${!isReadyToParticipate ? 'opacity-50 pointer-events-none' : ''}`}>
                <ContentForm type="question_comment" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} placeholder="Post 2 Questions/Comments..." />
                <div className="my-4 border-t border-slate-700"></div>
                <ContentForm type="reasoning" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} placeholder="Post 2 Reasoning posts..." />
              </div>
              <div className="flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg"> <img src="/talent-coin.png" alt="Talent coin" className="w-6 h-6 mr-2" /> <p className="font-bold text-lg">My Total Talents: {myTotalTalents}</p> </div>
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-2"> <h3 className="text-xl font-semibold text-gray-100 mb-2">My Talent History</h3> <ul className="text-sm space-y-1">{talentTransactions.map((log, i) => ( <li key={i} className={`p-1 flex justify-between items-center ${log.points > 0 ? 'text-green-400' : 'text-red-400'}`}> <span><span className="font-bold">{log.points > 0 ? `+${log.points}` : log.points}</span>: {log.type}</span> <span className="text-xs text-gray-500">({log.timestamp?.toDate().toLocaleDateString()})</span> </li> ))}</ul> </div>
              {studentSelectedDate && <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> 
                <h3 className="text-xl font-semibold">Logs for {studentSelectedDate}</h3> 
                <h4 className="font-semibold mt-2 text-gray-300">🚦 My Understanding Checks</h4> <ul>{studentFeedbackLog.map((log, i) => <li key={i} className="p-2 border-b border-slate-700 text-gray-300">({log.timestamp?.toDate().toLocaleTimeString()}): {log.status}</li>)}</ul> 
                <h4 className="font-semibold mt-4 text-gray-300">✍️ My Posts</h4> <ul>{studentActivityLog.map((log) => <li key={log.id} className="p-2 border-b border-slate-700 text-gray-300"><div>{log.adminLiked && <span className="mr-2 text-yellow-400">👍 by Prof. Ahn</span>}[{log.type}]: {log.text}</div> {log.reply && <div className="mt-2 p-2 bg-slate-600 rounded-lg text-sm text-gray-200 flex justify-between items-center"><span><b>Prof. Ahn's Reply:</b> {log.reply}</span> <button onClick={() => !log.studentLiked && handleStudentLike(log.id)} disabled={log.studentLiked} className="ml-2 text-2xl disabled:opacity-50">{log.studentLiked ? '👍' : '👍'}</button> </div>} </li>)}</ul>
                <h4 className="font-semibold mt-4 text-gray-300">👀 All Anonymous Posts</h4> <ul className="h-40 overflow-y-auto">{allPostsLog.map((log) => <li key={log.id} className="p-2 border-b border-slate-700 text-gray-300"><div>{log.adminLiked && <span className="mr-2">👍</span>}[{log.type}]: {log.text}</div> {log.reply && <div className="mt-2 p-2 bg-slate-600 rounded-lg text-sm text-gray-200"><b>Prof. Ahn's Reply:</b> {log.reply}</div>} </li>)}</ul>
              </div> }
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6"> <h3 className="text-xl font-semibold text-gray-100 mb-4">Class Score Range</h3> <TalentGraph talentsData={talentsLog} type="student" selectedCourse={selectedCourse} getFirstName={getFirstName} /> </div>
            </div>
          )}
        </>
      )}
      <div className="flex flex-col items-center mt-8 p-4 border-t border-slate-600"> <p className="text-md font-medium text-gray-200 mb-2">Admin Login</p> <AdminLoginForm onAdminLogin={handleAdminLogin} /> </div>
    </div>
  );

  const PhotoGallery = () => ( <> <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap"> {[...Array(7)].map((_, i) => <img key={i} src={`/photo${i + 1}.jpg`} alt={`Gallery ${i + 1}`} className="h-24 sm:h-32 w-auto rounded-lg shadow-lg" />)} </div> <div className="flex justify-center items-center flex-grow my-4"><MainContent /></div> <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap"> {[...Array(7)].map((_, i) => <img key={i} src={`/photo${i + 8}.jpg`} alt={`Gallery ${i + 8}`} className="h-24 sm:h-32 w-auto rounded-lg shadow-lg" />)} </div> </> );
  return ( <div className="min-h-screen w-full bg-custom-beige-bg flex flex-col justify-between p-2 sm:p-4"> <PhotoGallery /> {showMessageBox && ( <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white p-6 rounded-xl text-center z-50"> {message} </div> )} </div> );
};

export default App;