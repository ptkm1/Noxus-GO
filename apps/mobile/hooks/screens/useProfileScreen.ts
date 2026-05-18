import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

export type SellerMe = {
  id: string;
  email: string;
  name: string;
  sellerId: string | null;
  commissionPercent: number | null;
};

export function useProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["seller", "me"],
    queryFn: () => apiFetch<SellerMe>("/seller/me"),
  });

  const [name, setName] = useState("");
  useEffect(() => {
    if (me) setName(me.name);
  }, [me]);

  const patch = useMutation({
    mutationFn: () => apiFetch("/seller/me", { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["seller", "me"] }),
  });

  return {
    me,
    name,
    setName,
    saveName: () => patch.mutate(),
    goSettings: () => router.push("/settings"),
  };
}
