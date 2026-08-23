import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BoldrProject, PIPELINE_STAGES, BoldrArtifact } from './types';
import { ArrowLeft, Save, Folder, ExternalLink, Activity, Cloud, AlertTriangle, FileText } from "../ui/Icon";

export function BoldrProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const [project, setProject] = useState<BoldrProject | null>(null);
  const [artifacts, setArtifacts] = useState<BoldrArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [googleDriveFolderLink, setGoogleDriveFolderLink] = useState("");
  const [hubspotDealId, setHubspotDealId] = useState("");
  const [handoffScore, setHandoffScore] = useState(0);

  useEffect(() => {
    if (!id || !user || !workspace) return;
    const fetchProject = async () => {
      const pDoc = await getDoc(doc(db, "boldr_projects", id));
      if(pDoc.exists()) {
        const data = { id: pDoc.id, ...pDoc.data() } as BoldrProject;
        setProject(data);
        setGoogleDriveFolderLink(data.googleDriveFolderLink || "");
        setHubspotDealId(data.hubspotDealId || "");
        setHandoffScore(data.handoffScore || 0);
      }
      setIsLoading(false);
    };
    fetchProject();

    const qA = query(collection(db, "boldr_artifacts"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id), where("projectId", "==", id));
    const unsubA = onSnapshot(qA, snap => {
      const data: BoldrArtifact[] = [];
      snap.forEach(d => data.push({id: d.id, ...d.data()} as BoldrArtifact));
      setArtifacts(data);
    });

    return () => unsubA();
  }, [id, user, workspace]);

  const handleSave = async () => {
    if(!id) return;
    try {
      await updateDoc(doc(db, "boldr_projects", id), {
        googleDriveFolderLink,
        hubspotDealId,
        handoffScore,
        updatedAt: serverTimestamp()
      });
      alert('Project saved successfully!');
    } catch(err) {
      console.error(err);
      alert('Failed to save project.');
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!project) return <div className="p-8">Project not found</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs font-bold text-indigo-500 tracking-wider uppercase">{project.companyName}</div>
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="text-sm font-semibold border-gray-200 border rounded-lg p-2 bg-gray-50 outline-none focus:border-black"
            value={project.stage}
            onChange={async (e) => {
              if(window.confirm('Do you want to change the stage and validate gates?')) {
                await updateDoc(doc(db, "boldr_projects", id!), { stage: e.target.value, updatedAt: serverTimestamp() });
                setProject({...project, stage: e.target.value as any});
              }
            }}
          >
            {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleSave} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-800 flex items-center gap-2">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full p-6 grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Cloud className="w-4 h-4" /> Systems Integration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">HubSpot Deal ID</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:border-black outline-none font-medium" 
                  value={hubspotDealId} 
                  onChange={e => setHubspotDealId(e.target.value)} 
                  placeholder="e.g. 12345678"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Google Drive Root Folder</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:border-black outline-none font-medium" 
                  value={googleDriveFolderLink} 
                  onChange={e => setGoogleDriveFolderLink(e.target.value)} 
                  placeholder="https://drive.google.com/drive/folders/..."
                />
                {googleDriveFolderLink && (
                  <a href={googleDriveFolderLink} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 font-bold flex items-center gap-1 mt-2">
                    <ExternalLink className="w-3 h-3" /> Open in Google Drive
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" /> Handoff & Scope
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Handoff Score (0-100)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    className="w-24 border border-gray-300 rounded-lg p-2 text-sm focus:border-black outline-none font-bold text-center" 
                    value={handoffScore} 
                    onChange={e => setHandoffScore(parseInt(e.target.value) || 0)} 
                  />
                  {handoffScore >= 95 ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Passed</span>
                  ) : (
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">Blocked {"(< 95)"}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Artifacts Table */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" /> Artifacts
              </h2>
            </div>
            
            {artifacts.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50">
                <Folder className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-500">No artifacts found</p>
                <p className="text-xs text-gray-400 mt-1">Artifacts mapped from Google Drive will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {artifacts.map(a => (
                  <div key={a.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">{a.type}</span>
                      <span className="text-sm font-bold text-gray-900">{a.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${a.status === 'approved' ? 'bg-green-50 text-green-700' : a.status === 'missing' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {a.status}
                      </span>
                      <a href={a.googleDriveLink || "#"} className="text-gray-400 hover:text-black">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Key Contacts</h3>
             <div className="space-y-3">
               <div>
                 <div className="text-[10px] uppercase font-bold text-gray-400">Executive Sponsor</div>
                 <div className="text-sm font-semibold">{project.executiveSponsor || "-"}</div>
               </div>
               <div>
                 <div className="text-[10px] uppercase font-bold text-gray-400">Process Owner</div>
                 <div className="text-sm font-semibold">{project.clientProcessOwner || "-"}</div>
               </div>
               <div>
                 <div className="text-[10px] uppercase font-bold text-gray-400">Delivery Director</div>
                 <div className="text-sm font-semibold">{project.deliveryOwner || "-"}</div>
               </div>
             </div>
          </div>

          <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
             <h3 className="text-xs font-bold text-red-800 uppercase tracking-widest flex items-center gap-2 mb-2">
               <AlertTriangle className="w-4 h-4"/> Delivery Health
             </h3>
             <div className="text-sm text-red-900 font-medium">
               No active blockers detected.
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
