/* global __app_id, __initial_auth_token */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, query, where, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Define the courses and a hardcoded list of students for each course.
// This data is used to populate the student dropdown list.
const COURSES = ["ADV 375-01", "ADV 375-02", "ADV 461"];
const COURSE_STUDENTS = {
  "ADV 375-01": [
    "Donovan, Robert",
    "Ellison, Alexis",
    "Futrell, Rylie",
    "George, Matthew",
    "Hammer, Olivia",
    "Kobayashi, Sena",
    "Lee, Byungho",
    "Mady, Gabriella",
    "Mawuenyega, Chloe",
    "Oved, Liam",
    "Sims, Ava",
    "Soke, Duru",
    "Walsh, William",
    "Warmington, Charles",
    "Yu, Wenbo"
  ],
  "ADV 375-02": [
    "Alteio, Katherine",
    "Asatryan, Natalie",
    "Bondi, Ava",
    "Brown, Kylie",
    "Calabrese, Ella",
    "Dougherty, Quinn",
    "Dutton, Madeline",
    "Grabinger, Katharina",
    "Ju, Ashley",
    "Lahanas, Dean",
    "Lange, Bella-Soleil",
    "McQuilling, Louisa",
    "Milliman, Nicole",
    "Nizdil, Kennedy",
    "Salahieh, Zayd",
    "Shannon, Savannah",
    "Tang, Yuhan",
    "Walz, Lucy",
    "Wang, Michelle",
    "Wanke, Karsten"
  ],
  "ADV 461": [
    "Bonk, Maya",
    "Burrow, Elizabeth",
    "Campos, Victoria",
    "Cantada, Cristian",
    "Chong, Timothy",
    "Chung, Sooa",
    "Cwiertnia, Zachary",
    "Fernandez, Francisco",
    "Fok, Alexis",
    "Gilbert, Jasmine",
    "Hall, Lily",
    "Hosea, Nicholas",
    "Jang, Da Eun",
    "Kim, Lynn",
    "Kim, Noelle",
    "Koning, William",
    "Lee, Edmund",
    "Lewandowski, Luke",
    "Leyson, Noah",
    "Lopez, Tatum",
    "Murphy, Alexander",
    "Swendsen, Katherine"
  ],
};

