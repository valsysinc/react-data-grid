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
  draggedOverCellIdx,
  row,
  viewportColumns,
  selectedCellProps,
  enableDrag,
  onRowClick,
  rowClass,
  setDraggedOverPos,
  onMouseEnter,
  cellMouseDownHandler,
  top,
  'aria-rowindex': ariaRowIndex,
  'aria-selected': ariaSelected,
  ...props
}: RowRendererProps<R, SR>, ref: React.Ref<HTMLDivElement>) {
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

  const isDraggedOver = function(idx: number): boolean {
    if (idx === undefined || draggedOverCellIdx === undefined || !selectedCellProps
    || (idx === selectedCellProps.idx && rowIdx === selectedCellProps.rowIdx)) return false;
    return draggedOverCellIdx < selectedCellProps?.idx
      ? idx <= selectedCellProps?.idx && idx >= draggedOverCellIdx
      : idx >= selectedCellProps?.idx && idx <= draggedOverCellIdx;
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
            isDraggedOver={isDraggedOver(column.idx)}
            isCellFocused={isCellFocused}
            isRowSelected={isRowSelected}
            eventBus={eventBus}
            onFocus={isCellFocused ? (selectedCellProps as SelectedCellProps).onFocus : undefined}
            onKeyDown={isCellFocused ? selectedCellProps!.onKeyDown : undefined}
            onRowClick={onRowClick}
            cellStyles={cellStyles?.[rowIdx]?.[column.idx]}
            isCellSelected={cellSelected}
            enableDrag={isCellFocused ? enableDrag : false}
            setDraggedOverPos={setDraggedOverPos}
            cellMouseDownHandler={cellMouseDownHandler}
          />
        );
      })}
    </div>
  );
}

export default memo(forwardRef(Row)) as <R, SR = unknown>(props: RowRendererProps<R, SR> & React.RefAttributes<HTMLDivElement>) => JSX.Element;
