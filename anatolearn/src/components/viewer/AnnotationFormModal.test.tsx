import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import AnnotationFormModal from './AnnotationFormModal';

it('edits annotation fields and saves', async () => {
  const user = userEvent.setup();
  const onLabelChange = vi.fn();
  const onDescriptionChange = vi.fn();
  const onColorChange = vi.fn();
  const onCancel = vi.fn();
  const onSave = vi.fn();
  render(<AnnotationFormModal title="Create annotation" label="" description="" color="#112233"
    showColorPicker onLabelChange={onLabelChange} onDescriptionChange={onDescriptionChange}
    onColorChange={onColorChange} onCancel={onCancel} onSave={onSave} />);
  await user.type(screen.getByPlaceholderText('e.g. Masseter muscle'), 'Heart');
  expect(onLabelChange).toHaveBeenCalled();
  expect(screen.getByText('#112233')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Short explanation'), { target: { value: 'Detail' } });
  fireEvent.change(screen.getByDisplayValue('#112233'), { target: { value: '#ffffff' } });
  expect(onDescriptionChange).toHaveBeenCalledWith('Detail');
  expect(onColorChange).toHaveBeenCalledWith('#ffffff');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSave).toHaveBeenCalledOnce();
});
