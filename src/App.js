/* global __app_id, __initial_auth_token */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, query, where, addDoc, onSnapshot, serverTimestamp, doc, setDoc, getDoc, increment } from 'firebase/firestore';

// Define the courses and a hardcoded list of students for each course.
const COURSES = ["ADV 375-01", "ADV 375-02", "ADV 461"];
const COURSE_STUDENTS = {
  "ADV 375-01": [ "Donovan, Robert", "Ellison, Alexis", "Futrell, Rylie", "George, Matthew", "Hammer, Olivia", "Kobayashi, Sena", "Lee, Byungho", "Mady, Gabriella", "Mawuenyega, Chloe", "Oved, Liam", "Sims, Ava", "Soke, Duru", "Walsh, William", "Warmington, Charles", "Yu, Wenbo" ],
  "ADV 375-02": [ "Alteio, Katherine", "Asatryan, Natalie", "Bondi, Ava", "Brown, Kylie", "Calabrese, Ella", "Dougherty, Quinn", "Dutton, Madeline", "Grabinger, Katharina", "Ju, Ashley", "Lahanas, Dean", "Lange, Bella-Soleil", "McQuilling, Louisa", "Milliman, Nicole", "Nizdil, Kennedy", "Salahieh, Zayd", "Shannon, Savannah", "Tang, Yuhan", "Walz, Lucy", "Wang, Michelle", "Wanke, Karsten" ],
  "ADV 461": [ "Bonk, Maya", "Burrow, Elizabeth", "Campos, Victoria", "Cantada, Cristian", "Chong, Timothy", "Chung, Sooa", "Cwiertnia, Zachary", "Fernandez, Francisco", "Fok, Alexis", "Gilbert, Jasmine", "Hall, Lily", "Hosea, Nicholas", "Jang, Da Eun", "Kim, Lynn", "Kim, Noelle", "Koning, William", "Lee, Edmund", "Lewandowski, Luke", "Leyson, Noah", "Lopez, Tatum", "Murphy, Alexander", "Swendsen, Katherine" ],
};

