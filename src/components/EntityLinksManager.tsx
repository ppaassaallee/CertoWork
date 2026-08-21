import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Link as LinkIcon, Plus, X, Loader2, ArrowRight } from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, limit } from "firebase/firestore";

interface EntityLinksManagerProps {
  entityType: string; // "task" | "project" | "someday" | "knowledge_item" | "skills" | "playbooks" | "review_candidates"
  entityId: string;
}

interface EntityLink {
  id: string;
  workspaceId: string;
  fromEntityType: string;
  fromEntityId: string;
  toEntityType: string;
  toEntityId: string;
  relationType: string;
  createdAt: any;
  // Resolved info for display
  resolvedTitle?: string;
  resolvedPath?: string;
}

export function EntityLinksManager({ entityType, entityId }: EntityLinksManagerProps) {
  const { user, workspace } = useAuth();
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Link creation state
  const [isAdding, setIsAdding] = useState(false);
  const [targetType, setTargetType] = useState<string>("task");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [relationType, setRelationType] = useState("related");

  useEffect(() => {
    if (!user || !workspace || !entityId) return;

    // We query both incoming and outgoing links
    const qOutgoing = query(
      collection(db, "entity_links"),
      where("workspaceId", "==", workspace.id),
      where("fromEntityType", "==", entityType),
      where("fromEntityId", "==", entityId)
    );

    const qIncoming = query(
      collection(db, "entity_links"),
      where("workspaceId", "==", workspace.id),
      where("toEntityType", "==", entityType),
      where("toEntityId", "==", entityId)
    );

    let outgoingList: any[] = [];
    let incomingList: any[] = [];

    const handleUpdate = async (outItems: any[], inItems: any[]) => {
      const merged: EntityLink[] = [];
      const seen = new Set<string>();

      // Combined links
      const rawLinks = [...outItems, ...inItems];
      for (const item of rawLinks) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);

        // Determine remote entity
        const isFrom = item.fromEntityType === entityType && item.fromEntityId === entityId;
        const remoteType = isFrom ? item.toEntityType : item.fromEntityType;
        const remoteId = isFrom ? item.toEntityId : item.fromEntityId;

        // Fetch the details of the remote entity for displaying its title
        let title = "Loading...";
        let path = "#";

        if (remoteType === "task") {
          path = `/work/action-board/${remoteId}`;
        } else if (remoteType === "project") {
          path = `/work/projects/${remoteId}`;
        } else if (remoteType === "someday") {
          path = `/capture/ideas`; // Ideas list view
        } else if (remoteType === "knowledge_item" || remoteType === "knowledge") {
          path = `/work/documents/${remoteId}`;
        } else if (remoteType === "skills" || remoteType === "skill") {
          path = `/work/skills/${remoteId}`;
        } else if (remoteType === "playbooks" || remoteType === "playbook") {
          path = `/work/playbooks/${remoteId}`;
        } else if (remoteType === "review_candidates" || remoteType === "review_candidate") {
          path = `/capture/review`;
        }

        merged.push({
          ...item,
          remoteType,
          remoteId,
          resolvedTitle: title,
          resolvedPath: path
        });
      }

      // Fetch titles dynamically
      const promises = merged.map(async (lnk: any) => {
        try {
          let collectionName = lnk.remoteType;
          if (collectionName === "knowledge") collectionName = "knowledge_items";
          if (collectionName === "skill") collectionName = "skills";
          if (collectionName === "playbook") collectionName = "playbooks";
          if (collectionName === "review_candidate") collectionName = "review_candidates";

          const docSnap = await getDocs(query(
            collection(db, collectionName),
            where("workspaceId", "==", workspace.id)
          ));
          const targetDoc = docSnap.docs.find(d => d.id === lnk.remoteId);
          if (targetDoc) {
            const data = targetDoc.data();
            lnk.resolvedTitle = data.title || data.name || "Untitled";
          } else {
            lnk.resolvedTitle = `Deleted ${lnk.remoteType}`;
          }
        } catch (e) {
          lnk.resolvedTitle = "Unknown Entity";
        }
        return lnk;
      });

      const resolved = await Promise.all(promises);
      setLinks(resolved);
      setLoading(false);
    };

    const unsubOut = onSnapshot(qOutgoing, (snap) => {
      outgoingList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      handleUpdate(outgoingList, incomingList);
    });

    const unsubIn = onSnapshot(qIncoming, (snap) => {
      incomingList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      handleUpdate(outgoingList, incomingList);
    });

    return () => {
      unsubOut();
      unsubIn();
    };
  }, [user, workspace, entityType, entityId]);

  // Execute a quick search for potential link targets
  const handleSearch = async () => {
    if (!workspace) return;
    setSearching(true);
    try {
      let collectionName = targetType;
      if (targetType === "knowledge") collectionName = "knowledge_items";
      if (targetType === "skill") collectionName = "skills";
      if (targetType === "playbook") collectionName = "playbooks";
      if (targetType === "review_candidate") collectionName = "review_candidates";

      const q = query(
        collection(db, collectionName),
        where("workspaceId", "==", workspace.id),
        limit(20)
      );
      const snap = await getDocs(q);
      const results: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        const titleText = data.title || data.name || "";
        if (!searchQuery || titleText.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({
            id: d.id,
            title: titleText,
            ...data
          });
        }
      });
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (isAdding) {
      handleSearch();
    }
  }, [isAdding, targetType, searchQuery]);

  const handleCreateLink = async (targetId: string) => {
    if (!user || !workspace || !entityId) return;
    try {
      await addDoc(collection(db, "entity_links"), {
        workspaceId: workspace.id,
        fromEntityType: entityType,
        fromEntityId: entityId,
        toEntityType: targetType,
        toEntityId: targetId,
        relationType,
        createdBy: user.uid,
        createdAt: new Date()
      });
      setIsAdding(false);
      setSearchQuery("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteDoc(doc(db, "entity_links", linkId));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-1.5 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading connection graph...</div>;
  }

  return (
    <div className="space-y-4 border border-gray-100 bg-gray-50/50 p-4 rounded-2xl text-left">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5 text-gray-400" /> Linked Second Brain Graph ({links.length})
        </h4>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 hover:bg-gray-200 text-gray-500 hover:text-black rounded-lg transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
        >
          {isAdding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />} Connect Item
        </button>
      </div>

      {isAdding && (
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Target Type</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 rounded-lg border border-gray-200 font-semibold text-gray-700 focus:outline-none"
              >
                <option value="task">Tasks</option>
                <option value="project">Projects & Deals</option>
                <option value="someday">Ideas / Someday</option>
                <option value="knowledge">Knowledge Docs</option>
                <option value="skill">AI Skills</option>
                <option value="playbook">Playbooks</option>
                <option value="review_candidate">Review Items</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Relation Type</label>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 rounded-lg border border-gray-200 font-semibold text-gray-700 focus:outline-none"
              >
                <option value="related">Related to</option>
                <option value="supports">Supports</option>
                <option value="references">References</option>
                <option value="depends_on">Depends on</option>
                <option value="blocks">Blocks</option>
                <option value="generated_from">Generated from</option>
              </select>
            </div>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${targetType} titles...`}
            className="w-full text-xs p-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 font-medium"
          />

          <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {searching ? (
              <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">No items found</div>
            ) : (
              searchResults.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleCreateLink(item.id)}
                  className="w-full text-left p-2 hover:bg-gray-50 text-xs font-semibold text-gray-700 flex justify-between items-center transition-colors"
                >
                  <span className="truncate max-w-[200px]">{item.title}</span>
                  <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-wide">
                    Connect <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">No connections in graph yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {links.map((lnk: any) => (
            <div
              key={lnk.id}
              className="group bg-white border border-gray-200 hover:border-indigo-200 text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest">{lnk.relationType} ({lnk.remoteType})</span>
                <Link
                  to={lnk.resolvedPath}
                  className="font-bold text-gray-800 hover:text-indigo-600 hover:underline max-w-[160px] truncate"
                >
                  {lnk.resolvedTitle}
                </Link>
              </div>
              <button
                onClick={() => handleDeleteLink(lnk.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 transition-all ml-1"
                title="Remove Link"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
