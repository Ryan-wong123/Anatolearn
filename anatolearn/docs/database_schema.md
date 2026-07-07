# Database Schema

> Status: **Draft — database not yet built.** Based on Task 1.2's original table list, updated with confirmed requirements from 'Project Details Reference' tab under ITP Google Doc, and gaps found while reviewing the actual frontend (`Quizzes.tsx`, `Videos.tsx`). For Timothy's review before creating tables — not a final, locked spec.

---

## `users`
No changes from original Task 1.2 spec.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| name | text | |
| email | text | unique |
| password_hash | text | |
| role | text | 'student' or 'teacher' |
| program | text | Physiotherapy / Occupational Therapy / Radiography / Nursing |
| created_at | timestamp | |

---

## `anatomy_models`
No changes from original Task 1.2 spec.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| title | text | |
| description | text | |
| file_path | text | |
| file_format | text | .obj / .gltf / .glb / .usdz / .uasset |
| body_system | text | |
| body_part | text | |
| uploaded_by | uuid / int | references users.id |
| created_at | timestamp | |
| is_published | boolean | needed for Task 6.2, missing from original Task 1.2 list |

---

## `labels`
No changes from original Task 1.2 spec.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| model_id | uuid / int | references anatomy_models.id |
| name | text | |
| description | text | |
| position_x | float | |
| position_y | float | |
| position_z | float | |
| created_by | uuid / int | references users.id |
| created_at | timestamp | |

---

## `videos`
**Change from original Task 1.2 spec:** added `thumbnail` and `is_published` — both are fields the actual frontend (`Videos.tsx` `Video` interface) already expects but weren't in the original table list.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| title | text | |
| description | text | |
| file_path | text | |
| category | text | Muscular / Cardiovascular / Respiratory / Digestive / Nervous / Endocrine |
| linked_label_id | uuid / int, nullable | references labels.id |
| uploaded_by | uuid / int | references users.id |
| created_at | timestamp | |
| thumbnail | text, nullable | **added** — frontend `Video` interface has this field |
| is_published | boolean | **added** — needed for Task 6.2, missing from original Task 1.2 list |

---

## `quizzes`
**Change from original Task 1.2 spec:** added `type`, `category`, `is_published`.

**Confirmed requirement (Project Details Reference, "self assessment" section):** "assessment are practical are open ended questions, theory is mcq" — confirms quizzes need a type distinction, and "system based categories (respiratory system, Cardiovascular, etc.)" confirms the category field is a real requirement, not an extra.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| title | text | |
| description | text | |
| created_by | uuid / int | references users.id |
| created_at | timestamp | |
| type | text | **added** — 'MCQ' / 'Practical' / 'Mixed', confirmed by reference doc |
| category | text | **added** — body system, confirmed by reference doc |
| is_published | boolean | **added** — needed for Task 6.2, missing from original Task 1.2 list |

---

## `questions`
**Change from original Task 1.2 spec — restructured, not just added to.** The original spec only supports a single MCQ format (`option_a`–`option_d` + one `correct_answer`). Since the reference doc confirms Practical questions are open-ended (no fixed options), a single-format schema doesn't work for both.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| quiz_id | uuid / int | references quizzes.id |
| question_text | text | |
| question_format | text | **added** — 'mcq' or 'open_ended' |
| option_a | text, nullable | only used when question_format = 'mcq' |
| option_b | text, nullable | only used when question_format = 'mcq' |
| option_c | text, nullable | only used when question_format = 'mcq' |
| option_d | text, nullable | only used when question_format = 'mcq' |
| correct_option | text, nullable | only used when question_format = 'mcq' — which of a/b/c/d is correct |
| model_answer | text, nullable | **added** — only used when question_format = 'open_ended', since there's no fixed correct option to check against |

---

## `quiz_attempts`
No structural changes, but see open question below about scoring open-ended answers.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| quiz_id | uuid / int | references quizzes.id |
| student_id | uuid / int | references users.id |
| score | number, nullable | see open question below |
| attempted_at | timestamp | |

---

## `downloads`
No changes from original Task 1.2 spec.

| Column | Type | Notes |
|---|---|---|
| id | uuid / int | primary key |
| model_id | uuid / int | references anatomy_models.id |
| downloaded_by | uuid / int | references users.id |
| downloaded_at | timestamp | |

---

## Open Questions (for team discussion, not yet resolved)

1. **Scoring open-ended (Practical) answers:** MCQ questions can be auto-graded (compare `correct_option` to student's selected answer). Open-ended questions have no fixed correct answer to compare against — does grading require a teacher to manually review and assign a score, or is there an auto-grading approach planned? This affects whether `quiz_attempts.score` can always be calculated immediately on submit, or sometimes needs to stay null/pending until a teacher reviews it.
- Suggestion: teacher manually review and assign score.
- Reason: Open-ended answers have no single correct answer to auto-check against — free text can't be reliably graded by comparing it to a model_answer.
- Manual review is simpler and more accurate than trying to auto-grade it.
