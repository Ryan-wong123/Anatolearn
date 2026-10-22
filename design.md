# AnatoLearn Design Reference

Current implementation, updated 22 October 2026. This document records the visual theme and interactions in `anatolearn/src`, rather than the earlier wireframe specification. Paths below are relative to `anatolearn/`. Dimensions and breakpoints are derived from source classes; browser verification scope is recorded in anatolearn/docs/testing_log.md.

## 1. Visual direction

The interface uses restrained educational dashboard styling: slate backgrounds, white or deep-slate surfaces, blue actions, rounded bordered cards, compact outline icons and clear headings. Content pages share a sticky top navigation; the model viewer replaces the normal padded page with an immersive canvas and floating translucent controls. The app supports light and dark UI themes. It does not use a sidebar or a gradient dashboard hero.

Styling is mainly inline Tailwind class lists. `tailwind.config.js` extends only font families and enables class-based dark mode. `src/index.css` imports fonts, includes Tailwind directives and adds the toast slide-up animation. There is a shared Dialog component, ContentSettings and QuestionBank; there is no shared Button/Card component or custom semantic color-token layer: the patterns below recur directly in page markup.

## 2. Theme behavior

AppContext initializes theme from localStorage key `anatolearn_theme`; absent a saved light/dark value, it checks the OS preference. It toggles `dark` on the HTML root and persists changes. Layout provides a Moon button in light mode and Sun in dark mode, with a title describing the destination theme. Auth pages inherit theme but have no separate toggle.

The viewer canvas has its own Light Background / Dark Background control. It starts light regardless of the app theme. Its scene colors are `#f8fafc` and `#0f172a`; changing that control does not change the app theme or persist it.

## 3. Color system

These are Tailwind's default palette values used in the code, not custom CSS variables.

| Purpose | Light | Dark |
|---|---|---|
| App/auth background | slate-50 `#f8fafc` | slate-800 `#1e293b` |
| Nav, cards, forms, dialogs | white `#ffffff` | slate-900 `#0f172a` |
| Muted surfaces and row hover | slate-50 / slate-100 | slate-800 |
| Primary text | slate-900 `#0f172a` | slate-100 `#f1f5f9` |
| Secondary strong text | slate-700 `#334155` | slate-300 `#cbd5e1` |
| Supporting text | slate-500 / slate-600 | slate-400 `#94a3b8` |
| Muted text/icons | slate-400 `#94a3b8` | slate-500 `#64748b` |
| Surface border | slate-200 `#e2e8f0` | slate-700 `#334155` |
| Inner divider | slate-100 `#f1f5f9` | slate-800 `#1e293b` |
| Primary button | blue-600 `#2563eb`, hover blue-700 | same solid blue |
| Link/action text | blue-600 | blue-400 `#60a5fa` |
| Active navigation | blue-50 with blue-700 text | blue-950/40 with blue-400 text |
| Error/destructive | red-600; red-50/red-200 panels | red-400; red-950/40/red-800 panels |
| Pending/unpublished | amber-50 or amber-100; amber-600/700 | amber-950/40 or amber-900/40; amber-400 |
| Favourited heart | red-500 fill and stroke | same |
| Success toast | green-600 with white text | same |
| Error toast | red-600 with white text | same |

Quiz type pills use purple for MCQ, indigo for Practical and blue for Mixed, with pale 100 backgrounds and 700 text in light mode, translucent 900 backgrounds and 400 text in dark mode. The viewer uses yellow for projected highlights and cyan for projected regions.

## 4. Typography

Google Fonts are imported in `src/index.css`: DM Sans weights 400/600/700 and IBM Plex Sans weights 400/500. Tailwind maps `font-display` to DM Sans and its default sans family to IBM Plex Sans, each with a sans-serif fallback.

| Element | Common implementation |
|---|---|
| Main content title | text-3xl (30px), bold, font-display |
| Auth brand / video title | text-2xl (24px), bold, font-display |
| Section/dialog heading | text-lg (18px), semibold, usually font-display |
| Navigation brand | text-xl (20px), bold, tracking-tight, font-display |
| Card title | text-sm or default size, semibold, often font-display |
| Body, forms, actions | text-sm (14px) |
| Metadata, small actions, pills | text-xs (12px) |
| Form section labels | text-xs, semibold, uppercase, tracking-wider |
| Dashboard metrics | text-2xl, bold, font-display |

## 5. Authenticated shell

