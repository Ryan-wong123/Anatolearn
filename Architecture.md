# AnatoLearn Technical Architecture

Implementation reference, updated 22 October 2026. Paths are relative to `anatolearn/` unless stated otherwise. This document describes implemented behavior; PRD.md remains the product requirements reference and coding_guidelines.md contains engineering constraints.

## 1. System overview

AnatoLearn combines a React learning/authoring interface, an Express API, PostgreSQL metadata, and locally stored teaching files. Students explore annotated models, watch videos, take assessments and open programme-specific resources. Teachers manage publication, programme assignment, download permissions, annotations, question banks and grading.

```text
Browser (same origin)
  AppProvider -> ToastProvider -> ConfirmProvider -> BrowserRouter
    ProtectedRoute -> Layout -> shared student/teacher pages
    API client: Bearer JWT + HttpOnly media-session cookie
    Viewer: local scene/resources + geometry and UI helpers
         |
         | /api, /models, /videos/<file>, /resources, /thumbnails
         v
Vite development/preview proxy (production requires equivalent reverse proxy)
         |
Express
  access.js: authentication + publication/programme/download policy
  server.js: content/account endpoints and authenticated file delivery
  assessments.js: timed sessions, transactional submission/grading
  quizQuestions.js: locked question mutations and historical-result protection
  questionBank.js: reusable bank records and independent quiz copies
  storage.js: local root, safe paths, validation, glTF dependency ownership
         |
  pg.Pool -> PostgreSQL 16        filesystem under PUBLIC_DIR
```

There is no public static teaching-file middleware. Vite's public directory is disabled so a production build does not copy uploaded files into its output; development filesystem deny rules also block alternate `/public` and `/@fs` paths to teaching files/backend configuration.

## 2. Stack and runtime

| Area | Manifest/configuration |
|---|---|
| UI | React / React DOM ^19.2.6, TypeScript ~6.0.2 |
| Navigation | react-router-dom ^7.17.0, BrowserRouter |
| Build | Vite ^8.0.12, React plugin ^6.0.1 |
| Styling | Tailwind ^3.4.19, PostCSS/Autoprefixer, Google Fonts |
| Rendering | Three.js ^0.184.0; OrbitControls, GLTFLoader, OBJLoader, USDLoader, DecalGeometry |
| Icons | lucide-react ^1.18.0; some SVG drawing/legacy icons remain |
| Backend | Node 22 containers, Express ^4.21.2, cors, dotenv |
| Authentication | jsonwebtoken ^9.0.2, bcryptjs ^2.4.3 |
| Persistence | PostgreSQL 16, pg ^8.13.1, Multer ^2.2.0, local files |

Versions are declared dependency ranges. `npm run build` runs TypeScript then Vite; `npm run lint` runs ESLint. Frontend tests are `test:viewer` and `test:models`; backend scripts are `test` and `test:integration`. TypeScript uses ES2023, bundler resolution and no emit; strict mode is not enabled.

## 3. Source responsibilities

| Path | Responsibility |
|---|---|
| src/main.tsx | React root, StrictMode and global CSS |
| src/App.tsx | provider composition and route tree |
| src/api/api.ts | same-origin JSON/multipart calls, bearer headers, selected-programme header, downloads and session-expiry notification |
| src/context/AppContext.tsx | identity/session, programme selection and theme provider |
| src/context/AppContextState.ts | AppContext definition, identity types and useAppContext hook |
| src/context/ToastContext.tsx / ToastContextState.ts | provider plus separate context/hook definitions for transient notifications |
| src/context/ConfirmContext.tsx / ConfirmContextState.ts | promise-based confirmation provider plus separate context/hook definitions |
| src/components/Layout.tsx | authenticated navigation, mobile menu, programme/theme/account controls and Outlet |
| src/components/ProtectedRoute.tsx | frontend token-presence guard |
| src/components/ContentSettings.tsx | teacher programme assignment, model download controls and quiz timer settings |
| src/components/QuestionBank.tsx | searchable bank, body-system category editing, import and removal |
| src/components/Dialog.tsx | dialog semantics, initial focus, focus trap, Escape and focus restoration |
| src/components/viewer/ | viewer overlays, data/editor hooks, sampling, serialization and projection helpers |
| src/types/anatomy.ts | shared model/annotation/payload/geometry types |
| backend/src/access.js | JWT extraction/verification and content policy predicates |
| backend/src/server.js | Express setup, content/account routes and asset access checks |
| backend/src/assessments.js | assessment sessions, validation, transactional submission/grading |
| backend/src/quizQuestions.js | locked question CRUD, derived quiz type and edit guards |
| backend/src/questionBank.js | teacher-only reusable bank and copy-to-quiz endpoints |
| backend/src/storage.js | local root/path resolution, model/resource validation and glTF reference checks |
| backend/src/db.js | dotenv configuration and pg.Pool |
| backend/sql/001..008 | initialization, seed data and additive schema changes |
| backend/tests/ | policy/integration tests and disposable browser-fixture tooling |
| tests/ | focused viewer-helper and model-parser regressions |
| docs/ | setup, API, database, storage, formats and verification records |

