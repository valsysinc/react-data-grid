import React, {
  forwardRef,
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useImperativeHandle,
  useCallback,
  createElement
} from 'react';
import clsx from 'clsx';

import { useGridDimensions, useViewportColumns, useViewportRows } from './hooks';
import EventBus from './EventBus';
import HeaderRow from './HeaderRow';
import FilterRow from './FilterRow';
import Row from './Row';
import GroupRowRenderer from './GroupRow';
import SummaryRow from './SummaryRow';
import {
  assertIsValidKey,
  getColumnScrollPosition,
  getNextSelectedCellPosition,
  isSelectedCellEditable,
  canExitGrid,
  isCtrlKeyHeldDown,
  isDefaultCellInput, preventDefault
} from './utils';

import {
  CalculatedColumn,
  CheckCellIsEditableEvent,
  Column,
  Filters,
  GridSelection,
  Position,
  RowRendererProps,
  RowsUpdateEvent,
  SelectRowEvent,
  CommitEvent,
  SelectedCellProps,
  EditCellProps,
  Dictionary
} from './types';
import { CellNavigationMode, SortDirection } from './enums';

interface SelectCellState extends Position {
  mode: 'SELECT';
}

interface EditCellState<R> extends Position {
  mode: 'EDIT';
  row: R;
  originalRow: R;
  key: string | null;
}

type DefaultColumnOptions<R, SR> = Pick<Column<R, SR>,
  | 'formatter'
  | 'minWidth'
  | 'resizable'
  | 'sortable'
>;

export interface DataGridHandle {
  scrollToColumn: (colIdx: number) => void;
  scrollToRow: (rowIdx: number) => void;
  selectCell: (position: Position, openEditor?: boolean) => void;
  focusGrid: () => void;
}

type SharedDivProps = Pick<React.HTMLAttributes<HTMLDivElement>,
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-describedby'
  | 'className'
  | 'style'
>;

export interface DataGridProps<R, K extends keyof R, SR = unknown> extends SharedDivProps {
  /**
   * Grid and data Props
   */
  /** An array of objects representing each column on the grid */
  columns: readonly Column<R, SR>[];
  /** A function called for each rendered row that should return a plain key/value pair object */
  rows: readonly R[];
  /**
   * Rows to be pinned at the bottom of the rows view for summary, the vertical scroll bar will not scroll these rows.
   * Bottom horizontal scroll bar can move the row left / right. Or a customized row renderer can be used to disabled the scrolling support.
   */
  summaryRows?: readonly SR[];
  /** The primary key property of each row */
  rowKey?: K;
  /**
   * Callback called whenever row data is updated
   * When editing is enabled, this callback will be called for the following scenarios
   * 1. Using the supplied editor of the column. The default editor is the SimpleTextEditor.
   * 2. Copy/pasting the value from one cell to another <kbd>CTRL</kbd>+<kbd>C</kbd>, <kbd>CTRL</kbd>+<kbd>V</kbd>
   * 3. Update multiple cells by dragging the fill handle of a cell up or down to a destination cell.
   * 4. Update all cells under a given cell by double clicking the cell's fill handle.
   */
  onRowsUpdate?: <E extends RowsUpdateEvent>(event: E) => void;
  onRowsChange?: (rows: R[]) => void;

  /**
   * Dimensions props
   */
  /** The height of each row in pixels */
  rowHeight?: number;
  /** The height of the header row in pixels */
  headerRowHeight?: number;
  /** The height of the header filter row in pixels */
  headerFiltersHeight?: number;

  /**
   * Feature props
   */
  /** Set of selected row keys */
  selectedRows?: ReadonlySet<R[K]>;
  /** Function called whenever row selection is changed */
  onSelectedRowsChange?: (selectedRows: Set<R[K]>) => void;
  /** The key of the column which is currently being sorted */
  sortColumn?: string;
  /** The direction to sort the sortColumn*/
  sortDirection?: SortDirection;
  /** Function called whenever grid is sorted*/
  onSort?: (columnKey: string, direction: SortDirection) => void;
  filters?: Filters;
  onFiltersChange?: (filters: Filters) => void;
  defaultColumnOptions?: DefaultColumnOptions<R, SR>;
  groupBy?: readonly string[];
  rowGrouper?: (rows: readonly R[], columnKey: string) => Dictionary<readonly R[]>;
  expandedGroupIds?: ReadonlySet<unknown>;
  onExpandedGroupIdsChange?: (expandedGroupIds: Set<unknown>) => void;
  cellStyles?: [];
  reorderRows: boolean;

  /**
   * Custom renderers
   */
  rowRenderer?: React.ComponentType<RowRendererProps<R, SR>>;
  emptyRowsRenderer?: React.ComponentType;

  /**
   * Event props
   */
  /** Function called whenever a row is clicked */
  onRowClick?: (rowIdx: number, row: R, column: CalculatedColumn<R, SR>) => void;
  /** Called when the grid is scrolled */
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  /** Called when a column is resized */
  onColumnResize?: (idx: number, width: number, mouseDown: boolean) => void;
  /** Function called whenever selected cell is changed */
  onSelectedCellChange?: (position: Position) => void;
  /** called before cell is set active, returns a boolean to determine whether cell is editable */
  onCheckCellIsEditable?: (event: CheckCellIsEditableEvent<R, SR>) => boolean;

