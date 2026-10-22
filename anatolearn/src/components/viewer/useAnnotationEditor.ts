import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useToast } from '../../context/ToastContextState';
import { api } from '../../api/api';
import { applyAnnotationDraft, fromDbAnnotation, toAnnotationPayload } from './annotationMapping';
import type AnnotationFormModal from './AnnotationFormModal';
import type { Annotation, AnnotationDraft } from './types';

interface AnnotationEditorOptions {
  getModelId: () => number | undefined;
  getSceneEpoch: () => number;
  getAnnotation: () => Annotation | null;
  onSaved: (annotation: Annotation) => void;
  onCancel: () => void;
}

const EMPTY_DRAFT: AnnotationDraft = { label: '', description: '', color: '#22d3ee', opacity: 0.24 };

// Owns form state and persistence only. Scene changes remain behind callbacks.
export function useAnnotationEditor(options: AnnotationEditorOptions) {
  const { toast } = useToast();
  const operationRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Annotation['kind']>('point');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  function openForm(annotation?: Annotation, isEditing = false) {
    setError(null);
    const nextKind = annotation?.kind ?? 'point';
    setKind(nextKind);
    setEditing(isEditing);
    setDraft({
      label: annotation?.label ?? '',
      description: annotation?.description ?? '',
      color: annotation?.color ?? (nextKind === 'projectedRegion' ? '#22d3ee' : '#facc15'),
      opacity: annotation?.opacity ?? (nextKind === 'projectedRegion' ? 0.24 : 0.32),
    });
    setOpen(true);
  }

  async function save() {
    const modelId = options.getModelId();
    if (modelId === undefined || savingRef.current) return;
    if (!draft.label.trim()) { setError('Please enter a label.'); return; }
    const base = options.getAnnotation();
    if (!base) return;
    const epoch = options.getSceneEpoch();
    const operation = ++operationRef.current;
    setError(null);
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = toAnnotationPayload(applyAnnotationDraft(base, draft));
      const record = editing && base.id !== undefined
        ? await api.updateAnnotation(base.id, payload)
        : await api.createAnnotation(modelId, payload);
      if (!mountedRef.current || options.getSceneEpoch() !== epoch) return;
      options.onSaved(fromDbAnnotation(record));
      setOpen(false);
    } catch (error) {
      console.error('Failed to save annotation:', error);
      if (mountedRef.current && options.getSceneEpoch() === epoch) setError('Failed to save annotation. Please try again.');
    } finally {
      if (operationRef.current === operation) {
        savingRef.current = false;
        if (mountedRef.current) setSaving(false);
      }
    }
  }

  const form: ComponentProps<typeof AnnotationFormModal> | null = open ? {
    ...draft, error,
    title: editing ? 'Edit Annotation' : kind === 'point' ? 'Add Annotation' : kind === 'projectedRegion' ? 'Add Projected Region' : 'Add Projected Highlight',
    isSaving: saving,
    showColorPicker: kind === 'projectedRegion',
    showOpacitySlider: kind === 'projectedRegion' || kind === 'projectedDraw',
    onLabelChange: (label) => setDraft((current) => ({ ...current, label })),
    onDescriptionChange: (description) => setDraft((current) => ({ ...current, description })),
    onColorChange: (color) => setDraft((current) => ({ ...current, color })),
    onOpacityChange: (opacity) => setDraft((current) => ({ ...current, opacity })),
    onSave: () => { void save(); },
    onCancel: () => {
      if (savingRef.current) return;
      options.onCancel();
      setOpen(false);
    },
  } : null;

  async function deleteAnnotation(id: number | undefined) {
    if (id === undefined) return true;
    const epoch = options.getSceneEpoch();
    try {
      await api.deleteAnnotation(id);
      return true;
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      if (mountedRef.current && options.getSceneEpoch() === epoch) toast('Failed to delete annotation. Please try again.', 'error');
      return false;
    }
  }

  function reset() {
    operationRef.current += 1;
    savingRef.current = false;
    setSaving(false);
    setOpen(false);
    setError(null);
  }
  return { form, openForm, deleteAnnotation, reset };
}
