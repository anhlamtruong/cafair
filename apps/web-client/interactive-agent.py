from nova_act import NovaAct
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("NOVA_API_KEY")


def apply_workflow(start_index):

    print(f"Agent {start_index} starting")

    with NovaAct(
        starting_page="http://localhost:3002",
        nova_act_api_key=API_KEY,
        headless=False,
        ignore_https_errors=True
    ) as nova:

        nova.start()

        nova.act(f"""
You are automating a page for job applications named "Cafair".
Step 0:
After opening the page, wait briefly for me to sign in manually. Do not attempt to sign in by yourself.
                 Do not attempt to click any buttons or fill in any fields until I have signed in and the page has fully loaded. After I have signed in, you will see the dashboard page.
                 Do not close the page or navigate away from the dashboard until I have signed in. Wait for me to complete the sign-in process and for the dashboard to load before proceeding with any further actions.

Step 1:
Click "Dash Board" button.

Step 2:
Find the tab named "Candidate Queue" on the left side bar and click it.

Step 3:
Open the first candidate's application.
                 
Step 4:
Scroll down and click the "Approve + Send" button.

Step 5:
After successfully clicking "Approve + Send", navigate directly back to the Cafair job application list by going to:
http://localhost:3002


Repeat this process until first 3 candidates applications have been clicked.

Do not attempt to use browser back.
Do not click logos.
Always return by navigating directly to the Original URL.

Stop after 10 successful clicks.
""")


if __name__ == "__main__":
    print("Starting agent")
    apply_workflow(1)
