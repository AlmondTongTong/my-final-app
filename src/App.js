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

  // ✅ ESLint 경고 방지: 실제로 아래에서 사용함
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

  const [questionsLog, setQuestionsLog] = useState([]);    // admin master
  const [feedbackLog, setFeedbackLog] = useState([]);

  const [allPostsLog, setAllPostsLog] = useState([]);      // student day posts

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
      apiKey: "AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U",
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

    // 읽기용 appIds (deps는 resolvedAppId만)
    const appIdsForRead = [resolvedAppId, ...ADDITIONAL_READ_IDS];

    // Questions/comments & reasoning
    const qQ = query(
      collectionGroup(db, 'questions'),
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
      collectionGroup(db, 'feedback'),
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

    const logQuery = query(
      collectionGroup(db, 'questions'),
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
      collectionGroup(db, 'questions'),
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
      collectionGroup(db, 'feedback'),
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
      await addDoc(transactionColRef, { name: studentName, points: amount, type, timestamp: serverTimestamp() });
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

  // ✅ ADMIN_PASSWORD 실제 사용
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
      if (next) {
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
            {log.reply && <div className="mt-2 p-2 bg-green-900 rounded-lg text-lg"><span className="font-bold">✓ You Replied</span></div>}
            {type==='admin' && <ReplyForm log={log} onReply={onReply} />}
            <button onClick={()=>toggleReplies(log.id)} className="text-lg text-blue-400 mt-1">{showReplies[log.id] ? 'Hide Replies' : 'Show Replies'}</button>
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

  const CreatePollForm = ({ onCreatePoll, onDeactivatePoll, activePoll }) => {
    const [question, setQuestion] = useState(''); const [options, setOptions] = useState(['','','']);
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
        {options.map((opt,idx)=>(
          <input key={idx} type="text" value={opt} onChange={e=>handleOptionChange(idx,e.target.value)} placeholder={`Option ${idx+1}`}
            className="w-full p-2 mb-2 bg-slate-700 border border-slate-500 rounded-lg text-xl"/>
        ))}
        <button onClick={addOption} className="text-lg text-blue-400 mb-2">+ Add Option</button>
        <button onClick={handleSubmit} className="w-full p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xl">Publish Poll</button>
      </div>
    );
  };

  const PollComponent = ({ poll, onVote, userVote, isAdminView=false }) => {
    const results = useMemo(() => {
      const responses = poll.responses ? Object.values(poll.responses) : [];
      const totalVotes = responses.length;
      const votesPerOption = poll.options.map((_,i)=>responses.filter(v=>v===i).length);
      return { totalVotes, percentages: votesPerOption.map(c=> totalVotes>0 ? (c/totalVotes)*100 : 0) };
    }, [poll]);
    const hasVoted = userVote !== null;
    return (
      <div className="p-4 border border-orange-500 rounded-xl my-6 bg-slate-700">
        <h3 className="text-3xl font-semibold text-orange-400 mb-2">{poll.question}</h3>
        <div className="space-y-2">
          {poll.options.map((opt, idx) => {
            const p = results.percentages[idx] || 0;
            if (hasVoted || isAdminView) {
              return (
                <div key={idx} className="p-2 bg-slate-600 rounded-lg">
                  <div className="flex justify-between text-white mb-1 text-xl"><span>{opt}</span><span>{p.toFixed(0)}%</span></div>
                  <div className="w-full bg-slate-500 rounded-full h-5"><div className="bg-orange-500 h-5 rounded-full" style={{ width: `${p}%` }} /></div>
                </div>
              );
            }
            return (
              <button key={idx} onClick={()=>onVote(poll.id, idx)} className="w-full text-left p-3 bg-slate-600 hover:bg-slate-500 rounded-lg text-xl">
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const MainContent = ({ handleFeedback, handleVerbalParticipation, handleStudentLike }) => {
    const penalty = (studentName) => modifyTalent(studentName, -1, 'penalty');

    return (
      <div className="w-full max-w-4xl p-6 bg-slate-800 text-white rounded-xl shadow-lg box-shadow-custom">
        {isAdmin ? (
          <>
            <h1 className="text-5xl font-bold text-center mb-4"><span className="text-green-500">''Ahn''</span>stoppable Learning</h1>
            <CreatePollForm onCreatePoll={handleCreatePoll} onDeactivatePoll={handleDeactivatePoll} activePoll={activePoll} />
            <div className="flex justify-between items-center mb-4">
              <button onClick={()=>setIsAdmin(false)} className="p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-lg">Back to student view</button>
              <button onClick={()=>setIsAdminAnonymousMode(!isAdminAnonymousMode)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg">{isAdminAnonymousMode ? "Show Student Names" : "Hide Student Names"}</button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {COURSES.map((course) => (
                <button key={course} onClick={()=>setSelectedCourse(course)}
                  className={`p-3 text-lg font-medium rounded-lg ${selectedCourse===course?'bg-orange-500 text-white':'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>
              ))}
            </div>

            <select value={adminSelectedStudent} onChange={(e)=>setAdminSelectedStudent(e.target.value)}
              className="p-3 mb-6 w-full border bg-slate-700 border-slate-500 rounded-lg text-2xl">
              <option value="">-- View All Daily Logs --</option>
              {COURSE_STUDENTS[selectedCourse].map((name,i)=><option key={i} value={name}>{name}</option>)}
            </select>

            {adminSelectedStudent ? (
              <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
                <h3 className="text-3xl font-semibold">All Logs for {isAdminAnonymousMode ? "Anonymous" : getFirstName(adminSelectedStudent)}</h3>
                <div className="flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg">
                  <img src="/talent-coin.png" alt="Talent coin" className="w-8 h-8 mr-2" />
                  <p className="font-bold text-2xl">Total Talents: {talentsLog.find(t => t.id === adminSelectedStudent)?.totalTalents || 0}</p>
                </div>
                <ul>{adminStudentLog.map((log)=>(
                  <li key={log.id} className="p-2 border-b border-slate-700 text-xl">
                    <div className="flex justify-between items-start">
                      <span className="flex-1 mr-2"><span className="font-bold">{log.date}</span> [{log.type}]: {log.text}</span>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {log.adminLiked ? <span className="text-green-500 font-bold text-lg">✓ Liked</span> : <button onClick={()=>handleAdminLike(log.id, log.name)} className="text-3xl">👍</button>}
                        <button onClick={()=>penalty(log.name)} className="px-3 py-1 bg-red-600 text-white text-md font-bold rounded hover:bg-red-700">-1</button>
                      </div>
                    </div>
                    {log.reply && <div className="mt-2 p-2 bg-green-900 rounded-lg text-lg"><span className="font-bold">✓ You Replied</span></div>}
                    <div className="mt-2 flex items-center space-x-2">
                      <ReplyForm log={log} onReply={handleReply} />
                    </div>
                  </li>
                ))}</ul>
              </div>
            ) : (
              <>
                <div className="flex justify-center items-center space-x-2 mb-6">
                  <label className="text-2xl text-gray-300">View Logs for Date:</label>
                  <input type="date" value={adminSelectedDate} onChange={(e)=>setAdminSelectedDate(e.target.value)}
                    className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-2xl"/>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-left p-4 border border-slate-600 rounded-xl">
                    <h3 className="text-3xl font-semibold mb-2">Daily Requirement Progress</h3>
                    <ul className="space-y-1 text-lg h-40 overflow-y-auto">
                      {Object.entries(adminDailyProgress).map(([name,progress])=>{
                        const qcMet = progress.question_comment>=2; const rMet = progress.reasoning>=2;
                        return (
                          <li key={name} className="flex justify-between items-center pr-2">
                            <span>{isAdminAnonymousMode ? "Anonymous" : getFirstName(name)}:</span>
                            <span>
                              <span className={qcMet?'text-green-400':'text-red-400'}>{qcMet?'✅':'❌'} {progress.question_comment}/2</span> /
                              <span className={rMet?'text-green-400':'text-red-400'}>{rMet?'✅':'❌'} {progress.reasoning}/2</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="text-left p-4 border border-slate-600 rounded-xl">
                    <h3 className="text-3xl font-semibold">🚦 Daily Understanding Check</h3>
                    <ul className="h-40 overflow-y-auto text-lg">
                      {feedbackLog.map((log)=>(
                        <li key={log.id} className="p-2 border-b border-slate-700">
                          ({safeTime(log.timestamp)}) {isAdminAnonymousMode ? "Anonymous" : getFirstName(log.name)}: {log.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col space-y-6 mt-6">
                  <div className="text-left p-4 border border-slate-600 rounded-xl">
                    <h3 className="text-3xl font-semibold">❓ Questions & Comments</h3>
                    <PostList
                      posts={qcPostsAdmin}
                      type="admin"
                      onAdminLike={handleAdminLike}
                      onPenalty={penalty}
                      onReply={handleReply}
                      toggleReplies={toggleReplies}
                      showReplies={showReplies}
                      replies={replies}
                      listRef={adminListRefQC}
                      anonymizeName={isAdminAnonymousMode}
                      getFirstName={getFirstName}
                    />
                  </div>

                  <div className="text-left p-4 border border-slate-600 rounded-xl">
                    <h3 className="text-3xl font-semibold">🤔 Reasoning Posts</h3>
                    <PostList
                      posts={reasoningPostsAdmin}
                      type="admin"
                      onAdminLike={handleAdminLike}
                      onPenalty={penalty}
                      onReply={handleReply}
                      toggleReplies={toggleReplies}
                      showReplies={showReplies}
                      replies={replies}
                      listRef={adminListRefReason}
                      anonymizeName={isAdminAnonymousMode}
                      getFirstName={getFirstName}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
              <h3 className="text-3xl font-semibold text-gray-100 mb-4">🏆 {selectedCourse} Talent Leaderboard</h3>
              <TalentGraph talentsData={talentsLog} type="admin" selectedCourse={selectedCourse} getFirstName={getFirstName}/>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-5xl font-bold text-center mb-1"><span className="text-green-500">''Ahn''</span>stoppable Learning:<br /><span className="text-orange-500 text-3xl">Freely Ask, Freely Learn</span></h1>
            {activePoll && <PollComponent poll={activePoll} onVote={handlePollVote} userVote={userPollVote} />}

            <div className="flex flex-wrap justify-center gap-2 my-6">
              {COURSES.map(course=>(
                <button key={course} onClick={()=>{ setSelectedCourse(course); handleNameChange(''); }}
                  className={`p-3 text-lg font-medium rounded-lg ${selectedCourse===course?'bg-orange-500 text-white':'bg-slate-600 text-white hover:bg-slate-700'}`}>{course}</button>
              ))}
            </div>

            <select value={nameInput} onChange={(e)=>handleNameChange(e.target.value)} disabled={isAuthenticated}
              className="p-3 mb-2 w-full border bg-slate-700 border-slate-500 rounded-lg text-2xl disabled:opacity-50">
              <option value="">Select your name...</option>
              {COURSE_STUDENTS[selectedCourse].map((name,i)=><option key={i} value={name}>{name}</option>)}
            </select>

            {isNameEntered && !isAuthenticated && (
              <PinAuth nameInput={nameInput} isPinRegistered={isPinRegistered} onLogin={handlePinLogin} onRegister={handlePinRegister} getFirstName={getFirstName}/>
            )}

            {isAuthenticated && (
              <div className="mt-4 animate-fade-in">
                <div className="text-left p-4 border border-slate-600 rounded-xl mb-6">
                  <h3 className="text-2xl font-bold text-yellow-400">Daily Mission & Bonus:</h3>
                  <ul className="list-disc list-inside text-xl mt-2">
                    <li>Question/Comment (x2): <span className="font-semibold">1 Talent each</span></li>
                    <li>Reasoning (x2): <span className="font-semibold">1 Talent each</span></li>
                    <li>Reply to a Peer's Post: <span className="font-semibold">+1 Talent</span></li>
                    <li>Spoke in class (Max 2): <span className="font-semibold">+1 Talent</span></li>
                    <li><span className="font-semibold text-yellow-400">Bonus:</span> Like from Prof. Ahn on original post: <span className="font-semibold">+1 Talent</span></li>
                  </ul>
                </div>

                <div className="flex justify-center items-center space-x-2 my-4">
                  <label className="text-2xl text-gray-300">View Logs for Date:</label>
                  <input type="date" value={studentSelectedDate} onChange={(e)=>setStudentSelectedDate(e.target.value)}
                    className="p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-2xl"/>
                </div>

                <div className="p-4 border border-slate-600 rounded-xl mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-3xl font-medium text-center text-gray-200">Understanding Check</p>
                    <div className="flex justify-center space-x-4 mt-2">
                      <button onClick={() => handleFeedback('Not Understood 🙁')} className={`p-4 w-20 h-20 rounded-full bg-red-500 flex justify-center items-center text-4xl ${clickedButton === 'Not Understood 🙁' ? 'ring-4 ring-orange-500' : ''}`}>🙁</button>
                      <button onClick={() => handleFeedback('Confused 🤔')} className={`p-4 w-20 h-20 rounded-full bg-yellow-400 flex justify-center items-center text-4xl ${clickedButton === 'Confused 🤔' ? 'ring-4 ring-orange-500' : ''}`}>🤔</button>
                      <button onClick={() => handleFeedback('Got It! ✅')} className={`p-4 w-20 h-20 rounded-full bg-green-500 flex justify-center items-center text-4xl ${clickedButton === 'Got It! ✅' ? 'ring-4 ring-orange-500' : ''}`}>✅</button>
                    </div>
                  </div>
                  <div>
                    <p className="text-3xl font-medium text-center text-gray-200">Verbal Participation</p>
                    <div className="flex justify-center mt-2">
                      <button onClick={handleVerbalParticipation} disabled={verbalParticipationCount >= 2} className="p-4 w-44 h-20 rounded-lg bg-sky-500 flex justify-center items-center text-4xl disabled:opacity-50">✋</button>
                    </div>
                  </div>
                </div>

                <div className={`p-4 border border-slate-600 rounded-xl mb-6 ${!isReadyToParticipate ? 'opacity-50 pointer-events-none' : ''}`}>
                  <ContentForm formKey={`${selectedCourse}:${nameInput}:${studentSelectedDate}`} type="question_comment" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} placeholder="Post 2 Questions/Comments..." />
                  <div className="my-4 border-t border-slate-700" />
                  <ContentForm formKey={`${selectedCourse}:${nameInput}:${studentSelectedDate}`} type="reasoning" onAddContent={handleAddContent} isEnabled={isReadyToParticipate} placeholder="Post 2 Reasoning posts..." />
                </div>

                <div className="text-center p-3 bg-slate-700 text-white rounded-lg mb-4">
                  <p className="font-bold text-2xl">Daily Requirement: 4 Talents (2 Q/C + 2 Reasoning)</p>
                  <p className="text-xl">Today's Progress:
                    <span className={`mx-1 ${dailyProgress.question_comment >= 2 ? 'text-green-400' : 'text-red-400'}`}>[{dailyProgress.question_comment}/2 Q/C]</span>
                    <span className={`mx-1 ${dailyProgress.reasoning >= 2 ? 'text-green-400' : 'text-red-400'}`}>[{dailyProgress.reasoning}/2 Reasoning]</span>
                  </p>
                </div>

                <div className="text-center p-3 bg-yellow-400 text-black rounded-lg my-4">
                  <img src="/talent-coin.png" alt="Talent coin" className="w-8 h-8 mr-2 inline-block align-middle" />
                  <span className="font-bold text-2xl align-middle">My Total Talents: {myTotalTalents}</span>
                </div>

                <div className="text-left p-4 border border-slate-600 rounded-xl mt-2">
                  <h3 className="text-3xl font-semibold text-gray-100 mb-2">My Talent History</h3>
                  <ul className="text-lg space-y-1">
                    {talentTransactions.map((log,i)=>(
                      <li key={i} className={`p-1 flex justify-between items-center ${log.points>0?'text-green-400':'text-red-400'}`}>
                        <span><span className="font-bold">{log.points>0?`+${log.points}`:log.points}</span>: {log.type}</span>
                        <span className="text-base text-gray-500">({safeDate(log.timestamp)})</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {studentSelectedDate && (
                  <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
                    <h3 className="text-3xl font-semibold">Logs for {studentSelectedDate}</h3>
                    <div className="flex flex-col space-y-6 mt-6">
                      <div className="text-left">
                        <h4 className="font-semibold mt-4 text-2xl text-gray-300">❓ Questions & Comments</h4>
                        <ul ref={studentListRefQC} className="h-[600px] overflow-y-auto text-lg">
                          {studentQcPosts.map((log) => (
                            <li key={log.id} className="p-2 border-b border-slate-700">
                              <div>
                                {log.name === nameInput && log.adminLiked && <span className="mr-2 text-yellow-400 font-bold">👍 by Prof. Ahn (+1 Bonus)</span>}
                                [{log.type}]: {log.text}
                              </div>
                              {log.name === nameInput && log.reply && (
                                <div className="mt-2 p-2 bg-slate-600 rounded-lg text-lg text-gray-200 flex justify-between items-center">
                                  <span><b>Prof. Ahn's Reply:</b> {log.reply}</span>
                                  <button onClick={() => !log.studentLiked && handleStudentLike(log.id)} disabled={log.studentLiked} className="ml-2 text-3xl disabled:opacity-50">{log.studentLiked ? '👍 Liked' : '👍'}</button>
                                </div>
                              )}
                              <button onClick={() => toggleReplies(log.id)} className="text-lg text-blue-400 mt-1">{showReplies[log.id] ? 'Hide Replies' : 'Show Replies'}</button>
                              {showReplies[log.id] && (
                                <div className="mt-2 pl-4 border-l-2 border-slate-500">
                                  <StudentReplyForm postId={log.id} onAddReply={handleAddReply} />
                                  <ul className="text-lg mt-2">{replies[log.id]?.map(reply => <li key={reply.id} className="pt-1 flex justify-between items-center"><span>Anonymous: {reply.text}</span></li>)}</ul>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-left">
                        <h4 className="font-semibold mt-4 text-2xl text-gray-300">🤔 Reasoning Posts</h4>
                        <ul ref={studentListRefReason} className="h-[600px] overflow-y-auto text-lg">
                          {studentReasoningPosts.map((log) => (
                            <li key={log.id} className="p-2 border-b border-slate-700">
                              <div>
                                {log.name === nameInput && log.adminLiked && <span className="mr-2 text-yellow-400 font-bold">👍 by Prof. Ahn (+1 Bonus)</span>}
                                [{log.type}]: {log.text}
                              </div>
                              {log.name === nameInput && log.reply && (
                                <div className="mt-2 p-2 bg-slate-600 rounded-lg text-lg text-gray-200 flex justify-between items-center">
                                  <span><b>Prof. Ahn's Reply:</b> {log.reply}</span>
                                  <button onClick={() => !log.studentLiked && handleStudentLike(log.id)} disabled={log.studentLiked} className="ml-2 text-3xl disabled:opacity-50">{log.studentLiked ? '👍 Liked' : '👍'}</button>
                                </div>
                              )}
                              <button onClick={() => toggleReplies(log.id)} className="text-lg text-blue-400 mt-1">{showReplies[log.id] ? 'Hide Replies' : 'Show Replies'}</button>
                              {showReplies[log.id] && (
                                <div className="mt-2 pl-4 border-l-2 border-slate-500">
                                  <StudentReplyForm postId={log.id} onAddReply={handleAddReply} />
                                  <ul className="text-lg mt-2">{replies[log.id]?.map(reply => <li key={reply.id} className="pt-1 flex justify-between items-center"><span>Anonymous: {reply.text}</span></li>)}</ul>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
                  <h3 className="text-3xl font-semibold text-gray-100 mb-4">Class Score Range</h3>
                  <TalentGraph talentsData={talentsLog} type="student" selectedCourse={selectedCourse} getFirstName={getFirstName}/>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col items-center mt-8 p-4 border-t border-slate-600">
          <p className="text-xl font-medium text-gray-200 mb-2">Admin Login</p>
          <AdminLoginForm onAdminLogin={handleAdminLogin} />
        </div>
      </div>
    );
  };

  const PhotoGallery = ({ handleFeedback, handleVerbalParticipation, handleStudentLike }) => (
    <>
      <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap">
        {[...Array(7)].map((_,i)=><img key={i} src={`/photo${i+1}.jpg`} alt={`Gallery ${i+1}`} className="h-24 sm:h-32 w-auto rounded-lg shadow-lg" />)}
      </div>
      <div className="flex justify-center items-center flex-grow my-4">
        <MainContent
          handleFeedback={handleFeedback}
          handleVerbalParticipation={handleVerbalParticipation}
          handleStudentLike={handleStudentLike}
        />
      </div>
      <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap">
        {[...Array(7)].map((_,i)=><img key={i} src={`/photo${i+8}.jpg`} alt={`Gallery ${i+8}`} className="h-24 sm:h-32 w-auto rounded-lg shadow-lg" />)}
      </div>
    </>
  );

  /* ===== Handlers BEFORE PhotoGallery usage ===== */
  const handleFeedback = useCallback(async (status) => {
    if (!db || !nameInput.trim()) return;
    setClickedButton(status);
    setTimeout(() => setClickedButton(null), 1500);
    try {
      await addDoc(collection(db, `/artifacts/${resolvedAppId}/public/data/feedback`), {
        appId: resolvedAppId,
        name: nameInput,
        status,
        course: selectedCourse,
        date: new Date().toISOString().slice(0, 10),
        createdAtClient: Date.now(),
        timestamp: serverTimestamp(),
      });
      showMessage("Feedback submitted!");
    } catch (e) {
      console.error(e);
    }
  }, [db, nameInput, selectedCourse, resolvedAppId, showMessage]);

  const handleVerbalParticipation = useCallback(() => {
    if (!db || !nameInput) return;
    setVerbalParticipationCount((prev) => prev + 1);
    modifyTalent(nameInput, 1, 'verbal_participation');
  }, [db, nameInput, modifyTalent]);

  const handleStudentLike = useCallback(async (logId) => {
    if (!db) return;
    const questionDocRef = doc(db, `/artifacts/${resolvedAppId}/public/data/questions`, logId);
    try {
      await updateDoc(questionDocRef, { studentLiked: true });
    } catch (e) {
      console.error("Error (student like):", e);
    }
  }, [db, resolvedAppId]);

  return (
    <div className="min-h-screen w-full bg-custom-beige-bg flex flex-col justify-between p-2 sm:p-4">
      <PhotoGallery
        handleFeedback={handleFeedback}
        handleVerbalParticipation={handleVerbalParticipation}
        handleStudentLike={handleStudentLike}
      />
      {showMessageBox && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white p-6 rounded-xl text-center z-50 text-2xl">
          {message}
        </div>
      )}
    </div>
  );
};

export default App;
