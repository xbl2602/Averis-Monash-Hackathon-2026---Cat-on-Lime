"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type SearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * 顶栏搜索框和主内容区的功能卡片之间共享的搜索关键词——纯前端过滤，
 * 不发请求，所以不需要走 /lib/llm 或 Supabase。
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch 必须在 SearchProvider 内部使用");
  return ctx;
}
