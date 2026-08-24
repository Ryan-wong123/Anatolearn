import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import AnnotationFormModal from './AnnotationFormModal';

function renderModal(label = '') {
  const handlers = {
    onLabelChange: vi.fn(), onDescriptionChange: vi.fn(), onColorChange: vi.fn(),
    onCancel: vi.fn(), onSave: vi.fn(),
  };
  render(<AnnotationFormModal title="Create annotation" label={label} description="" color="#112233" showColorPicker {...handlers} />);
  return handlers;
}

it('prevents saving an annotation without a label', () => {
  renderModal();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(screen.getByText('A label is required before saving.')).toBeVisible();
});

it('reports edits and saves a valid annotation', async () => {
  const user = userEvent.setup();
  const handlers = renderModal('Aorta');
  await user.type(screen.getByLabelText('Description'), 'Main artery');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(handlers.onDescriptionChange).toHaveBeenCalled();
  expect(handlers.onSave).toHaveBeenCalledOnce();
});
