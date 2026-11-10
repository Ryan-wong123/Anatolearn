import { useState } from 'react';
import { useAppContext } from '../../context/AppContextState';
import type { ComponentProps, RefObject } from 'react';
import AnnotationDetailsPanel from './AnnotationDetailsPanel';
import AnnotationFormModal from './AnnotationFormModal';
import AnnotationListPanel from './AnnotationListPanel';
import RegionGeneratingOverlay from './RegionGeneratingOverlay';
import ViewerInstructions from './ViewerInstructions';
import ViewerToolbar from './ViewerToolbar';
import VideoPlayerModal from './VideoPlayerModal';
import { toggleViewerMode, VIEWER_MODE_LABELS } from './viewerMode';
import StudyModeControls from './StudyModeControls';
import type { StudyMode, StudyLabelPoint } from './StudyModeControls';
import type { ViewerMode } from './viewerMode';
import type { Annotation, LinkedVideo, ModelRecord, ScreenPoint } from './types';

interface ViewerOverlayProps {
  boundaryRef: RefObject<HTMLDivElement | null>;
  model: ModelRecord | null;
  loadError: string | null;
  loading: boolean;
  moving: boolean;
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  annotations: Annotation[];
  studyMode: StudyMode;
  onStudyModeChange: (mode: StudyMode) => void;
  onRevisionStep: (offset: number) => void;
  studyLabels: StudyLabelPoint[];
  studyViewport: { width: number; height: number };
  selectedAnnotation: Annotation | null;
  videos: LinkedVideo[];
  annotationsVisible: boolean;
  darkBackground: boolean;
  generatingRegion: boolean;
  boundaryPreview: ScreenPoint[];
  form: ComponentProps<typeof AnnotationFormModal> | null;
  onDragStateChange: (dragging: boolean) => void;
  onSelect: (annotation: Annotation) => void;
  onHover: (annotation: Annotation | null) => void;
  onClose: () => void;
  onEdit: () => void;
  onReposition: () => void;
  onDelete: () => void;
  onToggleAnnotations: () => void;
  onToggleBackground: () => void;
  onSaveNeutralView: () => void;
  onReturnToNeutralView: () => void;
}

export default function ViewerOverlay(props: ViewerOverlayProps) {
  const { role } = useAppContext();
  // Teachers edit annotations only on models they own (or that nobody owns yet); other teachers get a read-only viewer.
  const canEdit = role === 'teacher' && props.model?.can_manage !== false;
  const [panelOpen, setPanelOpen] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<LinkedVideo | null>(null);
  const drawMode = props.mode === 'highlight';
  const regionMode = props.mode === 'region';

  return <>
    {(!props.model || props.loading || props.loadError) && (
      <p className="absolute inset-x-4 top-20 z-30 rounded-lg bg-white p-4 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200" role={props.loadError ? 'alert' : 'status'}>
        {props.loadError ?? 'Loading model...'}
      </p>
    )}
    {props.moving && <p role="status" className="absolute left-4 top-44 z-30 rounded-lg bg-white p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">Moving annotation…</p>}
    {props.studyMode === 'explore' && <ViewerInstructions modeText={VIEWER_MODE_LABELS[props.mode]} drawMode={drawMode} regionMode={regionMode} />}
    <StudyModeControls
      mode={props.studyMode}
      annotations={props.annotations} selected={props.selectedAnnotation}
      onStep={props.onRevisionStep}
      labels={props.annotationsVisible ? props.studyLabels : []}
      viewport={props.studyViewport}
    />
    {props.studyMode === 'explore' && <ViewerToolbar
      canEdit={canEdit}
      disabled={!props.model || props.loading || props.moving}
      addMode={props.mode === 'point'} drawMode={drawMode} regionMode={regionMode}
      annotationsVisible={props.annotationsVisible} darkBackground={props.darkBackground}
      hasNeutralView={Boolean(props.model?.neutral_view)}
      onToggleAdd={() => props.onModeChange(toggleViewerMode(props.mode, 'point'))}
      onToggleDraw={() => props.onModeChange(toggleViewerMode(props.mode, 'highlight'))}
      onToggleRegion={() => props.onModeChange(toggleViewerMode(props.mode, 'region'))}
      onToggleAnnotations={() => {
        props.onToggleAnnotations();
        props.onClose();
        props.onHover(null);
      }}
      onToggleBackground={props.onToggleBackground}
      onSaveNeutralView={props.onSaveNeutralView} onReturnToNeutralView={props.onReturnToNeutralView}
    />}
    {(regionMode || drawMode) && props.boundaryPreview.length > 1 && (
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={props.boundaryPreview.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')}
          fill="none" stroke="#22d3ee" strokeWidth="0.35" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    )}
    {props.studyMode === 'explore' && <AnnotationListPanel
      boundaryRef={props.boundaryRef} onDragStateChange={props.onDragStateChange}
      annotations={props.annotations} selectedAnnotation={props.selectedAnnotation}
      open={panelOpen} modelTitle={props.model?.title ?? 'Model'} onToggleOpen={() => setPanelOpen((open) => !open)}
      onSelect={props.onSelect} onHover={props.onHover} onHoverEnd={() => props.onHover(null)}
    />}
    {props.studyMode === 'explore' && props.selectedAnnotation && (
      <AnnotationDetailsPanel
        canEdit={canEdit} busy={props.moving} boundaryRef={props.boundaryRef} onDragStateChange={props.onDragStateChange} annotation={props.selectedAnnotation}
        linkedVideo={props.videos.find((video) => video.annotation_id === props.selectedAnnotation?.id) ?? null}
        onPlayVideo={setPlayingVideo} onReposition={props.onReposition} onEdit={props.onEdit} onDelete={props.onDelete} onClose={props.onClose}
      />
    )}
    {props.studyMode === 'revision' && props.selectedAnnotation && (
      <section role="region" aria-label={`Revision: ${props.selectedAnnotation.label}`}
        className="pointer-events-auto absolute right-4 top-1/3 z-20 w-72 max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900/95"
        onPointerDown={(event) => event.stopPropagation()}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">Revision</p>
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{props.selectedAnnotation.label}</h2>
        <p className="mt-3 max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
          {props.selectedAnnotation.description || 'No description.'}
        </p>
        {/* No Close, Edit, Delete or Move actions in guided revision mode. */}
      </section>
    )}
    {playingVideo && <VideoPlayerModal video={playingVideo} onClose={() => setPlayingVideo(null)} />}
    {props.generatingRegion && <RegionGeneratingOverlay />}
    {props.form && <AnnotationFormModal {...props.form} />}
  </>;
}