// Main App component
const App = () => {
  // Global variables provided by the Canvas environment.
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // Use useMemo to prevent unnecessary recalculations of firebase token.
  const token = useMemo(() => {
    return typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
  }, []);
  
  // Your web app's Firebase configuration
  // This is the unique configuration provided by the user.
  const firebaseConfig = {
      apiKey: "AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U",
      authDomain: "ahnstoppable-learning.firebaseapp.com",
      projectId: "ahnstoppable-learning",
      storageBucket: "ahnstoppable-learning.firebasestorage.app",
      messagingSenderId: "365013467715",
      appId: "1:365013467715:web:113e63c822fae43123caf6",
      measurementId: "G-MT9ETH31MY"
  };


  // State variables for application state.
  const [db, setDb] = useState(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [questionsLog, setQuestionsLog] = useState([]);
  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 3번 요청 수정: 버튼 클릭 피드백을 위한 state 추가
  const [clickedButton, setClickedButton] = useState(null);

  // State variables for admin page.
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // You can change the password here!
  const ADMIN_PASSWORD = '0811';

  // Function to show a temporary message box.
  const showMessage = useCallback((msg) => {
    setMessage(msg);
    setShowMessageBox(true);
    setTimeout(() => {
      setShowMessageBox(false);
      setMessage('');
    }, 3000);
  }, []);

  // Function to extract first name from 'Lastname, Firstname' format
  const getFirstName = (fullName) => {
    const parts = fullName.split(', ');
    return parts.length > 1 ? parts[1] : parts[0];
  };

  // Firebase initialization and authentication.
  useEffect(() => {
    let auth = null;
    let dbInstance = null;
    let app = null;

    const initializeFirebase = async () => {
      setIsLoading(true);

      if (!firebaseConfig || !firebaseConfig.projectId) {
        console.error("Firebase configuration is missing. The app cannot connect to the database.");
        setIsFirebaseConnected(false);
        setIsLoading(false);
        return;
      }

      try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        dbInstance = getFirestore(app);
        setDb(dbInstance);

        // Sign in with custom token or anonymously.
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
        setIsFirebaseConnected(true);
      } catch (e) {
        console.error("Firebase initialization or authentication failed:", e);
        setIsFirebaseConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeFirebase();

  }, [token, showMessage, firebaseConfig]);

  // Real-time listeners for feedback and questions (For Admin View).
  useEffect(() => {
    if (!isFirebaseConnected || !db || !isAdmin) {
      return;
    }

    const publicDataPath = `/artifacts/${appId}/public/data`;

    // Firestore queries. Note: `orderBy` is removed to avoid index issues.
    // The data will be sorted locally in the component.
    const feedbackQuery = query(
      collection(db, `${publicDataPath}/feedback`),
      where("course", "==", selectedCourse),
      where("date", "==", selectedDate)
    );
    const questionsQuery = query(
      collection(db, `${publicDataPath}/questions`),
      where("course", "==", selectedCourse),
      where("date", "==", selectedDate)
    );

    // Real-time listener for feedback.
    const unsubscribeFeedback = onSnapshot(feedbackQuery, (querySnapshot) => {
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push(doc.data());
      });
      // Sort data locally by timestamp in descending order
      setFeedbackLog(data.sort((a, b) => b.timestamp - a.timestamp));
    }, (error) => {
        console.error("Feedback listener failed:", error);
    });

    // Real-time listener for questions.
    const unsubscribeQuestions = onSnapshot(questionsQuery, (querySnapshot) => {
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push(doc.data());
      });
      // Sort data locally by timestamp in descending order
      setQuestionsLog(data.sort((a, b) => b.timestamp - a.timestamp));
    }, (error) => {
        console.error("Questions listener failed:", error);
    });

    // Clean up listeners on component unmount or state change.
    return () => {
      unsubscribeFeedback();
      unsubscribeQuestions();
    };
  }, [isFirebaseConnected, db, selectedCourse, selectedDate, appId, isAdmin]);

  // 2번 요청 수정: 학생용 누적 기록을 불러오는 리스너 추가
  useEffect(() => {
    if (!isFirebaseConnected || !db || isAdmin || !nameInput) {
      setFeedbackLog([]);
      setQuestionsLog([]);
      return;
    }

    const publicDataPath = `/artifacts/${appId}/public/data`;

    const feedbackQuery = query(
      collection(db, `${publicDataPath}/feedback`),
      where("course", "==", selectedCourse),
      where("name", "==", nameInput)
    );
    const questionsQuery = query(
      collection(db, `${publicDataPath}/questions`),
      where("course", "==", selectedCourse),
      where("name", "==", nameInput)
    );

    const unsubscribeFeedback = onSnapshot(feedbackQuery, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push(doc.data()));
      // Sort data locally by timestamp in descending order
      setFeedbackLog(data.sort((a, b) => b.timestamp - a.timestamp));
    });

    const unsubscribeQuestions = onSnapshot(questionsQuery, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push(doc.data()));
      // Sort data locally by timestamp in descending order
      setQuestionsLog(data.sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => {
      unsubscribeFeedback();
      unsubscribeQuestions();
    };

  }, [isFirebaseConnected, db, selectedCourse, nameInput, appId, isAdmin]);


  // Feedback button click handler.
  const handleFeedback = async (status) => {
    if (!nameInput.trim()) {
      showMessage("Please select your name first.");
      return;
    }
    if (!isFirebaseConnected || !db) {
      showMessage("There is a database connection issue. Please try again in a moment. ⏳");
      return;
    }

    // 3번 요청 수정: 클릭 피드백 로직 추가
    setClickedButton(status);
    setTimeout(() => setClickedButton(null), 1500);

    try {
      const publicDataPath = `/artifacts/${appId}/public/data`;
      await addDoc(collection(db, `${publicDataPath}/feedback`), {
        name: nameInput,
        status,
        course: selectedCourse,
        date: new Date().toISOString().slice(0, 10), // 항상 현재 날짜로 기록
        timestamp: serverTimestamp()
      });
      showMessage("Feedback submitted successfully! ✅");
    } catch (e) {
      console.error("Error adding feedback: ", e);
      showMessage("Failed to submit feedback. Please try again. ❌");
    }
  };

  // Question/Comment form submission handler.
  const handleAddContent = async (event, type) => {
    event.preventDefault();
    const text = type === 'question' ? questionInput : commentInput;
    if (!nameInput.trim() || !text.trim()) {
      showMessage("Please select your name and enter a message.");
      return;
    }
    if (!isFirebaseConnected || !db) {
      showMessage("There is a database connection issue. Please try again in a moment. ⏳");
      return;
    }

    try {
      const publicDataPath = `/artifacts/${appId}/public/data`;
      await addDoc(collection(db, `${publicDataPath}/questions`), {
        name: nameInput,
        text,
        type,
        course: selectedCourse,
        date: new Date().toISOString().slice(0, 10), // 항상 현재 날짜로 기록
        timestamp: serverTimestamp()
      });
      showMessage("Submission complete! ✅");
      if (type === 'question') {
        setQuestionInput('');
      } else {
        setCommentInput('');
      }
    } catch (e) {
      console.error("Error adding content: ", e);
      showMessage("Submission failed. Please try again. ❌");
    }
  };

  // Admin login handler.
  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      showMessage("Admin Login successful! 🔑");
    } else {
      showMessage("Incorrect password. 🚫");
      setIsAdmin(false);
    }
  };

  // Helper variables for conditional rendering.
  const isNameEntered = nameInput.trim().length > 0;
  
  // Conditional rendering for Admin view vs Student view.
  if (isAdmin) {
    return (
      <div className="relative min-h-screen bg-custom-purple-bg flex items-center justify-center p-4 overflow-hidden">
        <div className="relative w-full max-w-lg p-6 bg-white rounded-xl shadow-lg z-10 box-shadow-custom">
          <h1 className="text-3xl font-bold text-center mb-4 text-purple-700">Admin Dashboard</h1>
          <button
            onClick={() => setIsAdmin(false)}
            className="mb-4 p-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition duration-200"
          >
            Back to student view
          </button>
          
          {/* Admin Filters - Course and Date */}
          <div className="flex flex-col space-y-4 mb-6">
              <div className="flex justify-center items-center space-x-2">
                <label className="text-gray-600 text-lg">Select Class Date:</label>
                <input
                  type="date"
                  id="dateInput"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="p-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200"
                />
              </div>
            </div>
            {/* Course Selection Buttons */}
            <div className="flex flex-wrap justify-center gap-2 mb-6" id="courseButtons">
              {COURSES.map((course) => (
                <button
                  key={course}
                  onClick={() => setSelectedCourse(course)}
                  className={`p-3 text-sm font-medium rounded-lg transition duration-200 ease-in-out ${
                    selectedCourse === course
                      ? 'bg-purple-500 text-white border-2 border-purple-500 shadow-md'
                      : 'bg-gray-200 text-gray-800 border-2 border-gray-200 hover:bg-purple-100'
                  }`}
                >
                  {course}
                </button>
              ))}
            </div>
          
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-700">
            {selectedDate} - {selectedCourse} Data
          </h2>

          <div className="text-left p-4 border border-gray-300 rounded-xl mt-6 space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">📊 Understanding Log</h3>
            <ul className="list-none p-0 space-y-2">
              {feedbackLog.map((log, index) => (
                <li key={index} className="p-2 border-b border-gray-200 text-base text-gray-700">
                  {/* 1번 요청 수정: 시간 표시 형식 개선 */}
                  {log.name} ({log.timestamp ? `${log.timestamp.toDate().toLocaleDateString()} ${log.timestamp.toDate().toLocaleTimeString()}` : 'No date/time'}): {log.status}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-left p-4 border border-gray-300 rounded-xl mt-6 space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">❓ Questions/Comments Log</h3>
            <ul className="list-none p-0 space-y-2">
              {questionsLog.map((log, index) => (
                <li key={index} className="p-2 border-b border-gray-200 text-base text-gray-700">
                  {/* 1번 요청 수정: 시간 표시 형식 개선 */}
                  {log.name} [{log.type === 'question' ? 'Question' : 'Comment'}] ({log.timestamp ? `${log.timestamp.toDate().toLocaleDateString()} ${log.timestamp.toDate().toLocaleTimeString()}` : 'No date/time'}): {log.text}
              </li>
            ))}
          </ul>
        </div>
        </div>
      </div>
    );
  }

  // Student view
  return (
    <div className="relative min-h-screen bg-custom-purple-bg flex items-center justify-center p-4 overflow-hidden">
      {/* Main content container */}
      <div className="relative w-full max-w-lg p-6 bg-white rounded-xl shadow-lg z-10 box-shadow-custom">
        <h1 className="text-3xl font-bold text-center mb-1 text-gray-800">
          Ahnstoppable Learning:<br />
          <span className="font-extrabold text-purple-700">Freely Ask, Freely Learn</span>
        </h1>
        <div className="flex justify-center space-x-2 my-2 text-3xl">
          <span>😁</span>
          <span>😀</span>
          <span>😁</span>
        </div>

        {/* Course Selection Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-6 mt-4" id="courseButtons">
          {COURSES.map((course) => (
            <button
              key={course}
              onClick={() => {
                setSelectedCourse(course);
                setNameInput(''); // Reset name when course changes
              }}
              className={`p-3 text-sm font-medium rounded-lg transition duration-200 ease-in-out ${
                selectedCourse === course
                  ? 'bg-purple-500 text-white border-2 border-purple-500 shadow-md'
                  : 'bg-gray-200 text-gray-800 border-2 border-gray-200 hover:bg-purple-100'
              }`}
            >
              {course}
            </button>
          ))}
        </div>

        <h2 className="text-2xl font-semibold mb-4 text-center text-gray-700">{selectedCourse}</h2>

        {/* Name Dropdown Section */}
        <div className={`flex flex-col space-y-4 mb-6 ${!isFirebaseConnected && 'opacity-50'}`}>
          <select
            id="nameInput"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            disabled={!isFirebaseConnected}
            className="p-3 w-full border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select your name...</option>
            {COURSE_STUDENTS[selectedCourse].map((name, index) => (
              <option key={index} value={name}>{name}</option>
            ))}
          </select>
          <p className="text-center text-sm text-gray-500">
            {isNameEntered && isFirebaseConnected ? (
              <span className="text-purple-600 font-bold">Hello, {getFirstName(nameInput)}!</span>
            ) : (
              <span>Select your name to enable the features below.</span>
            )}
            {!isFirebaseConnected && (
              <span className="block text-red-500 font-bold mt-2">
                🚫 데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.
              </span>
            )}
          </p>
        </div>

        {/* Understanding Feedback Buttons */}
        <div className={`flex flex-col items-center space-y-4 mb-8 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
          <p className="text-xl font-medium text-gray-700">Understanding Check</p>
          <div className="flex justify-center space-x-4">
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleFeedback('Not Understood 🙁')}
                disabled={!isNameEntered || !isFirebaseConnected}
                // 3번 요청 수정: 클릭 시 시각적 피드백 클래스 추가
                className={`p-4 w-12 h-12 rounded-full bg-red-500 text-white text-base font-semibold transition duration-150 transform hover:scale-105 active:scale-95 shadow-md mb-2 disabled:opacity-50 disabled:cursor-not-allowed ${clickedButton === 'Not Understood 🙁' ? 'ring-4 ring-purple-500' : ''}`}
              ></button>
              <span className="text-sm">Not Understood</span>
            </div>
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleFeedback('Confused 🤔')}
                disabled={!isNameEntered || !isFirebaseConnected}
                // 3번 요청 수정: 클릭 시 시각적 피드백 클래스 추가
                className={`p-4 w-12 h-12 rounded-full bg-yellow-400 text-black text-base font-semibold transition duration-150 transform hover:scale-105 active:scale-95 shadow-md mb-2 disabled:opacity-50 disabled:cursor-not-allowed ${clickedButton === 'Confused 🤔' ? 'ring-4 ring-purple-500' : ''}`}
              ></button>
              <span className="text-sm">Confused</span>
            </div>
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleFeedback('Got It! ✅')}
                disabled={!isNameEntered || !isFirebaseConnected}
                // 3번 요청 수정: 클릭 시 시각적 피드백 클래스 추가
                className={`p-4 w-12 h-12 rounded-full bg-green-500 text-white text-base font-semibold transition duration-150 transform hover:scale-105 active:scale-95 shadow-md mb-2 disabled:opacity-50 disabled:cursor-not-allowed ${clickedButton === 'Got It! ✅' ? 'ring-4 ring-purple-500' : ''}`}
              ></button>
              <span className="text-sm">Got It!</span>
            </div>
          </div>
        </div>

        {/* Questions and Comments Input Section */}
        <div className={`flex flex-col space-y-4 mb-6 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
          <p className="text-lg font-medium text-gray-700">Leave a Question or Comment</p>
          <form onSubmit={(e) => handleAddContent(e, 'question')} className="flex space-x-2">
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="Enter a question here"
              disabled={!isNameEntered || !isFirebaseConnected}
              className="flex-1 p-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!isNameEntered || !isFirebaseConnected}
              className="p-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </form>

          <p className="text-base text-gray-600 font-semibold mt-4">What do you think? 🤔</p>
          <form onSubmit={(e) => handleAddContent(e, 'comment')} className="flex space-x-2">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Enter your thoughts here"
              disabled={!isNameEntered || !isFirebaseConnected}
              className="flex-1 p-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!isNameEntered || !isFirebaseConnected}
              className="p-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </form>
        </div>

        {/* Log Display Section */}
        <div className={`text-left p-4 border border-gray-300 rounded-xl mt-6 space-y-4 ${!isNameEntered || !isFirebaseConnected ? 'opacity-50' : ''}`}>
          <h3 className="text-xl font-semibold text-gray-800">📊 My Understanding Log</h3>
          <ul className="list-none p-0 space-y-2">
             {feedbackLog.map((log, index) => (
                <li key={index} className="p-2 border-b border-gray-200 text-base text-gray-700">
                  {/* 2번 요청 수정: 시간 표시 형식 개선 */}
                  ({log.timestamp ? `${log.timestamp.toDate().toLocaleDateString()} ${log.timestamp.toDate().toLocaleTimeString()}` : 'No date/time'}): {log.status}
                </li>
              ))}
          </ul>
          <h3 className="text-xl font-semibold text-gray-800 pt-4">❓ My Questions/Comments Log</h3>
          <ul className="list-none p-0 space-y-2">
            {questionsLog.map((log, index) => (
                <li key={index} className="p-2 border-b border-gray-200 text-base text-gray-700">
                  {/* 2번 요청 수정: 시간 표시 형식 개선 */}
                  [{log.type === 'question' ? 'Question' : 'Comment'}] ({log.timestamp ? `${log.timestamp.toDate().toLocaleDateString()} ${log.timestamp.toDate().toLocaleTimeString()}` : 'No date/time'}): {log.text}
                </li>
              ))}
          </ul>
        </div>
        
        {/* Admin Login Section */}
        <div className="flex flex-col items-center mt-8 p-4 border-t border-gray-300">
          <p className="text-md font-medium text-gray-700 mb-2">Admin Login</p>
          <div className="flex space-x-2">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Password"
              className="p-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={handleAdminLogin}
              className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition duration-200"
            >
              Login
            </button>
          </div>
        </div>
      </div>

      {/* Message Box */}
      {showMessageBox && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white p-6 rounded-xl text-center z-50 transition-opacity duration-300">
          {message}
        </div>
      )}
    </div>
  );
};

export default App;
