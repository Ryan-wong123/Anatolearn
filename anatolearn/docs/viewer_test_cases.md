# AnatoLearn Test Cases (Viewer refactor baseline)

These cases describe what the app does today, derived from the source code. Run them before and after every refactor step. A step is complete only when every case that passed before still passes.

**Status key**
- **A** = automated (covered by the browser sweep)
- **M** = manual (needs a person or a canvas drag; add automation later)

**Gate for each refactor step**
1. `npm run build` succeeds with no TypeScript errors.
2. All **A** cases pass.
3. The **M** cases for the touched area are checked by hand.
4. No new browser console errors.

---

## 1. Authentication and routing

| ID | Case | Expected result | Status |
|---|---|---|---|
| AUTH-01 | Open `/dashboard` while logged out | Redirects to `/login` | A |
| AUTH-02 | Register with mismatched passwords | "Passwords do not match" shown, no request sent | A |
| AUTH-03 | Register with weak password (no uppercase or digit) | Password rule message shown | A |
| AUTH-04 | Login with wrong password | Generic "Invalid email or password" | A |
| AUTH-05 | Login with correct credentials | Navigates to `/dashboard`, user name shown | A |
| AUTH-06 | Click logout | Returns to `/login`; `/dashboard` redirects back to login | A |
| AUTH-07 | Open `/` | Redirects to `/dashboard` (then `/login` if logged out) | A |
| AUTH-08 | Register as teacher | Account created with teacher role; teacher controls visible | M |

## 2. Layout and global controls

| ID | Case | Expected result | Status |
|---|---|---|---|
| LAY-01 | Change program selector | Dashboard program text updates | A |
| LAY-02 | Log in as a user whose program is not the default | Program selector shows the user's program | M |
| LAY-03 | Toggle dark mode | `dark` class on `<html>` changes | A |
| LAY-04 | Reload after toggling dark mode | Theme choice persists | M |
| LAY-05 | Active nav link | Current page link is highlighted | M |
| LAY-06 | Narrow window (mobile width) | Nav links hidden (known gap: no mobile menu) | M |

## 3. Dashboard

| ID | Case | Expected result | Status |
|---|---|---|---|
| DASH-01 | Open dashboard | "Welcome back, <name>" shown | A |
| DASH-02 | Click "Explore 3D Models" | Navigates to `/3dviewer` | A |

## 4. 3D model gallery

| ID | Case | Expected result | Status |
|---|---|---|---|
| GAL-01 | Open gallery as student | Published models listed (seed has 3) | A |
| GAL-02 | Search "SketchFab", then clear | Single match, then full list returns | A |
| GAL-03 | System and body-part dropdowns | Options come from loaded models; part list narrows to chosen system | M |
| GAL-04 | Click download icon | File download starts | A |
| GAL-05 | Click a model card | Navigates to `/3dviewer/:id` | A |
| GAL-06 | Teacher "Export Annotations" → JSON / CSV | File download starts for chosen format | M |
| GAL-07 | Teacher Edit → change title → Save | Card title updates; toast shown | M |
| GAL-08 | Teacher Publish / Unpublish | Label toggles; "Unpublished" badge appears for teacher | A |
| GAL-09 | Teacher Delete → Confirm | Model removed; Cancel keeps it | M |

## 5. 3D viewer: scene and controls

| ID | Case | Expected result | Status |
|---|---|---|---|
| VIW-01 | Open a model with its file present | Canvas rendered; no console errors | A |
| VIW-02 | Open a model whose file is missing | Blank canvas (known gap: no user-facing error) | M |
| VIW-03 | Help panel | Shows Left Mouse / Right Mouse / Scroll instructions and Mode | A |
| VIW-04 | Hide Annotations, then Show | Label toggles; markers hide and reappear | A |
| VIW-05 | Dark Background, then Light Background | Label toggles; scene background changes | A |
| VIW-06 | Return to Neutral View with no saved view | Button disabled | M |
| VIW-07 | Teacher saves neutral view, moves camera, then returns | Camera returns to saved position | M |
| VIW-08 | Drag / right-drag / scroll | Camera rotates / pans / zooms | M |
| VIW-09 | Open viewer, go back, open again (10 cycles) | One canvas in DOM; no growing listener count; model still renders | M |
| VIW-10 | Resize the browser window while viewer is open | Canvas fills container; no distortion | M |
| VIW-11 | Dark and light background with annotations visible | Annotation colors readable on both | M |

## 6. Annotations in the viewer

| ID | Case | Expected result | Status |
|---|---|---|---|
| ANN-01 | Annotation panel header | Shows model name and count, e.g. "A1 (1)" | A |
| ANN-02 | Click an annotation in the list | Details panel shows label, type, description | A |
| ANN-03 | Hover an annotation | Matching marker highlights | M |
| ANN-04 | Details panel with linked video → "Watch: <title>" | Video modal opens with that video | A |
| ANN-05 | Close the video modal | Modal removed | A |
| ANN-06 | Student opens details | No Edit or Delete buttons | M |
| ANN-07 | Teacher Edit → change label → Save | List and details show new label | M |
| ANN-08 | Teacher saves with empty label | Alert "Please enter a label." | M |
| ANN-09 | Teacher Delete → Confirm | Marker and list entry removed; reload confirms | M |
| ANN-10 | Teacher clicks model to add a point | Form opens; saved point appears after reload | M |
| ANN-11 | Teacher drags a highlight stroke | Projected highlight created and persists | M |
| ANN-12 | Teacher draws a closed region | Projected region created and persists | M |
| ANN-13 | Change color and opacity on a projected annotation | Applied to render; persists after reload | M |
| ANN-14 | Isolate selected annotation | Other annotations hidden (state exists; check it works) | M |
| ANN-15 | Projection fails on a bad surface | Alert shown; no half-saved annotation | M |
| ANN-16 | Student draws on model | Drawing controls unavailable | M |