Provider components are separate from context/hook definitions so development hot reload does not replace a context while retaining consumers of the old object. These files share one context per concern. Pages consume contexts and the API client; they do not import other pages.

## 4. Routing and shell

Provider order is AppProvider -> ToastProvider -> ConfirmProvider -> BrowserRouter. Public routes sit outside Layout; protected routes share its navigation shell.

| Route | Component |
|---|---|
| / | redirect to /dashboard |
| /login, /register | Login, Register |
| /dashboard | Dashboard |
| /3dviewer | ModelGallery |
| /3dviewer/:modelId | Viewer |
| /videos | Videos |
| /videos/:videoId | VideoPlayer |
| /quizzes | Quizzes |
| /library | Library |

There are no role-specific frontend routes. ProtectedRoute checks token presence; the backend verifies JWT validity and authorizes content. A JSON API 401 clears stored frontend identity and notifies AppProvider, causing protected content to redirect to Login. There is no refresh-token flow.

Layout uses pathname equality or a child-path prefix for active navigation. A hamburger menu exposes all five sections below md; account controls adapt to narrow widths. Shared Dialog wrappers trap keyboard focus, close through an explicit callback on Escape, and restore the invoking element's focus.

## 5. Identity, global state and session delivery

Registration accepts name, normalized email, password, student/teacher role and optional programme ID. It stores a bcrypt hash and returns an account, then the UI navigates to Login. Login returns `{ token, user }`; the JWT includes id, name, role and program_id, with a 24-hour expiry. Teacher self-registration remains available; there is no invitation/approval workflow.

Login also sets `anatolearn_session`, an HttpOnly, SameSite=Lax cookie with a 24-hour maximum age and Secure in production. The cookie allows native image/video/document and model dependency requests to authenticate without URL tokens. API callers may use the Bearer header; it takes precedence over the cookie. Logout clears the cookie and frontend session storage. JWTs remain stateless: previously copied bearer tokens are not centrally revoked before expiry.

| State | Ownership/persistence |
|---|---|
| token/user | AppProvider; sessionStorage anatolearn_token / anatolearn_user |
| role | login response/stored user; development-only UI preview can change it |
| program | selected display name; sessionStorage anatolearn_program, synchronized to account programme when Layout initializes |
| theme | localStorage anatolearn_theme, initially OS preference or light; HTML root dark class |
| notifications | ToastProvider, three-second success/error queue |
| confirmation | ConfirmProvider, one pending choice |
| filters/forms/assessment/annotation UI | page-local state or viewer hooks |

The frontend still does not decode JWT claims. Identity for presentation comes from the login response; backend authorization uses verified JWT claims. The development role preview never alters backend permissions. The viewer canvas background remains a separate local light/dark option.

## 6. Publication, programme and download policy

`canRead` allows teachers to inspect content and drafts across programmes. Students can read only published records whose program_id matches their authenticated account, or whose program_id is null (shared content). This policy applies to lists, direct model/video reads, annotations, quiz questions/start/submit and asset requests; it is not dependent on a client `published=true` parameter.

