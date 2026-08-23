import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Search, Plus, Check, Loader2, X, Zap, Folder, Tag, User } from "./ui/Icon";
import { motion, AnimatePresence } from "motion/react";

export function normalizeEntityName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[.,\/#!$%\^&\*;:{}=\-_`~()]+|[.,\/#!$%\^&\*;:{}=\-_`~()]+$/g, "");
}

export interface Entity {
  id: string;
  name: string;
  title?: string;
  projectType?: "project" | "deal";
  normalizedName?: string;
  color?: string;
  group?: string;
}

export interface EntityPickerProps {
  entityType: "project" | "deal" | "project_deal" | "stakeholder" | "tag";
  selectedIds: string | string[]; // Single string or string array
  onSelect: (ids: string | string[]) => void;
  onSave?: (ids: string | string[]) => Promise<void>;
  allowMultiple?: boolean;
  workspaceId: string;
  userId: string;
  triggerClassName?: string;
  placeholder?: string;
  showIcon?: boolean;
  customTrigger?: React.ReactNode;
}

export function EntityPicker({
  entityType,
  selectedIds,
  onSelect,
  onSave,
  allowMultiple = false,
  workspaceId,
  userId,
  triggerClassName = "",
  placeholder = "",
  showIcon = true,
  customTrigger,
}: EntityPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Entity[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [creationLoading, setCreationLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert selectedIds to a unified array
  const activeIds = Array.isArray(selectedIds)
    ? selectedIds.filter(Boolean)
    : selectedIds
    ? [selectedIds]
    : [];

  const collectionName =
    entityType === "project" || entityType === "deal" || entityType === "project_deal"
      ? "projects"
      : entityType === "tag"
      ? "categories"
      : "stakeholders";

  // Fetch items from the real Firestore database
  const fetchItems = async () => {
    if (!workspaceId || !userId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, collectionName),
        where("userId", "==", userId),
        where("workspaceId", "==", workspaceId)
      );
      const snapshot = await getDocs(q);
      const fetched: Entity[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const nameVal = data.name || data.title || "";
        fetched.push({
          id: docSnap.id,
          name: nameVal,
          title: data.title,
          projectType: data.projectType,
          normalizedName: data.normalizedName || normalizeEntityName(nameVal),
          color: data.color,
          group: data.group,
        });
      });

      // Filter by type if project/deal
      let finalItems = fetched;
      if (entityType === "project") {
        finalItems = fetched.filter(
          (p) => p.projectType === "project" || !p.projectType
        );
      } else if (entityType === "deal") {
        finalItems = fetched.filter((p) => p.projectType === "deal");
      }

      setItems(finalItems);
    } catch (err: any) {
      console.error("Error fetching " + entityType + ":", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      setSearchQuery("");
      setErrorMsg(null);
      setSuccessMsg(null);
      setActiveIndex(-1);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, workspaceId, userId, entityType]);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectToggle = async (id: string) => {
    let newSelected: string | string[];
    if (allowMultiple) {
      if (activeIds.includes(id)) {
        newSelected = activeIds.filter((x) => x !== id);
      } else {
        newSelected = [...activeIds, id];
      }
    } else {
      newSelected = id;
    }

    onSelect(newSelected);
    if (onSave) {
      try {
        await onSave(newSelected);
      } catch (err: any) {
        setErrorMsg("Failed to attach to task.");
        return;
      }
    }
    if (!allowMultiple) {
      setIsOpen(false);
    }
  };

  const handleCreateNew = async () => {
    // Falls back to creating standard project
    await handleCreateNewWithType(entityType === "deal" ? "deal" : "project");
  };

  const handleCreateNewWithType = async (forcedType: "project" | "deal" | "tag" | "stakeholder") => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setCreationLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const norm = normalizeEntityName(trimmed);

    try {
      // 1. DUPLICATE PREVENTION CHECK (using query OR local lists)
      const existingDuplicate = items.find(
        (it) =>
          normalizeEntityName(it.name) === norm ||
          (it.normalizedName && it.normalizedName === norm)
      );

      if (existingDuplicate) {
        setSuccessMsg("Existing " + (existingDuplicate.projectType || entityType) + " linked.");
        await new Promise((r) => setTimeout(r, 800));
        await handleSelectToggle(existingDuplicate.id);
        setIsOpen(false);
        return;
      }

      // Check Firestore strictly
      const q = query(
        collection(db, collectionName),
        where("userId", "==", userId),
        where("workspaceId", "==", workspaceId)
      );
      const snapshot = await getDocs(q);
      let duplicateDocId: string | null = null;
      snapshot.forEach((d) => {
        const dData = d.data();
        const dName = dData.name || dData.title || "";
        const dNormalized = dData.normalizedName || normalizeEntityName(dName);
        if (dNormalized === norm) {
          if (collectionName === "projects") {
            const dpType = dData.projectType || "project";
            if (dpType === forcedType) {
              duplicateDocId = d.id;
            }
          } else {
            duplicateDocId = d.id;
          }
        }
      });

      if (duplicateDocId) {
        setSuccessMsg("Existing " + forcedType + " linked.");
        await new Promise((r) => setTimeout(r, 800));
        await handleSelectToggle(duplicateDocId);
        setIsOpen(false);
        return;
      }

      // 2. CREATE ENTITY
      const payload: any = {
        userId,
        workspaceId,
        createdAt: serverTimestamp(),
      };

      if (collectionName === "projects") {
        payload.title = trimmed;
        payload.name = trimmed; // support both
        payload.projectType = forcedType;
        payload.status = "open";
        payload.createdBy = userId;
        payload.updatedAt = serverTimestamp();
        payload.normalizedName = norm;
      } else if (entityType === "tag") {
        payload.name = trimmed;
        payload.color = "indigo"; // fallback default tag color
        payload.group = "Others";
      } else if (entityType === "stakeholder") {
        payload.name = trimmed;
        payload.updatedAt = serverTimestamp();
      }

      const docRef = await addDoc(collection(db, collectionName), payload);

      setSuccessMsg("Created successfully!");
      await new Promise((r) => setTimeout(r, 600));

      // 3. ATTACH
      await handleSelectToggle(docRef.id);
      if (!allowMultiple) {
        setIsOpen(false);
      } else {
        // Refresh list
        fetchItems();
        setSearchQuery("");
      }
    } catch (err: any) {
      console.error("Failed to create inline " + forcedType, err);
      setErrorMsg("Failed to create " + forcedType + ".");
    } finally {
      setCreationLoading(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredItems.length) {
        handleSelectToggle(filteredItems[activeIndex].id);
      } else if (searchQuery.trim()) {
        if (entityType === "project_deal") {
          await handleCreateNewWithType("project");
        } else {
          handleCreateNew();
        }
      }
    }
  };

  // Label resolving
  const getSelectedLabel = () => {
    if (activeIds.length === 0) {
      return placeholder || `Select ${entityType === "project_deal" ? "Proj/Deal" : entityType}`;
    }
    if (activeIds.length === 1) {
      const match = items.find((it) => it.id === activeIds[0]);
      if (match) return match.name;
      return `Link (${activeIds[0].slice(0, 4)}...)`;
    }
    return `${activeIds.length} ${entityType === "project_deal" ? "Items" : entityType + "s"}`;
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {customTrigger ? (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="cursor-pointer"
        >
          {customTrigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg select-none transition-all cursor-pointer ${
            activeIds.length > 0
              ? entityType === "project" || entityType === "deal" || entityType === "project_deal"
                ? "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100/60"
                : entityType === "tag"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100/60"
                : "bg-teal-50 text-teal-600 border border-teal-100 hover:bg-teal-100/60"
              : "bg-gray-50 hover:bg-gray-100 text-gray-500 border border-gray-100"
          } ${triggerClassName}`}
        >
          {showIcon && (
            <>
              {(entityType === "project" || entityType === "project_deal") && (
                (() => {
                  if (entityType === "project_deal" && activeIds.length === 1) {
                    const selItem = items.find(it => it.id === activeIds[0]);
                    if (selItem?.projectType === "deal") {
                      return <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
                    }
                  }
                  return <Folder className="w-3.5 h-3.5 shrink-0" />;
                })()
              )}
              {entityType === "deal" && <Zap className="w-3.5 h-3.5 shrink-0" />}
              {entityType === "tag" && <Tag className="w-3.5 h-3.5 shrink-0" />}
              {entityType === "stakeholder" && (
                <User className="w-3.5 h-3.5 shrink-0" />
              )}
            </>
          )}
          <span className="font-bold uppercase tracking-wider text-[10px] truncate max-w-[120px]">
            {getSelectedLabel()}
          </span>
          <span className="text-[9px] opacity-60">▼</span>
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-[1001] left-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex flex-col gap-1.5 focus:outline-none ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between pb-1 px-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {entityType === "project"
                  ? "Select / Create Project"
                  : entityType === "deal"
                  ? "Select / Create Deal"
                  : entityType === "tag"
                  ? "Select / Create Tag"
                  : "Select / Create Stakeholder"}
              </p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Search or type to create...`}
                className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 focus:border-indigo-200 rounded-xl focus:outline-none text-gray-950 placeholder-gray-400"
              />
            </div>

            {/* Success & Error State */}
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-semibold p-2 rounded-xl text-center">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-[11px] font-semibold p-2 rounded-xl text-center">
                {errorMsg}
              </div>
            )}

            {/* Inline Quick Creation Banner */}
            {searchQuery.trim() &&
              !creationLoading &&
              !items.some(
                (it) =>
                  normalizeEntityName(it.name) ===
                  normalizeEntityName(searchQuery)
              ) && (
                entityType === "project_deal" ? (
                  <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl flex flex-col gap-1.5">
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center">Create "{searchQuery.trim()}" as:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCreateNewWithType("project")}
                        className="flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-700 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        Project
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateNewWithType("deal")}
                        className="flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-700 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold transition-all"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Deal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="flex items-center justify-center gap-1.5 w-full bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 py-2 border border-slate-200 hover:border-indigo-100 rounded-xl text-xs font-bold transition-all"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    Create "{searchQuery.trim()}"
                  </button>
                )
              )}

            {creationLoading && (
              <div className="flex items-center justify-center py-2 text-indigo-600 gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Persisting Entity...
                </span>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar mt-1 pr-0.5">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-gray-400 gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Loading {entityType === "project_deal" ? "items" : entityType + "s"}...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400 italic">
                  No {entityType === "project_deal" ? "items" : entityType + "s"} match.
                </div>
              ) : entityType === "tag" ? (
                (() => {
                  const groups: { [key: string]: Entity[] } = {};
                  filteredItems.forEach(item => {
                    const grp = item.group || "Others";
                    if (!groups[grp]) groups[grp] = [];
                    groups[grp].push(item);
                  });

                  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
                    const order = ["area of life", "work", "personal", "others"];
                    const idxA = order.indexOf(a.toLowerCase());
                    const idxB = order.indexOf(b.toLowerCase());
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return a.localeCompare(b);
                  });

                  return sortedGroupNames.map(groupName => (
                    <div key={groupName} className="mb-3.5 last:mb-0">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2 py-0.5 bg-gray-50 rounded mb-1">
                        {groupName}
                      </div>
                      <div className="space-y-0.5">
                        {groups[groupName].map((item) => {
                          const isChecked = activeIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectToggle(item.id)}
                              className={`flex items-center justify-between px-2 py-1.5 rounded-xl cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-slate-50 text-slate-900 font-bold"
                                  : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Tag className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="text-xs truncate">{item.name}</span>
                              </div>
                              {isChecked && (
                                <Check className="w-4 h-4 text-slate-800 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()
              ) : (
                filteredItems.map((item, index) => {
                  const isChecked = activeIds.includes(item.id);
                  const isHighlighted = activeIndex === index;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectToggle(item.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${
                        isChecked
                          ? "bg-slate-50 text-slate-900 font-bold"
                          : isHighlighted
                          ? "bg-indigo-50/50 text-indigo-700"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {(entityType === "project" || (entityType === "project_deal" && (item.projectType === "project" || !item.projectType))) && (
                          <Folder className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        )}
                        {(entityType === "deal" || (entityType === "project_deal" && item.projectType === "deal")) && (
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        {entityType === "stakeholder" && (
                          <User className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        )}
                        <span className="text-xs truncate">{item.name}</span>
                        {entityType === "project_deal" && (
                          <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wider shrink-0 ${item.projectType === 'deal' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-650'}`}>
                            {item.projectType === 'deal' ? 'Deal' : 'Project'}
                          </span>
                        )}
                      </div>
                      {isChecked && (
                        <Check className="w-4 h-4 text-slate-800 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Clear option if single select & something is selected */}
            {!allowMultiple && activeIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onSelect("");
                  if (onSave) onSave("");
                  setIsOpen(false);
                }}
                className="mt-1 pt-1.5 border-t border-gray-100 text-left text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center justify-center gap-1 w-full"
              >
                Clear Selected
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
