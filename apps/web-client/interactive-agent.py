from nova_act import NovaAct
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("NOVA_API_KEY")


def apply_workflow(start_index):

    print(f"Agent {start_index} starting")

    with NovaAct(
        starting_page="https://ai-hire-ai.vercel.app/",
        nova_act_api_key=API_KEY,
        headless=False,
        ignore_https_errors=True
    ) as nova:

        nova.start()

        nova.act(f"""
You are automating a page for job applications named "AI Hire AI".
Step 1:
After opening the page, clicking Get Started, clicking "Continue as Recruiter", wait briefly for me to sign in manually. Do not attempt to sign in by yourself.
                 Do not attempt to click any buttons or fill in any fields until I have signed in and the page has fully loaded. After I have signed in, you will see the dashboard page.
                 Do not close the page or navigate away from the dashboard until I have signed in. Wait for me to complete the sign-in process and for the dashboard to load before proceeding with any further actions.


Step 2:
Find the tab named "Candidate Queue" on the left side bar and click it.

Step 3:
Open the first candidate's application.
                 
Step 4:
Scroll down and click the "Approve + Send" button.

Step 5:
After successfully clicking "Approve + Send", navigate directly back to the AI Hire AI job application list by going to:
https://ai-hire-ai.vercel.app/recruiter/hiring-center


Repeat this 5 steps process 3 times until all 3 candidates have been processed. 

Do not attempt to use browser back.
Do not click logos.
Always return by navigating directly to the Original URL.

Stop after 10 successful clicks.
""")


if __name__ == "__main__":
    print("Starting agent")
    apply_workflow(1)
