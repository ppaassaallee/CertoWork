import re

with open("src/App.tsx", "r") as f:
    content = f.read()

content = content.replace("import { Inbox as InboxPage } from './components/Inbox';\n", "")
content = content.replace("<Route path=\"/capture/inbox\" element={<InboxPage />} />", "<Route path=\"/capture/inbox\" element={<Navigate to=\"/capture\" replace />} />")

with open("src/App.tsx", "w") as f:
    f.write(content)
