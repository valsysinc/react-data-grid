import React, { useCallback, memo } from 'react';
import clsx from 'clsx';
import HeaderCell from './HeaderCell';
import { CalculatedColumn } from './types';
import { assertIsValidKey } from './utils';
import { DataGridProps } from './DataGrid';
import EventBus from './EventBus';

type SharedDataGridProps<R, K extends keyof R, SR> = Pick<DataGridProps<R, K, SR>,
  | 'rows'
  | 'onSelectedRowsChange'
  | 'sortColumn'
  | 'sortDirection'
  | 'onSort'
  | 'rowKey'
>;

export interface HeaderRowProps<R, K extends keyof R, SR> extends SharedDataGridProps<R, K, SR> {
  columns: readonly CalculatedColumn<R, SR>[];
  allRowsSelected: boolean;
  onColumnResize: (column: CalculatedColumn<R, SR>, width: number) => void;
  eventBus: EventBus;
  setDraggedOverPos?: (row: number, col: number) => void;
  isReorderingRow: boolean;
}

function HeaderRow<R, K extends keyof R, SR>({
  columns,
  eventBus,
  rows,
  rowKey,
  onSelectedRowsChange,
  allRowsSelected,
  onColumnResize,
  sortColumn,
  sortDirection,
  onSort,
  setDraggedOverPos,
  isReorderingRow
}: HeaderRowProps<R, K, SR>) {
  const className = clsx(
    'rdg-header-row',
    {
      'rdg-cell-reorder-target': isReorderingRow
    }
  );

  function handleDragEnter() {
    setDraggedOverPos?.(-1, -1);
  }

  const handleAllRowsSelectionChange = useCallback((checked: boolean) => {
    if (!onSelectedRowsChange) return;

    assertIsValidKey(rowKey);

    const newSelectedRows = new Set<R[K]>();
    if (checked) {
      for (const row of rows) {
        newSelectedRows.add(row[rowKey]);
      }
    }

    onSelectedRowsChange(newSelectedRows);
  }, [onSelectedRowsChange, rows, rowKey]);

  return (
    <div
      role="row"
      aria-rowindex={1} // aria-rowindex is 1 based
      className={className}
      onMouseEnter={handleDragEnter}
    >
      {columns.map(column => {
        return (
          <HeaderCell<R, SR>
            key={column.key}
            column={column}
            onResize={onColumnResize}
            allRowsSelected={allRowsSelected}
            onAllRowsSelectionChange={handleAllRowsSelectionChange}
            onSort={onSort}
            eventBus={eventBus}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
          />
        );
      })}
    </div>
  );
}

export default memo(HeaderRow) as <R, K extends keyof R, SR>(props: HeaderRowProps<R, K, SR>) => JSX.Element;
