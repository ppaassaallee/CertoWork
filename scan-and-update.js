import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

async function run() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error("No firebase config found.");
    return;
  }
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!getApps().length) {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  const db = getFirestore(firebaseConfig.firestoreDatabaseId || undefined);
  console.log("Connected to Firestore.");

  const tasksSnapshot = await db.collection("tasks").get();
  console.log(`Total tasks found: ${tasksSnapshot.size}`);
  
  const tasks = [];
  tasksSnapshot.forEach(doc => {
    tasks.push({ id: doc.id, ...doc.data() });
  });

  const usersSnapshot = await db.collection("users").get();
  console.log(`Total users found: ${usersSnapshot.size}`);
  usersSnapshot.forEach(doc => {
    console.log(`User: ${doc.id} -> Email: ${doc.data().email}`);
  });

  const workspacesSnapshot = await db.collection("workspaces").get();
  console.log(`Total workspaces found: ${workspacesSnapshot.size}`);
  workspacesSnapshot.forEach(doc => {
    console.log(`Workspace: ${doc.id} -> Name: ${doc.data().name}, Owner: ${doc.data().ownerId}`);
  });

  // Limit printing tasks to first 10 for analysis
  tasks.slice(0, 10).forEach(t => {
    console.log(`Task [${t.id}]: "${t.title}" | Priority: ${t.priority} | DueDate: ${t.dueDate} | Context: ${t.gtdContext} | Type: ${t.itemType}`);
  });
}

run().catch(console.error);
