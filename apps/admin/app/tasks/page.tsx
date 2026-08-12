import Link from "next/link";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { can } from "@talentos/auth";
import {
  getTenantBySlug,
  listProgramTasks,
  listTenantMissions,
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
  searchParams: Promise<{ programId?: string; missionId?: string }>;
};

// Top-level Tasks workspace (v0.20.0): a sidebar shortcut for organizers to add/manage the weekly
// tasks (and their learning resources) that drive the applicant mission workspace, without digging
// into a specific program's Content page. Reuses the existing program-content data + actions.
export default async function AdminTasksPage({ searchParams }: TasksPageProps) {
  const { programId, missionId } = await searchParams;
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

  // Tasks belong to a mission (v0.20.0), so the admin picks program → mission before authoring.
  const missions = selectedProgram && tenant
    ? await listTenantMissions(tenant.id, { programId: selectedProgram.id })
    : [];
  const selectedMission = missionId ? missions.find((mission) => mission.id === missionId) ?? null : null;

  const [tasks, resources] = selectedMission && selectedProgram && tenant
    ? await Promise.all([
        listProgramTasks(tenant.id, selectedProgram.id, selectedMission.id),
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

              {/* Mission selector — tasks are authored per mission, so one must be chosen first. */}
              <div className="mt-6">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="missionId">
                  Mission
                </label>
                {missions.length === 0 ? (
                  <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    This program has no missions yet. Create a mission first — tasks are added under a
                    specific mission.
                  </p>
                ) : (
                  <form method="get" className="mt-2 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="programId" value={selectedProgram.id} />
                    <select
                      id="missionId"
                      name="missionId"
                      defaultValue={selectedMission?.id ?? ""}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select a mission…</option>
                      {missions.map((mission) => (
                        <option key={mission.id} value={mission.id}>
                          Week {mission.weekNumber} — {mission.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white"
                    >
                      Load tasks
                    </button>
                  </form>
                )}
              </div>

              {selectedMission ? (
                <div className="mt-4 grid gap-10">
                  <ProgramTaskEditor
                    programId={selectedProgram.id}
                    missionId={selectedMission.id}
                    missionTitle={`Week ${selectedMission.weekNumber} — ${selectedMission.title}`}
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
              ) : missions.length > 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                  Select a mission above to add or update its tasks.
                </p>
              ) : null}
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
