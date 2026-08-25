# Certo Work Apple widgets

Native iPhone Home Screen and Mac Desktop / Notification Center widgets.

## Install

1. In Certo Work, open **Settings → iPhone and Mac widgets** and enable the widget.
2. Copy the WidgetKit feed token (the last path segment of `/api/widget/...`).
3. On a Mac with Xcode 15+:

```bash
brew install xcodegen
cd apple/CertoWork
xcodegen generate
open CertoWork.xcodeproj
```

4. Set your Apple Development Team.
5. Run **CertoWork** on an iPhone, or **CertoWorkMac** on this Mac.
6. Paste the token in the app and tap **Save and refresh widgets**.
7. iPhone: long-press Home Screen → **Add Widget** → Certo Work.
8. Mac: Desktop or Notification Center → **Edit Widgets** → Certo Work.

The widget reads `https://certo.work/api/widget/{token}` every 15 minutes.

Until the native app is on your devices, Safari **Add to Home Screen** (iPhone) and **Add to Dock** (Mac) on the widget page still shows today’s 2+8.
