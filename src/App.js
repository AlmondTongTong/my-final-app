/* global __app_id */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  collection,
  collectionGroup,
  query,
  where,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  orderBy
} from 'firebase/firestore';

/* =========================
   Static data
   ========================= */
const COURSES = ["ADV 375-01", "ADV 375-02", "ADV 461"];
const COURSE_STUDENTS = {
  "ADV 375-01": ["Donovan, Robert","Ellison, Alexis","Futrell, Rylie","George, Matthew","Hammer, Olivia","Kobayashi, Sena","Lee, Byungho","Mady, Gabriella","Mawuenyega, Chloe","Oved, Liam","Sims, Ava","Soke, Duru","Walsh, William","Warmington, Charles","Yu, Wenbo"],
  "ADV 375-02": ["Alteio, Katherine","Asatryan, Natalie","Bondi, Ava","Brown, Kylie","Calabrese, Ella","Dougherty, Quinn","Dutton, Madeline","Grabinger, Katharina","Ju, Ashley","Lahanas, Dean","Lange, Bella-Soleil","McQuilling, Louisa","Milliman, Nicole","Nizdil, Kennedy","Salahieh, Zayd","Shannon, Savannah","Tang, Yuhan","Walz, Lucy","Wang, Michelle","Wanke, Karsten"],
  "ADV 461": ["Bonk, Maya","Burrow, Elizabeth","Campos, Victoria","Cantada, Cristian","Chong, Timothy","Chung, Sooa","Cwiertnia, Zachary","Fernandez, Francisco","Fok, Alexis","Gilbert, Jasmine","Hall, Lily","Hosea, Nicholas","Jang, Da Eun","Kim, Lynn","Kim, Noelle","Koning, William","Lee, Edmund","Lewandowski, Luke","Leyson, Noah","Lopez, Tatum","Murphy, Alexander","Swendsen, Katherine"]
};

/* =========================
   Env helpers (build-time constants)
   ========================= */
