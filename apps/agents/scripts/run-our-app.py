#!/usr/bin/env python3
"""
Local Amazon Nova Act runner for the AI Hire recruiter app.

This script opens the local recruiter app in a visible browser, waits for the
human to sign in manually, then asks Nova Act to continue as a recruiter and
open the pre-fair candidate pool before selecting the first visible candidate.

Examples:
    python3 apps/agents/scripts/run-our-app.py --debug-logs --prefer-chrome
    python3 apps/agents/scripts/run-our-app.py --base-url http://localhost:3002/hiring-center
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import List, Optional

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

try:
    from nova_act import NovaAct
except Exception:
    NovaAct = None


DEFAULT_BASE_URL = "http://localhost:3002/hiring-center"
DEFAULT_TIMEOUT_SECONDS = 180
DEFAULT_MAX_STEPS = 30
DEFAULT_OBSERVATION_DELAY_MS = 900
REPO_ROOT = Path(__file__).resolve().parents[3]


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


def load_project_env() -> None:
    if load_dotenv is None:
        return

    env_files = [
        REPO_ROOT / ".env",
        REPO_ROOT / "apps" / "web-client" / ".env",
    ]

    for env_file in env_files:
        if env_file.exists():
            load_dotenv(env_file, override=False)


def get_nova_api_key() -> Optional[str]:
    for key in ("NOVA_ACT_API", "NOVA_API_KEY"):
        value = clean_text(os.getenv(key))
        if value:
            return value
    return None


def should_ignore_https_errors(base_url: str) -> bool:
    normalized = (base_url or "").strip().lower()
    return (
        normalized.startswith("http://")
        or "localhost" in normalized
        or "127.0.0.1" in normalized
    )


def configure_local_browser_env_for_chrome() -> None:
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


def wait_for_manual_login(message: str) -> None:
    eprint(message)
    try:
        input()
    except EOFError:
        pass


def build_recruiter_instruction(base_url: str) -> str:
    steps: List[str] = [
        "1. You are acting as a recruiter using the AI Hire recruiting platform in a live browser session.",
        "2. This is a read-only navigation task. Do not approve, reject, edit, sync, send, submit, or delete anything.",
        "3. The human operator has already signed in manually before you begin acting.",
        f"4. Start from the current authenticated app session. If needed, navigate to {base_url} and wait for the app to finish loading.",
        "5. Confirm that the recruiter dashboard or Hiring Center is visible before proceeding.",
        "6. Strong page clues include a greeting like 'Hi Tran!' or 'Welcome back', a left sidebar, recruiter metric cards, and a green 'Show my Tasks' button.",
        "7. Anchor on the left navigation rail and read the visible entries carefully.",
        "8. Find the sidebar item labeled 'Hiring Center'.",
        "9. If Hiring Center is not already selected, click it exactly once.",
        "10. Wait for the Hiring Center page to settle completely. Allow time for cards, buttons, drawers, and transitions to finish rendering.",
        "11. Verify you are on the correct page by looking for the greeting area, the date block, the green 'Show my Tasks' button, and cards such as New applicants, Moved to Interview, Auto-screened out, Flagged issues, or Offer drafted.",
        "12. Move your attention to the green 'Show my Tasks' button near the top portion of the Hiring Center page.",
        "13. Click 'Show my Tasks' once.",
        "14. Wait for the task drawer or task frame to open on the right side. Do not click the background while the drawer is still animating.",
        "15. Once the drawer is visible, read the header and visible sections carefully. Useful cues include 'My Tasks', 'Urgent', 'Due Today', and 'Upcoming'.",
        "16. If there is an Urgent tab or Urgent section selector, prefer it. If urgent tasks are already visible by default, do not waste a click reselecting it.",
        "17. Scan the visible task list carefully from top to bottom before choosing any task.",
        "18. Avoid non-target tasks such as PM shortlist review, Sarah Chen offer approval, ATS sync, rejection emails, scheduling interviews, or rubric updates.",
        "19. Find the task whose visible wording matches or is closest to 'Review pre-fair candidate pool'.",
        "20. If the task is not in the Urgent area, continue scanning visible drawer sections such as Upcoming without leaving the task drawer.",
        "21. Click the 'Review pre-fair candidate pool' task once when you find it.",
        "22. Wait for the resulting destination page, modal, drawer, or candidate list to load fully before interacting again.",
        "23. Identify the first visible candidate entry in that pre-fair pool. This may appear as a row, card, or list item.",
        "24. Click the first visible candidate exactly once.",
        "25. Stop immediately after the first candidate opens and hand control back to the operator.",
    ]

    visual_cues: List[str] = [
        "Dashboard cues: 'Hi Tran!', recruiter metric cards, and a green 'Show my Tasks' button.",
        "Task drawer cues: 'My Tasks', 'Urgent', 'Due Today', 'Upcoming'.",
        "Known non-target tasks: 'Review shortlist for PM role', 'Approve offer for Sarah Chen', 'Sync 8 candidates to ATS'.",
        "Target task wording: 'Review pre-fair candidate pool'.",
    ]

    guidance: List[str] = [
        "Narrate briefly as you move so the operator can follow your reasoning.",
        "Prefer deliberate, precise clicks over exploratory clicking.",
        "Avoid repetitive scrolling. Scroll only when the next required control is not visible.",
        "If a modal or drawer is part of the intended flow, work inside it rather than dismissing it.",
        "If you cannot find an element immediately, scan nearby headings, cards, buttons, and task labels before guessing.",
        "If a label differs slightly, choose the closest recruiter-task wording that clearly matches the goal.",
        "Do not click destructive or decision-making controls such as Approve, Reject, Send, Sync, Edit, Review All, or Close unless absolutely required for the stated goal.",
        "Use the screenshots as visual guidance for layout and wording.",
        "Stop as soon as the first candidate is opened.",
    ]

    return "\n".join(
        [
            "You are controlling a browser for a recruiter using our AI Hire platform.",
            "Follow the numbered steps exactly and keep the session safe and read-only.",
            "",
            "Primary goal:",
            "Open the recruiter task flow from Hiring Center and open the first candidate in the pre-fair candidate pool.",
            "",
            "Step plan:",
            *steps,
            "",
            "Visual cues:",
            *visual_cues,
            "",
            "Behavior rules:",
            *guidance,
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Amazon Nova Act locally against the AI Hire recruiter app."
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL for the local recruiter app (default: {DEFAULT_BASE_URL})",
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
        help=f"Maximum Nova Act steps for the task (default: {DEFAULT_MAX_STEPS})",
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
        help="Prefer launching Chrome or Chromium for the visible run.",
    )
    parser.add_argument(
        "--print-prompt",
        action="store_true",
        help="Print the final Nova Act instruction before execution.",
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
    return None


def main() -> int:
    load_project_env()
    args = parse_args()

    error = validate_args(args)
    if error:
        eprint(f"[ERROR] {error}")
        return 2

    if args.debug_logs:
        os.environ["NOVA_ACT_DEBUG_LOGS"] = "1"
    if args.prefer_chrome:
        os.environ["NOVA_ACT_PREFER_CHROME"] = "1"

    if NovaAct is None:
        eprint(
            "[ERROR] nova_act is not installed in this Python environment. "
            "Install it first, then rerun this script."
        )
        return 2

    api_key = get_nova_api_key()
    if not api_key:
        eprint(
            "[ERROR] Missing Nova Act credentials. Set NOVA_ACT_API or NOVA_API_KEY, then rerun."
        )
        return 2

    if prefer_chrome_enabled():
        configure_local_browser_env_for_chrome()

    instruction = build_recruiter_instruction(args.base_url)

    if args.print_prompt:
        print(instruction)
        return 0

    if local_debug_enabled():
        eprint(f"[INFO] Starting local recruiter flow at: {args.base_url}")
        eprint(f"[INFO] Prefer Chrome enabled: {prefer_chrome_enabled()}")
        eprint(
            f"[INFO] Ignore HTTPS errors for local URL: {should_ignore_https_errors(args.base_url)}"
        )
        eprint(f"[INFO] Timeout seconds: {args.timeout_seconds}")
        eprint(f"[INFO] Max steps: {args.max_steps}")
        eprint(f"[INFO] Observation delay ms: {args.observation_delay_ms}")
        eprint(f"[INFO] NOVA_ACT_BROWSER_ARGS: {os.getenv('NOVA_ACT_BROWSER_ARGS', '')}")

    with NovaAct(
        starting_page=args.base_url,
        headless=False,
        ignore_https_errors=should_ignore_https_errors(args.base_url),
        nova_act_api_key=api_key,
    ) as nova:
        nova.start()
        wait_for_manual_login(
            "\n[MANUAL STEP] The AI Hire app is open in a visible browser.\n"
            "Please sign in manually. After sign-in, wait until you can see the recruiter UI\n"
            "(for example a Welcome back or Hi Tran style page), then press Enter here so Nova Act can continue..."
        )

        try:
            result = nova.act(
                instruction,
                timeout=args.timeout_seconds,
                max_steps=args.max_steps,
                observation_delay_ms=args.observation_delay_ms,
            )
        except Exception as exc:
            eprint(f"[ERROR] Nova Act run failed: {exc}")
            return 1

    eprint("[INFO] Nova Act recruiter navigation completed.")
    if result is not None:
        print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
