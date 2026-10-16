# Tuck community kit (Discord)

Everything needed to set up the Tuck Discord server for early users in about 10 minutes.
Main language: Chinese, plus one `#english` channel. Paste-ready text is in the code blocks.

> Keep it small at first. Until there are ~50 active members, open only the channels marked **Day 1**.
> Add the rest when people are actually talking.

---

## 1. Setup checklist

1. **Create the server**: Discord → `+` → Create My Own → For a club or community. Name: `Tuck`. Icon: `build/icon.png`.
2. **Enable Community** (Server Settings → Enable Community). Required for the rules screen, welcome screen and announcement channels.
3. **Safety** (Server Settings → Safety Setup):
   - Verification level: **Low** (verified email).
   - Explicit media filter: **all members**.
   - Default notifications: **Only @mentions** (Server Settings → Overview).
4. **AutoMod**: turn on "Block common spam" and "Block mention spam".
5. **Create channels and roles** from sections 2 and 3, then paste the texts from section 4.
6. **Permanent invite**: right-click `#欢迎-welcome` → Invite People → Edit invite link → Expire after **Never**, Max uses **No limit**. Send that link to the developer so it can be added to the app, landing page and README (section 6).
7. **Releases → #公告** (optional, no bot needed): section 5.

---

## 2. Channels

| Category | Channel | Day 1 | Who can post | Purpose |
|---|---|---|---|---|
| 📌 信息 Info | `#欢迎-welcome` | ✅ | Team only | Welcome, rules, privacy promise (bilingual) |
| | `#公告-announcements` | ✅ | Team only (announcement channel) | Releases, changelog |
| | `#新手指南-start-here` | | Team only | How to use, common problems |
| 💬 反馈 Feedback | `#反馈-feedback` | ✅ | Everyone | Bugs and ideas together at first |
| | `#bug反馈` | | Everyone | Split out from #反馈 when it gets busy |
| | `#功能建议` | | Everyone | Split out from #反馈 when it gets busy |
| 🌱 社区 Community | `#摘录分享` | | Everyone | Share quotes you tucked away (card images welcome) |
| | `#闲聊` | | Everyone | Anything else |
| 🌍 English | `#english` | ✅ | Everyone | Feedback, questions and chat in English |

Settings per channel:
- `#摘录分享`: slow mode 30 s.
- `#反馈-feedback`, `#bug反馈`: pin the bug template (section 4.5).
- Day 1 tip: with only 4 channels, newcomers immediately see where to speak.

---

## 3. Roles

| Role | Color | Who | Permissions |
|---|---|---|---|
| `Team` | `#B4532A` (Tuck terracotta) | You | Administrator |
| `Founding Tucker` 首批用户 | `#D98A4E` | First ~50 members who give feedback | Display separately; no extra permissions |
| (everyone) | | All members | Default; cannot post in Info channels |

Give `Founding Tucker` by hand when someone reports a bug, suggests something, or shares a tuck. Close it at 50 and say so in #公告; the scarcity is the point.

---

## 4. Paste-ready text

### 4.1 Channel topics

```text
#欢迎-welcome        欢迎来到 Tuck · Welcome. 先读这里 / Start here.
#公告-announcements  新版本与更新日志 · Releases and changelog
#新手指南-start-here 怎么用、常见问题 · How to use Tuck, common fixes
#反馈-feedback       Bug 和想法都发这里，我都会看 · Bugs and ideas, all read by the developer
#摘录分享            分享你收进 Tuck 的好句子
#闲聊                随便聊
#english             Questions, feedback and chat in English
```

### 4.2 `#欢迎-welcome` message (bilingual)

```text
👋 欢迎来到 Tuck！

Tuck 是一个 Windows 小工具：读到好句子时，双击 Ctrl+C 就把它收进一个本地 Markdown 笔记；长按 Ctrl+C 还能顺手写一句自己的想法。不打断阅读，事后再整理。

🔒 隐私承诺
• Tuck 只看 Ctrl 和 C 两个键的按下时机，不记录、不保存任何其他按键。
• 你的摘录只存在你自己的电脑上（默认 文档\Tuck\tuck.md）。
• Tuck 不联网。唯一的例外是你在设置里主动打开的“检查更新”。

📜 规则
1. 友善交流，对事不对人。
2. 不发广告、不刷屏。
3. 反馈 Bug 时，请勿贴出你的私人摘录内容。

👉 下一步：在 #反馈-feedback 说说你的使用感受，前 50 位反馈的朋友会获得「Founding Tucker 首批用户」身份。
English speakers: welcome too, come say hi in #english.

━━━━━━━━━━━━━━━━

👋 Welcome to Tuck!

Tuck is a small Windows tool: double-tap Ctrl+C to tuck a sentence into a local Markdown notebook; hold Ctrl+C to add a thought of your own. Keep reading, sort it out later.

🔒 Privacy promise
• Tuck only notices when Ctrl and C are pressed. No other key is ever recorded or stored.
• Your notes stay on your computer (default: Documents\Tuck\tuck.md).
• Tuck does not use the internet, except update checks if you turn them on in Settings.

📜 Rules
1. Be kind. Discuss ideas, not people.
2. No ads, no spam.
3. When reporting a bug, don't paste your private notes.

👉 Say hi in #english. The first 50 people who share feedback get the "Founding Tucker" role.
```

### 4.3 `#新手指南-start-here`

