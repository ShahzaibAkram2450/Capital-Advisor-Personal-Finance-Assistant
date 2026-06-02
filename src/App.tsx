import { useState, useEffect, useMemo, useRef } from "react";
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { 
  collection, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from "firebase/firestore";
import Markdown from "react-markdown";

import { 
  auth, 
  db, 
  loginWithGoogle, 
  logoutUser, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { Transaction, Budget, ChatMessage, UserProfile } from "./types";
import { mockTransactions } from "./mockTransactions";
import { parseFinancialCSV } from "./CSVParser";

// Imported Components
import FinanceCharts from "./components/FinanceCharts";
import ReceiptScanner from "./components/ReceiptScanner";
import ContextEditor from "./components/ContextEditor";

// Lucide Icons
import {
  Wallet,
  LogOut,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Upload,
  ArrowDownCircle,
  ArrowUpCircle,
  HelpCircle,
  Clock,
  Shield,
  MessageSquare,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  FlameKindling
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Database core states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [customContext, setCustomContext] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Navigation tab switcher state
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "receipt" | "settings">("dashboard");

  // Onboarding loading animation states
  const [populating, setPopulating] = useState(false);

  // Manual transaction inputs
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTxDate, setNewTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTxMerchant, setNewTxMerchant] = useState("");
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxCategory, setNewTxCategory] = useState("Groceries");
  const [newTxIsExpense, setNewTxIsExpense] = useState(true);

  // Custom visual sandbox modal bypasses (solves window.confirm/alert sandbox blockages)
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  const [showClearDbConfirm, setShowClearDbConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState<string | null>(null);

  // Sign up/Login custom state managers
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Assistant queries input
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSearchLinks, setChatSearchLinks] = useState<{ url: string; title: string }[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // CSV Drag and drop / file selector
  const [csvDrag, setCsvDrag] = useState(false);
  const [csvResult, setCsvResult] = useState<{ added: number; dupes: number } | null>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  // 1. Firebase Authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  // 2. Real-time Firebase Database synchronizers (snapshot listeners)
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setBudgets([]);
      setCustomContext("");
      setChatHistory([]);
      return;
    }

    const uid = user.uid;

    // A. Sync Transactions
    const txQuery = query(
      collection(db, "users", uid, "transactions"), 
      orderBy("date", "desc")
    );
    const unsubTx = onSnapshot(txQuery, (snap) => {
      const list: Transaction[] = [];
      snap.forEach(d => list.push(d.data() as Transaction));
      setTransactions(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${uid}/transactions`);
    });

    // B. Sync Budgets
    const budgetQuery = query(collection(db, "users", uid, "budgets"));
    const unsubBudget = onSnapshot(budgetQuery, (snap) => {
      const list: Budget[] = [];
      snap.forEach(d => list.push(d.data() as Budget));
      setBudgets(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${uid}/budgets`);
    });

    // C. Sync Custom rules context profile
    const unsubContext = onSnapshot(doc(db, "users", uid, "profiles", "info"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setCustomContext(data.customContext || "");
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${uid}/profiles/info`);
    });

    // D. Sync ChatHistory logs
    const chatQuery = query(
      collection(db, "users", uid, "chats"),
      orderBy("timestamp", "asc")
    );
    const unsubChat = onSnapshot(chatQuery, (snap) => {
      const list: ChatMessage[] = [];
      snap.forEach(d => list.push(d.data() as ChatMessage));
      setChatHistory(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${uid}/chats`);
    });

    return () => {
      unsubTx();
      unsubBudget();
      unsubContext();
      unsubChat();
    };
  }, [user]);

  // Scroll to bottom of chat logs when new assistants messages are mapped
  useEffect(() => {
    if (activeTab === "chat") {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, activeTab]);

  // Auth logins trigger
  async function handleLogin() {
    try {
      setAuthError(null);
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setAuthError(err?.message || "Google Sign-In failed.");
    }
  }

  // Brand-new email authentication (sign-up & sign-in matching perfectly)
  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      setAuthError("Please fill out both your email and password.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    setAuthLoading(true);
    try {
      if (authTab === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      let localizedError = err?.message || "Authentication attempt failed. Please check your credentials.";
      if (err?.code === "auth/email-already-in-use") {
        localizedError = "This email is already linked to another account.";
      } else if (err?.code === "auth/invalid-email") {
        localizedError = "Invalid email format.";
      } else if (err?.code === "auth/weak-password") {
        localizedError = "The chosen password is too weak.";
      } else if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found") {
        localizedError = "Incorrect email or password credential.";
      }
      setAuthError(localizedError);
    } finally {
      setAuthLoading(false);
    }
  }

  // Instant sandbox bypass using Firebase Anonymous Authentication for full persistence
  async function handleGuestLogin() {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error(err);
      setAuthError(err?.message || "Could not instantiate an anonymous sandbox session.");
    } finally {
      setAuthLoading(false);
    }
  }

  // Prepopulate Firestore with standard simulation metrics in 1-Click
  async function populateSimulationData() {
    if (!user) return;
    setPopulating(true);
    const uid = user.uid;
    const batch = writeBatch(db);

    try {
      // 1. Commit simulation transactions
      mockTransactions.forEach((tx) => {
        const txRef = doc(db, "users", uid, "transactions", tx.id);
        batch.set(txRef, {
          ...tx,
          userId: uid
        });
      });

      // 2. Commit standard budgets
      const standardBudgets = [
        { id: "b-groceries", category: "Groceries", limit: 350 },
        { id: "b-dining", category: "Dining & Cafes", limit: 150 },
        { id: "b-rent", category: "Rent & Housing", limit: 1500 },
        { id: "b-subs", category: "Subscriptions & Bills", limit: 100 }
      ];

      standardBudgets.forEach((b) => {
        const bRef = doc(db, "users", uid, "budgets", b.id);
        batch.set(bRef, {
          id: b.id,
          userId: uid,
          category: b.category,
          limit: b.limit,
          updatedAt: new Date().toISOString()
        });
      });

      // 3. Commit default instructions custom profile
      const profRef = doc(db, "users", uid, "profiles", "info");
      batch.set(profRef, {
        userId: uid,
        customContext: "I get paid on the 1st of every month. I want to limit my weekly grocery spending strictly. Please exclude apartment Rent and Utilities from my normal grocery limits.",
        updatedAt: new Date().toISOString()
      });

      // 4. Commit a friendly welcome chat introducing the assistant features
      const welcomeRef = doc(db, "users", uid, "chats", "welcome-msg");
      batch.set(welcomeRef, {
        id: "welcome-msg",
        userId: uid,
        role: "model",
        content: "Hi there! I am your visual Personal Finance Assistant. 🧠💸\n\nI have pre-populated your personal dashboard with a realistic multi-month simulation ledger containing monthly salaries, rent expenses, streaming subscriptions, and visual shopping trends. \n\nYou can ask me questions about your monthly budgets, recurring bills, or ask me for advice on where to trim expenses to save more capital. Go ahead, ask me a query!",
        timestamp: new Date().toISOString()
      });

      await batch.commit();
    } catch (err) {
      console.error("Simulation Populate Error: ", err);
    } finally {
      setPopulating(false);
    }
  }

  // Clear simulated database records for clean restart
  async function clearDatabase() {
    if (!user) return;
    
    const uid = user.uid;
    const batch = writeBatch(db);

    try {
      transactions.forEach(t => {
        batch.delete(doc(db, "users", uid, "transactions", t.id));
      });
      budgets.forEach(b => {
        batch.delete(doc(db, "users", uid, "budgets", b.id));
      });
      chatHistory.forEach(c => {
        batch.delete(doc(db, "users", uid, "chats", c.id));
      });
      batch.delete(doc(db, "users", uid, "profiles", "info"));

      await batch.commit();
    } catch (err) {
      console.error(err);
    } finally {
      setShowClearDbConfirm(false);
    }
  }

  // Add individual transaction manually
  async function handleAddTransactionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    let amount = parseFloat(newTxAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (!newTxIsExpense) {
      // Income is negative float in statistical ledgers
      amount = -amount;
    }

    const uid = user.uid;
    const txId = `manual-${Date.now()}`;
    const txRef = doc(db, "users", uid, "transactions", txId);

    const payload: Transaction = {
      id: txId,
      userId: uid,
      date: newTxDate,
      merchant: newTxMerchant || "Manual Charge",
      amount,
      category: newTxCategory,
      source: "Manual",
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(txRef, payload);
      // reset forms
      setNewTxMerchant("");
      setNewTxAmount("");
      setShowAddModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transactions/${txId}`);
    }
  }

  // Delete individual transaction from list
  async function handleDeleteTransaction(txId: string) {
    if (!user) return;
    const uid = user.uid;
    try {
      await deleteDoc(doc(db, "users", uid, "transactions", txId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/transactions/${txId}`);
    }
  }

  // Create or Update background instructions memory profile
  async function handleSaveMemoryContext(text: string) {
    if (!user) return;
    const uid = user.uid;
    try {
      await setDoc(doc(db, "users", uid, "profiles", "info"), {
        userId: uid,
        customContext: text,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/profiles/info`);
    }
  }

  // Create or Update category budget limits
  async function handleSaveBudgetLimit(category: string, limit: number) {
    if (!user) return;
    const uid = user.uid;
    const budgetId = `b-${category.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    try {
      await setDoc(doc(db, "users", uid, "budgets", budgetId), {
        id: budgetId,
        userId: uid,
        category,
        limit,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/budgets/${budgetId}`);
    }
  }

  // Trigger conversational query call to Server Gemini API proxy
  async function handleSendAssistantMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !user || chatLoading) return;

    const uid = user.uid;
    const queryText = chatInput;
    setChatInput("");
    setChatLoading(true);
    setChatSearchLinks([]);

    const userMsgId = `m-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      userId: uid,
      role: "user",
      content: queryText,
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Write user query immediately to keep UI highly reactive
      await setDoc(doc(db, "users", uid, "chats", userMsgId), userMsg);

      // 2. Query Gemini full-stack AI advisor API endpoint
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          message: queryText,
          history: chatHistory,
          transactions,
          budgets,
          customContext
        })
      });

      if (!res.ok) {
        let errMsg = `AI Request Failed (Server Status: ${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.error) {
            errMsg = `${errMsg}: ${errData.error}`;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const backendData = await res.json();
      
      // 3. Write Advisor Gemini Model response to database
      const modelMsgId = `m-${Date.now() + 1}`;
      const modelMsg: ChatMessage = {
        id: modelMsgId,
        userId: uid,
        role: "model",
        content: backendData.content,
        timestamp: new Date().toISOString()
      };

      await setDoc(doc(db, "users", uid, "chats", modelMsgId), modelMsg);
      if (backendData.searchLinks?.length) {
        setChatSearchLinks(backendData.searchLinks);
      }
    } catch (err: any) {
      console.error(err);
      // Save error message log
      const errId = `m-${Date.now() + 1}`;
      await setDoc(doc(db, "users", uid, "chats", errId), {
        id: errId,
        userId: uid,
        role: "model",
        content: `Error details: ${err?.message || "I encountered a full-stack connection error. Ensure your server-side GEMINI_API_KEY secret is loaded correctly in settings."}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setChatLoading(false);
    }
  }

  // CSV file drag & selector event hooks
  function handleCsvDrag(e: React.DragEvent) {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") setCsvDrag(true);
    else if (e.type === "dragleave") setCsvDrag(false);
  }

  function handleCsvDrop(e: React.DragEvent) {
    e.preventDefault();
    setCsvDrag(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  }

  function handleCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      processCsvFile(e.target.files[0]);
    }
  }

  function downloadSampleCSV() {
    const headers = "Date,Merchant,Amount,Category,Source\n";
    const rows = [
      "2026-05-15,Uber* Trip Convenience,22.80,Transport & Travel,CSV\n",
      "2026-05-24,Trader Joe's,64.92,Groceries,CSV\n",
      "2026-05-28,City Transit Subway,35.00,Transport & Travel,CSV\n",
      "2026-05-30,Target Stores Retail,112.50,Shopping & Retail,CSV\n",
      "2026-06-01,Apartment Management Group,1450.00,Rent & Housing,CSV\n",
      "2026-06-02,MOMENTUM*RETAIL GROUP NY,432.50,Miscellaneous,CSV\n"
    ].join("");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my_sample_transactions.csv";
    a.click();
  }

  async function processCsvFile(file: File) {
    if (!user) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const csvText = reader.result as string;
      const parseResult = parseFinancialCSV(csvText, transactions);

      if (parseResult.errors.length) {
        setCustomAlert(`CSV Error: ${parseResult.errors[0]}`);
        return;
      }

      if (parseResult.transactions.length === 0) {
        setCsvResult({ added: 0, dupes: parseResult.duplicateCount });
        return;
      }

      // Write parsed list in batches to Firestore
      const uid = user.uid;
      const batch = writeBatch(db);
      
      parseResult.transactions.forEach((tx) => {
        const txRef = doc(db, "users", uid, "transactions", tx.id);
        batch.set(txRef, {
          ...tx,
          userId: uid
        });
      });

      try {
        await batch.commit();
        setCsvResult({ added: parseResult.addedCount, dupes: parseResult.duplicateCount });
        setTimeout(() => setCsvResult(null), 4000);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}/transactions`);
      }
    };
    reader.readAsText(file);
  }

  // Compute total balance sheets for budget displays
  const currentMonthSpends = useMemo(() => {
    // Standard June 2026 filter
    const searchMonth = "2026-06";
    const totals: { [cat: string]: number } = {};
    transactions
      .filter(t => t.date?.startsWith(searchMonth) && t.amount > 0 && t.category !== "Income")
      .forEach(t => {
        totals[t.category] = (totals[t.category] || 0) + t.amount;
      });
    return totals;
  }, [transactions]);

  // Auth / Loading Splash Screen
  if (loadingAuth) {
    return (
      <div id="loading-auth" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-5">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
          <Wallet className="w-4 h-4 text-blue-600 absolute animate-pulse-gentle" />
        </div>
        <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-display">Securing private financial vault...</p>
      </div>
    );
  }

  // NO LOGGED USER (Welcome, introducing Auth popup sign-in options & Try Demo instantly)
  if (!user) {
    return (
      <div id="guest-splash" className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans overflow-x-hidden">
        
        {/* Left column: Visual Presentation & App Demonstration mockup (60% width on large screens) */}
        <div className="hidden lg:flex lg:w-[58%] xl:w-[62%] bg-slate-50 text-slate-800 flex-col justify-between p-12 xl:p-16 relative overflow-hidden border-r border-slate-250/70">
          {/* Ambient light grids matching light dashboard */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_25%,rgba(59,130,246,0.04),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_75%,rgba(20,184,166,0.03),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.012)_1px,transparent_1px)] bg-[size:32px_32px]" />
          
          {/* Header Brand Badge */}
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/10">
              <Wallet className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 tracking-tight font-display">Capital Advisor</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-550/10 text-blue-650 border border-blue-500/15 font-extrabold tracking-widest font-display">PRO</span>
              </div>
              <span className="text-[9px] text-slate-400 block tracking-wider font-mono">SECURE FIRESTORE ENGINE</span>
            </div>
          </div>

          {/* Core Feature Demonstration Deck */}
          <div className="space-y-12 my-auto max-w-xl relative z-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-display border border-blue-100">
                <Sparkles className="w-3.5 h-3.5" />
                Gemini-Powered Intelligence
              </div>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight font-display leading-[1.15] text-slate-900">
                Understand where your capital flows.
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-lg">
                Query, cross-examine, and audit transactions in plain English. Analyze paper receipts instantly using visual AI, set smart budgets, and find hidden subscriptions before they renew.
              </p>
            </div>

            {/* Visual Sandbox Glassmorphism Mockups */}
            <div className="space-y-4 pt-4">
              
              {/* Anomaly Flag Mockup */}
              <div className="bg-white border border-slate-150 rounded-2xl p-4 flex items-start gap-4 shadow-sm animate-pulse-gentle [animation-duration:6s]">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-rose-500 tracking-wider font-display">Anomalous Activity Flagged</p>
                  <p className="text-xs font-semibold text-slate-800">Duplicate billing detected at &quot;Spotify Premium&quot;</p>
                  <p className="text-[10px] text-slate-400 font-mono">Charges of $14.99 recorded twice within 48 hours.</p>
                </div>
              </div>

              {/* Chat Interaction Mockup */}
              <div className="bg-white border border-slate-150 rounded-2xl p-4 flex items-start gap-4 shadow-sm translate-x-4">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider font-display">Capital Advisor Assistant</p>
                  <p className="text-xs italic text-slate-600 leading-relaxed font-sans font-medium">
                    &quot;Your grocery spending is up 12% compared to last May, mainly driven by larger single visits. However, your subscription bills decreased by $45.&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Elegant Footer Details */}
          <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-bold tracking-widest font-mono relative z-10 pt-4 border-t border-slate-200/60">
            <span>© 2026 CAPITAL ADVISOR</span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-550" />
              AES-256 FIREBASE REPLICATED
            </span>
          </div>

        </div>

        {/* Right column: Beautiful secure login panel (Full screen on mob, 40% on large screen) */}
        <div className="w-full lg:w-[42%] xl:w-[38%] bg-white flex flex-col justify-between p-8 sm:p-12 xl:p-16 relative">
          
          {/* Discrete mobile header */}
          <div className="flex lg:hidden justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-900 tracking-tight font-display">Capital Advisor</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[8px] bg-blue-50 text-blue-600 border border-blue-100 font-bold uppercase tracking-wider">PRO</span>
          </div>

          <div className="my-auto max-w-md w-full mx-auto space-y-6">
            {/* Header branding */}
            <div className="space-y-2 text-center lg:text-left">
              <div className="hidden lg:inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-display border border-blue-100">
                <Shield className="w-3.5 h-3.5" />
                Authorized Private Gateway
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight font-display">
                Access your secure vault
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Deploy and access your personal ledger. All calculations, budget tags and statements are securely partitioned.
              </p>
            </div>

            {/* Google Identity Authorization Panel */}
            <div className="space-y-3.5 max-w-sm mx-auto pt-4">
              {authError && (
                <div className="bg-rose-50 text-rose-600 text-[10px] p-3 rounded-xl border border-rose-100 flex items-start gap-2 animate-fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[2] mt-0.5" />
                  <span className="leading-tight font-medium">{authError}</span>
                </div>
              )}

              {/* Continue with Google Account */}
              <button
                type="button"
                onClick={handleLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl text-xs shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer"
              >
                {/* Visual custom polished White Google Icon */}
                <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" width="16" height="16">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff" opacity="0.9" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#ffffff" opacity="0.8" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#ffffff" opacity="0.9" />
                </svg>
                Continue with Google Account
              </button>
              
              <div className="flex items-center gap-1.5 text-[8px] text-slate-350 font-bold justify-center tracking-wider font-mono pt-1">
                <span>REPLICATED CLOUD STATUS</span>
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                <span>SECURED AES-256</span>
              </div>
            </div>

          </div>

          {/* Humble Mobile/Desktop Signoff */}
          <div className="text-center text-[10px] text-slate-400 font-medium">
            Protected under secure AI Studio private container environments.
          </div>

        </div>

      </div>
    );
  }

  // MAIN SECURED DASHBOARD VISUALS
  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 flex flex-col font-sans antialiased">
      
      {/* 1. Page Header Frame - Glass Backplate */}
      <header className="backdrop-blur-md bg-white/80 border-b border-slate-200/50 sticky top-0 z-40 px-4 sm:px-6 shadow-2xs">
        <div className="max-w-7xl mx-auto flex justify-between items-center h-16">
          
          {/* Logo Brand */}
          <div id="header-brand" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/10">
              <Wallet className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 tracking-tight block font-display">Capital Advisor</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-50 text-blue-600 font-extrabold tracking-widest font-display">PRO</span>
              </div>
              <span className="text-[9px] text-slate-400 block tracking-wider font-mono">SECURE FIRESTORE ENGINE</span>
            </div>
          </div>

          {/* User Account controls and Tabs */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 font-display">{user.displayName || user.email}</span>
              <span className="text-[9px] font-bold text-blue-600 tracking-wider font-mono">PRIVATE GATEWAY</span>
            </div>
            {user.photoURL && (
              <img src={user.photoURL} referrerPolicy="no-referrer" alt="User" className="w-8 h-8 rounded-full border-2 border-slate-100" />
            )}
            <button
              onClick={() => logoutUser()}
              className="text-slate-400 hover:text-rose-600 transition p-1.5 hover:bg-slate-50 rounded-lg"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main container Grid with tab switches */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Onboarding Empty Banner & Prepopulate helper */}
        {transactions.length === 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-amber-500/30 transition-all duration-300">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-800 tracking-wider uppercase flex items-center gap-1.5 font-display">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Empty Database Sandbox
              </h4>
              <p className="text-[11px] text-amber-900/80 max-w-2xl leading-relaxed">
                Ready to talk with your assistant? Connect simulated financial records spanning 4-months (salaries, subscriptions, billing anomalies) with 1-click, or upload CSV.
              </p>
            </div>
            <button
              onClick={populateSimulationData}
              disabled={populating}
              className="bg-amber-600 text-white font-bold hover:bg-amber-700 py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-sm hover:shadow active:scale-[0.99] transition cursor-pointer"
            >
              {populating ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {populating ? "Injecting simulation data..." : "Inject Simulation Data"}
            </button>
          </div>
        )}

        {/* Tab Selection Row */}
        <div className="flex border-b border-slate-200/60 gap-1 overflow-x-auto pb-px">
          {[
            { id: "dashboard", label: "Dashboard Ledger", icon: Wallet },
            { id: "chat", label: "Gemini Chat Assistant", icon: MessageSquare },
            { id: "receipt", label: "OCR Receipt Scanner", icon: Plus },
            { id: "settings", label: "Budgets & Context Rules", icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3 sm:px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap font-display uppercase tracking-wider cursor-pointer ${
                  active 
                    ? "border-blue-600 text-blue-600" 
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Dynamic Tab Panel Displays */}

        {/* PANEL A: Dashboard & Ledger */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            
            {/* Recharts Analytics frame component */}
            <FinanceCharts transactions={transactions} />

            {/* Main Transactions tables */}
            <div id="dashboard-ledger" className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden hover:shadow-sm transition-all duration-300">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wider">Recorded Transactions Statement</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Real-time visual ledger protected under your sandbox</p>
                </div>

                <div className="flex gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex-1 sm:flex-none bg-slate-950 text-white font-bold hover:bg-slate-900 py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] transition duration-150 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    Record Expense
                  </button>
                  <button
                    onClick={() => csvFileRef.current?.click()}
                    className="flex-1 sm:flex-none bg-slate-50 border border-slate-200/80 hover:bg-slate-100 hover:border-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 text-slate-700 shadow-3xs cursor-pointer transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload CSV
                  </button>
                  <input 
                    type="file" 
                    ref={csvFileRef} 
                    onChange={handleCsvFileSelect} 
                    accept=".csv" 
                    className="hidden" 
                  />
                </div>
              </div>

              {/* CSV Upload results status boxes */}
              {csvResult && (
                <div className="mx-5 my-4 p-3.5 bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 text-xs rounded-xl flex items-center justify-between font-display font-medium animate-pulse-gentle">
                  <span>Import Completed! Added <strong>{csvResult.added}</strong> items. Filtered <strong>{csvResult.dupes}</strong> duplicate entries.</span>
                  <button onClick={() => setCsvResult(null)} className="font-bold underline hover:text-emerald-950 ml-4 cursor-pointer">Dismiss</button>
                </div>
              )}

              {/* Transactions Ledger layout */}
              {transactions.length === 0 ? (
                <div className="p-14 text-center text-slate-400 text-xs space-y-2">
                  <p className="font-display font-bold text-slate-600">Your statement has no active logs.</p>
                  <p className="text-[11px] text-slate-400/80">Inject simulation datasets or drag and drop statement files above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-widest text-[9px] font-display">
                        <th className="py-3.5 px-5">Date</th>
                        <th className="py-3.5 px-4">Merchant</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Source</th>
                        <th className="py-3.5 px-4 text-right">Amount</th>
                        <th className="py-3.5 px-5 text-center w-12">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {transactions.map(tx => {
                        const isIncome = tx.amount < 0 || tx.category === "Income";
                        
                        // Premium beautiful customized category tag colors
                        const categoryColorMap: { [cat: string]: string } = {
                          "Groceries": "bg-emerald-50 text-emerald-700 border border-emerald-100/70",
                          "Dining & Cafes": "bg-orange-50 text-orange-700 border border-orange-100/70",
                          "Rent & Housing": "bg-indigo-50 text-indigo-700 border border-indigo-100/70",
                          "Subscriptions & Bills": "bg-violet-50 text-violet-700 border border-violet-100/70",
                          "Transport & Travel": "bg-amber-50 text-amber-700 border border-amber-100/70",
                          "Entertainment & Leisure": "bg-sky-50 text-sky-700 border border-sky-100/70",
                          "Shopping & Retail": "bg-pink-50 text-pink-700 border border-pink-100/70",
                          "Health & Fitness": "bg-rose-50 text-rose-700 border border-rose-100/70",
                          "Income": "bg-teal-50 text-teal-700 border border-teal-100/70",
                          "Miscellaneous": "bg-slate-50 text-slate-700 border border-slate-150"
                        };
                        const tagStyle = categoryColorMap[tx.category] || "bg-slate-50 text-slate-700 border border-slate-100";

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/50 text-slate-700 transition">
                            <td className="py-3 px-5 font-bold font-mono text-[11px] whitespace-nowrap text-slate-400">{tx.date}</td>
                            <td className="py-3 px-4 font-bold text-slate-900 truncate max-w-[200px] font-display" title={tx.merchant}>
                              {tx.merchant}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`font-semibold px-2.5 py-1 rounded-full text-[9px] border uppercase tracking-wider font-display space-x-1 ${tagStyle}`}>
                                {tx.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[10px] text-slate-400 font-bold whitespace-nowrap font-mono">{tx.source}</td>
                            <td className={`py-3 px-4 text-right font-bold whitespace-nowrap text-xs font-mono tracking-tight ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                              {isIncome ? `+$${Math.abs(tx.amount).toFixed(2)}` : `-$${tx.amount.toFixed(2)}`}
                            </td>
                            <td className="py-3 px-5 text-center">
                              <button
                                onClick={() => setTxToDelete(tx.id)}
                                className="text-slate-350 hover:text-rose-650 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* CSV Tool Tips and Download Templates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
              <div 
                onDragOver={handleCsvDrag}
                onDragEnter={handleCsvDrag}
                onDragLeave={handleCsvDrag}
                onDrop={handleCsvDrop}
                className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 ${
                  csvDrag 
                    ? "border-blue-500 bg-blue-50/30 scale-[0.99]" 
                    : "border-slate-200 hover:border-blue-400 bg-white"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="text-xs font-bold text-slate-700 font-display">Drag Statement CSV files directly</h4>
                <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Drops auto-parses, handles custom layouts (extracts amount, dates and merchant descriptions) and screens duplicates!
                </p>
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="mt-3 text-[11px] font-bold text-blue-600 hover:text-blue-800 underline block mx-auto cursor-pointer"
                >
                  Download Sample CSV Template
                </button>
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl p-8 space-y-4 shadow-3xs flex flex-col justify-center">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-display">Database Reset Controls</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Want to start your financial ledger with a clean slate? Erase your profile configs, budgets and transactions from Firestore.</p>
                <button
                  onClick={() => setShowClearDbConfirm(true)}
                  className="bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 active:scale-[0.99] hover:border-rose-200 py-2.5 px-4 rounded-xl border border-rose-100/70 transition w-fit cursor-pointer"
                >
                  Erase Database Sandbox
                </button>
              </div>
            </div>

          </div>
        )}

        {/* PANEL B: Chat Assistant */}
        {activeTab === "chat" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Memory Context Display Panel */}
            <div id="chat-contexts-panel" className="bg-white border border-slate-100 p-6 rounded-3xl space-y-4 shadow-xs h-fit hover:shadow-sm transition-all duration-300">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2 font-display">
                <Clock className="w-4 h-4 text-blue-600 stroke-[2]" />
                Assistant Memory Context
              </h3>
              
              <div className="bg-slate-50/55 p-4 rounded-2xl border border-slate-100/60 space-y-4">
                <div className="text-xs text-slate-700 space-y-1.5">
                  <span className="font-bold block text-slate-400 uppercase text-[8px] tracking-wider font-display">Active Instruction Exemptions:</span>
                  <p className="italic bg-white border border-slate-100/50 p-3 rounded-xl text-slate-600 text-[11px] leading-relaxed font-sans shadow-3xs">
                    {customContext || '"No exemptions saved. Head to Budgets tab to customize memory cycles!"'}
                  </p>
                </div>

                <div className="text-xs text-slate-700 space-y-2.5">
                  <span className="font-bold block text-slate-400 uppercase text-[8px] tracking-wider font-display">Active Category Targets:</span>
                  {budgets.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic font-sans">None configured yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {budgets.map(b => {
                        const spend = currentMonthSpends[b.category] || 0;
                        const percentage = b.limit > 0 ? (spend / b.limit) * 100 : 0;
                        const overBudget = spend > b.limit;

                        return (
                          <div key={b.category} className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                              <span className="truncate max-w-[100px] font-display">{b.category}</span>
                              <span className={overBudget ? "text-rose-600 font-bold font-mono" : "text-slate-800 font-mono"}>
                                ${spend.toFixed(0)} / ${b.limit.toFixed(0)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200/65 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full ${overBudget ? "bg-rose-500" : percentage >= 85 ? "bg-amber-500" : "bg-emerald-500"} transition-all duration-500`} 
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Conversation Console */}
            <div id="chat-conversation-panel" className="md:col-span-2 bg-white border border-slate-100 rounded-3xl flex flex-col h-[520px] shadow-xs hover:shadow-sm transition-all duration-300">
              
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="text-xs font-bold text-slate-800 font-display uppercase tracking-wider">Gemini Cognitive Agent</div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[8px] font-mono bg-slate-100 text-slate-600 uppercase font-bold tracking-wider">1.5 Flash</span>
              </div>

              {/* Chat Message Logs Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/15">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3.5 text-center p-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center animate-pulse-gentle">
                      <Sparkles className="w-6 h-6 text-blue-500" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 max-w-sm mx-auto font-display">Talk in plain English to audit balances, flag anomalies, and optimize your spending</p>
                    <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed font-mono">Try: &quot;What was my biggest purchase in June?&quot;</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatHistory.map((msg) => {
                      const isModel = msg.role === "model";
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isModel ? "justify-start" : "justify-end"} animate-fade-in`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-3xs ${
                              isModel
                                ? "bg-white border border-slate-100/70 text-slate-850 rounded-tl-none"
                                : "bg-blue-600 text-white rounded-tr-none shadow-blue-500/5 font-medium"
                            }`}
                          >
                            <span className={`block font-bold text-[8px] uppercase tracking-widest mb-1 ${isModel ? "text-blue-600" : "text-white/60"}`}>
                              {isModel ? "Capital Assistant" : "You"}
                            </span>
                            <div className="markdown-body select-text text-slate-800">
                              <Markdown>{msg.content}</Markdown>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pending state */}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-slate-100 rounded-2xl p-4 text-xs rounded-tl-none shadow-3xs">
                          <span className="block font-bold text-[8px] uppercase tracking-widest mb-2 text-blue-600 font-display">Capital Assistant</span>
                          <div className="flex items-center gap-1.5 px-1 py-0.5">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messageEndRef} />
                  </div>
                )}
              </div>

              {/* Show Search Grounding citation headers if returned */}
              {chatSearchLinks.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center gap-1.5 overflow-hidden">
                  <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0 stroke-[2.5]" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 font-display">Sources:</span>
                  <div className="flex gap-2 overflow-x-auto text-[10px] scrollbar-none">
                    {chatSearchLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-semibold inline-block truncate max-w-[150px] font-display whitespace-nowrap"
                      >
                        {link.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Input Submit Bar */}
              <form onSubmit={handleSendAssistantMessage} className="p-3 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about budgets, recurring items or merchant lookups..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-700 transition"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 font-bold py-2.5 px-5 rounded-xl text-xs transition duration-150 cursor-pointer shadow-xs active:scale-[0.98] text-white flex items-center justify-center"
                >
                  Send
                </button>
              </form>

            </div>

          </div>
        )}

        {/* PANEL C: OCR Scan Receipts */}
        {activeTab === "receipt" && (
          <div className="max-w-2xl mx-auto">
            {/* Scanned completed triggers standard recording */}
            <ReceiptScanner 
              onScanComplete={async (scannedTx) => {
                if (!user) return;
                const uid = user.uid;
                const txRef = doc(db, "users", uid, "transactions", scannedTx.id);
                try {
                  await setDoc(txRef, {
                    ...scannedTx,
                    userId: uid
                  });
                } catch (err) {
                  handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transactions/${scannedTx.id}`);
                }
              }} 
            />
          </div>
        )}

        {/* PANEL D: Budgets & Settings */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <ContextEditor
              customContext={customContext}
              onSaveContext={handleSaveMemoryContext}
              budgets={budgets}
              onSaveBudget={handleSaveBudgetLimit}
            />
          </div>
        )}

      </main>

      {/* Manual Add expense trigger modals */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-100 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl relative overflow-hidden">
            
            {/* Top border line decor */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-sky-400" />

            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 font-display uppercase tracking-wider">Record Manual Transaction</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-650 font-bold p-1 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTransactionSubmit} className="space-y-4 text-xs font-sans">
              
              <div className="flex border border-slate-200/80 rounded-xl overflow-hidden text-center font-bold p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setNewTxIsExpense(true)}
                  className={`flex-1 py-2 rounded-lg text-[10px] uppercase tracking-wider font-display transition-all cursor-pointer ${newTxIsExpense ? "bg-white text-rose-600 shadow-2xs" : "text-slate-450 hover:text-slate-700"}`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setNewTxIsExpense(false)}
                  className={`flex-1 py-2 rounded-lg text-[10px] uppercase tracking-wider font-display transition-all cursor-pointer ${!newTxIsExpense ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-450 hover:text-slate-700"}`}
                >
                  Income
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider font-display">Merchant Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starbucks Coffee"
                  value={newTxMerchant}
                  onChange={(e) => setNewTxMerchant(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-slate-700 bg-slate-50/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider font-display">Date</label>
                  <input
                    type="date"
                    required
                    value={newTxDate}
                    onChange={(e) => setNewTxDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-slate-700 bg-slate-50/20 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider font-display">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="25.50"
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-slate-700 bg-slate-50/20 font-bold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider font-display">Category Tag</label>
                {newTxIsExpense ? (
                  <select
                    value={newTxCategory}
                    onChange={(e) => setNewTxCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-slate-700"
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Dining & Cafes">Dining & Cafes</option>
                    <option value="Rent & Housing">Rent & Housing</option>
                    <option value="Subscriptions & Bills">Subscriptions & Bills</option>
                    <option value="Transport & Travel">Transport & Travel</option>
                    <option value="Entertainment & Leisure">Entertainment & Leisure</option>
                    <option value="Shopping & Retail">Shopping & Retail</option>
                    <option value="Health & Fitness">Health & Fitness</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                ) : (
                  <select
                    value={newTxCategory}
                    onChange={(e) => setNewTxCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none text-slate-700"
                  >
                    <option value="Income">Income</option>
                  </select>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-wider font-display hover:bg-blue-700 active:scale-[0.99] transition duration-150 cursor-pointer text-center-forced shadow-xs"
              >
                Approve Transaction
              </button>

            </form>
          </div>
        </div>
      )}

      {/* Delete Transaction Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-100 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
            <div className="flex gap-3.5 items-start">
              <div className="w-10 h-10 rounded-xl bg-rose-100/50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xs font-bold text-slate-800 font-display uppercase tracking-wider">Delete Purchase Log?</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  This transaction record will be removed from your Capital Advisor statement permanently. This change propagates to cloud Firestore in real-time.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 pt-1 text-[10px] uppercase font-bold tracking-wider font-display">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="flex-1 border border-slate-205 py-3 rounded-xl hover:bg-slate-50 text-slate-500 transition cursor-pointer text-center font-sans tracking-wide font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (txToDelete) {
                    handleDeleteTransaction(txToDelete);
                    setTxToDelete(null);
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white py-3 rounded-xl transition cursor-pointer text-center font-sans tracking-wide font-bold"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erase Database Sandbox Confirmation Modal */}
      {showClearDbConfirm && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-100 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
            <div className="flex gap-3.5 items-start">
              <div className="w-10 h-10 rounded-xl bg-rose-100/50 text-rose-605 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xs font-bold text-slate-800 font-display uppercase tracking-wider">Erase Financial Sandbox?</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  Are you absolutely certain you want to completely erase your simulated ledger statement history, category budget settings, custom Gemini memory profile, and past chat queries? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 pt-1 text-[10px] uppercase font-bold tracking-wider font-display font-bold">
              <button
                type="button"
                onClick={() => setShowClearDbConfirm(false)}
                className="flex-1 border border-slate-205 py-3 rounded-xl hover:bg-slate-50 text-slate-500 transition cursor-pointer text-center font-sans tracking-wide font-bold"
              >
                No, Keep Data
              </button>
              <button
                type="button"
                onClick={clearDatabase}
                className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white py-3 rounded-xl transition cursor-pointer text-center font-sans tracking-wide font-bold"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alerts Modal */}
      {customAlert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-100 p-6 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <div className="flex gap-3.5 items-start">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xs font-bold text-slate-800 font-display uppercase tracking-wider">File Processing Issue</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans font-medium">
                  {customAlert}
                </p>
              </div>
            </div>
            <div className="pt-1 text-[10px] uppercase font-bold tracking-wider font-display font-bold">
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl transition cursor-pointer text-center font-bold font-sans tracking-wide"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
