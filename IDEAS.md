# Ideas (later, not the next version)

Longer-range possibilities recorded on 2026-10-17. None of these are planned for the next version;
revisit them after v0.1 has real users and feedback. Grouped by direction.

## 1. More ways to capture (extend "copy = capture" to more situations)

- **Screenshots / images**: select a screen region or copy an image; it flies into the bar like text and is saved to an attachments folder next to the notes.
- **PDF / e-books**: when copying from a reader, keep the page number, so the note records "which book, which page".
- **Phone companion**: share to Tuck on the phone; entries reach the same `.md` through a synced folder (OneDrive / iCloud). Tuck itself still runs no cloud service.

## 2. Organize and review (where excerpts actually create value)

- **Spaced repetition**: turn excerpts into review cards and resurface one every few days, like Readwise's daily review.
- **Topic pages**: per tag, generate a page such as "every line I kept about #attention", ready to use when writing.
- **Writing mode**: search your own excerpts while writing and insert one with its source in one step.

## 3. Specific audiences

- **Students / researchers**: citation export (APA, BibTeX). Together with "save the source link", this makes a lightweight reference-excerpt tool.
- **Writers / content creators**: turn an excerpt into a quote card image for 小红书 or X. The notebook already has "Copy as image"; this would add good-looking templates.
- **Language learners**: when capturing a foreign-language sentence, note the new words too. Fits the developer's own Mongolian and Japanese background.

## 4. Ecosystem and integrations

- **Obsidian / Logseq / Notion plugins**: make Tuck the capture entry point for these tools and reach their user bases.
- **Open format**: stay plain Markdown that any tool can read. This is a selling point in itself.

## 5. Business model (if monetizing)

- **Free core + paid Pro**: capture stays free forever; review, card templates and citation export go into Pro. A one-time purchase suits a small local tool better than a subscription.
- **Open source + sponsorship**: GitHub Sponsors / 爱发电 (afdian). Good for building reputation early.

## 6. More directions (added 2026-10-17, after "keep lists")

- **The home for the best parts of AI chats** (strongest bet): with the page link and kept lists, Tuck already saves AI answers better than screenshots or bookmarks. Pitch: "double-tap Ctrl+C on the best part of any AI answer; it's kept with the chat link, in your own Markdown." Small extras: recognize ChatGPT / Claude / Gemini pages and label the note with the AI's name.
- **Let AI read your notes back**: a small MCP server or Claude skill over `tuck.md`, so an assistant can answer "what have I saved about attention?" or write from your excerpts. Cheap, since the format already exists, and nothing leaves the computer.
- **Import highlights from elsewhere**: Kindle (`My Clippings.txt`), WeChat Read (微信读书), PDF annotations, all into the same `tuck.md`.
- **Weekly digest**: on Sunday, "what you kept this week", grouped by tag. A lighter form of review than full spaced repetition.
- **Tuck as content for 小红书**: "sentences I kept this week" posts made from your own notes. Not a feature; it feeds the developer's 小红书 and brings users to Tuck.
