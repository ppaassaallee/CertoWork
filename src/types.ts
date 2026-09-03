
export type HabitType = 'health' | 'fitness' | 'work' | 'family' | 'personal' | 'system' | 'learning' | 'recovery';
export type HabitCadenceType = 'daily' | 'workdays' | 'weekly' | 'monthly' | 'custom';
export type HabitStatus = 'active' | 'paused' | 'archived';
export type HabitLogStatus = 'done' | 'skipped' | 'missed' | 'partial';

export interface Habit {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  description?: string;
  category?: string;
  type: HabitType;
  status: HabitStatus;
  cadenceType: HabitCadenceType;
  cadenceInterval?: number;
  cadenceUnit?: 'days' | 'weeks' | 'months';
  daysOfWeek?: number[]; // 0-6
  targetPerWeek?: number;
  targetPerMonth?: number;
  startDate: string;
  endDate?: string;
  habitStackingCue?: string;
  minimumVersion?: string;
  idealVersion?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  identityStatement?: string;
  environmentDesign?: string;
  reward?: string;
  priority: number;
  calendarVisible: boolean;
  color?: string;
  icon?: string;
  order?: number;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

export interface HabitLog {
  id: string;
  userId: string;
  workspaceId: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  status: HabitLogStatus;
  value?: number;
  notes?: string;
  completedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export type FitnessGoal = 'strength' | 'endurance' | 'fat_loss' | 'general_health' | 'hybrid' | 'performance';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type SessionType = 'strength' | 'swim' | 'walk' | 'run' | 'mountain_bike' | 'hiking' | 'mobility' | 'recovery' | 'rest';

export interface FitnessProfile {
  id: string;
  userId: string;
  workspaceId: string;
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  injuriesOrLimitations?: string;
  availableEquipment: string[];
  preferredWorkoutDurationMinutes: number;
  preferredTrainingDays: number[];
  preferredRestDays: number[];
  strengthDaysPerWeek: number;
  swimDaysPerWeek: number;
  walkRunDaysPerWeek: number;
  mountainBikeDay?: number;
  travelModeDefaults?: any;
  createdAt: any;
  updatedAt: any;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  goal: FitnessGoal;
  planType: 'gym' | 'no_gym' | 'hybrid';
  startDate: string;
  endDate?: string;
  weeklyStructure?: any;
  assumptions?: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  workspaceId: string;
  workoutPlanId: string;
  title: string;
  type: SessionType;
  date: string;
  startTime?: string;
  durationMinutes: number;
  intensity: 'easy' | 'moderate' | 'hard';
  location: 'gym' | 'home' | 'pool' | 'outdoor' | 'travel';
  status: 'planned' | 'completed' | 'skipped' | 'rescheduled';
  gymVersion?: string;
  noGymVersion?: string;
  warmup?: string;
  mainWorkout?: string;
  cooldown?: string;
  notes?: string;
  calendarVisible: boolean;
  linkedHabitId?: string;
  isRoutineWorkout?: boolean;
  recurrenceType?: RecurrenceType | 'none';
  recurrenceInterval?: number;
  recurrenceUnit?: RecurrenceUnit;
  recurrenceAnchorDate?: string;
  recurrenceStatus?: 'active' | 'ended';
  recurringSeriesId?: string | null;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface WorkoutExercise {
  id: string;
  userId: string;
  workspaceId: string;
  workoutSessionId: string;
  name: string;
  explanation?: string; // AI generated explanation
  muscleGroup?: string;
  equipment?: string;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  distance?: number;
  restSeconds?: number;
  intensityNotes?: string;
  alternatives?: string;
  order: number;
  createdAt: any;
  updatedAt: any;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  workspaceId: string;
  workoutSessionId: string;
  date: string;
  status: 'completed' | 'skipped' | 'partial';
  durationMinutes: number;
  perceivedEffort: number; // 1-10
  energyBefore: 'low' | 'medium' | 'high';
  energyAfter: 'low' | 'medium' | 'high';
  notes?: string;
  // WHOOP Metrics
  whoopStrain?: number;
  whoopAvgHeartRate?: number;
  whoopMaxHeartRate?: number;
  whoopCalories?: number;
  createdAt: any;
  updatedAt: any;
}

export interface DailyMetric {
  id: string;
  userId: string;
  workspaceId: string;
  date: string; // YYYY-MM-DD
  weight?: number;
  // WHOOP Daily
  whoopRecoveryScore?: number; // 1-100
  whoopStrain?: number;
  whoopSleepScore?: number; // 1-100
  whoopRHR?: number;
  whoopHRV?: number;
  // Subjective
  mood?: 'great' | 'good' | 'neutral' | 'meh' | 'bad';
  energyLevel?: number; // 1-10
  stressLevel?: number; // 1-10
  journalNote?: string;
  dailyIntention?: string;
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AnalyticsSnapshot {
  id: string;
  userId: string;
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'day' | 'week' | 'month' | 'quarter' | 'year';
  metrics: {
    productivity: {
      focusScore: number;
      oneThingConsistency: number;
      top3Completion: number;
      completionByPriority: Record<string, number>;
      killDelegateRate: number;
      reviewHealth: number;
      projectMomentum: number;
      busyworkRatio: number;
    };
    habits: {
      activeHabits: number;
      completionRate: number;
      consistencyByType: Record<string, number>;
    };
    workouts: {
      completionRate: number;
      typeCounts: Record<string, number>;
      totalMinutes: number;
      avgEffort: number;
    };
  };
  createdAt: any;
  updatedAt: any;
}

export interface PerformanceAnalysis {
  id: string;
  userId: string;
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  comparisonPeriodStart?: string;
  comparisonPeriodEnd?: string;
  status: 'pending' | 'completed';
  summary: string;
  wins: string[];
  risks: string[];
  bottlenecks: string[];
  productivityInsights: string;
  habitInsights: string;
  workoutInsights: string;
  recoveryInsights: string;
  recommendations: string[];
  metricsUsed: any;
  knowledgeUsedIds?: string[];
  skillIdsUsed?: string[];
  agentRunId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface PerformanceRecommendation {
  id: string;
  userId: string;
  workspaceId: string;
  analysisId: string;
  type: 'productivity' | 'habit' | 'workout' | 'recovery';
  title: string;
  description: string;
  reason: string;
  suggestedAction: string;
  targetEntityType: 'task' | 'habit' | 'workout' | 'setting';
  targetEntityId?: string;
  status: 'pending' | 'sent_to_review' | 'dismissed' | 'approved';
  createdAt: any;
  updatedAt: any;
}

export interface Stakeholder {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export type RecurrenceType = 'none' | 'daily' | 'workdays' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
export type RecurrenceUnit = 'days' | 'weeks' | 'months';
export type RecurrenceStatus = 'active' | 'paused' | 'ended';

export interface Task {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: 'open' | 'done' | 'archived';
  itemType?: 'next_action' | 'follow_up' | 'waiting_for' | 'decision' | 'project_task' | 'calendar' | 'delegated' | 'someday' | 'reference' | 'blocked' | string;
  categoryId?: string;
  categoryIds?: string[];
  stakeholderIds?: string[];
  projectId?: string;
  stageId?: string;
  globalStageId?: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4' | null | number;
  dueDate?: string | null;
  occurrenceDate?: string;
  isOneThing?: boolean;
  recurrence?: string; // Legacy field for string-based recurrence
  completedAt?: any;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  
  // Routine / Recurrence
  isRoutineTask?: boolean;
  recurrenceType?: RecurrenceType;
  recurrenceInterval?: number;
  recurrenceUnit?: RecurrenceUnit;
  recurrenceAnchorDate?: string;
  recurrenceStatus?: RecurrenceStatus;
  recurringSeriesId?: string;
  previousOccurrenceId?: string;
  createdFromOccurrenceId?: string;
  nextOccurrenceAt?: any;
  parentId?: string;
  milestoneId?: string;
  previousStageId?: string;
  isMilestone?: boolean;