The API client sends the selected programme name in an encoded `X-Program-Name` header. List responses additionally filter to that programme plus shared records. A selector change reloads page lists and dashboard counts. Selecting another programme does not grant a student access beyond their account programme. Teachers can use ContentSettings to assign models, videos, quizzes and resources to a programme or to all programmes. Changing this assignment does not change the account's programme.

Models have `is_downloadable`, default false. The download endpoint requires both read access and the flag, for students and teachers. Gallery buttons reflect the permission and teachers can enable/disable it. Viewing and downloading are separate application permissions; allowing WebGL rendering necessarily delivers model bytes to an authenticated browser. This is not DRM and cannot prevent a viewer from extracting received bytes.

Attempt detail/answer reads require the owning student or a teacher. All student history queries use the authenticated user ID. Thumbnail writes are teacher-only. Student favourites accept only accessible content and reads exclude unpublished or other-programme records. Content-deletion triggers remove related favourite rows.

## 7. HTTP and asset delivery

API_BASE is `/api`; assets use relative same-origin paths. apiFetch includes credentials, Bearer headers and selected-programme headers, handles JSON/multipart content types, and surfaces backend messages. Downloads use authenticated blob fetches, Content-Disposition filenames, temporary object URLs and cleanup.

CORS allows configured FRONTEND_ORIGINS, credentials and Content-Disposition exposure. Unsafe requests with an untrusted Origin are rejected. Default development origins are localhost ports 5173 and 4173. Express 4 route registration wraps promise-returning handlers so failures reach the JSON error middleware; upload/validation failures return client errors, unexpected failures a generic 500.

Assets under /models, /videos, /resources and /thumbnails require authentication and a readable owning database record. Legacy glTF companions are permitted only when referenced by an accessible stored glTF model. Path resolution remains inside PUBLIC_DIR. Responses use private/no-store cache controls and nosniff; sendFile retains byte-range support for native media playback. There is no unrestricted static-file fallback.

## 8. Pages and teacher workflows

| Page | Implemented behavior |
|---|---|
| Dashboard | student attempt metrics, recent activity and favourites; teacher filtered content counts and management links |
| ModelGallery | 300ms debounced title/description/system/part search, metadata filters, keyboard-activatable cards, preview, upload/edit/publication/delete, download and annotation export; programme/download settings |
| Videos | local title search, playback, student favourites; teacher upload/edit/publication/delete, annotation linking and programme assignment |
| VideoPlayer | dedicated native player, MP4/WebM source types, visible loading failure |
| Quizzes | student timed/untimed attempts, scores, history and owned answer review; teacher authoring, question-bank copies, timer/programme settings, all student results and manual grading |
| Library | searchable PDF/document/photo/link resources; teacher upload/metadata editing/publication/delete/programme assignment; authenticated Open and external Visit |

Gallery cards support Enter/Space without intercepting nested controls. Headers and list rows wrap at narrow widths. Inputs and actions have shared focus-visible treatment. Some legacy viewer feedback still uses native alert dialogs; the application does not claim complete accessibility certification.

## 9. Viewer ownership and lifecycle

Viewer.tsx owns scene, camera, renderer, controls, source model/meshes, annotation markers, numbered sprite hotspots, hit targets and pending visuals through refs. React state holds annotations, interaction mode, selection, visibility and form/overlay state. No scene singleton or Three.js object is stored in React state.

| Module | Boundary |
|---|---|
| useViewerContent | route validation, model/video API data, stale-response protection, neutral-view persistence |
| useAnnotationEditor | draft/form state, save lock, create/update/delete calls, scene-epoch/mounted guards |
| ViewerOverlay / panels | presentational composition, list expansion, linked video and drag callbacks |
| drawingSamples / useDrawingSamples | plain screen/world/mesh-index samples and preview state |
| bindViewerEvents | DOM subscriptions and unsubscribe closure |
| annotationMapping | persisted/runtime kinds, payloads, draft defaults, identity matching |
| loadViewerAnnotations | ordered loading/render callbacks and newly generated cache persistence |
| basicAnnotationVisuals | plain descriptions for legacy/point visuals |
| projectedMaskData | camera snapshot, projector bounds and normalized mask data |
| projectedMask | alpha canvases, decal geometry/filtering/cache, painted-pixel hit testing and disposal |
| createAnnotationBadge | badge canvas; Viewer owns resulting sprite texture/material |

