import re

with open("src/components/Capture.tsx", "r") as f:
    content = f.read()

# Add audio tab
tabs_old = """            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setActiveTab('quick')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'quick' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Quick Thought</button>
              <button onClick={() => setActiveTab('meeting')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'meeting' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Meeting Notes</button>
            </div>"""
tabs_new = """            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setActiveTab('quick')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'quick' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Quick Thought</button>
              <button onClick={() => setActiveTab('meeting')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'meeting' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Meeting Notes</button>
              <button onClick={() => setActiveTab('audio')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === 'audio' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>Voice / Audio</button>
            </div>"""

content = content.replace(tabs_old, tabs_new)

# Remove the two column layout
layout_old = """      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Text Capture */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col">"""
layout_new = """      <div className="max-w-2xl mx-auto">
        {/* Capture Container */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col min-h-[400px]">"""

content = content.replace(layout_old, layout_new)

# Replace the text area with a conditional that also handles audio
textarea_block_old = """          ) : (
          <div className="flex-1 flex flex-col gap-4">
            <textarea
              className={`w-full ${activeTab === 'meeting' ? 'h-48' : 'h-32'} p-4 text-base bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-black/5 placeholder:text-gray-400 transition-all`}
              placeholder={activeTab === 'meeting' ? "Paste raw notes dump or transcript here..." : "Dump a thought, next action, issue, or note..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && activeTab === 'quick') {
                  e.preventDefault();
                  handleCapture();
                }
              }}
              disabled={isSaving || meetingProcessing}
            />
            <div className="flex items-center justify-between">
              <div>
                {successMsg && (
                  <span className="text-xs text-green-600 font-bold">{successMsg}</span>
                )}
                {errorMsg && (
                  <span className="text-xs text-red-600 font-bold">{errorMsg}</span>
                )}
              </div>
              <button
                onClick={activeTab === 'meeting' ? handleProcessMeeting : handleCapture}
                disabled={isSaving || meetingProcessing || !input.trim()}
                className="bg-black hover:bg-neutral-900 text-white px-6 py-2.5 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 shadow-sm disabled:opacity-25"
              >
                {(isSaving || meetingProcessing) ? <RefreshCw className="w-4 h-4 animate-spin" /> : (activeTab === 'meeting' ? <Sparkles className="w-4 h-4 text-amber-400" /> : <Send className="w-4 h-4" />)}
                {activeTab === 'meeting' ? 'Analyze Meeting' : 'Process'}
              </button>
            </div>
          </div>
          )}
        </div>
        {/* Audio Capture */}
        <div>
          <AudioCaptureZone onComplete={() => setSuccessMsg("Voice processed!")} />
        </div>
      </div>"""
textarea_block_new = """          ) : activeTab === 'audio' ? (
            <div className="flex-1 flex flex-col justify-center">
              <AudioCaptureZone onComplete={() => setSuccessMsg("Voice processed!")} />
            </div>
          ) : (
          <div className="flex-1 flex flex-col gap-4">
            <textarea
              className={`w-full ${activeTab === 'meeting' ? 'h-48' : 'h-32'} p-4 text-base bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-black/5 placeholder:text-gray-400 transition-all`}
              placeholder={activeTab === 'meeting' ? "Paste raw notes dump or transcript here..." : "Dump a thought, next action, issue, or note..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && activeTab === 'quick') {
                  e.preventDefault();
                  handleCapture();
                }
              }}
              disabled={isSaving || meetingProcessing}
            />
            <div className="flex items-center justify-between">
              <div>
                {successMsg && (
                  <span className="text-xs text-green-600 font-bold">{successMsg}</span>
                )}
                {errorMsg && (
                  <span className="text-xs text-red-600 font-bold">{errorMsg}</span>
                )}
              </div>
              <button
                onClick={activeTab === 'meeting' ? handleProcessMeeting : handleCapture}
                disabled={isSaving || meetingProcessing || !input.trim()}
                className="bg-black hover:bg-neutral-900 text-white px-6 py-2.5 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 shadow-sm disabled:opacity-25"
              >
                {(isSaving || meetingProcessing) ? <RefreshCw className="w-4 h-4 animate-spin" /> : (activeTab === 'meeting' ? <Sparkles className="w-4 h-4 text-amber-400" /> : <Send className="w-4 h-4" />)}
                {activeTab === 'meeting' ? 'Analyze Meeting' : 'Process'}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>"""

content = content.replace(textarea_block_old, textarea_block_new)

# State active tab needs to include 'audio' type
content = content.replace('const [activeTab, setActiveTab] = useState<"quick" | "meeting">("quick");', 'const [activeTab, setActiveTab] = useState<"quick" | "meeting" | "audio">("quick");')

with open("src/components/Capture.tsx", "w") as f:
    f.write(content)
