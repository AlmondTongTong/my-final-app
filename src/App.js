/* global __app_id, __initial_auth_token */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, query, where, addDoc, onSnapshot, serverTimestamp, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const COURSES = ["ADV 375-01", "ADV 375-02", "ADV 461"];
const COURSE_STUDENTS = {
  "ADV 375-01": [ "Donovan, Robert", "Ellison, Alexis", "Futrell, Rylie", "George, Matthew", "Hammer, Olivia", "Kobayashi, Sena", "Lee, Byungho", "Mady, Gabriella", "Mawuenyega, Chloe", "Oved, Liam", "Sims, Ava", "Soke, Duru", "Walsh, William", "Warmington, Charles", "Yu, Wenbo" ],
  "ADV 375-02": [ "Alteio, Katherine", "Asatryan, Natalie", "Bondi, Ava", "Brown, Kylie", "Calabrese, Ella", "Dougherty, Quinn", "Dutton, Madeline", "Grabinger, Katharina", "Ju, Ashley", "Lahanas, Dean", "Lange, Bella-Soleil", "McQuilling, Louisa", "Milliman, Nicole", "Nizdil, Kennedy", "Salahieh, Zayd", "Shannon, Savannah", "Tang, Yuhan", "Walz, Lucy", "Wang, Michelle", "Wanke, Karsten" ],
  "ADV 461": [ "Bonk, Maya", "Burrow, Elizabeth", "Campos, Victoria", "Cantada, Cristian", "Chong, Timothy", "Chung, Sooa", "Cwiertnia, Zachary", "Fernandez, Francisco", "Fok, Alexis", "Gilbert, Jasmine", "Hall, Lily", "Hosea, Nicholas", "Jang, Da Eun", "Kim, Lynn", "Kim, Noelle", "Koning, William", "Lee, Edmund", "Lewandowski, Luke", "Leyson, Noah", "Lopez, Tatum", "Murphy, Alexander", "Swendsen, Katherine" ],
};

