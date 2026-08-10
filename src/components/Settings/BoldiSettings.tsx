import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Shield, FileCode, CalendarCheck, ChevronRight, ArrowLeft, Bot, 
  Sparkles, Check, Heart, Smile, ShieldAlert, Sliders, Info, Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export function BoldiSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Customization States
  const [name, setName] = useState("Laura");
  const [avatarColor, setAvatarColor] = useState("indigo");
  const [warmth, setWarmth] = useState(5);
  const [playfulness, setPlayfulness] = useState(5);
  const [formality, setFormality] = useState(5);
  const [challengeIntensity, setChallengeIntensity] = useState(5);
  const [proactivity, setProactivity] = useState(5);
  
  // Toggles
  const [humorAllowed, setHumorAllowed] = useState(true);
  const [suggestsMedia, setSuggestsMedia] = useState(false);
  const [enforcesWeekend, setEnforcesWeekend] = useState(false);
  const [kidsInteract, setKidsInteract] = useState(false);
  
  // Advanced States (Collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [modelTemperature, setModelTemperature] = useState(0.3);
  const [modelCreativity, setModelCreativity] = useState(0.3);
  
  // Saving Indicator
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved">("idle");

  const colors = [
    { id: "indigo", name: "Classic Indigo", bg: "bg-indigo-600", text: "text-indigo-600" },
    { id: "amber", name: "Amber Gold", bg: "bg-amber-500", text: "text-amber-500" },
    { id: "emerald", name: "Emerald Mint", bg: "bg-emerald-600", text: "text-emerald-600" },
    { id: "rose", name: "Crimson Rose", bg: "bg-rose-600", text: "text-rose-600" },
    { id: "violet", name: "Royal Violet", bg: "bg-violet-600", text: "text-violet-600" },
    { id: "dark", name: "Cosmic Charcoal", bg: "bg-neutral-800", text: "text-neutral-800" }
  ];

  // Load settings on mount
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const uidStr: string = uid;
    
    async function loadSettings() {
      try {
        const docRef = doc(db, "boldi_settings", uidStr);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) setName(data.name);
          if (data.avatarColor) setAvatarColor(data.avatarColor);
          if (data.warmth !== undefined) setWarmth(data.warmth);
          if (data.playfulness !== undefined) setPlayfulness(data.playfulness);
          if (data.formality !== undefined) setFormality(data.formality);
          if (data.challengeIntensity !== undefined) setChallengeIntensity(data.challengeIntensity);
          if (data.proactivity !== undefined) setProactivity(data.proactivity);
          if (data.humorAllowed !== undefined) setHumorAllowed(data.humorAllowed);
          if (data.suggestsMedia !== undefined) setSuggestsMedia(data.suggestsMedia);
          if (data.enforcesWeekend !== undefined) setEnforcesWeekend(data.enforcesWeekend);
          if (data.kidsInteract !== undefined) setKidsInteract(data.kidsInteract);
          if (data.modelTemperature !== undefined) setModelTemperature(data.modelTemperature);
          if (data.modelCreativity !== undefined) setModelCreativity(data.modelCreativity);
        }
      } catch (err) {
        console.error("Failed to load assistant settings:", err);
      }
    }
    
    loadSettings();
  }, [user]);

  // Reactive save handler (Triggered when inputs change)
  const saveSettings = async (updates: any) => {
    const uid = user?.uid;
    if (!uid) return;
    const saveUid: string = uid;
    setSavingStatus("saving");
    try {
      const docRef = doc(db, "boldi_settings", saveUid);
      await setDoc(docRef, {
        name,
        avatarColor,
        warmth,
        playfulness,
        formality,
        challengeIntensity,
        proactivity,
        humorAllowed,
        suggestsMedia,
        enforcesWeekend,
        kidsInteract,
        modelTemperature,
        modelCreativity,
        updatedAt: new Date().toISOString(),
        ...updates
      }, { merge: true });
      setSavingStatus("saved");
      setTimeout(() => setSavingStatus("idle"), 1500);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSavingStatus("idle");
    }
  };

  const adminNav = [
    { title: "System Context", description: "Manage background knowledge and workspace rules", icon: FileCode, path: "/settings/boldi/context", color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Tool Access", description: "Enforce security settings and tool permissions", icon: Shield, path: "/settings/boldi/tools", color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Automations", description: "Configure scheduled sync jobs and alerts", icon: CalendarCheck, path: "/settings/boldi/automations", color: "text-amber-600", bg: "bg-amber-50" }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 max-w-2xl mx-auto space-y-6 pb-24"
    >
      {/* Header and status */}
      <header className="mb-4 mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">MY ASSISTANT</h1>
            <p className="text-gray-500 text-xs mt-0.5 font-medium uppercase tracking-wider">Configure Certo Work Chief-of-Staff</p>
          </div>
        </div>
        
        <div className="text-xs font-mono font-bold">
          {savingStatus === "saving" && <span className="text-indigo-500 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 animate-bounce" /> Syncing...</span>}
          {savingStatus === "saved" && <span className="text-emerald-500 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Live Updated</span>}
          {savingStatus === "idle" && <span className="text-gray-400">Settings Saved</span>}
        </div>
      </header>

      {/* Visual Identity Workspace Section */}
      <section className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Bot className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Assistant Identity</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assistant Name input */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-wider block">Assistant Name</label>
            <div className="relative">
              <input 
                type="text" 
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  saveSettings({ name: e.target.value });
                }}
                className="w-full bg-gray-50 border border-gray-200 hover:border-gray-300 focus:border-black rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all"
                placeholder="e.g. Laura"
              />
              <Sparkles className="w-4 h-4 text-yellow-500 absolute right-3.5 top-3.5" />
            </div>
          </div>

          {/* Avatar selection color */}
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 uppercase tracking-wider block">Avatar Palette</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {colors.map((col) => (
                <button
                  key={col.id}
                  onClick={() => {
                    setAvatarColor(col.id);
                    saveSettings({ avatarColor: col.id });
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${col.bg} hover:scale-105 active:scale-95 shadow-sm`}
                  title={col.name}
                >
                  {avatarColor === col.id && (
                    <Check className="w-5 h-5 text-white stroke-[3px]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Personality Sliders (0-10) with reactive descriptions */}
      <section className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Acoustic & Personality Sliders</h2>
        </div>

        <div className="space-y-5">
          {/* Slider 1: Warmth */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-700 flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-rose-500" /> Warmth & Empathy</span>
              <span className="text-indigo-600 font-black">{warmth} / 10</span>
            </div>
            <input 
              type="range" min="0" max="10" 
              value={warmth}
              onChange={(e) => {
                const val = Number(e.target.value);
                setWarmth(val);
                saveSettings({ warmth: val });
              }}
              className="w-full accent-black h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-[10px] text-gray-400 font-medium">
              {warmth <= 3 ? "Clinical, dry, analytical, highly efficient and strictly professional." : 
               warmth <= 7 ? "Empathetic, balanced, warm, and corporate-appropriate support." : 
               "Immersive empathy, deeply warm, encourages recovery, mental health, and wellness."}
            </div>
          </div>

          {/* Slider 2: Playfulness */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-700 flex items-center gap-1.5"><Smile className="w-3.5 h-3.5 text-amber-500" /> Playfulness & Humor</span>
              <span className="text-indigo-600 font-black">{playfulness} / 10</span>
            </div>
            <input 
              type="range" min="0" max="10" 
              value={playfulness}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPlayfulness(val);
                saveSettings({ playfulness: val });
              }}
              className="w-full accent-black h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-[10px] text-gray-400 font-medium">
              {playfulness <= 3 ? "Strictly literal responses, zero humor, maximum precision." : 
               playfulness <= 7 ? "Polite and cheerful, celebrates milestones with moderate style." : 
               "High celebratory flair, tells witty jokes, uses vibrant motivational feedback."}
            </div>
          </div>

          {/* Slider 3: Formality */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-700 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5 text-indigo-500" /> Formality Style</span>
              <span className="text-indigo-600 font-black">{formality} / 10</span>
            </div>
            <input 
              type="range" min="0" max="10" 
              value={formality}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFormality(val);
                saveSettings({ formality: val });
              }}
              className="w-full accent-black h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-[10px] text-gray-400 font-medium">
              {formality <= 3 ? "Colloquial, uses simple language, direct, and conversational." : 
               formality <= 7 ? "Balanced business-casual dialogue, polished, clear executive-appropriate tone." : 
               "Highly formal, elegant academic and corporate lexicon, uses proper executive honorifics."}
            </div>
          </div>

          {/* Slider 4: Challenge intensity */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-700 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-red-500" /> Challenge Intensity</span>
              <span className="text-indigo-600 font-black">{challengeIntensity} / 10</span>
            </div>
            <input 
              type="range" min="0" max="10" 
              value={challengeIntensity}
              onChange={(e) => {
                const val = Number(e.target.value);
                setChallengeIntensity(val);
                saveSettings({ challengeIntensity: val });
              }}
              className="w-full accent-black h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-[10px] text-gray-400 font-medium">
              {challengeIntensity <= 3 ? "Passive assistant. Executes all requests instantly without question." : 
               challengeIntensity <= 7 ? "Moderate coaching. Warns about clear WIP overloads and conflicts." : 
               "High challenge strategist. Actively pushes back, enforces WIP limits, and questions vague goals."}
            </div>
          </div>

          {/* Slider 5: Proactivity */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-700 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" /> Proactivity Quotient</span>
              <span className="text-indigo-600 font-black">{proactivity} / 10</span>
            </div>
            <input 
              type="range" min="0" max="10" 
              value={proactivity}
              onChange={(e) => {
                const val = Number(e.target.value);
                setProactivity(val);
                saveSettings({ proactivity: val });
              }}
              className="w-full accent-black h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-[10px] text-gray-400 font-medium">
              {proactivity <= 3 ? "Quiet. Only responds to explicit user prompts." : 
               proactivity <= 7 ? "Suggests adjacent next actions, follow-ups, and calendar links." : 
               "Highly proactive co-pilot. Proposes structural reviews, raises blocked projects unprompted."}
            </div>
          </div>
        </div>
      </section>

      {/* Behavioral Toggles */}
      <section className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Check className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Behavioral Guardrails</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Toggle 1: humor allowed */}
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="font-bold text-xs text-gray-900 block">Humor & Sarcasm Permission</span>
              <span className="text-[10px] text-gray-400 font-medium block">Allows the assistant to utilize subtle, witty sarcasm when appropriate</span>
            </div>
            <button
              onClick={() => {
                setHumorAllowed(!humorAllowed);
                saveSettings({ humorAllowed: !humorAllowed });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative outline-none ${humorAllowed ? 'bg-black' : 'bg-gray-200'}`}
            >
              <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-0.75 transition-all ${humorAllowed ? 'left-5.75' : 'left-0.75'}`} />
            </button>
          </div>

          {/* Toggle 2: suggests media */}
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="font-bold text-xs text-gray-900 block">Suggest Curated Media</span>
              <span className="text-[10px] text-gray-400 font-medium block">Integrate recommended books, articles, or papers tied to development plan</span>
            </div>
            <button
              onClick={() => {
                setSuggestsMedia(!suggestsMedia);
                saveSettings({ suggestsMedia: !suggestsMedia });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative outline-none ${suggestsMedia ? 'bg-black' : 'bg-gray-200'}`}
            >
              <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-0.75 transition-all ${suggestsMedia ? 'left-5.75' : 'left-0.75'}`} />
            </button>
          </div>

          {/* Toggle 3: family and weekend */}
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="font-bold text-xs text-gray-900 block">Enforce Weekend Boundaries</span>
              <span className="text-[10px] text-gray-400 font-medium block">Strictly block work commitments on Saturday/Sunday, prioritizing rest & family</span>
            </div>
            <button
              onClick={() => {
                setEnforcesWeekend(!enforcesWeekend);
                saveSettings({ enforcesWeekend: !enforcesWeekend });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative outline-none ${enforcesWeekend ? 'bg-black' : 'bg-gray-200'}`}
            >
              <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-0.75 transition-all ${enforcesWeekend ? 'left-5.75' : 'left-0.75'}`} />
            </button>
          </div>

          {/* Toggle 4: kids mode */}
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="font-bold text-xs text-gray-900 block">Kid Interaction Mode</span>
              <span className="text-[10px] text-gray-400 font-medium block">Allow children to speak to the assistant (simplifies vocab, never updates database)</span>
            </div>
            <button
              onClick={() => {
                setKidsInteract(!kidsInteract);
                saveSettings({ kidsInteract: !kidsInteract });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative outline-none ${kidsInteract ? 'bg-black' : 'bg-gray-200'}`}
            >
              <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-0.75 transition-all ${kidsInteract ? 'left-5.75' : 'left-0.75'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Advanced Collapsible Model config */}
      <section className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between outline-none"
        >
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-black text-gray-900 uppercase tracking-widest">Advanced LLM Parameters</span>
          </div>
          <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
        </button>

        {showAdvanced && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-5 pt-3 border-t border-gray-100"
          >
            {/* Model Temperature */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-700">Model Temperature</span>
                <span className="text-indigo-600 font-black">{modelTemperature}</span>
              </div>
              <input 
                type="range" min="0.1" max="1.0" step="0.05"
                value={modelTemperature}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setModelTemperature(val);
                  saveSettings({ modelTemperature: val });
                }}
                className="w-full accent-black h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-[10px] text-gray-400 font-medium">Controls the logic and determinism of generated action plans. Lower means more precise.</div>
            </div>

            {/* Creativity/TopP */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-700">Creativity Index</span>
                <span className="text-indigo-600 font-black">{modelCreativity}</span>
              </div>
              <input 
                type="range" min="0.1" max="1.0" step="0.05"
                value={modelCreativity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setModelCreativity(val);
                  saveSettings({ modelCreativity: val });
                }}
                className="w-full accent-black h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-[10px] text-gray-400 font-medium">Controls the linguistic variety. Higher allows the agent to construct more colorful phrases.</div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Existing navigation for other configuration views */}
      <div className="bg-white rounded-3xl border border-gray-200/80 overflow-hidden divide-y divide-gray-100 shadow-sm">
        {adminNav.map((item) => (
          <button key={item.title} onClick={() => navigate(item.path)} className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-xs tracking-tight block">{item.title}</span>
                <span className="text-[10px] text-gray-400 font-medium block">{item.description}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
