import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
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
    "Milliman, Audrey", "Morris, Adam", "Ryan, Margaret", "Schoen, Ryan",
    "Sirlin, Jacob", "Urum E, Mahin", "Whalen, Jake", "Yang, Ruofan"
  ],
  "ADV 461": [
    "Anderson, Brandon", "Bae, Jiyoon", "D'Angelo, Michael", "D'Arcy, Evelyn",
    "DeFabio, Michael", "Demko, Emma", "Erickson, Nicholas", "Fallon, Chloe",
    "Guan, Xinyu", "Jiang, Yilin", "Jin, Yujia", "Kim, Minjung",
    "Lee, Byungho", "Li, Ruicheng", "Lin, Kuan-Yu", "Love, James",
    "O'Brien, Jason", "Rong, Yuru", "Shen, Ruijie", "Song, Yuhan",
    "Vittorio, Jack", "Wang, Yi-Hsuan", "Williams, Sydney", "Zhang, Hang"
  ]
};

const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // 이 부분은 원래 사용하시던 키로 유지됩니다.
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "ahn-app-final-project",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 스크롤 오류를 해결하기 위한 독립적인 입력창 컴포넌트
const PostInput = ({ title, onSubmit, placeholder }) => {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
    }
  };

  return (
    <div className="mt-4">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-24 p-2 border rounded-lg"
        placeholder={placeholder}
      />
      <button
        onClick={handleSubmit}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Submit
      </button>
    </div>
  );
};

