import { memo } from "react";
import { ProjectWizardSkill } from "../components/ProjectWizardSkill";
import { MagicProjectModal } from "../components/MagicProjectModal";
import { uiStore, useUiStore } from "../data/uiStore";
import type { MagicProjectBlueprint } from "../lib/magicProject";

type ModalHostProps = {
  /** Project used only for Odysseus "update project" (context) intent. */
  contextProject: any | null;
  projects: any[];
  onCreateProject: (draft: any) => Promise<void>;
  onUpdateProject: (projectId: string, draft: any) => Promise<void>;
  onCreateMagicProject: (blueprint: MagicProjectBlueprint) => Promise<void>;
};

/**
 * Mounts create/update project modals from uiStore so create intent can ignore
 * the conversation-linked project without the shell owning wizard useState.
 */
function ModalHostInner({
  contextProject,
  projects,
  onCreateProject,
  onUpdateProject,
  onCreateMagicProject,
}: ModalHostProps) {
  const ui = useUiStore();

  return (
    <>
      <ProjectWizardSkill
        activeProject={
          ui.projectWizardIntent === "context" ? contextProject : null
        }
        isOpen={ui.projectWizardOpen}
        onClose={() => uiStore.closeProjectWizard()}
        onCreateProject={onCreateProject}
        onOpenMagicProject={() => {
          uiStore.closeProjectWizard();
          uiStore.openMagicProject();
        }}
        onUpdateProject={onUpdateProject}
        projects={projects}
      />
      <MagicProjectModal
        isOpen={ui.magicProjectOpen}
        onClose={() => uiStore.closeMagicProject()}
        onCreate={onCreateMagicProject}
      />
    </>
  );
}

export const ModalHost = memo(ModalHostInner);