```text
📖 Tuck 新手指南

✂️ 收录
• 双击 Ctrl+C（两次间隔 1 秒内）：静默收录，原文飞进屏幕底部的小条。
• 长按 Ctrl+C（按住约 0.6 秒）：收录并弹出输入框写想法。
   Enter 保存 · Esc 取消 · Shift+Enter 换行 · 想法里写 #标签 会自动提取。
• 平时单按一次 Ctrl+C 完全不受影响，不会收录。

📒 查看
• 托盘图标 → Open notebook，或双击托盘图标。可以搜索、按标签和来源筛选。
• 原始文件：文档\Tuck\tuck.md，可以直接用 Obsidian 等工具打开。

🛠 常见问题
• 安装时提示“Windows 已保护你的电脑”：点“更多信息”→“仍要运行”。目前安装包还没有代码签名。
• 杀毒软件报警：Tuck 需要监听 Ctrl 和 C 两个键的时机，部分杀毒软件会把全局键盘钩子当成风险。请把 Tuck 加入信任列表。
• 在“以管理员身份运行”的程序里收录无效：这是 Windows 的安全限制（UIPI），普通程序收不到管理员窗口里的按键。
• 收录了但不知道存在哪：托盘 → Open notebook → Open folder。

还有问题？发到 #反馈-feedback。
```

### 4.4 `#english` pinned message

```text
🌍 Welcome to #english

Ask questions, report bugs and share ideas in English here. The developer reads everything.

Quick start
• Double-tap Ctrl+C: tuck the copied text away silently.
• Hold Ctrl+C (~0.6 s): tuck it and add a thought. Enter saves, Esc cancels, Shift+Enter adds a line. #tags in your thought are picked up automatically.
• A single Ctrl+C works as usual and saves nothing.
• Tray icon → Open notebook to browse, search and filter.

Common fixes
• "Windows protected your PC" on install: More info → Run anyway (the installer isn't code-signed yet).
• Antivirus warning: Tuck watches the timing of Ctrl and C, which some antivirus tools flag. Allow Tuck in your antivirus.
• Nothing happens in apps run as administrator: Windows blocks normal apps from seeing keys in elevated windows (UIPI).

Reporting a bug? Please use the template pinned in #反馈-feedback (English is fine).
```

### 4.5 Bug template (pin in `#反馈-feedback` / `#bug反馈`)

```text
🐞 Bug 反馈模板 / Bug report template

**发生了什么 / What happened:**
**期望的结果 / What you expected:**
**怎么复现 / Steps to reproduce:**
1.
2.
**在哪个程序里 / In which app:** （例如 Chrome、微信 / e.g. Chrome, WeChat）
**Tuck 版本 / Tuck version:** （托盘 → Settings → Diagnostics）
**Windows 版本 / Windows version:**
**诊断信息 / Diagnostics:** Settings → Diagnostics → Copy diagnostics，粘贴到这里（不含你的摘录内容 / contains no note text）

⚠️ 请不要贴出你的私人摘录 / Please don't paste your private notes.
```

### 4.6 Idea template (pin in `#功能建议` once it exists)

```text
💡 功能建议模板 / Idea template

**你想做什么 / What are you trying to do:**
**现在卡在哪 / What gets in the way today:**
**你设想的样子 / What you imagine:**

给喜欢的建议点 👍，我会按票数和可行性排优先级。
React with 👍 to ideas you want. Votes help set priorities.
```

### 4.7 First announcement (`#公告-announcements`)

```text
🎉 Tuck 社群开张啦！

这里是 Tuck 首批用户的大本营。Tuck 还在早期，你的每一条反馈都会直接影响它接下来长成什么样。

• 下载：<GitHub Releases 链接>
• 用法：#新手指南-start-here
• 反馈：#反馈-feedback（英文请去 #english）

前 50 位在社群里反馈的朋友会获得「Founding Tucker 首批用户」身份 🧡

—

🎉 The Tuck community is open!
This is home for Tuck's first users. Tuck is early, and your feedback directly shapes what comes next.
Download: <GitHub Releases link> · Feedback in English: #english
The first 50 people who share feedback get the Founding Tucker role 🧡
```

---

## 5. GitHub releases → `#公告` (no bot)

1. Discord: `#公告-announcements` → Edit Channel → Integrations → Webhooks → New Webhook → name it `GitHub` → Copy Webhook URL.
2. GitHub: `BayarBH/tuck` → Settings → Webhooks → Add webhook.
   - Payload URL: the copied URL **with `/github` appended**.
   - Content type: `application/json`.
   - Events: "Let me select individual events" → only **Releases**.
3. Publish a release; it appears in `#公告` automatically.

Treat the webhook URL like a password: anyone with it can post to the channel.

---

## 6. Linking the community from Tuck (after the invite exists)

Send the permanent invite link to the developer. It will be added to:
- the tray menu ("Join the community");
- the last step of the first-run tutorial;
- the "Report a problem" dialog (Discord or GitHub issue);
- the landing page (`docs/index.html`) and `README.md`.

Links open in the user's browser. Tuck itself still makes no network request.

---

## 7. A light weekly rhythm for the founder

| When | What | Time |
|---|---|---|
| Daily | Reply in #反馈 and #english within 24 h, even just "got it, looking into it" | 10 min |
| Each release | Changelog in #公告; thank by name whoever reported the fixed bugs | 10 min |
| Weekly | Hand out Founding Tucker roles; move recurring questions into #新手指南 | 10 min |
| Optional, monthly | 20-minute voice chat with a few active users | 20 min |

Signals that it's time to split `#反馈` into `#bug反馈` + `#功能建议`, or open `#摘录分享`: more than ~10 messages a day in a channel, or people asking where to post.
