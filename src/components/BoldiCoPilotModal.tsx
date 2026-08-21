import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  Send, Loader2, Bot, User, Check, X, 
  Copy, HelpCircle, FileText, 
  Mail, Compass, FileCheck2, ArrowRight,
  ChevronDown, ExternalLink
} from "./ui/Icon";
import { doc, updateDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { performAITask } from "../lib/gemini";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface BoldiCoPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
  itemDescription: string;
  itemType: "task" | "project";
}

// Interactive Email Composer Sub-component
interface EmailComposerCardProps {
  initialTo: string;
  initialSubject: string;
  initialBody: string;
  stakeholders: any[];
}

function EmailComposerCard({ initialTo, initialSubject, initialBody, stakeholders }: EmailComposerCardProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isCopied, setIsCopied] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSend = () => {
    // Standard secure mailto protocol - 100% real integration that invokes native client
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    setIsSent(true);
    setTimeout(() => setIsSent(false), 4000);
  };

  const handleCopy = () => {
    const formattedText = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(formattedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const selectStakeholder = (email: string) => {
    setTo(email);
    setShowDropdown(false);
  };

  return (
    <div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3.5 text-left shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
          <Mail className="w-3.5 h-3.5" />
          <span>Certo Work Email Drafter</span>
        </div>
        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
          Actionable Draft
        </span>
      </div>

      <div className="space-y-2">
        {/* Recipient Selector */}
        <div className="relative">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Recipient Email
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 text-xs bg-white border border-gray-200 focus:border-indigo-500 focus:outline-none rounded-lg px-2.5 py-1.5 font-medium text-gray-800"
            />
            {stakeholders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-2 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-0.5 text-xs"
                title="Select from Stakeholders"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stakeholders dropdown */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto p-1.5 space-y-0.5">
              <span className="block text-[9px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">
                Select Workspace Stakeholder
              </span>
              {stakeholders.map((sh) => (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => selectStakeholder(sh.email || "")}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 rounded-lg transition-colors flex flex-col"
                >
                  <span className="font-bold text-gray-800 truncate">{sh.name}</span>
                  <span className="text-[10px] text-gray-400 truncate">{sh.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subject Line */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject Line"
            className="w-full text-xs bg-white border border-gray-200 focus:border-indigo-500 focus:outline-none rounded-lg px-2.5 py-1.5 font-bold text-gray-800"
          />
        </div>

        {/* Email Body */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Message Draft
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Write your email here..."
            className="w-full text-xs bg-white border border-gray-200 focus:border-indigo-500 focus:outline-none rounded-lg px-2.5 py-2 font-medium text-gray-700 leading-relaxed resize-y font-sans"
          />
        </div>
      </div>

      {/* Button controls */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSend}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open in Mail Client</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {isSent && (
        <p className="text-[10px] text-emerald-600 font-semibold text-center mt-1">
          ✓ Loaded into your system's default email client!
        </p>
      )}
    </div>
  );
}

export function BoldiCoPilotModal({
  isOpen,
  onClose,
  itemId,
  itemTitle,
  itemDescription,
  itemType
}: BoldiCoPilotModalProps) {
  const { user, workspace } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [stakeholders, setStakeholders] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Stakeholders
  useEffect(() => {
    if (isOpen && user && workspace) {
      const qStake = query(
        collection(db, "stakeholders"),
        where("userId", "==", user.uid),
        where("workspaceId", "==", workspace.id)
      );
      const unsubscribe = onSnapshot(qStake, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStakeholders(list);
      });
      return () => unsubscribe();
    }
  }, [isOpen, user, workspace]);

  // Quick Action templates
  const templates = [
    {
      id: "research",
      label: "Research Details",
      icon: Compass,
      prompt: "Perform high-level research on how to best execute this, including industry benchmarks and key strategic considerations.",
      color: "bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
    },
    {
      id: "email",
      label: "Redact Update Email",
      icon: Mail,
      prompt: "Redact a polished, professional update email about this for team stakeholders, including objectives and next steps.",
      color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200"
    },
    {
      id: "subtasks",
      label: "Suggest Subtasks",
      icon: HelpCircle,
      prompt: "Break this down into 5 highly specific, actionable, and chronological next-step subtasks with clear verbs.",
      color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200"
    },
    {
      id: "rewrite",
      label: "Optimize Description",
      icon: FileText,
      prompt: "Rewrite this description to be professional, clean, compelling, and rich with executive context.",
      color: "bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200"
    }
  ];

  // Initialize messages with welcome intro when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          role: "assistant",
          content: `Hi there! I'm **Certo Work**, your coworker AI. I'm loaded with the context of this ${itemType}: **"${itemTitle}"**. 

How can I help you today? You can choose one of the quick actions below, or ask me to perform research, write status updates, draft emails, or format description details.`
        }
      ]);
      setInputValue("");
      setSubmitting(false);
      setAppliedIndex(null);
      setCopiedIndex(null);
    }
  }, [isOpen, itemId, itemTitle, itemType]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, submitting]);

  if (!isOpen) return null;

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || submitting) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setSubmitting(true);

    try {
      // Build comprehensive context including stakeholders
      const shContext = stakeholders.length > 0 
        ? `Available workspace stakeholders: ${stakeholders.map(s => `${s.name} (${s.email || "No Email"})`).join(", ")}`
        : "";

      const contextString = `
[Item Details]
Type: ${itemType.toUpperCase()}
Title: ${itemTitle}
Description/Details: 
${itemDescription || "(No description currently provided)"}

${shContext}
`;

      const aiResponseText = await performAITask(text, contextString);
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: aiResponseText || "I encountered an error trying to process that request. Please try again."
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `AI provider unavailable: ${err.message || "Unknown error"}`
      }]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleApplyToDescription = async (text: string, index: number) => {
    try {
      const collectionName = itemType === "task" ? "tasks" : "projects";
      const docRef = doc(db, collectionName, itemId);
      await updateDoc(docRef, { description: text });
      
      setAppliedIndex(index);
      setTimeout(() => setAppliedIndex(null), 3000);
    } catch (err) {
      console.error("Failed to update description:", err);
      alert("Failed to write to database. Please check your permissions.");
    }
  };

  // Parses markdown text to detect if any ```email block is present, yielding structural parts
  const parseMessageContent = (content: string) => {
    const emailRegex = /```email\n([\s\S]*?)\n```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = emailRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text" as const,
          content: content.slice(lastIndex, match.index)
        });
      }

      const blockContent = match[1];
      const lines = blockContent.split("\n");
      let to = "";
      let subject = "";
      const bodyLines: string[] = [];
      let isBody = false;

      for (const line of lines) {
        if (!isBody) {
          if (line.toLowerCase().startsWith("to:")) {
            to = line.slice(3).trim();
            continue;
          }
          if (line.toLowerCase().startsWith("subject:")) {
            subject = line.slice(8).trim();
            continue;
          }
          if (line.toLowerCase().startsWith("body:")) {
            const bodyRem = line.slice(5).trim();
            if (bodyRem) bodyLines.push(bodyRem);
            isBody = true;
            continue;
          }
        }
        bodyLines.push(line);
      }

      parts.push({
        type: "email" as const,
        data: {
          to: to || "",
          subject: subject || `Regarding: ${itemTitle}`,
          body: bodyLines.join("\n").trim()
        }
      });

      lastIndex = emailRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: "text" as const,
        content: content.slice(lastIndex)
      });
    }

    if (parts.length === 0) {
      parts.push({ type: "text" as const, content });
    }

    return parts;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative flex flex-col w-full max-w-2xl h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-black text-white rounded-xl">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                Certo Work Co-Pilot 
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium capitalize">
                  {itemType} Helper
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 font-medium truncate max-w-md">
                Ref: {itemTitle}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
          {messages.map((msg, index) => {
            const parsedParts = parseMessageContent(msg.content);
            return (
              <div 
                key={index} 
                className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {parsedParts.map((part, pIdx) => {
                    if (part.type === "email") {
                      return (
                        <EmailComposerCard 
                          key={pIdx}
                          initialTo={part.data.to}
                          initialSubject={part.data.subject}
                          initialBody={part.data.body}
                          stakeholders={stakeholders}
                        />
                      );
                    }
                    return (
                      <div 
                        key={pIdx}
                        className={`p-4 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user' 
                            ? 'bg-black text-white rounded-tr-none' 
                            : 'bg-gray-100/80 text-gray-800 rounded-tl-none border border-gray-200/40'
                        }`}
                      >
                        <div className="whitespace-pre-wrap select-text selection:bg-gray-200 selection:text-black">
                          {part.content}
                        </div>
                      </div>
                    );
                  })}

                  {/* Assistant Tools (Copy / Apply Description for pure text assistant messages) */}
                  {msg.role === 'assistant' && index > 0 && parsedParts.every(p => p.type === "text") && (
                    <div className="flex items-center gap-3 mt-2 pl-1">
                      <button
                        onClick={() => handleCopyText(msg.content, index)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-black transition-colors"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleApplyToDescription(msg.content, index)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-black transition-colors"
                      >
                        {appliedIndex === index ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Applied to Description!</span>
                          </>
                        ) : (
                          <>
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Apply as Description</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center shrink-0 border border-gray-300">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {submitting && (
            <div className="flex gap-3.5 justify-start">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex flex-col items-start max-w-[85%]">
                <div className="p-4 rounded-2xl text-sm bg-gray-100/80 text-gray-500 rounded-tl-none border border-gray-200/40 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Certo Work is thinking and drafting...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input & Quick Templates Panel */}
        <div className="border-t border-gray-100 p-4 bg-gray-50/30 space-y-3">
          {/* Templates list - only show if there are few messages or not submitting */}
          {messages.length <= 2 && !submitting && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                Quick Coworker Prompts
              </span>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((tpl) => {
                  const IconComponent = tpl.icon;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => handleSendMessage(tpl.prompt)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] group ${tpl.color}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <IconComponent className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-bold truncate">{tpl.label}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-indigo-500" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            className="relative flex items-center bg-white border border-gray-200 focus-within:border-indigo-500 rounded-xl px-3 py-2 transition-all shadow-sm"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={submitting}
              placeholder={`Ask Certo Work to draft an email, ask someone for status, or research...`}
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none pr-10 bg-transparent"
            />
            <button
              type="submit"
              disabled={submitting || !inputValue.trim()}
              className="absolute right-2.5 p-1.5 bg-black hover:bg-gray-800 text-white disabled:bg-gray-100 disabled:text-gray-300 rounded-lg transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
