export async function triageInputWithAI(content: string) {
  const res = await fetch("/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(errorDetails.error || "Triage failed");
  }
  return res.json();
}

export async function generateProjectDraft(prompt: string, skills: any[]) {
  const res = await fetch("/api/generateProject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, skills }),
  });
  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(errorDetails.error || "Project generation failed");
  }
  return res.json();
}

export async function performAITask(prompt: string, context: string) {
  const res = await fetch("/api/performTask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, context }),
  });
  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(errorDetails.error || "AI task performance failed");
  }
  const data = await res.json();
  return data.text;
}

export async function autoOrganizeTasks(tasks: any[], categories: any[], gtdStages: any[]) {
  const res = await fetch("/api/autoOrganize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks, categories, gtdStages }),
  });
  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(errorDetails.error || "Auto-organization failed");
  }
  return res.json();
}

export async function transcribeCaptureWithAI(audioBase64: string, mimeType: string) {
  const res = await fetch("/api/transcribe-capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(errorDetails.error || "Transcription failed");
  }
  return res.json();
}