Projection helpers contain Three.js operations but no global scene state. Scene/resource ownership remains in Viewer; this differs from the older literal single-file guideline.

The lifecycle effect creates a 75-degree perspective camera, antialiased renderer with pixel ratio capped at 2, damped OrbitControls, ambient/directional lighting and the model loader. GLTFLoader handles GLB/glTF, OBJLoader handles OBJ and USDLoader handles USDZ. The model is framed or restored to its saved neutral view. Reset falls back to computed framing even if no neutral view has been saved. Only teachers generate missing thumbnails.

Drawing modes are view/point/highlight/region. Projection stores normalized mask points, projector orientation/position/size and the dominant source mesh. Decal geometry is filtered to the first visible surface, cached as arrays in JSONB and restored on reload. If filtering rejects every triangle, the helper retains the unfiltered fallback. Students can render old uncached annotations without attempting teacher-only cache writes.

Teachers can move an existing annotation by choosing Move and clicking a new surface position. The anchor and legacy geometry are translated; projected geometry is regenerated against the hit source mesh. Annotation IDs and video links remain intact. Stale save responses are ignored. Selection/hover reveals the corresponding visual; list items and numbered hotspots expose label identity and details/video actions.

Cleanup advances the scene epoch, cancels animation/thumbnail frames and region timers, unsubscribes events, clears hit targets/pending/annotation resources, disposes model geometry/materials/textures and controls/renderer, removes the canvas and clears refs. Late model loads dispose their results. The animation loop updates controls and renders without React state changes. Two existing exhaustive-dependency warning sites remain and are recorded in the test log.

## 10. Assessments and question bank

Teachers configure an optional time_limit_seconds between 30 and 86400. Starting a student attempt creates a UUID quiz_sessions row with student/quiz IDs, server start/deadline and a complete question snapshot. The response omits answer keys. The timer UI counts down to the server deadline and automatically submits on expiry; the backend accepts a ten-second transport grace and rejects later submissions. Untimed sessions have a null deadline. Cancel/navigation closes the session through an authenticated keepalive request when possible.

Submission requires the owner's unused session and exactly one answer per snapshot question. Unknown/duplicate/missing questions and invalid MCQ options are rejected; unanswered questions are represented explicitly and score zero. A transaction locks the session, inserts the attempt and every answer, and consumes the session. Failures roll back everything; duplicate submission is rejected. MCQs grade immediately; open-ended questions set pending_review.

Manual grading accepts only open-ended answers with finite scores from 0 to 100. It locks the parent attempt, updates the answer and recalculates the overall question-weighted percentage in one transaction when all open-ended answers have scores. Student history/review uses owner-authorized endpoints. Teacher View Results lists both graded and pending attempts with student names.

Question mutations use a parent-quiz lock and transaction. Starting an assessment takes a shared parent lock while snapshotting, so concurrent edits cannot invalidate that snapshot. Quizzes with attempts or active sessions reject question edits/deletes/imports with 409; teachers create a new quiz for revised assessments. Quiz type is derived from its question formats.

The teacher-only question bank stores independent MCQ/open-ended questions with body-system categories. Teachers save existing quiz questions to the bank, search/edit/remove bank records and copy them into other quizzes. Editing/deleting a bank item does not change its previously imported quiz copies.

## 11. Database and migration history

| Table | Purpose |
|---|---|
| programs, users | programme names and hashed-password role accounts |
| models | paths, publication, programme/system/part, thumbnail, neutral view and download permission |
| annotations | model FK, point/highlight/region_fill type, text/color and geometry JSONB |
| videos | media path, publication/programme, optional annotation FK |
| quizzes, quiz_questions | assessment metadata/timer and per-quiz questions/category/answer keys |
| quiz_sessions | UUID, student/quiz, question snapshot, start/deadline/consumption |
| question_bank | independent reusable questions and body-system categories |
| quiz_attempts, quiz_attempt_answers | owner, score/status, responses and grading |
| resources | pdf/document/image/link, path or URL, publication/programme |
| downloads | best-effort authenticated model-download audit |
| favorites | unique user/type/item reference, cleaned by content-deletion triggers |

