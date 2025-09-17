/* global __app_id */
import React, { useState, useEffect, useMemo, useCallback } from &#39;react&#39;;
import { initializeApp } from &#39;firebase/app&#39;;
import { getAuth, signInAnonymously } from &#39;firebase/auth&#39;;
import {
getFirestore,
collection,
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
} from &#39;firebase/firestore&#39;;
const COURSES = [&quot;ADV 375-01&quot;, &quot;ADV 375-02&quot;, &quot;ADV 461&quot;];
const COURSE_STUDENTS = {
&quot;ADV 375-01&quot;: [
&quot;Donovan, Robert&quot;, &quot;Ellison, Alexis&quot;, &quot;Futrell, Rylie&quot;, &quot;George, Matthew&quot;,
&quot;Hammer, Olivia&quot;, &quot;Kobayashi, Sena&quot;, &quot;Lee, Byungho&quot;, &quot;Mady, Gabriella&quot;,
&quot;Mawuenyega, Chloe&quot;, &quot;Oved, Liam&quot;, &quot;Sims, Ava&quot;, &quot;Soke, Duru&quot;,
&quot;Walsh, William&quot;, &quot;Warmington, Charles&quot;, &quot;Yu, Wenbo&quot;
],
&quot;ADV 375-02&quot;: [
&quot;Alteio, Katherine&quot;, &quot;Asatryan, Natalie&quot;, &quot;Bondi, Ava&quot;, &quot;Brown, Kylie&quot;,
&quot;Calabrese, Ella&quot;, &quot;Dougherty, Quinn&quot;, &quot;Dutton, Madeline&quot;, &quot;Grabinger, Katharina&quot;,
&quot;Ju, Ashley&quot;, &quot;Lahanas, Dean&quot;, &quot;Lange, Bella-Soleil&quot;, &quot;McQuilling, Louisa&quot;,
&quot;Milliman, Nicole&quot;, &quot;Nizdil, Kennedy&quot;, &quot;Salahieh, Zayd&quot;, &quot;Shannon, Savannah&quot;,
&quot;Tang, Yuhan&quot;, &quot;Walz, Lucy&quot;, &quot;Wang, Michelle&quot;, &quot;Wanke, Karsten&quot;
],
&quot;ADV 461&quot;: [
&quot;Bonk, Maya&quot;, &quot;Burrow, Elizabeth&quot;, &quot;Campos, Victoria&quot;, &quot;Cantada, Cristian&quot;,
&quot;Chong, Timothy&quot;, &quot;Chung, Sooa&quot;, &quot;Cwiertnia, Zachary&quot;, &quot;Fernandez, Francisco&quot;,
&quot;Fok, Alexis&quot;, &quot;Gilbert, Jasmine&quot;, &quot;Hall, Lily&quot;, &quot;Hosea, Nicholas&quot;,
&quot;Jang, Da Eun&quot;, &quot;Kim, Lynn&quot;, &quot;Kim, Noelle&quot;, &quot;Koning, William&quot;,
&quot;Lee, Edmund&quot;, &quot;Lewandowski, Luke&quot;, &quot;Leyson, Noah&quot;, &quot;Lopez, Tatum&quot;,
&quot;Murphy, Alexander&quot;, &quot;Swendsen, Katherine&quot;
],
};
const isWithinClassTime = (courseName) =&gt; {
const now = new Date();
const losAngelesTime = new Date(now.toLocaleString(&quot;en-US&quot;, { timeZone: &quot;America/Los_Angeles&quot; }));

const day = losAngelesTime.getDay(), hour = losAngelesTime.getHours(), minute = losAngelesTime.getMinutes();
const currentTimeInMinutes = hour * 60 + minute;
switch (courseName) {
case &quot;ADV 375-01&quot;:
if (day === 1 || day === 4) {
const startTime = 8 * 60, endTime = 9 * 60 + 50;
return currentTimeInMinutes &gt;= startTime &amp;&amp; currentTimeInMinutes &lt;= endTime;
} return false;
case &quot;ADV 375-02&quot;:
if (day === 1 || day === 4) {
const startTime = 12 * 60, endTime = 13 * 60 + 50;
return currentTimeInMinutes &gt;= startTime &amp;&amp; currentTimeInMinutes &lt;= endTime;
} return false;
case &quot;ADV 461&quot;:
if (day === 3) {
const startTime = 12 * 60, endTime = 15 * 60 + 50;
return currentTimeInMinutes &gt;= startTime &amp;&amp; currentTimeInMinutes &lt;= endTime;
} return false;
default:
return false;
}
};
/** --------------------------
* 스크롤 보존 훅 (리스트 길이 변화 등에서 점프 방지)
* -------------------------- */
function usePreserveScroll(containerRef, deps) {
React.useLayoutEffect(() =&gt; {
const el = containerRef.current;
if (!el) return;
const prevBottomOffset = el.scrollHeight - el.scrollTop;
requestAnimationFrame(() =&gt; {
if (!containerRef.current) return;
containerRef.current.scrollTop = containerRef.current.scrollHeight - prevBottomOffset;
});
// deps: 리스트 길이 등
}, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
/** --------------------------
* 그래프
* -------------------------- */
const TalentGraph = ({ talentsData, type, selectedCourse, getFirstName }) =&gt; {
const displayData = useMemo(() =&gt; {
const courseRoster = COURSE_STUDENTS[selectedCourse] || [];
const talentMap = new Map(talentsData.map(t =&gt; [t.id, t.totalTalents]));
const allStudents = courseRoster.map(name =&gt; ({
id: name,

name: name,
totalTalents: talentMap.get(name) || 0,
}));
const sorted = allStudents.sort((a, b) =&gt; b.totalTalents - a.totalTalents);
if (type === &#39;admin&#39;) { return sorted; }
else if (type === &#39;student&#39; &amp;&amp; sorted.length &gt; 0) {
const highest = sorted[0];
const lowest = sorted[sorted.length - 1];
return highest.id === lowest.id ? [highest] : [highest, lowest];
}
return [];
}, [talentsData, selectedCourse, type]);
if (displayData.length === 0) return &lt;p className=&quot;text-gray-400 text-lg&quot;&gt;No talent data yet.&lt;/p&gt;;
const maxScore = displayData.length &gt; 0 ? displayData[0].totalTalents : 0;
return (
&lt;div className=&quot;space-y-4&quot;&gt;
{displayData.map(talent =&gt; (
&lt;div key={talent.id} className=&quot;w-full&quot;&gt;
&lt;div className=&quot;flex justify-between text-lg text-gray-300 mb-1&quot;&gt;
&lt;span&gt;{type === &#39;admin&#39; ? getFirstName(talent.name) : (talent.id === displayData[0].id ? &#39;Highest Score&#39; :
&#39;Lowest Score&#39;)}&lt;/span&gt;
&lt;span&gt;{talent.totalTalents}&lt;/span&gt;
&lt;/div&gt;
&lt;div className=&quot;w-full bg-slate-600 rounded-full h-5&quot;&gt;
&lt;div
className=&quot;bg-yellow-400 h-5 rounded-full&quot;
style={{ width: maxScore &gt; 0 ? `${(talent.totalTalents / maxScore) * 100}%` : &#39;0%&#39; }}
/&gt;
&lt;/div&gt;
&lt;/div&gt;
))}
&lt;/div&gt;
);
};
/** --------------------------
* 입력 폼 (자동 임시저장 / 복원 / 디바운스)
* -------------------------- */
const ContentForm = React.memo(function ContentForm({
formKey, // `${selectedCourse}:${nameInput}:${studentSelectedDate}`
type,
onAddContent,
isEnabled,
placeholder
}) {
const STORAGE_KEY = `draft:${formKey}:${type}`;

const [text, setText] = useState(() =&gt; localStorage.getItem(STORAGE_KEY) || &quot;&quot;);
const saveRef = React.useRef(null);
const saveDraft = useCallback((value) =&gt; {
clearTimeout(saveRef.current);
saveRef.current = setTimeout(() =&gt; {
try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
}, 300);
}, [STORAGE_KEY]);
const onChange = (e) =&gt; {
const v = e.target.value;
setText(v);
saveDraft(v);
};
useEffect(() =&gt; {
const handler = () =&gt; {
try { localStorage.setItem(STORAGE_KEY, text); } catch { /* ignore */ }
};
window.addEventListener(&quot;beforeunload&quot;, handler);
return () =&gt; window.removeEventListener(&quot;beforeunload&quot;, handler);
}, [STORAGE_KEY, text]);
const handleSubmit = (event) =&gt; {
event.preventDefault();
if (text.trim()) {
onAddContent(text, type);
setText(&#39;&#39;);
try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
};
return (
&lt;form onSubmit={handleSubmit} className=&quot;flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2&quot;&gt;
&lt;textarea
value={text}
onChange={onChange}
placeholder={placeholder}
disabled={!isEnabled}
className=&quot;flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-2xl resize-none h-28&quot;
/&gt;
&lt;button
type=&quot;submit&quot;
disabled={!isEnabled || !text.trim()}
className=&quot;p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 self-end
sm:self-center text-xl&quot;
&gt;

Add
&lt;/button&gt;
&lt;/form&gt;
);
});
const AdminLoginForm = ({ onAdminLogin }) =&gt; {
const [password, setPassword] = useState(&#39;&#39;);
const handleLogin = () =&gt; { onAdminLogin(password); };
return (
&lt;div className=&quot;flex space-x-2&quot;&gt;
&lt;input
type=&quot;password&quot;
value={password}
onChange={(e) =&gt; setPassword(e.target.value)}
placeholder=&quot;Password&quot;
className=&quot;p-2 border bg-slate-700 border-slate-500 rounded-lg text-lg&quot;
/&gt;
&lt;button onClick={handleLogin} className=&quot;p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-
lg&quot;&gt;Login&lt;/button&gt;
&lt;/div&gt;
);
};
const PinAuth = React.memo(({ nameInput, isPinRegistered, onLogin, onRegister, getFirstName }) =&gt; {
const [pinInput, setPinInput] = useState(&#39;&#39;);
const [pinConfirmationInput, setPinConfirmationInput] = useState(&#39;&#39;);
const handleLoginClick = () =&gt; { onLogin(pinInput); setPinInput(&#39;&#39;); };
const handleRegisterClick = () =&gt; { onRegister(pinInput, pinConfirmationInput); setPinInput(&#39;&#39;);
setPinConfirmationInput(&#39;&#39;); };
if (!nameInput) return null;
return isPinRegistered ? (
&lt;div className=&quot;my-4 p-4 bg-slate-700 rounded-lg animate-fade-in&quot;&gt;
&lt;p className=&quot;text-center text-white mb-2 font-semibold text-2xl&quot;&gt;Enter your 4-digit PIN,
{getFirstName(nameInput)}.&lt;/p&gt;
&lt;div className=&quot;flex space-x-2&quot;&gt;
&lt;input
type=&quot;password&quot;
inputMode=&quot;numeric&quot;
maxLength=&quot;4&quot;
value={pinInput}
onChange={(e) =&gt; setPinInput(e.target.value)}
className=&quot;flex-1 p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center&quot;
/&gt;
&lt;button onClick={handleLoginClick} className=&quot;p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg
font-bold text-xl&quot;&gt;Login&lt;/button&gt;
&lt;/div&gt;
&lt;/div&gt;

) : (
&lt;div className=&quot;my-4 p-4 bg-slate-700 rounded-lg animate-fade-in&quot;&gt;
&lt;p className=&quot;text-center text-white mb-2 font-semibold text-2xl&quot;&gt;
First time? Create your 4-digit PIN.&lt;br /&gt;
&lt;span className=&quot;text-lg font-normal&quot;&gt;(Use the last 4 digits of your Student ID)&lt;/span&gt;
&lt;/p&gt;
&lt;div className=&quot;space-y-2&quot;&gt;
&lt;input
type=&quot;password&quot;
inputMode=&quot;numeric&quot;
maxLength=&quot;4&quot;
value={pinInput}
onChange={(e) =&gt; setPinInput(e.target.value)}
placeholder=&quot;Create 4-digit PIN&quot;
className=&quot;w-full p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center&quot;
/&gt;
&lt;input
type=&quot;password&quot;
inputMode=&quot;numeric&quot;
maxLength=&quot;4&quot;
value={pinConfirmationInput}
onChange={(e) =&gt; setPinConfirmationInput(e.target.value)}
placeholder=&quot;Confirm PIN&quot;
className=&quot;w-full p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center&quot;
/&gt;
&lt;button onClick={handleRegisterClick} className=&quot;w-full p-3 bg-orange-500 hover:bg-orange-600 text-white
rounded-lg font-bold text-xl&quot;&gt;Register &amp; Start&lt;/button&gt;
&lt;/div&gt;
&lt;/div&gt;
);
});
/** --------------------------
* 메인 App
* -------------------------- */
const App = () =&gt; {
const appId = typeof __app_id !== &#39;undefined&#39; ? __app_id : &#39;default-app-id&#39;;
const [db, setDb] = useState(null);
const [nameInput, setNameInput] = useState(&#39;&#39;);
const [selectedCourse, setSelectedCourse] = useState(COURSES[0]);
const [isAdmin, setIsAdmin] = useState(false);
const ADMIN_PASSWORD = &#39;0811&#39;;
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [isPinRegistered, setIsPinRegistered] = useState(false);
const [message, setMessage] = useState(&#39;&#39;);
const [showMessageBox, setShowMessageBox] = useState(false);
const [isClassActive, setIsClassActive] = useState(false);
const [talentsLog, setTalentsLog] = useState([]);

const [studentSelectedDate, setStudentSelectedDate] = useState(() =&gt; new Date().toISOString().slice(0, 10));
const [dailyProgress, setDailyProgress] = useState({ question_comment: 0, reasoning: 0 });
const [myTotalTalents, setMyTotalTalents] = useState(0);
const [talentTransactions, setTalentTransactions] = useState([]);
const [studentFeedbackLog, setStudentFeedbackLog] = useState([]);
const [clickedButton, setClickedButton] = useState(null);
const [adminSelectedDate, setAdminSelectedDate] = useState(() =&gt; new Date().toISOString().slice(0, 10));
const [adminSelectedStudent, setAdminSelectedStudent] = useState(&#39;&#39;);
const [adminStudentLog, setAdminStudentLog] = useState([]);
const [questionsLog, setQuestionsLog] = useState([]);
const [feedbackLog, setFeedbackLog] = useState([]);
const [allPostsLog, setAllPostsLog] = useState([]);
const [activePoll, setActivePoll] = useState(null);
const [userPollVote, setUserPollVote] = useState(null);
const [replies, setReplies] = useState({});
const [showReplies, setShowReplies] = useState({});
const [isAdminAnonymousMode, setIsAdminAnonymousMode] = useState(false);
const [verbalParticipationCount, setVerbalParticipationCount] = useState(0);
// 관리자 ReplyForm 드래프트 (리렌더·재정렬에도 유지)
const [replyDraft, setReplyDraft] = useState({}); // { [postId]: &quot;text&quot; }
// replies 구독 해제용
const replyUnsubs = React.useRef({}); // { [postId]: Unsubscribe[] }
const showMessage = useCallback((msg) =&gt; {
setMessage(msg);
setShowMessageBox(true);
setTimeout(() =&gt; {
setShowMessageBox(false);
setMessage(&#39;&#39;);
}, 3000);
}, []);
const getFirstName = useCallback((fullName) =&gt; {
if (!fullName) return &#39;&#39;;
const parts = fullName.split(&#39;, &#39;);
return parts.length &gt; 1 ? parts[1] : parts[0];
}, []);
useEffect(() =&gt; {
const firebaseConfig = {
apiKey: &quot;AIzaSyCgl2EZSBv5eerKjcFsCGojT68ZwnfGL-U&quot;,
authDomain: &quot;ahnstoppable-learning.firebaseapp.com&quot;,
projectId: &quot;ahnstoppable-learning&quot;
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

setDb(getFirestore(app));
signInAnonymously(auth).catch(console.error);
}, []);
useEffect(() =&gt; {
if (!db || !nameInput) { setIsPinRegistered(false); return; }
const checkPin = async () =&gt; {
const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput);
const docSnap = await getDoc(pinDocRef);
setIsPinRegistered(docSnap.exists());
};
checkPin();
}, [db, nameInput, appId]);
const handleNameChange = (newName) =&gt; {
setNameInput(newName);
setIsAuthenticated(false);
};
const handlePinLogin = useCallback(async (pin) =&gt; {
if (!db || !nameInput) return showMessage(&quot;Please select your name first.&quot;);
const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput);
try {
const docSnap = await getDoc(pinDocRef);
if (docSnap.exists() &amp;&amp; docSnap.data().pin === pin) {
setIsAuthenticated(true);
showMessage(`Welcome, ${getFirstName(nameInput)}!`);
} else {
showMessage(&quot;Incorrect PIN.&quot;);
}
} catch (e) {
showMessage(&quot;Login error.&quot;);
}
}, [db, nameInput, appId, getFirstName, showMessage]);
const handlePinRegister = useCallback(async (pin, confirmation) =&gt; {
if (!db || !nameInput) return showMessage(&quot;Please select your name first.&quot;);
if (pin.length !== 4) return showMessage(&quot;PIN must be 4 digits.&quot;);
if (pin !== confirmation) return showMessage(&quot;PINs do not match.&quot;);
const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput);
try {
await setDoc(pinDocRef, { pin });
setIsAuthenticated(true);
showMessage(`PIN registered! Welcome, ${getFirstName(nameInput)}!`);
} catch (e) {
showMessage(&quot;Error registering PIN.&quot;);
}
}, [db, nameInput, appId, getFirstName, showMessage]);

useEffect(() =&gt; {
const checkTime = () =&gt; setIsClassActive(isWithinClassTime(selectedCourse));
checkTime();
const interval = setInterval(checkTime, 30000);
return () =&gt; clearInterval(interval);
}, [selectedCourse]);
useEffect(() =&gt; {
if (!db) return;
const talentsQuery = query(
collection(db, `/artifacts/${appId}/public/data/talents`),
where(&quot;course&quot;, &quot;==&quot;, selectedCourse)
);
const unsub = onSnapshot(talentsQuery, (snap) =&gt;
setTalentsLog(snap.docs.map(d =&gt; ({ id: d.id, ...d.data() })))
);
return () =&gt; unsub();
}, [db, selectedCourse, appId]);
// 관리자: 당일 로그 실시간 (증분 머지 + 정렬 유지)
useEffect(() =&gt; {
if (!db || !isAdmin) return;
setQuestionsLog([]);
const questionsQuery = query(
collection(db, `/artifacts/${appId}/public/data/questions`),
where(&quot;course&quot;, &quot;==&quot;, selectedCourse),
where(&quot;date&quot;, &quot;==&quot;, adminSelectedDate),
orderBy(&quot;timestamp&quot;, &quot;desc&quot;)
);
const unsubQ = onSnapshot(questionsQuery, (snapshot) =&gt; {
setQuestionsLog(prevLogs =&gt; {
const map = new Map(prevLogs.map(l =&gt; [l.id, l]));
snapshot.docChanges().forEach(change =&gt; {
const data = { id: change.doc.id, ...change.doc.data() };
if (change.type === &quot;removed&quot;) map.delete(data.id);
else map.set(data.id, data);
});
return Array.from(map.values())
.sort((a, b) =&gt; (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
});
});
const fbQuery = query(
collection(db, `/artifacts/${appId}/public/data/feedback`),
where(&quot;course&quot;, &quot;==&quot;, selectedCourse),
where(&quot;date&quot;, &quot;==&quot;, adminSelectedDate),
orderBy(&quot;timestamp&quot;, &quot;desc&quot;)

);
const unsubF = onSnapshot(fbQuery, (snap) =&gt;
setFeedbackLog(snap.docs.map(d =&gt; ({ id: d.id, ...d.data() })))
);
return () =&gt; { unsubQ(); unsubF(); };
}, [db, selectedCourse, adminSelectedDate, appId, isAdmin]);
// 관리자: 특정 학생 전체 로그
useEffect(() =&gt; {
if (!db || !isAdmin || !adminSelectedStudent) { setAdminStudentLog([]); return; }
const logQuery = query(
collection(db, `/artifacts/${appId}/public/data/questions`),
where(&quot;course&quot;, &quot;==&quot;, selectedCourse),
where(&quot;name&quot;, &quot;==&quot;, adminSelectedStudent),
orderBy(&quot;timestamp&quot;, &quot;desc&quot;)
);
const unsub = onSnapshot(logQuery, (snap) =&gt;
setAdminStudentLog(snap.docs.map(d =&gt; ({ id: d.id, ...d.data() })))
);
return () =&gt; unsub();
}, [db, selectedCourse, adminSelectedStudent, appId, isAdmin]);
// 학생 뷰: 내 재화/진행/피드백/전체 게시물 (전체 게시물은 증분 머지로 변경)
useEffect(() =&gt; {
if (!db || isAdmin || !nameInput || !isAuthenticated) {
setAllPostsLog([]); setMyTotalTalents(0); setTalentTransactions([]);
setDailyProgress({ question_comment: 0, reasoning: 0 }); setStudentFeedbackLog([]);
return;
}
const transactionsQuery = query(
collection(db, `/artifacts/${appId}/public/data/talentTransactions`),
where(&quot;name&quot;, &quot;==&quot;, nameInput),
orderBy(&quot;timestamp&quot;, &quot;desc&quot;)
);
const unsubT = onSnapshot(transactionsQuery, (snap) =&gt; {
const today = new Date().toISOString().slice(0, 10);
const todaysTransactions = snap.docs.map(d =&gt; d.data())
.filter(t =&gt; t.timestamp?.toDate().toISOString().slice(0, 10) === today);
setTalentTransactions(todaysTransactions);
setVerbalParticipationCount(todaysTransactions.filter(t =&gt; t.type === &#39;verbal_participation&#39;).length);
});
const talentDocRef = doc(db, `/artifacts/${appId}/public/data/talents`, nameInput);
const unsubM = onSnapshot(talentDocRef, (d) =&gt; setMyTotalTalents(d.exists() ? d.data().totalTalents : 0));
const allPostsQuery = query(
collection(db, `/artifacts/${appId}/public/data/questions`),

where(&quot;course&quot;, &quot;==&quot;, selectedCourse),
where(&quot;date&quot;, &quot;==&quot;, studentSelectedDate),
orderBy(&quot;timestamp&quot;, &quot;desc&quot;)
);
const unsubAll = onSnapshot(allPostsQuery, (snapshot) =&gt; {
setAllPostsLog(prev =&gt; {
const map = new Map(prev.map(p =&gt; [p.id, p]));
snapshot.docChanges().forEach(ch =&gt; {
const data = { id: ch.doc.id, ...ch.doc.data() };
if (ch.type === &quot;removed&quot;) map.delete(data.id);
else map.set(data.id, data);
});
const posts = Array.from(map.values())
.sort((a, b) =&gt; (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
const myPosts = posts.filter(p =&gt; p.name === nameInput);
setDailyProgress({
question_comment: myPosts.filter(a =&gt; a.type === &#39;question_comment&#39;).length,
reasoning: myPosts.filter(a =&gt; a.type === &#39;reasoning&#39;).length
});
return posts;
});
});
const fbQuery = query(
collection(db, `/artifacts/${appId}/public/data/feedback`),
where(&quot;course&quot;, &quot;==&quot;, selectedCourse),
where(&quot;name&quot;, &quot;==&quot;, nameInput),
where(&quot;date&quot;, &quot;==&quot;, studentSelectedDate),
orderBy(&quot;timestamp&quot;, &quot;desc&quot;)
);
const unsubF = onSnapshot(fbQuery, (snap) =&gt; setStudentFeedbackLog(snap.docs.map(d =&gt; d.data())));
return () =&gt; { unsubM(); unsubT(); unsubF(); unsubAll(); };
}, [db, selectedCourse, nameInput, studentSelectedDate, appId, isAdmin, isAuthenticated]);
// Poll
useEffect(() =&gt; {
if (!db || !isAuthenticated) { setActivePoll(null); return; }
const pollQuery = query(
collection(db, `/artifacts/${appId}/public/data/polls`),
where(&quot;course&quot;, &quot;==&quot;, selectedCourse),
where(&quot;isActive&quot;, &quot;==&quot;, true)
);
const unsubscribe = onSnapshot(pollQuery, (snapshot) =&gt; {
if (!snapshot.empty) {
const pollData = snapshot.docs[0].data();
const pollId = snapshot.docs[0].id;
setActivePoll({ id: pollId, ...pollData });

if (pollData.responses &amp;&amp; pollData.responses[nameInput] !== undefined) {
setUserPollVote(pollData.responses[nameInput]);
} else {
setUserPollVote(null);
}
} else {
setActivePoll(null);
}
});
return () =&gt; unsubscribe();
}, [db, selectedCourse, isAuthenticated, nameInput, appId]);
// talents 조작
const modifyTalent = useCallback(async (studentName, amount, type) =&gt; {
if (!db) return;
const talentDocRef = doc(db, `/artifacts/${appId}/public/data/talents`, studentName);
const transactionColRef = collection(db, `/artifacts/${appId}/public/data/talentTransactions`);
try {
const docSnap = await getDoc(talentDocRef);
let currentTalents = docSnap.exists() ? docSnap.data().totalTalents || 0 : 0;
const newTotal = currentTalents + amount;
if (newTotal &lt; 0) { showMessage(&quot;Talent cannot go below 0.&quot;); return; }
if (docSnap.exists()) {
await updateDoc(talentDocRef, { totalTalents: newTotal });
} else {
await setDoc(talentDocRef, { name: studentName, course: selectedCourse, totalTalents: newTotal });
}
if (type !== &#39;automatic&#39;) showMessage(`${getFirstName(studentName)} received ${amount &gt; 0 ? `+${amount}` :
amount} Talent!`);
await addDoc(transactionColRef, { name: studentName, points: amount, type: type, timestamp:
serverTimestamp() });
} catch (e) {
console.error(&quot;Error modifying talent: &quot;, e);
}
}, [db, appId, selectedCourse, getFirstName, showMessage]);
const handleAddContent = useCallback(async (text, type) =&gt; {
if (!db || !nameInput.trim() || !text.trim()) return;
const today = new Date().toISOString().slice(0, 10);
try {
await addDoc(collection(db, `/artifacts/${appId}/public/data/questions`), {
name: nameInput, text, type, course: selectedCourse, date: today,
timestamp: serverTimestamp(), studentLiked: false, adminLiked: false
});
showMessage(&quot;Submission complete! ✅&quot;);
await modifyTalent(nameInput, 1, &#39;automatic&#39;);
} catch (e) {
showMessage(&quot;Submission failed. ❌&quot;);

}
}, [db, nameInput, selectedCourse, appId, modifyTalent, showMessage]);
const handleFeedback = useCallback(async (status) =&gt; {
if (!db || !nameInput.trim()) return showMessage(&quot;Please select your name first.&quot;);
setClickedButton(status);
setTimeout(() =&gt; setClickedButton(null), 1500);
try {
await addDoc(collection(db, `/artifacts/${appId}/public/data/feedback`), {
name: nameInput, status, course: selectedCourse,
date: new Date().toISOString().slice(0, 10), timestamp: serverTimestamp()
});
showMessage(&quot;Feedback submitted!&quot;);
} catch (e) {
showMessage(&quot;Failed to submit feedback.&quot;);
}
}, [db, nameInput, selectedCourse, appId, showMessage]);
const handleAdminLogin = (password) =&gt; {
if (password === ADMIN_PASSWORD) {
setIsAdmin(true);
showMessage(&quot;Admin Login successful! ��&quot;);
} else {
showMessage(&quot;Incorrect password. ��&quot;);
}
};
const handleReply = useCallback(async (logId, replyText) =&gt; {
if (!db) return;
const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId);
try {
await updateDoc(questionDocRef, { reply: replyText });
showMessage(&quot;Reply sent!&quot;);
} catch (e) {
showMessage(&quot;Failed to send reply.&quot;);
console.error(e);
}
}, [db, appId, showMessage]);
const handleStudentLike = useCallback(async (logId) =&gt; {
if (!db) return;
const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId);
try {
await updateDoc(questionDocRef, { studentLiked: true });
} catch (e) {
console.error(&quot;Error (student like):&quot;, e);
}
}, [db, appId]);

const handleAdminLike = useCallback(async (logId, authorFullName) =&gt; {
if (!db) return;
const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId);
try {
const docSnap = await getDoc(questionDocRef);
if (docSnap.exists() &amp;&amp; !docSnap.data().adminLiked) {
await updateDoc(questionDocRef, { adminLiked: true });
await modifyTalent(authorFullName, 1, &#39;post_bonus&#39;);
}
} catch (e) {
console.error(&quot;Error (admin like):&quot;, e);
}
}, [db, appId, modifyTalent]);
const handleCreatePoll = useCallback(async (question, options) =&gt; {
if (!db || !isAdmin) return;
try {
await addDoc(collection(db, `/artifacts/${appId}/public/data/polls`), {
question, options, course: selectedCourse, isActive: true, responses: {}, timestamp: serverTimestamp()
});
showMessage(&quot;Poll published successfully!&quot;);
} catch (error) {
showMessage(&quot;Error publishing poll.&quot;);
console.error(&quot;Error creating poll: &quot;, error);
}
}, [db, isAdmin, selectedCourse, appId, showMessage]);
const handlePollVote = useCallback(async (pollId, optionIndex) =&gt; {
if (!db || !nameInput) return;
const pollDocRef = doc(db, `/artifacts/${appId}/public/data/polls`, pollId);
try {
await updateDoc(pollDocRef, { [`responses.${nameInput}`]: optionIndex });
} catch (error) {
console.error(&quot;Error voting on poll: &quot;, error);
}
}, [db, nameInput, appId]);
const handleDeactivatePoll = useCallback(async (pollId) =&gt; {
if (!db || !isAdmin) return;
const pollDocRef = doc(db, `/artifacts/${appId}/public/data/polls`, pollId);
try {
await updateDoc(pollDocRef, { isActive: false });
showMessage(&quot;Poll closed.&quot;);
} catch (error) {
showMessage(&quot;Error closing poll.&quot;);
console.error(&quot;Error deactivating poll: &quot;, error);
}

}, [db, isAdmin, appId, showMessage]);
const handleAddReply = useCallback(async (postId, replyText) =&gt; {
if (!db || !nameInput) return;
const repliesColRef = collection(db, `/artifacts/${appId}/public/data/questions/${postId}/replies`);
try {
await addDoc(repliesColRef, {
text: replyText, author: getFirstName(nameInput), authorFullName: nameInput,
adminLiked: false, timestamp: serverTimestamp()
});
await modifyTalent(nameInput, 1, &#39;peer_reply&#39;);
} catch (error) {
console.error(&quot;Error adding reply: &quot;, error);
}
}, [db, nameInput, getFirstName, appId, modifyTalent]);
// replies 토글 + 구독 관리 (unsubscribe 철저)
const toggleReplies = useCallback((postId) =&gt; {
setShowReplies(prev =&gt; {
const next = !prev[postId];
// 끄는 경우: 모두 해제
if (!next) {
replyUnsubs.current[postId]?.forEach(unsub =&gt; unsub &amp;&amp; unsub());
delete replyUnsubs.current[postId];
return { ...prev, [postId]: next };
}
// 켜는 경우: 기존 해제 후 새로 구독
replyUnsubs.current[postId]?.forEach(unsub =&gt; unsub &amp;&amp; unsub());
replyUnsubs.current[postId] = [];
const repliesQuery = query(
collection(db, `/artifacts/${appId}/public/data/questions/${postId}/replies`),
orderBy(&quot;timestamp&quot;, &quot;asc&quot;)
);
const unsub = onSnapshot(repliesQuery, (snapshot) =&gt; {
const fetchedReplies = snapshot.docs.map(d =&gt; ({ id: d.id, ...d.data() }));
setReplies(prevR =&gt; ({ ...prevR, [postId]: fetchedReplies }));
});
replyUnsubs.current[postId].push(unsub);
return { ...prev, [postId]: next };
});
}, [db, appId]);
// 언마운트시 전체 구독 해제
useEffect(() =&gt; {

return () =&gt; {
Object.values(replyUnsubs.current).forEach(arr =&gt; arr.forEach(u =&gt; u &amp;&amp; u()));
replyUnsubs.current = {};
};
}, []);
const handleVerbalParticipation = useCallback(() =&gt; {
if (!db || !nameInput) return;
modifyTalent(nameInput, 1, &#39;verbal_participation&#39;);
}, [db, nameInput, modifyTalent]);
const isNameEntered = nameInput.trim().length &gt; 0;
const isReadyToParticipate = isAuthenticated &amp;&amp; isClassActive;
// 관리자 일일 진행표
const adminDailyProgress = useMemo(() =&gt; {
const roster = COURSE_STUDENTS[selectedCourse] || [];
const initialProgress = roster.reduce((acc, studentName) =&gt; {
acc[studentName] = { question_comment: 0, reasoning: 0 };
return acc;
}, {});
questionsLog.forEach(log =&gt; {
if (initialProgress[log.name]) {
if (log.type === &#39;question_comment&#39;) initialProgress[log.name].question_comment++;
if (log.type === &#39;reasoning&#39;) initialProgress[log.name].reasoning++;
}
});
return initialProgress;
}, [questionsLog, selectedCourse]);
// 관리자 리스트 분리
const [reasoningPosts, qcPosts] = useMemo(() =&gt; {
const reasoning = questionsLog.filter(p =&gt; p.type === &#39;reasoning&#39;);
const qc = questionsLog.filter(p =&gt; p.type === &#39;question_comment&#39;);
return [reasoning, qc];
}, [questionsLog]);
// 학생 내 리스트 분리
const [studentReasoningPosts, studentQcPosts] = useMemo(() =&gt; {
const reasoning = allPostsLog.filter(p =&gt; p.type === &#39;reasoning&#39;);
const qc = allPostsLog.filter(p =&gt; p.type === &#39;question_comment&#39;);
return [reasoning, qc];
}, [allPostsLog]);
// 관리자/학생 리스트 스크롤 보존용 ref
const adminListRefQC = React.useRef(null);
const adminListRefReason = React.useRef(null);
const studentListRefQC = React.useRef(null);

const studentListRefReason = React.useRef(null);
usePreserveScroll(adminListRefQC, [qcPosts.length]);
usePreserveScroll(adminListRefReason, [reasoningPosts.length]);
usePreserveScroll(studentListRefQC, [studentQcPosts.length]);
usePreserveScroll(studentListRefReason, [studentReasoningPosts.length]);
// ReplyForm (드래프트를 상위에서 유지)
const ReplyForm = ({ log, onReply }) =&gt; {
const val = replyDraft[log.id] ?? (log.reply || &quot;&quot;);
const setVal = (v) =&gt; setReplyDraft((s) =&gt; ({ ...s, [log.id]: v }));
return (
&lt;div className=&quot;mt-2 flex items-center space-x-2&quot;&gt;
&lt;input
type=&quot;text&quot;
value={val}
onChange={(e) =&gt; setVal(e.target.value)}
placeholder=&quot;Write a reply...&quot;
className=&quot;flex-1 p-2 border bg-slate-600 border-slate-500 rounded-lg text-lg&quot;
/&gt;
&lt;button onClick={() =&gt; onReply(log.id, val)} className=&quot;p-2 bg-blue-500 hover:bg-blue-600 text-white text-lg
rounded-lg&quot;&gt;Send&lt;/button&gt;
&lt;button
onClick={() =&gt; { setVal(&quot;Addressed in class&quot;); onReply(log.id, &quot;Addressed in class&quot;); }}
className=&quot;p-2 bg-gray-500 hover:bg-gray-600 text-white text-lg rounded-lg whitespace-nowrap&quot;
&gt;
Addressed
&lt;/button&gt;
&lt;/div&gt;
);
};
const StudentReplyForm = ({ postId, onAddReply }) =&gt; {
const [replyText, setReplyText] = useState(&#39;&#39;);
const handleSend = () =&gt; {
onAddReply(postId, replyText);
setReplyText(&#39;&#39;);
};
return (
&lt;div className=&quot;mt-2 flex items-center space-x-2&quot;&gt;
&lt;input
type=&quot;text&quot;
value={replyText}
onChange={(e) =&gt; setReplyText(e.target.value)}
placeholder=&quot;Write an anonymous reply...&quot;
className=&quot;flex-1 p-2 border bg-slate-600 border-slate-500 rounded-lg text-lg&quot;
/&gt;

&lt;button onClick={handleSend} className=&quot;p-2 bg-blue-500 hover:bg-blue-600 text-white text-lg rounded-
lg&quot;&gt;Reply&lt;/button&gt;
&lt;/div&gt;
);
};
const MainContent = () =&gt; (
&lt;div className=&quot;w-full max-w-4xl p-6 bg-slate-800 text-white rounded-xl shadow-lg box-shadow-custom&quot;&gt;
{isAdmin ? (
&lt;&gt;
&lt;h1 className=&quot;text-5xl font-bold text-center mb-4&quot;&gt;&lt;span className=&quot;text-green-
500&quot;&gt;&#39;&#39;Ahn&#39;&#39;&lt;/span&gt;stoppable Learning&lt;/h1&gt;
&lt;CreatePollForm onCreatePoll={handleCreatePoll} onDeactivatePoll={handleDeactivatePoll}
activePoll={activePoll} /&gt;
&lt;div className=&quot;flex justify-between items-center mb-4&quot;&gt;
&lt;button onClick={() =&gt; setIsAdmin(false)} className=&quot;p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-
700 text-lg&quot;&gt;Back to student view&lt;/button&gt;
&lt;button onClick={() =&gt; setIsAdminAnonymousMode(!isAdminAnonymousMode)} className=&quot;p-2 bg-blue-
600 text-white rounded-lg hover:bg-blue-700 text-lg&quot;&gt;
{isAdminAnonymousMode ? &quot;Show Student Names&quot; : &quot;Hide Student Names&quot;}
&lt;/button&gt;
&lt;/div&gt;
&lt;div className=&quot;flex flex-wrap justify-center gap-2 mb-6&quot;&gt;
{COURSES.map((course) =&gt; (
&lt;button
key={course}
onClick={() =&gt; setSelectedCourse(course)}
className={`p-3 text-lg font-medium rounded-lg ${selectedCourse === course ? &#39;bg-orange-500 text-
white&#39; : &#39;bg-slate-600 text-white hover:bg-slate-700&#39;}`}
&gt;
{course}
&lt;/button&gt;
))}
&lt;/div&gt;
&lt;select
value={adminSelectedStudent}
onChange={(e) =&gt; setAdminSelectedStudent(e.target.value)}
className=&quot;p-3 mb-6 w-full border bg-slate-700 border-slate-500 rounded-lg text-2xl&quot;
&gt;
&lt;option value=&quot;&quot;&gt;-- View All Daily Logs --&lt;/option&gt;
{COURSE_STUDENTS[selectedCourse].map((name, i) =&gt; &lt;option key={i} value={name}&gt;{name}&lt;/option&gt;)}
&lt;/select&gt;
{adminSelectedStudent ? (
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl mt-6&quot;&gt;

&lt;h3 className=&quot;text-3xl font-semibold&quot;&gt;All Logs for {isAdminAnonymousMode ? &quot;Anonymous&quot; :
getFirstName(adminSelectedStudent)}&lt;/h3&gt;
&lt;div className=&quot;flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg&quot;&gt;
&lt;img src=&quot;/talent-coin.png&quot; alt=&quot;Talent coin&quot; className=&quot;w-8 h-8 mr-2&quot; /&gt;
&lt;p className=&quot;font-bold text-2xl&quot;&gt;Total Talents: {talentsLog.find(t =&gt; t.id ===
adminSelectedStudent)?.totalTalents || 0}&lt;/p&gt;
&lt;/div&gt;
&lt;ul&gt;
{adminStudentLog.map((log) =&gt; (
&lt;li key={log.id} className=&quot;p-2 border-b border-slate-700 text-xl&quot;&gt;
&lt;div className=&quot;flex justify-between items-start&quot;&gt;
&lt;span className=&quot;flex-1 mr-2&quot;&gt;&lt;span className=&quot;font-bold&quot;&gt;{log.date}&lt;/span&gt; [{log.type}]:
{log.text}&lt;/span&gt;
&lt;div className=&quot;flex items-center space-x-2 flex-shrink-0&quot;&gt;
{log.adminLiked ? (
&lt;span className=&quot;text-green-500 font-bold text-lg&quot;&gt;✓ Liked&lt;/span&gt;
) : (
&lt;button onClick={() =&gt; handleAdminLike(log.id, log.name)} className=&quot;text-3xl&quot;&gt;��&lt;/button&gt;
)}
&lt;button
onClick={() =&gt; modifyTalent(log.name, -1, &#39;penalty&#39;)}
className=&quot;px-3 py-1 bg-red-600 text-white text-md font-bold rounded hover:bg-red-700&quot;
&gt;-1&lt;/button&gt;
&lt;/div&gt;
&lt;/div&gt;
{log.reply &amp;&amp; &lt;div className=&quot;mt-2 p-2 bg-green-900 rounded-lg text-lg&quot;&gt;&lt;span className=&quot;font-
bold&quot;&gt;✓ You Replied&lt;/span&gt;&lt;/div&gt;}
&lt;ReplyForm log={log} onReply={handleReply} /&gt;
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
) : (
&lt;&gt;
&lt;div className=&quot;flex justify-center items-center space-x-2 mb-6&quot;&gt;
&lt;label className=&quot;text-2xl text-gray-300&quot;&gt;View Logs for Date:&lt;/label&gt;
&lt;input
type=&quot;date&quot;
value={adminSelectedDate}
onChange={(e) =&gt; setAdminSelectedDate(e.target.value)}
className=&quot;p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-2xl&quot;
/&gt;
&lt;/div&gt;
&lt;div className=&quot;grid grid-cols-1 md:grid-cols-2 gap-6&quot;&gt;
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold mb-2&quot;&gt;Daily Requirement Progress&lt;/h3&gt;
&lt;ul className=&quot;space-y-1 text-lg h-40 overflow-y-auto&quot;&gt;

{Object.entries(adminDailyProgress).map(([name, progress]) =&gt; {
const qcMet = progress.question_comment &gt;= 2;
const rMet = progress.reasoning &gt;= 2;
return (
&lt;li key={name} className=&quot;flex justify-between items-center pr-2&quot;&gt;
&lt;span&gt;{isAdminAnonymousMode ? &quot;Anonymous&quot; : getFirstName(name)}:&lt;/span&gt;
&lt;span&gt;
&lt;span className={qcMet ? &#39;text-green-400&#39; : &#39;text-red-400&#39;}&gt;{qcMet ? &#39;✅&#39; : &#39;❌&#39;}
{progress.question_comment}/2&lt;/span&gt;
{&quot; / &quot;}
&lt;span className={rMet ? &#39;text-green-400&#39; : &#39;text-red-400&#39;}&gt;{rMet ? &#39;✅&#39; : &#39;❌&#39;}
{progress.reasoning}/2&lt;/span&gt;
&lt;/span&gt;
&lt;/li&gt;
);
})}
&lt;/ul&gt;
&lt;/div&gt;
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold&quot;&gt;�� Daily Understanding Check&lt;/h3&gt;
&lt;ul className=&quot;h-40 overflow-y-auto text-lg&quot;&gt;
{feedbackLog.map((log) =&gt; (
&lt;li key={log.id} className=&quot;p-2 border-b border-slate-700&quot;&gt;
({log.timestamp?.toDate().toLocaleTimeString()}) {isAdminAnonymousMode ? &quot;Anonymous&quot; :
getFirstName(log.name)}: {log.status}
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
&lt;/div&gt;
&lt;div className=&quot;flex flex-col space-y-6 mt-6&quot;&gt;
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold&quot;&gt;❓ Questions &amp; Comments&lt;/h3&gt;
&lt;ul ref={adminListRefQC} className=&quot;h-[600px] overflow-y-auto text-xl mt-2&quot;&gt;
{qcPosts.map((log) =&gt; (
&lt;li key={log.id} className=&quot;p-2 border-b border-slate-700&quot;&gt;
&lt;div className=&quot;flex justify-between items-start&quot;&gt;
&lt;span className=&quot;flex-1 mr-2&quot;&gt;{isAdminAnonymousMode ? &quot;Anonymous&quot; :
getFirstName(log.name)} [{log.type}]: {log.text}&lt;/span&gt;
&lt;div className=&quot;flex items-center space-x-2 flex-shrink-0&quot;&gt;
{log.adminLiked ? (
&lt;span className=&quot;text-green-500 font-bold text-lg&quot;&gt;✓ Liked&lt;/span&gt;
) : (
&lt;button onClick={() =&gt; handleAdminLike(log.id, log.name)} className=&quot;text-3xl&quot;&gt;��&lt;/button&gt;
)}
&lt;button

onClick={() =&gt; modifyTalent(log.name, -1, &#39;penalty&#39;)}
className=&quot;px-3 py-1 bg-red-600 text-white text-md font-bold rounded hover:bg-red-700&quot;
&gt;-1&lt;/button&gt;
&lt;/div&gt;
&lt;/div&gt;
{log.reply &amp;&amp; &lt;div className=&quot;mt-2 p-2 bg-green-900 rounded-lg text-lg&quot;&gt;&lt;span className=&quot;font-
bold&quot;&gt;✓ You Replied&lt;/span&gt;&lt;/div&gt;}
&lt;ReplyForm log={log} onReply={handleReply} /&gt;
&lt;button onClick={() =&gt; toggleReplies(log.id)} className=&quot;text-lg text-blue-400 mt-1&quot;&gt;
{showReplies[log.id] ? &#39;Hide Replies&#39; : &#39;Show Replies&#39;}
&lt;/button&gt;
{showReplies[log.id] &amp;&amp; (
&lt;div className=&quot;mt-2 pl-4 border-l-2 border-slate-500&quot;&gt;
&lt;ul className=&quot;text-lg mt-2&quot;&gt;
{replies[log.id]?.map(reply =&gt; (
&lt;li key={reply.id} className=&quot;pt-1 flex justify-between items-center&quot;&gt;
&lt;span&gt;{isAdminAnonymousMode ? &quot;Anonymous&quot; : reply.author}: {reply.text}&lt;/span&gt;
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
)}
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold&quot;&gt;�� Reasoning Posts&lt;/h3&gt;
&lt;ul ref={adminListRefReason} className=&quot;h-[600px] overflow-y-auto text-xl mt-2&quot;&gt;
{reasoningPosts.map((log) =&gt; (
&lt;li key={log.id} className=&quot;p-2 border-b border-slate-700&quot;&gt;
&lt;div className=&quot;flex justify-between items-start&quot;&gt;
&lt;span className=&quot;flex-1 mr-2&quot;&gt;{isAdminAnonymousMode ? &quot;Anonymous&quot; :
getFirstName(log.name)} [{log.type}]: {log.text}&lt;/span&gt;
&lt;div className=&quot;flex items-center space-x-2 flex-shrink-0&quot;&gt;
{log.adminLiked ? (
&lt;span className=&quot;text-green-500 font-bold text-lg&quot;&gt;✓ Liked&lt;/span&gt;
) : (
&lt;button onClick={() =&gt; handleAdminLike(log.id, log.name)} className=&quot;text-3xl&quot;&gt;��&lt;/button&gt;
)}
&lt;button
onClick={() =&gt; modifyTalent(log.name, -1, &#39;penalty&#39;)}
className=&quot;px-3 py-1 bg-red-600 text-white text-md font-bold rounded hover:bg-red-700&quot;
&gt;-1&lt;/button&gt;
&lt;/div&gt;
&lt;/div&gt;

{log.reply &amp;&amp; &lt;div className=&quot;mt-2 p-2 bg-green-900 rounded-lg text-lg&quot;&gt;&lt;span className=&quot;font-
bold&quot;&gt;✓ You Replied&lt;/span&gt;&lt;/div&gt;}
&lt;ReplyForm log={log} onReply={handleReply} /&gt;
&lt;button onClick={() =&gt; toggleReplies(log.id)} className=&quot;text-lg text-blue-400 mt-1&quot;&gt;
{showReplies[log.id] ? &#39;Hide Replies&#39; : &#39;Show Replies&#39;}
&lt;/button&gt;
{showReplies[log.id] &amp;&amp; (
&lt;div className=&quot;mt-2 pl-4 border-l-2 border-slate-500&quot;&gt;
&lt;ul className=&quot;text-lg mt-2&quot;&gt;
{replies[log.id]?.map(reply =&gt; (
&lt;li key={reply.id} className=&quot;pt-1 flex justify-between items-center&quot;&gt;
&lt;span&gt;{isAdminAnonymousMode ? &quot;Anonymous&quot; : reply.author}: {reply.text}&lt;/span&gt;
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
)}
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
&lt;/div&gt;
&lt;/&gt;
)}
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl mt-6&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold text-gray-100 mb-4&quot;&gt;�� {selectedCourse} Talent Leaderboard&lt;/h3&gt;
&lt;TalentGraph talentsData={talentsLog} type=&quot;admin&quot; selectedCourse={selectedCourse}
getFirstName={getFirstName} /&gt;
&lt;/div&gt;
&lt;/&gt;
) : (
&lt;&gt;
&lt;h1 className=&quot;text-5xl font-bold text-center mb-1&quot;&gt;
&lt;span className=&quot;text-green-500&quot;&gt;&#39;&#39;Ahn&#39;&#39;&lt;/span&gt;stoppable Learning:&lt;br /&gt;
&lt;span className=&quot;text-orange-500 text-3xl&quot;&gt;Freely Ask, Freely Learn&lt;/span&gt;
&lt;/h1&gt;
{activePoll &amp;&amp; &lt;PollComponent poll={activePoll} onVote={handlePollVote} userVote={userPollVote}
nameInput={nameInput} /&gt;}
&lt;div className=&quot;flex flex-wrap justify-center gap-2 my-6&quot;&gt;
{COURSES.map((course) =&gt; (
&lt;button
key={course}
onClick={() =&gt; { setSelectedCourse(course); handleNameChange(&#39;&#39;); }}
className={`p-3 text-lg font-medium rounded-lg ${selectedCourse === course ? &#39;bg-orange-500 text-
white&#39; : &#39;bg-slate-600 text-white hover:bg-slate-700&#39;}`}

&gt;
{course}
&lt;/button&gt;
))}
&lt;/div&gt;
&lt;select
value={nameInput}
onChange={(e) =&gt; handleNameChange(e.target.value)}
disabled={isAuthenticated}
className=&quot;p-3 mb-2 w-full border bg-slate-700 border-slate-500 rounded-lg text-2xl disabled:opacity-50&quot;
&gt;
&lt;option value=&quot;&quot;&gt;Select your name...&lt;/option&gt;
{COURSE_STUDENTS[selectedCourse].map((name, i) =&gt; &lt;option key={i} value={name}&gt;{name}&lt;/option&gt;)}
&lt;/select&gt;
{isNameEntered &amp;&amp; !isAuthenticated &amp;&amp; (
&lt;PinAuth
nameInput={nameInput}
isPinRegistered={isPinRegistered}
onLogin={handlePinLogin}
onRegister={handlePinRegister}
getFirstName={getFirstName}
/&gt;
)}
{isAuthenticated &amp;&amp; (
&lt;div className=&quot;mt-4 animate-fade-in&quot;&gt;
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl mb-6&quot;&gt;
&lt;h3 className=&quot;text-2xl font-bold text-yellow-400&quot;&gt;Daily Mission &amp; Bonus:&lt;/h3&gt;
&lt;ul className=&quot;list-disc list-inside text-xl mt-2&quot;&gt;
&lt;li&gt;Question/Comment (x2): &lt;span className=&quot;font-semibold&quot;&gt;1 Talent each&lt;/span&gt;&lt;/li&gt;
&lt;li&gt;Reasoning (x2): &lt;span className=&quot;font-semibold&quot;&gt;1 Talent each&lt;/span&gt;&lt;/li&gt;
&lt;li&gt;Reply to a Peer&#39;s Post: &lt;span className=&quot;font-semibold&quot;&gt;+1 Talent&lt;/span&gt;&lt;/li&gt;
&lt;li&gt;Spoke in class (Max 2): &lt;span className=&quot;font-semibold&quot;&gt;+1 Talent&lt;/span&gt;&lt;/li&gt;
&lt;li&gt;&lt;span className=&quot;font-semibold text-yellow-400&quot;&gt;Bonus:&lt;/span&gt; Get a &#39;Like&#39; from Prof. Ahn on your
original post: &lt;span className=&quot;font-semibold&quot;&gt;+1 Talent&lt;/span&gt;&lt;/li&gt;
&lt;/ul&gt;
&lt;/div&gt;
&lt;div className=&quot;flex justify-center items-center space-x-2 my-4&quot;&gt;
&lt;label className=&quot;text-2xl text-gray-300&quot;&gt;View Logs for Date:&lt;/label&gt;
&lt;input
type=&quot;date&quot;
value={studentSelectedDate}
onChange={(e) =&gt; setStudentSelectedDate(e.target.value)}
className=&quot;p-3 border bg-slate-700 border-slate-500 rounded-lg text-white text-2xl&quot;
/&gt;

&lt;/div&gt;
{!isClassActive &amp;&amp; (
&lt;div className=&quot;text-center p-3 bg-red-800 text-white rounded-lg mb-4 text-xl&quot;&gt;
&lt;p&gt;You can only submit new responses during class time.&lt;/p&gt;
&lt;/div&gt;
)}
&lt;div className=&quot;p-4 border border-slate-600 rounded-xl mb-6 grid grid-cols-2 gap-4&quot;&gt;
&lt;div&gt;
&lt;p className=&quot;text-3xl font-medium text-center text-gray-200&quot;&gt;Understanding Check&lt;/p&gt;
&lt;div className=&quot;flex justify-center space-x-4 mt-2&quot;&gt;
&lt;button
onClick={() =&gt; handleFeedback(&#39;Not Understood ��&#39;)}
className={`p-4 w-20 h-20 rounded-full bg-red-500 flex justify-center items-center text-4xl
${clickedButton === &#39;Not Understood ��&#39; ? &#39;ring-4 ring-orange-500&#39; : &#39;&#39;}`}
&gt;��&lt;/button&gt;
&lt;button
onClick={() =&gt; handleFeedback(&#39;Confused ��&#39;)}
className={`p-4 w-20 h-20 rounded-full bg-yellow-400 flex justify-center items-center text-4xl
${clickedButton === &#39;Confused ��&#39; ? &#39;ring-4 ring-orange-500&#39; : &#39;&#39;}`}
&gt;��&lt;/button&gt;
&lt;button
onClick={() =&gt; handleFeedback(&#39;Got It! ✅&#39;)}
className={`p-4 w-20 h-20 rounded-full bg-green-500 flex justify-center items-center text-4xl
${clickedButton === &#39;Got It! ✅&#39; ? &#39;ring-4 ring-orange-500&#39; : &#39;&#39;}`}
&gt;✅&lt;/button&gt;
&lt;/div&gt;
&lt;/div&gt;
&lt;div&gt;
&lt;p className=&quot;text-3xl font-medium text-center text-gray-200&quot;&gt;Verbal Participation&lt;/p&gt;
&lt;div className=&quot;flex justify-center mt-2&quot;&gt;
&lt;button
onClick={handleVerbalParticipation}
disabled={verbalParticipationCount &gt;= 2}
className=&quot;p-4 w-44 h-20 rounded-lg bg-sky-500 flex justify-center items-center text-4xl
disabled:opacity-50&quot;
&gt;✋&lt;/button&gt;
&lt;/div&gt;
&lt;/div&gt;
&lt;/div&gt;
&lt;div className=&quot;text-center p-3 bg-slate-700 text-white rounded-lg mb-4&quot;&gt;
&lt;p className=&quot;font-bold text-2xl&quot;&gt;Daily Requirement: 4 Talents (2 Q/C + 2 Reasoning)&lt;/p&gt;
&lt;p className=&quot;text-xl&quot;&gt;
Today&#39;s Progress:

&lt;span className={`mx-1 ${dailyProgress.question_comment &gt;= 2 ? &#39;text-green-400&#39; : &#39;text-red-
400&#39;}`}&gt;[{dailyProgress.question_comment}/2 Q/C]&lt;/span&gt;
&lt;span className={`mx-1 ${dailyProgress.reasoning &gt;= 2 ? &#39;text-green-400&#39; : &#39;text-red-
400&#39;}`}&gt;[{dailyProgress.reasoning}/2 Reasoning]&lt;/span&gt;
&lt;/p&gt;
&lt;/div&gt;
&lt;div className={`p-4 border border-slate-600 rounded-xl mb-6 ${!isReadyToParticipate ? &#39;opacity-50
pointer-events-none&#39; : &#39;&#39;}`}&gt;
&lt;ContentForm
formKey={`${selectedCourse}:${nameInput}:${studentSelectedDate}`}
type=&quot;question_comment&quot;
onAddContent={handleAddContent}
isEnabled={isReadyToParticipate}
placeholder=&quot;Post 2 Questions/Comments...&quot;
/&gt;
&lt;div className=&quot;my-4 border-t border-slate-700&quot;&gt;&lt;/div&gt;
&lt;ContentForm
formKey={`${selectedCourse}:${nameInput}:${studentSelectedDate}`}
type=&quot;reasoning&quot;
onAddContent={handleAddContent}
isEnabled={isReadyToParticipate}
placeholder=&quot;Post 2 Reasoning posts...&quot;
/&gt;
&lt;/div&gt;
&lt;div className=&quot;flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg&quot;&gt;
&lt;img src=&quot;/talent-coin.png&quot; alt=&quot;Talent coin&quot; className=&quot;w-8 h-8 mr-2&quot; /&gt;
&lt;p className=&quot;font-bold text-2xl&quot;&gt;My Total Talents: {myTotalTalents}&lt;/p&gt;
&lt;/div&gt;
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl mt-2&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold text-gray-100 mb-2&quot;&gt;My Talent History&lt;/h3&gt;
&lt;ul className=&quot;text-lg space-y-1&quot;&gt;
{talentTransactions.map((log, i) =&gt; (
&lt;li key={i} className={`p-1 flex justify-between items-center ${log.points &gt; 0 ? &#39;text-green-400&#39; : &#39;text-
red-400&#39;}`}&gt;
&lt;span&gt;&lt;span className=&quot;font-bold&quot;&gt;{log.points &gt; 0 ? `+${log.points}` : log.points}&lt;/span&gt;:
{log.type}&lt;/span&gt;
&lt;span className=&quot;text-base text-gray-500&quot;&gt;({log.timestamp?.toDate().toLocaleDateString()})&lt;/span&gt;
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
{studentSelectedDate &amp;&amp; (
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl mt-6&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold&quot;&gt;Logs for {studentSelectedDate}&lt;/h3&gt;

&lt;div className=&quot;flex flex-col space-y-6 mt-6&quot;&gt;
&lt;div className=&quot;text-left&quot;&gt;
&lt;h4 className=&quot;font-semibold mt-4 text-2xl text-gray-300&quot;&gt;❓ Questions &amp; Comments&lt;/h4&gt;
&lt;ul ref={studentListRefQC} className=&quot;h-[600px] overflow-y-auto text-lg&quot;&gt;
{studentQcPosts.map((log) =&gt; (
&lt;li key={log.id} className=&quot;p-2 border-b border-slate-700&quot;&gt;
&lt;div&gt;
{log.name === nameInput &amp;&amp; log.adminLiked &amp;&amp; &lt;span className=&quot;mr-2 text-yellow-400 font-
bold&quot;&gt;�� by Prof. Ahn (+1 Bonus)&lt;/span&gt;}
[{log.type}]: {log.text}
&lt;/div&gt;
{log.name === nameInput &amp;&amp; log.reply &amp;&amp; (
&lt;div className=&quot;mt-2 p-2 bg-slate-600 rounded-lg text-lg text-gray-200 flex justify-between items-
center&quot;&gt;
&lt;span&gt;&lt;b&gt;Prof. Ahn&#39;s Reply:&lt;/b&gt; {log.reply}&lt;/span&gt;
&lt;button
onClick={() =&gt; !log.studentLiked &amp;&amp; handleStudentLike(log.id)}
disabled={log.studentLiked}
className=&quot;ml-2 text-3xl disabled:opacity-50&quot;
&gt;
{log.studentLiked ? &#39;�� Liked&#39; : &#39;��&#39;}
&lt;/button&gt;
&lt;/div&gt;
)}
&lt;button onClick={() =&gt; toggleReplies(log.id)} className=&quot;text-lg text-blue-400 mt-1&quot;&gt;
{showReplies[log.id] ? &#39;Hide Replies&#39; : &#39;Show Replies&#39;}
&lt;/button&gt;
{showReplies[log.id] &amp;&amp; (
&lt;div className=&quot;mt-2 pl-4 border-l-2 border-slate-500&quot;&gt;
&lt;StudentReplyForm postId={log.id} onAddReply={handleAddReply} /&gt;
&lt;ul className=&quot;text-lg mt-2&quot;&gt;
{replies[log.id]?.map(reply =&gt; (
&lt;li key={reply.id} className=&quot;pt-1 flex justify-between items-center&quot;&gt;
&lt;span&gt;Anonymous: {reply.text}&lt;/span&gt;
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
)}
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
&lt;div className=&quot;text-left&quot;&gt;
&lt;h4 className=&quot;font-semibold mt-4 text-2xl text-gray-300&quot;&gt;�� Reasoning Posts&lt;/h4&gt;
&lt;ul ref={studentListRefReason} className=&quot;h-[600px] overflow-y-auto text-lg&quot;&gt;

{studentReasoningPosts.map((log) =&gt; (
&lt;li key={log.id} className=&quot;p-2 border-b border-slate-700&quot;&gt;
&lt;div&gt;
{log.name === nameInput &amp;&amp; log.adminLiked &amp;&amp; &lt;span className=&quot;mr-2 text-yellow-400 font-
bold&quot;&gt;�� by Prof. Ahn (+1 Bonus)&lt;/span&gt;}
[{log.type}]: {log.text}
&lt;/div&gt;
{log.name === nameInput &amp;&amp; log.reply &amp;&amp; (
&lt;div className=&quot;mt-2 p-2 bg-slate-600 rounded-lg text-lg text-gray-200 flex justify-between items-
center&quot;&gt;
&lt;span&gt;&lt;b&gt;Prof. Ahn&#39;s Reply:&lt;/b&gt; {log.reply}&lt;/span&gt;
&lt;button
onClick={() =&gt; !log.studentLiked &amp;&amp; handleStudentLike(log.id)}
disabled={log.studentLiked}
className=&quot;ml-2 text-3xl disabled:opacity-50&quot;
&gt;
{log.studentLiked ? &#39;�� Liked&#39; : &#39;��&#39;}
&lt;/button&gt;
&lt;/div&gt;
)}
&lt;button onClick={() =&gt; toggleReplies(log.id)} className=&quot;text-lg text-blue-400 mt-1&quot;&gt;
{showReplies[log.id] ? &#39;Hide Replies&#39; : &#39;Show Replies&#39;}
&lt;/button&gt;
{showReplies[log.id] &amp;&amp; (
&lt;div className=&quot;mt-2 pl-4 border-l-2 border-slate-500&quot;&gt;
&lt;StudentReplyForm postId={log.id} onAddReply={handleAddReply} /&gt;
&lt;ul className=&quot;text-lg mt-2&quot;&gt;
{replies[log.id]?.map(reply =&gt; (
&lt;li key={reply.id} className=&quot;pt-1 flex justify-between items-center&quot;&gt;
&lt;span&gt;Anonymous: {reply.text}&lt;/span&gt;
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
)}
&lt;/li&gt;
))}
&lt;/ul&gt;
&lt;/div&gt;
&lt;/div&gt;
&lt;h4 className=&quot;font-semibold mt-4 text-2xl text-gray-300&quot;&gt;�� My Understanding Checks&lt;/h4&gt;
&lt;ul className=&quot;text-lg&quot;&gt;
{studentFeedbackLog.map((log, i) =&gt; (
&lt;li key={i} className=&quot;p-2 border-b border-slate-700 text-gray-300&quot;&gt;
({log.timestamp?.toDate().toLocaleTimeString()}): {log.status}
&lt;/li&gt;
))}

&lt;/ul&gt;
&lt;/div&gt;
)}
&lt;div className=&quot;text-left p-4 border border-slate-600 rounded-xl mt-6&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold text-gray-100 mb-4&quot;&gt;Class Score Range&lt;/h3&gt;
&lt;TalentGraph talentsData={talentsLog} type=&quot;student&quot; selectedCourse={selectedCourse}
getFirstName={getFirstName} /&gt;
&lt;/div&gt;
&lt;/div&gt;
)}
&lt;/&gt;
)}
&lt;div className=&quot;flex flex-col items-center mt-8 p-4 border-t border-slate-600&quot;&gt;
&lt;p className=&quot;text-xl font-medium text-gray-200 mb-2&quot;&gt;Admin Login&lt;/p&gt;
&lt;AdminLoginForm onAdminLogin={handleAdminLogin} /&gt;
&lt;/div&gt;
&lt;/div&gt;
);
const CreatePollForm = ({ onCreatePoll, onDeactivatePoll, activePoll }) =&gt; {
const [question, setQuestion] = useState(&#39;&#39;);
const [options, setOptions] = useState([&#39;&#39;, &#39;&#39;, &#39;&#39;]);
const handleOptionChange = (index, value) =&gt; {
const newOptions = [...options];
newOptions[index] = value;
setOptions(newOptions);
};
const addOption = () =&gt; setOptions([...options, &#39;&#39;]);
const handleSubmit = () =&gt; {
const validOptions = options.filter(opt =&gt; opt.trim() !== &#39;&#39;);
if (question.trim() &amp;&amp; validOptions.length &gt; 1) {
onCreatePoll(question, validOptions);
setQuestion(&#39;&#39;);
setOptions([&#39;&#39;, &#39;&#39;, &#39;&#39;]);
} else {
alert(&quot;Please provide a question and at least two options.&quot;);
}
};
if (activePoll) {
return (
&lt;div className=&quot;p-4 border border-slate-600 rounded-xl mb-6&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold&quot;&gt;Active Poll Results&lt;/h3&gt;
&lt;PollComponent poll={activePoll} isAdminView={true} userVote={null} /&gt;
&lt;button onClick={() =&gt; onDeactivatePoll(activePoll.id)} className=&quot;w-full p-2 mt-4 bg-red-600 hover:bg-red-
700 text-white rounded-lg text-xl&quot;&gt;Close Poll&lt;/button&gt;
&lt;/div&gt;

);
}
return (
&lt;div className=&quot;p-4 border border-slate-600 rounded-xl mb-6&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold mb-2&quot;&gt;Create New Poll&lt;/h3&gt;
&lt;input
type=&quot;text&quot;
value={question}
onChange={e =&gt; setQuestion(e.target.value)}
placeholder=&quot;Poll Question&quot;
className=&quot;w-full p-2 mb-2 bg-slate-700 border border-slate-500 rounded-lg text-xl&quot;
/&gt;
{options.map((option, index) =&gt; (
&lt;input
key={index}
type=&quot;text&quot;
value={option}
onChange={e =&gt; handleOptionChange(index, e.target.value)}
placeholder={`Option ${index + 1}`}
className=&quot;w-full p-2 mb-2 bg-slate-700 border border-slate-500 rounded-lg text-xl&quot;
/&gt;
))}
&lt;button onClick={addOption} className=&quot;text-lg text-blue-400 mb-2&quot;&gt;+ Add Option&lt;/button&gt;
&lt;button onClick={handleSubmit} className=&quot;w-full p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg
text-xl&quot;&gt;Publish Poll&lt;/button&gt;
&lt;/div&gt;
);
};
const PollComponent = ({ poll, onVote, userVote, nameInput, isAdminView = false }) =&gt; {
const results = useMemo(() =&gt; {
const responses = poll.responses ? Object.values(poll.responses) : [];
const totalVotes = responses.length;
const votesPerOption = poll.options.map((_, index) =&gt; responses.filter(vote =&gt; vote === index).length);
return {
totalVotes,
percentages: votesPerOption.map(count =&gt; totalVotes &gt; 0 ? (count / totalVotes) * 100 : 0)
};
}, [poll]);
const hasVoted = userVote !== null;
return (
&lt;div className=&quot;p-4 border border-orange-500 rounded-xl my-6 bg-slate-700&quot;&gt;
&lt;h3 className=&quot;text-3xl font-semibold text-orange-400 mb-2&quot;&gt;{poll.question}&lt;/h3&gt;
&lt;div className=&quot;space-y-2&quot;&gt;
{poll.options.map((option, index) =&gt; {
const percentage = results.percentages[index] || 0;
if (hasVoted || isAdminView) {

return (
&lt;div key={index} className=&quot;p-2 bg-slate-600 rounded-lg&quot;&gt;
&lt;div className=&quot;flex justify-between text-white mb-1 text-xl&quot;&gt;
&lt;span&gt;{option}&lt;/span&gt;
&lt;span&gt;{percentage.toFixed(0)}%&lt;/span&gt;
&lt;/div&gt;
&lt;div className=&quot;w-full bg-slate-500 rounded-full h-5&quot;&gt;
&lt;div className=&quot;bg-orange-500 h-5 rounded-full&quot; style={{ width: `${percentage}%` }}&gt;&lt;/div&gt;
&lt;/div&gt;
&lt;/div&gt;
);
}
return (
&lt;button
key={index}
onClick={() =&gt; onVote(poll.id, index)}
className=&quot;w-full text-left p-3 bg-slate-600 hover:bg-slate-500 rounded-lg text-xl&quot;
&gt;
{option}
&lt;/button&gt;
);
})}
&lt;/div&gt;
&lt;/div&gt;
);
};
const PhotoGallery = () =&gt; (
&lt;&gt;
&lt;div className=&quot;flex justify-center items-center gap-2 sm:gap-4 flex-wrap&quot;&gt;
{[...Array(7)].map((_, i) =&gt;
&lt;img key={i} src={`/photo${i + 1}.jpg`} alt={`Gallery ${i + 1}`} className=&quot;h-24 sm:h-32 w-auto rounded-lg
shadow-lg&quot; /&gt;
)}
&lt;/div&gt;
&lt;div className=&quot;flex justify-center items-center flex-grow my-4&quot;&gt;&lt;MainContent /&gt;&lt;/div&gt;
&lt;div className=&quot;flex justify-center items-center gap-2 sm:gap-4 flex-wrap&quot;&gt;
{[...Array(7)].map((_, i) =&gt;
&lt;img key={i} src={`/photo${i + 8}.jpg`} alt={`Gallery ${i + 8}`} className=&quot;h-24 sm:h-32 w-auto rounded-lg
shadow-lg&quot; /&gt;
)}
&lt;/div&gt;
&lt;/&gt;
);
return (
&lt;div className=&quot;min-h-screen w-full bg-custom-beige-bg flex flex-col justify-between p-2 sm:p-4&quot;&gt;
&lt;PhotoGallery /&gt;

{showMessageBox &amp;&amp; (
&lt;div className=&quot;fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white p-6 rounded-xl
text-center z-50 text-2xl&quot;&gt;
{message}
&lt;/div&gt;
)}
&lt;/div&gt;
);
};
export default