`components/Layout.tsx` wraps protected routes in `min-h-screen flex flex-col`, with a flex-1 main Outlet. The nav is 64px tall (`h-16`), sticky at top, z-50, with a bottom border and theme-aware surface.

Its inner row is `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`, horizontally distributing:

- Brand: 32px blue rounded-lg square, white 20px GraduationCap, AnatoLearn text.
- Five icon/text links: Dashboard, 3D Viewer, Videos, Quizzes, Library; hidden below xl, with 16px icons and compact rounded-md hit areas.
- Program label and API-populated select, development role toggle, theme toggle, truncated account name, avatar icon and logout.

Program selects use a white/deep-slate background, slate-300/slate-600 border, rounded-md and 14px text. The user name is hidden below sm and capped at 140px; the brand wordmark is hidden below lg and the programme selector narrows on small screens. The Student | Teacher control appears only in Vite development builds. The avatar is a UserCircle2 button without a profile workflow.

Active links match their exact route or child-route prefix. Below xl a Menu/X toggle opens a themed dropdown containing all five navigation links; selecting a link closes it. Programme controls, theme and logout remain available in the compact header. The development role toggle is hidden below 2xl.

## 6. Page geometry and spacing

Normal content pages use `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full`. The video player uses max-w-5xl. Headers commonly align title/subtitle on the left and a teacher action on the right without a mobile stacking variant.

| Item | Current sizes |
|---|---|
| Page maximum width | max-w-7xl = 1280px; player max-w-5xl = 1024px |
| Horizontal padding | 16px; 24px at sm; 32px at lg |
| Vertical page padding | 32px |
| Section spacing | mt-6 (24px), mt-8 (32px) |
| Card corners | rounded-xl (12px) |
| Button/input corners | rounded-lg (8px), some nav/select rounded-md (6px) |
| Dashboard stat padding/gap | p-5 / gap-5 (20px) |
| Card grid gap | 16px or 20px |
| Content/list rows | px-5 py-4; compact history rows py-3 |
| Model/video thumbnail height | h-44 (176px) |
| Typical modal | max-w-md (448px), p-6; auth card p-8 |
| Viewer floating panels | w-80 (320px), max-width calc(100% - 3rem) |

## 7. Dashboard

The greeting reads “Welcome back” with the account name, followed by the selected program and “Program Overview”. Changing the programme updates text and reloads the filtered content counts/lists. Students retain access only to their assigned programme and shared content.

Teacher layout has three white/deep-slate statistic cards: Models Uploaded (blue Box), Videos Uploaded (purple Video), Quizzes Created (green Activity). Values show an em dash until fetched. Quick Actions has four bordered tiles linking to Upload New Model, Manage Annotations, Add Educational Video and Create Quiz. They navigate to management pages rather than opening forms directly.

Student layout has two metric cards: Quizzes Taken and Average Score, using BookOpen and yellow Trophy. The grid still declares three columns at sm. Recent Activity displays up to three attempts with dates, score or amber Pending Review pills. Favourites are compact video/quiz cards, up to two columns at sm, with 48px icon/thumbnail squares, truncated titles and filled red hearts. Empty activity/favourites show centered explanatory text in bordered panels. Three lower tiles link to models, videos and quizzes.

There are no implemented Study Time, Models Explored or Student Engagement metrics, and no large illustrated Continue Learning cards.

## 8. Model gallery

`/3dviewer` is the model gallery; it is not the canvas route. The header has a teacher upload action. A search input with leading Search icon and All Systems / All Body Parts selects forms a vertical filter stack below sm and a row from sm. Search is debounced 300ms. Select options derive from returned model metadata.

Cards use `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5`, p-5, rounded-xl, a slate border, blue hover border and medium hover shadow. Each card contains a 176px thumbnail or blue-tinted Box fallback, optional amber Unpublished badge, model title, system/body-part metadata, description clamped to three lines, Open Viewer text and download icon action.

Teacher footers add Edit, Publish/Unpublish, Delete, an Export Annotations dropdown for JSON/CSV and an expandable Content permissions and settings panel. This panel assigns a programme/all programmes and enables/disables downloads; download buttons reflect the saved permission for both roles. Card actions stop click propagation; the remaining card supports click/Enter/Space and navigates to `/3dviewer/:modelId`. Upload/edit use centered themed dialogs with title, description and body metadata; upload has a model file selector. Empty results render a bordered centered message.

## 9. Viewer composition

The canvas route uses a relative, full-width, overflow-hidden container with height `calc(100vh - 4rem)`, leaving room for the nav. The renderer fills an absolutely positioned mount. This differs from the old padded viewer card and fixed right sidebar.

