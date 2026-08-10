import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { can } from "@talentos/auth";
import {
  getTenantBySlug,
  listProgramTasks,
  listTenantPrograms,
  listVideoResources
} from "@talentos/db";
import { ProgramTaskEditor } from "@/components/ProgramTaskEditor";
import { ProgramPicker } from "@/components/ProgramPicker";
import {
  createProgramTaskAction,
  createVideoResourceAction,
  deleteProgramTaskAction,
  deleteVideoResourceAction,
  updateProgramTaskAction,
  updateVideoResourceAction
} from "../programs/[id]/content/actions";

type TasksPageProps = {
  searchParams: Promise<{ programId?: string }>;
};

// Top-level Tasks workspace (v0.20.0): a sidebar shortcut for organizers to add/manage the weekly
// tasks (and their learning resources) that drive the applicant mission workspace, without digging
// into a specific program's Content page. Reuses the existing program-content data + actions.
export default async function AdminTasksPage({ searchParams }: TasksPageProps) {
  const { programId } = await searchParams;
  const session = await auth();
  const canManage = can("manageProgramContent", {
    platformRole: session?.user?.platformRole ?? null,
    orgRole: session?.user?.orgRole ?? null
  });

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  const programs = tenant ? await listTenantPrograms(tenant.id) : [];

  if (!canManage) {
    return (
      <>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Your role can view program content on the applicant portal but cannot manage tasks.
        </p>
      </>
    );
  }

  // Require an explicit selection (search/pick) rather than defaulting to the first program.
  const selectedProgram = programId ? programs.find((program) => program.id === programId) ?? null : null;

  const [tasks, resources] = selectedProgram && tenant
    ? await Promise.all([
        listProgramTasks(tenant.id, selectedProgram.id),
        listVideoResources(tenant.id, selectedProgram.id)
      ])
    : [[], []];

  return (
    <>
      <h1 className="text-3xl font-bold">Tasks</h1>
      <p className="mt-2 text-sm text-slate-600">
        Add and manage weekly learning tasks and their resources for a program. Required tasks gate
        mission submission in the applicant Mission Workspace. All changes are audited.
      </p>

      {programs.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No programs yet. Create a program first, then add its tasks here.
        </p>
      ) : (
        <>
          {/* Program selector — search or pick */}
          <div className="mt-6">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</label>
            <div className="mt-2">
              <ProgramPicker
                programs={programs.map((program) => ({ id: program.id, name: program.name, slug: program.slug }))}
                selectedId={selectedProgram?.id ?? null}
              />
            </div>
          </div>

          {selectedProgram ? (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-800">{selectedProgram.name}</h2>
                <Link
                  href={`/programs/${selectedProgram.id}/content`}
                  className="text-sm font-medium text-brand-blue hover:underline"
                >
                  Full program content (calendar, etc.) →
                </Link>
              </div>

              <div className="mt-4 grid gap-10">
                <ProgramTaskEditor
                  programId={selectedProgram.id}
                  tasks={tasks}
                  resources={resources}
                  actions={{
                    createTask: createProgramTaskAction,
                    updateTask: updateProgramTaskAction,
                    deleteTask: deleteProgramTaskAction,
                    createResource: createVideoResourceAction,
                    updateResource: updateVideoResourceAction,
                    deleteResource: deleteVideoResourceAction
                  }}
                />
              </div>
            </>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Select a program above to add or update its tasks and resources.
            </p>
          )}
        </>
      )}
    </>
  );
}
