import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import AnnotationListPanel from './AnnotationListPanel';

vi.mock('./DraggablePanel', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

describe('AnnotationListPanel', () => {
  it('shows empty state and reports annotation selection', async () => {
    const common = { boundaryRef: createRef<HTMLDivElement>(), controlsRef: { current: null }, selectedAnnotation: null, open: true, modelTitle: 'Heart', onToggleOpen: vi.fn(), onSelect: vi.fn() };
    const { rerender } = render(<AnnotationListPanel {...common} annotations={[]} />);
    expect(screen.getByText('No annotations yet.')).toBeInTheDocument();
    const annotation = { id: 1, label: 'Aorta', description: '', kind: 'point' as const, position: { x: 0, y: 0, z: 0 } };
    rerender(<AnnotationListPanel {...common} annotations={[annotation]} />);
    await userEvent.click(screen.getByRole('button', { name: /Aorta/ }));
    expect(common.onSelect).toHaveBeenCalledWith(annotation);
  });
});