### Floating controls

| Element | Position and appearance |
|---|---|
| Instructions | bottom/left 16px on narrow screens, top/left from md, z-20, max-width 240px, rounded-xl, border, translucent themed surface, blur, p-3 |
| Toolbar | top/right 16px (also left 16px below md), z-20, wrapping right-aligned buttons, gap-2, max-height 160px with scrolling, compact text below md |
| Annotation list | draggable, z-30, initially clamped toward right at y=190; translucent rounded-xl surface, shadow-xl and blur |
| Selected details | separate draggable panel initially toward right at y=390, same surface treatment |
| Drawing preview | pointer-transparent full-canvas SVG, z-10, cyan polyline |
| Region generation | canvas overlay, z-40, pale/dark translucent background, spinner and progress copy |

Instructions explicitly list Left Mouse: Rotate, Right Mouse: Pan, Scroll: Zoom, and current mode. Highlight/region modes add yellow/cyan guidance. There are no separate zoom/pan icon buttons in the current toolbar.

Teacher tools are Add Annotation, Draw Highlight, Region Fill and Set/Update Neutral View. Point mode switches its button to a pale red cancel state; highlight uses yellow-300; region uses cyan-300. Shared controls return to saved neutral view or automatic framing when none is saved, show/hide annotations and switch canvas background. Tool text toggles to the cancel action while active.

### Annotation panels and visuals

The list title shows model name and annotation count, a Drag hint and +/- expand control. Its scroll area is capped at 45vh. Each item is a full-width bordered button with a color dot and numbered label; selected items use a blue surface/border. Hovering items highlights the corresponding annotation. Details show label, uppercase type, scrollable description (max-h-40), optional linked-video button, Close, and teacher Move/Edit/Delete. Move enters a surface-placement mode and preserves the annotation identity and linked video.

Panels use pointer capture and dynamic left/top positioning clamped with a 12px boundary margin; dragging temporarily disables camera controls. Dynamic panel coordinates and annotation swatch colors use inline styles because they are runtime values.

Numbered canvas hotspots identify annotations. On selection/hover, the visual annotation is shown and its corresponding hotspot is hidden. New projected highlights default to yellow `#facc15` at opacity 0.32; regions default to cyan `#22d3ee` at opacity 0.24. Basic point meshes are red `#ff1a00`; legacy drawings use yellow `#ffcc00`, legacy region meshes sky `#38bdf8`, both at opacity 0.3. Badge/swatch color and a basic point's actual red mesh are separate render choices.

The form contains label and description; projected region forms include a native fill color picker, and both projection forms include an opacity slider (5–100%, 5% steps). Save/Cancel disable during saving. Some viewer validation/persistence feedback uses native alert dialogs rather than themed toast/confirmation UI.

Linked videos open in a centered max-w-2xl modal over an 80% slate backdrop, with native controls and autoplay. The header/body now use the app’s light/dark surface and text variants. Invalid IDs and model API failures have visible status/error messages; model asset-load failures display an error message. The viewer loads GLB/glTF, OBJ and USDZ; unsupported Unreal assets require export before upload.

## 10. Videos and playback

