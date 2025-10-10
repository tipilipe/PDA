// frontend/src/components/SortableItem.jsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      {/* Alça de arrasto dedicada. Apenas esta célula ativa o drag and drop. */}
      <td {...attributes} {...listeners} style={{ cursor: 'grab', width: '20px', textAlign: 'center', touchAction: 'none' }}>
        ⠿
      </td>
      {props.children}
    </tr>
  );
}