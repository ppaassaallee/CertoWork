import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface KnowledgeContextRequest {
  workspaceId: string;
  userId: string;
  useCase: 'project_builder' | 'meeting_processor' | 'presentation_builder' | 'weekly_review' | 'system_review' | 'skill_runner' | 'playbook_runner';
  projectId?: string;
  queryText?: string;
  tags?: string[];
}

export async function getRelevantKnowledge(request: KnowledgeContextRequest) {
  try {
    const q = query(
      collection(db, "knowledge_items"),
      where("workspaceId", "==", request.workspaceId),
      where("userId", "==", request.userId),
      where("status", "==", "active"),
      where("aiReadable", "==", true)
    );

    const snapshot = await getDocs(q);
    const results: any[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Basic filtering: check usage scope
      if (data.aiUsageScope && data.aiUsageScope !== 'all' && data.aiUsageScope !== request.useCase) {
        return; // Skip if it's restricted to another use case
      }
      // If we had embeddings, we would vector search here. 
      // For now we do poor-man's keyword match locally or just return all accessible items
      // Let's filter by simple tags or title match if queryText is provided:
      if (request.queryText) {
         const qt = request.queryText.toLowerCase();
         const match = (data.title || "").toLowerCase().includes(qt) 
           || (data.summary || "").toLowerCase().includes(qt)
           || (data.tags || []).some((t: string) => t.toLowerCase().includes(qt));
         if (!match) return; // skip if it doesn't match at all
      }
      
      results.push({ id: doc.id, ...data });
    });

    return results;
  } catch (error) {
    console.error("Error fetching relevant knowledge:", error);
    return [];
  }
}

export async function logKnowledgeUsage(
  workspaceId: string, 
  userId: string, 
  knowledgeItemId: string, 
  usedByType: string, 
  usedById: string, 
  reason: string
) {
  try {
    await addDoc(collection(db, "knowledge_usage_logs"), {
      workspaceId,
      userId,
      knowledgeItemId,
      usedByType,
      usedById,
      reason,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging knowledge usage:", error);
  }
}
