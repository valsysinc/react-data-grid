import React, { memo, forwardRef } from 'react';
import clsx from 'clsx';

import Cell from './Cell';
import EditCell from './EditCell';
import { RowRendererProps, SelectedCellProps } from './types';
import { wrapEvent } from './utils';

function Row<R, SR = unknown>({
  cellHighlights,
  cellRenderer: CellRenderer = Cell,
  className,
  eventBus,
  rowIdx,
  isRowSelected,
  copiedCellIdx,
  draggedOverCellIdx,
  row,
  viewportColumns,
  selectedCellProps,
  onRowClick,
  rowClass,
  setDraggedOverRowIdx,
  onMouseEnter,
  top,
  'aria-rowindex': ariaRowIndex,
  'aria-selected': ariaSelected,
  ...props
}: RowRendererProps<R, SR>, ref: React.Ref<HTMLDivElement>) {
  function handleDragEnter() {
    setDraggedOverRowIdx?.(rowIdx);
  }

  className = clsx(
    'rdg-row',
    `rdg-row-${rowIdx % 2 === 0 ? 'even' : 'odd'}`, {
      'rdg-row-selected': isRowSelected,
      'rdg-group-row-selected': selectedCellProps?.idx === -1
    },
    rowClass?.(row),
    className
  );

  const isCellSelected = function(rowIdx: number, colIdx: number): boolean {
    const sel = selectedCellProps?.selection;
    if (!sel) return false;
    if (selectedCellProps?.idx === colIdx && selectedCellProps?.rowIdx === rowIdx) return false;
    if (sel.rowStart <= rowIdx && sel.rowEnd >= rowIdx && sel.colStart <= colIdx && sel.colEnd >= colIdx) {
      return true;
    }
    return false;
  };

  return (
    <div
      role="row"
      aria-rowindex={ariaRowIndex}
      aria-selected={ariaSelected}
      ref={ref}
      className={className}
      onMouseEnter={wrapEvent(handleDragEnter, onMouseEnter)}
      style={{ top }}
      {...props}
    >
      {viewportColumns.map(column => {
        const isCellFocused = selectedCellProps?.idx === column.idx && selectedCellProps?.rowIdx === rowIdx;
        const cellSelected = selectedCellProps?.hasSelectedCells ? isCellSelected(rowIdx, column.idx) : false;

        if (selectedCellProps?.mode === 'EDIT' && isCellFocused) {
          return (
            <EditCell<R, SR>
              key={column.key}
              rowIdx={rowIdx}
              column={column}
              row={row}
              onKeyDown={selectedCellProps.onKeyDown}
              editorPortalTarget={selectedCellProps.editorPortalTarget}
              editorContainerProps={selectedCellProps.editorContainerProps}
              editor2Props={selectedCellProps.editor2Props}
            />
          );
        }

        return (
          <CellRenderer
            key={column.key}
            rowIdx={rowIdx}
            column={column}
            row={row}
            isCopied={copiedCellIdx === column.idx}
            isDraggedOver={draggedOverCellIdx === column.idx}
            isCellFocused={isCellFocused}
            isRowSelected={isRowSelected}
            eventBus={eventBus}
            dragHandleProps={isCellFocused ? (selectedCellProps as SelectedCellProps).dragHandleProps : undefined}
            onFocus={isCellFocused ? (selectedCellProps as SelectedCellProps).onFocus : undefined}
            onKeyDown={isCellFocused ? selectedCellProps!.onKeyDown : undefined}
            onRowClick={onRowClick}
            highlight={cellHighlights?.[rowIdx]?.[column.idx]}
            isCellSelected={cellSelected}
          />
        );
      })}
    </div>
  );
}

export default memo(forwardRef(Row)) as <R, SR = unknown>(props: RowRendererProps<R, SR> & React.RefAttributes<HTMLDivElement>) => JSX.Element;
