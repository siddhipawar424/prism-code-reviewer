import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Sparkles, Bot, Copy, Check, Clock, Trash2,
  X, Loader2, FileCode, ShieldAlert, Zap, BookOpen,
  Bug, GitCompare, ChevronDown, ChevronUp, Moon, Sun,
  Cpu, Layers,
} from "lucide-react";
import "./CodeReviewer.css";

/* ── Constants ── */
const API = "http://localhost:5000";

const LANGUAGES = [
  { value: "javascript", label: "JavaScript", ext: "js" },
  { value: "typescript", label: "TypeScript", ext: "ts" },
  { value: "python",     label: "Python",     ext: "py" },
  { value: "java",       label: "Java",       ext: "java" },
  { value: "cpp",        label: "C++",        ext: "cpp" },
  { value: "go",         label: "Go",         ext: "go" },
  { value: "rust",       label: "Rust",       ext: "rs" },
  { value: "php",        label: "PHP",        ext: "php" },
  { value: "ruby",       label: "Ruby",       ext: "rb" },
  { value: "swift",      label: "Swift",      ext: "swift" },
  { value: "kotlin",     label: "Kotlin",     ext: "kt" },
  { value: "sql",        label: "SQL",        ext: "sql" },
  { value: "bash",       label: "Bash",       ext: "sh" },
  { value: "html",       label: "HTML",       ext: "html" },
  { value: "css",        label: "CSS",        ext: "css" },
];

const TECH_PILLS = [
  "JavaScript","TypeScript","Python","Rust","Go","Java","C++","Swift","Kotlin",
  "PHP","Ruby","SQL","Bash","HTML","CSS","React","Next.js","Node.js",
  "JavaScript","TypeScript","Python","Rust","Go","Java","C++","Swift","Kotlin",
  "PHP","Ruby","SQL","Bash","HTML","CSS","React","Next.js","Node.js",
];

