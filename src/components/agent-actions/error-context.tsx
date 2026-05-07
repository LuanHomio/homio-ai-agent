'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type FieldIssue = { path: (string | number)[]; message: string };

const ErrorContext = createContext<Record<string, string>>({});

export function FormErrorProvider({
  issues,
  children,
}: {
  issues: FieldIssue[] | null;
  children: ReactNode;
}) {
  const errorMap = useMemo(() => {
    const map: Record<string, string> = {};
    issues?.forEach((iss) => {
      const key = iss.path.map((s) => String(s)).join('.');
      if (!(key in map)) map[key] = iss.message;
    });
    return map;
  }, [issues]);
  return <ErrorContext.Provider value={errorMap}>{children}</ErrorContext.Provider>;
}

export function useFieldError(field?: string): string | undefined {
  const map = useContext(ErrorContext);
  if (!field) return undefined;
  return map[field];
}
