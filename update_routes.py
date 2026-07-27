import re

with open("src/App.tsx", "r") as f:
    content = f.read()

start_marker = "<Routes>"
end_marker = "</Routes>"
start_idx = content.find(start_marker) + len(start_marker)
end_idx = content.find(end_marker)

new_routes = """
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<Today />} />
            <Route path="/today/focus" element={<Today />} />
            <Route path="/today/agenda" element={<UnifiedCalendar />} />
            <Route path="/today/routines" element={<RoutineTasksView />} />

            <Route path="/capture" element={<Capture />} />
            <Route path="/capture/inbox" element={<InboxPage />} />
            <Route path="/capture/meeting-intake" element={<MeetingIntakePanel />} />
            <Route path="/capture/documents" element={<KnowledgeBase />} />
            <Route path="/capture/ideas" element={<GenericModulePage title="Ideas" collectionName="someday" entityName="Idea" />} />
            <Route path="/capture/review" element={<GenericModulePage title="Needs Review" collectionName="needs_review" entityName="Review Item" />} />

            <Route path="/work" element={<Work />} />
            <Route path="/work/action-board" element={<TasksList />} />
            <Route path="/work/action-board/:id" element={<TaskDetails />} />
            <Route path="/work/projects" element={<ProjectsList />} />
            <Route path="/work/projects/:id" element={<ProjectDetails />} />
            <Route path="/work/deals" element={<ProjectsList />} />
            <Route path="/work/agent-workspace" element={<WarRoom />} />
            <Route path="/work/agent-workspace/:id" element={<WarRoom />} />
            <Route path="/work/documents" element={<KnowledgeBase />} />
            <Route path="/work/documents/:id" element={<KnowledgeDetail />} />
            <Route path="/work/timeblocks" element={<TimeBlocksPlanner />} />

            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/week" element={<ReviewHub />} />
            <Route path="/plan/month" element={<MonthlyPlanningRitual />} />
            <Route path="/plan/quarter" element={<PlanPage />} />
            <Route path="/plan/year" element={<PlanPage />} />
            <Route path="/plan/strategy" element={<StrategyCenter />} />

            <Route path="/review" element={<ReviewHub />} />
            <Route path="/review/weekly" element={<ReviewHub />} />
            <Route path="/review/monthly" element={<ReviewHub />} />
            <Route path="/review/quarterly" element={<ReviewHub />} />
            <Route path="/review/metrics" element={<ProgressDashboard />} />
            <Route path="/review/habits" element={<HabitsHome />} />
            <Route path="/review/health" element={<DailyMetrics />} />
            <Route path="/review/workouts" element={<WorkoutsHome />} />
            <Route path="/boldi" element={<BoldiAssistant />} />

            {/* Other routes that exist */}
            <Route path="/work/stakeholders" element={<StakeholdersList />} />
            <Route path="/work/playbooks" element={<PlaybooksList />} />
            <Route path="/work/playbooks/:id" element={<PlaybookDetails />} />
            <Route path="/work/projects/health" element={<ProjectHealthCommandCenter />} />
            <Route path="/work/decisions" element={<GenericModulePage title="Decisions" collectionName="decisions" entityName="Decision" />} />
            <Route path="/work/decisions/:id" element={<GenericModuleDetail collectionName="decisions" />} />
            <Route path="/work/waiting" element={<GenericModulePage title="Waiting For" collectionName="waiting_for" entityName="Waiting For" />} />
            <Route path="/work/waiting/:id" element={<GenericModuleDetail collectionName="waiting_for" />} />
            <Route path="/work/presentations" element={<GenericModulePage title="Presentations" collectionName="presentations" entityName="Presentation" />} />
            <Route path="/work/presentations/:id" element={<GenericModuleDetail collectionName="presentations" />} />
            <Route path="/work/skills" element={<SkillsLibrary />} />
            <Route path="/work/skills/:id" element={<SkillDetail />} />
            <Route path="/work/health" element={<GenericModulePage title="Health Actions" collectionName="health_actions" entityName="Health Action" />} />
            <Route path="/work/health/:id" element={<GenericModuleDetail collectionName="health_actions" />} />
            <Route path="/work/daily-shutdown" element={<DailyShutdown />} />
            
            <Route path="/me" element={<Me />} />
            <Route path="/me/workspace" element={<WorkspaceSettings />} />
            <Route path="/me/notion" element={<NotionConnector />} />
            <Route path="/me/data-integrity" element={<DataIntegrity />} />
            <Route path="/me/context" element={<GenericModulePage title="System Context" collectionName="system_context" entityName="Context File" />} />
            <Route path="/me/context/:id" element={<GenericModuleDetail collectionName="system_context" />} />
            <Route path="/me/permissions" element={<GenericModulePage title="Tool Permissions" collectionName="tool_permissions" entityName="Permission" />} />
            <Route path="/me/permissions/:id" element={<GenericModuleDetail collectionName="tool_permissions" />} />
            <Route path="/me/scheduled" element={<GenericModulePage title="Scheduled Tasks" collectionName="scheduled_tasks" entityName="Schedule" />} />
            <Route path="/me/scheduled/:id" element={<GenericModuleDetail collectionName="scheduled_tasks" />} />
            <Route path="/me/reviews" element={<GenericModulePage title="System Review" collectionName="system_reviews" entityName="Review" />} />
            <Route path="/me/reviews/:id" element={<GenericModuleDetail collectionName="system_reviews" />} />
            <Route path="/me/analytics" element={<ProgressDashboard />} />
            <Route path="/me/self-mastery" element={<PerformanceHub />} />
            <Route path="/me/metrics" element={<DailyMetrics />} />
            <Route path="/boldr/*" element={<BoldrOSHub />} />

            {/* Redirects */}
            <Route path="/inbox" element={<Navigate to="/capture/inbox" replace />} />
            <Route path="/rich-capture" element={<Navigate to="/capture/inbox" replace />} />
            <Route path="/meeting-intake" element={<Navigate to="/capture/meeting-intake" replace />} />
            <Route path="/documents" element={<Navigate to="/capture/documents" replace />} />
            <Route path="/ideas-someday" element={<Navigate to="/capture/ideas" replace />} />
            
            <Route path="/action-board" element={<Navigate to="/work/action-board" replace />} />
            <Route path="/work/tasks" element={<Navigate to="/work/action-board" replace />} />
            <Route path="/work/tasks/:id" element={<Navigate to="/work/action-board/:id" replace />} />
            <Route path="/projects-deals" element={<Navigate to="/work/projects" replace />} />
            <Route path="/operations-hub" element={<Navigate to="/work" replace />} />
            
            <Route path="/weekly-plan" element={<Navigate to="/plan/week" replace />} />
            <Route path="/monthly-plan" element={<Navigate to="/plan/month" replace />} />
            <Route path="/strategy-center" element={<Navigate to="/plan/strategy" replace />} />
            <Route path="/os-command" element={<Navigate to="/plan/strategy" replace />} />
            
            <Route path="/system-review" element={<Navigate to="/review/weekly" replace />} />
            <Route path="/progress-metrics" element={<Navigate to="/review/metrics" replace />} />
            <Route path="/habits-tracker" element={<Navigate to="/review/habits" replace />} />
            <Route path="/health-whoop" element={<Navigate to="/review/health" replace />} />
            <Route path="/workouts-rituals" element={<Navigate to="/review/workouts" replace />} />
            <Route path="/routine-tasks" element={<Navigate to="/today/routines" replace />} />
            <Route path="/unified-calendar" element={<Navigate to="/today/agenda" replace />} />
            
            <Route path="/agent-workspace" element={<Navigate to="/work/agent-workspace" replace />} />
"""

new_content = content[:start_idx] + new_routes + content[end_idx:]

with open("src/App.tsx", "w") as f:
    f.write(new_content)
