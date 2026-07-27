import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Link as LinkIcon, Network, Loader2, ArrowRight, Activity, Sparkles, BookOpen, Cpu, Clipboard, FileText } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";

interface Connection {
  id: string;
  fromType: string;
  fromId: string;
  fromTitle: string;
  toType: string;
  toId: string;
  toTitle: string;
  relationType: string;
  createdAt: any;
  fromPath: string;
  toPath: string;
}

export function WorkspaceConnectionGraph() {
  const { user, workspace } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Analytics
  const [hubs, setHubs] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !workspace) return;

    const q = query(
      collection(db, "entity_links"),
      where("workspaceId", "==", workspace.id)
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const rawLinks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mergedList: Connection[] = [];
      const counts: Record<string, { title: string; count: number; type: string; path: string }> = {};

      const resolveEntityInfo = (type: string, id: string) => {
        let path = "#";
        if (type === "task") {
          path = `/work/action-board/${id}`;
        } else if (type === "project") {
          path = `/work/projects/${id}`;
        } else if (type === "someday") {
          path = `/capture/ideas`;
        } else if (type === "knowledge_item" || type === "knowledge") {
          path = `/work/documents/${id}`;
        } else if (type === "skills" || type === "skill") {
          path = `/work/skills/${id}`;
        } else if (type === "playbooks" || type === "playbook") {
          path = `/work/playbooks/${id}`;
        } else if (type === "review_candidates" || type === "review_candidate") {
          path = `/capture/review`;
        }
        return path;
      };

      const promises = rawLinks.map(async (lnk: any) => {
        let fromTitle = "Loading...";
        let toTitle = "Loading...";

        try {
          // Resolve from entity title
          let fromCol = lnk.fromEntityType;
          if (fromCol === "knowledge") fromCol = "knowledge_items";
          if (fromCol === "skill") fromCol = "skills";
          if (fromCol === "playbook") fromCol = "playbooks";
          if (fromCol === "review_candidate") fromCol = "review_candidates";

          const fromSnap = await getDocs(query(
            collection(db, fromCol),
            where("workspaceId", "==", workspace.id)
          ));
          const fDoc = fromSnap.docs.find(d => d.id === lnk.fromEntityId);
          if (fDoc) {
            const data = fDoc.data();
            fromTitle = data.title || data.name || "Untitled";
          } else {
            fromTitle = `Deleted ${lnk.fromEntityType}`;
          }
        } catch (e) {
          fromTitle = "Deleted Entity";
        }

        try {
          // Resolve to entity title
          let toCol = lnk.toEntityType;
          if (toCol === "knowledge") toCol = "knowledge_items";
          if (toCol === "skill") toCol = "skills";
          if (toCol === "playbook") toCol = "playbooks";
          if (toCol === "review_candidate") toCol = "review_candidates";

          const toSnap = await getDocs(query(
            collection(db, toCol),
            where("workspaceId", "==", workspace.id)
          ));
          const tDoc = toSnap.docs.find(d => d.id === lnk.toEntityId);
          if (tDoc) {
            const data = tDoc.data();
            toTitle = data.title || data.name || "Untitled";
          } else {
            toTitle = `Deleted ${lnk.toEntityType}`;
          }
        } catch (e) {
          toTitle = "Deleted Entity";
        }

        const fromPath = resolveEntityInfo(lnk.fromEntityType, lnk.fromEntityId);
        const toPath = resolveEntityInfo(lnk.toEntityType, lnk.toEntityId);

        // Track hub analytics
        const fKey = `${lnk.fromEntityType}_${lnk.fromEntityId}`;
        const tKey = `${lnk.toEntityType}_${lnk.toEntityId}`;

        if (!counts[fKey]) counts[fKey] = { title: fromTitle, count: 0, type: lnk.fromEntityType, path: fromPath };
        counts[fKey].count += 1;

        if (!counts[tKey]) counts[tKey] = { title: toTitle, count: 0, type: lnk.toEntityType, path: toPath };
        counts[tKey].count += 1;

        mergedList.push({
          id: lnk.id,
          fromType: lnk.fromEntityType,
          fromId: lnk.fromEntityId,
          fromTitle,
          toType: lnk.toEntityType,
          toId: lnk.toEntityId,
          toTitle,
          relationType: lnk.relationType,
          createdAt: lnk.createdAt,
          fromPath,
          toPath
        });
      });

      await Promise.all(promises);

      // Extract top hubs
      const sortedHubs = Object.values(counts)
        .filter((h: any) => h.title && !h.title.startsWith("Deleted"))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 6);

      setHubs(sortedHubs);
      setConnections(mergedList);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, workspace]);

  const getIconForType = (type: string) => {
    const t = type.toLowerCase();
    if (t === "task") return Activity;
    if (t === "project") return Network;
    if (t === "knowledge" || t === "knowledge_item") return BookOpen;
    if (t === "skill" || t === "skills") return Cpu;
    if (t === "playbook" || t === "playbooks") return Clipboard;
    return FileText;
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        <span>Synthesizing second brain neural connections...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Linked Connection Graph</h2>
        <p className="text-sm text-gray-500 mt-1">
          Explore and navigate the bidirectional link grid. Bidirectional relations unify knowledge base docs, tasks, and playbooks.
        </p>
      </header>

      {/* Hubs Summary (Bento Grid) */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5 uppercase tracking-wide">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" /> Neural Brain Hubs (Highly Connected Items)
        </h3>

        {hubs.length === 0 ? (
          <div className="border border-gray-150 p-6 rounded-3xl text-center bg-gray-50/50">
            <p className="text-xs text-gray-400 italic">Hub density will generate once you connect system entities.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {hubs.map((hub: any, idx: number) => {
              const Icon = getIconForType(hub.type);
              return (
                <Link
                  key={idx}
                  to={hub.path}
                  className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm hover:border-indigo-300 hover:shadow transition-all flex flex-col justify-between h-28"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                      {hub.count} links
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-gray-900 line-clamp-2 mt-2 leading-tight" title={hub.title}>{hub.title}</h4>
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block mt-1">{hub.type}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid Connection Board */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
          <LinkIcon className="w-4 h-4 text-gray-400" /> Complete Workspace Link Registry
        </h3>

        {connections.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-3xl p-12 text-center bg-white">
            <Network className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-sm text-gray-800">Connection Map is Pristine</h3>
            <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
              Use the connection widgets on Task Detail pages or within Triage cards to link items dynamically.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-gray-700">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase font-black text-[9px] tracking-widest">
                  <tr>
                    <th className="p-4">Origin Item</th>
                    <th className="p-4 text-center">Connection Pathway</th>
                    <th className="p-4">Destination Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {connections.map((c) => {
                    const FromIcon = getIconForType(c.fromType);
                    const ToIcon = getIconForType(c.toType);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <Link to={c.fromPath} className="flex items-center gap-2 group">
                            <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-100 group-hover:bg-indigo-50 transition-colors shrink-0">
                              <FromIcon className="w-4 h-4 text-gray-500 group-hover:text-indigo-600" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-extrabold text-gray-900 group-hover:text-indigo-600 group-hover:underline truncate max-w-[200px]">{c.fromTitle}</span>
                              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{c.fromType}</span>
                            </div>
                          </Link>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full uppercase tracking-wide flex items-center justify-center gap-1.5 max-w-[150px] mx-auto shadow-sm">
                            {c.relationType} <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </td>
                        <td className="p-4">
                          <Link to={c.toPath} className="flex items-center gap-2 group">
                            <div className="p-1.5 bg-gray-50 rounded-lg border border-gray-100 group-hover:bg-indigo-50 transition-colors shrink-0">
                              <ToIcon className="w-4 h-4 text-gray-500 group-hover:text-indigo-600" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-extrabold text-gray-900 group-hover:text-indigo-600 group-hover:underline truncate max-w-[200px]">{c.toTitle}</span>
                              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{c.toType}</span>
                            </div>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