const SEV_CONFIG = {
  critical: { color: "sev-critical", label: "Critical" },
  warning:  { color: "sev-warning",  label: "Warning"  },
  info:     { color: "sev-info",     label: "Info"     },
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function scoreColor(score) {
  if (score >= 80) return "score-green";
  if (score >= 60) return "score-yellow";
  if (score >= 40) return "score-orange";
  return "score-red";
}
function ringColor(score) {
  if (score >= 80) return "ring-green";
  if (score >= 60) return "ring-yellow";
  if (score >= 40) return "ring-orange";
  return "ring-red";
}

/* ══════════════════════════════════════
   CIRCULAR SCORE RING
══════════════════════════════════════ */
function CircularRing({ score }) {
  const [animated, setAnimated] = useState(false);
  const circumference = 220; // ~2π × 35
  const offset = animated ? circumference - (score / 100) * circumference : circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [score]);

  const rClass = ringColor(score);

  return (
    <div className={`circular-ring ${rClass}`}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <defs>
          <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669"/>
            <stop offset="100%" stopColor="#34d399"/>
          </linearGradient>
          <linearGradient id="grad-yellow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97706"/>
            <stop offset="100%" stopColor="#fbbf24"/>
          </linearGradient>
          <linearGradient id="grad-orange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ea580c"/>
            <stop offset="100%" stopColor="#fb923c"/>
          </linearGradient>
          <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626"/>
            <stop offset="100%" stopColor="#f87171"/>
          </linearGradient>
        </defs>
        <circle className="ring-track" cx="40" cy="40" r="35" />
        <circle
          className="ring-fill"
          cx="40" cy="40" r="35"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-label">
        <span className="ring-num">{score}</span>
        <span className="ring-denom">/100</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   SYNTAX HIGHLIGHTER (lightweight token-based)
══════════════════════════════════════ */
function tokenize(code, language) {
  const rules = [];

  if (["javascript","typescript","java","cpp","go","rust","kotlin","swift"].includes(language)) {
    rules.push(
      { re: /(\/\/[^\n]*)/, cls: "tok-comment" },
      { re: /(\/\*[\s\S]*?\*\/)/, cls: "tok-comment" },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/, cls: "tok-string" },
      { re: /\b(const|let|var|function|return|if|else|for|while|class|import|export|default|new|this|async|await|try|catch|throw|typeof|instanceof|extends|static|public|private|protected|void|int|float|double|string|bool|boolean|null|undefined|true|false|type|interface|enum|struct|fn|mut|impl|use|mod|self|super|match|loop|break|continue|switch|case)\b/, cls: "tok-keyword" },
      { re: /\b([A-Z][A-Za-z0-9_]*)/, cls: "tok-type" },
      { re: /\b([a-z_][a-zA-Z0-9_]*)\s*(?=\()/, cls: "tok-fn" },
      { re: /\b(\d+\.?\d*)\b/, cls: "tok-number" },
      { re: /([{}[\]().,;:=<>!&|+\-*/%^~])/, cls: "tok-punct" },
    );
  } else if (language === "python") {
    rules.push(
      { re: /(#[^\n]*)/, cls: "tok-comment" },
      { re: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/, cls: "tok-string" },
      { re: /\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|pass|break|continue|lambda|yield|async|await|True|False|None|and|or|not|in|is)\b/, cls: "tok-keyword" },
      { re: /\b([A-Z][A-Za-z0-9_]*)/, cls: "tok-type" },
      { re: /\b([a-z_][a-zA-Z0-9_]*)\s*(?=\()/, cls: "tok-fn" },
      { re: /\b(\d+\.?\d*)\b/, cls: "tok-number" },
    );
  } else if (["html","css"].includes(language)) {
    rules.push(
      { re: /(<!--[\s\S]*?-->)/, cls: "tok-comment" },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/, cls: "tok-string" },
      { re: /(<\/?[a-zA-Z][a-zA-Z0-9-]*)/, cls: "tok-keyword" },
      { re: /\b(\d+\.?\d*(?:px|em|rem|%|vh|vw|s|ms)?)/, cls: "tok-number" },
      { re: /(#[0-9a-fA-F]{3,8})/, cls: "tok-string" },
    );
  } else {
    rules.push(
      { re: /(#[^\n]*)/, cls: "tok-comment" },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/, cls: "tok-string" },
      { re: /\b(\d+\.?\d*)\b/, cls: "tok-number" },
    );
  }

  // Tokenize into spans
  let remaining = code;
  const parts = [];

  while (remaining.length > 0) {
    let matched = false;
    for (const { re, cls } of rules) {
      const fullRe = new RegExp(re.source);
      const m = remaining.match(fullRe);
      if (m && m.index === 0) {
        parts.push(<span key={parts.length} className={cls}>{m[0]}</span>);
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // plain char
      const last = parts[parts.length - 1];
      if (last && last.props.className === "tok-plain") {
        parts[parts.length - 1] = (
          <span key={last.key} className="tok-plain">{last.props.children + remaining[0]}</span>
        );
      } else {
        parts.push(<span key={parts.length} className="tok-plain">{remaining[0]}</span>);
      }
      remaining = remaining.slice(1);
    }
  }

  return parts;
}

/* ══════════════════════════════════════
   DIFF VIEW
══════════════════════════════════════ */
function DiffView({ original, optimized, language }) {
  const origLines = original.split("\n");
  const optLines  = optimized.split("\n");
  const [tab, setTab] = useState("diff");

  const shStyle = { borderRadius:"12px", fontSize:"13px", margin:0, background:"transparent" };

  return (
    <div className="diff-container">
      <div className="diff-tabs">
        {["diff","original","optimized"].map(t => (
          <button key={t} className={`diff-tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
            {t === "diff" ? "Diff" : t === "original" ? "Original" : "Optimized"}
          </button>
        ))}
      </div>
      <div className="diff-body">
        {tab === "original" && (
          <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={shStyle}>{original}</SyntaxHighlighter>
        )}
        {tab === "optimized" && (
          <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={shStyle}>{optimized}</SyntaxHighlighter>
        )}
        {tab === "diff" && (
          <div className="diff-lines">
            {origLines.map((line, i) => !optLines.includes(line) && (
              <div key={`r${i}`} className="diff-line removed">
                <span className="diff-sign">−</span>
                <span className="diff-text">{line || " "}</span>
              </div>
            ))}
            {optLines.map((line, i) => {
              const inOrig = origLines.includes(line);
              return inOrig ? (
                <div key={`s${i}`} className="diff-line same">
                  <span className="diff-sign"> </span>
                  <span className="diff-text">{line || " "}</span>
                </div>
              ) : (
                <div key={`a${i}`} className="diff-line added">
                  <span className="diff-sign">+</span>
                  <span className="diff-text">{line || " "}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Issue card ── */
function IssueCard({ item, hasSeverity }) {
  const [open, setOpen] = useState(false);
  const sev = hasSeverity ? SEV_CONFIG[item.severity] || SEV_CONFIG.info : null;
  const shStyle = { borderRadius:"8px", fontSize:"13px", margin:0, marginTop:8, padding:"10px 14px", border:"1px solid rgba(255,255,255,0.07)", background:"transparent" };

  return (
    <div className={`issue-card ${sev ? sev.color : ""}`}>
      <div className="issue-header" onClick={() => setOpen(o => !o)}>
        <div className="issue-left">
          {sev && <span className={`sev-badge ${sev.color}`}>{sev.label}</span>}
          <span className="issue-title">{item.title}</span>
        </div>
        {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="issue-body"
            initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}}
            exit={{height:0,opacity:0}} transition={{duration:0.2}}
          >
            <p>{item.description}</p>
            {item.snippet && (
              <SyntaxHighlighter style={vscDarkPlus} customStyle={shStyle}>{item.snippet}</SyntaxHighlighter>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Section ── */
function Section({ icon: Icon, title, items, hasSeverity, emptyMsg }) {
  if (!items?.length) return (
    <div className="section">
      <div className="section-header">
        <Icon size={16}/><h3>{title}</h3>
        <span className="section-count section-count-empty">0</span>
      </div>
      <p className="section-empty">{emptyMsg}</p>
    </div>
  );
  return (
    <div className="section">
      <div className="section-header">
        <Icon size={16}/><h3>{title}</h3>
        <span className="section-count">{items.length}</span>
      </div>
      <div className="issue-list">
        {items.map((item, i) => <IssueCard key={i} item={item} hasSeverity={hasSeverity}/>)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   HERO SECTION
══════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-eyebrow">
        <Cpu size={11} /> AI-Powered Code Intelligence
      </div>
      <h1 className="hero-title">
        <span className="word">Write&nbsp;</span>
        <span className="word">Better&nbsp;</span>
        <span className="word">Code&nbsp;</span>
        <span className="word">with&nbsp;</span>
        <span className="word">Prism</span>
      </h1>
      <p className="hero-sub">
        Instant AI code reviews - bugs, security vulnerabilities, performance issues,
        and best practices. All in seconds.
      </p>
      <div className="tech-strip">
        <div className="tech-track">
          {TECH_PILLS.map((t, i) => <span key={i} className="tech-pill">{t}</span>)}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════
   DARK MODE TOGGLE
══════════════════════════════════════ */
function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="theme-toggle" onClick={onToggle} title="Toggle theme">
      {theme === "soft" ? <Sun size={12}/> : <Moon size={12}/>}
      <div className="toggle-track">
        <div className="toggle-thumb"/>
      </div>
      <span>{theme === "soft" ? "Soft" : "Ultra Dark"}</span>
    </button>
  );
}

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export default function CodeReviewer() {
  const [code, setCode]           = useState("");
  const [language, setLanguage]   = useState("javascript");
  const [review, setReview]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [history, setHistory]     = useState([]);
  const [sidebarOpen, setSidebar] = useState(false);
  const [deletingId, setDeleting] = useState(null);
  const [activeId, setActiveId]   = useState(null);
  const [activeTab, setActiveTab] = useState("review");
  const [theme, setTheme]         = useState("dark"); // "dark" | "soft"
  const textareaRef = useRef(null);
  const syntaxRef   = useRef(null);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "soft" ? "soft" : "");
  }, [theme]);

  useEffect(() => { fetchHistory(); }, []);

  // Sync syntax layer scroll with textarea
  const syncScroll = useCallback(() => {
    if (textareaRef.current && syntaxRef.current) {
      syntaxRef.current.scrollTop  = textareaRef.current.scrollTop;
      syntaxRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  async function fetchHistory() {
    try {
      const { data } = await axios.get(`${API}/api/history`);
      setHistory(data);
    } catch (e) { console.error(e); }
  }

  async function reviewCode() {
    if (!code.trim()) return;
    setLoading(true); setReview(null); setActiveId(null);
    try {
      const { data } = await axios.post(`${API}/api/review`, { code, language });
      setReview(data.review);
      setActiveId(data._id);
      setActiveTab("review");
      fetchHistory();
    } catch (e) {
      console.error(e);
      alert("Backend error — check console");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(item) {
    setSidebar(false);
    if (item._id === activeId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/history/${item._id}`);
      setCode(data.code);
      setLanguage(data.language || "javascript");
      setReview(data.review);
      setActiveId(data._id);
      setActiveTab("review");
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function deleteItem(e, id) {
    e.stopPropagation();
    setDeleting(id);
    try {
      await axios.delete(`${API}/api/history/${id}`);
      setHistory(h => h.filter(i => i._id !== id));
      if (activeId === id) { setReview(null); setCode(""); setActiveId(null); }
    } catch (e) { console.error(e); }
    finally { setDeleting(null); }
  }

  function copyOptimized() {
    if (!review?.optimizedCode) return;
    navigator.clipboard.writeText(review.optimizedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleTab(e) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const { selectionStart: s, selectionEnd: en } = e.target;
    const next = code.slice(0, s) + "  " + code.slice(en);
    setCode(next);
    setTimeout(() => {
      textareaRef.current.selectionStart = s + 2;
      textareaRef.current.selectionEnd   = s + 2;
    }, 0);
  }

  const selLang = LANGUAGES.find(l => l.value === language);
  const highlighted = code ? tokenize(code, language) : null;

  return (
    <div className="app-root">
      <div className="blob blob-1"/><div className="blob blob-2"/><div className="blob blob-3"/>

      <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === "dark" ? "soft" : "dark")} />

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div className="overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSidebar(false)}/>
            <motion.aside className="sidebar" initial={{x:"-100%"}} animate={{x:0}} exit={{x:"-100%"}} transition={{type:"spring",stiffness:300,damping:30}}>
              <div className="sidebar-hd">
                <div className="sidebar-title"><Clock size={16}/><span>History</span></div>
                <button className="icon-btn" onClick={()=>setSidebar(false)}><X size={16}/></button>
              </div>
              <div className="sidebar-list">
                {history.length === 0
                  ? <div className="sb-empty"><FileCode size={28} opacity={0.3}/><p>No reviews yet</p></div>
                  : history.map(item => (
                    <motion.div key={item._id} className={`sb-item ${activeId===item._id?"sb-active":""}`} onClick={()=>loadHistory(item)} whileHover={{x:3}}>
                      <div className="sb-top">
                        <span className="lang-badge">{item.language}</span>
                        {item.review?.quality && (
                          <span className={`sb-score ${scoreColor(item.review.quality.score)}`}>{item.review.quality.score}</span>
                        )}
                        <span className="sb-time">{timeAgo(item.createdAt)}</span>
                      </div>
                      {item.review?.quality && (
                        <p className="sb-label">{item.review.quality.label} · {item.review.quality.summary?.slice(0,60)}…</p>
                      )}
                      <button className="del-btn" onClick={e=>deleteItem(e,item._id)} disabled={deletingId===item._id}>
                        {deletingId===item._id ? <Loader2 size={12} className="spin"/> : <Trash2 size={12}/>}
                      </button>
                    </motion.div>
                  ))
                }
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Hero */}
      <HeroSection />

      {/* Layout */}
      <div className="layout">

        {/* LEFT — Editor */}
        <motion.div className="panel" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.45}}>
          <div className="panel-top">
            <div className="logo-row">
              <div className="logo-icon"><Layers size={20}/></div>
              <div>
                <h1>Prism</h1>
                <p className="dim">AI Code Reviewer</p>
              </div>
            </div>
            <button className="hist-btn" onClick={()=>setSidebar(true)}>
              <Clock size={14}/>
              <span className="hist-count">{history.length}</span>
            </button>
          </div>

          {/* Language */}
          <div className="lang-row">
            <label className="lang-label">Language</label>
            <div className="lang-wrap">
              <select className="lang-select" value={language} onChange={e=>setLanguage(e.target.value)}>
                {LANGUAGES.map(l=><option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <span className="ext-badge">.{selLang?.ext}</span>
            </div>
          </div>

          {/* Syntax-highlighted Editor */}
          <div className="editor-box">
            <div className="editor-bar">
              <div className="dots"><span/><span/><span/></div>
              <span className="filename">main.{selLang?.ext}</span>
            </div>
            <div className="editor-body">
              <div className="line-nums" aria-hidden="true">
                {(code || " ").split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}
              </div>
              {/* Syntax overlay */}
              {highlighted && (
                <div className="syntax-layer" ref={syntaxRef} aria-hidden="true">
                  {highlighted}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className="code-ta"
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={handleTab}
                onScroll={syncScroll}
                placeholder="// Paste your code here…"
                spellCheck={false}
              />
            </div>
          </div>

          <motion.button
            className="review-btn"
            whileHover={{scale:1.02}} whileTap={{scale:0.97}}
            onClick={reviewCode}
            disabled={loading || !code.trim()}
          >
            {loading
              ? <><Loader2 size={16} className="spin"/>Analyzing…</>
              : <><Sparkles size={16}/>Review Code</>
            }
          </motion.button>
        </motion.div>

        {/* RIGHT — Results */}
        <motion.div className="panel right-panel" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.45,delay:0.08}}>
          <div className="results-hd">
            <div className="results-title"><Bot size={20}/><h2>Analysis</h2></div>
            {review && (
              <div className="results-actions">
                <button className={`tab-btn ${activeTab==="review"?"tab-active":""}`} onClick={()=>setActiveTab("review")}>Review</button>
                <button className={`tab-btn ${activeTab==="diff"?"tab-active":""}`} onClick={()=>setActiveTab("diff")}><GitCompare size={13}/>Diff</button>
                <button className="copy-btn" onClick={copyOptimized}>
                  {copied?<Check size={13}/>:<Copy size={13}/>}{copied?"Copied":"Copy Fixed"}
                </button>
              </div>
            )}
          </div>

          <div className="results-body">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="load" className="state-center" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                  <div className="pulse-ring"/><div className="pulse-ring d1"/><div className="pulse-ring d2"/>
                  <p className="dim" style={{marginTop:70}}>Analyzing your {language} code…</p>
                </motion.div>
              ) : !review ? (
                <motion.div key="empty" className="state-center" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                  <Bot size={36} opacity={0.18}/>
                  <p style={{color:"var(--text-muted)",marginTop:12}}>Your analysis will appear here</p>
                  <span className="dim">Paste code on the left → Review Code</span>
                </motion.div>
              ) : activeTab === "diff" ? (
                <motion.div key="diff" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                  {review.diffSummary && <p className="diff-summary">{review.diffSummary}</p>}
                  <DiffView original={code} optimized={review.optimizedCode || code} language={language}/>
                </motion.div>
              ) : (
                <motion.div key="review" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="review-content">

                  {/* Score card with circular ring */}
                  {review.quality && (
                    <div className={`score-card ${scoreColor(review.quality.score)}`}>
                      <CircularRing score={review.quality.score}/>
                      <div className="score-right">
                        <div className="score-label">{review.quality.label}</div>
                        <div className="score-bar-wrap">
                          <motion.div
                            className={`score-bar ${scoreColor(review.quality.score)}`}
                            initial={{width:0}}
                            animate={{width:`${review.quality.score}%`}}
                            transition={{duration:0.9,ease:"easeOut"}}
                          />
                        </div>
                        <p className="score-summary">{review.quality.summary}</p>
                      </div>
                    </div>
                  )}

                  <Section icon={Bug}         title="Bugs & Errors"  items={review.bugs}          hasSeverity emptyMsg="No bugs detected — nice!" />
                  <Section icon={ShieldAlert} title="Security"       items={review.security}      hasSeverity emptyMsg="No security issues found." />
                  <Section icon={Zap}         title="Performance"    items={review.performance}   hasSeverity={false} emptyMsg="No performance concerns." />
                  <Section icon={BookOpen}    title="Best Practices" items={review.bestPractices} hasSeverity={false} emptyMsg="Best practices look good." />

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}