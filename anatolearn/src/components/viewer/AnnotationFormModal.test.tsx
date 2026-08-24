import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import AnnotationFormModal from './AnnotationFormModal';

it('edits fields and saves through its callbacks', async () => {
  const user = userEvent.setup();
  const onLabelChange = vi.fn();
  const onSave = vi.fn();
  render(<AnnotationFormModal title="New annotation" label="" description="" color="#ff0000" showColorPicker onLabelChange={onLabelChange} onDescriptionChange={vi.fn()} onColorChange={vi.fn()} onCancel={vi.fn()} onSave={onSave} />);
  await user.type(screen.getByPlaceholderText('e.g. Masseter muscle'), 'Heart');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(onLabelChange).toHaveBeenCalled();
  expect(onSave).toHaveBeenCalledOnce();
});
