# 摘录本 — 需求规格（用户原文，冻结）

## 一、产品目标

我在读 AI 回复、文章时，想"不打断阅读"就把好句子收进一个 Markdown 文件，事后整理。
核心交互：**复制即收录**，并且能在复制的当下顺手写一句自己的想法。
视觉参考：Wispr Flow——屏幕底部一个极简小条，需要时才出现，有一个把文字"抛进小条"的动画。

## 二、交互规格（以此为准）

触发只认 **Ctrl+C**，平时单次 Ctrl+C 必须完全不受影响、不记录（避免误收密码等）。

1. **双击 Ctrl+C**（两次独立按下，间隔 < 1000ms）→ 静默收录原文。
   - 动画：一个小"文字胶囊"从鼠标当前位置缩小飞入屏幕底部小条，小条亮一下后收起。总时长约 450–600ms。
   - 全程不抢焦点（不能让用户正在输入的窗口失去焦点）。
2. **长按 Ctrl+C**（c 键按住 ≥ 600ms，仅触发一次）→ 收录原文并展开输入。
   - 同样先飞入小条，然后小条展开成单行输入框（可自动增高到最多 4 行），自动聚焦。
   - Enter 保存（原文 + 想法）；留空 Enter = 只存原文；Esc = 都不存；Shift+Enter 换行。
   - 保存或取消后输入框收起，焦点还给原来的窗口。
3. 忽略以下情况：Ctrl+Shift+C、Ctrl+Alt+C 等带其他修饰键的组合；剪贴板为空或非文本；与上一条完全相同且距离上次保存 < 3 秒（去重，防止长按连发）。
4. 长按产生的系统按键连发（auto-repeat）不能重复触发。

## 三、输出格式

追加写入 `%USERPROFILE%\Documents\摘录本\摘录本.md`（目录和文件不存在则创建，UTF-8，首次写入加 `# 摘录本` 标题）。每条格式：

```
### 2026-10-16 23:10 · chrome.exe
> 原文第一行
> 原文第二行

**我的想法**：……
**标签**：#right_problem #产品

---
```

- 来源应用名取前台窗口的进程名（取不到就省略 ` · xxx`）。
- 想法里出现的 `#标签`（支持中英文、下划线）自动提取到"标签"行，并保留在想法正文里；没有标签就不写标签行；没有想法就不写想法行。
- 原文多行时每行前加 `> `。

## 四、技术要求

- Electron + 原生 JS（不要 TypeScript、不要前端框架），尽量少依赖。
- 全局按键监听用 **`uiohook-napi`**（Windows 有预编译包，不需要本地编译工具链）。只用它判断"Ctrl 是否按住 + c 的 keydown/keyup 时序"，**不记录、不存储、不输出任何其他按键**。uiohook 不拦截按键，所以 Ctrl+C 仍会正常复制。
- 触发时先等约 120ms 再读 Electron 的 `clipboard.readText()`，让系统先完成复制。
- 窗口设计：一个全屏、透明、无边框、`alwaysOnTop`、不在任务栏显示的覆盖窗口，覆盖鼠标所在的显示器。
  - 空闲/静默动画时：`setIgnoreMouseEvents(true, { forward: true })` + `showInactive()`，点击穿透、不抢焦点。
  - 展开输入时：关闭点击穿透并 `focus()`；结束后恢复穿透，并让原前台窗口重新获得焦点（Windows 下若 Electron 自动归还焦点不可靠，请想办法处理并在 README 里说明实现方式与局限）。
  - 飞入动画的起点用 `screen.getCursorScreenPoint()` 换算成覆盖窗口内坐标，终点是屏幕底部居中的小条（距底边约 48px，宽约 360px，圆角胶囊，半透明深色毛玻璃感，细边框，浅色文字）。动画用 CSS transition / Web Animations API，缓动要有"被吸进去"的感觉。
  - 胶囊里显示原文前约 20 个字符。
- 托盘图标（自己用 canvas 或简单 SVG 生成一个，不要依赖外部图片）：菜单项有「暂停/恢复收录」「打开摘录本」「打开所在文件夹」「开机自启（勾选）」「退出」。暂停时触发要完全忽略。
- `app.requestSingleInstanceLock()`，重复启动直接退出。
- 所有可调参数集中在 `config.js`：`LONG_PRESS_MS=600`、`DOUBLE_GAP_MS=1000`、`DEDUPE_MS=3000`、`NOTES_DIR`、小条尺寸和距底边距离。
- 不联网，不请求任何网络资源，不引入遥测。
- 主进程、按键检测模块、写文件模块、渲染层（overlay.html/css/js）分开。**按键检测做成可单测的纯逻辑状态机**（输入是 keydown/keyup 事件+时间戳，输出是 `double` / `long` 事件），并为它写几个用 `node --test` 跑的单元测试，覆盖：单击不触发、双击触发、间隔超时不触发、长按只触发一次、auto-repeat 不重复、带 Shift 不触发。

## 五、交付物

1. `npm install && npm start` 就能跑。
2. `README.md`（中文）：使用方法（双击 / 长按 / 托盘菜单）；electron-builder Windows nsis 打包命令与配置（不要求执行）；**排错清单**：uiohook-napi 加载失败；杀毒/安全软件拦截全局钩子；长按后原窗口没拿回焦点；以管理员权限运行的程序里按键监听失效的原因与处理（UIPI）；DPI 缩放导致动画起点偏移；已知局限（诚实写哪些没法验证）。

## 七、做事方式

- 遇到无法验证的 Windows 行为（全局钩子、焦点归还、DPI），不要假装验证过，写进 README 的局限和排错里。
- 不要加没要求的功能（同步、云端、AI 总结、OCR 等）。

## 八、OVERRIDE (2026-10-16, user request "要全局英文") — supersedes any Chinese strings above

Everything user-facing and in the repo is ENGLISH. The Chinese strings above are superseded:
- Product name: "Tuck" (productName "Tuck", appId com.bayar.tuck; renamed from "Excerpts" 2026-10-17).
- Output path: `%USERPROFILE%\Documents\Tuck\tuck.md` (config NOTES_DIR=.../Documents/Tuck, NOTES_FILE=tuck.md). First-write header `# Tuck`.
- Entry labels: `**My thought**: ...` and `**Tags**: #a #b` (ASCII colon + space). Tag extraction still accepts Chinese/any-script tags (\p{L}\p{N}_).
- Tray menu: "Pause capture"/"Resume capture", "Open notes", "Open folder", "Start at login" (checkbox), "Quit". Tooltips/dialogs/errors in English.
- Overlay hint: "Enter save · Esc cancel · Shift+Enter newline"; textarea placeholder "Add a thought… (#tags ok)".
- README.md in English. Code comments in English. Test names in English.
