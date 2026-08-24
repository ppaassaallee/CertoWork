export type JudgmentSeverity = "info" | "warning" | "blocking";

export interface JudgmentTask {
  id?: string;
  title?: string;
  status?: string;
  priority?: string | number | null;
  dueDate?: string | null;
  postponedCount?: number;
  projectId?: string | null;
  description?: string;
  blockedBy?: string[];
  dependencyIds?: string[];
}

export interface JudgmentProject {
  id?: string;
  title?: string;
  name?: string;
  status?: string;
  outcome?: string | null;
  objective?: string | null;
}

export interface JudgmentEvent {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
}

export interface JudgmentContext {
  tasks?: JudgmentTask[];
  projects?: JudgmentProject[];
  events?: JudgmentEvent[];
  goals?: Array<{ id?: string; title?: string; type?: string }>;
  dailyCapacityMinutes?: number;
  scope?: "chief_of_staff" | "project_delivery" | "personal_home";
  activeProjectId?: string | null;
}

export interface JudgmentSignal {
  id: string;
  severity: JudgmentSeverity;
  title: string;
  detail: string;
  evidence?: string[];
}

export interface JudgmentAssessment {
  verdict: "clear" | "challenge" | "stop";
  recommendation: string;
  signals: JudgmentSignal[];
  capacity: {
    openTasks: number;
    dueToday: number;
    activeProjects: number;
    repeatedPostponements: number;
    estimatedLoadMinutes: number;
    availableMinutes: number;
    dueThisWeek: number;
    estimatedWeeklyLoadMinutes: number;
    weeklyAvailableMinutes: number;
  };
  dimensions: {
    strategicAlignment: "aligned" | "unclear" | "misaligned";
    capacity: "healthy" | "tight" | "overloaded";
    opportunityCost: "low" | "medium" | "high";
    risk: "low" | "medium" | "high";
    sustainability: "sustainable" | "strained" | "unsustainable";
    reversibility: "easy" | "moderate" | "hard";
  };
  userWantsToHear: string;
  userNeedsToHear: string;
  alternatives: string[];
  conditions: string[];
}

const ACTIVE_STATUSES = new Set(["open", "todo", "in_progress", "active", "next"]);
const PROJECT_ACTIVE_STATUSES = new Set(["active", "in_progress", "planning", "open"]);

