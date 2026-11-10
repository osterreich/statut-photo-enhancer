import packageJson from "@/package.json";

function getShortCommit(): string {
  const commit = process.env.AWS_COMMIT_ID?.trim();

  return commit ? commit.slice(0, 7) : "local";
}

function getBranch(): string {
  return process.env.AWS_BRANCH?.trim() || "local";
}

export function getBuildInfo() {
  const version = packageJson.version;
  const commit = getShortCommit();
  const branch = getBranch();

  return {
    branch,
    commit,
    label: `v${version} · ${branch} · ${commit}`,
    version,
  };
}