  // New metadata fields
  gtdContext?: 'office' | 'home' | 'computer' | 'phone' | 'meeting' | 'deep_work' | 'anywhere' | 'errands' | 'custom' | string | null;
  timeSector?: 'today' | 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'later' | 'someday' | string | null;
  tags?: string[];
  boldiActionPlanId?: string;
  updatedBy?: string;

  // Canonical Certo Work work-item fields. The existing `tasks` collection is
  // retained as the one source of truth while records are upgraded additively.
  type?: 'epic' | 'feature' | 'pbi' | 'story' | 'task' | 'bug' | 'subtask' | 'ticket' | 'issue';
  workItemType?: 'epic' | 'feature' | 'pbi' | 'story' | 'task' | 'bug' | 'subtask' | 'ticket' | 'issue';
  key?: string;
  normalizedTitle?: string;
  epicId?: string | null;
  featureId?: string | null;
  sprintId?: string | null;
  acceptanceCriteria?: string;
  severity?: string;
  assigneeId?: string | null;
  reporterId?: string;
  ownerId?: string | null;
  storyPoints?: number | null;
  estimateHours?: number | null;
  startDate?: string | null;
  labels?: string[];
  dependencyIds?: string[];
  linkedDocumentIds?: string[];
  linkedPullRequestIds?: string[];
  linkedCommitIds?: string[];
  linkedBuildIds?: string[];
  linkedDeploymentIds?: string[];
  repositoryId?: string | null;
  branchName?: string | null;
  targetBranch?: string | null;
  targetVersion?: string | null;
  releaseId?: string | null;
  releaseVersion?: string | null;
  environment?: string | null;
  blocked?: boolean;
  blockedReason?: string;
  source?: 'manual' | 'boldi' | 'import' | 'github' | 'hermes' | 'api' | 'codex' | 'email' | 'form' | 'capture' | 'request_portal' | 'slack' | 'teams' | 'meeting' | 'agent' | 'ticket' | 'integration' | 'user_feedback' | 'bulk_paste';
  sourceType?: string;
  sourceId?: string | null;
  sourceThreadId?: string | null;
  sourceMessageIds?: string[];
  captureChannelId?: string | null;
  captureIntent?: string | null;
  captureReviewStatus?: 'needs_review' | 'accepted' | 'dismissed' | string | null;
  requesterId?: string | null;
  requesterEmail?: string | null;
  requesterName?: string | null;
  teamId?: string | null;
  ticketStatus?: 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed' | string | null;
  waitingReason?: string | null;
  customerStatus?: string | null;
  customerStatusDetail?: string | null;
  relatedWorkIds?: string[];
  sourceTicketId?: string | null;
  portalToken?: string | null;
  lastPublicUpdate?: string | null;
  sla?: {
    firstResponseDueAt?: string | null;
    resolutionDueAt?: string | null;
    nextUpdateDueAt?: string | null;
    firstRespondedAt?: string | null;
  } | null;
  ai?: Record<string, unknown> | null;
  checklist?: Array<{ id: string; text: string; done: boolean }>;
  comments?: Array<{ id: string; at: string; author: string; text: string; visibility?: 'public' | 'internal' }>;
  statusHistory?: Array<{ status: string; column?: string; at: string }>;
  loggedHours?: number | null;
  codexStatus?: string;
  codexRunId?: string | null;
  codexTaskReference?: string | null;
  codexLastSummary?: string;
  lastCodexSyncAt?: any;
  deliveryEvidence?: Record<string, unknown>;
}

export interface DailyClarityPreferences {
  id: string;
  userId: string;
  autoShowEnabled: boolean;
  remindLaterDate?: string;
  skippedDates?: string[];
  lastShownDate?: string;
  habitLinked: boolean;
  habitId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface MentalClaritySession {
  id: string;
  userId: string;
  createdAt: any;
  completedAt?: any;
  status: 'draft' | 'completed';
  durationSeconds: number;
  reflection?: string;
}

export interface MentalClarityItem {
  id: string;
  userId: string;
  sessionId: string;
  type: 'pendiente' | 'decision' | 'idea';
  title: string;
  selectedForAction: boolean;
  convertedToReviewId?: string;
  suggestedCalendarBlock?: string;
  createdAt: any;
}

export interface LetGoItem {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  createdAt: any;
}

export interface StrategicGoal {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  description?: string;
  type: 'north_star' | 'wig' | 'okr_objective' | 'quarterly_priority' | 'weekly_outcome';
  status: 'draft' | 'active' | 'paused' | 'achieved' | 'archived';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  periodStart?: string;
  periodEnd?: string;
  ownerId?: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

export interface KeyResult {
  id: string;
  userId: string;
  workspaceId: string;
  strategicGoalId: string;
  title: string;
  metricType: 'number' | 'percent' | 'boolean' | 'currency' | 'custom';
  startValue: number;
  targetValue: number;
  currentValue: number;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  status: 'not_started' | 'on_track' | 'at_risk' | 'off_track' | 'achieved';
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface StrategicInitiative {
  id: string;
  userId: string;
  workspaceId: string;
  strategicGoalId: string;
  title: string;
  description?: string;
  status: 'not_started' | 'active' | 'blocked' | 'paused' | 'done' | 'archived';
  projectIds: string[];
  ownerId?: string;
  health: 'on_track' | 'at_risk' | 'blocked' | 'stale' | 'unknown';
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface BoldiConversation {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  status: 'active' | 'archived';
  sourceContext: 'global' | 'today' | 'action_board' | 'project' | 'stakeholder' | 'meeting' | 'notebook' | 'strategy';
  sourceEntityType?: string;
  sourceEntityId?: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface BoldiMessage {
  id: string;
  userId: string;
  workspaceId: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  inputType: 'text' | 'voice' | 'transcript' | 'file' | 'system';
  toolName?: string;
  toolResult?: any;
  createdAt: any;
}

export interface BoldiActionPlan {
  id: string;
  userId: string;
  workspaceId: string;
  conversationId: string;
  title: string;
  summary: string;
  status: 'draft' | 'needs_approval' | 'approved' | 'partially_applied' | 'applied' | 'rejected' | 'failed';
  proposedActions: any[];
  riskLevel: 'low' | 'medium' | 'high';
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface BoldiAction {
  id: string;
  userId: string;
  workspaceId: string;
  actionPlanId: string;
  type: string;
  targetEntityType?: string;
  targetEntityId?: string;
  beforeState?: any;
  proposedChange: any;
  reason: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';
  appliedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface BoldiToolRun {
  id: string;
  userId: string;
  workspaceId: string;
  conversationId: string;
  toolName: string;
  input: any;
  output: any;
  status: 'running' | 'success' | 'failed';
  error?: string;
  startedAt: any;
  completedAt?: any;
  createdAt: any;
}

export interface DailyBrief {
  id: string;
  userId: string;
  workspaceId: string;
  date: string;
  status: 'draft' | 'reviewed' | 'accepted' | 'archived';
  summary: string;
  strategicObjective: string;
  recommendedOneThing: {
    title: string;
    reason: string;
    linkedGoalIds: string[];
    linkedTaskId: string | null;
  };
  recommendedTop3: Array<{
    title: string;
    reason: string;
    linkedTaskId: string | null;
    linkedProjectId: string | null;
  }>;
  projectAlerts: Array<{
    projectId: string;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high';
    suggestedAction: string;
  }>;
  stakeholderFollowUps: Array<{
    stakeholderId: string;
    reason: string;
    suggestedAction: string;
  }>;
  timeBlockSuggestions: Array<{
    title: string;
    type: 'deep_work' | 'admin' | 'follow_up' | 'meetings' | 'planning' | 'recovery';
    durationMinutes: number;
    reason: string;
    linkedTaskIds: string[];
  }>;
  recommendations: Array<{
    title: string;
    type: 'task' | 'decision' | 'project_review' | 'stakeholder_followup' | 'time_block' | 'delegate' | 'kill';
    reason: string;
  }>;
  missingData?: string[];
  metricsUsed?: any;
  knowledgeUsedIds?: string[];
  skillIdsUsed?: string[];
  agentRunId?: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface StartDayPreferences {
  id: string;
  userId: string;
  workspaceId: string;
  autoShowEnabled: boolean;
  showOnFirstOpen: boolean;
  preferredTime?: string;
  includeMentalReset: boolean;
  includeTimeBlocks: boolean;
  lastShownDate?: string;
  lastCompletedDate?: string;
  createdAt: any;
  updatedAt: any;
}

export interface StartDaySession {
  id: string;
  userId: string;
  workspaceId: string;
  date: string;
  status: 'started' | 'completed' | 'skipped' | 'archived';
  dailyBriefId?: string;
  selectedOneThingId?: string;
  selectedTop3Ids?: string[];
  approvedTimeBlockIds?: string[];
  mentalClaritySessionId?: string;
  startedAt: any;
  completedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface MeetingIntake {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  meetingDate: string;
  participants?: string[];
  projectId?: string;
  stakeholderIds?: string[];
  rawInput: string;
  inputType: 'notes' | 'transcript' | 'summary' | 'voice_text' | 'file';
  status: 'draft' | 'processed' | 'sent_to_review' | 'archived' | 'failed';
  processedOutput?: any;
  agentRunId?: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface StrategicAlignmentRun {
  id: string;
  userId: string;
  workspaceId: string;
  status: 'running' | 'needs_review' | 'applied' | 'failed';
  itemCount: number;
  createdAt: any;
  updatedAt: any;
}

export interface StrategicAlignmentSuggestion {
  id: string;
  userId: string;
  workspaceId: string;
  runId: string;
  itemType: 'task' | 'project' | 'milestone' | 'productivity_item';
  itemId: string;
  suggestedGoalIds: string[];
  suggestedInitiativeIds: string[];
  strategicAlignmentScore: number;
  reason: string;
  suggestedAction: 'keep' | 'schedule' | 'delegate' | 'kill' | 'clarify' | 'link_to_goal';
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdAt: any;
  updatedAt: any;
}

export interface StrategicAlert {
  id: string;
  userId: string;
  workspaceId: string;
  type: 'busywork_risk' | 'no_one_thing' | 'stale_project' | 'unaligned_project' | 'stakeholder_risk' | 'overload' | 'review_backlog' | 'meeting_unprocessed';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestedAction: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  status: 'active' | 'dismissed' | 'sent_to_review' | 'resolved';
  createdAt: any;
  updatedAt: any;
}
