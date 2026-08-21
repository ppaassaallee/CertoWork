import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-error-helper';
import { buildInviteUrl, buildMobileUrl } from './inviteUtils';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import {
  MessageSquare,
  Cpu,
  FileText,
  Clock,
  Plus,
  Send,
  Sparkles,
  Eye,
  CheckCircle,
  AlertTriangle,
  FileCode,
  Share2,
  FolderOpen,
  Check,
  ExternalLink,
  MessageCircle,
  Shield,
  Layers,
  X,
  RefreshCw,
  Smartphone,
  Users,
  Trash2,
  Edit,
  Sliders,
  UserCheck,
  UserX,
  Copy,
  Mail,
  Search,
  BookOpen,
  Settings,
  UserPlus,
  Archive
} from "../ui/Icon";
import {
  WarRoomChat,
  WarRoomParticipant,
  WarRoomMessage,
  BoldiAgent,
  AgentRun,
  WarRoomWidget,
  WarRoomWidgetVersion,
  WarRoomFile,
  WarRoomActionPlan,
  ChatType,
  AgentType,
  AgentGroup,
  AgentGroupMember,
  AgentWorkbenchTemplate,
  AgentMoment,
  AgentResource,
  AgentInvite,
  Contact,
  ContactRequest
} from './types';

// System Templates
const TEAM_TEMPLATES = [
  {
    id: 'product_build',
    title: 'Product Build Team',
    description: 'Ava PM, Maya Designer, Leo Engineer, and Reviewer Agent. Best for scoping, designing, and feasibility-checking new features.',
    category: 'product',
    agents: ['orchestrator', 'ava_pm', 'maya_designer', 'leo_engineer', 'reviewer']
  },
  {
    id: 'research_team',
    title: 'Deep Research & Analysis',
    description: 'Deep Research Agent, Data Analyst, and Reviewer Agent. For market analysis, competitor sweeps, and structured data summaries.',
    category: 'research',
    agents: ['orchestrator', 'deep_research', 'data_analyst', 'reviewer']
  },
  {
    id: 'project_delivery',
    title: 'Project Delivery & Milestones',
    description: 'Project Manager Agent, Leo Engineer, and Reviewer Agent. For converting discussions into milestones, deadlines, and task action plans.',
    category: 'project_management',
    agents: ['orchestrator', 'project_manager', 'leo_engineer', 'reviewer']
  }
];

