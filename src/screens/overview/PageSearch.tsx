import React, { useState, useMemo, useRef } from 'react';
import { Search, X, ChevronRight, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { PAGE_SEARCH_INDEX, type SearchIndexItem, type SearchItemKind } from './pageSearchIndex.ts';

export type SearchFilterType = 'all' | 'page' | 'setting';

// Persistent search state preserved across navigation and page visits
let persistentSearchQuery = '';
let persistentSearchFilter: SearchFilterType = 'all';

export interface PageSearchProps {
  isAdmin?: boolean;
  isAgro?: boolean;
}

export const PageSearch: React.FC<PageSearchProps> = ({ isAdmin = false, isAgro = true }) => {
  const { navigate } = useNavigation();
  const [query, setQueryState] = useState(persistentSearchQuery);
  const [filter, setFilterState] = useState<SearchFilterType>(persistentSearchFilter);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setQuery = (q: string) => {
    persistentSearchQuery = q;
    setQueryState(q);
  };

  const setFilter = (f: SearchFilterType) => {
    persistentSearchFilter = f;
    setFilterState(f);
  };

  // Available items filtered by permissions and business type
  const availableItems = useMemo(() => {
    return PAGE_SEARCH_INDEX.filter((item) => {
      if (item.requiresAdmin && !isAdmin) return false;
      if (item.requiresAgro && !isAgro) return false;
      if (item.generalOnly && isAgro) return false;
      return true;
    });
  }, [isAdmin, isAgro]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const pageCount = availableItems.filter((i) => i.kind === 'page').length;
    const settingCount = availableItems.filter((i) => i.kind === 'setting').length;
    return {
      all: availableItems.length,
      page: pageCount,
      setting: settingCount,
    };
  }, [availableItems]);

  // Filtered & Ranked Results
  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    return availableItems.filter((item) => {
      // 1. Kind filter
      if (filter !== 'all' && item.kind !== filter) {
        return false;
      }

      // 2. Query filter
      if (!trimmed) {
        // If no query, return true only when filter is not 'all' or when focused/browsing
        return false;
      }

      const titleMatch = item.title.toLowerCase().includes(trimmed);
      const subtitleMatch = item.subtitle.toLowerCase().includes(trimmed);
      const categoryMatch = item.category.toLowerCase().includes(trimmed);
      const keywordMatch = item.keywords.some((k) => k.toLowerCase().includes(trimmed));

      return titleMatch || subtitleMatch || categoryMatch || keywordMatch;
    }).sort((a, b) => {
      if (!trimmed) return 0;
      // Exact title match priority
      const aTitleExact = a.title.toLowerCase() === trimmed;
      const bTitleExact = b.title.toLowerCase() === trimmed;
      if (aTitleExact && !bTitleExact) return -1;
      if (!aTitleExact && bTitleExact) return 1;

      // Title starts with priority
      const aTitleStarts = a.title.toLowerCase().startsWith(trimmed);
      const bTitleStarts = b.title.toLowerCase().startsWith(trimmed);
      if (aTitleStarts && !bTitleStarts) return -1;
      if (!aTitleStarts && bTitleStarts) return 1;

      // Title contains priority
      const aTitleContains = a.title.toLowerCase().includes(trimmed);
      const bTitleContains = b.title.toLowerCase().includes(trimmed);
      if (aTitleContains && !bTitleContains) return -1;
      if (!aTitleContains && bTitleContains) return 1;

      return a.title.localeCompare(b.title);
    });
  }, [availableItems, query, filter]);

  const handleSelect = (item: SearchIndexItem) => {
    navigate(item.routeId, item.params);
  };

  const handleClear = () => {
    persistentSearchQuery = '';
    setQueryState('');
    inputRef.current?.focus();
  };

  const hasQuery = query.trim().length > 0;

  return (
    <section className="bg-white border border-[#E8DFCE] rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5 transition-all">
      {/* Search Header / Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
            <Search className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Quick Page &amp; Settings Search
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Jump instantly to any operational ledger, report, or configuration
            </p>
          </div>
        </div>

        {hasQuery && (
          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
            {results.length} found
          </span>
        )}
      </div>

      {/* Search Bar Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={
            isAgro
              ? 'Search pages, tools, livestock, stock, biometrics, roles...'
              : 'Search pages, tools, expenses, pool, assets, biometrics, roles...'
          }
          className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0D7C6] text-xs font-bold text-slate-950 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-2xs"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs: All (Default) | Pages | Settings */}
      <div className="flex items-center gap-2 pt-0.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider shrink-0">
          <SlidersHorizontal className="w-3 h-3" />
          Filter:
        </span>

        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1.5 ${filter === 'all'
            ? 'bg-slate-900 text-white shadow-2xs'
            : 'bg-[#FAF8F5] hover:bg-[#F0EBE1] text-slate-700 border border-[#E0D7C6]'
            }`}
        >
          <span>All</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${filter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('page')}
          className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1.5 ${filter === 'page'
            ? 'bg-emerald-700 text-white shadow-2xs'
            : 'bg-[#FAF8F5] hover:bg-[#F0EBE1] text-slate-700 border border-[#E0D7C6]'
            }`}
        >
          <span>Pages</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${filter === 'page' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {counts.page}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('setting')}
          className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1.5 ${filter === 'setting'
            ? 'bg-indigo-700 text-white shadow-2xs'
            : 'bg-[#FAF8F5] hover:bg-[#F0EBE1] text-slate-700 border border-[#E0D7C6]'
            }`}
        >
          <span>Settings</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${filter === 'setting' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {counts.setting}
          </span>
        </button>
      </div>

      {/* Results View */}
      {hasQuery && (
        <div className="space-y-2 pt-1 border-t border-[#F0EBE1] animate-fade-in">
          {results.length > 0 ? (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {results.map((item) => {
                const IconComponent = item.icon;
                const isPage = item.kind === 'page';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="p-3 rounded-2xl bg-[#FAF8F5] hover:bg-white border border-[#E8DFCE] hover:border-emerald-500 hover:shadow-xs flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg}`}>
                        <IconComponent className={`w-4 h-4 ${item.iconColor}`} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-950 group-hover:text-emerald-800 transition-colors">
                            {item.title}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border tracking-wide whitespace-nowrap ${isPage
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                              }`}
                          >
                            {isPage ? 'Page' : 'Setting'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            · {item.category}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all shrink-0">
                      <span className="text-[10px] font-bold hidden sm:inline">Open</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center space-y-2 rounded-2xl bg-[#FAF8F5] border border-dashed border-[#E0D7C6]">
              <p className="text-xs font-bold text-slate-700">
                No {filter === 'all' ? 'pages or settings' : filter === 'page' ? 'pages' : 'settings'} match &ldquo;{query}&rdquo;
              </p>
              <p className="text-[11px] text-slate-500">
                Try searching for <button type="button" onClick={() => setQuery('fingerprint')} className="text-emerald-700 font-bold underline cursor-pointer">fingerprint</button>, <button type="button" onClick={() => setQuery('expenses')} className="text-emerald-700 font-bold underline cursor-pointer">expenses</button>, {isAgro ? (
                  <>
                    <button type="button" onClick={() => setQuery('stock')} className="text-emerald-700 font-bold underline cursor-pointer">stock</button>, or{' '}
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setQuery('assets')} className="text-emerald-700 font-bold underline cursor-pointer">assets</button>, or{' '}
                  </>
                )}<button type="button" onClick={() => setQuery('roles')} className="text-emerald-700 font-bold underline cursor-pointer">roles</button>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Suggested Quick Shortcuts (when not actively searching) */}
      {!hasQuery && (
        <div className="pt-1 border-t border-[#F0EBE1] flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-medium">
          <span className="text-slate-400 font-bold text-[10px] uppercase">Popular:</span>
          {[
            { label: 'Fingerprint Biometrics', q: 'fingerprint' },
            { label: 'Capital Pool', q: 'capital pool' },
            { label: 'Expenses Feed', q: 'expenses' },
            { label: 'Team Roles', q: 'roles' },
            { label: 'Runway Plan', q: 'runway' },
          ].map((s) => (
            <button
              key={s.q}
              type="button"
              onClick={() => {
                setQuery(s.q);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-slate-700 font-bold text-[10px] cursor-pointer transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

