import os
from nova_act import NovaAct
import sys
from datetime import datetime


class TimestampedStdout:
    def write(self, message):
        if message.strip():
            t = datetime.now().strftime("%H:%M:%S")
            sys.__stdout__.write(f"[{t}] {message}")
        else:
            sys.__stdout__.write(message)

    def flush(self):
        pass


sys.stdout = TimestampedStdout()

os.environ["NOVA_ACT_BROWSER_ARGS"] = "--remote-debugging-port=9222"
nova = NovaAct(
    starting_page="https://github.com/SimplifyJobs/Summer2026-Internships?tab=readme-ov-file",
    headless=False,
    nova_act_api_key="7d357683-5efa-4016-9227-435a21fcff0a"
)

nova.start()
nova.act("""
You are automating a GitHub internship listing page.

Step 1:
Scroll down and click the first visible Apply link.

Step 2:
Wait briefly for the job page to load.

Step 3:
Navigate directly back to the GitHub internship list by going to:
https://github.com/SimplifyJobs/Summer2026-Internships?tab=readme-ov-file

Step 4:
Find a different Apply link than before and click it.

Repeat this process until 10 Apply links have been clicked.

Do not attempt to use browser back.
Do not click logos.
Always return by navigating directly to the GitHub URL.

Stop after 10 successful clicks.
""")
