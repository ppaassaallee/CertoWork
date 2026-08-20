import { useState } from "react";
import { Loader2, WandSparkles } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

export type RewriteFieldKind =
  | "objective_title"
  | "objective_description"
  | "measure_title"
  | "work_item_title"
  | "work_item_description"
  | "project_outcome"
  | "project_description";

export function AiRewriteButton({
  text,
  fieldKind,
  context,
  onRewrite,
  label = "Improve with Certo AI",
}: {
  text: string;
  fieldKind: RewriteFieldKind;
  context?: Record<string, unknown>;
  onRewrite: (text: string) => void | Promise<void>;
  label?: string;
}) {
  const { user, workspace } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const rewrite = async () => {
    const source = String(text || "").trim();
    if (!source || !user || !workspace || working) return;
    setWorking(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/certo/rewrite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          workspaceId: workspace.id,
          fieldKind,
          text: source,
          context: context || {},
        }),
      });
      const result = await response.json();
      if (!response.ok || !String(result?.text || "").trim()) {
        throw new Error(result?.error || "Certo AI could not improve this text.");
      }
      await onRewrite(String(result.text).trim());
    } catch (rewriteError) {
      setError(
        rewriteError instanceof Error
          ? rewriteError.message
          : "Certo AI could not improve this text.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <span className="do-ai-rewrite-wrap">
      <button
        aria-label={label}
        className="do-ai-rewrite do-icon-button"
        disabled={!String(text || "").trim() || working}
        onClick={rewrite}
        title={label}
        type="button"
      >
        {working ? <Loader2 className="spin" size={12} /> : <WandSparkles size={12} />}
      </button>
      {error && <small className="do-ai-rewrite-error" role="status">{error}</small>}
    </span>
  );
}