const ADDITIONAL_READ_IDS = (process.env.REACT_APP_ADDITIONAL_READ_APP_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/* =========================
   Utils
   ========================= */
const safeTime = (ts) => { try { return ts?.toDate?.().toLocaleTimeString() || ''; } catch { return ''; } };
const safeDate = (ts) => { try { return ts?.toDate?.().toLocaleDateString() || ''; } catch { return ''; } };

const isWithinClassTime = (courseName) => {
  const now = new Date();
  const la = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = la.getDay(), hour = la.getHours(), minute = la.getMinutes();
  const m = hour * 60 + minute;
  switch(courseName) {
    case "ADV 375-01": if (day===1 || day===4) { const s=8*60,e=9*60+50; return m>=s && m<=e; } return false;
    case "ADV 375-02": if (day===1 || day===4) { const s=12*60,e=13*60+50; return m>=s && m<=e; } return false;
    case "ADV 461": if (day===3) { const s=12*60,e=15*60+50; return m>=s && m<=e; } return false;
    default: return false;
  }
};

function usePreserveScroll(ref, deps) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prevBottom = el.scrollHeight - el.scrollTop;
    requestAnimationFrame(() => {
      if (!el) return;
      el.scrollTop = el.scrollHeight - prevBottom;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* =========================
   Talent Graph
   ========================= */
const TalentGraph = ({ talentsData, type, selectedCourse, getFirstName }) => {
  const displayData = useMemo(() => {
    const courseRoster = COURSE_STUDENTS[selectedCourse] || [];
    const talentMap = new Map(talentsData.map(t => [t.id, t.totalTalents]));
    const allStudents = courseRoster.map(name => ({ id: name, name, totalTalents: talentMap.get(name) || 0 }));
    const sorted = allStudents.sort((a, b) => b.totalTalents - a.totalTalents);
    if (type === 'admin') return sorted;
    if (type === 'student' && sorted.length > 0) {
      const highest = sorted[0], lowest = sorted[sorted.length-1];
      return highest.id === lowest.id ? [highest] : [highest, lowest];
    }
    return [];
  }, [talentsData, selectedCourse, type]);

  if (displayData.length === 0) return <p className="text-gray-400 text-lg">No talent data yet.</p>;
  const maxScore = displayData[0].totalTalents || 0;

  return (
    <div className="space-y-4">
      {displayData.map(t => (
        <div key={t.id} className="w-full">
          <div className="flex justify-between text-lg text-gray-300 mb-1">
            <span>{type === 'admin' ? getFirstName(t.name) : (t.id === displayData[0].id ? 'Highest Score' : 'Lowest Score')}</span>
            <span>{t.totalTalents}</span>
          </div>
          <div className="w-full bg-slate-600 rounded-full h-5">
            <div className="bg-yellow-400 h-5 rounded-full" style={{ width: maxScore>0 ? `${(t.totalTalents/maxScore)*100}%` : '0%' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* =========================
   ContentForm with localStorage draft
   ========================= */
const ContentForm = React.memo(({ formKey, type, onAddContent, isEnabled, placeholder }) => {
  const STORAGE_KEY = 'draft:' + formKey + ':' + type;
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) || '');

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    localStorage.setItem(STORAGE_KEY, v);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAddContent(text, type);
    setText('');
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
      <textarea value={text} onChange={onChange} placeholder={placeholder} disabled={!isEnabled}
        className="flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-2xl resize-none h-28" />
      <button type="submit" disabled={!isEnabled || !text.trim()}
        className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 self-end sm:self-center text-xl">
        Add
      </button>
    </form>
  );
});

/* =========================
   Admin Login
   ========================= */
const AdminLoginForm = ({ onAdminLogin }) => {
  const [password, setPassword] = useState('');
  return (
    <div className="flex space-x-2">
      <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password"
        className="p-2 border bg-slate-700 border-slate-500 rounded-lg text-lg" />
      <button onClick={()=>onAdminLogin(password)} className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-lg">Login</button>
    </div>
  );
};

/* =========================
   PIN Auth
   ========================= */
const PinAuth = React.memo(({ nameInput, isPinRegistered, onLogin, onRegister, getFirstName }) => {
  const [pinInput,setPinInput]=useState(''); const [pinConfirm,setPinConfirm]=useState('');
  if(!nameInput) return null;

  return isPinRegistered ? (
    <div className="my-4 p-4 bg-slate-700 rounded-lg animate-fade-in">
      <p className="text-center text-white mb-2 font-semibold text-2xl">Enter your 4-digit PIN, {getFirstName(nameInput)}.</p>
      <div className="flex space-x-2">
        <input type="password" inputMode="numeric" maxLength="4" value={pinInput} onChange={(e)=>setPinInput(e.target.value)}
          className="flex-1 p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center"/>
        <button onClick={()=>{ onLogin(pinInput); setPinInput(''); }} className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xl">Login</button>
      </div>
    </div>
  ) : (
    <div className="my-4 p-4 bg-slate-700 rounded-lg animate-fade-in">
      <p className="text-center text-white mb-2 font-semibold text-2xl">
        First time? Create your 4-digit PIN.<br/><span className="text-lg font-normal">(Use the last 4 digits of your Student ID)</span>
      </p>
      <div className="space-y-2">
        <input type="password" inputMode="numeric" maxLength="4" value={pinInput} onChange={(e)=>setPinInput(e.target.value)}
          placeholder="Create 4-digit PIN" className="w-full p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center"/>
        <input type="password" inputMode="numeric" maxLength="4" value={pinConfirm} onChange={(e)=>setPinConfirm(e.target.value)}
          placeholder="Confirm PIN" className="w-full p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center"/>
        <button onClick={()=>{ onRegister(pinInput, pinConfirm); setPinInput(''); setPinConfirm(''); }}
          className="w-full p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-xl">Register & Start</button>
      </div>
    </div>
  );
});

/* =========================
   Main App
   ========================= */
const App = () => {
  // appId 해석
  const resolvedAppId = (typeof __app_id !== 'undefined' && __app_id)
    ? __app_id
    : (process.env.REACT_APP_APP_ID || 'default-app-id');

  const ADMIN_PASSWORD = '0811';

  const [db, setDb] = useState(null);

  const [nameInput, setNameInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(COURSES[0]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPinRegistered, setIsPinRegistered] = useState(false);

  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);

  const [isClassActive, setIsClassActive] = useState(false);
  const [talentsLog, setTalentsLog] = useState([]);

  const [studentSelectedDate, setStudentSelectedDate] = useState(()=>new Date().toISOString().slice(0,10));
  const [adminSelectedDate, setAdminSelectedDate] = useState(()=>new Date().toISOString().slice(0,10));
  const [adminSelectedStudent, setAdminSelectedStudent] = useState('');

  const [myTotalTalents, setMyTotalTalents] = useState(0);
  const [talentTransactions, setTalentTransactions] = useState([]);

  const [questionsLog, setQuestionsLog] = useState([]);
  const [feedbackLog, setFeedbackLog] = useState([]);

  const [allPostsLog, setAllPostsLog] = useState([]);

  const [activePoll, setActivePoll] = useState(null);
  const [userPollVote, setUserPollVote] = useState(null);

  const [replies, setReplies] = useState({});
  const [showReplies, setShowReplies] = useState({});
  const [isAdminAnonymousMode, setIsAdminAnonymousMode] = useState(false);

  const [dailyProgress, setDailyProgress] = useState({ question_comment: 0, reasoning: 0 });
  const [clickedButton, setClickedButton] = useState(null);
  const [verbalParticipationCount, setVerbalParticipationCount] = useState(0);

  const showMessage = useCallback((msg) => {
    setMessage(msg); setShowMessageBox(true);
    setTimeout(()=>{ setShowMessageBox(false); setMessage(''); }, 2000);
  }, []);

  const getFirstName = useCallback((fullName) => {
    if (!fullName) return '';
    const parts = fullName.split(', ');
    return parts.length > 1 ? parts[1] : parts[0];
  }, []);

  /* Firebase init */
  useEffect(() => {
    const firebaseConfig = {
      apiKey: "AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U", // Note: It's safer to use environment variables for API keys.
      authDomain: "ahnstoppable-learning.firebaseapp.com",
      projectId: "ahnstoppable-learning"
    };
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    setDb(getFirestore(app));
    signInAnonymously(auth).catch(console.error);
  }, []);

  /* PIN check */
  useEffect(() => {
    if (!db || !nameInput) { setIsPinRegistered(false); return; }
    const checkPin = async () => {
      const pinDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/studentPins`, nameInput);
      const docSnap = await getDoc(pinDocRef);
      setIsPinRegistered(docSnap.exists());
    };
    checkPin();
  }, [db, nameInput, resolvedAppId]);

  const handleNameChange = (newName) => { setNameInput(newName); setIsAuthenticated(false); };

  const handlePinLogin = useCallback(async (pin) => {
    if (!db || !nameInput) return showMessage("Please select your name first.");
    const pinDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/studentPins`, nameInput);
    try {
      const docSnap = await getDoc(pinDocRef);
      if (docSnap.exists() && docSnap.data().pin === pin) {
        setIsAuthenticated(true); showMessage(`Welcome, ${getFirstName(nameInput)}!`);
      } else { showMessage("Incorrect PIN."); }
    } catch { showMessage("Login error."); }
  }, [db, nameInput, resolvedAppId, getFirstName, showMessage]);

  const handlePinRegister = useCallback(async (pin, confirmation) => {
    if (!db || !nameInput) return showMessage("Please select your name first.");
    if (pin.length !== 4) return showMessage("PIN must be 4 digits.");
    if (pin !== confirmation) return showMessage("PINs do not match.");
    const pinDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/studentPins`, nameInput);
    try {
      await setDoc(pinDocRef, { pin });
      setIsAuthenticated(true);
      showMessage(`PIN registered! Welcome, ${getFirstName(nameInput)}!`);
    } catch { showMessage("Error registering PIN."); }
  }, [db, nameInput, resolvedAppId, getFirstName, showMessage]);

  /* Class time check */
  useEffect(() => {
    const checkTime = () => setIsClassActive(isWithinClassTime(selectedCourse));
    checkTime();
    const interval = setInterval(checkTime, 30000);
    return () => clearInterval(interval);
  }, [selectedCourse]);

  /* Talents */
  useEffect(() => {
    if (!db) return;
    const talentsQuery = query(collection(db, `/artifacts/${resolvedAppId}/public/data/talents`), where("course","==",selectedCourse));
    const unsub = onSnapshot(talentsQuery, snap => setTalentsLog(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => unsub();
  }, [db, selectedCourse, resolvedAppId]);

  /* Admin lists */
  const adminListRefQC = useRef(null);
  const adminListRefReason = useRef(null);
  usePreserveScroll(adminListRefQC, [questionsLog.length]);
  usePreserveScroll(adminListRefReason, [questionsLog.length]);

  useEffect(() => {
    if (!db || !isAdmin) return;
    setQuestionsLog([]);

    const appIdsForRead = [resolvedAppId, ...ADDITIONAL_READ_IDS];
    const questionsPath = `/artifacts/${resolvedAppId}/public/data/questions`; // [수정됨] 경로 변수화
    const feedbackPath = `/artifacts/${resolvedAppId}/public/data/feedback`; // [수정됨] 경로 변수화

    // Questions/comments & reasoning
    const qQ = query(
      collection(db, questionsPath), // [수정됨] collectionGroup -> collection
      where("course","==",selectedCourse),
      where("date","==",adminSelectedDate),
      orderBy("timestamp","asc")
    );
    const unsubQ = onSnapshot(qQ, (snapshot) => {
      setQuestionsLog(prev => {
        const map = new Map(prev.map(x=>[x.id,x]));
        snapshot.docChanges().forEach(ch => {
          const data = { id: ch.doc.id, ...ch.doc.data() };
          if (data.appId && !appIdsForRead.includes(data.appId)) return;
          if (ch.type === "added" || ch.type === "modified") map.set(data.id, data);
          if (ch.type === "removed") map.delete(data.id);
        });
        return Array.from(map.values()).sort((a,b)=>{
          const ta = a.timestamp?.seconds || 0;
          const tb = b.timestamp?.seconds || 0;
          return ta - tb;
        });
      });
    });

    // Feedback
    const qF = query(
      collection(db, feedbackPath), // [수정됨] collectionGroup -> collection
      where("course","==",selectedCourse),
      where("date","==",adminSelectedDate),
      orderBy("timestamp","asc")
    );
    const unsubF = onSnapshot(qF, snap => {
      const rows = snap.docs.map(d=>({id:d.id,...d.data()})).filter(x => !x.appId || appIdsForRead.includes(x.appId));
      setFeedbackLog(rows);
    });

    return () => { unsubQ(); unsubF(); };
  }, [db, selectedCourse, adminSelectedDate, resolvedAppId, isAdmin]);

  /* Admin: per student */
  const [adminStudentLog, setAdminStudentLog] = useState([]);
  useEffect(() => {
    if (!db || !isAdmin || !adminSelectedStudent) { setAdminStudentLog([]); return; }

    const appIdsForRead = [resolvedAppId, ...ADDITIONAL_READ_IDS];
    const questionsPath = `/artifacts/${resolvedAppId}/public/data/questions`; // [수정됨] 경로 변수화

    const logQuery = query(
      collection(db, questionsPath), // [수정됨] collectionGroup -> collection
      where("course","==",selectedCourse),
      where("name","==",adminSelectedStudent),
      orderBy("timestamp","asc")
    );
    const unsub = onSnapshot(logQuery, snap => {
      const rows = snap.docs.map(d=>({id:d.id,...d.data()})).filter(x => !x.appId || appIdsForRead.includes(x.appId));
      setAdminStudentLog(rows);
    });
    return () => unsub();
  }, [db, selectedCourse, adminSelectedStudent, resolvedAppId, isAdmin]);

  /* Student view */
  const studentListRefQC = useRef(null);
  const studentListRefReason = useRef(null);
  usePreserveScroll(studentListRefQC, [allPostsLog.length]);
  usePreserveScroll(studentListRefReason, [allPostsLog.length]);

  useEffect(() => {
    if (!db || isAdmin || !nameInput || !isAuthenticated) {
      setAllPostsLog([]); setMyTotalTalents(0); setTalentTransactions([]);
      setDailyProgress({ question_comment: 0, reasoning: 0 });
      return;
    }
    
    const appIdsForRead = [resolvedAppId, ...ADDITIONAL_READ_IDS];
    const questionsPath = `/artifacts/${resolvedAppId}/public/data/questions`; // [수정됨] 경로 변수화
    const feedbackPath = `/artifacts/${resolvedAppId}/public/data/feedback`; // [수정됨] 경로 변수화

    const transactionsQuery = query(
      collection(db, `/artifacts/${resolvedAppId}/public/data/talentTransactions`),
      where("name","==",nameInput),
      orderBy("timestamp","desc")
    );
    const unsubT = onSnapshot(transactionsQuery, snap => {
      const today = new Date().toISOString().slice(0,10);
      const todays = snap.docs.map(d=>d.data()).filter(t => t.timestamp?.toDate().toISOString().slice(0,10)===today);
      setTalentTransactions(todays);
      setVerbalParticipationCount(todays.filter(t => t.type === 'verbal_participation').length);
    });

    const talentDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/talents`, nameInput);
    const unsubM = onSnapshot(talentDocRef, d => setMyTotalTalents(d.exists()? d.data().totalTalents : 0));

    setAllPostsLog([]);
    const allPostsQuery = query(
      collection(db, questionsPath), // [수정됨] collectionGroup -> collection
      where("course","==",selectedCourse),
      where("date","==",studentSelectedDate),
      orderBy("timestamp","asc")
    );
    const unsubAll = onSnapshot(allPostsQuery, snapshot => {
      const posts = snapshot.docs.map(d=>({id:d.id,...d.data()}))
        .filter(p => !p.appId || appIdsForRead.includes(p.appId));
      setAllPostsLog(posts);
      const myPosts = posts.filter(p => p.name === nameInput);
      setDailyProgress({
        question_comment: myPosts.filter(a => a.type === 'question_comment').length,
        reasoning: myPosts.filter(a => a.type === 'reasoning').length
      });
    });

    // 내 피드백 로그(표시만)
    const feedbackQuery = query(
      collection(db, feedbackPath), // [수정됨] collectionGroup -> collection
      where("course","==",selectedCourse),
      where("name","==",nameInput),
      where("date","==",studentSelectedDate),
      orderBy("timestamp","asc")
    );
    const unsubF = onSnapshot(feedbackQuery, () => {});

    return () => { unsubM(); unsubT(); unsubAll(); unsubF(); };
  }, [db, selectedCourse, nameInput, studentSelectedDate, resolvedAppId, isAdmin, isAuthenticated]);

  /* Polls */
  useEffect(() => {
    if (!db || !isAuthenticated) { setActivePoll(null); return; }
    const pollQuery = query(
      collection(db, `/artifacts/${resolvedAppId}/public/data/polls`),
      where("course","==",selectedCourse),
      where("isActive","==",true)
    );
    const unsubscribe = onSnapshot(pollQuery, snapshot => {
      if (!snapshot.empty) {
        const pollData = snapshot.docs[0].data(); const pollId = snapshot.docs[0].id;
        setActivePoll({ id: pollId, ...pollData });
        if (pollData.responses && pollData.responses[nameInput] !== undefined) setUserPollVote(pollData.responses[nameInput]);
        else setUserPollVote(null);
      } else setActivePoll(null);
    });
    return () => unsubscribe();
  }, [db, selectedCourse, isAuthenticated, nameInput, resolvedAppId]);

  /* Actions */
  const modifyTalent = useCallback(async (studentName, amount, type) => {
    if (!db) return;
    const talentDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/talents`, studentName);
    const transactionColRef = collection(db, `/artifacts/${resolvedAppId}/public/data/talentTransactions`);
    try {
      const docSnap = await getDoc(talentDocRef);
      let currentTalents = docSnap.exists() ? docSnap.data().totalTalents || 0 : 0;
      const newTotal = currentTalents + amount;
      if (newTotal < 0) return showMessage("Talent cannot go below 0.");
      if (docSnap.exists()) await updateDoc(talentDocRef, { totalTalents: newTotal });
      else await setDoc(talentDocRef, { name: studentName, course: selectedCourse, totalTalents: newTotal });
      if(type !== 'automatic') showMessage(`${getFirstName(studentName)} received ${amount > 0 ? `+${amount}` : amount} Talent!`);
      await addDoc(transactionColRef, { name: studentName, course: selectedCourse, points: amount, type, timestamp: serverTimestamp() });
    } catch (e) { console.error("Error modifying talent: ", e); }
  }, [db, resolvedAppId, selectedCourse, getFirstName, showMessage]);

  const handleAddContent = useCallback(async (text, type) => {
    if (!db || !nameInput.trim() || !text.trim()) return;
    const today = new Date().toISOString().slice(0,10);
    try {
      await addDoc(collection(db, `/artifacts/${resolvedAppId}/public/data/questions`), {
        appId: resolvedAppId,
        name: nameInput, text, type, course: selectedCourse, date: today,
        createdAtClient: Date.now(),
        timestamp: serverTimestamp(),
        studentLiked: false, adminLiked: false
      });
      showMessage("Submission complete! ✅");
      await modifyTalent(nameInput, 1, 'automatic');
    } catch { showMessage("Submission failed. ❌"); }
  }, [db, nameInput, selectedCourse, resolvedAppId, modifyTalent, showMessage]);

  const handleAdminLogin = (password) => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      showMessage("Admin Login successful! 🔑");
    } else {
      showMessage("Incorrect password. 🚫");
    }
  };

  const handleReply = useCallback(async (logId, replyText) => {
    if (!db) return;
    const questionDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/questions`, logId);
    try { await updateDoc(questionDocRef, { reply: replyText }); showMessage("Reply sent!"); }
    catch (e) { showMessage("Failed to send reply."); console.error(e); }
  }, [db, resolvedAppId, showMessage]);

  const handleAdminLike = useCallback(async (logId, authorFullName) => {
    if(!db) return;
    const questionDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/questions`, logId);
    try {
      const docSnap = await getDoc(questionDocRef);
      if (docSnap.exists() && !docSnap.data().adminLiked) {
        await updateDoc(questionDocRef, { adminLiked: true });
        await modifyTalent(authorFullName, 1, 'post_bonus');
      }
    } catch (e) { console.error("Error (admin like):", e) }
  }, [db, resolvedAppId, modifyTalent]);

  const handleCreatePoll = useCallback(async (question, options) => {
    if (!db || !isAdmin) return;
    try {
      await addDoc(collection(db, `/artifacts/${resolvedAppId}/public/data/polls`), {
        question, options, course: selectedCourse, isActive: true, responses: {}, timestamp: serverTimestamp()
      });
      showMessage("Poll published successfully!");
    } catch (e) { showMessage("Error publishing poll."); console.error("Error creating poll: ", e); }
  }, [db, isAdmin, selectedCourse, resolvedAppId, showMessage]);

  const handlePollVote = useCallback(async (pollId, optionIndex) => {
    if (!db || !nameInput) return;
    const pollDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/polls`, pollId);
    try { await updateDoc(pollDocRef, { [`responses.${nameInput}`]: optionIndex }); }
    catch (e) { console.error("Error voting on poll: ", e); }
  }, [db, nameInput, resolvedAppId]);

  const handleDeactivatePoll = useCallback(async (pollId) => {
    if (!db || !isAdmin) return;
    const pollDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/polls`, pollId);
    try { await updateDoc(pollDocRef, { isActive: false }); showMessage("Poll closed."); }
    catch (e) { showMessage("Error closing poll."); console.error("Error deactivating poll: ", e); }
  }, [db, isAdmin, resolvedAppId, showMessage]);

  const handleAddReply = useCallback(async (postId, replyText) => {
    if (!db || !nameInput) return;
    if (!replyText || !replyText.trim()) return;
    const repliesColRef = collection(db, `/artifacts/${resolvedAppId}/public/data/questions/${postId}/replies`);
    try {
      await addDoc(repliesColRef, {
        appId: resolvedAppId,
        text: replyText, author: getFirstName(nameInput), authorFullName: nameInput,
        adminLiked: false, createdAtClient: Date.now(), timestamp: serverTimestamp()
      });
      await modifyTalent(nameInput, 1, 'peer_reply');
    } catch (e) { console.error("Error adding reply: ", e); }
  }, [db, nameInput, getFirstName, resolvedAppId, modifyTalent]);

  /* Replies subscriptions */
  const replyUnsubs = useRef({});
  const toggleReplies = useCallback((postId) => {
    setShowReplies(prev => {
      const next = !prev[postId];
      if (next && db) { // [수정됨] db가 초기화되었는지 확인
        const repliesQuery = query(
          collection(db, `/artifacts/${resolvedAppId}/public/data/questions/${postId}/replies`),
          orderBy("timestamp","asc")
        );
        replyUnsubs.current[postId]?.();
        replyUnsubs.current[postId] = onSnapshot(repliesQuery, (snapshot) => {
          const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setReplies(prevR => ({ ...prevR, [postId]: fetched }));
        });
      } else {
        replyUnsubs.current[postId]?.();
        delete replyUnsubs.current[postId];
      }
      return { ...prev, [postId]: next };
    });
  }, [db, resolvedAppId]);


  useEffect(() => {
    return () => {
      Object.values(replyUnsubs.current).forEach(fn => fn && fn());
      replyUnsubs.current = {};
    };
  }, []);

  const isNameEntered = nameInput.trim().length > 0;
  const isReadyToParticipate = isAuthenticated && isClassActive;

  /* Admin Daily Progress */
  const adminDailyProgress = useMemo(() => {
    const roster = COURSE_STUDENTS[selectedCourse] || [];
    const init = roster.reduce((acc, n) => { acc[n] = { question_comment: 0, reasoning: 0 }; return acc; }, {});
    questionsLog.forEach(log => {
      if (init[log.name]) {
        if (log.type === 'question_comment') init[log.name].question_comment++;
        if (log.type === 'reasoning') init[log.name].reasoning++;
      }
    });
    return init;
  }, [questionsLog, selectedCourse]);

  /* Derived lists for student/admin views */
  const qcPostsAdmin = questionsLog.filter(p=>p.type==='question_comment');
  const reasoningPostsAdmin = questionsLog.filter(p=>p.type==='reasoning');
  const studentReasoningPosts = allPostsLog.filter(p => p.type === 'reasoning');
  const studentQcPosts = allPostsLog.filter(p => p.type === 'question_comment');

  /* Small components inside App */
  const ReplyForm = ({ log, onReply }) => {
    const [replyText, setReplyText] = useState(log.reply || '');
    return (
      <div className="mt-2 flex items-center space-x-2">
        <input type="text" value={replyText} onChange={(e)=>setReplyText(e.target.value)} placeholder="Write a reply..."
          className="flex-1 p-2 border bg-slate-600 border-slate-500 rounded-lg text-lg" />
        <button onClick={()=>onReply(log.id, replyText)} className="p-2 bg-blue-500 hover:bg-blue-600 text-white text-lg rounded-lg">Send</button>
        <button onClick={()=>{ setReplyText("Addressed in class"); onReply(log.id,"Addressed in class"); }}
          className="p-2 bg-gray-500 hover:bg-gray-600 text-white text-lg rounded-lg whitespace-nowrap">Addressed</button>
      </div>
    );
  };

  const StudentReplyForm = ({ postId, onAddReply }) => {
    const [replyText, setReplyText] = useState('');
    return (
      <div className="mt-2 flex items-center space-x-2">
        <input type="text" value={replyText} onChange={(e)=>setReplyText(e.target.value)} placeholder="Write an anonymous reply..."
          className="flex-1 p-2 border bg-slate-600 border-slate-500 rounded-lg text-lg" />
        <button onClick={()=>{ onAddReply(postId, replyText); setReplyText(''); }}
          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-lg">Reply</button>
      </div>
    );
  };

  const PostList = React.memo(function PostList({
    posts, type, onAdminLike, onPenalty, onReply, onStudentAddReply,
    toggleReplies, showReplies, replies, listRef, anonymizeName, getFirstName
  }) {
    return (
      <ul ref={listRef} className="h-[600px] overflow-y-auto text-xl mt-2">
        {posts.map((log) => (
          <li key={log.id} className="p-2 border-b border-slate-700">
            <div className="flex justify-between items-start">
              <span className="flex-1 mr-2">{anonymizeName ? "Anonymous" : getFirstName(log.name)} [{log.type}]: {log.text}</span>
              {type === 'admin' && (
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {log.adminLiked ? <span className="text-green-500 font-bold text-lg">✓ Liked</span>
                    : <button onClick={()=>onAdminLike(log.id, log.name)} className="text-3xl">👍</button>}
                  <button onClick={()=>onPenalty(log.name)} className="px-3 py-1 bg-red-600 text-white text-md font-bold rounded hover:bg-red-700">-1</button>
                </div>
              )}
            </div>
            {log.reply && <div className="mt-2 p-2 bg-green-900 rounded-lg text-lg"><span className="font-bold">✓ Professor Replied: </span>{log.reply}</div>}
            {type==='admin' && <ReplyForm log={log} onReply={onReply} />}
            <button onClick={()=>toggleReplies(log.id)} className="text-lg text-blue-400 mt-1">{showReplies[log.id] ? 'Hide Replies' : `Show Replies (${replies[log.id]?.length || 0})`}</button>
            {showReplies[log.id] && (
              <div className="mt-2 pl-4 border-l-2 border-slate-500">
                <ul className="text-lg mt-2">{replies[log.id]?.map(r => <li key={r.id} className="pt-1 flex justify-between items-center"><span>{anonymizeName ? "Anonymous" : r.author}: {r.text}</span></li>)}</ul>
                {type!=='admin' && <StudentReplyForm postId={log.id} onAddReply={onStudentAddReply || (()=>{})} />}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  });

    // [수정됨] 미완성이던 Poll 관련 컴포넌트 전체 완성
    const PollComponent = ({ poll, onVote, userVote, isAdminView }) => {
        const totalVotes = poll.options.map((_, index) =>
            Object.values(poll.responses || {}).filter(v => v === index).length
        ).reduce((acc, count) => acc + count, 0);

        return (
            <div className="p-4 bg-slate-700 rounded-lg my-4">
                <h3 className="text-2xl font-bold mb-3">{poll.question}</h3>
                <div className="space-y-2">
                    {poll.options.map((option, index) => {
                        const votes = Object.values(poll.responses || {}).filter(v => v === index).length;
                        const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                        const isVoted = userVote === index;

                        return (
                            <div key={index}>
                                {isAdminView ? (
                                    <div>
                                        <div className="flex justify-between text-lg mb-1">
                                            <span>{option}</span>
                                            <span>{votes} vote(s)</span>
                                        </div>
                                        <div className="w-full bg-slate-600 rounded-full h-5">
                                            <div className="bg-blue-500 h-5 rounded-full" style={{ width: `${percentage}%` }} />
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => onVote(poll.id, index)}
                                        disabled={userVote !== null}
                                        className={`w-full text-left p-3 rounded-lg text-xl border-2 ${isVoted ? 'bg-green-600 border-green-400' : 'bg-slate-600 border-slate-500 hover:bg-slate-500'} disabled:opacity-70 disabled:cursor-not-allowed`}
                                    >
                                        {option} {isVoted && '✓'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

  const CreatePollForm = ({ onCreatePoll, onDeactivatePoll, activePoll }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '', '']);
    const handleOptionChange=(i,v)=>{ const ns=[...options]; ns[i]=v; setOptions(ns); };
    const addOption=()=>setOptions([...options,'']);
    const handleSubmit=()=> {
      const valid = options.filter(o=>o.trim()!=='');
      if (question.trim() && valid.length>1) { onCreatePoll(question, valid); setQuestion(''); setOptions(['','','']); }
      else alert("Please provide a question and at least two options.");
    };

    if (activePoll) {
      return (
        <div className="p-4 border border-slate-600 rounded-xl mb-6">
          <h3 className="text-3xl font-semibold">Active Poll Results</h3>
          <PollComponent poll={activePoll} isAdminView={true} userVote={null} />
          <button onClick={()=>onDeactivatePoll(activePoll.id)} className="w-full p-2 mt-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xl">Close Poll</button>
        </div>
      );
    }

    return (
      <div className="p-4 border border-slate-600 rounded-xl mb-6">
        <h3 className="text-3xl font-semibold mb-2">Create New Poll</h3>
        <input type="text" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Poll Question"
          className="w-full p-2 mb-2 bg-slate-700 border border-slate-500 rounded-lg text-xl"/>
        {options.map((opt, idx) => (
          <input
            key={idx}
            type="text"
            value={opt}
            onChange={(e) => handleOptionChange(idx, e.target.value)}
            placeholder={`Option ${idx + 1}`}
            className="w-full p-2 mb-2 bg-slate-700 border border-slate-500 rounded-lg text-xl"
          />
        ))}
        <button onClick={addOption} className="w-full p-2 mt-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xl">Add Option</button>
        <button onClick={handleSubmit} className="w-full p-2 mt-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xl">Create Poll</button>
      </div>
    );
  };

  // Main render of the App component
  return (
    <div className="bg-slate-800 text-white min-h-screen p-4 sm:p-6 font-sans">
      {showMessageBox && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 text-white text-xl p-4 rounded-lg z-50 animate-fade-in-out">
          {message}
        </div>
      )}
      <header className="flex flex-wrap justify-between items-center mb-6 border-b border-slate-600 pb-4">
        <h1 className="text-5xl font-bold text-orange-400">Ahn-stoppable Learning</h1>
        <div className="flex items-center space-x-4 mt-2 sm:mt-0">
          <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="p-2 bg-slate-700 border border-slate-500 rounded-lg text-lg">
            {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {!isAdmin && <AdminLoginForm onAdminLogin={handleAdminLogin} />}
        </div>
      </header>

      {/* Main Content */}
      <main>
        {isAdmin ? (
          /* ================= ADMIN VIEW ================= */
          <div>Admin View Content Here</div>
        ) : (
          /* ================= STUDENT VIEW ================= */
          <div>
            {!isAuthenticated ? (
              <div className="max-w-md mx-auto">
                <h2 className="text-3xl font-semibold text-center mb-4">Select Your Name</h2>
                <select onChange={(e) => handleNameChange(e.target.value)} value={nameInput} className="w-full p-3 bg-slate-700 border border-slate-500 rounded-lg text-2xl mb-4">
                  <option value="">-- Select --</option>
                  {(COURSE_STUDENTS[selectedCourse] || []).map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <PinAuth nameInput={nameInput} isPinRegistered={isPinRegistered} onLogin={handlePinLogin} onRegister={handlePinRegister} getFirstName={getFirstName} />
              </div>
            ) : (
              <div>
                <h2 className="text-3xl font-bold mb-4">Welcome, {getFirstName(nameInput)}!</h2>
                {activePoll && <PollComponent poll={activePoll} onVote={handlePollVote} userVote={userPollVote} isAdminView={false} />}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Questions & Comments Section */}
                    <div className="bg-slate-900 p-4 rounded-lg">
                        <h3 className="text-2xl font-semibold mb-2">Questions & Comments</h3>
                        <ContentForm formKey={nameInput} type="question_comment" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} placeholder="Ask a question or share a comment..." />
                        <PostList
                            posts={studentQcPosts}
                            type="student"
                            onStudentAddReply={handleAddReply}
                            toggleReplies={toggleReplies}
                            showReplies={showReplies}
                            replies={replies}
                            listRef={studentListRefQC}
                            anonymizeName={true}
                            getFirstName={getFirstName}
                        />
                    </div>

                    {/* Reasoning Section */}
                    <div className="bg-slate-900 p-4 rounded-lg">
                        <h3 className="text-2xl font-semibold mb-2">Reasoning</h3>
                        <ContentForm formKey={nameInput} type="reasoning" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} placeholder="Provide reasoning for your poll answer..." />
                        <PostList
                            posts={studentReasoningPosts}
                            type="student"
                            onStudentAddReply={handleAddReply}
                            toggleReplies={toggleReplies}
                            showReplies={showReplies}
                            replies={replies}
                            listRef={studentListRefReason}
                            anonymizeName={true}
                            getFirstName={getFirstName}
                        />
                    </div>
                </div>

              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};


export default App;