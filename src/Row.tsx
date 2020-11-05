import React, { memo, forwardRef } from 'react';
import clsx from 'clsx';

import Cell from './Cell';
import EditCell from './EditCell';
import { RowRendererProps, SelectedCellProps } from './types';

function Row<R, SR = unknown>({
  cellStyles,
  cellRenderer: CellRenderer = Cell,
  className,
  eventBus,
  rowIdx,
  isRowSelected,
  copiedCellIdx,
  row,
  viewportColumns,
  selectedCellProps,
  enableDrag,
  onRowClick,
  rowClass,
  setDraggedOverPos,
  onMouseEnter,
  cellMouseDownHandler,
  selectedRange,
  draggedOverRange,
  top,
  isReorderingRow,
  'aria-rowindex': ariaRowIndex,
  'aria-selected': ariaSelected,
  ...props
}: RowRendererProps<R, SR>, ref: React.Ref<HTMLDivElement>) {
  className = clsx(
    'rdg-row',
    `rdg-row-${rowIdx % 2 === 0 ? 'even' : 'odd'}`, {
      'rdg-row-selected': isRowSelected,
      'rdg-group-row-selected': selectedCellProps?.idx === -1,
      'rdg-cell-reorder-target': isReorderingRow
    },
    rowClass?.(row),
    className
  );

  const isCellSelected = function(colIdx: number): boolean {
    return !!(selectedRange && selectedRange[0] <= colIdx && selectedRange[1] >= colIdx);
  };

  const isDraggedOver = function(idx: number): boolean {
    return !!(draggedOverRange && draggedOverRange[0] <= idx && draggedOverRange[1] >= idx);
  };

  return (
    <div
      role="row"
      aria-rowindex={ariaRowIndex}
      aria-selected={ariaSelected}
      ref={ref}
      className={className}
      onMouseEnter={onMouseEnter}
      style={{ top }}
      {...props}
    >
      {viewportColumns.map(column => {
        const isCellFocused = !!(selectedCellProps && column.idx === selectedCellProps.idx);
        const cellSelected = !isCellFocused && isCellSelected(column.idx);

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
            cellMouseDownHandler={cellMouseDownHandler}
            cellStyles={cellStyles?.[column.idx]}
            column={column}
            enableDrag={isCellFocused ? enableDrag : false}
            eventBus={eventBus}
            isCopied={copiedCellIdx === column.idx}
            isDraggedOver={isDraggedOver(column.idx)}
            isCellFocused={isCellFocused}
            isCellSelected={cellSelected}
            isRowSelected={isRowSelected}
            key={column.key}
            onFocus={isCellFocused ? (selectedCellProps as SelectedCellProps).onFocus : undefined}
            onKeyDown={isCellFocused ? selectedCellProps!.onKeyDown : undefined}
            onRowClick={onRowClick}
            row={row}
            rowIdx={rowIdx}
            setDraggedOverPos={setDraggedOverPos}
          />
        );
      })}
    </div>
  );
}

export default memo(forwardRef(Row)) as <R, SR = unknown>(props: RowRendererProps<R, SR> & React.RefAttributes<HTMLDivElement>) => JSX.Element;
