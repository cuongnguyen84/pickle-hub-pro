import { useState, useEffect, useMemo } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useSearch<T>(
  items: T[],
  searchQuery: string,
  searchFields: (keyof T)[]
): T[] {
  const debouncedQuery = useDebounce(searchQuery.toLowerCase().trim(), 300);

  return useMemo(() => {
    if (!debouncedQuery) return items;

    return items.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        if (typeof value === "string") {
          return value.toLowerCase().includes(debouncedQuery);
        }
        return false;
      })
    );
  }, [items, debouncedQuery, searchFields]);
}
