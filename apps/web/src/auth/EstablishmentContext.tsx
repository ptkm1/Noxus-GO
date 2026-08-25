import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "pedix.activeEstablishmentId";

export type EstablishmentListItem = {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  isPrimary: boolean;
  active: boolean;
  uf: string | null;
  nfeSeries: number;
  nfeLastNumber: number;
};

type EstablishmentsResponse = {
  items: EstablishmentListItem[];
  preferredEstablishmentId: string | null;
};

type EstablishmentContextValue = {
  establishments: EstablishmentListItem[];
  activeEstablishmentId: string | null;
  activeEstablishment: EstablishmentListItem | null;
  setActiveEstablishmentId: (id: string) => void;
  loading: boolean;
};

const EstablishmentContext = createContext<EstablishmentContextValue | null>(
  null,
);

function readLocalActive(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLocalActive(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function EstablishmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["admin", "establishments", user?.organizationId],
    queryFn: () =>
      apiFetch<EstablishmentsResponse>("/admin/establishments"),
    enabled: Boolean(user?.organizationId),
    staleTime: 60_000,
  });

  const preferMut = useMutation({
    mutationFn: (establishmentId: string) =>
      apiFetch<{ ok: boolean; preferredEstablishmentId: string }>(
        "/admin/establishments/preferred",
        {
          method: "PUT",
          body: JSON.stringify({ establishmentId }),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "establishments"] });
      void qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  const items = useMemo(
    () => (listQ.data?.items ?? []).filter((e) => e.active),
    [listQ.data?.items],
  );

  const activeEstablishmentId = useMemo(() => {
    if (!items.length) return null;
    const preferred =
      listQ.data?.preferredEstablishmentId ||
      user?.preferredEstablishmentId ||
      readLocalActive();
    if (preferred && items.some((e) => e.id === preferred)) return preferred;
    const primary = items.find((e) => e.isPrimary);
    return primary?.id ?? items[0]?.id ?? null;
  }, [
    items,
    listQ.data?.preferredEstablishmentId,
    user?.preferredEstablishmentId,
  ]);

  const activeEstablishment =
    items.find((e) => e.id === activeEstablishmentId) ?? null;

  const setActiveEstablishmentId = useCallback(
    (id: string) => {
      writeLocalActive(id);
      preferMut.mutate(id);
      void qc.invalidateQueries({ queryKey: ["admin", "establishments"] });
    },
    [preferMut, qc],
  );

  const value: EstablishmentContextValue = {
    establishments: items,
    activeEstablishmentId,
    activeEstablishment,
    setActiveEstablishmentId,
    loading: listQ.isLoading,
  };

  return (
    <EstablishmentContext.Provider value={value}>
      {children}
    </EstablishmentContext.Provider>
  );
}

export function useActiveEstablishment() {
  const ctx = useContext(EstablishmentContext);
  if (!ctx) {
    throw new Error(
      "useActiveEstablishment deve ser usado dentro de EstablishmentProvider",
    );
  }
  return ctx;
}

/** Formata CNPJ para exibição curta no header. */
export function formatCnpjShort(cnpj: string | null | undefined): string {
  const d = (cnpj ?? "").replace(/\D/g, "");
  if (d.length !== 14) return cnpj?.trim() || "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
