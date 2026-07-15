const API_BASE = "http://localhost:5000/api";

async function request(endpoint: string) {
    const res = await fetch(`${API_BASE}${endpoint}`);

    if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
    }

    return res.json();
}

export const api = {
    getPrograms: () => request("/programs"),
    getModels: () => request("/models"),
    getModel: (id: number) => request(`/models/${id}`),
    saveModelThumbnail: (id: number, thumbnailDataUrl: string) =>
        fetch(`http://localhost:5000/api/models/${id}/thumbnail`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thumbnailDataUrl }),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),
    getVideos: (publishedOnly?: boolean) =>
        request(`/videos${publishedOnly ? '?published=true' : ''}`), getVideo: (id: number) => request(`/videos/${id}`),

    uploadVideo: (data: { title: string; description?: string; program_id?: number; file: File }) => {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        if (data.program_id) formData.append('program_id', String(data.program_id));
        formData.append('video', data.file);

        return fetch(`http://localhost:5000/api/videos/upload`, {
            method: 'POST',
            body: formData,
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        });
    },

    deleteVideo: (id: number) =>
        fetch(`http://localhost:5000/api/videos/${id}`, {
            method: 'DELETE',
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    publishVideo: (id: number, isPublished: boolean) =>
        fetch(`http://localhost:5000/api/videos/${id}/publish`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_published: isPublished }),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    updateVideo: (id: number, data: { title: string; description?: string }) =>
        fetch(`http://localhost:5000/api/videos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    getQuizzes: (publishedOnly?: boolean) =>
        request(`/quizzes${publishedOnly ? '?published=true' : ''}`),

    deleteQuiz: (id: number) =>
        fetch(`http://localhost:5000/api/quizzes/${id}`, {
            method: 'DELETE',
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    getQuizQuestions: (id: number) => request(`/quizzes/${id}/questions`),

    getResources: () => request("/resources"),

    getAnnotations: (modelId: number) =>
        request(`/models/${modelId}/annotations`),
    createAnnotation: (
        modelId: number,
        data: {
            annotation_type: 'point' | 'highlight' | 'region_fill';
            label: string;
            description: string;
            color?: string | null;
            annotation_data: object;
        }
    ) =>
        fetch(`http://localhost:5000/api/models/${modelId}/annotations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    deleteAnnotation: (id: number) =>
        fetch(`http://localhost:5000/api/annotations/${id}`, {
            method: 'DELETE',
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),
    updateAnnotation: (
        id: number,
        data: {
            annotation_type: 'point' | 'highlight' | 'region_fill';
            label: string;
            description: string;
            color?: string | null;
            annotation_data: object;
        }
    ) =>
        fetch(`http://localhost:5000/api/annotations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    createQuiz: (data: {
        title: string;
        description?: string;
        type: 'MCQ' | 'Practical' | 'Mixed';
        category?: string;
        program_id?: number;
    }) =>
        fetch(`http://localhost:5000/api/quizzes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    createQuizQuestion: (
        quizId: number,
        data: {
            question: string;
            format: 'mcq' | 'open_ended';
            option_a?: string;
            option_b?: string;
            option_c?: string;
            option_d?: string;
            correct_option?: 'A' | 'B' | 'C' | 'D';
            model_answer?: string;
        }
    ) =>
        fetch(`http://localhost:5000/api/quizzes/${quizId}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    publishQuiz: (id: number, isPublished: boolean) =>
        fetch(`http://localhost:5000/api/quizzes/${id}/publish`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_published: isPublished }),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    deleteQuizQuestion: (id: number) =>
        fetch(`http://localhost:5000/api/questions/${id}`, {
            method: 'DELETE',
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    updateQuizType: (id: number, type: 'MCQ' | 'Practical' | 'Mixed') =>
        fetch(`http://localhost:5000/api/quizzes/${id}/type`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    updateQuizQuestion: (
        id: number,
        data: {
            question: string;
            format: 'mcq' | 'open_ended';
            option_a?: string;
            option_b?: string;
            option_c?: string;
            option_d?: string;
            correct_option?: 'A' | 'B' | 'C' | 'D';
            model_answer?: string;
        }
    ) =>
        fetch(`http://localhost:5000/api/questions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    submitQuiz: (
        quizId: number,
        answers: { question_id: number; selected_option?: string; answer_text?: string }[]
    ) =>
        fetch(`http://localhost:5000/api/quizzes/${quizId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers }),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),

    getPendingAttempts: (quizId: number) =>
        request(`/quizzes/${quizId}/attempts/pending`),

    getAttemptAnswers: (attemptId: number) =>
        request(`/attempts/${attemptId}/answers`),

    getAttempt: (id: number) => request(`/attempts/${id}`),

    gradeAttemptAnswer: (answerId: number, teacherScore: number) =>
        fetch(`http://localhost:5000/api/attempt-answers/${answerId}/grade`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacher_score: teacherScore }),
        }).then((res) => {
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return res.json();
        }),
};