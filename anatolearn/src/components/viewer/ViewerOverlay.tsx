import { useState } from 'react';
import type { ComponentProps, RefObject } from 'react';
import AnnotationDetailsPanel from './AnnotationDetailsPanel';
import AnnotationFormModal from './AnnotationFormModal';
import AnnotationListPanel from './AnnotationListPanel';
import RegionGeneratingOverlay from './RegionGeneratingOverlay';
import ViewerInstructions from './ViewerInstructions';
import ViewerToolbar from './ViewerToolbar';
import VideoPlayerModal from './VideoPlayerModal';
import { toggleViewerMode, VIEWER_MODE_LABELS } from './viewerMode';
import type { ViewerMode } from './viewerMode';
import type { Annotation, LinkedVideo, ModelRecord, ScreenPoint } from './types';

interface ViewerOverlayProps {
  boundaryRef: RefObject<HTMLDivElement | null>;
  model: ModelRecord | null;
  loadError: string | null;
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  annotations: Annotation[];
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<LinkedVideo | null>(null);
  const drawMode = props.mode === 'highlight';
  const regionMode = props.mode === 'region';

  return <>
    {(!props.model || props.loadError) && (
      <p className="absolute inset-x-4 top-20 z-30 rounded-lg bg-white p-4 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200" role={props.loadError ? 'alert' : 'status'}>
        {props.loadError ?? 'Loading model...'}
      </p>
    )}
    <ViewerInstructions modeText={VIEWER_MODE_LABELS[props.mode]} drawMode={drawMode} regionMode={regionMode} />
    <ViewerToolbar
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
    />
    {(regionMode || drawMode) && props.boundaryPreview.length > 1 && (
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={props.boundaryPreview.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')}
          fill="none" stroke="#22d3ee" strokeWidth="0.35" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    )}
    <AnnotationListPanel
      boundaryRef={props.boundaryRef} onDragStateChange={props.onDragStateChange}
      annotations={props.annotations} selectedAnnotation={props.selectedAnnotation}
      open={panelOpen} modelTitle={props.model?.title ?? 'Model'} onToggleOpen={() => setPanelOpen((open) => !open)}
      onSelect={props.onSelect} onHover={props.onHover} onHoverEnd={() => props.onHover(null)}
    />
    {props.selectedAnnotation && (
      <AnnotationDetailsPanel
        boundaryRef={props.boundaryRef} onDragStateChange={props.onDragStateChange} annotation={props.selectedAnnotation}
        linkedVideo={props.videos.find((video) => video.annotation_id === props.selectedAnnotation?.id) ?? null}
        onPlayVideo={setPlayingVideo} onReposition={props.onReposition} onEdit={props.onEdit} onDelete={props.onDelete} onClose={props.onClose}
      />
    )}
    {playingVideo && <VideoPlayerModal video={playingVideo} onClose={() => setPlayingVideo(null)} />}
    {props.generatingRegion && <RegionGeneratingOverlay />}
    {props.form && <AnnotationFormModal {...props.form} />}
  </>;
}
