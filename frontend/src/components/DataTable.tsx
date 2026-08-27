import { useMemo, useState } from 'react'
import { Search, AlertTriangle, CheckCircle2 } from 'lucide-react'

export interface ColumnDef { key: string; label: string; mono?: boolean; wrap?: boolean }

export function DataTable({
  rows, columns, emptyMessage,
}: { rows: Record<string, any>[]; columns: ColumnDef[]; emptyMessage: string }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)

  const filtered = useMemo(() => {
    let out = rows
    if (query) {
      const q = query.toLowerCase()
      out = out.filter(r => columns.some(c => (r[c.key] ?? '').toString().toLowerCase().includes(q)))
    }
    if (sort) {
      out = [...out].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key]
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir
        return av.toString().localeCompare(bv.toString()) * sort.dir
      })
    }
    return out
  }, [rows, columns, query, sort])

  function toggleSort(key: string) {
    setSort(cur => (cur?.key === key ? { key, dir: (cur.dir * -1) as 1 | -1 } : { key, dir: 1 }))
  }

  if (!rows.length) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-hairline py-14 text-center text-sm text-ink-faint">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search this table…"
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-indigo focus:outline-none"
          />
        </div>
        <span className="text-[11px] text-ink-faint">{filtered.length} of {rows.length} shown</span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-hairline bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className="cursor-pointer select-none whitespace-nowrap border-b border-hairline bg-panel-raised px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-muted hover:text-ink"
                >
                  {c.label}
                  {sort?.key === c.key && <span className="ml-1 opacity-60">{sort.dir === 1 ? '▲' : '▼'}</span>}
                </th>
              ))}
              <th className="whitespace-nowrap border-b border-hairline bg-panel-raised px-3.5 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-muted">
                Data quality
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id || i} className="border-b border-hairline-soft transition-colors last:border-b-0 hover:bg-panel-raised">
                {columns.map(c => (
                  <td key={c.key} className={`whitespace-nowrap px-3.5 py-2.5 text-ink ${c.mono ? 'font-mono text-[11.5px]' : ''} ${c.wrap ? 'max-w-[260px] overflow-hidden text-ellipsis whitespace-normal' : ''}`}>
                    {r[c.key] != null && r[c.key] !== '' ? r[c.key] : <span className="text-ink-faint">—</span>}
                  </td>
                ))}
                <td className="px-3.5 py-2.5">
                  {(r.missing_fields || []).length ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-bold text-amber">
                      <AlertTriangle size={10} /> {r.missing_fields.length} missing
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-bold text-teal">
                      <CheckCircle2 size={10} /> complete
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