  /**
   * Toggles and modes
   */
  /** Toggles whether filters row is displayed or not */
  enableFilters?: boolean;
  enableCellCopyPaste?: boolean;
  enableCellDragAndDrop?: boolean;
  cellNavigationMode?: CellNavigationMode;

  /**
   * Miscellaneous
   */
  /** The node where the editor portal should mount. */
  editorPortalTarget?: Element;
  rowClass?: (row: R) => string | undefined;
}

/**
 * Main API Component to render a data grid of rows and columns
 *
 * @example
 *
 * <DataGrid columns={columns} rows={rows} />
*/
function DataGrid<R, K extends keyof R, SR>({
  // Grid and data Props
  columns: rawColumns,
  rows: rawRows,
  summaryRows,
  rowKey,
  onRowsUpdate,
  onRowsChange,
  // Dimensions props
  rowHeight = 20,
  headerRowHeight = rowHeight + 10,
  headerFiltersHeight = 45,
  // Feature props
  selectedRows,
  onSelectedRowsChange,
  sortColumn,
  sortDirection,
  onSort,
  filters,
  onFiltersChange,
  defaultColumnOptions,
  groupBy: rawGroupBy,
  rowGrouper,
  expandedGroupIds,
  onExpandedGroupIdsChange,
  // Custom renderers
  rowRenderer: RowRenderer = Row,
  emptyRowsRenderer,
  // Event props
  onRowClick,
  onScroll,
  onColumnResize,
  onSelectedCellChange,
  onCheckCellIsEditable,
  // Toggles and modes
  enableFilters = false,
  enableCellCopyPaste = false,
  enableCellDragAndDrop = false,
  cellNavigationMode = 'NONE',
  // Miscellaneous
  editorPortalTarget = document.body,
  className,
  style,
  rowClass,
  // ARIA
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  cellStyles,
  reorderRows
}: DataGridProps<R, K, SR>, ref: React.Ref<DataGridHandle>) {
  /**
   * states
   */
  const [eventBus] = useState(() => new EventBus());
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [columnWidths, setColumnWidths] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [selectedPosition, setSelectedPosition] = useState<SelectCellState | EditCellState<R>>({ idx: -1, rowIdx: -1, mode: 'SELECT' });
  const [copiedPosition, setCopiedPosition] = useState<Position & { value: unknown } | null>(null);
  const [draggedOverPos, setOverPos] = useState<Position | undefined>(undefined);
  const selectionType = useRef(0);

  const setDraggedOverPos = useCallback((rowIdx?: number, idx?: number) => {
    if (selectionType.current === 0) return;
    const pos = rowIdx !== undefined && idx !== undefined ? { rowIdx, idx } : undefined;
    setOverPos(pos);
    latestDraggedOverPos.current = pos;
  }, [selectionType]);

  /**
   * refs
   */
  const focusSinkRef = useRef<HTMLDivElement>(null);
  const prevSelectedPosition = useRef(selectedPosition);
  const latestDraggedOverPos = useRef(draggedOverPos);
  const lastSelectedRowIdx = useRef(-1);
  const isCellFocusable = useRef(false);

  /**
   * computed values
   */
  const [gridRef, gridWidth, gridHeight] = useGridDimensions();
  const headerRowsCount = enableFilters ? 2 : 1;
  const summaryRowsCount = summaryRows?.length ?? 0;
  const totalHeaderHeight = headerRowHeight + (enableFilters ? headerFiltersHeight : 0);
  const clientHeight = gridHeight - totalHeaderHeight - summaryRowsCount * rowHeight;
  const isSelectable = selectedRows !== undefined && onSelectedRowsChange !== undefined;

  const { columns, viewportColumns, totalColumnWidth, lastFrozenColumnIndex, totalFrozenColumnWidth, groupBy } = useViewportColumns({
    rawColumns,
    columnWidths,
    scrollLeft,
    viewportWidth: gridWidth,
    defaultColumnOptions,
    rawGroupBy,
    rowGrouper
  });

  const { rowOverscanStartIdx, rowOverscanEndIdx, rows, rowsCount, isGroupRow } = useViewportRows({
    rawRows,
    groupBy,
    rowGrouper,
    rowHeight,
    clientHeight,
    scrollTop,
    expandedGroupIds
  });

  const hasGroups = groupBy.length > 0 && rowGrouper;
  const minColIdx = hasGroups ? -1 : 0;

  if (hasGroups) {
    // Cell drag is not supported on a treegrid
    enableCellDragAndDrop = false;
  }

  /**
   * effects
   */
  useLayoutEffect(() => {
    if (selectedPosition === prevSelectedPosition.current || selectedPosition.mode === 'EDIT' || !isCellWithinBounds(selectedPosition)) return;
    if (selectedPosition.sel && selectedPosition.sel !== prevSelectedPosition.current.sel) {
      let newSelIdx; let newSelRowIdx;
      if (!prevSelectedPosition.current.sel) {
        newSelIdx = selectedPosition.idx === selectedPosition.sel.colStart ? selectedPosition.sel.colEnd : selectedPosition.sel.colStart;
        newSelRowIdx = selectedPosition.rowIdx === selectedPosition.sel.rowStart ? selectedPosition.sel.rowEnd : selectedPosition.sel.rowStart;
      } else {
        newSelIdx = selectedPosition.sel.colStart !== prevSelectedPosition.current.sel.colStart ? selectedPosition.sel.colStart : selectedPosition.sel.colEnd;
        newSelRowIdx = selectedPosition.sel.rowStart !== prevSelectedPosition.current.sel.rowStart ? selectedPosition.sel.rowStart : selectedPosition.sel.rowEnd;
      }
      const isFullSelection =
      (selectedPosition.sel.colStart === selectedPosition.sel.colEnd && selectedPosition.sel.rowStart === 0 && selectedPosition.sel.rowEnd === rowsCount - 1)
      || (selectedPosition.sel.rowStart === selectedPosition.sel.rowEnd && selectedPosition.sel.colStart === 1 && selectedPosition.sel.colEnd === columns.length - 1)
      || (selectedPosition.sel.rowStart === 0 && selectedPosition.sel.rowEnd === rowsCount - 1 && selectedPosition.sel.colStart === 0 && selectedPosition.sel.colEnd === columns.length - 1);
      if (!isFullSelection) scrollToCell({ idx: newSelIdx, rowIdx: newSelRowIdx });
    } else scrollToCell(selectedPosition);
    prevSelectedPosition.current = selectedPosition;

    if (isCellFocusable.current) {
      isCellFocusable.current = false;
      return;
    }
    focusSinkRef.current!.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (!onSelectedRowsChange) return;

    const handleRowSelectionChange = ({ rowIdx, checked, isShiftClick }: SelectRowEvent) => {
      assertIsValidKey(rowKey);
      const newSelectedRows = new Set(selectedRows);
      const row = rows[rowIdx];
      if (isGroupRow(row)) {
        for (const childRow of row.childRows) {
          if (checked) {
            newSelectedRows.add(childRow[rowKey]);
          } else {
            newSelectedRows.delete(childRow[rowKey]);
          }
        }
        onSelectedRowsChange(newSelectedRows);
        return;
      }

      const rowId = row[rowKey];
      if (checked) {
        newSelectedRows.add(rowId);
        const previousRowIdx = lastSelectedRowIdx.current;
        lastSelectedRowIdx.current = rowIdx;
        if (isShiftClick && previousRowIdx !== -1 && previousRowIdx !== rowIdx) {
          const step = Math.sign(rowIdx - previousRowIdx);
          for (let i = previousRowIdx + step; i !== rowIdx; i += step) {
            const row = rows[i];
            if (isGroupRow(row)) continue;
            newSelectedRows.add(row[rowKey]);
          }
        }
      } else {
        newSelectedRows.delete(rowId);
        lastSelectedRowIdx.current = -1;
      }
      onSelectedRowsChange(newSelectedRows);
    };

    return eventBus.subscribe('SelectRow', handleRowSelectionChange);
  }, [eventBus, isGroupRow, onSelectedRowsChange, rowKey, rows, selectedRows]);

  useEffect(() => {
    return eventBus.subscribe('SelectCell', selectCell);
  });

  useEffect(() => {
    if (!onExpandedGroupIdsChange) return;

    const toggleGroup = (expandedGroupId: unknown) => {
      const newExpandedGroupIds = new Set(expandedGroupIds);
      if (newExpandedGroupIds.has(expandedGroupId)) {
        newExpandedGroupIds.delete(expandedGroupId);
      } else {
        newExpandedGroupIds.add(expandedGroupId);
      }
      onExpandedGroupIdsChange(newExpandedGroupIds);
    };

    return eventBus.subscribe('ToggleGroup', toggleGroup);
  }, [eventBus, expandedGroupIds, onExpandedGroupIdsChange]);

  useImperativeHandle(ref, () => ({
    scrollToColumn(idx: number) {
      scrollToCell({ idx });
    },
    scrollToRow(rowIdx: number) {
      const { current } = gridRef;
      if (!current) return;
      current.scrollTop = rowIdx * rowHeight;
    },
    selectCell,
    focusGrid
  }));

  /**
   * event handlers
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const { key } = event;
    const row = rows[selectedPosition.rowIdx];

    if (
      enableCellCopyPaste
      && isCtrlKeyHeldDown(event)
      && isCellWithinBounds(selectedPosition)
      && !isGroupRow(row)
      && selectedPosition.idx !== -1
    ) {
      // key may be uppercase `C` or `V`
      const lowerCaseKey = key.toLowerCase();
      if (lowerCaseKey === 'c') {
        handleCopy();
        return;
      }
      if (lowerCaseKey === 'v') {
        handlePaste();
        return;
      }
    }

    if (
      isCellWithinBounds(selectedPosition)
      && isGroupRow(row)
      && selectedPosition.idx === -1
      && (
        // Collapse the current group row if it is focused and is in expanded state
        (key === 'ArrowLeft' && row.isExpanded)
        // Expand the current group row if it is focused and is in collapsed state
        || (key === 'ArrowRight' && !row.isExpanded)
      )) {
      event.preventDefault(); // Prevents scrolling
      eventBus.dispatch('ToggleGroup', row.id);
      return;
    }

    const ctrlKey = isCtrlKeyHeldDown(event);
    switch (event.key) {
      case 'Escape':
        if (selectedPosition.sel) {
          const newSelPos = { ...selectedPosition, idx: selectedPosition.idx || 1 };
          delete newSelPos.sel;
          selectCell(newSelPos);
        }
        setCopiedPosition(null);
        return;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Tab':
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
        if (ctrlKey) processHotkey(event);
        else navigate(event);
        break;
      case ' ':
        if ((event.shiftKey || ctrlKey) && event.key === ' ') processHotkey(event);
        else handleCellInput(event);
        break;
      case 'a':
        if (ctrlKey) processHotkey(event);
        else handleCellInput(event);
        break;
      default:
        if (!ctrlKey) handleCellInput(event);
        break;
    }
  }

  function handleFocus() {
    isCellFocusable.current = true;
  }

  function focusGrid() {
    focusSinkRef.current!.focus();
  }

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollLeft } = event.currentTarget;
    setScrollTop(scrollTop);
    setScrollLeft(scrollLeft);
    onScroll?.(event);
  }

  const handleColumnResize = useCallback((column: CalculatedColumn<R, SR>, width: number, mouseDown: boolean) => {
    const newColumnWidths = new Map(columnWidths);
    newColumnWidths.set(column.key, width);
    // After the resize width should be controlled again by columns prop
    const widths = mouseDown ? newColumnWidths : new Map();
    setColumnWidths(widths);

    onColumnResize?.(column.idx, width, mouseDown);
  }, [columnWidths, onColumnResize]);

  function getRawRowIdx(rowIdx: number) {
    return hasGroups ? rawRows.indexOf(rows[rowIdx] as R) : rowIdx;
  }

  function handleCommit({ cellKey, rowIdx, updated }: CommitEvent) {
    rowIdx = getRawRowIdx(rowIdx);
    onRowsUpdate?.({
      cellKey,
      fromRow: rowIdx,
      toRow: rowIdx,
      updated,
      action: 'CELL_UPDATE'
    });
    closeEditor();
  }

  function commitEditor2Changes() {
    if (
      columns[selectedPosition.idx]?.editor2 === undefined
      || selectedPosition.mode === 'SELECT'
      || selectedPosition.row === selectedPosition.originalRow) {
      return;
    }

    const updatedRows = [...rawRows];
    updatedRows[getRawRowIdx(selectedPosition.rowIdx)] = selectedPosition.row;
    onRowsChange?.(updatedRows);
  }

  function handleCopy() {
    const { idx, rowIdx } = selectedPosition;
    const rawRowIdx = getRawRowIdx(rowIdx);
    const value = rawRows[rawRowIdx][columns[idx].key as keyof R];
    setCopiedPosition({ idx, rowIdx, value });
  }

  function handlePaste() {
    if (
      copiedPosition === null
      || !isCellEditable(selectedPosition)
      || (copiedPosition.idx === selectedPosition.idx && copiedPosition.rowIdx === selectedPosition.rowIdx)
    ) {
      return;
    }

    const fromRow = getRawRowIdx(copiedPosition.rowIdx);
    const fromCellKey = columns[copiedPosition.idx].key;
    const toRow = getRawRowIdx(selectedPosition.rowIdx);
    const cellKey = columns[selectedPosition.idx].key;

    onRowsUpdate?.({
      cellKey,
      fromRow,
      toRow,
      updated: { [cellKey]: copiedPosition.value } as unknown as never,
      action: 'COPY_PASTE',
      fromCellKey
    });
  }

  function handleCellInput(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!isCellWithinBounds(selectedPosition)) return;
    const row = rows[selectedPosition.rowIdx];
    if (isGroupRow(row)) return;
    const { key } = event;
    const column = columns[selectedPosition.idx];

    if (selectedPosition.mode === 'EDIT') {
      if (key === 'Enter') {
        // Custom editors can listen for the event and stop propagation to prevent commit
        commitEditor2Changes();
        closeEditor();
      }
      return;
    }

    column.editorOptions?.onCellKeyDown?.(event);
    if (event.isDefaultPrevented()) return;

    if (isCellEditable(selectedPosition) && isDefaultCellInput(event)) {
      setSelectedPosition(({ idx, rowIdx }) => ({
        idx,
        rowIdx,
        key,
        mode: 'EDIT',
        row,
        originalRow: row
      }));
    }
  }

  const handleDragEnd = useCallback((rowIdx: number, idx: number, selType: number) => {
    if (latestDraggedOverPos.current === undefined) return;

    const column = columns[idx];
    const cellKey = column.key;
    const dragType = Math.abs(latestDraggedOverPos.current.idx - idx) > Math.abs(latestDraggedOverPos.current.rowIdx - rowIdx) ? 'col' : 'row';
    const value = rawRows[rowIdx][cellKey as keyof R];
    const selRowIdx = dragType === 'row' ? latestDraggedOverPos.current.rowIdx : rowIdx;
    const selColIdx = dragType === 'col' ? latestDraggedOverPos.current.idx : idx;
    // normal cell selection
    if (idx !== 0) {
      const sel = {
        rowStart: dragType === 'row' || selType !== 2 ? Math.min(latestDraggedOverPos.current.rowIdx, rowIdx) : rowIdx,
        rowEnd: dragType === 'row' || selType !== 2 ? Math.max(latestDraggedOverPos.current.rowIdx, rowIdx) : rowIdx,
        colStart: dragType === 'col' || selType !== 2 ? Math.min(latestDraggedOverPos.current.idx, idx) : idx,
        colEnd: dragType === 'col' || selType !== 2 ? Math.max(latestDraggedOverPos.current.idx, idx) : idx
      };
      if (sel.colStart === 0) sel.colStart = 1;
      selectCell({
        rowIdx,
        idx,
        sel
      });
    } else if (selType === 1) {
      // row headers selection
      selectCell({
        rowIdx,
        idx,
        sel: {
          rowStart: Math.min(latestDraggedOverPos.current.rowIdx, rowIdx),
          rowEnd: Math.max(latestDraggedOverPos.current.rowIdx, rowIdx),
          colStart: idx,
          colEnd: -1
        }
      });
    }
    setDraggedOverPos();

    if (selType === 2 || selType === 3) {
      onRowsUpdate?.({
        cellKey,
        fromRow: selType === 3 ? rowIdx : Math.min(rowIdx, selRowIdx),
        toRow: selType === 3 ? selRowIdx : Math.max(rowIdx, selRowIdx),
        fromCol: Math.min(idx, selColIdx),
        toCol: Math.max(idx, selColIdx),
        updated: { [cellKey]: value } as unknown as never,
        direction: dragType,
        action: 'CELL_DRAG'
      });
    }
  }, [columns, onRowsUpdate, setDraggedOverPos, rawRows]);

  const cellMouseDownHandler = useCallback((event: React.MouseEvent<HTMLDivElement, MouseEvent>, rowIdx: number, idx: number) => {
    if (event.buttons !== 1) return;

    const eventTarget = event.target as HTMLElement;
    let selType = 1;
    if (eventTarget.id === 'rdg-drag-handle') selType = 2;
    else if (eventTarget.id === 'rdg-reorder-handle') selType = 3;
    selectionType.current = selType;

    window.addEventListener('mouseover', onMouseOver);
    window.addEventListener('mouseup', onMouseUp);

    function onMouseOver(event: MouseEvent) {
      // Trigger onMouseup in edge cases where we release the mouse button but `mouseup` isn't triggered,
      // for example when releasing the mouse button outside the iframe the grid is rendered in.
      // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
      if (event.buttons !== 1) onMouseUp();
    }

    function onMouseUp() {
      window.removeEventListener('mouseover', onMouseOver);
      window.removeEventListener('mouseup', onMouseUp);
      handleDragEnd(rowIdx, idx, selType);
      selectionType.current = 0;
    }
  }, [handleDragEnd]);

  /*function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    event.stopPropagation();

    const column = columns[selectedPosition.idx];
    const cellKey = column.key;
    const value = rawRows[selectedPosition.rowIdx][cellKey as keyof R];

    onRowsUpdate?.({
      cellKey,
      fromRow: selectedPosition.rowIdx,
      toRow: rawRows.length - 1,
      updated: { [cellKey]: value } as unknown as never,
      action: 'COLUMN_FILL'
    });
  }*/

  function handleRowChange(row: Readonly<R>, commitChanges?: boolean) {
    if (selectedPosition.mode === 'SELECT') return;
    if (commitChanges) {
      const updatedRows = [...rawRows];
      updatedRows[getRawRowIdx(selectedPosition.rowIdx)] = row;
      onRowsChange?.(updatedRows);
      closeEditor();
    } else {
      setSelectedPosition(position => ({ ...position, row }));
    }
  }

  function handleOnClose(commitChanges?: boolean) {
    if (commitChanges) {
      commitEditor2Changes();
    }
    closeEditor();
  }

  /**
   * utils
   */
  function isCellWithinBounds({ idx, rowIdx }: Position): boolean {
    return rowIdx >= 0 && rowIdx < rows.length && idx >= minColIdx && idx < columns.length;
  }

  function isCellSelectionWithinBounds({ rowStart, rowEnd, colStart, colEnd }: GridSelection): boolean {
    return rowStart >= 0 && rowEnd < rows.length && colStart >= minColIdx && colEnd < columns.length;
  }

  function isCellEditable(position: Position): boolean {
    return isCellWithinBounds(position)
      && isSelectedCellEditable<R, SR>({ columns, rows, selectedPosition: position, onCheckCellIsEditable, isGroupRow });
  }

  function selectCell(position: Position, enableEditor = false): void {
    if (!isCellWithinBounds(position)) return;

    if (position.sel?.colEnd === -1) {
      if (position.sel.rowEnd !== -1) position.idx = 0;
      position.sel.colEnd = columns.length - 1;
    }
    if (position.sel?.rowEnd === -1) {
      position.sel.rowEnd = rowsCount - 1;
    }
    if (position.sel && !isCellSelectionWithinBounds(position.sel)) return;
    commitEditor2Changes();

    if (enableEditor && (isCellEditable(position) || position.idx === 0)) {
      const row = rows[position.rowIdx] as R;
      setSelectedPosition({ ...position, mode: 'EDIT', key: null, row, originalRow: row });
    } else {
      setSelectedPosition({ ...position, mode: 'SELECT' });
    }
    onSelectedCellChange?.({ ...position });
    focusSinkRef.current!.focus();
  }

  function closeEditor() {
    if (selectedPosition.mode === 'SELECT') return;
    setSelectedPosition(({ idx, rowIdx }) => ({ idx: idx || 1, rowIdx, mode: 'SELECT' }));
  }

  function scrollToCell({ idx, rowIdx }: Partial<Position>): void {
    const { current } = gridRef;
    if (!current) return;

    if (typeof idx === 'number' && idx > lastFrozenColumnIndex) {
      const { clientWidth } = current;
      const { left, width } = columns[idx];
      const isCellAtLeftBoundary = left < scrollLeft + width + totalFrozenColumnWidth;
      const isCellAtRightBoundary = left + width > clientWidth + scrollLeft;
      if (isCellAtLeftBoundary || isCellAtRightBoundary) {
        const newScrollLeft = getColumnScrollPosition(columns, idx, scrollLeft, clientWidth);
        current.scrollLeft = scrollLeft + newScrollLeft;
      }
    }

    if (typeof rowIdx === 'number') {
      if (rowIdx * rowHeight < scrollTop) {
        // at top boundary, scroll to the row's top
        current.scrollTop = rowIdx * rowHeight;
      } else if ((rowIdx + 1) * rowHeight > scrollTop + clientHeight) {
        // at bottom boundary, scroll the next row's top to the bottom of the viewport
        current.scrollTop = (rowIdx + 1) * rowHeight - clientHeight;
      }
    }
  }

  function updateSelection(cse: string, row: number, col: number, sel: GridSelection | undefined): GridSelection {
    if (!sel) sel = { rowStart: row, rowEnd: row, colStart: col, colEnd: col };
    else sel = { ...sel };
    switch (cse) {
      case 'ArrowUp':
        if (sel.rowEnd > row) sel.rowEnd -= 1;
        else sel.rowStart -= 1;
        return sel;
      case 'ArrowDown':
        if (sel.rowStart < row) sel.rowStart += 1;
        else sel.rowEnd += 1;
        return sel;
      case 'ArrowLeft':
        if (sel.colEnd > col) sel.colEnd -= 1;
        else sel.colStart -= 1;
        return sel;
      case 'ArrowRight':
        if (sel.colStart < col) sel.colStart += 1;
        else sel.colEnd += 1;
        return sel;
      default:
        return sel;
    }
  }

  function getNextPosition(key: string, ctrlKey: boolean, shiftKey: boolean): Position {
    const { idx, rowIdx, sel } = selectedPosition;
    const row = rows[rowIdx];
    const isRowSelected = isCellWithinBounds(selectedPosition) && idx === -1;

    // If a group row is focused, and it is collapsed, move to the parent group row (if there is one).
    if (
      key === 'ArrowLeft'
      && isRowSelected
      && isGroupRow(row)
      && !row.isExpanded
      && row.level !== 0
    ) {
      let parentRowIdx = -1;
      for (let i = selectedPosition.rowIdx - 1; i >= 0; i--) {
        const parentRow = rows[i];
        if (isGroupRow(parentRow) && parentRow.id === row.parentId) {
          parentRowIdx = i;
          break;
        }
      }
      if (parentRowIdx !== -1) {
        return { idx, rowIdx: parentRowIdx };
      }
    }

    switch (key) {
      case 'ArrowUp':
        if (shiftKey) return { idx, rowIdx, sel: updateSelection(key, rowIdx, idx, sel) };
        return { idx, rowIdx: rowIdx - 1 };
      case 'ArrowDown':
        if (shiftKey) return { idx, rowIdx, sel: updateSelection(key, rowIdx, idx, sel) };
        return { idx, rowIdx: rowIdx + 1 };
      case 'ArrowLeft':
        if (shiftKey) return { idx, rowIdx, sel: updateSelection(key, rowIdx, idx, sel) };
        return { idx: idx - 1, rowIdx };
      case 'ArrowRight':
        if (shiftKey) return { idx, rowIdx, sel: updateSelection(key, rowIdx, idx, sel) };
        return { idx: idx + 1, rowIdx };
      case 'Tab':
        if (selectedPosition.idx === -1 && selectedPosition.rowIdx === -1) {
          return shiftKey ? { idx: columns.length - 1, rowIdx: rows.length - 1 } : { idx: 0, rowIdx: 0 };
        }
        return { idx: idx + (shiftKey ? -1 : 1), rowIdx };
      case 'Home':
        // If row is selected then move focus to the first row
        if (isRowSelected) return { idx, rowIdx: 0 };
        return ctrlKey ? { idx: 0, rowIdx: 0 } : { idx: 0, rowIdx };
      case 'End':
        // If row is selected then move focus to the last row.
        if (isRowSelected) return { idx, rowIdx: rows.length - 1 };
        return ctrlKey ? { idx: columns.length - 1, rowIdx: rows.length - 1 } : { idx: columns.length - 1, rowIdx };
      case 'PageUp':
        return { idx, rowIdx: rowIdx - Math.floor(clientHeight / rowHeight) };
      case 'PageDown':
        return { idx, rowIdx: rowIdx + Math.floor(clientHeight / rowHeight) };
      default:
        return selectedPosition;
    }
  }

  function navigate(event: React.KeyboardEvent<HTMLDivElement>) {
    const { key, shiftKey } = event;
    const ctrlKey = isCtrlKeyHeldDown(event);

    let nextPosition = getNextPosition(key, ctrlKey, shiftKey);

    let mode = cellNavigationMode;
    if (key === 'Tab') {
      // If we are in a position to leave the grid, stop editing but stay in that cell
      if (canExitGrid({ shiftKey, cellNavigationMode, columns, rowsCount: rows.length, selectedPosition })) {
        // Allow focus to leave the grid so the next control in the tab order can be focused
        return;
      }

      mode = cellNavigationMode === 'NONE'
        ? 'CHANGE_ROW'
        : cellNavigationMode;
    }

    // Do not allow focus to leave
    event.preventDefault();

    nextPosition = getNextSelectedCellPosition<R, SR>({
      columns,
      rowsCount: rows.length,
      cellNavigationMode: mode,
      nextPosition
    });
    selectCell(nextPosition);
  }

  function processHotkey(event: React.KeyboardEvent<HTMLDivElement>) {
    const { key, shiftKey } = event;
    const ctrlKey = isCtrlKeyHeldDown(event);
    preventDefault(event);

    const nextPos = { ...selectedPosition };
    if (ctrlKey && key === 'a') {
      nextPos.sel = { rowStart: 0, rowEnd: rows.length - 1, colStart: 0, colEnd: columns.length - 1 };
    } else if (ctrlKey && key === ' ') {
      nextPos.sel = { rowStart: 0, rowEnd: rows.length - 1, colStart: selectedPosition.idx, colEnd: selectedPosition.idx };
    } else if (shiftKey && key === ' ') {
      nextPos.sel = { rowStart: selectedPosition.rowIdx, rowEnd: selectedPosition.rowIdx, colStart: 1, colEnd: columns.length - 1 };
    } else if (ctrlKey && shiftKey) {
      if (!nextPos.sel) nextPos.sel = { rowStart: nextPos.rowIdx, rowEnd: nextPos.rowIdx, colStart: nextPos.idx, colEnd: nextPos.idx };
      switch (key) {
        case 'ArrowUp':
          nextPos.sel.rowStart = 0;
          break;
        case 'ArrowDown':
          nextPos.sel.rowEnd = rows.length - 1;
          break;
        case 'ArrowLeft':
          nextPos.sel.colStart = 1;
          break;
        case 'ArrowRight':
          nextPos.sel.colEnd = columns.length - 1;
          break;
        default:
          break;
      }
    } else if (ctrlKey) {
      switch (key) {
        case 'ArrowUp':
          nextPos.rowIdx = 0;
          break;
        case 'ArrowDown':
          nextPos.rowIdx = rows.length - 1;
          break;
        case 'ArrowLeft':
          nextPos.idx = 1;
          break;
        case 'ArrowRight':
          nextPos.idx = columns.length - 1;
          break;
        default:
          break;
      }
    }
    selectCell(nextPos);
  }

  function isReorderingRow(currentRowIdx: number): boolean {
    return selectionType.current === 3 && draggedOverPos?.rowIdx === currentRowIdx;
  }

  function getDraggedOverCellsRange(currentRowIdx: number): number[] | undefined {
    if (draggedOverPos === undefined || selectionType.current === 0) return;
    const { idx, rowIdx } = selectedPosition;

    // drag across cols
    if (selectionType.current === 2 && Math.abs(idx - draggedOverPos.idx)
    > Math.abs(rowIdx - draggedOverPos.rowIdx)) {
      return currentRowIdx === rowIdx ? [idx, draggedOverPos.idx].sort() : undefined;
    }

    // drag across rows
    const isDraggedOver = rowIdx < draggedOverPos.rowIdx
      ? rowIdx <= currentRowIdx && currentRowIdx <= draggedOverPos.rowIdx
      : rowIdx >= currentRowIdx && currentRowIdx >= draggedOverPos.rowIdx;

    if (!isDraggedOver) return undefined;
    if (selectionType.current === 1) return [idx, draggedOverPos.idx].sort();
    if (selectionType.current === 2) return [idx, idx];
    return undefined;
  }

  const getSelectedCellsRange = function(rowIdx: number): number[] | undefined {
    const sel = selectedPosition?.sel;
    if (!sel) return undefined;
    if (sel.rowStart <= rowIdx && sel.rowEnd >= rowIdx) {
      return [sel.colStart, sel.colEnd];
    }
    return undefined;
  };

  function getSelectedCellProps(rowIdx: number): SelectedCellProps | EditCellProps<R> | undefined {
    if (selectedPosition.rowIdx !== rowIdx) return;

    if (selectedPosition.mode === 'EDIT') {
      return {
        mode: 'EDIT',
        idx: selectedPosition.idx,
        rowIdx: selectedPosition.rowIdx,
        onKeyDown: handleKeyDown,
        editorPortalTarget,
        editorContainerProps: {
          rowHeight,
          scrollLeft,
          scrollTop,
          firstEditorKeyPress: selectedPosition.key,
          onCommit: handleCommit,
          onCommitCancel: closeEditor
        },
        editor2Props: {
          rowHeight,
          row: selectedPosition.row,
          onRowChange: handleRowChange,
          onClose: handleOnClose
        }
      };
    }

    return {
      mode: 'SELECT',
      idx: selectedPosition.idx,
      rowIdx: selectedPosition.rowIdx,
      onFocus: handleFocus,
      onKeyDown: handleKeyDown
    };
  }

  function getViewportRows() {
    const rowElements = [];
    let startRowIndex = 0;
    for (let rowIdx = rowOverscanStartIdx; rowIdx <= rowOverscanEndIdx; rowIdx++) {
      const row = rows[rowIdx];
      const top = rowIdx * rowHeight + totalHeaderHeight;
      if (isGroupRow(row)) {
        ({ startRowIndex } = row);
        rowElements.push(
          <GroupRowRenderer<R, SR>
            aria-level={row.level + 1} // aria-level is 1-based
            aria-setsize={row.setSize}
            aria-posinset={row.posInSet + 1} // aria-posinset is 1-based
            aria-rowindex={headerRowsCount + startRowIndex + 1} // aria-rowindex is 1 based
            key={row.id}
            id={row.id}
            groupKey={row.groupKey}
            viewportColumns={viewportColumns}
            childRows={row.childRows}
            rowIdx={rowIdx}
            top={top}
            level={row.level}
            isExpanded={row.isExpanded}
            selectedCellIdx={selectedPosition.rowIdx === rowIdx ? selectedPosition.idx : undefined}
            isRowSelected={isSelectable && row.childRows.every(cr => selectedRows?.has(cr[rowKey!]))}
            eventBus={eventBus}
            onFocus={selectedPosition.rowIdx === rowIdx ? handleFocus : undefined}
            onKeyDown={selectedPosition.rowIdx === rowIdx ? handleKeyDown : undefined}
          />
        );
        continue;
      }

      startRowIndex++;
      let key: string | number = hasGroups ? startRowIndex : rowIdx;
      let isRowSelected = false;
      if (rowKey !== undefined) {
        const rowId = row[rowKey];
        isRowSelected = selectedRows?.has(rowId) ?? false;
        if (typeof rowId === 'string' || typeof rowId === 'number') {
          key = rowId;
        }
      }

      rowElements.push(
        <RowRenderer
          aria-rowindex={headerRowsCount + (hasGroups ? startRowIndex : rowIdx) + 1} // aria-rowindex is 1 based
          aria-selected={isSelectable ? isRowSelected : undefined}
          cellStyles={cellStyles?.[rowIdx]}
          key={key}
          rowIdx={rowIdx}
          row={row}
          viewportColumns={viewportColumns}
          eventBus={eventBus}
          isRowSelected={isRowSelected}
          onRowClick={onRowClick}
          rowClass={rowClass}
          top={top}
          copiedCellIdx={copiedPosition?.rowIdx === rowIdx ? copiedPosition.idx : undefined}
          setDraggedOverPos={setDraggedOverPos}
          enableDrag={enableCellDragAndDrop}
          selectedCellProps={getSelectedCellProps(rowIdx)}
          cellMouseDownHandler={cellMouseDownHandler}
          selectedRange={getSelectedCellsRange(rowIdx)}
          draggedOverRange={getDraggedOverCellsRange(rowIdx)}
          reorderRows={reorderRows}
          isReorderingRow={isReorderingRow(rowIdx)}
        />
      );
    }

    return rowElements;
  }

  // Reset the positions if the current values are no longer valid. This can happen if a column or row is removed
  if (selectedPosition.idx >= columns.length || selectedPosition.rowIdx >= rows.length) {
    setSelectedPosition({ idx: -1, rowIdx: -1, mode: 'SELECT' });
    setCopiedPosition(null);
    setDraggedOverPos(undefined);
  }

  if (selectedPosition.mode === 'EDIT' && rows[selectedPosition.rowIdx] !== selectedPosition.originalRow) {
    // Discard changes if rows are updated from outside
    // We need to avoid this to keep row headers editable when a temp row becomes non temp and header is still being named
    //closeEditor();
  }

  return (
    <div
      role={hasGroups ? 'treegrid' : 'grid'}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-multiselectable={isSelectable ? true : undefined}
      aria-colcount={columns.length}
      aria-rowcount={headerRowsCount + rowsCount + summaryRowsCount}
      className={clsx('rdg', { 'rdg-viewport-dragging': selectionType.current === 2 }, className)}
      style={{
        ...style,
        '--header-row-height': `${headerRowHeight}px`,
        '--filter-row-height': `${headerFiltersHeight}px`,
        '--row-width': `${totalColumnWidth}px`,
        '--row-height': `${rowHeight}px`
      } as unknown as React.CSSProperties}
      ref={gridRef}
      onScroll={handleScroll}
    >
      <HeaderRow<R, K, SR>
        rowKey={rowKey}
        rows={rawRows}
        columns={viewportColumns}
        onColumnResize={handleColumnResize}
        eventBus={eventBus}
        allRowsSelected={selectedRows?.size === rawRows.length}
        onSelectedRowsChange={onSelectedRowsChange}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        setDraggedOverPos={setDraggedOverPos}
        isReorderingRow={isReorderingRow(-1)}
      />
      {enableFilters && (
        <FilterRow<R, SR>
          columns={viewportColumns}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      )}
      {rows.length === 0 && emptyRowsRenderer ? createElement(emptyRowsRenderer) : (
        <>
          <div
            ref={focusSinkRef}
            tabIndex={0}
            className="rdg-focus-sink"
            onKeyDown={handleKeyDown}
          />
          <div style={{ height: Math.max(rows.length * rowHeight, clientHeight) }} />
          {getViewportRows()}
          {summaryRows?.map((row, rowIdx) => (
            <SummaryRow<R, SR>
              aria-rowindex={headerRowsCount + rowsCount + rowIdx + 1}
              key={rowIdx}
              rowIdx={rowIdx}
              row={row}
              bottom={rowHeight * (summaryRows.length - 1 - rowIdx)}
              viewportColumns={viewportColumns}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default forwardRef(
  DataGrid as React.ForwardRefRenderFunction<DataGridHandle>
) as <R, K extends keyof R, SR = unknown>(props: DataGridProps<R, K, SR> & React.RefAttributes<DataGridHandle>) => JSX.Element;