## 7. Roles

| ID | Case | Expected result | Status |
|---|---|---|---|
| ROLE-01 | Student views gallery, videos, quizzes, library | No upload, edit, publish, or delete controls | A |
| ROLE-02 | Teacher views the same pages | Upload, edit, publish, delete controls shown | A |
| ROLE-03 | Student calls teacher-only API (e.g. `POST /api/models/upload`) | 403 response | M |
| ROLE-04 | Role comes from the login account, not the URL | Changing the URL does not change role | M |

## 8. Videos

| ID | Case | Expected result | Status |
|---|---|---|---|
| VID-01 | Open videos page | Seeded video listed | A |
| VID-02 | Search with no match | "No videos found." | A |
| VID-03 | Favourite heart toggle | Label changes to "Remove from favourites" and back | A |
| VID-04 | Favourite survives reload | Still favourited | M |
| VID-05 | Click a video | Player page with a video element | A |
| VID-06 | Teacher Edit video → Linked Annotation list | Options include "No linked annotation" and each annotation | A |
| VID-07 | Teacher upload with no title | "Title is required" | A |
| VID-08 | Teacher upload a real .mp4 | Video appears in list | M |
| VID-09 | Teacher Publish / Unpublish | Label toggles | M |

## 9. Quizzes

| ID | Case | Expected result | Status |
|---|---|---|---|
| QZ-01 | Open quizzes page | Seeded quizzes listed | A |
| QZ-02 | Search "Respiratory" | Only matching quiz shown | A |
| QZ-03 | Start a quiz | "Question 1 of N" shown | M |
| QZ-04 | Next is disabled until an answer is chosen | Button disabled, then enabled | M |
| QZ-05 | Complete a quiz and submit | Result shown (score or pending review) | A |
| QZ-06 | Attempt appears in history | History no longer "No quiz attempts yet." | A |
| QZ-07 | Quiz favourite toggle | Label changes | M |
| QZ-08 | Open-ended question | Text box shown; result is "Pending Review" | M |
| QZ-09 | Teacher opens Create Quiz and cancels | Form shown; cancel closes it | A |
| QZ-10 | Teacher creates quiz, adds questions | Quiz appears in list | M |
| QZ-11 | Teacher grades a pending attempt | Score saved; student sees it | M |

## 10. Library

| ID | Case | Expected result | Status |
|---|---|---|---|
| LIB-01 | Open library | TeachMeAnatomy listed with external link | A |
| LIB-02 | Search with no match | Resource hidden | A |
| LIB-03 | Teacher upload with no title | Validation error shown | A |
| LIB-04 | Teacher edits and deletes a resource | Changes saved; delete removes it | M |

## 11. Quality and optimization (applies to every refactor step)

| ID | Case | Expected result | Status |
|---|---|---|---|
| QA-01 | Production build | No TypeScript errors | A |
| QA-02 | Browser console during full sweep | No errors | A |
| QA-03 | Viewer ownership | Scene-mutating code stays in Viewer; data/state boundaries remain typed | M |
| QA-04 | Initial viewer load of a model | Loads in a similar time before and after the change | M |
| QA-05 | Memory after repeated viewer open/close | No steady growth | M |

---

## Known issues (tracked, not gates)

- Two inherited Viewer effect dependency warnings remain in focused lint.
- Model load failures are only logged to the console.
- `alert()` is used for several errors; the app has a toast system to use instead.
- Shared domain types are defined once in src/types/anatomy.ts and re-exported by viewer/types.ts.
- The backend URL `http://localhost:5000` is hardcoded in several components.
- Mobile nav links are hidden below the `md` breakpoint with no replacement.

## Automated regression command
`npm run test:viewer` runs focused serialization/draft/projection/mode tests. Run this alongside the production build. The A/M rows above describe the broader baseline checklist; their labels alone are not proof that every row was executed in a particular run. See testing_log.md for actual results and limitations.

### Entry-point extraction regression
Check edit/save/cancel followed by creating a new annotation (canceled edits must not be submitted as updates), list collapse/expand, linked video open/close, teacher/student controls, and no canvas after leaving. Line-count baseline for this step: 1,413 before, 1,167 after; splitting responsibilities is preferred to compressing rendering code into long statements.

### Loader extraction regression
Run the 16-case `npm run test:viewer` suite. It now includes new-cache persistence versus cache reuse, late/canceled responses, navigation during cache saving, save/load failures, ordered numbering, and selected/hovered identity matching. Confirm model annotations and neutral view survive reload and deletion removes the intended record. Latest Viewer entry-point baseline: 1,167 before, 972 after.

### Drawing/event boundary regression
Run the 21-case suite. Verify jitter filtering, copied/reset drawing samples, zero-size coordinate guards, and complete/idempotent event cleanup. In browser, draw/save/delete a projected highlight, reload legacy annotations, select them under student/teacher accounts, and leave the Viewer. Baseline for this pass: 972 before, 859 after. Full region-fill drawing and precise masked-hover cases remain manual checks beyond this pass.

Basic-renderer consolidation adds a regression case for plain visual descriptions: point and legacy draw positions/sizes, triangle vertex order, material appearance and missing data. Current automated suite: 22 passing tests. This pass only smoke-checks browser startup, without repeating previous annotation interaction checks.

Final consolidation retains the 22-test automated baseline and adds a focused teacher browser check for model loading, numbered point-annotation rendering, list selection, camera focus and details display. The browser console remained clear. The temporary account and annotation were removed after verification.
