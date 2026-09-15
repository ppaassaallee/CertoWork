import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, Send } from "../../components/ui/Icon";
import { useAuth } from "../../lib/AuthContext";
import { t } from "../../lib/i18n";
import type { RecordValue, TableDoc } from "../../lib/tables";
import {
  createTableForm,
  listTableForms,
  publicTableFormPath,
  submitTableFormAsUser,
  type TableFormDoc,
} from "../../lib/tables";
import { CellRenderer, type TableMember } from "./cells/RecordCells";

export function TableFormView({
  table,
  members,
}: {
  table: TableDoc;
  members: TableMember[];
}) {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, RecordValue>>({});
  const [forms, setForms] = useState<TableFormDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const fields = useMemo(
    () => table.columns.filter((col) => !col.hidden),
    [table.columns],
  );

  const refresh = async () => {
    setForms(await listTableForms(table.id));
  };

  useEffect(() => {
    void refresh();
  }, [table.id]);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = { ...values };
      if (!payload[table.keyColumns.title]) {
        payload[table.keyColumns.title] = t("tables.untitled");
      }
      await submitTableFormAsUser({
        table,
        values: payload,
        actorId: user.uid,
      });
      setValues({});
      setNotice(t("tables.form.submitted"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tables.form.submitFailed"));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const form = await createTableForm({ table, userId: user.uid });
      await refresh();
      const url = `${window.location.origin}${publicTableFormPath(form.token)}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* ignore */
      }
      setNotice(t("tables.form.published").replace("{url}", url));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("tables.form.publishFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cw-tables-form-view" data-testid="tables-form-view">
      <header className="cw-tables-form-head">
        <div>
          <h2>{t("tables.form.title")}</h2>
          <p className="cw-tables-muted">{t("tables.form.summary")}</p>
        </div>
        <button
          type="button"
          className="cw-tables-btn"
          data-testid="tables-form-publish"
          disabled={busy || !user}
          onClick={() => void publish()}
        >
          <Link2 size={14} /> {t("tables.form.publish")}
        </button>
      </header>

      <form
        className="cw-tables-form-body"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {fields.map((column) => (
          <label key={column.id} className="cw-tables-form-field">
            <span>
              {column.name}
              {column.required || column.id === table.keyColumns.title ? " *" : ""}
            </span>
            <CellRenderer
              column={column}
              value={values[column.id] ?? null}
              members={members}
              onChange={(next) => setValues((current) => ({ ...current, [column.id]: next }))}
            />
          </label>
        ))}
        <button type="submit" className="cw-tables-btn" disabled={busy || !user}>
          <Send size={14} /> {t("tables.form.submit")}
        </button>
      </form>

      {notice ? <p className="cw-tables-form-notice">{notice}</p> : null}
      {error ? <p className="cw-tables-create-error">{error}</p> : null}

      {forms.length ? (
        <section className="cw-tables-form-links">
          <h3>{t("tables.form.publishedForms")}</h3>
          <ul>
            {forms.map((form) => (
              <li key={form.id}>
                <a href={publicTableFormPath(form.token)} target="_blank" rel="noreferrer">
                  {form.title}
                </a>
                <small>
                  {form.active ? t("tables.form.active") : t("tables.form.inactive")} ·{" "}
                  {form.submissionCount || 0}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="cw-tables-muted">
          <Plus size={12} /> {t("tables.form.emptyPublish")}
        </p>
      )}
    </div>
  );
}
