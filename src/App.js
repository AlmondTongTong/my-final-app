/* global __app_id */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
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
} from 'firebase/firestore';

const COURSES = ["ADV 375-01", "ADV 375-02", "ADV 461"];
const COURSE_STUDENTS = {
  "ADV 375-01": [
    "Donovan, Robert", "Ellison, Alexis", "Futrell, Rylie", "George, Matthew",
    "Hammer, Olivia", "Kobayashi, Sena", "Lee, Byungho", "Mady, Gabriella",
    "Mawuenyega, Chloe", "Oved, Liam", "Sims, Ava", "Soke, Duru",
    "Walsh, William", "Warmington, Charles", "Yu, Wenbo"
  ],
  "ADV 375-02": [
    "Alteio, Katherine", "Asatryan, Natalie", "Bondi, Ava", "Brown, Kylie",
    "Calabrese, Ella", "Dougherty, Quinn", "Dutton, Madeline", "Grabinger, Katharina",
    "Ju, Ashley", "Lahanas, Dean", "Lange, Bella-Soleil", "McQuilling, Louisa",
    "Milliman, Nicole", "Nizdil, Kennedy", "Salahieh, Zayd", "Shannon, Savannah",
    "Tang, Yuhan", "Walz, Lucy", "Wang, Michelle", "Wanke, Karsten"
  ],
  "ADV 461": [
    "Bonk, Maya", "Burrow, Elizabeth", "Campos, Victoria", "Cantada, Cristian",
    "Chong, Timothy", "Chung, Sooa", "Cwiertnia, Zachary", "Fernandez, Francisco",
    "Fok, Alexis", "Gilbert, Jasmine", "Hall, Lily", "Hosea, Nicholas",
    "Jang, Da Eun", "Kim, Lynn", "Kim, Noelle", "Koning, William",
    "Lee, Edmund", "Lewandowski, Luke", "Leyson, Noah", "Lopez, Tatum",
    "Murphy, Alexander", "Swendsen, Katherine"
  ],
};

const isWithinClassTime = (courseName) => {
  const now = new Date();
  const losAngelesTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = losAngelesTime.getDay(), hour = losAngelesTime.getHours(), minute = losAngelesTime.getMinutes();
  const currentTimeInMinutes = hour * 60 + minute;
  switch (courseName) {
    case "ADV 375-01":
      if (day === 1 || day === 4) {
        const startTime = 8 * 60, endTime = 9 * 60 + 50;
        return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime;
      } return false;
    case "ADV 375-02":
      if (day === 1 || day === 4) {
        const startTime = 12 * 60, endTime = 13 * 60 + 50;
        return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime;
      } return false;
    case "ADV 461":
      if (day === 3) {
        const startTime = 12 * 60, endTime = 15 * 60 + 50;
        return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime;
      } return false;
    default:
      return false;
  }
};

/** --------------------------
* 스크롤   보존   훅  ( 리스트   길이   변화   등에서   점프   방지 )
* -------------------------- */
function usePreserveScroll(containerRef, deps) {
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevBottomOffset = el.scrollHeight - el.scrollTop;
    requestAnimationFrame(() => {
      // FIX: 'container.current' was a typo, corrected to 'containerRef.current'
      if (!containerRef.current) return;
      containerRef.current.scrollTop = containerRef.current.scrollHeight - prevBottomOffset;
    });
  }, deps);
}

