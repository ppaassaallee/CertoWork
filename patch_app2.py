import re

with open("src/App.tsx", "r") as f:
    content = f.read()

content = content.replace("import { MeetingIntakePanel } from './components/MeetingIntakePanel';\n", "")
content = content.replace('      { to: "/capture/meeting-intake", label: "Meetings", icon: FileText },\n', "")
content = content.replace('<Route path="/capture/meeting-intake" element={<MeetingIntakePanel />} />', '<Route path="/capture/meeting-intake" element={<Navigate to="/capture" replace />} />')
content = content.replace('<Route path="/meeting-intake" element={<Navigate to="/capture/meeting-intake" replace />} />', '<Route path="/meeting-intake" element={<Navigate to="/capture" replace />} />')

with open("src/App.tsx", "w") as f:
    f.write(content)
