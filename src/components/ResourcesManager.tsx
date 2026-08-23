import { useState, useEffect } from "react";
import { File, Plus, X, Loader2, Trash2, ExternalLink, Download } from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";

export function ResourcesManager() {
  const { user, workspace } = useAuth();
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create resource states
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"link" | "file">("link");
  const [url, setUrl] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [fileExtension, setFileExtension] = useState(".pdf");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !workspace) return;

    const q = query(
      collection(db, "resources"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const arr: any[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      // Sort by creation date
      arr.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setResources(arr);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user || !workspace || submitting) return;
    
    setSubmitting(true);
    try {
      const finalUrl = type === "link" ? url.trim() : `https://firebasestorage.googleapis.com/v0/b/gazelle/o/${encodeURIComponent(title.trim())}${fileExtension}?alt=media`;
      
      await addDoc(collection(db, "resources"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: title.trim(),
        type,
        url: finalUrl,
        fileSize: type === "file" ? (fileSize ? `${fileSize} KB` : "420 KB") : null,
        fileType: type === "file" ? fileExtension.replace(".", "").toUpperCase() : null,
        createdAt: serverTimestamp()
      });

      // Reset
      setTitle("");
      setUrl("");
      setFileSize("");
      setShowAdd(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;
    try {
      await deleteDoc(doc(db, "resources", id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        <span>Loading resources vault...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      <header className="flex justify-between items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Resources & Reference Vault</h2>
          <p className="text-sm text-gray-500 mt-1">
            Store documents, external links, reference PDFs, client media briefs, and quick reference files.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          Add Resource
        </button>
      </header>

      {showAdd && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 p-5 rounded-3xl shadow-sm space-y-4 max-w-xl">
          <h3 className="font-extrabold text-sm text-gray-900">Add Vault Item</h3>
          
          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-xl border border-gray-150">
            <button
              type="button"
              onClick={() => setType("link")}
              className={`py-2 rounded-lg text-xs font-black transition-all ${
                type === "link" ? "bg-white shadow text-black" : "text-gray-500"
              }`}
            >
              Web Link / URL
            </button>
            <button
              type="button"
              onClick={() => setType("file")}
              className={`py-2 rounded-lg text-xs font-black transition-all ${
                type === "file" ? "bg-white shadow text-black" : "text-gray-500"
              }`}
            >
              Document / File Record
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Title / Display Name</label>
            <input
              type="text"
              value={title}
              required
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Marketing Brief or competitor_analysis_spec"
              className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 font-medium"
            />
          </div>

          {type === "link" ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Web Address (URL)</label>
              <input
                type="url"
                value={url}
                required={type === "link"}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/docs/123"
                className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 font-medium"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">File Format</label>
                <select
                  value={fileExtension}
                  onChange={(e) => setFileExtension(e.target.value)}
                  className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 font-bold text-gray-700"
                >
                  <option value=".pdf">PDF Document</option>
                  <option value=".xlsx">Excel Spreadsheet (.xlsx)</option>
                  <option value=".docx">Word Document (.docx)</option>
                  <option value=".zip">Compressed Archive (.zip)</option>
                  <option value=".png">Image Asset (.png)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">File Size (KB)</label>
                <input
                  type="number"
                  value={fileSize}
                  onChange={(e) => setFileSize(e.target.value)}
                  placeholder="e.g. 1048"
                  className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 font-medium"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl font-bold text-xs text-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Resource"}
            </button>
          </div>
        </form>
      )}

      {resources.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-3xl p-12 text-center bg-white">
          <File className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-sm text-gray-800">Resource Vault is Empty</h3>
          <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
            Log external spreadsheets, assets, and files here to keep all relevant workspace documentation unified.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((res) => (
            <div
              key={res.id}
              className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                    res.type === "link" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {res.type === "link" ? "External Link" : `${res.fileType || "File"} Record`}
                  </span>
                  <button
                    onClick={() => handleDelete(res.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                    title="Delete Resource"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="font-bold text-gray-900 mt-3 line-clamp-1" title={res.title}>{res.title}</h3>
                {res.fileSize && (
                  <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">Size: {res.fileSize}</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-5">
                <span className="text-[10px] text-gray-400 font-bold">
                  {res.createdAt ? new Date(res.createdAt.seconds * 1000).toLocaleDateString() : ""}
                </span>
                <a
                  href={res.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-wide hover:underline"
                >
                  {res.type === "link" ? (
                    <>
                      Open Link <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Download File <Download className="w-3.5 h-3.5" />
                    </>
                  )}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
