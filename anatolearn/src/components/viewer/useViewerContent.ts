import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import type { LinkedVideo, ModelRecord, NeutralView } from './types';

interface ViewerContent {
  modelId: number;
  model: ModelRecord | null;
  videos: LinkedVideo[];
  error: string | null;
}

// Only data crosses this boundary; Three.js resources stay owned by Viewer.
export function useViewerContent(routeModelId: string | undefined) {
  const modelId = Number(routeModelId);
  const validId = Number.isSafeInteger(modelId) && modelId > 0;
  const [content, setContent] = useState<ViewerContent | null>(null);

  useEffect(() => {
    if (!validId) return;
    let active = true;
    api.getModel(modelId)
      .then((model: ModelRecord) => {
        if (!active) return;
        setContent((previous) => ({
          modelId, model, error: null,
          videos: previous?.modelId === modelId ? previous.videos : [],
        }));
      })
      .catch(() => {
        if (active) setContent({ modelId, model: null, videos: [], error: 'Could not load this model.' });
      });
    api.getVideos()
      .then((videos: LinkedVideo[]) => {
        if (!active) return;
        setContent((previous) => ({
          modelId,
          model: previous?.modelId === modelId ? previous.model : null,
          error: previous?.modelId === modelId ? previous.error : null,
          videos: videos.filter((video) => video.annotation_id != null),
        }));
      })
      .catch((error: unknown) => console.error('Failed to load linked videos:', error));
    return () => { active = false; };
  }, [modelId, validId]);

  const current = validId && content?.modelId === modelId ? content : null;
  function updateModel(model: ModelRecord) {
    setContent((previous) => previous?.modelId === model.id ? { ...previous, model } : previous);
  }

  async function saveNeutralView(view: NeutralView | null) {
    if (!current?.model || !view) return;
    try {
      const updated: ModelRecord = await api.saveNeutralView(current.model.id, view);
      updateModel(updated);
      alert(current.model.neutral_view ? 'Neutral view updated.' : 'Neutral view saved.');
    } catch (error) {
      console.error('Failed to save neutral view:', error);
      alert('Failed to save neutral view.');
    }
  }

  return {
    selectedModel: current?.model ?? null,
    modelVideos: current?.videos ?? [],
    loadError: validId ? current?.error ?? null : 'Invalid model identifier.',
    updateModel,
    saveNeutralView,
  };
}
