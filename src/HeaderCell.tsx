import React, { createElement } from 'react';
import clsx from 'clsx';

import { CalculatedColumn } from './types';
import { HeaderRowProps } from './HeaderRow';
import SortableHeaderCell from './headerCells/SortableHeaderCell';
import ResizableHeaderCell from './headerCells/ResizableHeaderCell';
import { SortDirection } from './enums';
import EventBus from './EventBus';

function getAriaSort(sortDirection?: SortDirection) {
  switch (sortDirection) {
    case 'ASC':
      return 'ascending';
    case 'DESC':
      return 'descending';
    default:
      return 'none';
  }
}

type SharedHeaderRowProps<R, SR> = Pick<HeaderRowProps<R, never, SR>,
  | 'sortColumn'
  | 'sortDirection'
  | 'onSort'
  | 'allRowsSelected'
>;

export interface HeaderCellProps<R, SR> extends SharedHeaderRowProps<R, SR> {
  column: CalculatedColumn<R, SR>;
  onResize: (column: CalculatedColumn<R, SR>, width: number, mouseDown: boolean) => void;
  onAllRowsSelectionChange: (checked: boolean) => void;
  eventBus: EventBus;
}

export default function HeaderCell<R, SR>({
  column,
  onResize,
  allRowsSelected,
  onAllRowsSelectionChange,
  sortColumn,
  sortDirection,
  onSort,
  eventBus
}: HeaderCellProps<R, SR>) {
  function getCell() {
    if (!column.headerRenderer) return column.name;
    return createElement(column.headerRenderer, { column, allRowsSelected, onAllRowsSelectionChange });
  }

  function handleHeaderClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if ((event.target as Element).className !== 'rdg-header-cell-resizer') {
      eventBus.dispatch('SelectCell', {
        rowIdx: 0,
        idx: column.idx || 1,
        sel: {
          rowStart: 0, rowEnd: -1, colStart: column.idx, colEnd: column.idx || -1
        }
      });
    }
  }


  let cell = getCell();

  if (column.sortable) {
    cell = (
      <SortableHeaderCell
        column={column}
        onSort={onSort}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
      >
        {cell}
      </SortableHeaderCell>
    );
  }

  const className = clsx('rdg-cell rdg-header-cell', column.headerCellClass, {
    'rdg-cell-frozen': column.frozen,
    'rdg-cell-frozen-last': column.isLastFrozenColumn,
    'rdg-header-cell-start': column.idx === 0
  });
  const style: React.CSSProperties = {
    width: column.width,
    left: column.left
  };

  cell = (
    <div
      role="columnheader"
      aria-colindex={column.idx + 1}
      aria-sort={sortColumn === column.key ? getAriaSort(sortDirection) : undefined}
      className={className}
      style={style}
      onClick={handleHeaderClick}
    >
      {cell}
    </div>
  );

  if (column.resizable) {
    cell = (
      <ResizableHeaderCell
        column={column}
        onResize={onResize}
      >
        {cell as React.ReactElement<React.ComponentProps<'div'>>}
      </ResizableHeaderCell>
    );
  }

  return cell;
}
