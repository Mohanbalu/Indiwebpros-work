import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Filter, ArrowUpDown, ChevronDown, RefreshCw, X, Edit, Layers, Sparkles } from 'lucide-react';

export interface ColumnDefinition<T> {
  key: keyof T | 'actions';
  header: string;
  type: 'text' | 'number' | 'date' | 'select' | 'formula';
  selectOptions?: string[];
  placeholder?: string;
  isCurrency?: boolean;
  isCalculated?: boolean;
  calculateFormula?: (row: T) => number;
}

interface ExcelTableProps<T extends { id: string }> {
  title: string;
  description: string;
  data: T[];
  columns: ColumnDefinition<T>[];
  onAdd: (newRecord: Partial<T>) => void;
  onUpdate: (id: string, updatedRecord: Partial<T>) => void;
  onDelete: (id: string) => void;
  onReset?: () => void;
  defaultNewRecord: Partial<T>;
  suggestionsMap?: Record<string, { value: string; subtext?: string; fillOthers?: Record<string, any> }[]>;
}

interface SuggestiveInputProps {
  value: string;
  onChange: (val: string, fillOthers?: Record<string, any>) => void;
  placeholder: string;
  suggestions?: { value: string; subtext?: string; fillOthers?: Record<string, any> }[];
}

function SuggestiveInput({ value, onChange, placeholder, suggestions }: SuggestiveInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter suggestions based on typed input
  const filteredSuggestions = useMemo(() => {
    if (!suggestions) return [];
    if (!value.trim()) return suggestions; // Show all on focus if empty
    const q = value.toLowerCase();
    return suggestions.filter(item => 
      item.value.toLowerCase().includes(q) || 
      (item.subtext && item.subtext.toLowerCase().includes(q))
    );
  }, [suggestions, value]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Allow onMouseDown on suggestions to execute first
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder={placeholder}
        className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg pl-2 pr-7 py-2 focus:outline-none focus:ring-1 focus:ring-[#0f4c81] focus:border-[#0f4c81]"
      />
      {suggestions && suggestions.length > 0 && (
        <span className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-indigo-400 pointer-events-none" title="Smart suggestions active for this field">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      )}
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto z-50 py-1 divide-y divide-slate-100">
          {filteredSuggestions.map((item, idx) => (
            <button
              key={`${item.value}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                // Prevent input focus loss from dismissing selection before registing click
                e.preventDefault();
                onChange(item.value, item.fillOthers);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition duration-75 text-slate-800"
            >
              <div>
                <span className="font-semibold">{item.value}</span>
                {item.fillOthers && Object.keys(item.fillOthers).length > 0 && (
                  <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded ml-1.5 border border-indigo-120">
                    + Auto-fill
                  </span>
                )}
              </div>
              {item.subtext && (
                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                  {item.subtext}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExcelTable<T extends { id: string }>({
  title,
  description,
  data,
  columns,
  onAdd,
  onUpdate,
  onDelete,
  onReset,
  defaultNewRecord,
  suggestionsMap,
}: ExcelTableProps<T>) {
  // Search & Filtering State
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilterRow, setShowFilterRow] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);

  // Pagination or Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit / Add Record Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<Partial<T> | null>(null);

  // Dropdown menus for bulk actions or downloads
  const [focusedCell, setFocusedCell] = useState<{ id: string; key: keyof T } | null>(null);

  // Sorting Handler
  const handleSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Direct Column Filter Change
  const handleColumnFilterChange = (key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Toggle single row selection
  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Toggle selection of all rows
  const toggleSelectAll = (filteredRows: T[]) => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map(r => r.id)));
    }
  };

  // Filter and Sort Rows
  const processedRows = useMemo(() => {
    let result = [...data];

    // Global Text Search
    if (globalSearch.trim() !== '') {
      const q = globalSearch.toLowerCase();
      result = result.filter(row => {
        return Object.entries(row).some(([_, val]) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // Column-specific search
    (Object.entries(columnFilters) as [string, string][]).forEach(([key, filterValue]) => {
      const filterText = String(filterValue || '').trim();
      if (filterText !== '') {
        const q = filterText.toLowerCase();
        result = result.filter(row => {
          const val = row[key as keyof T];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      }
    });

    // Apply Sorting
    if (sortConfig) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        // For string comparison
        if (typeof valA === 'string' && typeof valB === 'string') {
          return direction === 'asc' 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        // For number comparison
        if (typeof valA === 'number' && typeof valB === 'number') {
          return direction === 'asc' ? valA - valB : valB - valA;
        }

        // Fallback
        const strA = String(valA || '');
        const strB = String(valB || '');
        return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [data, globalSearch, columnFilters, sortConfig]);

  // Aggregate stats (Calculates totals for numbers in columns)
  const columnAggregates = useMemo(() => {
    const sums: Record<string, number> = {};
    columns.forEach(col => {
      if (col.type === 'number' || col.type === 'formula') {
        const keyStr = col.key as string;
        sums[keyStr] = processedRows.reduce((sum, row) => {
          if (col.type === 'formula' && col.calculateFormula) {
            return sum + col.calculateFormula(row);
          }
          const val = Number(row[col.key as keyof T]) || 0;
          return sum + val;
        }, 0);
      }
    });
    return sums;
  }, [processedRows, columns]);

  // Handle cell inline double click / editing
  const handleCellClick = (id: string, key: keyof T) => {
    setFocusedCell({ id, key });
  };

  // Color rendering classes for status pills
  const formatStatus = (val: string) => {
    const status = String(val).toLowerCase();
    
    // Payment Statuses
    if (status === 'paid' || status === 'received' || status === 'issued' || status === 'completed' || status === 'delivered') {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center';
    }
    if (status === 'partial' || status === 'testing' || status === 'in progress') {
      return 'bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center';
    }
    if (status === 'pending' || status === 'planning') {
      return 'bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center';
    }
    return 'bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center';
  };

  const handleOpenAddModal = () => {
    setActiveRecord({ ...defaultNewRecord });
    setIsAddOpen(true);
  };

  const handleOpenEditModal = (row: T) => {
    setActiveRecord({ ...row });
    setIsEditOpen(true);
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRecord) {
      onAdd(activeRecord);
      setIsAddOpen(false);
      setActiveRecord(null);
    }
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRecord && activeRecord.id) {
      onUpdate(activeRecord.id, activeRecord);
      setIsEditOpen(false);
      setActiveRecord(null);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete the ${selectedIds.size} selected rows?`)) {
      selectedIds.forEach(id => onDelete(id));
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Panel */}
      <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#0f4c81] text-white rounded text-xs font-bold font-mono">XLSX</span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search table..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-48 md:w-60 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0f4c81] cursor-text"
            />
          </div>

          <button
            onClick={() => setShowFilterRow(!showFilterRow)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition ${
              showFilterRow
                ? 'bg-[#0f4c81]/10 text-[#0f4c81] border-[#0f4c81]/30'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Auto-Filters
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-medium transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedIds.size})
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#0f4c81] hover:bg-[#0c3e6a] text-white rounded-lg text-xs font-semibold transition"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>

          {onReset && (
            <button
              onClick={onReset}
              title="Reset default data"
              className="p-1.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-slate-600 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="overflow-x-auto max-h-[580px] relative scrollbar-thin">
        <table className="w-full text-left border-collapse table-auto">
          {/* Frozen Heading Row */}
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="bg-[#0f4c81] text-white text-xs uppercase tracking-wider font-semibold">
              <th className="p-3 w-10 text-center select-none bg-[#0f4c81] border-r border-[#0d3f6d]">
                <input
                  type="checkbox"
                  checked={processedRows.length > 0 && selectedIds.size === processedRows.length}
                  onChange={() => toggleSelectAll(processedRows)}
                  className="rounded border-slate-300 text-[#0f4c81] focus:ring-[#0f4c81] cursor-pointer"
                />
              </th>
              
              {columns.map(col => (
                <th
                  key={col.key as string}
                  onClick={() => col.key !== 'actions' && handleSort(col.key as keyof T)}
                  className={`p-3 border-r border-[#0d3f6d] select-none text-slate-100 transition whitespace-nowrap ${
                    col.key !== 'actions' ? 'cursor-pointer hover:bg-[#125893]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>{col.header}</span>
                    {col.key !== 'actions' && col.type !== 'formula' && (
                      <ArrowUpDown className="h-3 w-3 opacity-60 flex-shrink-0" />
                    )}
                  </div>
                </th>
              ))}
            </tr>

            {/* Auto Filters Row */}
            {showFilterRow && (
              <tr className="bg-slate-100 border-b border-slate-200">
                <td className="p-1 text-center bg-slate-100 border-r border-slate-200"></td>
                {columns.map(col => (
                  <td key={`filter-${col.key as string}`} className="p-1 px-1.5 bg-slate-100 border-r border-slate-200">
                    {col.key !== 'actions' && (
                      <input
                        type="text"
                        placeholder={`Filter...`}
                        value={columnFilters[col.key as string] || ''}
                        onChange={(e) => handleColumnFilterChange(col.key as string, e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-[#0f4c81]"
                      />
                    )}
                  </td>
                ))}
              </tr>
            )}
          </thead>

          {/* Table Data Entries */}
          <tbody className="divide-y divide-slate-150">
            {processedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-12 text-center text-slate-400 text-xs">
                  No matching workbook entries found. Try clearing filters or add a new record.
                </td>
              </tr>
            ) : (
              processedRows.map((row) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`text-slate-700 text-xs transition duration-75 hover:bg-slate-50/70 border-b border-l border-slate-100 ${
                      isSelected ? 'bg-sky-50/50' : ''
                    }`}
                  >
                    {/* Select box column */}
                    <td className="p-2.5 text-center border-r border-slate-200/80 bg-slate-50/40">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(row.id)}
                        className="rounded border-slate-300 text-[#0f4c81] focus:ring-[#0f4c81] cursor-pointer shadow-none"
                      />
                    </td>

                    {/* Dynamic Sheet Columns */}
                    {columns.map(col => {
                      if (col.key === 'actions') {
                        return (
                          <td key={`${row.id}-actions`} className="p-2 border-r border-slate-200/80 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(row)}
                                className="p-1 text-slate-500 hover:text-[#0f4c81] hover:bg-slate-150 rounded transition"
                                title="Edit row"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Delete this entry?')) onDelete(row.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Delete row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        );
                      }

                      // Evaluate values
                      let displayingValue: any = row[col.key as keyof T];

                      // Formula calculations
                      if (col.type === 'formula' && col.calculateFormula) {
                        displayingValue = col.calculateFormula(row);
                      }

                      // Check selection / validation dropdown styles
                      const isSelectType = col.type === 'select';
                      const isNumber = col.type === 'number' || col.type === 'formula';
                      const isCurrency = col.isCurrency;

                      return (
                        <td
                          key={`${row.id}-${col.key as string}`}
                          onClick={() => handleCellClick(row.id, col.key as keyof T)}
                          className={`p-2.5 border-r border-slate-200/80 font-normal select-text relative cursor-default ${
                            isNumber ? 'text-right font-mono text-slate-800' : ''
                          } ${col.type === 'formula' ? 'bg-slate-50/60 font-semibold' : ''}`}
                        >
                          {isSelectType ? (
                            <div className="flex items-center justify-between">
                              <span className={formatStatus(String(displayingValue))}>
                                {displayingValue || 'N/A'}
                              </span>
                            </div>
                          ) : isCurrency ? (
                            <span className="text-slate-800">
                              ₹{(Number(displayingValue) || 0).toLocaleString('en-IN')}
                            </span>
                          ) : col.type === 'date' ? (
                            <span className="text-slate-500 font-mono">
                              {displayingValue ? String(displayingValue) : 'N/A'}
                            </span>
                          ) : (
                            <span className="truncate max-w-[180px] inline-block" title={String(displayingValue || '')}>
                              {displayingValue !== null && displayingValue !== undefined ? String(displayingValue) : ''}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}

            {/* Calculations Total Row (Excel style) */}
            {processedRows.length > 0 && (
              <tr className="bg-slate-100/90 font-bold text-slate-800 text-xs border-y-2 border-slate-300">
                <td className="p-3 text-center border-r border-slate-200"></td>
                {columns.map((col, idx) => {
                  const isCalculatedColumn = col.type === 'number' || col.type === 'formula';
                  const sumValue = columnAggregates[col.key as string] || 0;

                  return (
                    <td
                      key={`total-${col.key as string}`}
                      className={`p-3 border-r border-slate-200 whitespace-nowrap ${
                        isCalculatedColumn ? 'text-right font-mono' : idx === 1 ? 'text-left uppercase' : ''
                      }`}
                    >
                      {idx === 0 ? (
                        <span className="text-slate-500 font-mono text-[10px] tracking-wider uppercase">SUM SUMMARY</span>
                      ) : idx === 1 ? (
                        <span>TOTALS</span>
                      ) : isCalculatedColumn ? (
                        col.isCurrency ? (
                          <span className="text-slate-900 font-bold border-b border-double border-slate-900 pb-0.5">
                            ₹{sumValue.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-slate-900 font-bold border-b border-double border-slate-800 pb-0.5">
                            {sumValue.toLocaleString()}
                          </span>
                        )
                      ) : (
                        ''
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Status Footer info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-550 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-4">
          <span>
            Total Rows: <strong>{data.length}</strong>
          </span>
          {processedRows.length !== data.length && (
            <span className="text-blue-700">
              Filtered: <strong>{processedRows.length}</strong> rows
            </span>
          )}
          {selectedIds.size > 0 && (
            <span className="text-rose-600 font-medium">
              Selected: <strong>{selectedIds.size}</strong> rows
            </span>
          )}
        </div>
        <div className="text-slate-450 font-mono flex items-center gap-1">
          <Layers className="h-3 w-3 text-slate-400" />
          Cambrian Spreadsheet Grid v1.1 • Live persistent calculations
        </div>
      </div>

      {/* 2. ADD ROW MODAL */}
      {isAddOpen && activeRecord && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#0f4c81] text-white rounded">
                  <Plus className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Add New Row • {title}</h3>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitAdd} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {columns
                  .filter(col => col.key !== 'actions' && !col.isCalculated)
                  .map(col => {
                    const k = col.key as string;
                    return (
                      <div key={`add-input-${k}`} className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">{col.header}</label>
                        {col.type === 'select' ? (
                          <select
                            value={String(activeRecord[col.key as keyof T] || '')}
                            onChange={(e) => setActiveRecord(prev => ({ ...prev, [col.key]: e.target.value }))}
                            required
                            className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#0f4c81] focus:border-[#0f4c81]"
                          >
                            <option value="">-- Choose Status / Type --</option>
                            {col.selectOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : col.type === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            value={activeRecord[col.key as keyof T] !== undefined ? String(activeRecord[col.key as keyof T]) : ''}
                            onChange={(e) => setActiveRecord(prev => ({ ...prev, [col.key]: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                            placeholder={col.placeholder || 'e.g. 1000'}
                            required
                            className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#0f4c81]"
                          />
                        ) : col.type === 'date' ? (
                          <input
                            type="date"
                            value={String(activeRecord[col.key as keyof T] || '')}
                            onChange={(e) => setActiveRecord(prev => ({ ...prev, [col.key]: e.target.value }))}
                            required
                            className="w-full text-xs text-slate-705 bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#0f4c81]"
                          />
                        ) : (
                          <SuggestiveInput
                            value={String(activeRecord[col.key as keyof T] || '')}
                            onChange={(val, fillOthers) => {
                              setActiveRecord(prev => {
                                if (!prev) return prev;
                                const next = { ...prev, [col.key]: val };
                                if (fillOthers) {
                                  Object.entries(fillOthers).forEach(([otherKey, otherVal]) => {
                                    next[otherKey as keyof T] = otherVal;
                                  });
                                }
                                return next;
                              });
                            }}
                            placeholder={col.placeholder || `Enter ${col.header}`}
                            suggestions={suggestionsMap ? suggestionsMap[k] : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
                <span className="font-semibold text-slate-700">Calculated formulas inside this table:</span>
                {columns.filter(col => col.type === 'formula').map(col => (
                  <div key={`info-formula-${col.key as string}`}>
                    • <strong>{col.header}</strong>: Automated via local rule.
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-150 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0f4c81] hover:bg-[#0c3e6a] text-white rounded-lg text-xs font-semibold transition"
                >
                  Confirm Row Insert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. EDIT ROW MODAL */}
      {isEditOpen && activeRecord && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#0f4c81] text-white rounded">
                  <Edit className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Edit Row • {title}</h3>
              </div>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {columns
                  .filter(col => col.key !== 'actions' && !col.isCalculated)
                  .map(col => {
                    const k = col.key as string;
                    return (
                      <div key={`edit-input-${k}`} className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">{col.header}</label>
                        {col.type === 'select' ? (
                          <select
                            value={String(activeRecord[col.key as keyof T] || '')}
                            onChange={(e) => setActiveRecord(prev => ({ ...prev, [col.key]: e.target.value }))}
                            required
                            className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#0f4c81]"
                          >
                            <option value="">-- Choose Status / Type --</option>
                            {col.selectOptions?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : col.type === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            value={activeRecord[col.key as keyof T] !== undefined ? String(activeRecord[col.key as keyof T]) : ''}
                            onChange={(e) => setActiveRecord(prev => ({ ...prev, [col.key]: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                            placeholder={col.placeholder || 'e.g. 1000'}
                            required
                            className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#0f4c81]"
                          />
                        ) : col.type === 'date' ? (
                          <input
                            type="date"
                            value={String(activeRecord[col.key as keyof T] || '')}
                            onChange={(e) => setActiveRecord(prev => ({ ...prev, [col.key]: e.target.value }))}
                            required
                            className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2 focus:outline-none"
                          />
                        ) : (
                          <SuggestiveInput
                            value={String(activeRecord[col.key as keyof T] || '')}
                            onChange={(val, fillOthers) => {
                              setActiveRecord(prev => {
                                if (!prev) return prev;
                                const next = { ...prev, [col.key]: val };
                                if (fillOthers) {
                                  Object.entries(fillOthers).forEach(([otherKey, otherVal]) => {
                                    next[otherKey as keyof T] = otherVal;
                                  });
                                }
                                return next;
                              });
                            }}
                            placeholder={col.placeholder || `Enter ${col.header}`}
                            suggestions={suggestionsMap ? suggestionsMap[k] : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="pt-4 border-t border-slate-150 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0f4c81] hover:bg-[#0c3e6a] text-white rounded-lg text-xs font-semibold transition animate-fade-in"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