function normalize(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateOnly(value: string | undefined | null) {
  if (!value) return null;
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || null;
}

function mentionsCommitment(text: string) {
  return /\b(add|schedule|plan|commit|launch|start|create|build|meet|book|deadline|due|today|tomorrow|this week|project)\b/i.test(text);
}

function asksForProject(text: string) {
  return /\b(project|launch|initiative|build|roll out|implement)\b/i.test(text);
}

function startsNewProject(text: string) {
  return (
    asksForProject(text) &&
    /\b(add|begin|build|create|implement|kick off|launch|new|roll out|start)\b/i.test(text)
  );
}

function containsConcreteOutcome(text: string) {
  return /\b(by \w+|so that|in order to|result|outcome|metric|increase|reduce|ship|publish|deliver|complete|revenue|users?|customers?)\b/i.test(text);
}

function looksVague(text: string) {
  return (
    /\b(i should|i need to|i want to|work on|figure out|improve|exercise more|write more|sometime|eventually)\b/i.test(text) &&
    !/\b(\d{1,2}(:\d{2})?\s?(am|pm)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|\d{4}-\d{2}-\d{2}|for \d+ (minutes?|hours?))\b/i.test(text)
  );
}

export function evaluateJudgment(
  requestText: string,
  context: JudgmentContext = {},
  now = new Date(),
): JudgmentAssessment {
  const tasks = (context.tasks || []).filter((task) => {
    const status = normalize(task.status);
    return !status || ACTIVE_STATUSES.has(status);
  });
  const projects = (context.projects || []).filter((project) => {
    const status = normalize(project.status);
    return !status || PROJECT_ACTIVE_STATUSES.has(status);
  });
  const today = now.toISOString().slice(0, 10);
  const weekEndDate = new Date(now);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);
  const dueToday = tasks.filter((task) => dateOnly(task.dueDate) === today);
  const dueThisWeek = tasks.filter((task) => {
    const dueDate = dateOnly(task.dueDate);
    return !!dueDate && dueDate >= today && dueDate <= weekEnd;
  });
  const repeated = tasks.filter((task) => (task.postponedCount || 0) >= 3);
  const blocked = tasks.filter(
    (task) => (task.blockedBy?.length || 0) > 0 || (task.dependencyIds?.length || 0) > 0,
  );
  const unclearTasks = tasks.filter((task) => {
    const title = normalize(task.title);
    return (
      title.split(" ").length < 2 ||
      /\b(work on|figure out|follow up|handle|sort out|improve|project)\b/i.test(title)
    );
  });
  const availableMinutes = context.dailyCapacityMinutes ?? 360;
  const weeklyAvailableMinutes = availableMinutes * 5;
  const estimatedLoadMinutes = dueToday.length * 45;
  const estimatedWeeklyLoadMinutes = dueThisWeek.length * 45;
  const signals: JudgmentSignal[] = [];
  const request = normalize(requestText);
  const projectDelivery = context.scope === "project_delivery";

  if (!projectDelivery && mentionsCommitment(requestText) && dueToday.length >= 6) {
    signals.push({
      id: "daily-capacity",
      severity: dueToday.length >= 9 ? "blocking" : "warning",
      title: "Today is already at capacity",
      detail: `${dueToday.length} open items are due today before this commitment is added.`,
      evidence: dueToday.slice(0, 3).map((task) => task.title || "Untitled task"),
    });
  }

  if (!projectDelivery && mentionsCommitment(requestText) && estimatedWeeklyLoadMinutes > weeklyAvailableMinutes * 0.8) {
    signals.push({
      id: "weekly-capacity",
      severity: estimatedWeeklyLoadMinutes > weeklyAvailableMinutes ? "blocking" : "warning",
      title: "The week has little credible capacity left",
      detail: `${dueThisWeek.length} items are due in the next seven days, before this request is added.`,
      evidence: dueThisWeek.slice(0, 3).map((task) => task.title || "Untitled task"),
    });
  }

  if (!projectDelivery && startsNewProject(requestText) && projects.length > 3) {
    signals.push({
      id: "wip-overload",
      severity: projects.length > 5 ? "blocking" : "warning",
      title: "A quick portfolio check may help",
      detail: `${projects.length} projects are already active. Before starting another, consider whether one can finish or pause.`,
      evidence: projects.slice(0, 3).map((project) => project.title || project.name || "Untitled project"),
    });
  }

  const duplicate = tasks.find((task) => {
    const title = normalize(task.title);
    return title.length > 8 && (request.includes(title) || title.includes(request));
  });
  if (duplicate) {
    signals.push({
      id: "duplicate-work",
      severity: projectDelivery ? "info" : "warning",
      title: "This may already exist",
      detail: `“${duplicate.title}” looks materially similar to this request.`,
      evidence: duplicate.id ? [duplicate.id] : undefined,
    });
  }

  if (looksVague(requestText)) {
    signals.push({
      id: "vague-action",
      severity: projectDelivery ? "info" : "warning",
      title: "The next action is not concrete yet",
      detail: "A verb, finish condition, and realistic time window are needed before this can be planned.",
    });
  }

  if (asksForProject(requestText) && !containsConcreteOutcome(requestText)) {
    signals.push({
      id: "missing-outcome",
      severity: projectDelivery ? "info" : "warning",
      title: "Project outcome is missing",
      detail: "Define what will be observably different when this project is complete.",
    });
  }

  const pastDate = requestText.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (pastDate && pastDate < today) {
    signals.push({
      id: "impossible-date",
      severity: "blocking",
      title: "The requested date has already passed",
      detail: `${pastDate} is before today. Choose a future date or record it as completed history.`,
    });
  }

  let requestedDate = pastDate || null;
  if (!requestedDate && /\btomorrow\b/i.test(requestText)) {
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    requestedDate = tomorrow.toISOString().slice(0, 10);
  } else if (!requestedDate && /\btoday\b/i.test(requestText)) {
    requestedDate = today;
  }
  if (requestedDate && /\b(schedule|meet|meeting|book|lunch|call|visit|appointment)\b/i.test(requestText)) {
    const sameDayEvents = (context.events || []).filter(
      (event) => dateOnly(event.start) === requestedDate,
    );
    const travelEvent = sameDayEvents.find((event) =>
      /\b(travel|flight|airport|site visit|client visit|road trip|transit)\b/i.test(event.title || ""),
    );
    if (travelEvent) {
      signals.push({
        id: "travel-conflict",
        severity: "blocking",
        title: "Real travel context conflicts with this request",
        detail: `“${travelEvent.title || "Travel"}” is already recorded for ${requestedDate}. Protect travel and transition time before adding another commitment.`,
        evidence: travelEvent.id ? [travelEvent.id] : undefined,
      });
    } else if (sameDayEvents.length >= 3) {
      signals.push({
        id: "calendar-conflict",
        severity: "warning",
        title: "The requested day is meeting-heavy",
        detail: `${sameDayEvents.length} calendar commitments already exist on ${requestedDate}. Check an exact free window before confirming.`,
        evidence: sameDayEvents.slice(0, 3).map((event) => event.title || "Calendar event"),
      });
    }
  }

  if (!projectDelivery && repeated.length > 0 && mentionsCommitment(requestText)) {
    signals.push({
      id: "repeated-postponement",
      severity: "warning",
      title: "Existing work is being deferred repeatedly",
      detail: `${repeated.length} item${repeated.length === 1 ? " has" : "s have"} been postponed at least three times.`,
      evidence: repeated.slice(0, 3).map((task) => task.title || "Untitled task"),
    });
  }

  if (!projectDelivery && blocked.length > 0 && mentionsCommitment(requestText)) {
    signals.push({
      id: "missing-dependencies",
      severity: "warning",
      title: "Existing work is waiting on dependencies",
      detail: `${blocked.length} active item${blocked.length === 1 ? " is" : "s are"} blocked. Resolve or explicitly accept those dependencies before adding parallel work.`,
      evidence: blocked.slice(0, 3).map((task) => task.title || "Untitled task"),
    });
  }

  if (!projectDelivery && unclearTasks.length >= 3 && mentionsCommitment(requestText)) {
    signals.push({
      id: "unclear-existing-tasks",
      severity: "info",
      title: "Several existing tasks are not actionable",
      detail: `${unclearTasks.length} open tasks lack a sufficiently concrete action definition.`,
      evidence: unclearTasks.slice(0, 3).map((task) => task.title || "Untitled task"),
    });
  }

  const undirectedProjects = projects.filter((project) => !project.outcome && !project.objective);
  if (undirectedProjects.length > 0 && asksForProject(requestText)) {
    signals.push({
      id: "projects-without-outcomes",
      severity: "info",
      title: "Active projects need sharper outcomes",
      detail: `${undirectedProjects.length} current project${undirectedProjects.length === 1 ? " has" : "s have"} no recorded outcome.`,
      evidence: undirectedProjects.slice(0, 3).map((project) => project.title || project.name || "Untitled project"),
    });
  }

  const hasBlocking = signals.some((signal) => signal.severity === "blocking");
  const hasWarnings = signals.some((signal) => signal.severity === "warning");
  const overloaded = !projectDelivery && (
    estimatedLoadMinutes > availableMinutes ||
    estimatedWeeklyLoadMinutes > weeklyAvailableMinutes ||
    dueToday.length >= 9);
  const tight = !projectDelivery && (
    estimatedLoadMinutes > availableMinutes * 0.7 ||
    estimatedWeeklyLoadMinutes > weeklyAvailableMinutes * 0.8 ||
    dueToday.length >= 6);
  const verdict = hasBlocking ? "stop" : hasWarnings ? "challenge" : "clear";

  return {
    verdict,
    recommendation:
      projectDelivery && verdict !== "stop"
        ? "Continue with a useful project draft now. Record assumptions and turn missing inputs into guided follow-ups."
        : verdict === "stop"
        ? "Do not add this as written. Resolve the blocking condition or choose a safer alternative."
        : verdict === "challenge"
          ? "Clarify the outcome and make room before committing. You can still override after reviewing the trade-off."
          : "No deterministic blocker was found. Continue with a reversible, reviewable next step.",
    signals,
    capacity: {
      openTasks: tasks.length,
      dueToday: dueToday.length,
      activeProjects: projects.length,
      repeatedPostponements: repeated.length,
      estimatedLoadMinutes,
      availableMinutes,
      dueThisWeek: dueThisWeek.length,
      estimatedWeeklyLoadMinutes,
      weeklyAvailableMinutes,
    },
    dimensions: {
      strategicAlignment: context.goals?.length ? "aligned" : "unclear",
      capacity: overloaded ? "overloaded" : tight ? "tight" : "healthy",
      opportunityCost: projectDelivery ? "low" : projects.length > 5 ? "high" : projects.length > 3 ? "medium" : "low",
      risk: hasBlocking ? "high" : hasWarnings ? "medium" : "low",
      sustainability: overloaded ? "unsustainable" : tight ? "strained" : "sustainable",
      reversibility: /\b(send|email|publish|delete|pay|purchase|invite)\b/i.test(requestText)
        ? "hard"
        : /\b(schedule|create|add|update|reschedule)\b/i.test(requestText)
          ? "moderate"
          : "easy",
    },
    userWantsToHear: "There is room to add this and move immediately.",
    userNeedsToHear:
      projectDelivery
        ? "Use the available project evidence, make assumptions explicit, and keep delivery moving."
        : verdict === "clear"
        ? "A small, reversible first step is more credible than a broad commitment."
        : "Adding work without removing or clarifying something else will make the plan less believable.",
    alternatives:
      projectDelivery
        ? ["Draft the next delivery slice with explicit assumptions", "Ask one focused question while work continues"]
        : verdict === "clear"
        ? ["Capture it without scheduling", "Define one 30-minute first action"]
        : ["Pause or finish one active item first", "Capture it for the next weekly review", "Reduce it to a 30-minute experiment"],
    conditions:
      signals.some((signal) => signal.id === "missing-outcome") ? ["Define a measurable finish condition"] : [],
  };
}
