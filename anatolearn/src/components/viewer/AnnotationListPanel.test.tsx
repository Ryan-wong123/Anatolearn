import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import AnnotationListPanel from './AnnotationListPanel';

vi.mock('./DraggablePanel', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const boundaryRef = createRef<HTMLDivElement>();
const controlsRef = createRef<never>();

it('shows an empty state and collapse control', async () => {
  const toggle = vi.fn();
  render(<AnnotationListPanel boundaryRef={boundaryRef} controlsRef={controlsRef} annotations={[]} selectedAnnotation={null} open modelTitle="Heart" onToggleOpen={toggle} onSelect={vi.fn()} />);
  expect(screen.getByText('No annotations yet.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Collapse annotations' }));
  expect(toggle).toHaveBeenCalledOnce();
});

it('selects an annotation from the list', async () => {
  const annotation = { id: 7, label: 'Aorta', description: '', kind: 'point' as const, position: { x: 0, y: 0, z: 0 } };
  const select = vi.fn();
  render(<AnnotationListPanel boundaryRef={boundaryRef} controlsRef={controlsRef} annotations={[annotation]} selectedAnnotation={annotation} open modelTitle="Heart" onToggleOpen={vi.fn()} onSelect={select} />);
  await userEvent.click(screen.getByRole('button', { name: /Aorta/ }));
  expect(select).toHaveBeenCalledWith(annotation);
});
