import React, { useState, useRef } from "react";
import { Mic, Square, Loader2, UploadCloud, X, FileAudio, Sparkles, Inbox } from "./ui/Icon";
import { transcribeCaptureWithAI } from "../lib/gemini";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

export function AudioCaptureZone({ onComplete }: { onComplete: () => void }) {
  const { user, workspace } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ingestion summary state
  const [ingestionSummary, setIngestionSummary] = useState<{
    actionItemsCount: number;
    decisionsCount: number;
    ideasCount: number;
    summary: string;
    rawTranscription: string;
  } | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setError("");
      setIngestionSummary(null);
    } catch (err: any) {
      console.error(err);
      setError("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      await processAudio(file);
    } else {
      setError("Please drop a valid audio file (mp3, webm, wav).");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processAudio = async (blobOrFile: Blob | File) => {
    setIsProcessing(true);
    setError("");
    setIngestionSummary(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blobOrFile);
      reader.onloadend = async () => {
        const base64data = reader.result?.toString().split(',')[1];
        if (base64data) {
          const result = await transcribeCaptureWithAI(base64data, blobOrFile.type || 'audio/webm');
          await saveTranscriptionToNeedsReview(result);
          onComplete();
        }
      };
    } catch (err: any) {
      console.error(err);
      setError("Failed to process audio: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveTranscriptionToNeedsReview = async (result: any) => {
    if (!user || !workspace) return;
    try {
      let actionItemsCount = 0;
      let decisionsCount = 0;
      let ideasCount = 0;

      // 1. Save extracted action items
      if (result.actionItems && Array.isArray(result.actionItems)) {
        for (const item of result.actionItems) {
          await addDoc(collection(db, "review_candidates"), {
            userId: user.uid,
            workspaceId: workspace.id,
            createdBy: user.uid,
            title: item.title || "Untitled Task",
            type: "task",
            why: item.notes || "Extracted from voice capture",
            action: "Import Action Item",
            confidence: "high",
            proposed: {
              title: item.title,
              priority: "medium",
              dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0],
              status: "open",
              description: item.notes || ""
            },
            source: result.summary || "Voice Capture",
            sourceType: "voice",
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          actionItemsCount++;
        }
      }

      // 2. Save extracted decisions
      if (result.decisions && Array.isArray(result.decisions)) {
        for (const item of result.decisions) {
          await addDoc(collection(db, "review_candidates"), {
            userId: user.uid,
            workspaceId: workspace.id,
            createdBy: user.uid,
            title: item.title || "Untitled Decision",
            type: "decision",
            why: item.reason || "Extracted from voice capture",
            action: "Import Decision",
            confidence: "high",
            proposed: {
              title: item.title,
              description: item.reason || "",
              status: "open"
            },
            source: result.summary || "Voice Capture",
            sourceType: "voice",
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          decisionsCount++;
        }
      }

      // 3. Save extracted ideasAndNotes
      if (result.ideasAndNotes && Array.isArray(result.ideasAndNotes)) {
        for (const item of result.ideasAndNotes) {
          await addDoc(collection(db, "review_candidates"), {
            userId: user.uid,
            workspaceId: workspace.id,
            createdBy: user.uid,
            title: item.title || "Untitled Idea",
            type: "someday",
            why: item.description || "Extracted from voice capture",
            action: "Import Idea",
            confidence: "high",
            proposed: {
              title: item.title,
              description: item.description || "",
              status: "open"
            },
            source: result.summary || "Voice Capture",
            sourceType: "voice",
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          ideasCount++;
        }
      }

      setIngestionSummary({
        actionItemsCount,
        decisionsCount,
        ideasCount,
        summary: result.summary || "No summary available",
        rawTranscription: result.rawTranscription || ""
      });

    } catch (e) {
      console.error("Error saving transcription review candidates", e);
      throw e;
    }
  };

  if (ingestionSummary) {
    return (
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm text-left">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            <h3 className="font-bold text-lg text-gray-900">Voice Capture Ingested!</h3>
          </div>
          <button 
            onClick={() => setIngestionSummary(null)} 
            className="p-1 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-md">
              AI Summary
            </span>
            <p className="text-xs text-indigo-900 font-medium leading-relaxed mt-2.5 italic">
              "{ingestionSummary.summary}"
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center">
              <span className="block text-xl font-black text-gray-900">{ingestionSummary.actionItemsCount}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Action Items</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center">
              <span className="block text-xl font-black text-gray-900">{ingestionSummary.decisionsCount}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Decisions</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center">
              <span className="block text-xl font-black text-gray-900">{ingestionSummary.ideasCount}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ideas/Notes</span>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
              <Inbox className="w-4 h-4 text-indigo-500" />
              <span>All items sent to the "Needs Review" queue below!</span>
            </div>
            <button
              onClick={() => setIngestionSummary(null)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
            >
              Capture Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`border-2 border-dashed rounded-3xl p-8 transition-colors flex flex-col items-center justify-center text-center min-h-[280px]
        ${isRecording ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-400 bg-gray-50 hover:bg-gray-100/50'}
      `}
    >
      {isProcessing ? (
        <div className="flex flex-col items-center py-4">
          <Loader2 className="w-8 h-8 text-black animate-spin mb-4" />
          <p className="font-bold">Analyzing audio with the configured AI provider...</p>
          <p className="text-sm text-gray-500 mt-1">Transcribing and extracting actions faithfully</p>
        </div>
      ) : (
        <>
          <div className="mb-6 relative">
            {isRecording ? (
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                <Mic className="w-8 h-8 text-red-600" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-white shadow-sm border border-gray-200 rounded-full flex items-center justify-center">
                <FileAudio className="w-8 h-8 text-gray-400" />
              </div>
            )}
            
            {/* Ambient recording rings */}
            {isRecording && (
              <div className="absolute inset-0 rounded-full border-4 border-red-500/20 animate-ping" style={{ animationDuration: '2s' }} />
            )}
          </div>

          <div className="space-y-2 mb-8">
            <h3 className="text-xl font-bold">
              {isRecording ? formatTime(recordingTime) : "Capture via Voice or Audio File"}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto text-xs font-medium leading-relaxed">
              {isRecording 
                ? "Recording in progress... speak your mind clearly."
                : "Record a voice note, or drag and drop an audio file (mp3, webm, wav) to instantly transcribe and send extracted action items to Needs Review."}
            </p>
          </div>

          {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

          <div className="flex items-center justify-center gap-4">
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="bg-black text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-800 transition-transform active:scale-95 text-xs uppercase tracking-wider"
              >
                <Square className="w-4 h-4" fill="currentColor" />
                Stop Recording
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="bg-black text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-800 transition-transform active:scale-95 shadow-sm text-xs uppercase tracking-wider"
              >
                <Mic className="w-4 h-4 animate-pulse" />
                Start Recording
              </button>
            )}
            
            {!isRecording && (
               <div className="text-xs font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wider">
                 <UploadCloud className="w-4 h-4 text-indigo-500 animate-bounce" />
                 Drag & Drop File
               </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
