import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AnnotationFormModal from './AnnotationFormModal';

describe('AnnotationFormModal', () => {
  it('requires a non-blank label and forwards edited values', async () => {
    const user = userEvent.setup();
    const onLabelChange = vi.fn();
    const onSave = vi.fn();
    const props = { title: 'Add annotation', label: '', description: '', color: '#22d3ee', showColorPicker: true, onLabelChange, onDescriptionChange: vi.fn(), onColorChange: vi.fn(), onCancel: vi.fn(), onSave };
    const { rerender } = render(<AnnotationFormModal {...props} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(screen.getByLabelText('Label'), 'Heart');
    expect(onLabelChange).toHaveBeenCalled();
    rerender(<AnnotationFormModal {...props} label="Heart" />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
