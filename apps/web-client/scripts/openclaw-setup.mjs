#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import JSON5 from "json5";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(scriptDir, "../../..");
const skillDir = path.join(repoRoot, "skills");
const openClawHome = process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
const configPath = path.join(openClawHome, "openclaw.json");
const baseUrl = (process.env.AIHIRE_BASE_URL || "http://localhost:3002").replace(
  /\/$/,
  "",
);

function usage() {
  process.stdout.write(
    [
      "Usage:",
      "  node apps/web-client/scripts/openclaw-setup.mjs",
      "  node apps/web-client/scripts/openclaw-setup.mjs --write",
      "",
      "Options:",
      "  --write     Write or update ~/.openclaw/openclaw.json",
      "  --json      Print merged config JSON only",
      "  --help      Show this help",
      "",
      `AIHIRE_BASE_URL defaults to ${baseUrl}`,
      `OPENCLAW_HOME defaults to ${openClawHome}`,
    ].join("\n"),
  );
  process.stdout.write("\n");
}

function commandExists(command) {
  try {
    execFileSync("which", [command], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getOpenClawVersion() {
  try {
    return execFileSync("openclaw", ["--version"], {
      stdio: "pipe",
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function readExistingConfig() {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, "utf8");
  return JSON5.parse(raw);
}

function buildSkillConfig() {
  return {
    skills: {
      load: {
        extraDirs: [skillDir],
      },
      entries: {
        "aihire-social-screen": {
          enabled: true,
          env: {
            AIHIRE_BASE_URL: baseUrl,
          },
        },
        "aihire-recruiter-workflows": {
          enabled: true,
          env: {
            AIHIRE_BASE_URL: baseUrl,
          },
        },
      },
    },
  };
}

function mergeConfig(existingConfig, patchConfig) {
  const existingSkills = existingConfig.skills ?? {};
  const existingLoad = existingSkills.load ?? {};
  const existingExtraDirs = Array.isArray(existingLoad.extraDirs)
    ? existingLoad.extraDirs
    : [];

  const mergedExtraDirs = Array.from(
    new Set([...existingExtraDirs, ...patchConfig.skills.load.extraDirs]),
  );

  return {
    ...existingConfig,
    skills: {
      ...existingSkills,
      load: {
        ...existingLoad,
        extraDirs: mergedExtraDirs,
      },
      entries: {
        ...(existingSkills.entries ?? {}),
        ...patchConfig.skills.entries,
      },
    },
  };
}

function writeConfig(config) {
  fs.mkdirSync(openClawHome, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function printStatus(args) {
  const { currentConfig, mergedConfig, configExists } = args;
  const openClawInstalled = commandExists("openclaw");
  const version = openClawInstalled ? getOpenClawVersion() : null;

  process.stdout.write(`Repo skill directory: ${skillDir}\n`);
  process.stdout.write(`OpenClaw home: ${openClawHome}\n`);
  process.stdout.write(`Config path: ${configPath}\n`);
  process.stdout.write(`AIHIRE_BASE_URL: ${baseUrl}\n`);
  process.stdout.write(
    `OpenClaw CLI: ${openClawInstalled ? `installed globally (${version ?? "unknown version"})` : "not installed globally (npx openclaw@latest works)"}\n`,
  );
  process.stdout.write(`Existing config: ${configExists ? "found" : "not found"}\n`);
  process.stdout.write(
    `Skill dir configured: ${
      ((currentConfig.skills?.load?.extraDirs ?? [])).includes(skillDir) ? "yes" : "no"
    }\n`,
  );
  process.stdout.write("\nMerged config preview:\n");
  process.stdout.write(`${JSON.stringify(mergedConfig, null, 2)}\n`);

  if (!openClawInstalled) {
    process.stdout.write(
      "\nUse OpenClaw via npx right now:\n" +
        "  npx openclaw@latest onboard --install-daemon\n" +
        "\nIf you want a persistent CLI without sudo/EACCES issues:\n" +
        "  mkdir -p ~/.npm-global\n" +
        "  npm config set prefix ~/.npm-global\n" +
        "  echo 'export PATH=\"$HOME/.npm-global/bin:$PATH\"' >> ~/.zshrc\n" +
        "  source ~/.zshrc\n" +
        "  npm install -g openclaw@latest\n" +
        "  openclaw onboard --install-daemon\n",
    );
  }
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("help")) {
    usage();
    return;
  }

  if (!fs.existsSync(skillDir)) {
    throw new Error(`Skill directory not found: ${skillDir}`);
  }

  const configExistsAtStart = fs.existsSync(configPath);
  const existingConfig = readExistingConfig();
  const mergedConfig = mergeConfig(existingConfig, buildSkillConfig());

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(mergedConfig, null, 2)}\n`);
    return;
  }

  if (process.argv.includes("--write")) {
    writeConfig(mergedConfig);
    process.stdout.write(`Updated ${configPath}\n`);
  }

  const currentConfig = process.argv.includes("--write")
    ? readExistingConfig()
    : existingConfig;
  const configExistsNow = fs.existsSync(configPath);

  printStatus({
    currentConfig,
    mergedConfig,
    configExists: process.argv.includes("--write")
      ? configExistsNow
      : configExistsAtStart,
  });
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
