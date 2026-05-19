import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiBase,
  apiUrl,
  defaultApiBaseWithoutOverride,
} from "../../lib/api";
import {
  getApiBaseOverride,
  normalizeApiBaseInput,
  setApiBaseOverride,
  testApiBaseConnection,
} from "../../lib/devtools/api-base-override";

export function useDevToolsScreen() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [overrideActive, setOverrideActive] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const o = await getApiBaseOverride();
    setOverrideActive(o);
    setDraft(o ?? defaultApiBaseWithoutOverride());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const buildInfo = [
    `v${appVersion}`,
    Platform.OS,
    __DEV__ ? "dev" : "release",
  ].join(" · ");

  const saveOverride = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      const trimmed = draft.trim();
      if (!trimmed) {
        await setApiBaseOverride(null);
        setMsg("Override removido. A app usa env / padrão.");
      } else {
        await setApiBaseOverride(trimmed);
        setMsg(`API apontada para ${apiBase()}`);
      }
      qc.clear();
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao gravar");
    } finally {
      setSaving(false);
    }
  }, [draft, qc, refresh]);

  const clearOverride = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      await setApiBaseOverride(null);
      setDraft(defaultApiBaseWithoutOverride());
      qc.clear();
      await refresh();
      setMsg("Override limpo.");
    } finally {
      setSaving(false);
    }
  }, [qc, refresh]);

  const testDraft = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testApiBaseConnection(draft);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  }, [draft]);

  const applyPreset = useCallback((preset: string) => {
    setDraft(normalizeApiBaseInput(preset));
    setTestResult(null);
  }, []);

  return {
    draft,
    setDraft,
    overrideActive,
    effectiveBase: apiBase(),
    sampleApiUrl: apiUrl("/seller/me"),
    buildInfo,
    testing,
    testResult,
    saving,
    msg,
    saveOverride,
    clearOverride,
    testDraft,
    applyPreset,
    presets: {
      localhost: Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000",
      lanHint: "http://192.168.0.10:4000",
    },
  };
}
