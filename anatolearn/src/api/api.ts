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
    getVideos: () => request("/videos"),
    getVideo: (id: number) => request(`/videos/${id}`),

    getQuizzes: () => request("/quizzes"),
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
};