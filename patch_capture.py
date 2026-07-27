import re

with open("src/components/Capture.tsx", "r") as f:
    content = f.read()

# Add new imports
content = content.replace('import { Send, Inbox as InboxIcon, Check, X, Sparkles, FileText, RefreshCw } from "lucide-react";', 
                          'import { Send, Inbox as InboxIcon, Check, X, Sparkles, FileText, RefreshCw, Loader2, HeartHandshake, Zap } from "lucide-react";')
content = content.replace('import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";',
                          'import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";')

with open("src/components/Capture.tsx", "w") as f:
    f.write(content)
