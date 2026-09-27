export const APPKIT_PREAMBLE = "ObjC.import('AppKit');";

export const RUNNING_APPS = "$.NSWorkspace.sharedWorkspace.runningApplications";

export function buildAppMatcherScript(body: string): string {
  const bodyIndented = body
    .trim()
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  return `${APPKIT_PREAMBLE}
function run(argv) {
  const apps = ${RUNNING_APPS};
  for (let i = 0; i < apps.count; i++) {
    const app = apps.objectAtIndex(i);
${bodyIndented}
  }
  return 'false';
}`;
}
