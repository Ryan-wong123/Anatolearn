export type ViewerMode = 'view' | 'point' | 'highlight' | 'region';

export function toggleViewerMode(current: ViewerMode, requested: Exclude<ViewerMode, 'view'>): ViewerMode {
  return current === requested ? 'view' : requested;
}

export const VIEWER_MODE_LABELS: Record<ViewerMode, string> = {
  view: 'View',
  point: 'Add Annotation',
  highlight: 'Projected Highlight',
  region: 'Projected Region Fill',
};
