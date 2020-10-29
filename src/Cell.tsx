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
  cellStyles,
  isCellSelected,
  row,
  rowIdx,
  eventBus,
  enableDrag,
  onRowClick,
  onFocus,
  onKeyDown,
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

  const externalClasses: {[key: string]: boolean | undefined} = {
    'rdg-cell-frozen': column.frozen,
    'rdg-cell-frozen-last': column.isLastFrozenColumn,
    'rdg-cell-focused': isCellFocused,
    'rdg-cell-copied': isCopied,
    'rdg-cell-selected': isCellSelected,
    'rdg-cell-dragged-over': isDraggedOver,
    'rdg-row-header-cell': column.idx === 0
  };

  const staticCSSClasses = `rdg-cell ${cellStyles?.classes}`;

  className = clsx(
    staticCSSClasses,
    externalClasses,
    typeof cellClass === 'function' ? cellClass(row) : cellClass,
    className
  );

  const cellStyle = {
    width: column.width,
    left: column.left,
    ...column.idx && { cursor: 'cell' },
    ...cellStyles?.style
  };

  function selectCell(openEditor?: boolean) {
    eventBus.dispatch('SelectCell', { idx: column.idx, rowIdx }, openEditor);
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (column.idx === 0) {
      eventBus.dispatch('SelectCell', {
        rowIdx,
        idx: 1,
        sel: {
          rowStart: rowIdx,
          rowEnd: rowIdx,
          colStart: 1,
          colEnd: -1
        }
      });
    } else if (!isCellFocused) selectCell(column.editorOptions?.editOnClick);
    cellMouseDownHandler?.(event, rowIdx, column.idx);
    onRowClick?.(rowIdx, row, column);
  }

  function handleDoubleClick() {
    if (column.idx === 0) selectCell(true);
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
      style={cellStyle}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
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
