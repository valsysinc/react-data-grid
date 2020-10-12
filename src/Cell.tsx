import React, { forwardRef, memo, useRef } from 'react';
import clsx from 'clsx';

import { CellRendererProps } from './types';
import { wrapEvent } from './utils';
import { useCombinedRefs } from './hooks';

function Cell<R, SR>({
  className,
  column,
  isCellFocused,
  isCopied,
  isDraggedOver,
  isRowSelected,
  highlight,
  isCellSelected,
  row,
  rowIdx,
  eventBus,
  enableDrag,
  onRowClick,
  onFocus,
  onKeyDown,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseDown,
  cellMouseDownHandler,
  setDraggedOverPos
}: CellRendererProps<R, SR>, ref: React.Ref<HTMLDivElement>) {
  const cellRef = useRef<HTMLDivElement>(null);
  const { cellClass } = column;

  function handleDragEnter() {
    setDraggedOverPos?.(rowIdx, column.idx);
  }

  className = clsx(
    'rdg-cell',
    {
      'rdg-cell-frozen': column.frozen,
      'rdg-cell-frozen-last': column.isLastFrozenColumn,
      'rdg-cell-focused': isCellFocused,
      'rdg-cell-copied': isCopied,
      'rdg-cell-dragged-over': isDraggedOver,
      'rdg-cell-highlight': highlight,
      'rdg-cell-selected': isCellSelected
    },
    typeof cellClass === 'function' ? cellClass(row) : cellClass,
    className
  );

  function selectCell(openEditor?: boolean) {
    eventBus.dispatch('SelectCell', { idx: column.idx, rowIdx }, openEditor);
  }

  function handleClick() {
    selectCell(column.editorOptions?.editOnClick);
    onRowClick?.(rowIdx, row, column);
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!isCellSelected && !isCellFocused) selectCell();
    cellMouseDownHandler(event, rowIdx, column.idx);
  }

  function handleDoubleClick() {
    selectCell(true);
  }

  function onRowSelectionChange(checked: boolean, isShiftClick: boolean) {
    eventBus.dispatch('SelectRow', { rowIdx, checked, isShiftClick });
  }

  return (
    <div
      role="gridcell"
      aria-colindex={column.idx + 1} // aria-colindex is 1-based
      aria-selected={isCellFocused}
      ref={useCombinedRefs(cellRef, ref)}
      className={className}
      style={{
        width: column.width,
        left: column.left
      }}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={wrapEvent(handleClick, onClick)}
      onDoubleClick={wrapEvent(handleDoubleClick, onDoubleClick)}
      onMouseEnter={wrapEvent(handleDragEnter, onMouseEnter)}
      onMouseDown={wrapEvent(handleMouseDown, onMouseDown)}
    >
      {!column.rowGroup && (
        <>
          <column.formatter
            column={column}
            rowIdx={rowIdx}
            row={row}
            isCellSelected={isCellFocused}
            isRowSelected={isRowSelected}
            onRowSelectionChange={onRowSelectionChange}
          />
          {enableDrag && (
            <div
              id="rdg-drag-handle"
              className="rdg-cell-drag-handle"
            />
          )}
        </>
      )}
    </div>
  );
}

export default memo(forwardRef(Cell)) as <R, SR = unknown>(props: CellRendererProps<R, SR> & React.RefAttributes<HTMLDivElement>) => JSX.Element;
