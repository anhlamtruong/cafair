from concurrent.futures import ThreadPoolExecutor
from nova_act import NovaAct
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("NOVA_API_KEY")


def apply_workflow(start_index):

    print(f"Agent {start_index} starting")

    with NovaAct(
        starting_page="https://github.com/SimplifyJobs/Summer2026-Internships?tab=readme-ov-file",
        nova_act_api_key=API_KEY,
        headless=False
    ) as nova:

        nova.start()

        nova.act(f"""
You are automating a GitHub internship listing page.

Each Apply link in the internship table represents one job.

Start from Apply link number {start_index} in the list.

Step 1:
Scroll down until the internship table is visible.

Step 2:
Find the Apply link corresponding to job number {start_index} and click it.

Step 3:
Wait briefly for the job page to load.

Step 4:
Navigate directly back to the GitHub internship list by going to:
https://github.com/SimplifyJobs/Summer2026-Internships?tab=readme-ov-file

Step 5:
Move exactly 5 jobs down the list and click the Apply link again.

Example sequence for this agent:
{start_index} → {start_index+5} → {start_index+10} → {start_index+15}

Repeat this process until 10 Apply links have been clicked.

Do not attempt to use browser back.
Do not click logos.
Always return by navigating directly to the GitHub URL.

Stop after 10 successful clicks.
""")


def run_parallel_agents():

    num_agents = 5

    with ThreadPoolExecutor(max_workers=num_agents) as executor:
        futures = []

        for i in range(num_agents):
            futures.append(
                executor.submit(apply_workflow, i + 1)
            )

        for f in futures:
            f.result()


if __name__ == "__main__":
    print("Starting agents...")
    run_parallel_agents()