const App = () => {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [studentName, setStudentName] = useState(null);
  const [messages, setMessages] = useState([]);
  const [polls, setPolls] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dalants, setDalants] = useState({});

  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);
  
  useEffect(() => {
    signInAnonymously(auth).catch(alert);
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    const messagesQuery = query(collection(db, `courses/${selectedCourse}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const pollsQuery = query(collection(db, `courses/${selectedCourse}/polls`));
    const unsubscribePolls = onSnapshot(pollsQuery, (snapshot) => {
      setPolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const dalantsQuery = query(collection(db, `courses/${selectedCourse}/dalants`));
    const unsubscribeDalants = onSnapshot(dalantsQuery, (snapshot) => {
      const newDalants = {};
      snapshot.forEach(doc => {
        newDalants[doc.id] = doc.data().count;
      });
      setDalants(newDalants);
    });

    return () => {
      unsubscribeMessages();
      unsubscribePolls();
      unsubscribeDalants();
    };
  }, [selectedCourse]);

  const handleAdminLogin = () => {
    const password = prompt("Enter admin password:");
    if (password === "adv375") { 
      setIsAdmin(true);
      setStudentName("Admin");
    } else {
      alert("Incorrect password");
    }
  };

  const handleCourseSelection = (course) => {
    setSelectedCourse(course);
    setStudentName(null);
    setIsAdmin(false);
  };

  const handleStudentSelection = (name) => {
    setStudentName(name);
  };
  
  const handlePostSubmit = async (text) => {
    if (!text || !auth.currentUser) return;
    await addDoc(collection(db, 'courses', selectedCourse, 'messages'), {
      text: text,
      timestamp: serverTimestamp(),
      author: studentName,
      type: 'post'
    });
  };

  const handleReasoningSubmit = async (text) => {
    if (!text || !auth.currentUser) return;
    await addDoc(collection(db, 'courses', selectedCourse, 'messages'), {
      text: text,
      timestamp: serverTimestamp(),
      author: studentName,
      type: 'reasoning'
    });
  };

  const handleReplySubmit = async (messageId, replyText) => {
    if (!replyText.trim() || !auth.currentUser) return;
    const messageRef = doc(db, 'courses', selectedCourse, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);
    if (messageSnap.exists()) {
      const messageData = messageSnap.data();
      const newReplies = [...(messageData.replies || []), { text: replyText, author: studentName, timestamp: new Date() }];
      await updateDoc(messageRef, { replies: newReplies });
    }
  };

  const handlePollSubmit = async (question, options) => {
    if (!question.trim() || options.some(o => !o.trim())) return;
    await addDoc(collection(db, `courses/${selectedCourse}/polls`), {
      question,
      options,
      votes: Array(options.length).fill(0),
    });
  };

  const handleVote = async (pollId, optionIndex) => {
    const userVoteKey = `voted_${pollId}_${auth.currentUser.uid}`;
    if (localStorage.getItem(userVoteKey)) {
      alert("You have already voted in this poll.");
      return;
    }
    const pollRef = doc(db, `courses/${selectedCourse}/polls`, pollId);
    const pollSnap = await getDoc(pollRef);
    if (pollSnap.exists()) {
      const poll = pollSnap.data();
      const newVotes = [...poll.votes];
      newVotes[optionIndex] += 1;
      await updateDoc(pollRef, { votes: newVotes });
      localStorage.setItem(userVoteKey, 'true');
    }
  };

  const handleDalant = async (studentName) => {
    if (!isAdmin) return;
    const dalantRef = doc(db, `courses/${selectedCourse}/dalants`, studentName);
    const dalantSnap = await getDoc(dalantRef);
    const currentDalants = dalantSnap.exists() ? dalantSnap.data().count : 0;
    await updateDoc(dalantRef, { count: currentDalants + 1 });
  };
  
  const MainContent = () => {
    const [replyText, setReplyText] = useState('');
    const [activeReplyId, setActiveReplyId] = useState(null);

    const onReplySubmit = (messageId) => {
      handleReplySubmit(messageId, replyText);
      setReplyText('');
      setActiveReplyId(null);
    };

    if (!selectedCourse || !studentName) return null;
    
    return (
      <div className="w-full max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <h2 className="text-3xl font-bold mb-4">{selectedCourse} - {studentName}</h2>
        
        <div className="space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`p-3 rounded-lg ${msg.author === studentName ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <p className="font-semibold">{msg.author} <span className="text-sm text-gray-500">{msg.timestamp?.toDate().toLocaleString()}</span></p>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              
              {msg.replies && msg.replies.map((reply, index) => (
                <div key={index} className="ml-4 mt-2 p-2 rounded-lg bg-gray-200">
                  <p className="font-semibold text-sm">{reply.author} <span className="text-xs text-gray-500">{new Date(reply.timestamp.seconds * 1000).toLocaleString()}</span></p>
                  <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
                </div>
              ))}

              <div className="flex items-center mt-2">
                {isAdmin && (
                  <button onClick={() => handleDalant(msg.author)} className="text-sm text-yellow-500 hover:underline mr-4">달란트</button>
                )}
                <button onClick={() => setActiveReplyId(msg.id)} className="text-sm text-blue-600 hover:underline">Reply</button>
              </div>

              {activeReplyId === msg.id && (
                <div className="mt-2">
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="w-full h-16 p-2 border rounded-lg" placeholder="Write a reply..." />
                  <button onClick={() => onReplySubmit(msg.id)} className="mt-1 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600">Submit Reply</button>
                  <button onClick={() => setActiveReplyId(null)} className="ml-2 mt-1 px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500">Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <PostInput
          title="Questions and Comments"
          onSubmit={handlePostSubmit}
          placeholder="Type your question or comment here..."
        />

        <PostInput
          title="Reasoning Posts"
          onSubmit={handleReasoningSubmit}
          placeholder="Share your reasoning..."
        />
        
        {isAdmin && <AdminPollCreation onCreatePoll={handlePollSubmit} />}
        <div className="mt-6 space-y-6">
          {polls.map((poll) => (
            <Poll key={poll.id} poll={poll} onVote={handleVote} />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>
    );
  };

  const AdminPollCreation = ({ onCreatePoll }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
  
    const handleOptionChange = (index, value) => {
      const newOptions = [...options];
      newOptions[index] = value;
      setOptions(newOptions);
    };
  
    const addOption = () => {
      setOptions([...options, '']);
    };
  
    const handleSubmit = (e) => {
      e.preventDefault();
      onCreatePoll(question, options);
      setQuestion('');
      setOptions(['', '']);
    };
  
    return (
      <form onSubmit={handleSubmit} className="my-4 p-4 border rounded-lg bg-gray-200">
        <h3 className="text-xl font-bold mb-2">Create New Poll</h3>
        <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Poll Question" className="w-full p-2 border rounded-lg mb-2" required />
        {options.map((option, index) => (
          <input key={index} type="text" value={option} onChange={(e) => handleOptionChange(index, e.target.value)} placeholder={`Option ${index + 1}`} className="w-full p-2 border rounded-lg mb-2" required />
        ))}
        <button type="button" onClick={addOption} className="mr-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Add Option</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Poll</button>
      </form>
    );
  };

  const Poll = ({ poll, onVote }) => {
    const totalVotes = poll.votes.reduce((sum, vote) => sum + vote, 0);
    const userHasVoted = localStorage.getItem(`voted_${poll.id}_${auth.currentUser.uid}`);
  
    return (
      <div className="my-4 p-4 border rounded-lg bg-gray-700 text-white">
        <h3 className="text-2xl font-bold mb-4">{poll.question}</h3>
        <div className="space-y-2">
          {poll.options.map((option, index) => {
            if (userHasVoted) {
              const percentage = totalVotes === 0 ? 0 : ((poll.votes[index] / totalVotes) * 100).toFixed(1);
              return (
                <div key={index} className="p-3 bg-gray-600 rounded-lg">
                  <div className="flex justify-between">
                    <span>{option}</span>
                    <span>{percentage}% ({poll.votes[index]})</span>
                  </div>
                  <div className="w-full bg-gray-500 rounded-full h-2.5 mt-1">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            }
            return (
              <button key={index} onClick={() => onVote(poll.id, index)} className="w-full text-left p-3 bg-gray-600 hover:bg-gray-500 rounded-lg">
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <header className="w-full max-w-6xl mx-auto mb-4">
        <h1 className="text-5xl font-bold text-center text-gray-800">Ahn's Collaborative Learning App</h1>
        <div className="mt-4 flex justify-center gap-4">
            {Object.entries(dalants).map(([name, count]) => (
                <div key={name} className="text-center">
                    <p className="font-bold">{name}</p>
                    <p>{count} 달란트</p>
                </div>
            ))}
        </div>
        {!selectedCourse ? (
          <div className="flex justify-center gap-4 mt-4">
            {COURSES.map(course => <button key={course} onClick={() => handleCourseSelection(course)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">{course}</button>)}
            <button onClick={handleAdminLogin} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Admin</button>
          </div>
        ) : !studentName ? (
          <div className="mt-4">
            <h2 className="text-2xl font-semibold text-center mb-3">Select your name for {selectedCourse}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {COURSE_STUDENTS[selectedCourse].map(name => <button key={name} onClick={() => handleStudentSelection(name)} className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">{name}</button>)}
            </div>
            <div className="text-center mt-4">
              <button onClick={() => setSelectedCourse(null)} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Back to Courses</button>
            </div>
          </div>
        ) : (
          <div className="text-center mt-4">
             <button onClick={() => setStudentName(null)} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">Back to Student Selection</button>
          </div>
        )}
      </header>

      {selectedCourse && studentName && <MainContent />}

      <footer className="w-full text-center mt-4">
        <p className="text-gray-600">&copy; {new Date().getFullYear()} Ahn's App. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;