// Main App component
const App = () => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const token = useMemo(() => typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null, []);
  
  const firebaseConfig = useMemo(() => ({
      apiKey: "AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U",
      authDomain: "ahnstoppable-learning.firebaseapp.com",
      projectId: "ahnstoppable-learning",
      storageBucket: "ahnstoppable-learning.firebasestorage.app",
      messagingSenderId: "365013467715",
      appId: "1:365013467715:web:113e63c822fae43123caf6",
      measurementId: "G-MT9ETH31MY"
  }), []);

  const [db, setDb] = useState(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0]);
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [questionsLog, setQuestionsLog] = useState([]);
  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [clickedButton, setClickedButton] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const ADMIN_PASSWORD = '0811';

  // --- RE-ADDED: Separate date states for admin and student ---
  const [adminSelectedDate, setAdminSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [studentSelectedDate, setStudentSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [talentsLog, setTalentsLog] = useState([]);
  const [myTotalTalents, setMyTotalTalents] = useState(0);
  
  const showMessage = useCallback((msg) => {
    setMessage(msg);
    setShowMessageBox(true);
    setTimeout(() => {
      setShowMessageBox(false);
      setMessage('');
    }, 3000);
  }, []);

  const getFirstName = (fullName) => {
    const parts = fullName.split(', ');
    return parts.length > 1 ? parts[1] : parts[0];
  };

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const dbInstance = getFirestore(app);
        setDb(dbInstance);
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
        setIsFirebaseConnected(true);
      } catch (e) {
        console.error("Firebase initialization failed:", e);
        setIsFirebaseConnected(false);
      }
    };
    initializeFirebase();
  }, [token, firebaseConfig]);

  // --- MODIFIED: useEffect for Admin to fetch data for adminSelectedDate ---
  useEffect(() => {
    if (!isFirebaseConnected || !db || !isAdmin) return;
    const publicDataPath = `/artifacts/${appId}/public/data`;
    const feedbackQuery = query(collection(db, `${publicDataPath}/feedback`), where("course", "==", selectedCourse), where("date", "==", adminSelectedDate));
    const questionsQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("date", "==", adminSelectedDate));
    const talentsQuery = query(collection(db, `${publicDataPath}/talents`), where("course", "==", selectedCourse));

    const unsubFeedback = onSnapshot(feedbackQuery, (snap) => setFeedbackLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));
    const unsubQuestions = onSnapshot(questionsQuery, (snap) => setQuestionsLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));
    const unsubTalents = onSnapshot(talentsQuery, (snap) => setTalentsLog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.totalTalents - a.totalTalents)));

    return () => { unsubFeedback(); unsubQuestions(); unsubTalents(); };
  }, [isFirebaseConnected, db, selectedCourse, adminSelectedDate, appId, isAdmin]);

  // --- MODIFIED: useEffect for Students to fetch data for studentSelectedDate ---
  useEffect(() => {
    if (!isFirebaseConnected || !db || isAdmin || !nameInput) {
      setFeedbackLog([]);
      setQuestionsLog([]);
      setMyTotalTalents(0);
      return;
    }
    const publicDataPath = `/artifacts/${appId}/public/data`;
    const feedbackQuery = query(collection(db, `${publicDataPath}/feedback`), where("course", "==", selectedCourse), where("name", "==", nameInput), where("date", "==", studentSelectedDate));
    const questionsQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("name", "==", nameInput), where("date", "==", studentSelectedDate));
    const talentDocRef = doc(db, `${publicDataPath}/talents`, nameInput);

    const unsubFeedback = onSnapshot(feedbackQuery, (snap) => setFeedbackLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));
    const unsubQuestions = onSnapshot(questionsQuery, (snap) => setQuestionsLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));
    const unsubMyTalent = onSnapshot(talentDocRef, (doc) => {
        if (doc.exists()) {
            setMyTotalTalents(doc.data().totalTalents);
        } else {
            setMyTotalTalents(0);
        }
    });
    
    return () => { unsubFeedback(); unsubQuestions(); unsubMyTalent(); };
  }, [isFirebaseConnected, db, selectedCourse, nameInput, studentSelectedDate, appId, isAdmin]);

  const handleFeedback = async (status) => {
    if (!nameInput.trim()) return showMessage("Please select your name first.");
    if (!isFirebaseConnected || !db) return showMessage("DB connection issue. Please try again. ⏳");
    
    setClickedButton(status);
    setTimeout(() => setClickedButton(null), 1500);

    try {
      const publicDataPath = `/artifacts/${appId}/public/data`;
      await addDoc(collection(db, `${publicDataPath}/feedback`), { name: nameInput, status, course: selectedCourse, date: new Date().toISOString().slice(0, 10), timestamp: serverTimestamp() });
      showMessage("Feedback submitted! ✅");
    } catch (e) {
      console.error("Error adding feedback: ", e);
      showMessage("Failed to submit feedback. ❌");
    }
  };

  const handleAddContent = async (event, type) => {
    event.preventDefault();
    const text = type === 'question' ? questionInput : commentInput;
    if (!nameInput.trim() || !text.trim()) return showMessage("Please select your name and enter a message.");
    if (!isFirebaseConnected || !db) return showMessage("DB connection issue. Please try again. ⏳");

    try {
      const publicDataPath = `/artifacts/${appId}/public/data`;
      await addDoc(collection(db, `${publicDataPath}/questions`), { name: nameInput, text, type, course: selectedCourse, date: new Date().toISOString().slice(0, 10), timestamp: serverTimestamp() });
      showMessage("Submission complete! ✅");
      if (type === 'question') setQuestionInput('');
      else setCommentInput('');
    } catch (e) {
      console.error("Error adding content: ", e);
      showMessage("Submission failed. ❌");
    }
  };

  const handleGiveTalent = async (studentName) => {
    if (!db) return showMessage("DB connection issue.");
    const publicDataPath = `/artifacts/${appId}/public/data`;
    const talentDocRef = doc(db, `${publicDataPath}/talents`, studentName);
    
    try {
        const docSnap = await getDoc(talentDocRef);
        if (docSnap.exists()) {
            await setDoc(talentDocRef, { totalTalents: increment(1) }, { merge: true });
        } else {
            await setDoc(talentDocRef, { name: studentName, course: selectedCourse, totalTalents: 1 });
        }
        showMessage(`${getFirstName(studentName)} received +1 Talent! ✨`);
    } catch(e) {
        console.error("Error giving talent: ", e);
        showMessage("Failed to give talent.");
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      showMessage("Admin Login successful! 🔑");
    } else {
      showMessage("Incorrect password. 🚫");
      setIsAdmin(false);
    }
  };
  
  const isNameEntered = nameInput.trim().length > 0;
  
  const MainContent = () => (
    <div className="w-full max-w-lg p-6 bg-slate-800 text-white rounded-xl shadow-lg box-shadow-custom">
      {isAdmin ? (
        <>
          <h1 className="text-3xl font-bold text-center mb-4 text-orange-500">Admin Dashboard</h1>
          <button onClick={() => setIsAdmin(false)} className="mb-4 p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700">Back to student view</button>
          <div className="flex justify-center items-center space-x-2 mb-6">
            <label className="text-gray-300 text-lg">Select Class Date:</label>
            <input type="date" value={adminSelectedDate} onChange={(e) => setAdminSelectedDate(e.target.value)} className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-lg"/>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {COURSES.map((course) => <button key={course} onClick={() => setSelectedCourse(course)} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>)}
          </div>
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-200">{adminSelectedDate} - {selectedCourse} Data</h2>
          
          <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
            <h3 className="text-xl font-semibold text-gray-100">❓ Questions/Comments Log</h3>
            <ul>{questionsLog.map((log, i) => (
              <li key={i} className="p-2 border-b border-slate-700 text-gray-300 flex justify-between items-center">
                <span>{log.name} [{log.type}]: {log.text}</span>
                <button onClick={() => handleGiveTalent(log.name)} className="ml-4 px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded hover:bg-yellow-600 flex-shrink-0">
                  +1 Talent
                </button>
              </li>
            ))}</ul>
          </div>

          <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
            <h3 className="text-xl font-semibold text-gray-100">🏆 Talent Leaderboard ({selectedCourse})</h3>
            <ul>{talentsLog.map((talent) => (
              <li key={talent.id} className="p-2 border-b border-slate-700 text-gray-300 flex items-center">
                <span>{talent.name}:</span>
                <span className="font-bold text-yellow-400 ml-2 flex items-center">
                  {talent.totalTalents}
                  <img src="/talent-coin.png" alt="Talent coin" className="w-5 h-5 ml-1" />
                </span>
              </li>
            ))}</ul>
          </div>
          
          <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
            <h3 className="text-xl font-semibold text-gray-100">📊 Understanding Log</h3>
            <ul>{feedbackLog.map((log, i) => <li key={i} className="p-2 border-b border-slate-700 text-gray-300">{log.name} ({log.timestamp?.toDate().toLocaleTimeString()}): {log.status}</li>)}</ul>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-center mb-1">Ahnstoppable Learning:<br /><span className="text-orange-500">Freely Ask, Freely Learn</span></h1>
          <div className="flex justify-center space-x-2 my-2 text-3xl"><span>😁</span><span>😀</span><span>😁</span></div>
          <div className="flex flex-wrap justify-center gap-2 mb-6 mt-4">
            {COURSES.map((course) => <button key={course} onClick={() => { setSelectedCourse(course); setNameInput(''); }} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>)}
          </div>
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-200">{selectedCourse}</h2>
          <div className="mb-6">
            <select value={nameInput} onChange={(e) => setNameInput(e.target.value)} disabled={!isFirebaseConnected} className="p-3 w-full border bg-slate-700 border-slate-500 rounded-lg text-lg">
              <option value="">Select your name...</option>
              {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)}
            </select>
            <p className="text-center text-sm text-gray-400 mt-2">{isNameEntered && isFirebaseConnected ? <span className="text-orange-500 font-bold">Hello, {getFirstName(nameInput)}!</span> : <span>Select your name to enable features.</span>}{!isFirebaseConnected && <span className="block text-red-500 font-bold mt-2">🚫 DB connection failed.</span>}</p>
            
            {isNameEntered && isFirebaseConnected && (
                <div className="flex justify-center items-center text-center mt-4 p-3 bg-yellow-400 text-black rounded-lg">
                    <img src="/talent-coin.png" alt="Talent coin" className="w-6 h-6 mr-2" />
                    <p className="font-bold text-lg">My Total Talents: {myTotalTalents}</p>
                </div>
            )}
          </div>

          {/* --- RE-ADDED: Student Date Picker --- */}
          {isNameEntered && isFirebaseConnected && (
            <div className="flex justify-center items-center space-x-2 my-4">
              <label className="text-gray-300 text-lg">Select Class Date:</label>
              <input type="date" value={studentSelectedDate} onChange={(e) => setStudentSelectedDate(e.target.value)} className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-lg"/>
            </div>
          )}
          
          <div className={`text-center mb-8 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
            <p className="text-xl font-medium text-gray-200">Understanding Check</p>
            <div className="flex justify-center space-x-4 mt-2">
              <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Not Understood 🙁')} disabled={!isNameEntered || !isFirebaseConnected} className={`p-4 w-12 h-12 rounded-full bg-red-500 ${clickedButton === 'Not Understood 🙁' ? 'ring-4 ring-orange-500' : ''}`}></button><span className="text-sm">Not Understood</span></div>
              <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Confused 🤔')} disabled={!isNameEntered || !isFirebaseConnected} className={`p-4 w-12 h-12 rounded-full bg-yellow-400 ${clickedButton === 'Confused 🤔' ? 'ring-4 ring-orange-500' : ''}`}></button><span className="text-sm">Confused</span></div>
              <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Got It! ✅')} disabled={!isNameEntered || !isFirebaseConnected} className={`p-4 w-12 h-12 rounded-full bg-green-500 ${clickedButton === 'Got It! ✅' ? 'ring-4 ring-orange-500' : ''}`}></button><span className="text-sm">Got It!</span></div>
            </div>
          </div>
          <div className={`space-y-4 mb-6 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
            <p className="text-lg font-medium text-gray-200">Leave a Question or Comment</p>
            <form onSubmit={(e) => handleAddContent(e, 'question')} className="flex space-x-2"><input type="text" value={questionInput} onChange={(e) => setQuestionInput(e.target.value)} placeholder="Enter a question" disabled={!isNameEntered || !isFirebaseConnected} className="flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-lg" /><button type="submit" disabled={!isNameEntered || !isFirebaseConnected} className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg">Add</button></form>
            <p className="text-base font-semibold mt-4 text-gray-200">What do you think? 🤔</p>
            <form onSubmit={(e) => handleAddContent(e, 'comment')} className="flex space-x-2"><input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Enter your thoughts" disabled={!isNameEntered || !isFirebaseConnected} className="flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-lg" /><button type="submit" disabled={!isNameEntered || !isFirebaseConnected} className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg">Add</button></form>
          </div>
          <div className={`text-left p-4 border border-slate-600 rounded-xl mt-6 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
            <h3 className="text-xl font-semibold text-gray-100">📊 My Understanding Log for {studentSelectedDate}</h3>
            <ul>{feedbackLog.map((log, i) => <li key={i} className="p-2 border-b border-slate-700 text-gray-300">({log.timestamp?.toDate().toLocaleTimeString()}): {log.status}</li>)}</ul>
            <h3 className="text-xl font-semibold pt-4 text-gray-100">❓ My Questions/Comments Log for {studentSelectedDate}</h3>
            <ul>{questionsLog.map((log, i) => <li key={i} className="p-2 border-b border-slate-700 text-gray-300">[{log.type}]: {log.text}</li>)}</ul>
          </div>
          <div className="flex flex-col items-center mt-8 p-4 border-t border-slate-600">
            <p className="text-md font-medium text-gray-200 mb-2">Admin Login</p>
            <div className="flex space-x-2"><input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Password" className="p-2 border bg-slate-700 border-slate-500 rounded-lg text-sm" /><button onClick={handleAdminLogin} className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg">Login</button></div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen w-full bg-custom-beige-bg flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <img src="/photo1.jpg" alt="Collage 1" className="absolute top-[2%] left-[-5%] w-96 rounded-lg shadow-2xl transform -rotate-12 z-10" />
        <img src="/photo2.jpg" alt="Collage 2" className="absolute top-[5%] right-[-2%] w-[28rem] rounded-lg shadow-2xl transform rotate-6 z-10" />
        <img src="/photo3.jpg" alt="Collage 3" className="absolute bottom-[15%] left-[10%] w-80 rounded-lg shadow-2xl transform rotate-3 z-10" />
        <img src="/photo4.jpg" alt="Collage 4" className="absolute bottom-[-5%] right-[-5%] w-[32rem] rounded-lg shadow-2xl transform -rotate-6 z-10" />
        <img src="/photo5.jpg" alt="Collage 5" className="absolute top-[38%] left-[12%] w-72 rounded-lg shadow-2xl transform rotate-12 z-10" />
        <img src="/photo6.jpg" alt="Collage 6" className="absolute top-[45%] right-[8%] w-96 rounded-lg shadow-2xl transform -rotate-5 z-10" />
        <img src="/photo7.jpg" alt="Collage 7" className="absolute top-[15%] left-[30%] w-80 rounded-lg shadow-2xl transform rotate-2 z-10" />
        <img src="/photo8.jpg" alt="Collage 8" className="absolute bottom-[20%] right-[28%] w-80 rounded-lg shadow-2xl transform rotate-4 z-10" />
        <img src="/photo9.jpg" alt="Collage 9" className="absolute bottom-[-10%] left-[-2%] w-[28rem] rounded-lg shadow-2xl transform -rotate-8 z-10" />
        <img src="/photo10.jpg" alt="Collage 10" className="absolute top-[-5%] right-[30%] w-72 rounded-lg shadow-2xl transform rotate-8 z-10" />
        <img src="/photo11.jpg" alt="Collage 11" className="absolute bottom-[2%] left-[40%] w-96 rounded-lg shadow-2xl transform rotate-3 z-10" />
        <img src="/photo12.jpg" alt="Collage 12" className="absolute bottom-[45%] right-[-5%] w-80 rounded-lg shadow-2xl transform rotate-12 z-10" />
        <img src="/photo13.jpg" alt="Collage 13" className="absolute top-[65%] right-[35%] w-96 rounded-lg shadow-2xl transform -rotate-4 z-10" />
        <img src="/photo14.jpg" alt="Collage 14" className="absolute top-[40%] left-[-10%] w-[26rem] rounded-lg shadow-2xl transform -rotate-12 z-10" />
      </div>
      
      <div className="relative z-20">
        <MainContent />
      </div>
      
      {showMessageBox && (
        <div className="fixed top-1/2 left-1-2 -translate-x-1-2 -translate-y-1-2 bg-gray-900 text-white p-6 rounded-xl text-center z-50">
          {message}
        </div>
      )}
    </div>
  );
};

export default App;