Shared types remain in src/types/anatomy.ts and are re-exported by components/viewer/types.ts. Runtime annotation kinds include point/draw/region/projectedDraw/projectedRegion; database kinds are point/highlight/region_fill. Projection cache, opacity and view data live in annotation_data JSONB.

Fresh PostgreSQL volumes run 001 schema, 002 seed, 003 users, 004 model metadata/download audit, 005 attempt owners, 006 video links, 007 favourites and 008 access/assessments. Existing volumes must apply additive scripts explicitly; 008 has been applied to the local development database. Do not rerun destructive 001/002 initialization scripts against existing content. Existing models begin with downloads disabled; existing quizzes remain untimed. The original seed dataset is unchanged and still differs from PRD prototype fixtures.

## 12. File storage and deployment

| Asset | Directory under PUBLIC_DIR | Upload support | Limit |
|---|---|---|---|
| Models | models/anatomy | GLB 2.0, embedded glTF 2.0, OBJ, USDZ | 200 MiB |
| Videos | videos | MP4/WebM | 200 MiB |
| Materials | resources | PDF, DOC/DOCX, PNG/JPEG/WebP; HTTP(S) links store URL | 50 MiB |
| Thumbnails | thumbnails/model-ID.png | teacher PNG-data submission | 10 MB JSON request limit |

Upload filenames use UUIDs. Model validation checks GLB structure headers, glTF version/embedded dependencies, OBJ vertices/faces or USDZ archive signature. Material validation checks selected type, extension and basic file signatures. Legacy local glTF companions can be served through ownership checks; new multi-file glTF uploads must be converted to GLB or embedded glTF. OBJ currently loads geometry without a companion MTL upload workflow. USDZ support depends on the installed USDLoader's format subset; Unreal .uasset is rejected with an export-to-GLB instruction. See docs/3d_model_tools.md.

storage.js centralizes the configured local root, safe resolution and validation, but local Multer/fs operations still remain in server.js. A full cloud storage adapter is future work. Database deletion generally does not delete old uploaded files automatically; backup/recovery and orphan-file maintenance remain separate operational work.

Compose runs PostgreSQL 16 and Node 22 frontend/backend development services on 5432/5173/5000. PUBLIC_DIR=/public points to the mounted frontend public directory; outside Docker the default is backend/public. The frontend uses BACKEND_URL=http://backend:5000; local Vite defaults to localhost:5000. Polling watch modes support Windows bind mounts. DATABASE_URL, JWT_SECRET, PORT and FRONTEND_ORIGINS configure backend behavior. Compose uses development credentials/secrets and no database readiness health check.

Production must serve the SPA/build plus the same-origin authenticated API/asset routes, preserve Range and cookie headers, configure HTTPS/Secure cookies/origins/secrets, and never expose PUBLIC_DIR through a separate static server. Vite preview is a verification server, not the production deployment architecture.

## 13. Verification and remaining limits

Current checks include TypeScript/Vite build, ESLint, 22 viewer helper tests, two OBJ/USDZ parser tests and database-backed policy/assessment integration tests. Browser QA covers teacher/student flows, native media, OBJ viewing/label movement, permissions, programme filtering, timed MCQ submission/history/review and keyboard dialog behavior. Exact evidence, counts and scope are in docs/testing_log.md.

Remaining limits include the large viewer bundle warning, two viewer effect-dependency warnings, incomplete general API response typing, native alert feedback in parts of the viewer, no exhaustive Chrome/Edge/Firefox/Safari sweep, no full four-programme browser matrix, no GPU/concurrency performance certification, no binary USDC/USDZ compatibility matrix, and legacy requirements such as embedded annotation exports/cloud adapters that are outside this change. Documented current behavior does not waive unmet PRD requirements.
