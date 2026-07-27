import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  LayoutGrid, 
  FileText, 
  Search, 
  List, 
  Grid, 
  ArrowUpDown, 
  Calendar, 
  Clock 
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

export function GenericModulePage({ 
  title, 
  collectionName,
  entityName = "Item"
}: { 
  title: string, 
  collectionName: string,
  entityName?: string
}) {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View, Sort, Search states
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem(`viewMode_${collectionName}`);
    return (saved === "list" || saved === "grid") ? saved : "grid";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "title" | "status">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!user || !workspace) return;
    const q = query(
      collection(db, collectionName), 
      where("userId", "==", user.uid), 
      where("workspaceId", "==", workspace.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: any[] = [];
      snapshot.forEach((doc) => {
        fetchedItems.push({ id: doc.id, ...doc.data() });
      });
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, collectionName, workspace]);

  const handleCreate = async () => {
    if (!user || !workspace) return;
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: `New ${entityName}`,
        status: "open",
        createdAt: serverTimestamp()
      });
      navigate(`${location.pathname}/${docRef.id}`);
    } catch (e) {
      console.error(e);
      alert(`Failed to create ${entityName}.`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm(`Delete this ${entityName}?`)) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleViewMode = () => {
    const nextMode = viewMode === "grid" ? "list" : "grid";
    setViewMode(nextMode);
    localStorage.setItem(`viewMode_${collectionName}`, nextMode);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === "asc" ? "desc" : "asc");
  };

  // Filter and Sort Items
  const filteredItems = items
    .filter(item => {
      const titleMatch = (item.title || "").toLowerCase().includes(searchQuery.toLowerCase());
      const sourceMatch = (item.source || "").toLowerCase().includes(searchQuery.toLowerCase());
      return titleMatch || sourceMatch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "title") {
        comparison = (a.title || "").localeCompare(b.title || "");
      } else if (sortBy === "status") {
        comparison = (a.status || "").localeCompare(b.status || "");
      } else {
        // Default to createdAt
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        comparison = tA - tB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center h-full">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const backPath = ['System', 'Tool', 'Scheduled', 'Decision', 'Waiting For', 'Presentation'].some(k => title.includes(k)) 
    ? (['System', 'Tool', 'Scheduled'].some(k => title.includes(k)) ? '/settings/boldi' : '/work')
    : '/work';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-4 max-w-5xl mx-auto space-y-6 pb-24"
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-4 mt-4">
        <div className="flex items-center gap-3">
          <Link to={backPath} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex justify-center items-center transition-colors">
             <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{title}</h1>
        </div>
        <button 
          onClick={handleCreate}
          className="px-4 py-2 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>New {entityName}</span>
        </button>
      </header>

      {/* Control Bar: Search, Sort, View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full bg-white text-sm pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>

        {/* Sorting and Views */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Sort Field */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700">
            <span className="text-gray-400 font-normal">Sort:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-gray-800"
            >
              <option value="createdAt">Date Created</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
            </select>
          </div>

          {/* Sort Direction Toggle */}
          <button
            onClick={toggleSortOrder}
            className="p-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl transition-all hover:shadow-sm"
            title={sortOrder === "asc" ? "Ascending" : "Descending"}
          >
            <ArrowUpDown className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${sortOrder === "desc" ? "rotate-180" : ""}`} />
          </button>

          <div className="h-6 w-[1px] bg-gray-200 mx-1" />

          {/* View Toggle */}
          <button
            onClick={toggleViewMode}
            className="p-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl transition-all hover:shadow-sm flex items-center justify-center"
            title={viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
          >
            {viewMode === "grid" ? (
              <List className="w-4 h-4 text-gray-600" />
            ) : (
              <Grid className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Main Grid / List Component */}
      {filteredItems.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
          <LayoutGrid className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-1">No items found</h3>
          <p className="text-gray-400 text-sm">
            {searchQuery ? "No results match your search query." : `Create your first ${entityName.toLowerCase()} to get started.`}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <Link 
              key={item.id} 
              to={`${location.pathname}/${item.id}`}
              className="bg-white rounded-3xl p-5 border border-gray-200 hover:border-black/20 hover:shadow-md transition-all group flex flex-col h-40"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 group-hover:bg-black group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <button 
                  onClick={(e) => handleDelete(e, item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-bold text-gray-900 text-lg line-clamp-1 mb-1">{item.title}</h3>
              {item.source && (
                 <p className="text-xs text-gray-500 line-clamp-1 mb-2">From: {item.source}</p>
              )}
              <div className="mt-auto flex items-center justify-between">
                 <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded inline-block ${item.status === 'done' || item.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                   {item.status || 'Active'}
                 </span>
                 {item.createdAt && (
                   <span className="text-[10px] text-gray-400 flex items-center gap-1">
                     <Clock className="w-3 h-3" />
                     {new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}
                   </span>
                 )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* List View: Similar to Action Board list row */
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          {filteredItems.map(item => (
            <Link 
              key={item.id} 
              to={`${location.pathname}/${item.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm truncate">{item.title}</h4>
                {item.source && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">From: {item.source}</p>
                )}
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {item.createdAt && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1 hidden sm:flex">
                    <Calendar className="w-3.5 h-3.5 text-gray-300" />
                    {new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}
                  </span>
                )}

                <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded inline-block shrink-0 ${item.status === 'done' || item.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {item.status || 'Active'}
                </span>

                <button 
                  onClick={(e) => handleDelete(e, item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