/** --------------------------
* 그래프
* -------------------------- */
const TalentGraph = ({ talentsData, type, selectedCourse, getFirstName }) => {
  const displayData = useMemo(() => {
    const courseRoster = COURSE_STUDENTS[selectedCourse] || [];
    const talentMap = new Map(talentsData.map(t => [t.id, t.totalTalents]));
    const allStudents = courseRoster.map(name => ({
      id: name,
      name: name,
      totalTalents: talentMap.get(name) || 0,
    }));
    const sorted = allStudents.sort((a, b) => b.totalTalents - a.totalTalents);
    if (type === 'admin') { return sorted; }
    else if (type === 'student' && sorted.length > 0) {
      const highest = sorted[0];
      const lowest = sorted[sorted.length - 1];
      return highest.id === lowest.id ? [highest] : [highest, lowest];
    }
    return [];
  }, [talentsData, selectedCourse, type, getFirstName]);

  if (displayData.length === 0) return <p className="text-gray-400 text-lg">No talent data yet.</p>;
  const maxScore = displayData.length > 0 ? displayData[0].totalTalents : 0;
  return (
    <div className="space-y-4">
      {displayData.map(talent => (
        <div key={talent.id} className="w-full">
          <div className="flex justify-between text-lg text-gray-300 mb-1">
            <span>{type === 'admin' ? getFirstName(talent.name) : (talent.id === displayData[0].id ? 'Highest Score' : 'Lowest Score')}</span>
            <span>{talent.totalTalents}</span>
          </div>
          <div className="w-full bg-slate-600 rounded-full h-5">
            <div
              className="bg-yellow-400 h-5 rounded-full"
              style={{ width: maxScore > 0 ? `${(talent.totalTalents / maxScore) * 100}%` : '0%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/** --------------------------
* 입력   폼  ( 자동   임시저장  /  복원  /  디바운스 )
* -------------------------- */
const ContentForm = React.memo(function ContentForm({
  formKey,
  type,
  onAddContent,
  isEnabled,
  placeholder
}) {
  const STORAGE_KEY = `draft:${formKey}:${type}`;
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const saveRef = React.useRef(null);

  const saveDraft = useCallback((value) => {
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
    }, 300);
  }, [STORAGE_KEY]);

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    saveDraft(v);
  };

  useEffect(() => {
    const handler = () => {
      try { localStorage.setItem(STORAGE_KEY, text); } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [STORAGE_KEY, text]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (text.trim()) {
      onAddContent(text, type);
      setText('');
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  };
  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
      <textarea
        value={text}
        onChange={onChange}
        placeholder={placeholder}
        disabled={!isEnabled}
        className="flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-2xl resize-none h-28"
      />
      <button
        type="submit"
        disabled={!isEnabled || !text.trim()}
        className="p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 self-end sm:self-center text-xl"
      >
        Add
      </button>
    </form>
  );
});

const AdminLoginForm = ({ onAdminLogin }) => {
  const [password, setPassword] = useState('');
  const handleLogin = () => { onAdminLogin(password); };

  return (
    <div className="flex space-x-2">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="p-2 border bg-slate-700 border-slate-500 rounded-lg text-lg"
      />
      <button onClick={handleLogin} className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-lg">Login</button>
    </div>
  );
};

const PinAuth = React.memo(({ nameInput, isPinRegistered, onLogin, onRegister, getFirstName }) => {
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmationInput, setPinConfirmationInput] = useState('');

  const handleLoginClick = () => { onLogin(pinInput); setPinInput(''); };
  const handleRegisterClick = () => { onRegister(pinInput, pinConfirmationInput); setPinInput(''); setPinConfirmationInput(''); };

  if (!nameInput) return null;

  return isPinRegistered ? (
    <div className="my-4 p-4 bg-slate-700 rounded-lg animate-fade-in">
      <p className="text-center text-white mb-2 font-semibold text-2xl">Enter your 4-digit PIN, {getFirstName(nameInput)}.</p>
      <div className="flex space-x-2">
        <input
          type="password"
          inputMode="numeric"
          maxLength="4"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          className="flex-1 p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center"
        />
        <button onClick={handleLoginClick} className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xl">Login</button>
      </div>
    </div>
  ) : (
    <div className="my-4 p-4 bg-slate-700 rounded-lg animate-fade-in">
      <p className="text-center text-white mb-2 font-semibold text-2xl">
        First time? Create your 4-digit PIN.<br />
        <span className="text-lg font-normal">(Use the last 4 digits of your Student ID)</span>
      </p>
      <div className="space-y-2">
        <input
          type="password"
          inputMode="numeric"
          maxLength="4"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          placeholder="Create 4-digit PIN"
          className="w-full p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength="4"
          value={pinConfirmationInput}
          onChange={(e) => setPinConfirmationInput(e.target.value)}
          placeholder="Confirm PIN"
          className="w-full p-3 border bg-slate-600 border-slate-500 rounded-lg text-2xl text-center"
        />
        <button onClick={handleRegisterClick} className="w-full p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-xl">Register & Start</button>
      </div>
    </div>
  );
});

const StudentPostItem = ({
  post, nameInput, getFirstName, handleStudentLike,
  toggleReplies, showReplies, replies, StudentReplyForm, handleAddReply
}) => (
  <div className={`p-3 rounded-lg ${post.name === nameInput ? 'bg-blue-900' : 'bg-slate-600'}`}>
    <p className="text-xl">
      <span className="font-bold">{post.name === nameInput ? "Me" : getFirstName(post.name)}: </span>{post.text}
    </p>
    {post.reply && <p className="mt-1 p-2 bg-green-900 rounded-lg text-lg">↪ <span className="font-semibold">Ahn</span>: {post.reply}</p>}
    <div className="flex items-center mt-2 space-x-4">
      {post.name !== nameInput && (
        post.studentLiked ? <span className="text-yellow-400 font-bold text-lg">✓ Liked</span> : <button onClick={() => handleStudentLike(post.id)} className="text-2xl">👍</button>
      )}
      <button onClick={() => toggleReplies(post.id)} className="text-lg text-gray-300 hover:underline">
        {showReplies[post.id] ? 'Hide' : 'Show'} Replies ({replies[post.id]?.length || 0})
      </button>
    </div>
    {showReplies[post.id] && (
      <div className="mt-2 pl-4 border-l-2 border-slate-500">
        {replies[post.id]?.map(r => (
          <p key={r.id} className="text-lg mb-1">{r.author}: {r.text}</p>
        ))}
        <StudentReplyForm postId={post.id} onAddReply={handleAddReply} />
      </div>
    )}
  </div>
);

const StudentView = ({
  nameInput, selectedCourse, setSelectedCourse, handleNameChange, isNameEntered,
  isAuthenticated, isPinRegistered, handlePinLogin, handlePinRegister, getFirstName,
  isReadyToParticipate, dailyProgress, myTotalTalents, verbalParticipationCount,
  handleVerbalParticipation, studentFeedbackLog, handleFeedback, clickedButton,
  studentSelectedDate, setStudentSelectedDate, studentReasoningPosts, studentQcPosts,
  studentListRefQC, studentListRefReason, handleStudentLike, toggleReplies,
  showReplies, replies, StudentReplyForm, handleAddReply, activePoll,
  handlePollVote, userPollVote, talentsLog, handleAddContent, onAdminLogin,
  isClassActive
}) => {

  const talentsDataForGraph = useMemo(() =>
    talentsLog.map(t => ({ id: t.id, totalTalents: t.totalTalents, name: t.name })),
    [talentsLog]);

  return (
    <>
      <h1 className="text-5xl font-bold text-center mb-4"><span className="text-green-500">''Ahn''</span>stoppable Learning</h1>
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {COURSES.map((course) => (
          <button
            key={course}
            onClick={() => { setSelectedCourse(course); handleNameChange(''); }}
            className={`p-3 text-lg font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}
          >
            {course}
          </button>
        ))}
        <AdminLoginForm onAdminLogin={onAdminLogin} />
      </div>

      {!isNameEntered && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {COURSE_STUDENTS[selectedCourse].map((name, index) => (
            <button key={index} onClick={() => handleNameChange(name)} className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg">
              {getFirstName(name)}
            </button>
          ))}
        </div>
      )}

      {isNameEntered && !isAuthenticated && (
        <PinAuth
          nameInput={nameInput}
          isPinRegistered={isPinRegistered}
          onLogin={handlePinLogin}
          onRegister={handlePinRegister}
          getFirstName={getFirstName}
        />
      )}

      {isAuthenticated && (
        <div className="animate-fade-in">
          <div className="text-center mb-6">
            <button onClick={() => handleNameChange('')} className="p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-lg">Change Student</button>
          </div>
          {!isClassActive && (
            <div className="text-center p-4 bg-red-800 rounded-lg mb-4">
              <p className="text-2xl font-bold">Class is not in session. Come back later!</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="p-4 bg-slate-700 rounded-xl">
                <h2 className="text-3xl font-semibold mb-3">My Status</h2>
                <div className="flex justify-around items-center text-center p-3 bg-yellow-400 text-black rounded-lg">
                  <img src="/talent-coin.png" alt="Talent coin" className="w-10 h-10" />
                  <p className="font-bold text-3xl">{myTotalTalents}</p>
                </div>
                <div className="mt-3 text-center text-xl">
                  <p>Question/Comment: {dailyProgress.question_comment}</p>
                  <p>Reasoning: {dailyProgress.reasoning}</p>
                  <p>Verbal Participation: {verbalParticipationCount}</p>
                </div>
                {isReadyToParticipate && <button onClick={handleVerbalParticipation} className="w-full mt-3 p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xl">Verbal Participation</button>}
              </div>

              <div className="p-4 bg-slate-700 rounded-xl">
                <h2 className="text-3xl font-semibold mb-3">Today's Feedback</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => handleFeedback('👍 All good!')}
                    disabled={!isReadyToParticipate}
                    className={`w-full p-3 text-2xl rounded-lg ${clickedButton === '👍 All good!' ? 'bg-green-700' : 'bg-green-500'} hover:bg-green-600 disabled:opacity-50 transition-colors`}
                  >👍 All good!</button>
                  <button
                    onClick={() => handleFeedback('🤔 A bit confused')}
                    disabled={!isReadyToParticipate}
                    className={`w-full p-3 text-2xl rounded-lg ${clickedButton === '🤔 A bit confused' ? 'bg-yellow-700' : 'bg-yellow-500'} hover:bg-yellow-600 disabled:opacity-50 transition-colors`}
                  >🤔 A bit confused</button>
                  <button
                    onClick={() => handleFeedback('👎 Totally lost')}
                    disabled={!isReadyToParticipate}
                    className={`w-full p-3 text-2xl rounded-lg ${clickedButton === '👎 Totally lost' ? 'bg-red-700' : 'bg-red-500'} hover:bg-red-600 disabled:opacity-50 transition-colors`}
                  >👎 Totally lost</button>
                </div>
                <div className="mt-4">
                  {studentFeedbackLog.map((fb, i) => <p key={i} className="text-lg">{fb.status}</p>)}
                </div>
              </div>

              {activePoll && (
                <div className="p-4 bg-slate-700 rounded-xl">
                  <h2 className="text-3xl font-semibold mb-3">Live Poll</h2>
                  <p className="text-xl mb-3">{activePoll.question}</p>
                  {userPollVote !== null ? (
                    <p className="text-center text-2xl p-3 bg-green-800 rounded-lg">You voted for: "{activePoll.options[userPollVote]}"</p>
                  ) : (
                    <div className="space-y-2">
                      {activePoll.options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handlePollVote(activePoll.id, index)}
                          className="w-full p-3 text-xl bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >{option}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-slate-700 rounded-xl">
                <h2 className="text-3xl font-semibold mb-3">Talent Ranking</h2>
                <TalentGraph talentsData={talentsDataForGraph} type="student" selectedCourse={selectedCourse} getFirstName={getFirstName} />
              </div>

            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="p-4 bg-slate-700 rounded-xl">
                <h2 className="text-3xl font-semibold mb-3">Add Content</h2>
                <div className="space-y-4">
                  <ContentForm
                    formKey={`${selectedCourse}:${nameInput}:${studentSelectedDate}`}
                    type="question_comment"
                    onAddContent={handleAddContent}
                    isEnabled={isReadyToParticipate}
                    placeholder="Questions or comments?"
                  />
                  <ContentForm
                    formKey={`${selectedCourse}:${nameInput}:${studentSelectedDate}`}
                    type="reasoning"
                    onAddContent={handleAddContent}
                    isEnabled={isReadyToParticipate}
                    placeholder="Share your reasoning"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-700 rounded-xl">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-3xl font-semibold">Today's Posts</h2>
                  <input
                    type="date"
                    value={studentSelectedDate}
                    onChange={(e) => setStudentSelectedDate(e.target.value)}
                    className="p-2 border bg-slate-600 border-slate-500 rounded-lg text-lg"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-2xl font-medium mb-2">Reasoning</h3>
                    <div ref={studentListRefReason} className="space-y-2 overflow-y-auto max-h-80 pr-2">
                      {studentReasoningPosts.map(p => <StudentPostItem key={p.id} post={p} nameInput={nameInput} getFirstName={getFirstName} handleStudentLike={handleStudentLike} toggleReplies={toggleReplies} showReplies={showReplies} replies={replies} StudentReplyForm={StudentReplyForm} handleAddReply={handleAddReply} />)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-medium mb-2">Q & C</h3>
                    <div ref={studentListRefQC} className="space-y-2 overflow-y-auto max-h-80 pr-2">
                      {studentQcPosts.map(p => <StudentPostItem key={p.id} post={p} nameInput={nameInput} getFirstName={getFirstName} handleStudentLike={handleStudentLike} toggleReplies={toggleReplies} showReplies={showReplies} replies={replies} StudentReplyForm={StudentReplyForm} handleAddReply={handleAddReply} />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const AdminLogItem = ({ log, onReply, onLike, onPenalty, isAdminAnonymousMode, ReplyFormComponent, getFirstName }) => (
  <div className="p-3 bg-slate-600 rounded-lg">
    <div className="flex justify-between items-start">
      <div className="flex-1 mr-2 text-xl">
        <span className="font-bold">{isAdminAnonymousMode ? "Anonymous" : getFirstName(log.name)}: </span>
        {log.text}
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0">
        {log.adminLiked ? <span className="text-green-500 font-bold text-lg">✓ Liked</span> : <button onClick={() => onLike(log.id, log.name)} className="text-3xl">👍</button>}
        <button onClick={() => onPenalty(log.name, -1, 'penalty')} className="px-3 py-1 bg-red-600 text-white text-md font-bold rounded hover:bg-red-700">-1</button>
      </div>
    </div>
    <ReplyFormComponent log={log} onReply={onReply} />
  </div>
);

const CreatePollForm = ({ onCreatePoll, onDeactivatePoll, activePoll }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => setOptions([...options, '']);
  const removeOption = (index) => setOptions(options.filter((_, i) => i !== index));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim() && options.every(o => o.trim())) {
      onCreatePoll(question, options.map(o => o.trim()));
      setQuestion('');
      setOptions(['', '']);
    }
  };

  return (
    <div className="my-6 p-4 border border-slate-600 rounded-xl">
      <h2 className="text-3xl font-semibold mb-4 text-center">Poll Management</h2>
      {activePoll ? (
        <div className="text-center">
          <p className="text-xl mb-2">Current active poll:</p>
          <p className="font-bold text-2xl mb-4">{activePoll.question}</p>
          <button onClick={() => onDeactivatePoll(activePoll.id)} className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xl">Close Current Poll</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Poll Question"
            className="w-full p-3 border bg-slate-700 border-slate-500 rounded-lg text-2xl"
            required
          />
          {options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 p-3 border bg-slate-700 border-slate-500 rounded-lg text-2xl"
                required
              />
              {options.length > 2 && <button type="button" onClick={() => removeOption(index)} className="p-2 bg-red-600 text-white rounded-full text-lg">X</button>}
            </div>
          ))}
          <div className="flex justify-between">
            <button type="button" onClick={addOption} className="p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-lg">Add Option</button>
            <button type="submit" className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-xl">Create Poll</button>
          </div>
        </form>
      )}
    </div>
  );
};


/** --------------------------
* 메인  App
* -------------------------- */
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
  const [studentFeedbackLog, setStudentFeedbackLog] = useState([]);
  const [clickedButton, setClickedButton] = useState(null);
  const [adminSelectedDate, setAdminSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adminSelectedStudent, setAdminSelectedStudent] = useState('');
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
  const [replyDraft, setReplyDraft] = useState({});
  const replyUnsubs = React.useRef({});

  const showMessage = useCallback((msg) => {
    setMessage(msg);
    setShowMessageBox(true);
    setTimeout(() => {
      setShowMessageBox(false);
      setMessage('');
    }, 3000);
  }, []);

  const getFirstName = useCallback((fullName) => {
    if (!fullName) return '';
    const parts = fullName.split(', ');
    return parts.length > 1 ? parts[1] : parts[0];
  }, []);

  useEffect(() => {
    const firebaseConfig = {
      // 중요: 이 부분을 실제 Firebase 키로 교체해야 합니다.
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID"
    };
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    setDb(getFirestore(app));
    signInAnonymously(auth).catch(console.error);
  }, []);

  useEffect(() => {
    if (!db || !nameInput) { setIsPinRegistered(false); return; }
    const checkPin = async () => {
      const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput);
      const docSnap = await getDoc(pinDocRef);
      setIsPinRegistered(docSnap.exists());
    };
    checkPin();
  }, [db, nameInput, appId]);

  const handleNameChange = (newName) => {
    setNameInput(newName);
    setIsAuthenticated(false);
  };

  const handlePinLogin = useCallback(async (pin) => {
    if (!db || !nameInput) return showMessage("Please select your name first.");
    const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput);
    try {
      const docSnap = await getDoc(pinDocRef);
      if (docSnap.exists() && docSnap.data().pin === pin) {
        setIsAuthenticated(true);
        showMessage(`Welcome, ${getFirstName(nameInput)}!`);
      } else {
        showMessage("Incorrect PIN.");
      }
    } catch (e) {
      showMessage("Login error.");
    }
  }, [db, nameInput, appId, getFirstName, showMessage]);

  const handlePinRegister = useCallback(async (pin, confirmation) => {
    if (!db || !nameInput) return showMessage("Please select your name first.");
    if (pin.length !== 4) return showMessage("PIN must be 4 digits.");
    if (pin !== confirmation) return showMessage("PINs do not match.");
    const pinDocRef = doc(db, `/artifacts/${appId}/public/data/studentPins`, nameInput);
    try {
      await setDoc(pinDocRef, { pin });
      setIsAuthenticated(true);
      showMessage(`PIN registered! Welcome, ${getFirstName(nameInput)}!`);
    } catch (e) {
      showMessage("Error registering PIN.");
    }
  }, [db, nameInput, appId, getFirstName, showMessage]);

  useEffect(() => {
    const checkTime = () => setIsClassActive(isWithinClassTime(selectedCourse));
    checkTime();
    const interval = setInterval(checkTime, 30000);
    return () => clearInterval(interval);
  }, [selectedCourse]);

  useEffect(() => {
    if (!db) return;
    const talentsQuery = query(
      collection(db, `/artifacts/${appId}/public/data/talents`),
      where("course", "==", selectedCourse)
    );
    const unsub = onSnapshot(talentsQuery, (snap) =>
      setTalentsLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [db, selectedCourse, appId]);

  useEffect(() => {
    if (!db || !isAdmin) return;
    setQuestionsLog([]);
    const questionsQuery = query(
      collection(db, `/artifacts/${appId}/public/data/questions`),
      where("course", "==", selectedCourse),
      where("date", "==", adminSelectedDate),
      orderBy("timestamp", "desc")
    );
    const unsubQ = onSnapshot(questionsQuery, (snapshot) => {
      setQuestionsLog(prevLogs => {
        const map = new Map(prevLogs.map(l => [l.id, l]));
        snapshot.docChanges().forEach(change => {
          const data = { id: change.doc.id, ...change.doc.data() };
          if (change.type === "removed") map.delete(data.id);
          else map.set(data.id, data);
        });
        return Array.from(map.values())
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      });
    });

    const fbQuery = query(
      collection(db, `/artifacts/${appId}/public/data/feedback`),
      where("course", "==", selectedCourse),
      where("date", "==", adminSelectedDate),
      orderBy("timestamp", "desc")
    );
    const unsubF = onSnapshot(fbQuery, (snap) =>
      setFeedbackLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubQ(); unsubF(); };
  }, [db, selectedCourse, adminSelectedDate, appId, isAdmin]);

  useEffect(() => {
    if (!db || !isAdmin || !adminSelectedStudent) { setAdminStudentLog([]); return; }
    const logQuery = query(
      collection(db, `/artifacts/${appId}/public/data/questions`),
      where("course", "==", selectedCourse),
      where("name", "==", adminSelectedStudent),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(logQuery, (snap) =>
      setAdminStudentLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [db, selectedCourse, adminSelectedStudent, appId, isAdmin]);

  useEffect(() => {
    if (!db || isAdmin || !nameInput || !isAuthenticated) {
      setAllPostsLog([]); setMyTotalTalents(0); setTalentTransactions([]);
      setDailyProgress({ question_comment: 0, reasoning: 0 }); setStudentFeedbackLog([]);
      return;
    }

    const transactionsQuery = query(
      collection(db, `/artifacts/${appId}/public/data/talentTransactions`),
      where("name", "==", nameInput),
      orderBy("timestamp", "desc")
    );
    const unsubT = onSnapshot(transactionsQuery, (snap) => {
      const today = new Date().toISOString().slice(0, 10);
      const todaysTransactions = snap.docs.map(d => d.data())
        .filter(t => t.timestamp?.toDate().toISOString().slice(0, 10) === today);
      setTalentTransactions(todaysTransactions);
      setVerbalParticipationCount(todaysTransactions.filter(t => t.type === 'verbal_participation').length);
    });

    const talentDocRef = doc(db, `/artifacts/${appId}/public/data/talents`, nameInput);
    const unsubM = onSnapshot(talentDocRef, (d) => setMyTotalTalents(d.exists() ? d.data().totalTalents : 0));

    const allPostsQuery = query(
      collection(db, `/artifacts/${appId}/public/data/questions`),
      where("course", "==", selectedCourse),
      where("date", "==", studentSelectedDate),
      orderBy("timestamp", "desc")
    );
    const unsubAll = onSnapshot(allPostsQuery, (snapshot) => {
      setAllPostsLog(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        snapshot.docChanges().forEach(ch => {
          const data = { id: ch.doc.id, ...ch.doc.data() };
          if (ch.type === "removed") map.delete(data.id);
          else map.set(data.id, data);
        });
        const posts = Array.from(map.values())
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        const myPosts = posts.filter(p => p.name === nameInput);
        setDailyProgress({
          question_comment: myPosts.filter(a => a.type === 'question_comment').length,
          reasoning: myPosts.filter(a => a.type === 'reasoning').length
        });
        return posts;
      });
    });

    const fbQuery = query(
      collection(db, `/artifacts/${appId}/public/data/feedback`),
      where("course", "==", selectedCourse),
      where("name", "==", nameInput),
      where("date", "==", studentSelectedDate),
      orderBy("timestamp", "desc")
    );
    const unsubF = onSnapshot(fbQuery, (snap) => setStudentFeedbackLog(snap.docs.map(d => d.data())));

    return () => { unsubM(); unsubT(); unsubF(); unsubAll(); };
  }, [db, selectedCourse, nameInput, studentSelectedDate, appId, isAdmin, isAuthenticated]);

  useEffect(() => {
    if (!db || !isAuthenticated) { setActivePoll(null); return; }
    const pollQuery = query(
      collection(db, `/artifacts/${appId}/public/data/polls`),
      where("course", "==", selectedCourse),
      where("isActive", "==", true)
    );
    const unsubscribe = onSnapshot(pollQuery, (snapshot) => {
      if (!snapshot.empty) {
        const pollData = snapshot.docs[0].data();
        const pollId = snapshot.docs[0].id;
        setActivePoll({ id: pollId, ...pollData });
        if (pollData.responses && pollData.responses[nameInput] !== undefined) {
          setUserPollVote(pollData.responses[nameInput]);
        } else {
          setUserPollVote(null);
        }
      } else {
        setActivePoll(null);
      }
    });
    return () => unsubscribe();
  }, [db, selectedCourse, isAuthenticated, nameInput, appId]);

  const modifyTalent = useCallback(async (studentName, amount, type) => {
    if (!db) return;
    const talentDocRef = doc(db, `/artifacts/${appId}/public/data/talents`, studentName);
    const transactionColRef = collection(db, `/artifacts/${appId}/public/data/talentTransactions`);
    try {
      const docSnap = await getDoc(talentDocRef);
      let currentTalents = docSnap.exists() ? docSnap.data().totalTalents || 0 : 0;
      const newTotal = currentTalents + amount;
      if (newTotal < 0) {
        showMessage("Talent cannot go below 0.");
        return;
      }
      if (docSnap.exists()) {
        await updateDoc(talentDocRef, { totalTalents: newTotal });
      } else {
        await setDoc(talentDocRef, { name: studentName, course: selectedCourse, totalTalents: newTotal });
      }
      if (type !== 'automatic') showMessage(`${getFirstName(studentName)} received ${amount > 0 ? `+${amount}` : amount} Talent!`);
      await addDoc(transactionColRef, { name: studentName, points: amount, type: type, timestamp: serverTimestamp() });
    } catch (e) {
      console.error("Error modifying talent: ", e);
    }
  }, [db, appId, selectedCourse, getFirstName, showMessage]);

  const handleAddContent = useCallback(async (text, type) => {
    if (!db || !nameInput.trim() || !text.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await addDoc(collection(db, `/artifacts/${appId}/public/data/questions`), {
        name: nameInput,
        text,
        type,
        course: selectedCourse,
        date: today,
        timestamp: serverTimestamp(),
        studentLiked: false,
        adminLiked: false
      });
      showMessage("Submission complete! ✅ ");
      await modifyTalent(nameInput, 1, 'automatic');
    } catch (e) {
      showMessage("Submission failed. ❌ ");
    }
  }, [db, nameInput, selectedCourse, appId, modifyTalent, showMessage]);

  const handleFeedback = useCallback(async (status) => {
    if (!db || !nameInput.trim()) return showMessage("Please select your name first.");
    setClickedButton(status);
    setTimeout(() => setClickedButton(null), 1500);
    try {
      await addDoc(collection(db, `/artifacts/${appId}/public/data/feedback`), {
        name: nameInput,
        status,
        course: selectedCourse,
        date: new Date().toISOString().slice(0, 10),
        timestamp: serverTimestamp()
      });
      showMessage("Feedback submitted!");
    } catch (e) {
      showMessage("Failed to submit feedback.");
    }
  }, [db, nameInput, selectedCourse, appId, showMessage]);

  const handleAdminLogin = (password) => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      showMessage("Admin Login successful! 🔑 ");
    } else {
      showMessage("Incorrect password. 🚫 ");
    }
  };

  const handleReply = useCallback(async (logId, replyText) => {
    if (!db) return;
    const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId);
    try {
      await updateDoc(questionDocRef, { reply: replyText });
      showMessage("Reply sent!");
    } catch (e) {
      showMessage("Failed to send reply.");
      console.error(e);
    }
  }, [db, appId, showMessage]);

  const handleStudentLike = useCallback(async (logId) => {
    if (!db) return;
    const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId);
    try {
      await updateDoc(questionDocRef, { studentLiked: true });
    } catch (e) {
      console.error("Error (student like):", e);
    }
  }, [db, appId]);

  const handleAdminLike = useCallback(async (logId, authorFullName) => {
    if (!db) return;
    const questionDocRef = doc(db, `/artifacts/${appId}/public/data/questions`, logId);
    try {
      const docSnap = await getDoc(questionDocRef);
      if (docSnap.exists() && !docSnap.data().adminLiked) {
        await updateDoc(questionDocRef, { adminLiked: true });
        await modifyTalent(authorFullName, 1, 'post_bonus');
      }
    } catch (e) {
      console.error("Error (admin like):", e);
    }
  }, [db, appId, modifyTalent]);

  const handleCreatePoll = useCallback(async (question, options) => {
    if (!db || !isAdmin) return;
    try {
      await addDoc(collection(db, `/artifacts/${appId}/public/data/polls`), {
        question,
        options,
        course: selectedCourse,
        isActive: true,
        responses: {},
        timestamp: serverTimestamp()
      });
      showMessage("Poll published successfully!");
    } catch (error) {
      showMessage("Error publishing poll.");
      console.error("Error creating poll: ", error);
    }
  }, [db, isAdmin, selectedCourse, appId, showMessage]);

  const handlePollVote = useCallback(async (pollId, optionIndex) => {
    if (!db || !nameInput) return;
    const pollDocRef = doc(db, `/artifacts/${appId}/public/data/polls`, pollId);
    try {
      await updateDoc(pollDocRef, { [`responses.${nameInput}`]: optionIndex });
    } catch (error) {
      console.error("Error voting on poll: ", error);
    }
  }, [db, nameInput, appId]);

  const handleDeactivatePoll = useCallback(async (pollId) => {
    if (!db || !isAdmin) return;
    const pollDocRef = doc(db, `/artifacts/${appId}/public/data/polls`, pollId);
    try {
      await updateDoc(pollDocRef, { isActive: false });
      showMessage("Poll closed.");
    } catch (error) {
      showMessage("Error closing poll.");
      console.error("Error deactivating poll: ", error);
    }
  }, [db, isAdmin, appId, showMessage]);

  const handleAddReply = useCallback(async (postId, replyText) => {
    if (!db || !nameInput) return;
    const repliesColRef = collection(db, `/artifacts/${appId}/public/data/questions/${postId}/replies`);
    try {
      await addDoc(repliesColRef, {
        text: replyText,
        author: getFirstName(nameInput),
        authorFullName: nameInput,
        adminLiked: false,
        timestamp: serverTimestamp()
      });
      await modifyTalent(nameInput, 1, 'peer_reply');
    } catch (error) {
      console.error("Error adding reply: ", error);
    }
  }, [db, nameInput, getFirstName, appId, modifyTalent]);

  const toggleReplies = useCallback((postId) => {
    setShowReplies(prev => {
      const next = !prev[postId];
      if (!next) {
        replyUnsubs.current[postId]?.forEach(unsub => unsub && unsub());
        delete replyUnsubs.current[postId];
        return { ...prev, [postId]: next };
      }
      replyUnsubs.current[postId]?.forEach(unsub => unsub && unsub());
      replyUnsubs.current[postId] = [];

      const repliesQuery = query(
        collection(db, `/artifacts/${appId}/public/data/questions/${postId}/replies`),
        orderBy("timestamp", "asc")
      );
      const unsub = onSnapshot(repliesQuery, (snapshot) => {
        const fetchedReplies = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setReplies(prevR => ({ ...prevR, [postId]: fetchedReplies }));
      });
      replyUnsubs.current[postId].push(unsub);
      return { ...prev, [postId]: next };
    });
  }, [db, appId]);

  useEffect(() => {
    return () => {
      Object.values(replyUnsubs.current).forEach(arr => arr.forEach(u => u && u()));
      replyUnsubs.current = {};
    };
  }, []);

  const handleVerbalParticipation = useCallback(() => {
    if (!db || !nameInput) return;
    modifyTalent(nameInput, 1, 'verbal_participation');
  }, [db, nameInput, modifyTalent]);

  const isNameEntered = nameInput.trim().length > 0;
  const isReadyToParticipate = isAuthenticated && isClassActive;

  const adminDailyProgress = useMemo(() => {
    const roster = COURSE_STUDENTS[selectedCourse] || [];
    const initialProgress = roster.reduce((acc, studentName) => {
      acc[studentName] = { question_comment: 0, reasoning: 0 };
      return acc;
    }, {});
    questionsLog.forEach(log => {
      if (initialProgress[log.name]) {
        if (log.type === 'question_comment') initialProgress[log.name].question_comment++;
        if (log.type === 'reasoning') initialProgress[log.name].reasoning++;
      }
    });
    return initialProgress;
  }, [questionsLog, selectedCourse]);

  const [reasoningPosts, qcPosts] = useMemo(() => {
    const reasoning = questionsLog.filter(p => p.type === 'reasoning');
    const qc = questionsLog.filter(p => p.type === 'question_comment');
    return [reasoning, qc];
  }, [questionsLog]);

  const [studentReasoningPosts, studentQcPosts] = useMemo(() => {
    const reasoning = allPostsLog.filter(p => p.type === 'reasoning');
    const qc = allPostsLog.filter(p => p.type === 'question_comment');
    return [reasoning, qc];
  }, [allPostsLog]);

  const adminListRefQC = React.useRef(null);
  const adminListRefReason = React.useRef(null);
  const studentListRefQC = React.useRef(null);
  const studentListRefReason = React.useRef(null);
  usePreserveScroll(adminListRefQC, [qcPosts.length]);
  usePreserveScroll(adminListRefReason, [reasoningPosts.length]);
  usePreserveScroll(studentListRefQC, [studentQcPosts.length]);
  usePreserveScroll(studentListRefReason, [studentReasoningPosts.length]);

  const ReplyForm = ({ log, onReply }) => {
    const val = replyDraft[log.id] ?? (log.reply || "");
    const setVal = (v) => setReplyDraft((s) => ({ ...s, [log.id]: v }));

    return (
      <div className="mt-2 flex items-center space-x-2">
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Write a reply..."
          className="flex-1 p-2 border bg-slate-600 border-slate-500 rounded-lg text-lg" />
        <button onClick={() => onReply(log.id, val)} className="p-2 bg-blue-500 hover:bg-blue-600 text-white text-lg rounded-lg">Send</button>
        <button onClick={() => { setVal("Addressed in class"); onReply(log.id, "Addressed in class"); }} className="p-2 bg-gray-500 hover:bg-gray-600 text-white text-lg rounded-lg whitespace-nowrap" > Addressed </button>
      </div>
    );
  };

  const StudentReplyForm = ({ postId, onAddReply }) => {
    const [replyText, setReplyText] = useState('');
    const handleSend = () => { onAddReply(postId, replyText); setReplyText(''); };
    return (
      <div className="mt-2 flex items-center space-x-2">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write an anonymous reply..."
          className="flex-1 p-2 border bg-slate-600 border-slate-500 rounded-lg text-lg"
        />
        <button onClick={handleSend} className="p-2 bg-blue-500 hover:bg-blue-600 text-white text-lg rounded-lg">Reply</button>
      </div>
    );
  };

  const MainContent = () => (
    <div className="w-full max-w-4xl p-6 bg-slate-800 text-white rounded-xl shadow-lg box-shadow-custom">
      {isAdmin ? (
        <>
          <h1 className="text-5xl font-bold text-center mb-4"><span className="text-green-500">''Ahn''</span>stoppable Learning</h1>
          <CreatePollForm onCreatePoll={handleCreatePoll} onDeactivatePoll={handleDeactivatePoll} activePoll={activePoll} />
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setIsAdmin(false)} className="p-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-lg">Back to student view</button>
            <button
              onClick={() => setIsAdminAnonymousMode(!isAdminAnonymousMode)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg">
              {isAdminAnonymousMode ? "Show Student Names" : "Hide Student Names"}
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {COURSES.map((course) => (
              <button
                key={course}
                onClick={() => setSelectedCourse(course)}
                className={`p-3 text-lg font-medium rounded-lg ${selectedCourse === course ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}
              >
                {course}
              </button>
            ))}
          </div>
          <select
            value={adminSelectedStudent}
            onChange={(e) => setAdminSelectedStudent(e.target.value)}
            className="p-3 mb-6 w-full border bg-slate-700 border-slate-500 rounded-lg text-2xl"
          >
            <option value="">-- View All Daily Logs --</option>
            {COURSE_STUDENTS[selectedCourse].map((name, i) => <option key={i} value={name}>{name}</option>)}
          </select>

          {adminSelectedStudent ? (
            <div className="text-left p-4 border border-slate-600 rounded-xl mt-6">
              <h3 className="text-3xl font-semibold">All Logs for {isAdminAnonymousMode ? "Anonymous" : getFirstName(adminSelectedStudent)}</h3>
              <div className="flex justify-center items-center text-center my-4 p-3 bg-yellow-400 text-black rounded-lg">
                <img src="/talent-coin.png" alt="Talent coin" className="w-8 h-8 mr-2" />
                <p className="font-bold text-2xl">Total Talents: {talentsLog.find(t => t.id === adminSelectedStudent)?.totalTalents || 0}</p>
              </div>
              <ul>
                {adminStudentLog.map((log) => (
                  <li key={log.id} className="p-2 border-b border-slate-700 text-xl">
                    <div className="flex justify-between items-start">
                      <span className="flex-1 mr-2"><span className="font-bold">{log.date}</span> [{log.type}]: {log.text}</span>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {log.adminLiked ? (
                          <span className="text-green-500 font-bold text-lg">✓ Liked</span>
                        ) : (
                          <button onClick={() => handleAdminLike(log.id, log.name)} className="text-3xl"> 👍 </button>
                        )}
                        <button onClick={() => modifyTalent(log.name, -1, 'penalty')} className="px-3 py-1 bg-red-600 text-white text-md font-bold rounded hover:bg-red-700">-1</button>
                      </div>
                    </div>
                    {log.reply && <div className="mt-2 p-2 bg-green-900 rounded-lg text-lg"><span className="font-bold">✓ You Replied</span></div>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-2xl font-bold mb-2">Select Date:</label>
                <input type="date" value={adminSelectedDate} onChange={(e) => setAdminSelectedDate(e.target.value)} className="p-3 w-full border bg-slate-700 border-slate-500 rounded-lg text-2xl" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-3xl font-semibold mb-3">Daily Progress</h3>
                  <div className="p-4 bg-slate-700 rounded-lg">
                    {COURSE_STUDENTS[selectedCourse].map(studentName => (
                      <div key={studentName} className="flex justify-between items-center mb-2 p-2 rounded hover:bg-slate-600">
                        <span className="font-medium text-xl">{isAdminAnonymousMode ? "Anonymous" : getFirstName(studentName)}</span>
                        <div className="flex items-center space-x-2 text-xl">
                          <span className={adminDailyProgress[studentName].question_comment > 0 ? 'text-green-400' : ''}>Q: {adminDailyProgress[studentName].question_comment}</span>
                          <span className={adminDailyProgress[studentName].reasoning > 0 ? 'text-green-400' : ''}>R: {adminDailyProgress[studentName].reasoning}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-3xl font-semibold mb-3">Today's Feedback</h3>
                  <div className="p-4 bg-slate-700 rounded-lg">
                    {feedbackLog.length > 0 ? (
                      feedbackLog.map((fb, i) => (
                        <p key={i} className="text-xl mb-1">{isAdminAnonymousMode ? "Anonymous" : getFirstName(fb.name)}: {fb.status}</p>
                      ))
                    ) : <p className="text-gray-400 text-lg">No feedback yet for today.</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h3 className="text-3xl font-semibold mb-3">Reasoning ({reasoningPosts.length})</h3>
                  <div ref={adminListRefReason} className="p-4 bg-slate-700 rounded-lg space-y-3 overflow-y-auto max-h-96">
                    {reasoningPosts.map(log => <AdminLogItem key={log.id} log={log} onReply={handleReply} onLike={handleAdminLike} onPenalty={modifyTalent} isAdminAnonymousMode={isAdminAnonymousMode} ReplyFormComponent={ReplyForm} getFirstName={getFirstName} />)}
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-semibold mb-3">Questions & Comments ({qcPosts.length})</h3>
                  <div ref={adminListRefQC} className="p-4 bg-slate-700 rounded-lg space-y-3 overflow-y-auto max-h-96">
                    {qcPosts.map(log => <AdminLogItem key={log.id} log={log} onReply={handleReply} onLike={handleAdminLike} onPenalty={modifyTalent} isAdminAnonymousMode={isAdminAnonymousMode} ReplyFormComponent={ReplyForm} getFirstName={getFirstName} />)}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <StudentView
          nameInput={nameInput}
          selectedCourse={selectedCourse}
          setSelectedCourse={setSelectedCourse}
          handleNameChange={handleNameChange}
          isNameEntered={isNameEntered}
          isAuthenticated={isAuthenticated}
          isPinRegistered={isPinRegistered}
          handlePinLogin={handlePinLogin}
          handlePinRegister={handlePinRegister}
          getFirstName={getFirstName}
          isClassActive={isClassActive}
          isReadyToParticipate={isReadyToParticipate}
          dailyProgress={dailyProgress}
          myTotalTalents={myTotalTalents}
          verbalParticipationCount={verbalParticipationCount}
          handleVerbalParticipation={handleVerbalParticipation}
          studentFeedbackLog={studentFeedbackLog}
          handleFeedback={handleFeedback}
          clickedButton={clickedButton}
          studentSelectedDate={studentSelectedDate}
          setStudentSelectedDate={setStudentSelectedDate}
          studentReasoningPosts={studentReasoningPosts}
          studentQcPosts={studentQcPosts}
          studentListRefQC={studentListRefQC}
          studentListRefReason={studentListRefReason}
          handleStudentLike={handleStudentLike}
          toggleReplies={toggleReplies}
          showReplies={showReplies}
          replies={replies}
          StudentReplyForm={StudentReplyForm}
          handleAddReply={handleAddReply}
          activePoll={activePoll}
          handlePollVote={handlePollVote}
          userPollVote={userPollVote}
          talentsLog={talentsLog}
          handleAddContent={handleAddContent}
          onAdminLogin={handleAdminLogin}
        />
      )}
      {showMessageBox && <div className="fixed bottom-5 right-5 bg-green-500 text-white p-4 rounded-lg shadow-lg animate-fade-in-out text-xl">{message}</div>}
    </div>
  );

  return <MainContent />;
};

export default App;