Videos has the title “Educational Videos”, supporting copy and teacher Upload Video button. A leading-icon search field (max-w-sm) filters by title. Cards use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`, rounded bordered surfaces, hover shadow and cursor-pointer.

The thumbnail region is 176px tall. Missing artwork shows a white circular play button on a slate background. Student cards have a top-right circular favourite button with an outline or filled red Heart. Teacher draft cards show Unpublished at top-left; the footer provides Edit, Publish/Unpublish, Delete and expandable programme settings. Title, two-line description and Watch Video link text sit in p-3 content.

Upload accepts MP4/WebM in a dashed bordered file area within a modal. Editing includes a linked-annotation dropdown, formatted as model title — annotation label. There is no video category filter in the current page.

`/videos/:videoId` uses a max-w-5xl layout with Back to Videos, a rounded bordered player card, black native video surface, autoplay, and p-6 title/description. Both direct playback and viewer-modal playback use native browser controls rather than a custom control bar.

## 11. Quizzes

“Self-Assessment” heads the page with supporting copy, teacher Create Quiz and a full-width leading-icon search. Search covers title/category/description. Quizzes render as compact rows in one rounded bordered list, with blue BookOpen icon/title, muted description, type pill and role actions.

Students see favourite hearts and Start Quiz. My Quiz History appears below, with dates, percentage scores or pending status and result review. Teachers see Edit Details, Edit Questions, Publish/Unpublish and View Results; the latter lists both graded and pending student attempts, including student names. The API's quiz delete method does not imply a visible delete control in these rows.

Attempt dialogs show question progress, an optional server-deadline countdown, MCQ radio-option rows or an open-ended textarea, navigation and submit controls. Time expiry automatically submits the answers. Students can reopen owned history through Review answers. Results distinguish graded and pending review; feedback uses green/red/amber surfaces. Graded results display a percentage headline; open-ended submissions show Pending Review until grading completes.

Teacher authoring uses a details dialog followed by a scrollable question editor. Per-quiz Content settings expose a 30–86400 second timer or untimed mode and programme assignment. The question editor includes a searchable reusable bank with body-system categories, independent editing/removal and Add to quiz; each existing question has Save to bank. Assessments with attempts/active sessions protect their questions from changes and display a server error if an edit is attempted. MCQ/Open-ended buttons select question format; MCQ has four options and correct-option radios, while open-ended has a model-answer textarea. Type is derived from question formats. Review dialogs list all attempts and show student/model answers with numeric grading controls. Wider editors use max-w-xl/max-w-2xl and max-h-[90vh] overflow-y-auto.

## 12. Content library

“Content Library” includes descriptive copy, teacher Upload Content and full-width search. Resources use a single bordered list, not a model/video file grid. Rows have 32px green FileText for PDF/document or blue ExternalLink for URLs, truncated title, description and optional amber draft badge.

Both roles use Visit for external URLs or Open for files, with an ExternalLink icon; these open a new tab. There is no generic Download action per library row. Teachers also have Edit, Publish/Unpublish and Delete, separated by a left border, plus expandable programme assignment settings.

The upload modal switches between file and link modes, collects title/description and either PDF/document/photo file type plus file, or an HTTP(S) URL. Photos accept PNG, JPEG and WebP. The dashed file area belongs inside the modal, not permanently above the resource list. Editing changes metadata and, for links, the URL; it does not replace an existing document.

## 13. Login and registration

Both pages use min-h-screen centered auth cards on the themed background: max-w-md, p-8, rounded-xl, border and shadow-sm. A 48px blue logo tile with white GraduationCap, centered AnatoLearn heading and short subtitle precede the form. Fields are stacked with space-y-4; submit is full-width blue.

Login has email/password and a generic inline error panel. There is no show/hide password control or wireframe hint. Registration has full name, email, password, confirmation, role and API-populated program selectors, password guidance, inline validation and a Create account button. It returns to Login after success. Footer links connect the two pages.

## 14. Reused interaction patterns

These class recipes describe common usage; actual files include small variations.

```text
Primary action
  bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium
  hover:bg-blue-700 transition-colors

Surface/card
  bg-white dark:bg-slate-900 rounded-xl
  border border-slate-200 dark:border-slate-700

Secondary action
  border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2
  bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300
  hover:bg-slate-50 dark:hover:bg-slate-800

Input
  w-full px-3 py-2 rounded-lg text-sm
  bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
  border border-slate-200 dark:border-slate-700
  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500

List row
  px-5 py-4 flex items-center gap-3 or gap-4
  border-b border-slate-100 dark:border-slate-800 last:border-b-0
  hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
