import { useEffect, useState } from "react";
import { doc, getDoc, addDoc, collection, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { TABLE_FORMS, type TableFormDoc } from "../lib/tables/tableForms";
import { TABLE_RECORDS } from "../lib/tables/types";
import { CertoMark } from "./CertoMark";
import { Loader2, Send } from "./ui/Icon";

/** Public form → creates a table record (no sign-in). */
export function PublicTableForm({ token }: { token: string }) {
  const [form, setForm] = useState<TableFormDoc | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getDoc(doc(db, TABLE_FORMS, token)).then((snap) => {
      if (cancelled) return;
      if (!snap.exists()) {
        setError("This form link is invalid.");
        return;
      }
      const data = snap.data() as Omit<TableFormDoc, "id">;
      if (!data.active || data.token !== token) {
        setError("This form is no longer active.");
        return;
      }
      setForm({ id: snap.id, ...data });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    if (!form?.snapshot) return;
    setBusy(true);
    setError("");
    try {
      const titleCol = form.snapshot.titleColumnId;
      const recordValues: Record<string, string | number | boolean | null> = {};
      for (const column of form.snapshot.columns) {
        const raw = values[column.id];
        if (raw == null || raw === "") continue;
        if (column.type === "number" || column.type === "currency" || column.type === "rating" || column.type === "progress") {
          recordValues[column.id] = Number(raw);
        } else if (column.type === "checkbox") {
          recordValues[column.id] = raw === "true" || raw === "on";
        } else {
          recordValues[column.id] = raw;
        }
      }
      if (!recordValues[titleCol]) {
        recordValues[titleCol] = "Form submission";
      }
      await addDoc(collection(db, TABLE_RECORDS), {
        tableId: form.tableId,
        workspaceId: form.workspaceId,
        values: recordValues,
        order: Date.now(),
        createdBy: "form",
        userId: "form",
        formToken: token,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: "form",
        linkCount: 0,
      });
      await updateDoc(doc(db, TABLE_FORMS, token), {
        submissionCount: increment(1),
        updatedAt: new Date().toISOString(),
        lastSubmissionAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "tables", form.tableId), {
        recordCount: increment(1),
        updatedAt: new Date().toISOString(),
      });
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit the form.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !form) {
    return (
      <div className="cw-public-form">
        <CertoMark />
        <p>{error}</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="cw-public-form">
        <Loader2 className="spin" size={18} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="cw-public-form" data-testid="public-table-form-done">
        <CertoMark />
        <h1>Thanks</h1>
        <p>Your response was saved to {form.snapshot.tableName}.</p>
      </div>
    );
  }

  return (
    <div className="cw-public-form" data-testid="public-table-form">
      <CertoMark />
      <h1>{form.title}</h1>
      {form.description ? <p>{form.description}</p> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {form.snapshot.columns.map((column) => (
          <label key={column.id}>
            <span>
              {column.name}
              {column.required ? " *" : ""}
            </span>
            {column.type === "status" || column.type === "dropdown" ? (
              <select
                required={column.required}
                value={values[column.id] || ""}
                onChange={(e) =>
                  setValues((current) => ({ ...current, [column.id]: e.target.value }))
                }
              >
                <option value="">Select…</option>
                {(column.options || []).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : column.type === "longtext" ? (
              <textarea
                required={column.required}
                value={values[column.id] || ""}
                onChange={(e) =>
                  setValues((current) => ({ ...current, [column.id]: e.target.value }))
                }
              />
            ) : (
              <input
                required={column.required}
                type={
                  column.type === "email"
                    ? "email"
                    : column.type === "number" || column.type === "currency" || column.type === "rating" || column.type === "progress"
                      ? "number"
                      : column.type === "date"
                        ? "date"
                        : "text"
                }
                value={values[column.id] || ""}
                onChange={(e) =>
                  setValues((current) => ({ ...current, [column.id]: e.target.value }))
                }
              />
            )}
          </label>
        ))}
        {error ? <p className="cw-public-form-error">{error}</p> : null}
        <button type="submit" disabled={busy}>
          <Send size={14} /> Submit
        </button>
      </form>
    </div>
  );
}