const isWithinClassTime = (courseName) => {
    const now = new Date();
    const losAngelesTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    
    const day = losAngelesTime.getDay();
    const hour = losAngelesTime.getHours();
    const minute = losAngelesTime.getMinutes();
    const currentTimeInMinutes = hour * 60 + minute;

    switch(courseName) {
        case "ADV 375-01":
            if (day === 1 || day === 4) { const startTime = 8 * 60, endTime = 9 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        case "ADV 375-02":
            if (day === 1 || day === 4) { const startTime = 12 * 60, endTime = 13 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        case "ADV 461":
            if (day === 3) { const startTime = 12 * 60, endTime = 15 * 60 + 50; return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime; } return false;
        default: return false;
    }
};

const ContentForm = ({ type, onAddContent, isEnabled }) => {
  const [text, setText] = useState('');
  const handleSubmit = (event) => { event.preventDefault(); onAddContent(text, type); setText(''); };
  return (
    <form onSubmit={handleSubmit} className="flex space-x-2">
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={type === 'question' ? "Enter a question" : "Enter your thoughts"} disabled={!isEnabled} className="flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-lg" />
      <button type="submit" disabled={!isEnabled || !text.trim()} className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50">Add</button>
    </form>
  );
};

const AdminLoginForm = ({ onAdminLogin }) => {
    const [password, setPassword] = useState('');
    const handleLogin = () => { onAdminLogin(password); };
    return (
        <div className="flex space-x-2">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="p-2 border bg-slate-700 border-slate-500 rounded-lg text-sm" />
            <button onClick={handleLogin} className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg">Login</button>
        </div>
    );
};

const App = () => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const token = useMemo(() => typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null, []);
  
  const firebaseConfig = useMemo(() => ({
      apiKey: "AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U", authDomain: "ahnstoppable-learning.firebaseapp.com", projectId: "ahnstoppable-learning",
      storageBucket: "ahnstoppable-learning.firebasestorage.app", messagingSenderId: "365013467715", appId: "1:365013467715:web:113e63c822fae43123caf6",
      measurementId: "G-MT9ETH31MY"
  }), []);

  const [db, setDb] = useState(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0]);
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [questionsLog, setQuestionsLog] = useState([]);
  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [clickedButton, setClickedButton] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const ADMIN_PASSWORD = '0811';
  
  const [adminSelectedDate, setAdminSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  // --- B안: Re-added student calendar state ---
  const [studentSelectedDate, setStudentSelectedDate] = useState('');
  const [talentsLog, setTalentsLog] = useState([]);
  const [myTotalTalents, setMyTotalTalents] = useState(0);

  const [adminSelectedStudent, setAdminSelectedStudent] = useState('');
  const [adminStudentLog, setAdminStudentLog] = useState([]);
  const [adminStudentTalent, setAdminStudentTalent] = useState(0);
  
  const [isClassActive, setIsClassActive] = useState(false);
  
  const showMessage = useCallback((msg) => {
    setMessage(msg); setShowMessageBox(true);
    setTimeout(() => { setShowMessageBox(false); setMessage(''); }, 3000);
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
        setDb(getFirestore(app));
        if (token) { await signInWithCustomToken(auth, token); } else { await signInAnonymously(auth); }
        setIsFirebaseConnected(true);
      } catch (e) { console.error("Firebase initialization failed:", e); }
    };
    initializeFirebase();
  }, [token, firebaseConfig]);

  useEffect(() => {
    const checkTime = () => setIsClassActive(isWithinClassTime(selectedCourse));
    checkTime();
    const interval = setInterval(checkTime, 30000);
    return () => clearInterval(interval);
  }, [selectedCourse]);

  useEffect(() => {
    if (!isFirebaseConnected || !db || !isAdmin) return;
    const publicDataPath = `/artifacts/${appId}/public/data`;
    setAdminSelectedStudent('');
    setAdminStudentLog([]);
    setAdminStudentTalent(0);

    const feedbackQuery = query(collection(db, `${publicDataPath}/feedback`), where("course", "==", selectedCourse), where("date", "==", adminSelectedDate));
    const questionsQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("date", "==", adminSelectedDate));
    const talentsQuery = query(collection(db, `${publicDataPath}/talents`), where("course", "==", selectedCourse));

    const unsubFeedback = onSnapshot(feedbackQuery, (snap) => setFeedbackLog(snap.docs.map(doc => doc.data())));
    const unsubQuestions = onSnapshot(questionsQuery, (snap) => setQuestionsLog(snap.docs.map(doc => doc.data())));
    const unsubTalents = onSnapshot(talentsQuery, (snap) => setTalentsLog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.totalTalents - a.totalTalents)));

    return () => { unsubFeedback(); unsubQuestions(); unsubTalents(); };
  }, [isFirebaseConnected, db, selectedCourse, adminSelectedDate, appId, isAdmin]);

  useEffect(() => {
      if (!isFirebaseConnected || !db || !isAdmin || !adminSelectedStudent) {
        setAdminStudentLog([]);
        setAdminStudentTalent(0);
        return;
      };
      const publicDataPath = `/artifacts/${appId}/public/data`;
      const studentLogQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("name", "==", adminSelectedStudent));
      const studentTalentRef = doc(db, `${publicDataPath}/talents`, adminSelectedStudent);

      const unsubLog = onSnapshot(studentLogQuery, (snap) => setAdminStudentLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));
      const unsubTalent = onSnapshot(studentTalentRef, (doc) => {
          if(doc.exists()) { setAdminStudentTalent(doc.data().totalTalents); } else { setAdminStudentTalent(0); }
      });
      
      return () => { unsubLog(); unsubTalent(); };
  }, [isFirebaseConnected, db, selectedCourse, adminSelectedStudent, appId, isAdmin]);

  // --- B안: Reverted student data fetching to filter by date ---
  useEffect(() => {
    if (!isFirebaseConnected || !db || isAdmin || !nameInput) {
      setFeedbackLog([]); setQuestionsLog([]); setMyTotalTalents(0);
      return;
    }
    const publicDataPath = `/artifacts/${appId}/public/data`;
    let unsubFeedback = () => {};
    let unsubQuestions = () => {};

    if (studentSelectedDate) {
        const feedbackQuery = query(collection(db, `${publicDataPath}/feedback`), where("course", "==", selectedCourse), where("name", "==", nameInput), where("date", "==", studentSelectedDate));
        const questionsQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("name", "==", nameInput), where("date", "==", studentSelectedDate));
        unsubFeedback = onSnapshot(feedbackQuery, (snap) => setFeedbackLog(snap.docs.map(doc => doc.data()).sort((a,b) => b.timestamp - a.timestamp)));
        unsubQuestions = onSnapshot(questionsQuery, (snap) => setQuestionsLog(snap.docs.map(doc => doc.data()).sort((a,b) => b.timestamp - a.timestamp)));
    } else {
        setFeedbackLog([]); setQuestionsLog([]);
    }

    const talentDocRef = doc(db, `${publicDataPath}/talents`, nameInput);
    const unsubMyTalent = onSnapshot(talentDocRef, (doc) => {
        if (doc.exists()) { setMyTotalTalents(doc.data().totalTalents); } else { setMyTotalTalents(0); }
    });
    
    return () => { unsubFeedback(); unsubQuestions(); unsubMyTalent(); };
  }, [isFirebaseConnected, db, selectedCourse, nameInput, studentSelectedDate, appId, isAdmin]);

  const handleFeedback = async (status) => {
    if (!nameInput.trim()) return showMessage("Please select your name first.");
    setClickedButton(status); setTimeout(() => setClickedButton(null), 1500);
    try {
      const publicDataPath = `/artifacts/${appId}/public/data`;
      await addDoc(collection(db, `${publicDataPath}/feedback`), { name: nameInput, status, course: selectedCourse, date: new Date().toISOString().slice(0, 10), timestamp: serverTimestamp() });
      showMessage("Feedback submitted! ✅");
    } catch (e) { showMessage("Failed to submit feedback. ❌"); }
  };

  const handleAddContent = async (text, type) => {
    if (!nameInput.trim() || !text.trim()) return showMessage("Please select your name and enter a message.");
    try {
      const publicDataPath = `/artifacts/${appId}/public/data`;
      await addDoc(collection(db, `${publicDataPath}/questions`), { name: nameInput, text, type, course: selectedCourse, date: new Date().toISOString().slice(0, 10), timestamp: serverTimestamp() });
      showMessage("Submission complete! ✅");
    } catch (e) { showMessage("Submission failed. ❌"); }
  };

  const handleGiveTalent = async (studentName) => {
    const publicDataPath = `/artifacts/${appId}/public/data`;
    const talentDocRef = doc(db, `${publicDataPath}/talents`, studentName);
    try {
        const docSnap = await getDoc(talentDocRef);
        if (docSnap.exists()) {
            const currentTalents = docSnap.data().totalTalents || 0;
            await updateDoc(talentDocRef, { totalTalents: currentTalents + 1 });
        } else {
            await setDoc(talentDocRef, { name: studentName, course: selectedCourse, totalTalents: 1 });
        }
        showMessage(`${getFirstName(studentName)} received +1 Talent! ✨`);
    } catch(e) { 
        console.error("Error giving talent: ", e);
        showMessage("Failed to give talent."); 
    }
  };

  const handleAdminLogin = (password) => {
    if (password === ADMIN_PASSWORD) { setIsAdmin(true); showMessage("Admin Login successful! 🔑"); } 
    else { showMessage("Incorrect password. 🚫"); }
  };
  
  const isNameEntered = nameInput.trim().length > 0;
  // --- B안: Participation now requires a selected date ---
  const isReadyToParticipate = isNameEntered && !!studentSelectedDate && isClassActive;

  const MainContent = () => (
    <div className="w-full max-w-lg p-6 bg-slate-800 text-white rounded-xl shadow-lg box-shadow-custom">
      {isAdmin ? (
        <>
          <h1 className="text-3xl font-bold text-center mb-4 text-orange-500">Admin Dashboard</h1>
          <button onClick={() => setIsAdmin(false)} className="mb-4 p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700">Back to student view</button>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {COURSES.map((course) => <button key={course} onClick={() => setSelectedCourse(course)} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>)}
          </div>
          
          <div className="mb-6">
            <label className="text-gray-300 text-lg mr-2">View Specific Student:</label>
            <select value={adminSelectedStudent} onChange={(e) => setAdminSelectedStudent(e.target.value)} className="p-3 w-full border bg-slate-700 border-slate-500 rounded-lg text-lg mt-2">
              <option value="">Select a student to view all their logs...</option>
              {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)}
            </select>
          </div>

          {adminSelectedStudent ? (
            <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
              <h3 className="text-xl font-semibold text-gray-100">All Logs for {getFirstName(adminSelectedStudent)}</h3>
              <div className="flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg">
                  <img src="/talent-coin.png" alt="Talent coin" className="w-6 h-6 mr-2" />
                  <p className="font-bold text-lg">Total Talents: {adminStudentTalent}</p>
              </div>
              <ul>{adminStudentLog.map((log, i) => (
                <li key={i} className="p-2 border-b border-slate-700 text-gray-300">
                  <span className="font-bold">{log.date}</span> [{log.type}]: {log.text}
                </li>
              ))}</ul>
            </div>
          ) : (
            <>
              <div className="flex justify-center items-center space-x-2 mb-6">
                <label className="text-gray-300 text-lg">View Logs for Date:</label>
                <input type="date" value={adminSelectedDate} onChange={(e) => setAdminSelectedDate(e.target.value)} className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-lg"/>
              </div>
              <h2 className="text-2xl font-semibold mb-4 text-center text-gray-200">{adminSelectedDate} Data</h2>
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
                <h3 className="text-xl font-semibold text-gray-100">❓ Daily Questions/Comments</h3>
                <ul>{questionsLog.map((log, i) => (
                  <li key={i} className="p-2 border-b border-slate-700 text-gray-300 flex justify-between items-center">
                    <span>{log.name} [{log.type}]: {log.text}</span>
                    <button onClick={() => handleGiveTalent(log.name)} className="ml-4 px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded hover:bg-yellow-600 flex-shrink-0">+1 Talent</button>
                  </li>
                ))}</ul>
              </div>
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
                <h3 className="text-xl font-semibold text-gray-100">🏆 Talent Leaderboard</h3>
                <ul>{talentsLog.map((talent) => (
                  <li key={talent.id} className="p-2 border-b border-slate-700 text-gray-300 flex items-center">
                    <span>{talent.name}:</span>
                    <span className="font-bold text-yellow-400 ml-2 flex items-center">{talent.totalTalents}<img src="/talent-coin.png" alt="Talent coin" className="w-5 h-5 ml-1" /></span>
                  </li>
                ))}</ul>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-center mb-1">Ahnstoppable Learning:<br /><span className="text-orange-500">Freely Ask, Freely Learn</span></h1>
          <div className="flex justify-center space-x-2 my-2 text-3xl"><span>😁</span><span>😀</span><span>😁</span></div>
          <div className="flex flex-wrap justify-center gap-2 mb-6 mt-4">
             {COURSES.map((course) => <button key={course} onClick={() => { setSelectedCourse(course); setNameInput(''); setStudentSelectedDate(''); }} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>)}
          </div>
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-200">{selectedCourse}</h2>
          <div className="mb-6">
            <select value={nameInput} onChange={(e) => {setNameInput(e.target.value); setStudentSelectedDate('');}} disabled={!isFirebaseConnected} className="p-3 w-full border bg-slate-700 border-slate-500 rounded-lg text-lg">
              <option value="">Select your name...</option>
              {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)}
            </select>
            <p className="text-center text-sm text-gray-400 mt-2">{isNameEntered && isFirebaseConnected ? <span className="text-orange-500 font-bold">Hello, {getFirstName(nameInput)}!</span> : <span>Select your name to enable features.</span>}{!isFirebaseConnected && <span className="block text-red-500 font-bold mt-2">🚫 DB connection failed.</span>}</p>
          </div>
          
          <div className={`${!isNameEntered || !isFirebaseConnected ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* --- B안: Student calendar is back --- */}
            <div className="flex justify-center items-center space-x-2 my-4">
              <label className="text-gray-300 text-lg">Select Class Date:</label>
              <input type="date" value={studentSelectedDate} onChange={(e) => setStudentSelectedDate(e.target.value)} className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-lg"/>
            </div>
            
            {!isClassActive && isNameEntered && !!studentSelectedDate && <div className="text-center p-3 bg-red-800 text-white rounded-lg mb-4"><p>You can only submit responses during class time.</p></div>}
            
            <div className={`${!isReadyToParticipate ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="text-center mb-8">
                <p className="text-xl font-medium text-gray-200">Understanding Check</p>
                <div className="flex justify-center space-x-4 mt-2">
                  <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Not Understood 🙁')} className={`p-4 w-12 h-12 rounded-full bg-red-500 ${clickedButton === 'Not Understood 🙁' ? 'ring-4 ring-orange-500' : ''}`}><span className="text-sm"></span></button><span className="text-sm">Not Understood</span></div>
                  <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Confused 🤔')} className={`p-4 w-12 h-12 rounded-full bg-yellow-400 ${clickedButton === 'Confused 🤔' ? 'ring-4 ring-orange-500' : ''}`}><span className="text-sm"></span></button><span className="text-sm">Confused</span></div>
                  <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Got It! ✅')} className={`p-4 w-12 h-12 rounded-full bg-green-500 ${clickedButton === 'Got It! ✅' ? 'ring-4 ring-orange-500' : ''}`}><span className="text-sm"></span></button><span className="text-sm">Got It!</span></div>
                </div>
              </div>
              <div className="space-y-4 mb-6">
                <p className="text-lg font-medium text-gray-200">Leave a Question or Comment</p>
                <ContentForm type="question" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} />
                <p className="text-base font-semibold mt-4 text-gray-200">What do you think? 🤔</p>
                <ContentForm type="comment" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} />
              </div>
            </div>
            
            <div className="flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg">
                <img src="/talent-coin.png" alt="Talent coin" className="w-6 h-6 mr-2" />
                <p className="font-bold text-lg">My Total Talents: {myTotalTalents}</p>
            </div>
            
            {studentSelectedDate &&
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
                <h3 className="text-xl font-semibold text-gray-100">📊 My Logs for {studentSelectedDate}</h3>
                <ul>{feedbackLog.map((log, i) => <li key={i} className="p-2 border-b border-slate-700 text-gray-300">({log.timestamp?.toDate().toLocaleTimeString()}): {log.status}</li>)}</ul>
                <h3 className="text-xl font-semibold pt-4 text-gray-100">❓ My Questions/Comments for {studentSelectedDate}</h3>
                <ul>{questionsLog.map((log, i) => <li key={i} className="p-2 border-b border-slate-700 text-gray-300">[{log.type}]: {log.text}</li>)}</ul>
              </div>
            }
          </div>

          <div className="flex flex-col items-center mt-8 p-4 border-t border-slate-600">
            <p className="text-md font-medium text-gray-200 mb-2">Admin Login</p>
            <AdminLoginForm onAdminLogin={handleAdminLogin} />
          </div>
        </>
      )}
    </div>
  );

  const PhotoGallery = () => (
    <>
      <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap">
        {[...Array(7)].map((_, i) => <img key={i} src={`/photo${i + 1}.jpg`} alt={`Gallery ${i + 1}`} className="h-24 sm:h-32 w-auto rounded-lg shadow-lg" />)}
      </div>
      <div className="flex justify-center items-center flex-grow my-4"><MainContent /></div>
      <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap">
        {[...Array(7)].map((_, i) => <img key={i} src={`/photo${i + 8}.jpg`} alt={`Gallery ${i + 8}`} className="h-24 sm:h-32 w-auto rounded-lg shadow-lg" />)}
      </div>
    </>
  );

  return (
    <div className="min-h-screen w-full bg-custom-beige-bg flex flex-col justify-between p-2 sm:p-4">
      <PhotoGallery />
      {showMessageBox && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white p-6 rounded-xl text-center z-50">
          {message}
        </div>
      )}
    </div>
  );
};

export default App;