```

Primary buttons sometimes have icon/text gaps. Secondary page links use color transitions; media cards use shadow transitions; model cards also change border color. Busy buttons reduce opacity and change cursor, with labels such as Uploading…, Signing in… and Saving…. Focus rings are present on many inputs and the annotation form, and global button/link/select focus-visible rings supplement page-specific states.

## 15. Dialogs, notifications and stacking

Standard page dialogs are fixed inset-0, z-50, centered with p-4 over bg-slate-900/50. Panels are themed, rounded-xl and bordered, usually max-w-md/p-6. Wider quiz dialogs scroll within 90vh. Dialog is the shared wrapper for these overlays: role=dialog, aria-modal, heading labelling, initial focus, Tab trapping, Escape closing and return focus. Annotation saving can prevent dismissal while busy.

ConfirmProvider renders a max-w-sm, p-6 shadow-xl dialog at z-90, with Cancel and either blue or destructive red confirmation. ToastProvider renders a bottom-right stack 16px from both edges at z-100; toasts use px-4 py-3, rounded-lg, shadow-lg and white 14px medium text. They disappear after three seconds. The custom slide-up animation lasts 0.2s, moving 12px while fading in.

Within the viewer: preview z-10, instructions/toolbar z-20, panels/status z-30, generation z-40 and dialogs z-50. Layout nav is also z-50, so standard dialogs share its stack level; this is not a dedicated modal stacking system.

## 16. Responsive breakpoints

Tailwind defaults apply: sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px.

| Area | Below sm | sm | md | lg / xl |
|---|---|---|---|---|
| Page horizontal padding | 16px | 24px | 24px | 32px at lg |
| Nav links | mobile dropdown | mobile dropdown | desktop links visible | desktop links visible |
| User name | hidden | visible | visible | visible |
| Dashboard metrics | 1 column | 3 columns, even for two student cards | same | same |
| Teacher quick actions | 1 column | 2 columns | same | 4 columns at lg |
| Student favourites | 1 column | 2 columns | same | same |
| Student study links | 1 column | 3 columns | same | same |
| Model cards | 1 column | 1 column | 2 columns | 3 columns at xl |
| Video cards | 1 column | 2 columns | same | 3 columns at lg |
| Model filters | vertical | horizontal | horizontal | horizontal |
| Viewer panels | floating, width-constrained and clamped at every size | same | same | same |

The former mobile slide-over/fixed-desktop viewer panel distinction is not implemented. The toolbar wraps/scrolls, instructions move to the bottom-left on narrow screens and the annotation list starts lower to leave room for tools. Panels remain draggable and can still overlap after user positioning. Quiz/library rows and header actions wrap at small widths. Video empty-state markup uses col-span-3 even when the nominal grid has fewer columns. These are implementation limits requiring browser checks, not guarantees of complete responsive support.

## 17. Role presentation reference

| Surface | Student | Teacher |
|---|---|---|
| Dashboard | quiz metrics, activity, favourites, study links | content counts, four management links |
| Model gallery | published-list request, view, download | programme-filtered teacher list, upload/edit/publish/delete/export, programme/download settings and permitted download |
| Viewer | navigate, inspect annotations, linked video, visibility/background, neutral return | same plus annotation tools/movement/edit/delete and neutral-view save |
| Videos | published-list request, play, favourites | upload/edit/link/publish/delete/play |
| Quizzes | published-list request, attempt/history/results/favourites | create/edit/questions/bank/publish/timer/programme/all results/grading |
| Library | published-list request, Open/Visit | upload/edit/publish/delete plus Open/Visit |

These controls read AppContext role; the development role preview does not grant backend permissions. Programme names are dynamic filter/assignment data; they do not select different visual themes.

## 18. Icons and current design limits

Lucide provides most icons: GraduationCap, Box, Video, BookOpen, Library, UserCircle2, LogOut, Sun/Moon, Search, Upload/Download, FileJson/FileText, ExternalLink, Heart, Play, Trophy, Activity, Clock and X. Common sizes are 16px for actions/navigation, 20px for controls, 24px for metrics, and 32–40px for resource/model fallbacks. The viewer also contains an inline SVG play mark, SVG drawing preview and text +/- controls.

Keyboard-activatable model/video cards, shared focus rings, mobile navigation and Dialog focus/Escape/return-focus behavior are implemented. Some legacy field labels and native alerts still need broader accessibility review; no certification or complete cross-browser/mobile matrix is claimed. SVG drawing previews and a few legacy inline icons remain. Full implementation/verification details are in Architecture.md and anatolearn/docs/testing_log.md.


## Responsive verification follow-up — 22 October 2026

Desktop navigation starts at xl (1280px); the compact menu remains available on tablets. The brand wordmark and development role preview start at 2xl. This prevents the 768px header from forcing horizontal overflow. The logo link has an accessible name, and all four content search fields have explicit accessible labels. A dev-only responsive-qa.html harness provides 375/768/1440px iframe viewports; it is excluded from production output. Both roles passed a five-page overflow/alt-attribute smoke check in in-app Chromium. The viewer route shows a themed loading status while its lazy chunk loads.


## Viewer feedback follow-up — 22 October 2026

The viewer displays loading status through geometry and annotation readiness; toolbar controls are disabled during loading and moves. Moving an annotation has a separate status message. Empty geometry, unavailable WebGL and failed asset/annotation reads show visible errors. Annotation label/description/colour/opacity controls have accessible names. Validation and save errors remain in the form; neutral-view/projection/delete feedback uses themed success/error toasts announced as status/alert. Near-collinear region gestures ask the teacher to draw an enclosed area. Canvas picking supports numbered hotspots and excludes orbit drags. Neutral reset immediately stops residual camera motion.