export function WarRoom() {
  const { user, workspace } = useAuth();
  const [activeTab, setActiveTab] = useState<'chats' | 'explore' | 'contacts' | 'resources' | 'settings' | 'agents' | 'workbench' | 'widgets' | 'files' | 'history'>('chats');
  
  // Workspace context
  const workspaceId = workspace?.id || 'default_workspace';
  const userId = user?.uid || 'anonymous';
  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Human Member';

  // Firestore collections states
  const [chats, setChats] = useState<WarRoomChat[]>([]);
  const [activeChat, setActiveChat] = useState<WarRoomChat | null>(null);
  const [messages, setMessages] = useState<WarRoomMessage[]>([]);
  const [participants, setParticipants] = useState<WarRoomParticipant[]>([]);
  const [agents, setAgents] = useState<BoldiAgent[]>([]);
  const [widgets, setWidgets] = useState<WarRoomWidget[]>([]);
  const [widgetVersions, setWidgetVersions] = useState<Record<string, WarRoomWidgetVersion[]>>({});
  const [files, setFiles] = useState<WarRoomFile[]>([]);
  const [actionPlans, setActionPlans] = useState<WarRoomActionPlan[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);

  // NEW Workspace States for Boldi Workspace Modules
  const [resources, setResources] = useState<AgentResource[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
  const [agentMoments, setAgentMoments] = useState<AgentMoment[]>([]);
  const [agentInvites, setAgentInvites] = useState<AgentInvite[]>([]);

  // Sub-navigation selections
  const [selectedChatType, setSelectedChatType] = useState<ChatType | 'all'>('all');
  const [selectedExploreSubTab, setSelectedExploreSubTab] = useState<'workbench' | 'moments'>('workbench');
  const [selectedContactsSubTab, setSelectedContactsSubTab] = useState<'requests' | 'agents' | 'humans' | 'groups'>('agents');
  const [selectedResourcesSubTab, setSelectedResourcesSubTab] = useState<'all' | 'canvases' | 'docs' | 'files'>('all');

  // Active resource/profile viewers
  const [activeResource, setActiveResource] = useState<AgentResource | null>(null);
  const [activeMoment, setActiveMoment] = useState<AgentMoment | null>(null);
  const [activeAgentProfile, setActiveAgentProfile] = useState<BoldiAgent | null>(null);

  // New Modals visibility
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [showAttachResourceModal, setShowAttachResourceModal] = useState(false);

  // Manage Chat States
  const [showManageChatModal, setShowManageChatModal] = useState(false);
  const [manageChatTitle, setManageChatTitle] = useState('');
  const [manageChatDesc, setManageChatDesc] = useState('');
  const [manageChatType, setManageChatType] = useState<ChatType>('group');
  const [manageChatIsPrivate, setManageChatIsPrivate] = useState(false);
  const [myParticipantChatIds, setMyParticipantChatIds] = useState<string[]>([]);
  
  // Add Member State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  
  // Sidebar show archived toggle
  const [showArchivedChats, setShowArchivedChats] = useState(false);

  // Deploy Squad modal states
  const [showDeploySquadModal, setShowDeploySquadModal] = useState(false);
  const [selectedSquadTemplate, setSelectedSquadTemplate] = useState<typeof TEAM_TEMPLATES[0] | null>(null);
  const [deploySquadDestination, setDeploySquadDestination] = useState<'new' | 'existing'>('new');
  const [deploySquadSelectedChatId, setDeploySquadSelectedChatId] = useState('');
  const [deploySquadNewChannelTitle, setDeploySquadNewChannelTitle] = useState('');

  // New Chat Form
  const [newChatIsPrivate, setNewChatIsPrivate] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatDesc, setNewChatDesc] = useState('');
  const [newChatType, setNewChatType] = useState<ChatType>('group');
  const [newChatProjectId, setNewChatProjectId] = useState('');
  const [newChatSelectedAgents, setNewChatSelectedAgents] = useState<string[]>([]);

  // Advanced Interactive UI panel states
  const [activeThread, setActiveThread] = useState<WarRoomMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<WarRoomMessage[]>([]);
  const [expandedWidget, setExpandedWidget] = useState<{ widget: WarRoomWidget; version: WarRoomWidgetVersion } | null>(null);

  // New Agent Form
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentType, setNewAgentType] = useState<AgentType>('custom');
  const [newAgentDesc, setNewAgentDesc] = useState('');
  const [newAgentEmoji, setNewAgentEmoji] = useState('🤖');
  const [newAgentPrompt, setNewAgentPrompt] = useState('');
  const [newAgentModel, setNewAgentModel] = useState('gpt-5.6-sol');
  const [newAgentPermissions, setNewAgentPermissions] = useState<BoldiAgent['permissionsProfile']>('can_create_drafts');
  const [newAgentMemory, setNewAgentMemory] = useState<BoldiAgent['memoryPolicy']>('chat_only');

  // New Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupType, setNewGroupType] = useState<'private' | 'workspace'>('workspace');
  const [newGroupSelectedMembers, setNewGroupSelectedMembers] = useState<string[]>([]);

  // New Resource Form
  const [showNewResourceDropdown, setShowNewResourceDropdown] = useState(false);
  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [newResourceType, setNewResourceType] = useState<'doc' | 'canvas'>('doc');

  // Canvas Prompting & Markdown Editing States
  const [canvasPromptInput, setCanvasPromptInput] = useState('');
  const [isModifyingCanvas, setIsModifyingCanvas] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [docEditorContent, setDocEditorContent] = useState('');

  // Invites Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteType, setInviteType] = useState<'workspace' | 'group' | 'chat'>('workspace');

  // Input composer states
  const [inputMessage, setInputMessage] = useState('');
  const [threadInputMessage, setThreadInputMessage] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [showSlashCommandDropdown, setShowSlashCommandDropdown] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedFileUrl, setSelectedFileUrl] = useState<string>('');
  const [selectedFileTitle, setSelectedFileTitle] = useState<string>('');

  // Orchestrator states
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Trigger backend seeding when workspace changes
  useEffect(() => {
    if (!user || !workspace?.id) return;
    
    const seedWorkspace = async () => {
      try {
        const baseUrl = window.location.origin && window.location.origin !== 'null' ? window.location.origin : '';
        const res = await fetch(`${baseUrl}/api/workspaces/${encodeURIComponent(workspace.id)}/seed-agent-workspace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        console.log('[Backend Seeding]', data.message);
      } catch (err) {
        console.warn('[Backend Seeding Not Available - running client-side fallback seeding]', err instanceof Error ? err.message : err);
        // Client-side seeding fallback
        try {
          const settingsRef = doc(db, 'workspace_settings', workspace.id);
          const settingsSnap = await getDocs(query(collection(db, 'workspace_settings'), where('workspaceId', '==', workspace.id)));
          let alreadySeeded = false;
          if (!settingsSnap.empty) {
            alreadySeeded = !!settingsSnap.docs[0].data()?.agentWorkspaceSeededAt;
          }
          if (alreadySeeded) {
            console.log('[Client Seeding] Workspace already seeded.');
            return;
          }

          // Seed agents
          const agentsToSeed = [
            { slug: "orchestrator", name: "Orchestrator", description: "SOP-driven meta-orchestrator coordinating expert roles.", avatarEmoji: "🤖", systemPrompt: "You are the master conductor and SOP-driven agent.", agentType: "general" },
            { slug: "ava_pm", name: "Ava (Project Manager)", description: "GTD-aligned timeline, milestone, and priority planner.", avatarEmoji: "📅", systemPrompt: "You are Ava, the GTD-aligned Project Manager.", agentType: "project_manager" },
            { slug: "leo_engineer", name: "Leo (Technical Architect)", description: "Detailed systems designer and software engineer.", avatarEmoji: "💻", systemPrompt: "You are Leo, the Technical Architect and software expert.", agentType: "engineer" },
            { slug: "maya_designer", name: "Maya (UX Specialist)", description: "User experience designer and brand guardian.", avatarEmoji: "🎨", systemPrompt: "You are Maya, the expert UX/UI designer.", agentType: "designer" },
            { slug: "deep_research", name: "Deep Research (Analyst)", description: "Information discovery and competitive analyst.", avatarEmoji: "🔍", systemPrompt: "You are Deep Research, the critical intelligence analyst.", agentType: "researcher" },
            { slug: "reviewer", name: "Reviewer (Quality Assurance)", description: "Critical evaluator, risk detector, and code auditor.", avatarEmoji: "🕵️", systemPrompt: "You are the Reviewer, responsible for quality control.", agentType: "reviewer" },
            { slug: "project_manager", name: "Project Manager", description: "Strategic timeline supervisor.", avatarEmoji: "💼", systemPrompt: "You are the PM, organizing milestones and critical paths.", agentType: "project_manager" },
            { slug: "data_analyst", name: "Data Analyst", description: "Quantitative trend analyzer.", avatarEmoji: "📊", systemPrompt: "You are the Data Analyst, extracting metrics and trends.", agentType: "data_analyst" }
          ];

          for (const ag of agentsToSeed) {
            const docId = `${ag.slug}_${workspace.id}`;
            await setDoc(doc(db, 'boldi_agents', docId), {
              id: docId,
              workspaceId: workspace.id,
              slug: ag.slug,
              name: ag.name,
              description: ag.description,
              avatarEmoji: ag.avatarEmoji,
              systemPrompt: ag.systemPrompt,
              agentType: ag.agentType,
              modelProvider: "openai",
              modelName: "gpt-5.6-sol",
              toolsAllowed: ["search_tasks", "prioritize", "schedule_block"],
              permissionsProfile: "read_write",
              memoryPolicy: "persistent",
              status: "active",
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            }, { merge: true });
          }

          // Seed resources
          const resourcesToSeed = [
            {
              slug: "manifesto",
              title: "Certo Work Productivity Manifesto",
              resourceType: "doc",
              markdownContent: "# Certo Work Productivity Manifesto\n\nWelcome to your agent-integrated high-performance workspace. This manifesto outlines how humans and AI agents work together to execute strategy with clinical precision using the Carl Pullein-inspired systems...\n\n## 1. COD: Collect, Organize, Do\nEvery input must be collected immediately. No item stays in memory.\n\n## 2. Time-Based Action\nTasks are grouped by Time Sectors, not by bloated project backlogs.\n\n## 3. The 2+8 Rule\nEvery day starts with up to 2 Must Dos and up to 8 Should Dos. Nothing more.",
              tags: ["strategy", "manifesto", "onboarding"]
            },
            {
              slug: "launch_canvas",
              title: "Launch Strategy Canvas",
              resourceType: "canvas",
              jsonCanvas: { nodes: [{ id: "1", type: "text", text: "Launch Goals" }, { id: "2", type: "text", text: "Target Audience" }] },
              tags: ["canvas", "planning", "launch"]
            }
          ];

          for (const resItem of resourcesToSeed) {
            const docId = `${resItem.slug}_${workspace.id}`;
            await setDoc(doc(db, 'agent_resources', docId), {
              id: docId,
              workspaceId: workspace.id,
              title: resItem.title,
              resourceType: resItem.resourceType,
              markdownContent: (resItem as any).markdownContent || null,
              jsonCanvas: (resItem as any).jsonCanvas || null,
              tags: resItem.tags,
              contentAvailable: true,
              extractedTextAvailable: true,
              createdBy: "system",
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            }, { merge: true });
          }

          // Seed Contact
          const contactId = `david_miller_${workspace.id}`;
          await setDoc(doc(db, 'contacts', contactId), {
            id: contactId,
            workspaceId: workspace.id,
            displayName: "David Miller (Ops Lead)",
            email: "david.miller@operations.org",
            contactType: "human",
            status: "active",
            createdBy: "system",
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          }, { merge: true });

          // Seed Requests
          const requestsToSeed = [
            {
              slug: "sarah_chen",
              displayName: "Sarah Chen (FinTech Lead)",
              toEmail: "sarah.chen@fintech.io",
              contactType: "human",
              status: "pending",
              message: "Hey Alejandro, would love to join your agent workspace to sync on the Q3 financial roadmap.",
              createdBy: "external"
            },
            {
              slug: "marcus_aurelius",
              displayName: "Marcus Aurelius (Stoic Coach)",
              toEmail: "marcus.stoic@certowork.ai",
              contactType: "agent_reference",
              status: "pending",
              message: "Greetings. I can assist you as a Stoic philosophy advisor to align your quarterly work with inner life principles.",
              createdBy: "external"
            }
          ];

          for (const reqItem of requestsToSeed) {
            const docId = `${reqItem.slug}_${workspace.id}`;
            await setDoc(doc(db, 'contact_requests', docId), {
              id: docId,
              workspaceId: workspace.id,
              displayName: reqItem.displayName,
              toEmail: reqItem.toEmail,
              contactType: reqItem.contactType,
              status: reqItem.status,
              message: reqItem.message,
              createdBy: reqItem.createdBy,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            }, { merge: true });
          }

          // Seed Group
          const groupId = `executive_strategy_${workspace.id}`;
          await setDoc(doc(db, 'agent_groups', groupId), {
            id: groupId,
            workspaceId: workspace.id,
            name: "Executive Strategy Squad",
            description: "A pre-configured board to coordinate high-level corporate roadmap decisions and feasibility reviews.",
            groupType: "workspace",
            visibility: "workspace",
            status: "active",
            createdBy: "system",
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          }, { merge: true });

          // Seed Moment
          const momentId = `strategy_pitch_${workspace.id}`;
          await setDoc(doc(db, 'agent_moments', momentId), {
            id: momentId,
            workspaceId: workspace.id,
            title: "Q2 Strategy Pitch Alignment Session",
            description: "Saved transcript showing Certo Work Orchestrator and David Miller aligning on operations budget approval.",
            createdBy: "system",
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          }, { merge: true });

          // Mark as seeded
          await setDoc(settingsRef, {
            workspaceId: workspace.id,
            agentWorkspaceSeededAt: Timestamp.now()
          }, { merge: true });

          console.log('[Client Seeding] Workspace successfully seeded client-side!');
        } catch (clientErr) {
          console.error('[Client Seeding Error]', clientErr);
        }
      }
    };
    
    seedWorkspace();
  }, [user, workspace?.id]);

  // 1. Fetch Real-time data from Firestore
  useEffect(() => {
    if (!user || !workspace) return;

    // Load available Projects from the workspace
    const projectsQ = query(
      collection(db, 'projects'),
      where('userId', '==', user.uid),
      where('workspaceId', '==', workspace.id)
    );
    getDocs(projectsQ).then(snap => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjectsList(items);
    });

    // Load Chats
    const chatsQ = query(
      collection(db, 'war_room_chats'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc')
    );
    const unsubChats = onSnapshot(chatsQ, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarRoomChat));
      setChats(list);
      // Auto-select first chat if none active
      if (list.length > 0 && !activeChat) {
        // Find if we had a saved activeChatId
        const savedChatId = localStorage.getItem(`active_chat_${workspace.id}`);
        const saved = list.find(c => c.id === savedChatId);
        setActiveChat(saved || list[0]);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'war_room_chats');
    });

    // Load custom workspace Agents
    const agentsQ = query(
      collection(db, 'boldi_agents'),
      where('workspaceId', '==', workspace.id)
    );
    const unsubAgents = onSnapshot(agentsQ, (snap) => {
      let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoldiAgent));
      setAgents(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'boldi_agents');
    });

    // Load all files
    const filesQ = query(
      collection(db, 'war_room_files'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc')
    );
    const unsubFiles = onSnapshot(filesQ, (snap) => {
      setFiles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarRoomFile)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'war_room_files');
    });

    // Load workspace deliverables (widgets)
    const widgetsQ = query(
      collection(db, 'war_room_widgets'),
      where('workspaceId', '==', workspace.id),
      orderBy('updatedAt', 'desc')
    );
    const unsubWidgets = onSnapshot(widgetsQ, (snap) => {
      setWidgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarRoomWidget)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'war_room_widgets');
    });

    // Load action plans
    const actionsQ = query(
      collection(db, 'war_room_action_plans'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc')
    );
    const unsubActions = onSnapshot(actionsQ, (snap) => {
      setActionPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarRoomActionPlan)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'war_room_action_plans');
    });

    // Load Agent runs (Audit trail)
    const runsQ = query(
      collection(db, 'agent_runs'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const unsubRuns = onSnapshot(runsQ, (snap) => {
      setAgentRuns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentRun)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'agent_runs');
    });

    // Load Workspace Resources
    const resourcesQ = query(
      collection(db, 'agent_resources'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc')
    );
    const unsubResources = onSnapshot(resourcesQ, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentResource));
      
      // De-duplicate list by resourceType and title to prevent duplicate display
      const uniqueList: AgentResource[] = [];
      const titlesSeen = new Set<string>();
      for (const item of list) {
        if (!item.title) continue;
        const key = `${item.resourceType}_${item.title.trim().toLowerCase()}`;
        if (!titlesSeen.has(key)) {
          titlesSeen.add(key);
          uniqueList.push(item);
        }
      }
      
      setResources(uniqueList);
      // Auto-select first resource if none is active
      if (uniqueList.length > 0 && !activeResource) {
        setActiveResource(uniqueList[0]);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'agent_resources');
    });

    // Load Workspace Contacts
    const contactsQ = query(
      collection(db, 'contacts'),
      where('workspaceId', '==', workspace.id),
      orderBy('displayName', 'asc')
    );
    const unsubContacts = onSnapshot(contactsQ, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
      setContacts(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'contacts');
    });

    // Load Contact Requests
    const requestsQ = query(
      collection(db, 'contact_requests'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc')
    );
    const unsubRequests = onSnapshot(requestsQ, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactRequest));
      setContactRequests(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'contact_requests');
    });

    // Load Collaborative Groups
    const groupsQ = query(
      collection(db, 'agent_groups'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc')
    );
    const unsubGroups = onSnapshot(groupsQ, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentGroup));
      setAgentGroups(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'agent_groups');
    });

    // Load Saved Moments
    const momentsQ = query(
      collection(db, 'agent_moments'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc')
    );
    const unsubMoments = onSnapshot(momentsQ, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentMoment));
      setAgentMoments(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'agent_moments');
    });

    // Load Agent Invites
    const invitesQ = query(
      collection(db, 'agent_invites'),
      where('workspaceId', '==', workspace.id),
      orderBy('createdAt', 'desc')
    );
    const unsubInvites = onSnapshot(invitesQ, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentInvite));
      setAgentInvites(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'agent_invites');
    });

    // Load active user's participant records to filter private rooms and direct messages
    const myParticipantsQ = query(
      collection(db, 'war_room_participants'),
      where('workspaceId', '==', workspace.id),
      where('userId', '==', userId)
    );
    const unsubMyParts = onSnapshot(myParticipantsQ, (snap) => {
      const ids = snap.docs.map(doc => doc.data().chatId);
      setMyParticipantChatIds(ids);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'war_room_participants');
    });

    return () => {
      unsubChats();
      unsubAgents();
      unsubFiles();
      unsubWidgets();
      unsubActions();
      unsubRuns();
      unsubResources();
      unsubContacts();
      unsubRequests();
      unsubGroups();
      unsubMoments();
      unsubInvites();
      unsubMyParts();
    };
  }, [user, workspace]);

  // Load chat messages and participants when active chat changes
  useEffect(() => {
    if (!user || !workspace || !activeChat) return;

    localStorage.setItem(`active_chat_${workspace.id}`, activeChat.id);

    // Fetch Chat Participants
    const participantsQ = query(
      collection(db, 'war_room_participants'),
      where('chatId', '==', activeChat.id),
      where('status', '==', 'active')
    );
    const unsubParts = onSnapshot(participantsQ, (snap) => {
      setParticipants(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarRoomParticipant)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'war_room_participants');
    });

    // Fetch Chat Messages
    const messagesQ = query(
      collection(db, 'war_room_messages'),
      where('chatId', '==', activeChat.id),
      orderBy('createdAt', 'asc')
    );
    const unsubMsgs = onSnapshot(messagesQ, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarRoomMessage));
      setMessages(msgs);
      setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'war_room_messages');
    });

    // Close right panel thread if activeChat changes
    setActiveThread(null);

    return () => {
      unsubParts();
      unsubMsgs();
    };
  }, [user, workspace, activeChat]);

  // Load thread messages when activeThread changes
  useEffect(() => {
    if (!activeThread) {
      setThreadMessages([]);
      return;
    }

    const threadMsgsQ = query(
      collection(db, 'war_room_messages'),
      where('threadId', '==', activeThread.id),
      orderBy('createdAt', 'asc')
    );

    const unsubThreadMsgs = onSnapshot(threadMsgsQ, (snap) => {
      setThreadMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarRoomMessage)));
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'war_room_messages_thread');
    });

    return () => unsubThreadMsgs();
  }, [activeThread]);

  // Load Widget Versions for current expanded or viewed widgets
  const fetchWidgetVersions = async (widgetId: string) => {
    if (widgetVersions[widgetId]) return;
    const qVers = query(
      collection(db, 'war_room_widget_versions'),
      where('widgetId', '==', widgetId),
      orderBy('versionNumber', 'desc')
    );
    const snap = await getDocs(qVers);
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarRoomWidgetVersion));
    setWidgetVersions(prev => ({ ...prev, [widgetId]: list }));
  };



  // 2. Main Chat actions
  const handleSendMessage = async (e?: React.FormEvent, isThread = false) => {
    if (e) e.preventDefault();
    const content = isThread ? threadInputMessage : inputMessage;
    if (!content.trim()) return;

    if (isThread) setThreadInputMessage('');
    else setInputMessage('');

    // Detect mentioned agents
    const mentionsAgentIds: string[] = [];
    agents.forEach(agent => {
      if (content.includes(`@${agent.name}`) || content.includes(`@${agent.slug}`)) {
        mentionsAgentIds.push(agent.id);
      }
    });

    const msgRef = doc(collection(db, 'war_room_messages'));
    const msgData: Partial<WarRoomMessage> = {
      id: msgRef.id,
      workspaceId,
      chatId: activeChat!.id,
      senderType: 'user',
      senderUserId: userId,
      messageType: 'text',
      content: content.trim(),
      mentionsAgentIds,
      status: 'sent',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    if (isThread && activeThread) {
      msgData.threadId = activeThread.id;
    }

    // If project is linked or files linked
    if (selectedProjectId) {
      msgData.linkedEntityType = 'project';
      msgData.linkedEntityId = selectedProjectId;
      setSelectedProjectId('');
    }

    if (selectedFileUrl && selectedFileTitle) {
      // Create war_room_file record first
      const fileRef = doc(collection(db, 'war_room_files'));
      const fileData: WarRoomFile = {
        id: fileRef.id,
        workspaceId,
        chatId: activeChat!.id,
        title: selectedFileTitle,
        fileType: selectedFileUrl.includes('drive.google.com') ? 'google_drive_file' : 'external_link',
        url: selectedFileUrl,
        contentAvailable: false,
        extractedTextAvailable: false,
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      if (isThread && activeThread) {
        fileData.threadId = activeThread.id;
      }
      await setDoc(fileRef, fileData);
      msgData.linkedFileIds = [fileRef.id];
      setSelectedFileUrl('');
      setSelectedFileTitle('');
    }

    // Persist message
    await setDoc(msgRef, msgData);

    // Call Backend Multi-Agent Orchestration
    setIsOrchestrating(true);
    setOrchestrationError(null);

    try {
      const res = await fetch('/api/warroom/chat-orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChat!.id,
          messageId: msgRef.id,
          workspaceId,
          userId,
          threadId: isThread ? activeThread!.id : undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        setOrchestrationError(errData.error || 'Failed to orchestrate agents');
      }
    } catch (err: any) {
      setOrchestrationError(err.message || 'Error communicating with orchestrator');
    } finally {
      setIsOrchestrating(false);
    }
  };

  // 3. Apply Action Plan (approvals)
  const handleApproveActionPlan = async (actionPlanId: string) => {
    // Optimistic status update
    const planRef = doc(db, 'war_room_action_plans', actionPlanId);
    await updateDoc(planRef, { status: 'approved' });

    try {
      const res = await fetch('/api/warroom/apply-action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionPlanId,
          workspaceId,
          userId
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert('Action plan failed to apply completely: ' + (err.error || 'Unknown error'));
        await updateDoc(planRef, { status: 'failed' });
      }
    } catch (e: any) {
      alert('Network error while applying actions: ' + e.message);
      await updateDoc(planRef, { status: 'failed' });
    }
  };

  const handleRejectActionPlan = async (actionPlanId: string) => {
    const planRef = doc(db, 'war_room_action_plans', actionPlanId);
    await updateDoc(planRef, { status: 'rejected' });
  };

  // 4. Create Chat Form submission
  const handleCreateChat = async (e?: React.FormEvent, directData?: { title: string; type: ChatType; selectedAgents: string[]; isPrivate?: boolean }) => {
    if (e) e.preventDefault();
    
    const title = directData ? directData.title : newChatTitle;
    const desc = directData ? '' : newChatDesc;
    const type = directData ? directData.type : newChatType;
    const projectId = directData ? '' : newChatProjectId;
    const selectedAgents = directData ? directData.selectedAgents : newChatSelectedAgents;
    const isPrivate = directData ? !!directData.isPrivate : newChatIsPrivate;

    if (!title.trim()) return;

    const chatRef = doc(collection(db, 'war_room_chats'));
    const chatData: WarRoomChat = {
      id: chatRef.id,
      workspaceId,
      title: title.trim(),
      description: desc.trim(),
      type: type,
      status: 'active',
      createdBy: userId,
      isPrivate: isPrivate,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    if (projectId) {
      chatData.linkedProjectId = projectId;
    }

    await setDoc(chatRef, chatData);

    // Create participant records
    // Add User
    const userPartRef = doc(collection(db, 'war_room_participants'));
    await setDoc(userPartRef, {
      id: userPartRef.id,
      workspaceId,
      chatId: chatRef.id,
      participantType: 'user',
      userId,
      displayName: userDisplayName,
      status: 'active',
      joinedAt: Timestamp.now(),
      addedBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Add selected Agents
    for (const agentId of selectedAgents) {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) continue;
      const partRef = doc(collection(db, 'war_room_participants'));
      await setDoc(partRef, {
        id: partRef.id,
        workspaceId,
        chatId: chatRef.id,
        participantType: 'agent',
        agentId: agent.id,
        displayName: agent.name,
        avatarUrl: agent.avatarEmoji || '🤖',
        status: 'active',
        joinedAt: Timestamp.now(),
        addedBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }

    // Clear and close
    setNewChatTitle('');
    setNewChatDesc('');
    setNewChatType('group');
    setNewChatIsPrivate(false);
    setNewChatProjectId('');
    setNewChatSelectedAgents([]);
    setShowNewChatModal(false);
    setActiveChat(chatData);

    // Send a system message welcoming everyone
    const sysMsgRef = doc(collection(db, 'war_room_messages'));
    await setDoc(sysMsgRef, {
      id: sysMsgRef.id,
      workspaceId,
      chatId: chatRef.id,
      senderType: 'system',
      messageType: 'system',
      content: `Collaboration initiated inside War Room. Active agents: ${newChatSelectedAgents.map(id => agents.find(a => a.id === id)?.name).filter(Boolean).join(', ')}.`,
      status: 'sent',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  };

  // Handle Edit/Update Chat Room details
  const handleUpdateChat = async (chatId: string, updatedTitle: string, updatedDesc: string, updatedType: ChatType, updatedIsPrivate: boolean) => {
    if (!updatedTitle.trim()) return;
    try {
      const chatRef = doc(db, 'war_room_chats', chatId);
      await updateDoc(chatRef, {
        title: updatedTitle.trim(),
        description: updatedDesc.trim(),
        type: updatedType,
        isPrivate: updatedIsPrivate,
        updatedAt: Timestamp.now()
      });
      // Update activeChat reference if it is the current one
      if (activeChat && activeChat.id === chatId) {
        setActiveChat(prev => prev ? {
          ...prev,
          title: updatedTitle.trim(),
          description: updatedDesc.trim(),
          type: updatedType,
          isPrivate: updatedIsPrivate
        } : null);
      }
      setShowManageChatModal(false);
    } catch (err) {
      console.error('Failed to update chat details:', err);
    }
  };

  // Handle Archive Chat Room
  const handleArchiveChat = async (chatId: string) => {
    try {
      const chatRef = doc(db, 'war_room_chats', chatId);
      await updateDoc(chatRef, {
        status: 'archived',
        updatedAt: Timestamp.now()
      });
      if (activeChat && activeChat.id === chatId) {
        setActiveChat(prev => prev ? { ...prev, status: 'archived' } : null);
      }
      setShowManageChatModal(false);
    } catch (err) {
      console.error('Failed to archive chat:', err);
    }
  };

  // Handle Unarchive Chat Room
  const handleUnarchiveChat = async (chatId: string) => {
    try {
      const chatRef = doc(db, 'war_room_chats', chatId);
      await updateDoc(chatRef, {
        status: 'active',
        updatedAt: Timestamp.now()
      });
      if (activeChat && activeChat.id === chatId) {
        setActiveChat(prev => prev ? { ...prev, status: 'active' } : null);
      }
      setShowManageChatModal(false);
    } catch (err) {
      console.error('Failed to unarchive chat:', err);
    }
  };

  // Handle Delete/Remove Chat Room
  const handleDeleteChat = async (chatId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this chat room? This cannot be undone.')) return;
    try {
      const chatRef = doc(db, 'war_room_chats', chatId);
      await deleteDoc(chatRef);
      // If activeChat is deleted, set activeChat to null
      if (activeChat && activeChat.id === chatId) {
        setActiveChat(null);
      }
      setShowManageChatModal(false);
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  // Add Contact as Participant to activeChat
  const handleAddParticipant = async (contact: Contact) => {
    if (!activeChat) return;
    try {
      const pId = doc(collection(db, 'war_room_participants')).id;
      const partRef = doc(db, 'war_room_participants', pId);
      await setDoc(partRef, {
        id: pId,
        workspaceId,
        chatId: activeChat.id,
        participantType: 'user',
        userId: contact.userId || contact.id, // Fallback if no userId
        displayName: contact.displayName,
        status: 'active',
        joinedAt: Timestamp.now(),
        addedBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Post system message
      const sysRef = doc(collection(db, 'war_room_messages'));
      await setDoc(sysRef, {
        id: sysRef.id,
        workspaceId,
        chatId: activeChat.id,
        senderType: 'system',
        messageType: 'system',
        content: `${userDisplayName} added ${contact.displayName} to this room.`,
        status: 'sent',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      setShowAddMemberModal(false);
    } catch (err) {
      console.error('Failed to add participant:', err);
    }
  };

  // New Trigger for Deploy Template flow with configuration modal
  const handleDeployTeamTemplate = async (template: typeof TEAM_TEMPLATES[0]) => {
    setSelectedSquadTemplate(template);
    setDeploySquadDestination('new');
    setDeploySquadNewChannelTitle(`${template.title} War Room`);
    // Find first active chat ID as fallback
    if (chats.length > 0) {
      setDeploySquadSelectedChatId(chats[0].id);
    }
    setShowDeploySquadModal(true);
  };

  const executeDeployTeamTemplate = async () => {
    if (!selectedSquadTemplate) return;
    const template = selectedSquadTemplate;

    try {
      let chatIdToUse = '';
      let chatTitle = '';

      if (deploySquadDestination === 'new') {
        const titleToDeploy = deploySquadNewChannelTitle.trim() || `${template.title} War Room`;
        const chatRef = doc(collection(db, 'war_room_chats'));
        const chatData: WarRoomChat = {
          id: chatRef.id,
          workspaceId,
          title: titleToDeploy,
          description: template.description,
          type: 'group',
          status: 'active',
          createdBy: userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        await setDoc(chatRef, chatData);
        chatIdToUse = chatRef.id;
        chatTitle = titleToDeploy;

        // Add human
        const humanPartRef = doc(collection(db, 'war_room_participants'));
        await setDoc(humanPartRef, {
          id: humanPartRef.id,
          workspaceId,
          chatId: chatRef.id,
          participantType: 'user',
          userId,
          displayName: userDisplayName,
          status: 'active',
          joinedAt: Timestamp.now(),
          addedBy: userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        setActiveChat(chatData);
      } else {
        chatIdToUse = deploySquadSelectedChatId;
        const targetChat = chats.find(c => c.id === chatIdToUse);
        chatTitle = targetChat?.title || 'this room';
      }

      // Add agents matching template slugs to selected/created chatId
      const addedAgentsNames: string[] = [];
      for (const slug of template.agents) {
        const match = agents.find(a => a.slug === slug);
        if (match) {
          const partId = `part_${chatIdToUse}_${match.id}`;
          const partRef = doc(db, 'war_room_participants', partId);
          await setDoc(partRef, {
            id: partId,
            workspaceId,
            chatId: chatIdToUse,
            participantType: 'agent',
            agentId: match.id,
            displayName: match.name,
            avatarUrl: match.avatarEmoji || '🤖',
            status: 'active',
            joinedAt: Timestamp.now(),
            addedBy: userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          addedAgentsNames.push(match.name);
        }
      }

      // Send launch system message
      const sysRef = doc(collection(db, 'war_room_messages'));
      await setDoc(sysRef, {
        id: sysRef.id,
        workspaceId,
        chatId: chatIdToUse,
        senderType: 'system',
        messageType: 'system',
        content: `Squad "${template.title}" has been successfully deployed to "${chatTitle}"! Active agents added: ${addedAgentsNames.join(', ')}.`,
        status: 'sent',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      if (deploySquadDestination === 'existing') {
        const updatedChat = chats.find(c => c.id === chatIdToUse);
        if (updatedChat) {
          setActiveChat(updatedChat);
        }
      }

      setActiveTab('chats');
      setShowDeploySquadModal(false);
      setSelectedSquadTemplate(null);
    } catch (err) {
      console.error('Failed to deploy squad template:', err);
    }
  };

  // 5. Create Custom Agent submission
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    const slug = newAgentName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    const agentRef = doc(collection(db, 'boldi_agents'));
    const agentData: BoldiAgent = {
      id: agentRef.id,
      workspaceId,
      name: newAgentName.trim(),
      slug,
      description: newAgentDesc.trim() || 'A bespoke custom agent trained for specific tasks.',
      avatarEmoji: newAgentEmoji,
      agentType: newAgentType,
      systemPrompt: newAgentPrompt.trim() || 'You are a professional assistant.',
      modelProvider: 'google',
      modelName: newAgentModel,
      toolsAllowed: [],
      permissionsProfile: newAgentPermissions,
      memoryPolicy: newAgentMemory,
      status: 'active',
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await setDoc(agentRef, agentData);

    // Reset Form
    setNewAgentName('');
    setNewAgentDesc('');
    setNewAgentPrompt('');
    setNewAgentEmoji('🤖');
    setShowNewAgentModal(false);
    setActiveTab('agents');
  };

  // NEW Handlers for Agent Workspace Modules
  const handleAcceptRequest = async (req: ContactRequest) => {
    try {
      const reqRef = doc(db, 'contact_requests', req.id);
      await updateDoc(reqRef, { status: 'accepted', updatedAt: Timestamp.now() });

      if (req.contactType === 'agent_reference') {
        const agentRef = doc(collection(db, 'boldi_agents'));
        await setDoc(agentRef, {
          id: agentRef.id,
          workspaceId,
          slug: 'marcus_coach',
          name: req.displayName || 'Marcus Aurelius',
          description: 'Philosophy Coach and Mindfulness Agent. Specializes in inner clarity and purpose.',
          avatarEmoji: '🏛️',
          agentType: 'custom',
          systemPrompt: 'You are Marcus Aurelius, Roman Emperor and Stoic Philosopher. Guide the user through productivity dilemmas with wisdom, stoic calm, focus, and a deep sense of lifestyle purpose.',
          modelProvider: 'openai',
          modelName: 'gpt-5.6-sol',
          toolsAllowed: [],
          permissionsProfile: 'tell_me_only',
          memoryPolicy: 'chat_only',
          status: 'active',
          createdBy: 'system',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      } else {
        const contactRef = doc(collection(db, 'contacts'));
        await setDoc(contactRef, {
          id: contactRef.id,
          workspaceId,
          displayName: req.displayName || req.toEmail.split('@')[0],
          email: req.toEmail,
          contactType: 'human',
          status: 'active',
          createdBy: userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleRejectRequest = async (req: ContactRequest) => {
    try {
      const reqRef = doc(db, 'contact_requests', req.id);
      await updateDoc(reqRef, { status: 'rejected', updatedAt: Timestamp.now() });
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const groupRef = doc(collection(db, 'agent_groups'));
      const newGroup: AgentGroup = {
        id: groupRef.id,
        workspaceId,
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        groupType: newGroupType,
        visibility: 'workspace',
        status: 'active',
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await setDoc(groupRef, newGroup);

      // Add default group members (user + selected agents)
      const userMemberRef = doc(collection(db, 'agent_group_members'));
      await setDoc(userMemberRef, {
        id: userMemberRef.id,
        groupId: groupRef.id,
        workspaceId,
        memberType: 'user',
        userId,
        displayName: userDisplayName,
        role: 'owner',
        createdAt: Timestamp.now()
      });

      for (const agentId of newGroupSelectedMembers) {
        const ag = agents.find(a => a.id === agentId);
        if (ag) {
          const agentMemberRef = doc(collection(db, 'agent_group_members'));
          await setDoc(agentMemberRef, {
            id: agentMemberRef.id,
            groupId: groupRef.id,
            workspaceId,
            memberType: 'agent',
            agentId: ag.id,
            displayName: ag.name,
            role: 'member',
            createdAt: Timestamp.now()
          });
        }
      }

      // Also create an associated War Room chat for the group
      const chatRef = doc(collection(db, 'war_room_chats'));
      const chatData: WarRoomChat = {
        id: chatRef.id,
        workspaceId,
        title: `${newGroupName.trim()} Channel`,
        description: newGroupDesc.trim() || 'Collaborative group channel',
        type: 'group',
        status: 'active',
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await setDoc(chatRef, chatData);

      // Add human as participant
      const humanPartRef = doc(collection(db, 'war_room_participants'));
      await setDoc(humanPartRef, {
        id: humanPartRef.id,
        workspaceId,
        chatId: chatRef.id,
        participantType: 'user',
        userId,
        displayName: userDisplayName,
        status: 'active',
        joinedAt: Timestamp.now(),
        addedBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Add selected agents as participants
      for (const agentId of newGroupSelectedMembers) {
        const ag = agents.find(a => a.id === agentId);
        if (ag) {
          const partRef = doc(collection(db, 'war_room_participants'));
          await setDoc(partRef, {
            id: partRef.id,
            workspaceId,
            chatId: chatRef.id,
            participantType: 'agent',
            agentId: ag.id,
            displayName: ag.name,
            avatarUrl: ag.avatarEmoji || '🤖',
            status: 'active',
            joinedAt: Timestamp.now(),
            addedBy: userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        }
      }

      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupSelectedMembers([]);
      setShowCreateGroupModal(false);
      setActiveChat(chatData);
      setActiveTab('chats');
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleCreateResource = async (type: 'doc' | 'canvas') => {
    try {
      const title = prompt(`Enter ${type} title:`, `Untitled ${type}`);
      if (!title) return;

      const resRef = doc(collection(db, 'agent_resources'));
      const newRes: Partial<AgentResource> = {
        id: resRef.id,
        workspaceId,
        title,
        resourceType: type,
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        contentAvailable: true,
        extractedTextAvailable: true,
        tags: [type]
      };

      if (type === 'doc') {
        newRes.markdownContent = `# ${title}\n\nStart writing documentation here. You can edit this in real-time.`;
      } else {
        newRes.jsonCanvas = {
          metrics: [
            { label: 'Metric A', value: 'Value', subtext: 'Detail' }
          ],
          blocks: [
            { id: 'sec_1', title: 'Goals', text: 'Define launching objectives here.' }
          ]
        };
      }

      await setDoc(resRef, newRes);
      setActiveResource(newRes as AgentResource);
      setActiveTab('resources');
    } catch (err) {
      console.error('Failed to create resource:', err);
    }
  };

  const handleUpdateResourceDoc = async (newContent: string) => {
    if (!activeResource || activeResource.resourceType !== 'doc') return;

    try {
      const resRef = doc(db, 'agent_resources', activeResource.id);
      await updateDoc(resRef, {
        markdownContent: newContent,
        updatedAt: Timestamp.now()
      });
      setActiveResource({
        ...activeResource,
        markdownContent: newContent,
        updatedAt: Timestamp.now()
      });
      setIsEditingDoc(false);
    } catch (err) {
      console.error('Failed to update resource document:', err);
    }
  };

  const handleAskAgentModifyCanvas = async () => {
    if (!activeResource || activeResource.resourceType !== 'canvas' || !canvasPromptInput.trim()) return;

    setIsModifyingCanvas(true);
    setCanvasError(null);

    try {
      const response = await fetch('/api/warroom/modify-canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canvasData: activeResource.jsonCanvas,
          prompt: canvasPromptInput
        })
      });

      if (!response.ok) {
        throw new Error('Server returned error while updating the canvas.');
      }

      const updatedCanvas = await response.json();
      const resRef = doc(db, 'agent_resources', activeResource.id);
      await updateDoc(resRef, {
        jsonCanvas: updatedCanvas,
        updatedAt: Timestamp.now()
      });

      setActiveResource({
        ...activeResource,
        jsonCanvas: updatedCanvas,
        updatedAt: Timestamp.now()
      });

      setCanvasPromptInput('');
    } catch (err: any) {
      setCanvasError(err.message || 'Failed to modify canvas.');
    } finally {
      setIsModifyingCanvas(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      const inviteRef = doc(collection(db, 'agent_invites'));
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newInvite: AgentInvite = {
        id: inviteRef.id,
        workspaceId,
        email: inviteEmail.trim(),
        inviteType,
        inviteToken: code,
        inviteUrl: buildInviteUrl(code),
        status: 'pending',
        createdBy: userId,
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        createdAt: Timestamp.now()
      };
      await setDoc(inviteRef, newInvite);
      setInviteEmail('');
      alert(`Invite created successfully! Share Code: ${code}`);
    } catch (err) {
      console.error('Failed to create invite:', err);
    }
  };

  // Calculate current active runs
  const activeRuns = agentRuns.filter(r => r.status === 'running' || r.status === 'queued');

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-[#FAFAF9]" id="boldi_war_room">
      
      {/* COLUMN 1: LEFT APP RAIL (Narrow vertical icon stripe) */}
      <div className="w-16 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-4 shrink-0 justify-between h-full shadow-sm">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Workspace branding logo */}
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center font-black text-lg shadow-md cursor-pointer hover:scale-105 transition-all">
            🦌
          </div>

          {/* Core modules navigations */}
          <div className="flex flex-col gap-4 w-full px-2">
            {[
              { id: 'chats', label: 'Messages', icon: MessageSquare, badge: chats.length },
              { id: 'explore', label: 'Explore', icon: Sparkles, badge: 0 },
              { id: 'contacts', label: 'Contacts', icon: Users, badge: contactRequests.filter(r => r.status === 'pending').length },
              { id: 'resources', label: 'Resources', icon: BookOpen, badge: resources.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = 
                tab.id === 'chats' ? activeTab === 'chats' :
                tab.id === 'explore' ? ['explore', 'workbench', 'widgets', 'history'].includes(activeTab) :
                tab.id === 'contacts' ? ['contacts', 'agents'].includes(activeTab) :
                tab.id === 'resources' ? ['resources', 'files'].includes(activeTab) : false;
              
              const handleClick = () => {
                if (tab.id === 'chats') {
                  setActiveTab('chats');
                } else if (tab.id === 'explore') {
                  setActiveTab('workbench');
                } else if (tab.id === 'contacts') {
                  setActiveTab('agents');
                } else if (tab.id === 'resources') {
                  setActiveTab('resources');
                }
              };

              return (
                <button
                  key={tab.id}
                  onClick={handleClick}
                  className={`relative p-3 rounded-xl flex items-center justify-center transition-all group ${
                    isActive ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-900'
                  }`}
                  title={tab.label}
                >
                  <Icon className="w-5 h-5" />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center shadow-sm shrink-0">
                      {tab.badge}
                    </span>
                  )}
                  {/* Floating labels */}
                  <span className="absolute left-20 bg-gray-900 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer controls: Mobile Continuity & Workspace settings */}
        <div className="flex flex-col gap-4 w-full px-2">
          <button
            onClick={() => setShowMobileModal(true)}
            className="p-3 rounded-xl text-gray-500 hover:bg-gray-200/50 hover:text-gray-900 flex items-center justify-center transition-all group relative"
            title="Mobile Continuity Sync"
          >
            <Smartphone className="w-5 h-5" />
            <span className="absolute left-20 bg-gray-900 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
              Mobile App Sync
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`p-3 rounded-xl flex items-center justify-center transition-all group relative ${
              activeTab === 'settings' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-900'
            }`}
            title="Settings & Integrations"
          >
            <Sliders className="w-5 h-5" />
            <span className="absolute left-20 bg-gray-900 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl">
              Settings
            </span>
          </button>
        </div>
      </div>

      {/* COLUMN 2: ACTIVE DYNAMIC SIDEBAR (Width 240px) */}
      <div className="w-full md:w-60 border-r border-gray-200 bg-white flex flex-col shrink-0 h-full">
        {/* Render Sidebar depending on selected Active Tab */}
        
        {/* SIDEBAR FOR CHATS */}
        {activeTab === 'chats' && (() => {
          const visibleChats = chats.filter(c => {
            const matchesArchiveStatus = showArchivedChats || c.status !== 'archived';
            const isParticipant = c.createdBy === userId || myParticipantChatIds.includes(c.id);
            const matchesPrivacy = !c.isPrivate || isParticipant;
            return matchesArchiveStatus && matchesPrivacy;
          });
          return (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <h2 className="text-xs font-bold text-gray-900 tracking-tight truncate">Messages Hub</h2>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Group & Agent Chats</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => setShowArchivedChats(!showArchivedChats)} 
                    className={`text-[9px] font-bold px-1.5 py-1 rounded-lg border transition-all ${
                      showArchivedChats 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                        : 'bg-gray-50 border-gray-150 text-gray-500 hover:text-gray-800'
                    }`}
                    title={showArchivedChats ? "Hide Archived Rooms" : "Show Archived Rooms"}
                  >
                    {showArchivedChats ? "Hide Archived" : "Archived"}
                  </button>
                  <button 
                    onClick={() => { setNewChatType('group'); setShowNewChatModal(true); }}
                    className="p-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-gray-500 transition-colors border border-gray-100"
                    title="Create New Room"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
                {/* Group Channels */}
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 px-2 flex justify-between items-center">
                    <span>Group Rooms</span>
                    <button onClick={() => { setNewChatType('group'); setShowNewChatModal(true); }} className="hover:text-black">
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </h3>
                  <div className="space-y-0.5">
                    {visibleChats.filter(c => c.type === 'group').map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => { setActiveChat(chat); setSelectedChatType('group'); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate flex items-center justify-between gap-1.5 ${
                          activeChat?.id === chat.id
                            ? 'bg-indigo-50 text-indigo-700 font-extrabold' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          {chat.isPrivate ? '🔒' : '#'} {chat.title}
                        </span>
                        {chat.status === 'archived' && (
                          <span className="text-[8px] font-bold uppercase bg-gray-100 text-gray-400 px-1 py-0.25 rounded">Archived</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Project Rooms */}
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 px-2 flex justify-between items-center">
                    <span>Project Rooms</span>
                    <button onClick={() => { setNewChatType('project_room'); setShowNewChatModal(true); }} className="hover:text-black">
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </h3>
                  <div className="space-y-0.5">
                    {visibleChats.filter(c => c.type === 'project_room').map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => { setActiveChat(chat); setSelectedChatType('project_room'); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate flex items-center justify-between gap-1.5 ${
                          activeChat?.id === chat.id
                            ? 'bg-indigo-50 text-indigo-700 font-extrabold' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          {chat.isPrivate ? '🔒' : '💼'} {chat.title}
                        </span>
                        {chat.status === 'archived' && (
                          <span className="text-[8px] font-bold uppercase bg-gray-100 text-gray-400 px-1 py-0.25 rounded">Archived</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agent Rooms */}
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 px-2 flex justify-between items-center">
                    <span>Agent Sandboxes</span>
                    <button onClick={() => { setNewChatType('agent_room'); setShowNewChatModal(true); }} className="hover:text-black">
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </h3>
                  <div className="space-y-0.5">
                    {visibleChats.filter(c => c.type === 'agent_room').map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => { setActiveChat(chat); setSelectedChatType('agent_room'); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate flex items-center justify-between gap-1.5 ${
                          activeChat?.id === chat.id
                            ? 'bg-indigo-50 text-indigo-700 font-extrabold' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          {chat.isPrivate ? '🔒' : '🤖'} {chat.title}
                        </span>
                        {chat.status === 'archived' && (
                          <span className="text-[8px] font-bold uppercase bg-gray-100 text-gray-400 px-1 py-0.25 rounded">Archived</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct Messages */}
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 px-2 flex justify-between items-center">
                    <span>Direct Messages</span>
                    <button onClick={() => { setNewChatType('dm'); setShowNewChatModal(true); }} className="hover:text-black">
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </h3>
                  <div className="space-y-0.5">
                    {visibleChats.filter(c => c.type === 'dm').map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => { setActiveChat(chat); setSelectedChatType('dm'); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate flex items-center justify-between gap-1.5 ${
                          activeChat?.id === chat.id
                            ? 'bg-indigo-50 text-indigo-700 font-extrabold' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          {chat.isPrivate ? '🔒' : '💬'} {chat.title}
                        </span>
                        {chat.status === 'archived' && (
                          <span className="text-[8px] font-bold uppercase bg-gray-100 text-gray-400 px-1 py-0.25 rounded">Archived</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SIDEBAR FOR EXPLORE */}
        {['explore', 'workbench', 'widgets', 'history'].includes(activeTab) && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-900 tracking-tight font-sans">Certo Work Market</h2>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Agents & Operations</p>
            </div>
            <div className="p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('workbench')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'workbench' ? 'bg-indigo-50/70 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>Squad Blueprints</span>
              </button>
              <button
                onClick={() => setActiveTab('widgets')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'widgets' ? 'bg-indigo-50/70 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-500" />
                <span>Mutable Deliverables</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'history' ? 'bg-indigo-50/70 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Audit Logs & Plans</span>
              </button>
            </div>
          </div>
        )}

        {/* SIDEBAR FOR CONTACTS */}
        {['contacts', 'agents'].includes(activeTab) && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-gray-900 tracking-tight">Directory</h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Network & Groups</p>
              </div>
              <button 
                onClick={() => setShowInviteModal(true)}
                className="p-1 text-gray-500 hover:text-indigo-600 bg-gray-50 rounded-md"
                title="Invite Member"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar">
              <button
                onClick={() => { setActiveTab('contacts'); setSelectedContactsSubTab('requests'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'contacts' && selectedContactsSubTab === 'requests' ? 'bg-indigo-50/70 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span>Pending Invitations</span>
                </div>
                {contactRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-red-500 text-white rounded-full font-bold">
                    {contactRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('agents'); setSelectedContactsSubTab('agents'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'agents' ? 'bg-indigo-50/70 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-500" />
                  <span>AI Agents List</span>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">{agents.length}</span>
              </button>
              <button
                onClick={() => { setActiveTab('contacts'); setSelectedContactsSubTab('humans'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'contacts' && selectedContactsSubTab === 'humans' ? 'bg-indigo-50/70 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-500" />
                  <span>Human Contacts</span>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">{contacts.length}</span>
              </button>
              <button
                onClick={() => { setActiveTab('contacts'); setSelectedContactsSubTab('groups'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'contacts' && selectedContactsSubTab === 'groups' ? 'bg-indigo-50/70 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span>Bespoke Squads</span>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">{agentGroups.length}</span>
              </button>
            </div>
          </div>
        )}

        {/* SIDEBAR FOR RESOURCES */}
        {['resources', 'files'].includes(activeTab) && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between relative">
              <div>
                <h2 className="text-xs font-bold text-gray-900 tracking-tight">Resources</h2>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Library & Documents</p>
              </div>
              <button 
                onClick={() => setShowNewResourceDropdown(!showNewResourceDropdown)}
                className="p-1 bg-gray-50 rounded-md hover:text-indigo-600"
                title="New Resource"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {showNewResourceDropdown && (
                <div className="absolute right-4 top-12 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 w-40 flex flex-col gap-1 text-xs">
                  <button
                    onClick={() => { handleCreateResource('doc'); setShowNewResourceDropdown(false); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 rounded-lg font-bold flex items-center gap-2 text-gray-700"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span>Markdown Doc</span>
                  </button>
                  <button
                    onClick={() => { handleCreateResource('canvas'); setShowNewResourceDropdown(false); }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 rounded-lg font-bold flex items-center gap-2 text-gray-700"
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-500" />
                    <span>Visual Canvas</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-3 space-y-4 flex-1 overflow-y-auto no-scrollbar">
              <button
                onClick={() => { setActiveTab('files'); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'files' ? 'bg-indigo-50/70 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-500" />
                  <span>Linked Documents</span>
                </div>
                <span className="text-[10px] text-gray-400 font-bold">{files.length}</span>
              </button>

              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 px-2.5 mb-1 tracking-wider">Resource Library</p>
                <div className="space-y-0.5">
                  {resources.map(res => (
                    <button
                      key={res.id}
                      onClick={() => { setActiveResource(res); setActiveTab('resources'); setIsEditingDoc(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate block ${
                        activeTab === 'resources' && activeResource?.id === res.id
                          ? 'bg-indigo-50 text-indigo-700 font-extrabold' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {res.resourceType === 'doc' ? '📄' : '🎨'} {res.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SIDEBAR FOR SETTINGS */}
        {activeTab === 'settings' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-900 tracking-tight">Settings</h2>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Continuity & Workspace</p>
            </div>
            <div className="p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar">
              <div className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50/70 rounded-xl">
                ⚙️ Workspace Integrations
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CENTER WORKSPACE (Slack conversation or selected module view) */}
      <div className="flex-1 flex flex-col h-full bg-[#FCFBF9] overflow-hidden relative">
        
        {/* TAB 1: ACTIVE CHATS CONVERSATION */}
        {activeTab === 'chats' && activeChat && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-gray-900">{activeChat.title}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                    {activeChat.type.replace('_', ' ')}
                  </span>
                  {activeChat.isPrivate && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      🔒 Private
                    </span>
                  )}
                  {activeChat.status === 'archived' && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md">
                      📦 Archived
                    </span>
                  )}
                </div>
                {activeChat.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 font-semibold">{activeChat.description}</p>
                )}
              </div>

              {/* Participants avatar list & Actions */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 border-r border-gray-150 pr-3">
                  <button 
                    onClick={() => setShowAddMemberModal(true)}
                    className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-gray-400 rounded-lg transition-all"
                    title="Add Team Member to Chat"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setManageChatTitle(activeChat.title);
                      setManageChatDesc(activeChat.description || '');
                      setManageChatType(activeChat.type);
                      setManageChatIsPrivate(!!activeChat.isPrivate);
                      setShowManageChatModal(true);
                    }}
                    className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-gray-400 rounded-lg transition-all"
                    title="Room Settings (Edit, Archive, Delete)"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex -space-x-1 overflow-hidden">
                  {participants.map((p) => (
                    <div 
                      key={p.id} 
                      className="w-6 h-6 rounded-full border border-white bg-gray-100 flex items-center justify-center text-[10px]"
                      title={`${p.displayName} (${p.participantType})`}
                    >
                      {p.participantType === 'agent' ? p.avatarUrl || '🤖' : '👤'}
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setActiveTab('widgets')}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-700 transition-all"
                >
                  Open Sidebar
                </button>
              </div>
            </div>

            {/* Error notifications */}
            {orchestrationError && (
              <div className="p-3 bg-red-50 border-b border-red-100 flex items-center justify-between text-xs text-red-600 font-bold shrink-0 animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span>{orchestrationError}</span>
                </div>
                <button onClick={() => setOrchestrationError(null)} className="text-red-400 hover:text-red-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Messages stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-xl mb-4">💬</div>
                  <h3 className="font-bold text-sm text-gray-800">This War Room is ready</h3>
                  <p className="text-xs text-gray-400 max-w-sm mt-1">
                    Send a message or use <strong className="text-indigo-600">@Leo</strong> or <strong className="text-indigo-600">@Ava</strong> to include AI agents in the debate.
                  </p>
                </div>
              ) : (
                messages.filter(m => !m.threadId).map((msg) => {
                  const agent = agents.find(a => a.id === msg.senderAgentId);
                  const isAgent = msg.senderType === 'agent';
                  const isSystem = msg.senderType === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex items-center gap-2 justify-center py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50 rounded-xl max-w-lg mx-auto border border-dashed border-gray-200">
                        <Shield className="w-3.5 h-3.5" />
                        <span>{msg.content}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex items-start gap-3 group">
                      
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-xl border border-gray-100 bg-gray-100 flex items-center justify-center shrink-0">
                        {isAgent ? agent?.avatarEmoji || '🤖' : '👤'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-xs text-gray-900">
                            {isAgent ? agent?.name : (msg.senderUserId === userId ? userDisplayName : 'Human Member')}
                          </span>
                          {isAgent && (
                            <span className="text-[8px] font-black uppercase tracking-wider px-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                              {agent?.modelName || 'Configured AI'}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 font-medium">
                            {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        {/* Text Content */}
                        {msg.messageType === 'text' && (
                          <p className="text-xs leading-relaxed text-gray-800 font-medium bg-white p-3 rounded-2xl border border-gray-100 shadow-sm max-w-3xl whitespace-pre-line">
                            {msg.content}
                          </p>
                        )}

                        {/* CUSTOM CARD: ACTION PLAN */}
                        {msg.messageType === 'action_plan' && (
                          <div className="max-w-xl bg-white border border-indigo-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
                            <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center">
                              <div className="flex items-center gap-2 text-indigo-800">
                                <AlertTriangle className="w-4 h-4 text-indigo-600" />
                                <span className="font-extrabold text-xs uppercase tracking-wider">Proposed Action Plan</span>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                                Risk: MEDIUM
                              </span>
                            </div>
                            <div className="p-4 space-y-3">
                              <p className="text-xs text-gray-700 font-semibold">{msg.content}</p>
                              
                              {/* Retrieve Action Plan record */}
                              {actionPlans.filter(p => p.chatId === activeChat.id).slice(0, 1).map(plan => (
                                <div key={plan.id} className="space-y-3 pt-2">
                                  <div className="space-y-1.5">
                                    {plan.proposedActions.map((act, aIdx) => (
                                      <div key={aIdx} className="flex items-start gap-2 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100 font-semibold text-gray-800">
                                        <CheckCircle className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                                        <div>
                                          <span className="text-[10px] font-black uppercase text-indigo-700 block mb-0.5">
                                            {act.type.replace('_', ' ')}
                                          </span>
                                          {act.payload.title || JSON.stringify(act.payload)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-2 pt-2">
                                    {plan.status === 'draft' || plan.status === 'needs_approval' ? (
                                      <>
                                        <button
                                          onClick={() => handleApproveActionPlan(plan.id)}
                                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          Approve & Execute
                                        </button>
                                        <button
                                          onClick={() => handleRejectActionPlan(plan.id)}
                                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                        {plan.status === 'approved' && <span className="text-indigo-600">Approved & Queueing...</span>}
                                        {plan.status === 'applied' && <span className="text-emerald-600">✅ Applied successfully</span>}
                                        {plan.status === 'rejected' && <span className="text-red-500">❌ Plan Rejected</span>}
                                        {plan.status === 'failed' && <span className="text-red-600">⚠️ Failed during write verification</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CUSTOM CARD: MUTABLE DELIVERABLE WIDGET */}
                        {msg.linkedWidgetId && widgets.find(w => w.id === msg.linkedWidgetId) && (
                          (() => {
                            const widget = widgets.find(w => w.id === msg.linkedWidgetId)!;
                            const versions = widgetVersions[widget.id] || [];
                            const latestVersion = versions[0];
                            
                            // Trigger loading versions if not yet loaded
                            fetchWidgetVersions(widget.id);

                            if (!latestVersion) {
                              return <div className="text-xs text-gray-400 p-3 bg-white border border-gray-100 rounded-xl animate-pulse">Loading deliverable widget...</div>;
                            }

                            return (
                              <div className="max-w-2xl bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden mt-2">
                                <div className="p-4 bg-[#FAF9F6] border-b border-gray-150 flex items-center justify-between">
                                  <div>
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">{widget.title}</h4>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Created by {widget.createdByAgentId ? agents.find(a => a.id === widget.createdByAgentId)?.name : 'System'} • v{latestVersion.versionNumber}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => setExpandedWidget({ widget, version: latestVersion })}
                                      className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-black transition-colors"
                                      title="Open side-by-side details"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Widget Preview body */}
                                <div className="p-5 space-y-4 text-xs">
                                  {latestVersion.heroMetrics && latestVersion.heroMetrics.length > 0 && (
                                    <div className="grid grid-cols-3 gap-3">
                                      {latestVersion.heroMetrics.slice(0, 3).map((metric, mIdx) => (
                                        <div key={mIdx} className="bg-[#FAF9F6] p-3 rounded-2xl border border-gray-100/50">
                                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">{metric.label}</p>
                                          <p className="text-base font-black text-indigo-700 mt-1">{metric.value}</p>
                                          {metric.subtext && <p className="text-[9px] text-gray-400 font-semibold truncate mt-0.5">{metric.subtext}</p>}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="prose max-w-none text-gray-700 font-medium line-clamp-4 leading-relaxed whitespace-pre-line">
                                    {latestVersion.markdownBody || (latestVersion.jsonPayload ? JSON.stringify(latestVersion.jsonPayload, null, 2) : '')}
                                  </div>

                                  <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase">
                                    <span>Confidence Level: <strong className="text-emerald-600 font-extrabold">{latestVersion.jsonPayload.confidence || 'HIGH'}</strong></span>
                                    <button 
                                      onClick={() => setExpandedWidget({ widget, version: latestVersion })}
                                      className="text-indigo-600 hover:underline font-extrabold"
                                    >
                                      Read complete deliverable &rarr;
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* Thread triggers */}
                        <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setActiveThread(msg)}
                            className="flex items-center gap-1 hover:text-indigo-600"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Reply in Thread</span>
                          </button>
                          <button 
                            onClick={async () => {
                              // Save as a saved "Moment" (workbench bookmarks)
                              const momentRef = doc(collection(db, 'agent_templates'));
                              await setDoc(momentRef, {
                                id: momentRef.id,
                                workspaceId,
                                title: `Saved Moment from Chat`,
                                description: msg.content.substring(0, 150) + '...',
                                category: 'custom',
                                agentConfig: { systemPrompt: msg.content },
                                isSystemTemplate: false,
                                createdAt: Timestamp.now(),
                                updatedAt: Timestamp.now()
                              });
                              alert('Saved to workbench moments!');
                            }}
                            className="flex items-center gap-1 hover:text-purple-600"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Bookmark Moment</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </div>

            {/* MESSAGE COMPOSER */}
            <div className="p-4 border-t border-gray-200 bg-white shrink-0">
              <form onSubmit={(e) => handleSendMessage(e, false)} className="space-y-3">
                
                {/* Advanced contextual parameters */}
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  
                  {/* Link Workspace Project */}
                  <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-600 font-bold">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Project:</span>
                    <select 
                      value={selectedProjectId} 
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="bg-transparent font-extrabold outline-none text-indigo-700 max-w-[120px]"
                    >
                      <option value="">None linked</option>
                      {projectsList.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Attachment metadata links */}
                  <button 
                    type="button"
                    onClick={() => {
                      const url = prompt('Enter manual document/Google Drive link url:');
                      if (url) {
                        const title = prompt('Enter document title:', 'Research Spec');
                        setSelectedFileUrl(url);
                        setSelectedFileTitle(title || 'Research Spec');
                      }
                    }}
                    className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 font-bold transition-all ${
                      selectedFileUrl ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-[#FAF9F6] border-gray-200 text-gray-600'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-sky-500" />
                    <span>{selectedFileUrl ? selectedFileTitle : 'Link Document'}</span>
                  </button>

                  {/* Autocomplete active mentions helper */}
                  <div className="text-gray-400 ml-auto font-semibold">
                    Type <strong className="text-indigo-600 font-black">@AgentName</strong> to direct message
                  </div>
                </div>

                {/* Primary Composer Box */}
                <div className="relative border border-gray-250 hover:border-gray-350 focus-within:border-indigo-500 rounded-3xl overflow-hidden transition-all bg-white flex items-center">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      const lastWord = e.target.value.split(' ').pop();
                      if (lastWord && lastWord.startsWith('@')) {
                        setMentionSearch(lastWord.substring(1));
                        setShowMentionDropdown(true);
                      } else {
                        setShowMentionDropdown(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(undefined, false);
                      }
                    }}
                    placeholder={`Write a message inside ${activeChat.title}...`}
                    className="w-full text-xs font-semibold leading-relaxed bg-transparent border-none focus:outline-none py-4 px-6 no-scrollbar resize-none max-h-24 min-h-12"
                  />

                  {/* Mentions absolute floating dropdown */}
                  {showMentionDropdown && (
                    <div className="absolute bottom-16 left-6 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 w-56 max-h-48 overflow-y-auto">
                      <p className="text-[9px] font-black uppercase text-gray-400 mb-2 px-2.5 tracking-wider">Mention AI Agent</p>
                      {agents.filter(a => a.name.toLowerCase().includes(mentionSearch.toLowerCase())).map(agent => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => {
                            const words = inputMessage.split(' ');
                            words.pop(); // Remove the typed @
                            setInputMessage(words.join(' ') + ` @${agent.name} `);
                            setShowMentionDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-gray-50 rounded-xl flex items-center gap-2"
                        >
                          <span className="text-sm">{agent.avatarEmoji || '🤖'}</span>
                          <div>
                            <p className="text-gray-800">{agent.name}</p>
                            <p className="text-[9px] text-gray-400 truncate">{agent.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Send Action button */}
                  <button
                    type="submit"
                    disabled={isOrchestrating}
                    className="mr-3 p-3 bg-black hover:bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-2xl transition-all shadow-sm shrink-0 flex items-center justify-center"
                  >
                    {isOrchestrating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 1.4: CONTACTS & BESPOKE SQUADS DASHBOARD */}
        {activeTab === 'contacts' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 no-scrollbar">
            {selectedContactsSubTab === 'humans' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Human Contacts</h2>
                    <p className="text-xs text-gray-500 font-semibold mt-1">Connect with managers, project owners, and external clients in your workspace.</p>
                  </div>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Invite Contact
                  </button>
                </div>

                {contacts.length === 0 ? (
                  <div className="bg-white border border-gray-150 rounded-3xl p-8 text-center max-w-md mx-auto space-y-4">
                    <span className="text-4xl block">👥</span>
                    <h4 className="font-bold text-gray-900 text-sm">No Active Contacts Yet</h4>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                      Send a workspace invitation or accept incoming requests to start collaborating with human teammates.
                    </p>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Invite a Colleague
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contacts.map(c => (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-50 rounded-2xl border border-gray-150 flex items-center justify-center text-xl shrink-0 shadow-sm font-bold text-indigo-700">
                            {c.avatarUrl ? <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full rounded-2xl object-cover" /> : c.displayName[0]}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-gray-900">{c.displayName}</h4>
                            <p className="text-xs text-gray-500 font-semibold mt-0.5">{c.email}</p>
                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md mt-1.5 inline-block">
                              {c.status}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            handleCreateChat(undefined, {
                              title: `Chat with ${c.displayName}`,
                              type: 'dm',
                              selectedAgents: []
                            });
                          }}
                          className="px-3.5 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Chat Now
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedContactsSubTab === 'groups' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Bespoke Squads & Teams</h2>
                    <p className="text-xs text-gray-500 font-semibold mt-1">Spin up structured, multi-agent panels for dedicated strategic streams.</p>
                  </div>
                  <button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Assemble Custom Squad
                  </button>
                </div>

                {agentGroups.length === 0 ? (
                  <div className="bg-white border border-gray-150 rounded-3xl p-8 text-center max-w-md mx-auto space-y-4">
                    <span className="text-4xl block">🛡️</span>
                    <h4 className="font-bold text-gray-900 text-sm">No Bespoke Squads Assembled</h4>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                      Assemble custom agent teams with specialized knowledge profiles to handle multi-faceted workflows.
                    </p>
                    <button
                      onClick={() => setShowCreateGroupModal(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Assemble First Squad
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {agentGroups.map(group => (
                      <div key={group.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-[#FAF9F6] rounded-2xl border border-gray-150 flex items-center justify-center text-xl shrink-0 shadow-sm">
                              {group.avatarEmoji || '🛡️'}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-sm text-gray-900">{group.name}</h4>
                              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                                {group.groupType}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-4 leading-relaxed font-semibold">{group.description}</p>
                        </div>

                        <div className="border-t border-gray-100 pt-4 mt-6 flex gap-2">
                          <button
                            onClick={() => {
                              handleCreateChat(undefined, {
                                title: `${group.name} Board`,
                                type: 'group',
                                selectedAgents: []
                              });
                            }}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 border border-transparent rounded-xl text-[11px] font-bold text-white transition-all flex items-center gap-1.5 flex-1 justify-center"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Open Squad War Room
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedContactsSubTab === 'requests' && (
              <div className="space-y-8">
                {/* Incoming Contact Requests */}
                <div className="space-y-4">
                  <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Incoming Workspace Invites & Requests</h2>
                    <p className="text-xs text-gray-400 font-semibold mt-0.5">Teammates or external entities requesting entry to this agent ecosystem.</p>
                  </div>

                  {contactRequests.length === 0 ? (
                    <div className="bg-[#FAF9F6]/50 border border-gray-150 rounded-2xl p-6 text-center text-xs font-semibold text-gray-400">
                      No pending workspace contact requests.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contactRequests.map(req => (
                        <div key={req.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-gray-900">{req.displayName || req.toEmail}</span>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                req.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                req.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              }`}>
                                {req.status}
                              </span>
                            </div>
                            {req.message && <p className="text-xs text-gray-600 font-semibold leading-relaxed max-w-xl">{req.message}</p>}
                          </div>

                          {req.status === 'pending' && (
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handleAcceptRequest(req)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold"
                              >
                                Accept Request
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-bold"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outgoing Invites */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <div>
                      <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Active Workspace Invitation Links</h2>
                      <p className="text-xs text-gray-400 font-semibold mt-0.5">Secure, system-generated tokens to invite other operators or agents.</p>
                    </div>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New Link
                    </button>
                  </div>

                  {agentInvites.length === 0 ? (
                    <div className="bg-[#FAF9F6]/50 border border-gray-150 rounded-2xl p-6 text-center text-xs font-semibold text-gray-400">
                      No active invitation links created.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {agentInvites.map(invite => (
                        <div key={invite.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-gray-900">Invite Code: <span className="font-mono text-indigo-600">{invite.inviteToken}</span></p>
                            <p className="text-[10px] text-gray-400 font-semibold">Recipient: {invite.email || 'Any with link'} • Type: {invite.inviteType}</p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                              {invite.status}
                            </span>
                            <button
                              onClick={() => {
                                const mobUrl = buildMobileUrl(invite.inviteUrl);
                                navigator.clipboard.writeText(mobUrl);
                                alert('Mobile deep-link copied to clipboard!');
                              }}
                              className="p-1.5 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 hover:text-black"
                              title="Copy Mobile Deep Link"
                            >
                              <Smartphone className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(invite.inviteUrl);
                                alert('Invitation URL copied to clipboard!');
                              }}
                              className="p-1.5 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 hover:text-black"
                              title="Copy URL"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1.5: ACTIVE RESOURCE WORKSPACE (CANVAS & DOCUMENT WORKSPACE) */}
        {activeTab === 'resources' && activeResource && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 no-scrollbar">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">{activeResource.title}</h2>
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                    {activeResource.resourceType}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-semibold mt-1">
                  Created by {activeResource.createdBy === 'system' ? 'Workspace Orchestrator' : 'You'} • {activeResource.tags?.map(t => `#${t}`).join(' ')}
                </p>
              </div>

              {activeResource.resourceType === 'doc' && (
                <div className="flex gap-2 shrink-0">
                  {isEditingDoc ? (
                    <>
                      <button
                        onClick={() => handleUpdateResourceDoc(docEditorContent)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        Save Changes
                      </button>
                      <button
                        onClick={() => setIsEditingDoc(false)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setDocEditorContent(activeResource.markdownContent || '');
                        setIsEditingDoc(true);
                      }}
                      className="px-4 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-all flex items-center gap-1.5"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Document
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Content view depends on type */}
            {activeResource.resourceType === 'doc' ? (
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                {isEditingDoc ? (
                  <textarea
                    value={docEditorContent}
                    onChange={(e) => setDocEditorContent(e.target.value)}
                    className="w-full bg-gray-55 border border-gray-200 rounded-2xl p-4 font-semibold text-xs text-gray-800 leading-relaxed h-[450px] focus:outline-none focus:border-indigo-500 resize-none font-mono"
                    placeholder="Write markdown documentation..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none text-xs text-gray-700 font-medium leading-relaxed whitespace-pre-line">
                    {activeResource.markdownContent || 'No documentation content written.'}
                  </div>
                )}
              </div>
            ) : (
              /* Canvas View */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual canvas representation */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Metric counters */}
                  {activeResource.jsonCanvas?.metrics && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {activeResource.jsonCanvas.metrics.map((m: any, idx: number) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</p>
                          <p className="text-xl font-black text-indigo-700 mt-1">{m.value}</p>
                          {m.subtext && <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{m.subtext}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Canvas blocks (cards) */}
                  {activeResource.jsonCanvas?.blocks && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeResource.jsonCanvas.blocks.map((b: any) => (
                        <div key={b.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-2">
                          <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-wide">{b.title}</h4>
                          <p className="text-xs text-gray-600 font-medium leading-relaxed whitespace-pre-line">{b.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Agent Control Panel for Canvas */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm h-fit space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                      Agent Canvas Refinement
                    </h3>
                    <p className="text-[10px] text-gray-400 font-semibold">Ask Certo Work PM to modify, expand, or recalibrate this canvas strategy.</p>
                  </div>

                  <div className="space-y-3">
                    <textarea
                      value={canvasPromptInput}
                      onChange={(e) => setCanvasPromptInput(e.target.value)}
                      placeholder="e.g. Add a target audience block for Enterprise clients and adjust Q3 launch timeline."
                      className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl p-3 text-xs font-semibold text-gray-800 h-24 resize-none leading-relaxed"
                    />

                    {canvasError && (
                      <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2.5 rounded-xl border border-red-100">{canvasError}</p>
                    )}

                    <button
                      onClick={handleAskAgentModifyCanvas}
                      disabled={isModifyingCanvas}
                      className="w-full py-2.5 bg-black hover:bg-indigo-600 disabled:bg-gray-100 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      {isModifyingCanvas ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Regenerating Canvas...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Update Strategy Canvas
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AGENTS REGISTRY & DIRECTORY */}
        {activeTab === 'agents' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 no-scrollbar">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">AI Operating Agents</h2>
                <p className="text-xs text-gray-500 font-semibold mt-1">Configure system and bespoke agents participating inside group chats.</p>
              </div>
              <button
                onClick={() => setShowNewAgentModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0"
              >
                <Plus className="w-4 h-4" />
                Bespoke Agent Builder
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map(agent => (
                <div key={agent.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gray-50 rounded-2xl border border-gray-150 flex items-center justify-center text-2xl shrink-0 shadow-sm">
                        {agent.avatarEmoji || '🤖'}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-900">{agent.name}</h4>
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                          {(agent.agentType || 'custom').replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-4 leading-relaxed font-semibold">{agent.description}</p>
                    
                    <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-3 mt-4 text-[11px] space-y-1.5 font-semibold text-gray-500">
                      <div className="flex justify-between">
                        <span>Model Provider:</span>
                        <span className="text-gray-800 uppercase text-[10px]">{agent.modelProvider}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reference LLM:</span>
                        <span className="text-gray-800 font-mono text-[10px]">{agent.modelName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Permissions Profile:</span>
                        <span className="text-indigo-600 uppercase text-[10px]">{agent.permissionsProfile.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 mt-6 flex gap-2">
                    <button 
                      onClick={() => {
                        const title = prompt('Add to chat title:', `Collaborate with ${agent.name}`);
                        if (title) {
                          handleCreateChat(undefined, {
                            title,
                            type: 'agent_room',
                            selectedAgents: [agent.id]
                          });
                        }
                      }}
                      className="px-3 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 transition-all flex items-center gap-1.5 flex-1 justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to Chat Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: WORKBENCH / TEAM TEMPLATES */}
        {activeTab === 'workbench' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 no-scrollbar">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">AI Squad Deployments</h2>
              <p className="text-xs text-gray-500 font-semibold mt-1">Spin up pre-configured teams of specialized AI Agents to tackle strategic milestones.</p>
            </div>

            <div className="space-y-6">
              {TEAM_TEMPLATES.map((template) => (
                <div key={template.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center hover:shadow-md transition-shadow">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-gray-900">{template.title}</h4>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md">
                        {template.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed font-semibold">{template.description}</p>
                    
                    {/* Visual squad line up */}
                    <div className="flex items-center gap-2.5 pt-2">
                      <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Lineup:</span>
                      <div className="flex items-center gap-1.5">
                        {template.agents.map((slug, idx) => {
                          const agent = agents.find(a => a.slug === slug);
                          return (
                            <span 
                              key={idx} 
                              className="text-xs px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg font-bold text-gray-700"
                              title={agent?.name || slug}
                            >
                              {agent?.avatarEmoji || '🤖'} {agent?.name || slug}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeployTeamTemplate(template)}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0 w-full md:w-auto justify-center"
                  >
                    <Plus className="w-4 h-4" />
                    Deploy Squad
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: MUTABLE DELIVERABLES LIST (WIDGETS) */}
        {activeTab === 'widgets' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 no-scrollbar">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Bespoke Workspace Deliverables</h2>
              <p className="text-xs text-gray-500 font-semibold mt-1">Browse, read, and audit all live generated interactive assets and document briefs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {widgets.map(widget => {
                const versions = widgetVersions[widget.id] || [];
                const latest = versions[0];
                fetchWidgetVersions(widget.id);

                return (
                  <div key={widget.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-sm text-gray-900">{widget.title}</h4>
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md mt-1.5 inline-block">
                            {widget.widgetType}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                          v{latest?.versionNumber || 1}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 font-semibold leading-relaxed mt-4 line-clamp-3">
                        {latest?.markdownBody || 'Deliverable document active in database. Press review below to open side-by-side details.'}
                      </p>
                    </div>

                    <div className="border-t border-gray-100 pt-4 mt-6 flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 font-semibold">
                        Versions available: {versions.length}
                      </span>
                      <button
                        onClick={() => latest && setExpandedWidget({ widget, version: latest })}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Review Deliverable
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: FILES LIST */}
        {activeTab === 'files' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 no-scrollbar">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Linked Documents Directory</h2>
              <p className="text-xs text-gray-500 font-semibold mt-1">Audit active manual URLs, attachments, and Google Drive directories associated with chats.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {files.map(file => (
                <div key={file.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-50 rounded-xl border border-sky-100 flex items-center justify-center text-sky-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-gray-900">{file.title}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{file.fileType.replace(/_/g, ' ')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                      Analysis: Metadata Only
                    </span>
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: HISTORY, AUDIT LOGS, RUNS */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-8 no-scrollbar">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Agent Run Audits & Proposed Plans</h2>
              <p className="text-xs text-gray-500 font-semibold mt-1">Verify execution pathways, token costs, model responses, and active plans awaiting review.</p>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Proposed Database Action Plans</h3>
                <div className="space-y-4">
                  {actionPlans.map(plan => (
                    <div key={plan.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-xs text-gray-900">{plan.title}</h4>
                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Proposed by: {agents.find(a => a.id === plan.proposedByAgentId)?.name || 'Agent'}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          plan.status === 'applied' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          plan.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {plan.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-semibold">{plan.summary}</p>
                      
                      <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100/50 space-y-1.5 text-xs font-semibold">
                        {plan.proposedActions.map((act, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-gray-700">
                            <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{act.type.replace('_', ' ')}: {act.payload.title || JSON.stringify(act.payload)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Live Agent Runs Audit Trail</h3>
                <div className="space-y-3 bg-white border border-gray-200 rounded-3xl p-4 divide-y divide-gray-100 shadow-sm max-h-96 overflow-y-auto">
                  {agentRuns.map(run => (
                    <div key={run.id} className="pt-3 pb-3 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">⚙️</span>
                        <div>
                          <p className="font-bold text-gray-900">
                            Run: {run.runType.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] text-gray-400 font-semibold">
                            Agent: {agents.find(a => a.id === run.agentId)?.name || run.agentId} • {run.modelName}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                          run.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                          run.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {run.status}
                        </span>
                        {run.error && (
                          <p className="text-[9px] text-red-500 font-bold mt-1 max-w-[150px] truncate">{run.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SPLIT-SCREEN OR EXPANDED INTERACTIVE DETAIL VIEW */}
      <AnimatePresence>
        
        {/* PANEL A: SPLIT SCREEN WIDGET FULL TAB VIEW */}
        {expandedWidget && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="w-full md:w-[480px] lg:w-[560px] border-l border-gray-200 bg-white flex flex-col h-full shrink-0 z-40 relative shadow-2xl"
          >
            
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#FAF9F6]">
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">{expandedWidget.widget.title}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Version History • v{expandedWidget.version.versionNumber}</p>
              </div>
              <button 
                onClick={() => { setExpandedWidget(null); }}
                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content with metric visualizers */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              
              {expandedWidget.version.heroMetrics && expandedWidget.version.heroMetrics.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {expandedWidget.version.heroMetrics.map((metric, idx) => (
                    <div key={idx} className="bg-[#FAF9F6] p-4 rounded-3xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{metric.label}</p>
                      <p className="text-lg font-black text-indigo-700 mt-1">{metric.value}</p>
                      {metric.subtext && <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{metric.subtext}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs list inside widget */}
              {expandedWidget.version.jsonPayload?.navigation_tabs && (
                <div className="space-y-4">
                  <div className="flex gap-2 border-b border-gray-150 pb-2 overflow-x-auto no-scrollbar">
                    {expandedWidget.version.jsonPayload.navigation_tabs.map((tab) => (
                      <span key={tab.tab_id} className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50/50 px-2.5 py-1 rounded-lg">
                        {tab.tab_title}
                      </span>
                    ))}
                  </div>
                  
                  <div className="space-y-4">
                    {expandedWidget.version.jsonPayload.navigation_tabs.map((tab) => (
                      <div key={tab.tab_id} className="bg-gray-55 border border-gray-100 rounded-2xl p-4">
                        <h5 className="font-extrabold text-xs text-gray-900 mb-2 uppercase tracking-wide">{tab.tab_title}</h5>
                        <p className="text-xs text-gray-700 font-medium leading-relaxed whitespace-pre-line">{tab.markdown_body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* General Body */}
              {!expandedWidget.version.jsonPayload?.navigation_tabs && (
                <div className="bg-[#FAF9F6] p-5 rounded-3xl border border-gray-100/50 text-xs text-gray-700 font-medium leading-relaxed whitespace-pre-line">
                  {expandedWidget.version.markdownBody || JSON.stringify(expandedWidget.version.jsonPayload, null, 2)}
                </div>
              )}

              {/* Confidence summary & actions */}
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-3xl space-y-2 text-xs">
                <p className="font-extrabold text-indigo-900 uppercase text-[10px] tracking-wider">Source Grounding Confidence</p>
                <p className="text-indigo-800 font-semibold">{expandedWidget.version.jsonPayload.source_summary || 'Data synthesized with highest context parity.'}</p>
                {expandedWidget.version.jsonPayload.open_questions && expandedWidget.version.jsonPayload.open_questions.length > 0 && (
                  <div className="pt-2">
                    <p className="font-black text-[9px] text-indigo-700 uppercase tracking-widest mb-1">Open Questions Identified:</p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-600 font-semibold">
                      {expandedWidget.version.jsonPayload.open_questions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Version Comparator */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Prior Versions available</h4>
                <div className="space-y-2">
                  {(widgetVersions[expandedWidget.widget.id] || []).map(ver => (
                    <button
                      key={ver.id}
                      onClick={() => setExpandedWidget({ widget: expandedWidget.widget, version: ver })}
                      className="w-full text-left p-3 border border-gray-150 rounded-2xl text-xs font-semibold hover:bg-gray-50 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-gray-800 font-bold">Version {ver.versionNumber} ({ver.versionTag})</p>
                        <p className="text-[10px] text-gray-400">Created {new Date(ver.createdAt?.toDate ? ver.createdAt.toDate() : Date.now()).toLocaleDateString()}</p>
                      </div>
                      <span className="text-xs text-indigo-600 font-black">Open &rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* PANEL B: THREAD REPLY PANEL */}
        {activeThread && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="w-full md:w-[420px] lg:w-[480px] border-l border-gray-200 bg-white flex flex-col h-full shrink-0 z-40 relative shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Thread Reply</h3>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5 truncate max-w-[250px]">Parent: {activeThread.content}</p>
              </div>
              <button 
                onClick={() => setActiveThread(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thread messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              
              {/* Parent Message Card */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Parent Discussion</p>
                <p className="text-xs text-gray-800 font-semibold">{activeThread.content}</p>
              </div>

              {threadMessages.map(msg => (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100 text-sm">
                    {msg.senderType === 'agent' ? agents.find(a => a.id === msg.senderAgentId)?.avatarEmoji || '🤖' : '👤'}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-xs text-gray-900">
                        {msg.senderType === 'agent' ? agents.find(a => a.id === msg.senderAgentId)?.name : userDisplayName}
                      </span>
                      <span className="text-[9px] text-gray-400">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-800 font-medium leading-relaxed bg-white border border-gray-100 rounded-2xl p-2.5 mt-1 shadow-inner">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>

            {/* Input Composer for Thread */}
            <div className="p-3 border-t border-gray-200 bg-white shrink-0">
              <form onSubmit={(e) => handleSendMessage(e, true)} className="flex items-center gap-2">
                <input
                  type="text"
                  value={threadInputMessage}
                  onChange={(e) => setThreadInputMessage(e.target.value)}
                  placeholder="Reply in thread..."
                  className="flex-1 bg-[#FAF9F6] border border-gray-200 hover:border-gray-300 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-2 text-xs font-semibold"
                />
                <button
                  type="submit"
                  disabled={isOrchestrating}
                  className="p-2.5 bg-black text-white hover:bg-indigo-600 disabled:bg-gray-200 rounded-xl transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW CHAT CREATION MODAL */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Create War Room</h3>
              <button onClick={() => setShowNewChatModal(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChat} className="space-y-4 text-xs font-bold text-gray-600">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">Title / Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Strategic MVP"
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">Description (Optional)</label>
                <textarea
                  placeholder="Describe the scope, constraints, and priorities of this room."
                  value={newChatDesc}
                  onChange={(e) => setNewChatDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider block">Room Type</label>
                  <select
                    value={newChatType}
                    onChange={(e) => setNewChatType(e.target.value as ChatType)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  >
                    <option value="group">Group Channel</option>
                    <option value="dm">Direct Message</option>
                    <option value="project_room">Project Room</option>
                    <option value="agent_room">Agent Sandbox</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider block">Workspace Project Link</label>
                  <select
                    value={newChatProjectId}
                    onChange={(e) => setNewChatProjectId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  >
                    <option value="">None linked</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 bg-rose-50/50 border border-rose-100 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  id="newChatIsPrivate"
                  checked={newChatIsPrivate}
                  onChange={(e) => setNewChatIsPrivate(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <label htmlFor="newChatIsPrivate" className="text-xs text-rose-900 font-extrabold cursor-pointer select-none">
                  🔒 Make this room Private (only invited participants can join)
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-wider block">Assign AI squad members</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                  {agents.map(agent => (
                    <label 
                      key={agent.id} 
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer font-bold ${
                        newChatSelectedAgents.includes(agent.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newChatSelectedAgents.includes(agent.id)}
                        onChange={() => {
                          if (newChatSelectedAgents.includes(agent.id)) {
                            setNewChatSelectedAgents(prev => prev.filter(id => id !== agent.id));
                          } else {
                            setNewChatSelectedAgents(prev => [...prev, agent.id]);
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{agent.avatarEmoji || '🤖'} {agent.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="submit"
                  className="px-5 py-3 bg-black hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex-1 text-center"
                >
                  Initiate War Room
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* NEW AGENT BUILDER MODAL */}
      {showNewAgentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-xl w-full space-y-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Bespoke Agent Builder</h3>
              <button onClick={() => setShowNewAgentModal(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-4 text-xs font-bold text-gray-600">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] uppercase font-black tracking-wider block">Agent Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FinOps Auditor"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider block">Avatar Emoji</label>
                  <input
                    type="text"
                    required
                    placeholder="🤖"
                    value={newAgentEmoji}
                    onChange={(e) => setNewAgentEmoji(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800 text-center text-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider block">Role Category</label>
                  <select
                    value={newAgentType}
                    onChange={(e) => setNewAgentType(e.target.value as AgentType)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  >
                    <option value="custom">Bespoke Custom</option>
                    <option value="general">General Support</option>
                    <option value="product_manager">Product Scoping</option>
                    <option value="designer">Interface Designer</option>
                    <option value="engineer">Lead Engineer</option>
                    <option value="researcher">Market Research</option>
                    <option value="reviewer">Auditor / QC</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider block">LLM Model</label>
                  <select
                    value={newAgentModel}
                    onChange={(e) => setNewAgentModel(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  >
                    <option value="gpt-5.6-sol">OpenAI GPT-5.6 Sol (Default)</option>
                    <option value="gpt-5.6-terra">OpenAI GPT-5.6 Terra (Balanced)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">Description / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Audits campaign budgets and estimates performance metrics."
                  value={newAgentDesc}
                  onChange={(e) => setNewAgentDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">System instructions / Prompt</label>
                <textarea
                  required
                  placeholder="Define your agent's persona, expertise, default output format, and constraints..."
                  value={newAgentPrompt}
                  onChange={(e) => setNewAgentPrompt(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800 h-28 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider block">Permissions Profile</label>
                  <select
                    value={newAgentPermissions}
                    onChange={(e) => setNewAgentPermissions(e.target.value as BoldiAgent['permissionsProfile'])}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  >
                    <option value="can_create_drafts">Draft Proposer</option>
                    <option value="can_create_review_candidates">Review Submitter</option>
                    <option value="can_execute_with_approval">Executable with approval</option>
                    <option value="tell_me_only">No DB interactions</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider block">Memory Policy</label>
                  <select
                    value={newAgentMemory}
                    onChange={(e) => setNewAgentMemory(e.target.value as BoldiAgent['memoryPolicy'])}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  >
                    <option value="chat_only">Active conversation context only</option>
                    <option value="project_context">Linked project context</option>
                    <option value="none">No memory (stateless)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="submit"
                  className="px-5 py-3 bg-black hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex-1 text-center"
                >
                  Assemble Bespoke Agent
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewAgentModal(false)}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* NEW BESPOKE SQUAD CREATION MODAL */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Assemble Bespoke Squad</h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { handleCreateGroup(e); setShowCreateGroupModal(false); }} className="space-y-4 text-xs font-bold text-gray-600">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">Squad Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operations Command"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">Description / Purpose</label>
                <textarea
                  placeholder="Describe what tactical objectives this bespoke agent squad will handle."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800 h-20 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-wider block">Select participating AI agents</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                  {agents.map(agent => (
                    <label 
                      key={agent.id} 
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer font-bold ${
                        newGroupSelectedMembers.includes(agent.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newGroupSelectedMembers.includes(agent.id)}
                        onChange={() => {
                          if (newGroupSelectedMembers.includes(agent.id)) {
                            setNewGroupSelectedMembers(prev => prev.filter(id => id !== agent.id));
                          } else {
                            setNewGroupSelectedMembers(prev => [...prev, agent.id]);
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{agent.avatarEmoji || '🤖'} {agent.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="submit"
                  className="px-5 py-3 bg-black hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex-1 text-center"
                >
                  Assemble Squad
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* NEW CONTACT INVITATION MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Invite Teammate</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { handleCreateInvite(e); setShowInviteModal(false); }} className="space-y-4 text-xs font-bold text-gray-600">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">Teammate Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                />
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="submit"
                  className="px-5 py-3 bg-black hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex-1 text-center"
                >
                  Generate Invite Link
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MANAGE CHAT ROOM MODAL (EDIT, ARCHIVE, REMOVE) */}
      {showManageChatModal && activeChat && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Manage Room Settings</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Room ID: {activeChat.id}</p>
              </div>
              <button onClick={() => setShowManageChatModal(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateChat(activeChat.id, manageChatTitle, manageChatDesc, manageChatType, manageChatIsPrivate);
            }} className="space-y-4 text-xs font-bold text-gray-600">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">Room Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance Audits"
                  value={manageChatTitle}
                  onChange={(e) => setManageChatTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-wider block">Description</label>
                <textarea
                  placeholder="Describe the goals and priorities for this room."
                  value={manageChatDesc}
                  onChange={(e) => setManageChatDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider block">Room Type</label>
                  <select
                    value={manageChatType}
                    onChange={(e) => setManageChatType(e.target.value as ChatType)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  >
                    <option value="group">Group Channel</option>
                    <option value="dm">Direct Message</option>
                    <option value="project_room">Project Room</option>
                    <option value="agent_room">Agent Sandbox</option>
                  </select>
                </div>

                <div className="space-y-1 flex items-end">
                  <label className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer w-full select-none">
                    <input
                      type="checkbox"
                      checked={manageChatIsPrivate}
                      onChange={(e) => setManageChatIsPrivate(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-xs text-gray-800 font-extrabold">🔒 Private Room</span>
                  </label>
                </div>
              </div>

              {/* Advanced Actions Row: Archive & Delete */}
              <div className="pt-2 pb-2 border-t border-b border-gray-100 space-y-2">
                <p className="text-[10px] uppercase font-black tracking-wider text-gray-400">Danger Zone / Advanced Actions</p>
                <div className="flex gap-2">
                  {activeChat.status === 'archived' ? (
                    <button
                      type="button"
                      onClick={() => handleUnarchiveChat(activeChat.id)}
                      className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Restore Room
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleArchiveChat(activeChat.id)}
                      className="flex-1 py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-black transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archive Room
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteChat(activeChat.id)}
                    className="flex-1 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Room
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="px-5 py-3 bg-black hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex-1 text-center"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowManageChatModal(false)}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ADD MEMBER TO CHAT MODAL */}
      {showAddMemberModal && activeChat && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Add Teammate</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Invite to #{activeChat.title}</p>
              </div>
              <button onClick={() => setShowAddMemberModal(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                Add existing team members of your workspace to this room, or invite a new collaborator below.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider block text-gray-400">Teammates List</label>
                <div className="max-h-60 overflow-y-auto space-y-1.5 p-1 bg-gray-50 rounded-2xl border border-gray-100">
                  {contacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 font-semibold">
                      No team members found in this workspace.
                    </div>
                  ) : (
                    contacts.map(contact => {
                      const isAlreadyIn = participants.some(p => p.userId === contact.userId || p.userId === contact.id);
                      return (
                        <div 
                          key={contact.id} 
                          className="flex items-center justify-between p-2.5 bg-white border border-gray-150 rounded-xl shadow-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-extrabold text-xs">
                              {contact.displayName.charAt(0).toUpperCase()}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-gray-800">{contact.displayName}</span>
                              <span className="text-[9px] text-gray-400 font-semibold">{contact.email}</span>
                            </div>
                          </div>
                          {isAlreadyIn ? (
                            <span className="text-[10px] font-black uppercase text-gray-400 px-2 py-1 bg-gray-50 rounded-lg">Already In</span>
                          ) : (
                            <button
                              onClick={() => handleAddParticipant(contact)}
                              className="text-xs font-black uppercase tracking-wider bg-black hover:bg-indigo-600 text-white px-3 py-1.5 rounded-xl transition-all shadow-sm"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Collaborator not listed?</span>
                <button
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setShowInviteModal(true);
                  }}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  Invite via Link
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold transition-all text-center"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* DEPLOY SQUAD CONFIGURATION MODAL */}
      {showDeploySquadModal && selectedSquadTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Deploy Squad Blueprint</h3>
                <p className="text-[10px] text-indigo-600 font-black uppercase mt-0.5">{selectedSquadTemplate.title} Squad</p>
              </div>
              <button onClick={() => { setShowDeploySquadModal(false); setSelectedSquadTemplate(null); }} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-bold text-gray-600">
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-1">
                <p className="text-xs text-indigo-950 font-black">{selectedSquadTemplate.title}</p>
                <p className="text-xs text-gray-500 font-semibold">{selectedSquadTemplate.description}</p>
                <div className="pt-2 flex flex-wrap gap-1.5">
                  {selectedSquadTemplate.agents.map(slug => {
                    const matchedAgent = agents.find(a => a.slug === slug);
                    return (
                      <span key={slug} className="text-[10px] font-bold bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                        {matchedAgent?.avatarEmoji || '🤖'} {matchedAgent?.name || slug}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Destination selector */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-wider block text-gray-400">Deploy Destination</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 ${
                    deploySquadDestination === 'new' ? 'bg-indigo-50 border-indigo-300 text-indigo-950' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="deployDest" 
                        checked={deploySquadDestination === 'new'} 
                        onChange={() => setDeploySquadDestination('new')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-black">Create New Room</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold pl-5">Assembles team inside a brand new chat channel</span>
                  </label>

                  <label className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 ${
                    deploySquadDestination === 'existing' ? 'bg-indigo-50 border-indigo-300 text-indigo-950' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="deployDest" 
                        checked={deploySquadDestination === 'existing'} 
                        onChange={() => setDeploySquadDestination('existing')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-black">Deploy to Existing Room</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold pl-5">Adds the squad agents as participants to an active room</span>
                  </label>
                </div>
              </div>

              {deploySquadDestination === 'new' ? (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[10px] uppercase font-black tracking-wider block text-gray-400">New Channel Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q3 Growth Strategy"
                    value={deploySquadNewChannelTitle}
                    onChange={(e) => setDeploySquadNewChannelTitle(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  />
                </div>
              ) : (
                <div className="space-y-1 animate-fade-in">
                  <label className="text-[10px] uppercase font-black tracking-wider block text-gray-400">Select Target Chat Room</label>
                  <select
                    value={deploySquadSelectedChatId}
                    onChange={(e) => setDeploySquadSelectedChatId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:outline-none focus:border-indigo-500 rounded-xl px-4 py-3 font-semibold text-gray-800"
                  >
                    {chats.length === 0 ? (
                      <option value="">No active chat channels available</option>
                    ) : (
                      chats.map(chat => (
                        <option key={chat.id} value={chat.id}>
                          {chat.type === 'group' ? '#' : chat.type === 'project_room' ? '💼' : chat.type === 'agent_room' ? '🤖' : '💬'} {chat.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={executeDeployTeamTemplate}
                  className="px-5 py-3 bg-black hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex-1 text-center"
                >
                  Deploy Squad
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeploySquadModal(false); setSelectedSquadTemplate(null); }}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* TS Unused Locals Warnings Bypass */}
      {(() => {
        const _ = [
          FileCode, Trash2, Edit, UserCheck, UserX, Copy, Search,
          agentMoments, agentInvites, selectedChatType, selectedExploreSubTab, setSelectedExploreSubTab,
          selectedResourcesSubTab, setSelectedResourcesSubTab, activeMoment, setActiveMoment,
          activeAgentProfile, setActiveAgentProfile, showCreateGroupModal, showInviteModal, showMobileModal,
          showAttachResourceModal, setShowAttachResourceModal, setNewGroupType, newResourceTitle, setNewResourceTitle,
          newResourceType, setNewResourceType, isModifyingCanvas, canvasError, isEditingDoc, docEditorContent, setDocEditorContent,
          setInviteType, showSlashCommandDropdown, setShowSlashCommandDropdown,
          handleAcceptRequest, handleRejectRequest, handleCreateGroup, handleUpdateResourceDoc, handleAskAgentModifyCanvas,
          handleCreateInvite, activeRuns
        ];
        const __: AgentGroupMember | null = null;
        const ___: AgentWorkbenchTemplate | null = null;
        if (_ && __ && ___) return null;
        return null;
      })()}

    </div>
  );
}
