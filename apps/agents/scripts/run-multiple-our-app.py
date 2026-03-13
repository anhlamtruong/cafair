#!/usr/bin/env python3
"""
Run multiple local Amazon Nova Act recruiter jobs against the AI Hire app.

This script launches one worker process per Nova Act job so each browser
session is isolated. That avoids the Playwright sync-in-async conflict that
can happen when multiple local Nova Act sessions are started inside one Python
process.

Default jobs:
- Hiring Center flow
- Roles flow
- Risk Flags flow

Examples:
    python3 apps/agents/scripts/run-multiple-our-app.py --debug-logs --prefer-chrome
    python3 apps/agents/scripts/run-multiple-our-app.py --print-prompts
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

try:
    from nova_act import NovaAct
except Exception:
    NovaAct = None


SCRIPT_PATH = Path(__file__).resolve()
SCRIPT_DIR = SCRIPT_PATH.parent
RUN_OUR_APP_PATH = SCRIPT_DIR / "run-our-app.py"
REPO_ROOT = SCRIPT_PATH.parents[3]
DEFAULT_BASE_HOST = "http://localhost:3002"
DEFAULT_TIMEOUT_SECONDS = 240
DEFAULT_MAX_STEPS = 50
DEFAULT_OBSERVATION_DELAY_MS = 900
READY_TIMEOUT_SECONDS = 90
JOB_PORTS = {
    "hiring-center": 9222,
    "roles": 9223,
    "risk-flags": 9224,
}


def eprint(message: str) -> None:
    print(message, file=sys.stderr)


def clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def local_debug_enabled() -> bool:
    return os.getenv("NOVA_ACT_DEBUG_LOGS", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def prefer_chrome_enabled() -> bool:
    return os.getenv("NOVA_ACT_PREFER_CHROME", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def load_project_env_fallback() -> None:
    if load_dotenv is None:
        return

    env_files = [
        REPO_ROOT / ".env",
        REPO_ROOT / "apps" / "web-client" / ".env",
    ]

    for env_file in env_files:
        if env_file.exists():
            load_dotenv(env_file, override=False)


def get_nova_api_key_fallback() -> Optional[str]:
    for key in ("NOVA_ACT_API", "NOVA_API_KEY"):
        value = clean_text(os.getenv(key))
        if value:
            return value
    return None


def should_ignore_https_errors_fallback(base_url: str) -> bool:
    normalized = (base_url or "").strip().lower()
    return (
        normalized.startswith("http://")
        or "localhost" in normalized
        or "127.0.0.1" in normalized
    )


def configure_local_browser_env_for_chrome_fallback() -> None:
    chrome_candidates = [
        clean_text(os.getenv("NOVA_ACT_CHROME_PATH")),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ]

    chrome_path = None
    for candidate in chrome_candidates:
        if candidate and os.path.exists(candidate):
            chrome_path = candidate
            break

    os.environ["BROWSER"] = "chrome"
    os.environ["PLAYWRIGHT_BROWSER"] = "chromium"
    os.environ["PW_TEST_BROWSER"] = "chromium"

    if chrome_path:
        os.environ["GOOGLE_CHROME_BIN"] = chrome_path
        os.environ["CHROME_PATH"] = chrome_path
        os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"] = chrome_path

    os.environ["NOVA_ACT_BROWSER_ARGS"] = " ".join(
        [
            "--remote-debugging-port=9222",
            "--no-first-run",
            "--no-default-browser-check",
        ]
    )


def wait_for_manual_login_fallback(message: str) -> None:
    eprint(message)
    try:
        input()
    except EOFError:
        pass


def load_run_our_app_module() -> Optional[object]:
    if not RUN_OUR_APP_PATH.exists():
        return None

    spec = importlib.util.spec_from_file_location("run_our_app_module", RUN_OUR_APP_PATH)
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


RUN_OUR_APP_MODULE = load_run_our_app_module()


def get_helper(name: str, fallback: Callable[..., Any]) -> Callable[..., Any]:
    if RUN_OUR_APP_MODULE is not None and hasattr(RUN_OUR_APP_MODULE, name):
        return getattr(RUN_OUR_APP_MODULE, name)
    return fallback


load_project_env = get_helper("load_project_env", load_project_env_fallback)
get_nova_api_key = get_helper("get_nova_api_key", get_nova_api_key_fallback)
should_ignore_https_errors = get_helper(
    "should_ignore_https_errors",
    should_ignore_https_errors_fallback,
)
configure_local_browser_env_for_chrome = get_helper(
    "configure_local_browser_env_for_chrome",
    configure_local_browser_env_for_chrome_fallback,
)
wait_for_manual_login = get_helper("wait_for_manual_login", wait_for_manual_login_fallback)


def build_hiring_center_instruction(base_url: str) -> str:
    if RUN_OUR_APP_MODULE is not None and hasattr(RUN_OUR_APP_MODULE, "build_recruiter_instruction"):
        return RUN_OUR_APP_MODULE.build_recruiter_instruction(base_url)

    return "\n".join(
        [
            "You are controlling a browser for a recruiter using our AI Hire platform.",
            "Navigate from Hiring Center to the pre-fair candidate pool task, go to Candidate Queue,",
            "check two candidate boxes, open the first candidate, click Review, click Confirm Schedule,",
            "go to Conversation, type the Lam offer demo message, do not send it, and then stop.",
        ]
    )


def build_roles_instruction(base_url: str) -> str:
    steps = [
        "1. You are acting as a recruiter inside the AI Hire roles experience.",
        "2. Stay focused on the SWE Intern role flow and avoid destructive actions.",
        f"3. Start from the authenticated app session. If needed, navigate to {base_url}.",
        "4. Verify the Roles page is loaded by checking for role cards or a role table and the left sidebar.",
        "5. Look for the SWE Intern role card.",
        "6. On the SWE Intern card, find and click 'View Candidates' once.",
        "7. Wait for the candidate list or candidate queue for that role to finish loading.",
        "8. Scan the visible candidate names and find Emily Zhang.",
        "9. Click Emily Zhang once.",
        "10. Wait for Emily Zhang's candidate detail page to load fully.",
        "11. Confirm the page by looking for the candidate name header, stage row, summary cards, or action buttons.",
        "12. Slowly scroll down through the candidate detail page.",
        "13. Keep scrolling until you can see the 'Approve + Send' button.",
        "14. Do not click 'Approve + Send'. Only use it as a waypoint to confirm you reached the right section.",
        "15. Continue reading nearby recommendation, follow-up, or ATS draft content around that section.",
        "16. Scroll a little farther down to capture more of the lower page content.",
        "17. Then scroll back upward toward the top summary area.",
        "18. If a 'Review' button is visible in a recommendation area, click 'Review' once.",
        "19. If a review panel or modal appears, inspect it and stop before any irreversible action.",
        "20. If no review UI appears, stop once Emily Zhang's detail page has been explored top to bottom and back up again.",
    ]

    cues = [
        "Role page cue: a card labeled 'SWE Intern'.",
        "Candidate cue: visible name 'Emily Zhang'.",
        "Detail page cues: candidate header, evaluation sections, and 'Approve + Send'.",
    ]

    rules = [
        "Prefer precise clicks over exploratory clicking.",
        "Do not click Approve + Send, Send, Reject, Delete, or other irreversible actions.",
        "Scrolling up and down is allowed for this flow because the goal is to inspect the page.",
        "If multiple Emily entries exist, choose the clearly visible full-name match 'Emily Zhang'.",
        "Stop after the candidate review area has been reached and inspected.",
    ]

    return "\n".join(
        [
            "You are controlling a browser for a recruiter using our AI Hire platform.",
            "Follow the numbered steps exactly and keep the session safe.",
            "",
            "Primary goal:",
            "Open the SWE Intern role, view candidates, open Emily Zhang, scroll until 'Approve + Send' is visible, inspect the surrounding review content, and stop without sending or approving anything.",
            "",
            "Step plan:",
            *steps,
            "",
            "Visual cues:",
            *cues,
            "",
            "Behavior rules:",
            *rules,
        ]
    )


def build_risk_flags_instruction(base_url: str) -> str:
    steps = [
        "1. You are acting as a recruiter reviewing risk flags inside the AI Hire app.",
        "2. Stay focused on the risk-flags workflow and avoid unrelated navigation.",
        f"3. Start from the authenticated app session. If needed, navigate to {base_url}.",
        "4. Verify the Risk Flags page is loaded by checking the left sidebar and a page header or risk review content.",
        "5. Find the control labeled 'Flag Types'.",
        "6. Click 'Flag Types' once.",
        "7. Wait for the flag type filters, tabs, list, or menu to appear.",
        "8. Find the filter option labeled 'Skill'.",
        "9. Click the Skill filter once.",
        "10. Wait for the filtered risk flags list to refresh.",
        "11. Find a visible 'View Details' control on a Skill-related flag card or row.",
        "12. Click 'View Details' once.",
        "13. Wait for the detail panel, drawer, or detail page to load fully.",
        "14. Read the flag summary, evidence, and status area carefully.",
        "15. Find the control labeled 'Mark Reviewed'.",
        "16. Click 'Mark Reviewed' once.",
        "17. Wait for the reviewed state, toast, badge, or status update to appear.",
        "18. Continue inspecting the visible details so the operator can see the reviewed result.",
        "19. If the UI returns to a list, keep the Skill context and inspect one more visible reviewed or skill-related row without mutating it again.",
        "20. Stop after the reviewed state is clearly visible.",
    ]

    cues = [
        "Risk Flags cues: page header, list of flags, filter controls, and detail drawers or panels.",
        "Filter cue: 'Flag Types' with an option or tab for 'Skill'.",
        "Action cues: 'View Details' and 'Mark Reviewed'.",
    ]

    rules = [
        "Prefer deliberate clicks and wait for transitions to finish.",
        "Do not delete, dismiss, escalate, or bulk-update unrelated items.",
        "If the label varies slightly, choose the nearest wording that clearly means Skill filtering or reviewing a flag.",
        "Only mark one target flag as reviewed for this demo run.",
        "Stop after the reviewed state is visible.",
    ]

    return "\n".join(
        [
            "You are controlling a browser for a recruiter using our AI Hire platform.",
            "Follow the numbered steps exactly and keep the session safe.",
            "",
            "Primary goal:",
            "Open the Risk Flags page, filter by Skill, view details for one flag, mark it reviewed, verify the reviewed state, and stop.",
            "",
            "Step plan:",
            *steps,
            "",
            "Visual cues:",
            *cues,
            "",
            "Behavior rules:",
            *rules,
        ]
    )


@dataclass
class JobSpec:
    name: str
    base_url: str
    prompt: str


def build_job_specs(base_host: str) -> List[JobSpec]:
    normalized_host = base_host.rstrip("/")
    hiring_url = f"{normalized_host}/hiring-center"
    roles_url = f"{normalized_host}/roles"
    risk_flags_url = f"{normalized_host}/risk-flags"

    return [
        JobSpec(
            name="hiring-center",
            base_url=hiring_url,
            prompt=build_hiring_center_instruction(hiring_url),
        ),
        JobSpec(
            name="roles",
            base_url=roles_url,
            prompt=build_roles_instruction(roles_url),
        ),
        JobSpec(
            name="risk-flags",
            base_url=risk_flags_url,
            prompt=build_risk_flags_instruction(risk_flags_url),
        ),
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run multiple local Nova Act recruiter jobs against the AI Hire app."
    )
    parser.add_argument(
        "--base-host",
        default=DEFAULT_BASE_HOST,
        help=f"Base host for the local recruiter app (default: {DEFAULT_BASE_HOST})",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=f"Nova Act task timeout in seconds (default: {DEFAULT_TIMEOUT_SECONDS})",
    )
    parser.add_argument(
        "--max-steps",
        type=int,
        default=DEFAULT_MAX_STEPS,
        help=f"Maximum Nova Act steps per task (default: {DEFAULT_MAX_STEPS})",
    )
    parser.add_argument(
        "--observation-delay-ms",
        type=int,
        default=DEFAULT_OBSERVATION_DELAY_MS,
        help=f"Delay before observations in milliseconds (default: {DEFAULT_OBSERVATION_DELAY_MS})",
    )
    parser.add_argument(
        "--debug-logs",
        action="store_true",
        help="Enable extra local logging.",
    )
    parser.add_argument(
        "--prefer-chrome",
        action="store_true",
        help="Prefer launching Chrome or Chromium for the visible runs.",
    )
    parser.add_argument(
        "--print-prompts",
        action="store_true",
        help="Print all prompts and exit.",
    )
    parser.add_argument(
        "--worker",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--job-name",
        default="",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--session-dir",
        default="",
        help=argparse.SUPPRESS,
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> Optional[str]:
    if args.timeout_seconds < 2:
        return "--timeout-seconds must be at least 2."
    if args.max_steps < 1:
        return "--max-steps must be at least 1."
    if args.max_steps >= 100:
        return "--max-steps must be less than 100 for Nova Act."
    if args.observation_delay_ms < 0:
        return "--observation-delay-ms cannot be negative."
    if args.worker:
        if not args.job_name:
            return "--job-name is required in worker mode."
        if not args.session_dir:
            return "--session-dir is required in worker mode."
    return None


def set_worker_browser_args(job_name: str) -> None:
    port = JOB_PORTS.get(job_name, 9222)
    os.environ["NOVA_ACT_BROWSER_ARGS"] = " ".join(
        [
            f"--remote-debugging-port={port}",
            "--no-first-run",
            "--no-default-browser-check",
        ]
    )


def session_paths(session_dir: Path, job_name: str) -> Dict[str, Path]:
    return {
        "ready": session_dir / f"{job_name}.ready",
        "result": session_dir / f"{job_name}.result.json",
        "continue": session_dir / "continue.signal",
    }


def make_json_safe(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except Exception:
        return str(value)


def run_worker(args: argparse.Namespace, job: JobSpec) -> int:
    load_project_env()

    if args.debug_logs:
        os.environ["NOVA_ACT_DEBUG_LOGS"] = "1"
    if args.prefer_chrome:
        os.environ["NOVA_ACT_PREFER_CHROME"] = "1"

    if NovaAct is None:
        eprint("[ERROR] nova_act is not installed in this Python environment.")
        return 2

    api_key = get_nova_api_key()
    if not api_key:
        eprint("[ERROR] Missing Nova Act credentials. Set NOVA_ACT_API or NOVA_API_KEY.")
        return 2

    if prefer_chrome_enabled():
        configure_local_browser_env_for_chrome()
        set_worker_browser_args(job.name)

    session_dir = Path(args.session_dir)
    session_dir.mkdir(parents=True, exist_ok=True)
    paths = session_paths(session_dir, job.name)

    if local_debug_enabled():
        eprint(f"[INFO] Worker {job.name} starting at {job.base_url}")
        eprint(f"[INFO] Worker {job.name} browser args: {os.getenv('NOVA_ACT_BROWSER_ARGS', '')}")

    payload: Dict[str, Any] = {
        "job_name": job.name,
        "base_url": job.base_url,
        "ok": False,
        "result": None,
        "error": None,
    }

    try:
        with NovaAct(
            starting_page=job.base_url,
            headless=False,
            ignore_https_errors=should_ignore_https_errors(job.base_url),
            nova_act_api_key=api_key,
        ) as nova:
            paths["ready"].write_text("ready\n", encoding="utf-8")

            wait_started_at = time.time()
            while not paths["continue"].exists():
                if time.time() - wait_started_at > args.timeout_seconds:
                    raise TimeoutError("Timed out waiting for the shared manual-login continue signal.")
                time.sleep(0.5)

            result = nova.act(
                job.prompt,
                timeout=args.timeout_seconds,
                max_steps=args.max_steps,
                observation_delay_ms=args.observation_delay_ms,
            )
            payload["ok"] = True
            payload["result"] = make_json_safe(result)
    except Exception as exc:
        payload["error"] = str(exc)
        eprint(f"[ERROR] Worker {job.name} failed: {exc}")

    paths["result"].write_text(
        json.dumps(payload, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )
    return 0 if payload["ok"] else 1


def wait_for_workers_ready(
    jobs: List[JobSpec],
    processes: Dict[str, subprocess.Popen[Any]],
    session_dir: Path,
    timeout_seconds: int,
) -> Optional[str]:
    started_at = time.time()
    while True:
        ready_names = {
            job.name
            for job in jobs
            if session_paths(session_dir, job.name)["ready"].exists()
        }
        if len(ready_names) == len(jobs):
            return None

        for name, process in processes.items():
            if process.poll() is not None and name not in ready_names:
                result_path = session_paths(session_dir, name)["result"]
                if result_path.exists():
                    return f"Worker {name} exited before ready. See {result_path}."
                return f"Worker {name} exited before ready."

        if time.time() - started_at > timeout_seconds:
            missing = [job.name for job in jobs if job.name not in ready_names]
            return (
                "Timed out waiting for workers to open their Nova Act sessions. "
                f"Missing ready signals: {', '.join(missing)}."
            )

        time.sleep(0.5)


def terminate_processes(processes: Dict[str, subprocess.Popen[Any]]) -> None:
    for process in processes.values():
        if process.poll() is None:
            process.terminate()


def collect_results(jobs: List[JobSpec], session_dir: Path) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for job in jobs:
        result_path = session_paths(session_dir, job.name)["result"]
        if result_path.exists():
            try:
                results.append(json.loads(result_path.read_text(encoding="utf-8")))
                continue
            except Exception as exc:
                results.append(
                    {
                        "job_name": job.name,
                        "ok": False,
                        "result": None,
                        "error": f"Failed to read result file: {exc}",
                    }
                )
                continue

        results.append(
            {
                "job_name": job.name,
                "ok": False,
                "result": None,
                "error": "No result file was produced.",
            }
        )
    return results


def print_prompts(jobs: List[JobSpec]) -> None:
    for index, job in enumerate(jobs, start=1):
        if index > 1:
            print("\n" + "=" * 80 + "\n")
        print(f"[{job.name}] {job.base_url}\n")
        print(job.prompt)


def run_parent(args: argparse.Namespace, jobs: List[JobSpec]) -> int:
    load_project_env()

    if args.debug_logs:
        os.environ["NOVA_ACT_DEBUG_LOGS"] = "1"
    if args.prefer_chrome:
        os.environ["NOVA_ACT_PREFER_CHROME"] = "1"

    session_dir = Path(
        tempfile.mkdtemp(
            prefix="nova_multi_app_",
            dir=str(REPO_ROOT / "apps" / "agents" / "scripts"),
        )
    )

    if local_debug_enabled():
        eprint(f"[INFO] Launching {len(jobs)} parallel Nova Act jobs")
        for job in jobs:
            eprint(f"[INFO] Job {job.name}: {job.base_url}")
        eprint(f"[INFO] Session directory: {session_dir}")

    processes: Dict[str, subprocess.Popen[Any]] = {}
    base_command = [
        sys.executable,
        str(SCRIPT_PATH),
        "--worker",
        "--session-dir",
        str(session_dir),
        "--timeout-seconds",
        str(args.timeout_seconds),
        "--max-steps",
        str(args.max_steps),
        "--observation-delay-ms",
        str(args.observation_delay_ms),
        "--base-host",
        args.base_host,
    ]
    if args.debug_logs:
        base_command.append("--debug-logs")
    if args.prefer_chrome:
        base_command.append("--prefer-chrome")

    try:
        for job in jobs:
            command = base_command + ["--job-name", job.name]
            processes[job.name] = subprocess.Popen(command, cwd=str(REPO_ROOT))

        ready_error = wait_for_workers_ready(
            jobs,
            processes,
            session_dir,
            READY_TIMEOUT_SECONDS,
        )
        if ready_error:
            eprint(f"[ERROR] {ready_error}")
            terminate_processes(processes)
            for process in processes.values():
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
            results = collect_results(jobs, session_dir)
            print(json.dumps({"session_dir": str(session_dir), "results": results}, indent=2))
            return 1

        wait_for_manual_login(
            "\n[MANUAL STEP] The AI Hire app should now be open in multiple visible Nova Act sessions.\n"
            "Please sign in manually in each needed browser window or tab. When the recruiter UI is ready\n"
            "for all sessions, press Enter here and the workers will continue together..."
        )
        session_paths(session_dir, jobs[0].name)["continue"].write_text("continue\n", encoding="utf-8")

        exit_codes: Dict[str, int] = {}
        for name, process in processes.items():
            exit_codes[name] = process.wait()

        results = collect_results(jobs, session_dir)
        print(
            json.dumps(
                {
                    "session_dir": str(session_dir),
                    "exit_codes": exit_codes,
                    "results": results,
                },
                indent=2,
            )
        )
        return 0 if all(result.get("ok") for result in results) else 1
    finally:
        terminate_processes(processes)


def main() -> int:
    args = parse_args()
    error = validate_args(args)
    if error:
        eprint(f"[ERROR] {error}")
        return 2

    jobs = build_job_specs(args.base_host)

    if args.print_prompts:
        print_prompts(jobs)
        return 0

    if args.worker:
        selected = next((job for job in jobs if job.name == args.job_name), None)
        if selected is None:
            eprint(f"[ERROR] Unknown worker job: {args.job_name}")
            return 2
        return run_worker(args, selected)

    return run_parent(args, jobs)


if __name__ == "__main__":
    raise SystemExit(main())
