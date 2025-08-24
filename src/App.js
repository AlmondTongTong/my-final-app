/* global __app_id, __initial_auth_token */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, query, where, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

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
  const [selectedDate, setSelectedDate] = useState(() => localStorage.getItem('adminSelectedDate') || new Date().toISOString().slice(0, 10));
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [questionsLog, setQuestionsLog] = useState([]);
  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [clickedButton, setClickedButton] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const ADMIN_PASSWORD = '0811';

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
    if (isAdmin) {
      localStorage.setItem('adminSelectedDate', selectedDate);
    }
  }, [selectedDate, isAdmin]);

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

  useEffect(() => {
    if (!isFirebaseConnected || !db || !isAdmin) return;
    const publicDataPath = `/artifacts/${appId}/public/data`;
    const feedbackQuery = query(collection(db, `${publicDataPath}/feedback`), where("course", "==", selectedCourse), where("date", "==", selectedDate));
    const questionsQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("date", "==", selectedDate));

    const unsubFeedback = onSnapshot(feedbackQuery, (snap) => setFeedbackLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));
    const unsubQuestions = onSnapshot(questionsQuery, (snap) => setQuestionsLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));

    return () => { unsubFeedback(); unsubQuestions(); };
  }, [isFirebaseConnected, db, selectedCourse, selectedDate, appId, isAdmin]);

  useEffect(() => {
    if (!isFirebaseConnected || !db || isAdmin || !nameInput) {
      setFeedbackLog([]);
      setQuestionsLog([]);
      return;
    }
    const publicDataPath = `/artifacts/${appId}/public/data`;
    const feedbackQuery = query(collection(db, `${publicDataPath}/feedback`), where("course", "==", selectedCourse), where("name", "==", nameInput));
    const questionsQuery = query(collection(db, `${publicDataPath}/questions`), where("course", "==", selectedCourse), where("name", "==", nameInput));

    const unsubFeedback = onSnapshot(feedbackQuery, (snap) => setFeedbackLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));
    const unsubQuestions = onSnapshot(questionsQuery, (snap) => setQuestionsLog(snap.docs.map(doc => doc.data()).sort((a, b) => b.timestamp - a.timestamp)));
    
    return () => { unsubFeedback(); unsubQuestions(); };
  }, [isFirebaseConnected, db, selectedCourse, nameInput, appId, isAdmin]);

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
    <div className="w-full max-w-lg p-6 bg-white rounded-xl shadow-lg box-shadow-custom">
      {isAdmin ? (
        <>
          <h1 className="text-3xl font-bold text-center mb-4 text-purple-700">Admin Dashboard</h1>
          <button onClick={() => setIsAdmin(false)} className="mb-4 p-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Back to student view</button>
          <div className="flex justify-center items-center space-x-2 mb-6">
            <label className="text-gray-600 text-lg">Select Class Date:</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="p-3 border border-gray-300 rounded-lg text-lg"/>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {COURSES.map((course) => <button key={course} onClick={() => setSelectedCourse(course)} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-800'}`}>{course}</button>)}
          </div>
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-700">{selectedDate} - {selectedCourse} Data</h2>
          <div className="text-left p-4 border rounded-xl mt-6">
            <h3 className="text-xl font-semibold">📊 Understanding Log</h3>
            <ul>{feedbackLog.map((log, i) => <li key={i} className="p-2 border-b">{log.name} ({log.timestamp?.toDate().toLocaleTimeString()}): {log.status}</li>)}</ul>
          </div>
          <div className="text-left p-4 border rounded-xl mt-6">
            <h3 className="text-xl font-semibold">❓ Questions/Comments Log</h3>
            <ul>{questionsLog.map((log, i) => <li key={i} className="p-2 border-b">{log.name} [{log.type}]: {log.text}</li>)}</ul>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-center mb-1">Ahnstoppable Learning:<br /><span className="text-purple-700">Freely Ask, Freely Learn</span></h1>
          <div className="flex justify-center space-x-2 my-2 text-3xl"><span>😁</span><span>😀</span><span>😁</span></div>
          <div className="flex flex-wrap justify-center gap-2 mb-6 mt-4">
            {COURSES.map((course) => <button key={course} onClick={() => { setSelectedCourse(course); setNameInput(''); }} className={`p-3 text-sm font-medium rounded-lg ${selectedCourse === course ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-800'}`}>{course}</button>)}
          </div>
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-700">{selectedCourse}</h2>
          <div className="mb-6">
            <select value={nameInput} onChange={(e) => setNameInput(e.target.value)} disabled={!isFirebaseConnected} className="p-3 w-full border rounded-lg text-lg">
              <option value="">Select your name...</option>
              {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)}
            </select>
            <p className="text-center text-sm text-gray-500 mt-2">{isNameEntered && isFirebaseConnected ? <span className="text-purple-600 font-bold">Hello, {getFirstName(nameInput)}!</span> : <span>Select your name to enable features.</span>}{!isFirebaseConnected && <span className="block text-red-500 font-bold mt-2">🚫 DB connection failed.</span>}</p>
          </div>
          <div className={`text-center mb-8 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
            <p className="text-xl font-medium">Understanding Check</p>
            <div className="flex justify-center space-x-4 mt-2">
              <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Not Understood 🙁')} disabled={!isNameEntered || !isFirebaseConnected} className={`p-4 w-12 h-12 rounded-full bg-red-500 ${clickedButton === 'Not Understood 🙁' ? 'ring-4 ring-purple-500' : ''}`}></button><span className="text-sm">Not Understood</span></div>
              <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Confused 🤔')} disabled={!isNameEntered || !isFirebaseConnected} className={`p-4 w-12 h-12 rounded-full bg-yellow-400 ${clickedButton === 'Confused 🤔' ? 'ring-4 ring-purple-500' : ''}`}></button><span className="text-sm">Confused</span></div>
              <div className="flex flex-col items-center"><button onClick={() => handleFeedback('Got It! ✅')} disabled={!isNameEntered || !isFirebaseConnected} className={`p-4 w-12 h-12 rounded-full bg-green-500 ${clickedButton === 'Got It! ✅' ? 'ring-4 ring-purple-500' : ''}`}></button><span className="text-sm">Got It!</span></div>
            </div>
          </div>
          <div className={`space-y-4 mb-6 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
            <p className="text-lg font-medium">Leave a Question or Comment</p>
            <form onSubmit={(e) => handleAddContent(e, 'question')} className="flex space-x-2"><input type="text" value={questionInput} onChange={(e) => setQuestionInput(e.target.value)} placeholder="Enter a question" disabled={!isNameEntered || !isFirebaseConnected} className="flex-1 p-3 border rounded-lg text-lg" /><button type="submit" disabled={!isNameEntered || !isFirebaseConnected} className="p-3 bg-purple-500 text-white rounded-lg">Add</button></form>
            <p className="text-base font-semibold mt-4">What do you think? 🤔</p>
            <form onSubmit={(e) => handleAddContent(e, 'comment')} className="flex space-x-2"><input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Enter your thoughts" disabled={!isNameEntered || !isFirebaseConnected} className="flex-1 p-3 border rounded-lg text-lg" /><button type="submit" disabled={!isNameEntered || !isFirebaseConnected} className="p-3 bg-purple-500 text-white rounded-lg">Add</button></form>
          </div>
          <div className={`text-left p-4 border rounded-xl mt-6 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
            <h3 className="text-xl font-semibold">📊 My Understanding Log</h3>
            <ul>{feedbackLog.map((log, i) => <li key={i} className="p-2 border-b">({log.timestamp?.toDate().toLocaleTimeString()}): {log.status}</li>)}</ul>
            <h3 className="text-xl font-semibold pt-4">❓ My Questions/Comments Log</h3>
            <ul>{questionsLog.map((log, i) => <li key={i} className="p-2 border-b">[{log.type}]: {log.text}</li>)}</ul>
          </div>
          <div className="flex flex-col items-center mt-8 p-4 border-t">
            <p className="text-md font-medium mb-2">Admin Login</p>
            <div className="flex space-x-2"><input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Password" className="p-2 border rounded-lg text-sm" /><button onClick={handleAdminLogin} className="p-2 bg-purple-500 text-white rounded-lg">Login</button></div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen w-full bg-gray-100 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <img src="/photo1.jpg" alt="Collage 1" className="absolute top-[5%] left-[5%] w-48 h-auto rounded-lg shadow-lg transform -rotate-6 z-0" />
        <img src="/photo2.jpg" alt="Collage 2" className="absolute top-[10%] right-[8%] w-52 h-auto rounded-lg shadow-lg transform rotate-3 z-0" />
        <img src="/photo3.jpg" alt="Collage 3" className="absolute bottom-[15%] left-[10%] w-44 h-auto rounded-lg shadow-lg transform rotate-2 z-0" />
        <img src="/photo4.jpg" alt="Collage 4" className="absolute bottom-[5%] right-[5%] w-56 h-auto rounded-lg shadow-lg transform -rotate-3 z-0" />
        <img src="/photo5.jpg" alt="Collage 5" className="absolute top-[40%] left-[15%] w-36 h-auto rounded-lg shadow-lg transform rotate-8 z-0" />
        <img src="/photo6.jpg" alt="Collage 6" className="absolute top-[55%] right-[12%] w-48 h-auto rounded-lg shadow-lg transform -rotate-5 z-0" />
        <img src="/photo7.jpg" alt="Collage 7" className="absolute top-[25%] left-[30%] w-40 h-auto rounded-lg shadow-lg transform rotate-4 z-0" />
        <img src="/photo8.jpg" alt="Collage 8" className="absolute bottom-[30%] right-[25%] w-44 h-auto rounded-lg shadow-lg transform rotate-5 z-0" />
        <img src="/photo9.jpg" alt="Collage 9" className="absolute top-[70%] left-[2%] w-52 h-auto rounded-lg shadow-lg transform -rotate-8 z-0" />
        <img src="/photo10.jpg" alt="Collage 10" className="absolute top-[5%] right-[35%] w-36 h-auto rounded-lg shadow-lg transform rotate-6 z-0" />
        <img src="/photo11.jpg" alt="Collage 11" className="absolute bottom-[8%] left-[45%] w-48 h-auto rounded-lg shadow-lg transform -rotate-2 z-0" />
        <img src="/photo12.jpg" alt="Collage 12" className="absolute bottom-[55%] right-[2%] w-40 h-auto rounded-lg shadow-lg transform rotate-12 z-0" />
        <img src="/photo13.jpg" alt="Collage 13" className="absolute top-[80%] right-[30%] w-52 h-auto rounded-lg shadow-lg transform -rotate-4 z-0" />
        <img src="/photo14.jpg" alt="Collage 14" className="absolute top-[45%] left-[1%] w-44 h-auto rounded-lg shadow-lg transform -rotate-12 z-0" />
      </div>
      
      <div className="relative z-10">
        <MainContent />
      </div>
      
      {showMessageBox && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1-2 -translate-y-1/2 bg-gray-900 text-white p-6 rounded-xl text-center z-50">
          {message}
        </div>
      )}
    </div>
  );
};

export default App;