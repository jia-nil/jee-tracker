import { useState, useEffect, useRef } from "react";

const SUBJECTS = {
  Physics: {
    color: "#00d4ff",
    topics: ["Mechanics", "Thermodynamics", "Electrostatics", "Magnetism", "Optics", "Modern Physics", "Waves", "Fluid Mechanics", "Rotational Motion", "Gravitation"]
  },
  Chemistry: {
    color: "#ff6b35",
    topics: ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Electrochemistry", "Chemical Bonding", "Coordination Compounds", "Thermochemistry", "Equilibrium", "Kinetics", "p-Block Elements"]
  },
  Mathematics: {
    color: "#a855f7",
    topics: ["Calculus", "Algebra", "Coordinate Geometry", "Trigonometry", "Vectors & 3D", "Probability", "Matrices & Determinants", "Complex Numbers", "Sequences & Series", "Differential Equations"]
  }
};

const TABS = ["Dashboard", "Study Log", "Mock Tests", "Revision Plan", "AI Insights"];

function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function JEETracker() {
  const [tab, setTab] = useState("Dashboard");
  const [sessions, setSessions] = useState([
    { id: 1, subject: "Physics", topic: "Mechanics", duration: 90, date: "2026-03-01", notes: "Newton's laws, friction problems" },
    { id: 2, subject: "Mathematics", topic: "Calculus", duration: 75, date: "2026-03-02", notes: "Limits and continuity" },
    { id: 3, subject: "Chemistry", topic: "Organic Chemistry", duration: 60, date: "2026-03-03", notes: "Reactions and mechanisms" },
    { id: 4, subject: "Physics", topic: "Electrostatics", duration: 50, date: "2026-03-03", notes: "Coulomb's law, field lines" },
    { id: 5, subject: "Mathematics", topic: "Algebra", duration: 80, date: "2026-03-04", notes: "Quadratic equations" },
  ]);
  const [mockTests, setMockTests] = useState([
    { id: 1, date: "2026-02-20", name: "JEE Mock #1", physics: 68, chemistry: 55, math: 72, total: 195, maxMarks: 300 },
    { id: 2, date: "2026-03-01", name: "JEE Mock #2", physics: 74, chemistry: 61, math: 78, total: 213, maxMarks: 300 },
  ]);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [revisionPlan, setRevisionPlan] = useState(null);
  const [revisionLoading, setRevisionLoading] = useState(false);

  // Session form
  const [newSession, setNewSession] = useState({ subject: "Physics", topic: "", duration: "", notes: "" });
  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerSubject, setTimerSubject] = useState("Physics");
  const [timerTopic, setTimerTopic] = useState("");
  const timerRef = useRef(null);

  // Mock test form
  const [newMock, setNewMock] = useState({ name: "", date: "", physics: "", chemistry: "", math: "" });

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSecs(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  function stopAndSaveTimer() {
    setTimerRunning(false);
    const mins = Math.round(timerSecs / 60);
    if (mins < 1) { setTimerSecs(0); return; }
    setSessions(prev => [...prev, {
      id: Date.now(), subject: timerSubject, topic: timerTopic || "General",
      duration: mins, date: new Date().toISOString().split("T")[0], notes: "Timer session"
    }]);
    setTimerSecs(0);
  }

  function addManualSession() {
    if (!newSession.topic || !newSession.duration) return;
    setSessions(prev => [...prev, {
      id: Date.now(), ...newSession,
      duration: parseInt(newSession.duration),
      date: new Date().toISOString().split("T")[0]
    }]);
    setNewSession({ subject: "Physics", topic: "", duration: "", notes: "" });
  }

  function addMockTest() {
    if (!newMock.name || !newMock.date || !newMock.physics || !newMock.chemistry || !newMock.math) return;
    const p = parseInt(newMock.physics), c = parseInt(newMock.chemistry), m = parseInt(newMock.math);
    setMockTests(prev => [...prev, { id: Date.now(), ...newMock, physics: p, chemistry: c, math: m, total: p + c + m, maxMarks: 300 }]);
    setNewMock({ name: "", date: "", physics: "", chemistry: "", math: "" });
  }

  // Stats
  const totalBySubject = Object.keys(SUBJECTS).reduce((acc, sub) => {
    acc[sub] = sessions.filter(s => s.subject === sub).reduce((sum, s) => sum + s.duration, 0);
    return acc;
  }, {});
  const totalStudyTime = Object.values(totalBySubject).reduce((a, b) => a + b, 0);
  const latestMock = mockTests[mockTests.length - 1];
  const topicTime = sessions.reduce((acc, s) => {
    const key = `${s.subject}::${s.topic}`;
    acc[key] = (acc[key] || 0) + s.duration;
    return acc;
  }, {});

  async function callClaude(systemPrompt, userPrompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });
    const data = await response.json();
    return data.content?.map(b => b.text || "").join("") || "No response";
  }

  async function getAIInsights() {
    setAiLoading(true);
    setAiResponse("");
    try {
      const weakTopics = Object.entries(topicTime)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5)
        .map(([k]) => k.replace("::", " - "));
      const mockSummary = mockTests.map(m => `${m.name}: P=${m.physics}, C=${m.chemistry}, M=${m.math}, Total=${m.total}/300`).join("; ");
      const studySummary = Object.entries(totalBySubject).map(([s, t]) => `${s}: ${formatDuration(t)}`).join(", ");
      const res = await callClaude(
        "You are an expert JEE coaching AI. Analyze student data and give sharp, actionable feedback. Be specific, motivating, and direct. Use bullet points. Keep it under 300 words.",
        `Student study data:\n- Study time: ${studySummary}\n- Mock tests: ${mockSummary}\n- Least studied topics: ${weakTopics.join(", ")}\n\nGive: 1) Top 3 weaknesses to fix 2) What to study this week 3) One motivational insight about their JEE preparation`
      );
      setAiResponse(res);
    } catch (e) {
      setAiResponse("Error fetching AI insights. Please try again.");
    }
    setAiLoading(false);
  }

  async function generateRevisionPlan() {
    setRevisionLoading(true);
    setRevisionPlan(null);
    try {
      const studySummary = Object.entries(totalBySubject).map(([s, t]) => `${s}: ${formatDuration(t)}`).join(", ");
      const mockSummary = latestMock ? `Latest mock: P=${latestMock.physics}/100, C=${latestMock.chemistry}/100, M=${latestMock.math}/100` : "No mocks yet";
      const res = await callClaude(
        "You are a JEE revision planner AI. Return ONLY valid JSON, no markdown, no explanation. Structure: {\"days\": [{\"day\": \"Monday\", \"sessions\": [{\"subject\": \"Physics\", \"topic\": \"Mechanics\", \"duration\": 90, \"focus\": \"Practice numericals\"}]}]}. Plan 7 days.",
        `Create a 7-day JEE revision plan.\nStudy history: ${studySummary}\n${mockSummary}\nBalance all three subjects. Focus more on weaker areas. Each day should have 2-3 sessions totaling 4-6 hours.`
      );
      const clean = res.replace(/```json|```/g, "").trim();
      setRevisionPlan(JSON.parse(clean));
    } catch (e) {
      setRevisionPlan({ error: "Could not generate plan. Try again." });
    }
    setRevisionLoading(false);
  }

  const barMax = Math.max(...Object.values(totalBySubject), 1);

  return (
    <div style={{
      minHeight: "100vh", background: "#09090f", color: "#e8e8f0", fontFamily: "'DM Mono', 'Fira Code', monospace",
      backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(0,212,255,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.04) 0%, transparent 50%)"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0f0f1a; } ::-webkit-scrollbar-thumb { background: #2a2a3f; border-radius: 2px; }
        .tab-btn { background: none; border: none; cursor: pointer; padding: 8px 16px; border-radius: 6px; font-family: inherit; font-size: 12px; letter-spacing: 0.08em; transition: all 0.2s; color: #555570; }
        .tab-btn:hover { color: #aaaacc; background: rgba(255,255,255,0.04); }
        .tab-btn.active { color: #e8e8f0; background: rgba(255,255,255,0.08); }
        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; }
        .input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; color: #e8e8f0; font-family: inherit; font-size: 13px; width: 100%; outline: none; transition: border 0.2s; }
        .input:focus { border-color: rgba(0,212,255,0.4); }
        .select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; color: #e8e8f0; font-family: inherit; font-size: 13px; width: 100%; outline: none; }
        .btn { border: none; border-radius: 8px; padding: 10px 20px; font-family: inherit; font-size: 12px; letter-spacing: 0.06em; cursor: pointer; font-weight: 500; transition: all 0.2s; }
        .btn-primary { background: linear-gradient(135deg, #00d4ff22, #a855f722); border: 1px solid rgba(0,212,255,0.3); color: #00d4ff; }
        .btn-primary:hover { background: linear-gradient(135deg, #00d4ff33, #a855f733); border-color: rgba(0,212,255,0.5); }
        .btn-danger { background: rgba(255,60,60,0.1); border: 1px solid rgba(255,60,60,0.2); color: #ff6060; }
        .btn-success { background: rgba(0,255,150,0.1); border: 1px solid rgba(0,255,150,0.2); color: #00ff96; }
        .label { font-size: 10px; letter-spacing: 0.12em; color: #555570; text-transform: uppercase; margin-bottom: 6px; }
        .ai-response { white-space: pre-wrap; line-height: 1.8; font-size: 13px; color: #ccccee; background: rgba(0,212,255,0.03); border: 1px solid rgba(0,212,255,0.1); border-radius: 10px; padding: 20px; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .session-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; transition: background 0.2s; }
        .session-row:hover { background: rgba(255,255,255,0.04); }
        .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .tag { padding: 3px 10px; border-radius: 20px; font-size: 11px; background: rgba(255,255,255,0.06); color: #888; }
        .plan-day { border-radius: 10px; padding: 16px; border: 1px solid rgba(255,255,255,0.07); margin-bottom: 12px; }
        .plan-session { display: flex; gap: 12px; align-items: flex-start; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); margin-top: 8px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #00d4ff, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>JEE.AI</div>
            <div style={{ fontSize: 10, color: "#444460", letterSpacing: "0.1em" }}>STUDY INTELLIGENCE</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {tab === "Dashboard" && (
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Your JEE Dashboard</div>
            <div style={{ fontSize: 12, color: "#555570", marginBottom: 24 }}>Track every hour. Beat every rank.</div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total Study Time", value: formatDuration(totalStudyTime), sub: `${sessions.length} sessions`, color: "#00d4ff" },
                { label: "Latest Mock Score", value: latestMock ? `${latestMock.total}/300` : "—", sub: latestMock ? `${Math.round(latestMock.total/3)}% accuracy` : "No tests yet", color: "#a855f7" },
                { label: "Mocks Attempted", value: mockTests.length, sub: "Keep going!", color: "#ff6b35" },
                { label: "Days Streak", value: "3", sub: "Don't break it!", color: "#00ff96" },
              ].map(s => (
                <div key={s.label} className="card" style={{ borderColor: `${s.color}18` }}>
                  <div className="label">{s.label}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1.1, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#444460" }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Subject breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div className="card">
                <div className="label" style={{ marginBottom: 16 }}>Subject Breakdown</div>
                {Object.entries(SUBJECTS).map(([sub, conf]) => (
                  <div key={sub} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: conf.color }}>{sub}</span>
                      <span style={{ fontSize: 12, color: "#666" }}>{formatDuration(totalBySubject[sub])}</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(totalBySubject[sub] / barMax) * 100}%`, background: conf.color, borderRadius: 3, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="label" style={{ marginBottom: 16 }}>Mock Test Trend</div>
                {mockTests.length === 0 ? (
                  <div style={{ color: "#444460", fontSize: 13, textAlign: "center", marginTop: 40 }}>No mock tests yet.<br/>Add your first one!</div>
                ) : mockTests.map(m => (
                  <div key={m.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#888" }}>{m.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: m.total >= 200 ? "#00ff96" : m.total >= 150 ? "#ffcc00" : "#ff6060" }}>{m.total}/300</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[["P", m.physics, "#00d4ff"], ["C", m.chemistry, "#ff6b35"], ["M", m.math, "#a855f7"]].map(([l, v, c]) => (
                        <div key={l} style={{ flex: 1, background: `${c}18`, borderRadius: 4, padding: "4px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: c, opacity: 0.7 }}>{l}</div>
                          <div style={{ fontSize: 12, color: c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent sessions */}
            <div className="card">
              <div className="label" style={{ marginBottom: 12 }}>Recent Sessions</div>
              {sessions.slice(-5).reverse().map(s => (
                <div key={s.id} className="session-row">
                  <div className="dot" style={{ background: SUBJECTS[s.subject].color }} />
                  <span style={{ fontSize: 12, color: SUBJECTS[s.subject].color, width: 80 }}>{s.subject}</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{s.topic}</span>
                  <span className="tag">{formatDuration(s.duration)}</span>
                  <span style={{ fontSize: 11, color: "#444460" }}>{s.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STUDY LOG */}
        {tab === "Study Log" && (
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Study Log</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

              {/* Timer */}
              <div className="card">
                <div className="label" style={{ marginBottom: 16 }}>⏱ Session Timer</div>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 52, fontWeight: 700, color: timerRunning ? "#00d4ff" : "#e8e8f0", letterSpacing: "0.05em", transition: "color 0.3s" }}>
                    {formatTime(timerSecs)}
                  </div>
                  {timerRunning && <div style={{ fontSize: 11, color: "#00d4ff", marginTop: 4 }} className="pulse">RECORDING...</div>}
                </div>
                <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                  <div>
                    <div className="label">Subject</div>
                    <select className="select" value={timerSubject} onChange={e => setTimerSubject(e.target.value)} disabled={timerRunning}>
                      {Object.keys(SUBJECTS).map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">Topic</div>
                    <select className="select" value={timerTopic} onChange={e => setTimerTopic(e.target.value)} disabled={timerRunning}>
                      <option value="">Select topic</option>
                      {SUBJECTS[timerSubject].topics.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!timerRunning ? (
                    <button className="btn btn-success" style={{ flex: 1 }} onClick={() => setTimerRunning(true)}>▶ START</button>
                  ) : (
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={stopAndSaveTimer}>⬛ STOP & SAVE</button>
                  )}
                  {!timerRunning && timerSecs > 0 && (
                    <button className="btn" style={{ background: "rgba(255,255,255,0.05)", color: "#888", border: "1px solid rgba(255,255,255,0.1)" }} onClick={() => setTimerSecs(0)}>RESET</button>
                  )}
                </div>
              </div>

              {/* Manual entry */}
              <div className="card">
                <div className="label" style={{ marginBottom: 16 }}>✏️ Manual Entry</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div className="label">Subject</div>
                    <select className="select" value={newSession.subject} onChange={e => setNewSession(s => ({ ...s, subject: e.target.value, topic: "" }))}>
                      {Object.keys(SUBJECTS).map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">Topic</div>
                    <select className="select" value={newSession.topic} onChange={e => setNewSession(s => ({ ...s, topic: e.target.value }))}>
                      <option value="">Select topic</option>
                      {SUBJECTS[newSession.subject].topics.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">Duration (minutes)</div>
                    <input className="input" type="number" placeholder="e.g. 90" value={newSession.duration} onChange={e => setNewSession(s => ({ ...s, duration: e.target.value }))} />
                  </div>
                  <div>
                    <div className="label">Notes (optional)</div>
                    <input className="input" placeholder="What did you cover?" value={newSession.notes} onChange={e => setNewSession(s => ({ ...s, notes: e.target.value }))} />
                  </div>
                  <button className="btn btn-primary" onClick={addManualSession}>+ ADD SESSION</button>
                </div>
              </div>
            </div>

            {/* Session history */}
            <div className="card">
              <div className="label" style={{ marginBottom: 12 }}>All Sessions ({sessions.length})</div>
              {[...sessions].reverse().map(s => (
                <div key={s.id} className="session-row">
                  <div className="dot" style={{ background: SUBJECTS[s.subject].color }} />
                  <span style={{ fontSize: 12, color: SUBJECTS[s.subject].color, width: 90 }}>{s.subject}</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{s.topic}</span>
                  {s.notes && <span style={{ fontSize: 11, color: "#444460", flex: 2 }}>{s.notes}</span>}
                  <span className="tag">{formatDuration(s.duration)}</span>
                  <span style={{ fontSize: 11, color: "#333350" }}>{s.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MOCK TESTS */}
        {tab === "Mock Tests" && (
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Mock Test Tracker</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16, marginBottom: 24 }}>
              <div className="card">
                <div className="label" style={{ marginBottom: 16 }}>Add Mock Test</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div className="label">Test Name</div>
                    <input className="input" placeholder="e.g. Allen Mock Test #5" value={newMock.name} onChange={e => setNewMock(m => ({ ...m, name: e.target.value }))} />
                  </div>
                  <div>
                    <div className="label">Date</div>
                    <input className="input" type="date" value={newMock.date} onChange={e => setNewMock(m => ({ ...m, date: e.target.value }))} />
                  </div>
                  {[["Physics", "physics", "#00d4ff"], ["Chemistry", "chemistry", "#ff6b35"], ["Mathematics", "math", "#a855f7"]].map(([l, k, c]) => (
                    <div key={k}>
                      <div className="label" style={{ color: c }}>{l} Score (/100)</div>
                      <input className="input" type="number" min="0" max="100" placeholder="0-100" value={newMock[k]} onChange={e => setNewMock(m => ({ ...m, [k]: e.target.value }))} style={{ borderColor: `${c}30` }} />
                    </div>
                  ))}
                  <button className="btn btn-primary" onClick={addMockTest}>+ ADD TEST</button>
                </div>
              </div>

              <div className="card">
                <div className="label" style={{ marginBottom: 16 }}>Performance History</div>
                {mockTests.map((m, i) => {
                  const pct = Math.round((m.total / m.maxMarks) * 100);
                  const prev = mockTests[i - 1];
                  const delta = prev ? m.total - prev.total : null;
                  return (
                    <div key={m.id} style={{ marginBottom: 16, padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: "#444460" }}>{m.date}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: pct >= 67 ? "#00ff96" : pct >= 50 ? "#ffcc00" : "#ff6060" }}>{m.total}</div>
                          <div style={{ fontSize: 11, color: "#555570" }}>{pct}% · /300</div>
                          {delta !== null && <div style={{ fontSize: 11, color: delta >= 0 ? "#00ff96" : "#ff6060" }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[["Physics", m.physics, "#00d4ff"], ["Chemistry", m.chemistry, "#ff6b35"], ["Math", m.math, "#a855f7"]].map(([l, v, c]) => (
                          <div key={l} style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 10, color: c }}>{l}</span>
                              <span style={{ fontSize: 10, color: "#888" }}>{v}/100</span>
                            </div>
                            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                              <div style={{ height: "100%", width: `${v}%`, background: c, borderRadius: 2 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* REVISION PLAN */}
        {tab === "Revision Plan" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>AI Revision Plan</div>
                <div style={{ fontSize: 12, color: "#555570" }}>Personalized based on your study data and mock scores</div>
              </div>
              <button className="btn btn-primary" onClick={generateRevisionPlan} disabled={revisionLoading}>
                {revisionLoading ? "⟳ GENERATING..." : "⚡ GENERATE PLAN"}
              </button>
            </div>

            {!revisionPlan && !revisionLoading && (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🗓️</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, marginBottom: 8 }}>No plan yet</div>
                <div style={{ fontSize: 13, color: "#555570" }}>Click "Generate Plan" to get a personalized 7-day revision schedule</div>
              </div>
            )}

            {revisionLoading && (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 13, color: "#00d4ff" }} className="pulse">AI is analyzing your data and building your plan...</div>
              </div>
            )}

            {revisionPlan && revisionPlan.error && (
              <div className="card" style={{ color: "#ff6060", textAlign: "center", padding: 40 }}>{revisionPlan.error}</div>
            )}

            {revisionPlan && revisionPlan.days && revisionPlan.days.map((day, di) => (
              <div key={di} className="plan-day" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#e8e8f0" }}>{day.day}</div>
                <div style={{ fontSize: 11, color: "#444460", marginBottom: 8 }}>
                  {day.sessions.reduce((a, s) => a + (s.duration || 60), 0)} min total · {day.sessions.length} sessions
                </div>
                {day.sessions.map((s, si) => (
                  <div key={si} className="plan-session">
                    <div className="dot" style={{ background: SUBJECTS[s.subject]?.color || "#888", marginTop: 4 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: SUBJECTS[s.subject]?.color || "#888" }}>{s.subject}</span>
                        <span style={{ fontSize: 13 }}>{s.topic}</span>
                        <span className="tag">{formatDuration(s.duration || 60)}</span>
                      </div>
                      {s.focus && <div style={{ fontSize: 12, color: "#555570" }}>{s.focus}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* AI INSIGHTS */}
        {tab === "AI Insights" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>AI Insights</div>
                <div style={{ fontSize: 12, color: "#555570" }}>Smart analysis of your preparation</div>
              </div>
              <button className="btn btn-primary" onClick={getAIInsights} disabled={aiLoading}>
                {aiLoading ? "⟳ ANALYZING..." : "⚡ ANALYZE MY DATA"}
              </button>
            </div>

            {/* Topic heatmap */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 16 }}>Topic Time Distribution</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {Object.entries(SUBJECTS).map(([sub, conf]) => (
                  <div key={sub}>
                    <div style={{ fontSize: 12, color: conf.color, marginBottom: 10 }}>{sub}</div>
                    {conf.topics.map(t => {
                      const mins = topicTime[`${sub}::${t}`] || 0;
                      const maxT = Math.max(...conf.topics.map(tt => topicTime[`${sub}::${tt}`] || 0), 1);
                      return (
                        <div key={t} style={{ marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontSize: 10, color: "#666" }}>{t}</span>
                            <span style={{ fontSize: 10, color: mins > 0 ? conf.color : "#333" }}>{mins > 0 ? formatDuration(mins) : "—"}</span>
                          </div>
                          <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                            <div style={{ height: "100%", width: `${(mins / maxT) * 100}%`, background: conf.color, opacity: 0.7, borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {!aiResponse && !aiLoading && (
              <div className="card" style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, marginBottom: 8 }}>Ready to analyze</div>
                <div style={{ fontSize: 13, color: "#555570" }}>Click "Analyze My Data" to get AI-powered insights on your JEE preparation</div>
              </div>
            )}

            {aiLoading && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 13, color: "#a855f7" }} className="pulse">AI is analyzing your study patterns, mock scores, and weak areas...</div>
              </div>
            )}

            {aiResponse && (
              <div className="card">
                <div className="label" style={{ marginBottom: 12 }}>AI Analysis</div>
                <div className="ai-response">{aiResponse}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
