AI Internship Auto Apply Agent

Overview
This script automates opening internship application links from the GitHub repository:

https://github.com/SimplifyJobs/Summer2026-Internships

The system uses multiple AI browser agents powered by NovaAct to click internship Apply links in parallel.

Each agent starts from a different position in the internship list to avoid opening the same job links.

How It Works

The script launches multiple parallel AI agents.

Each agent performs the following steps:

1. Opens the GitHub internship listing page.
2. Scrolls down to the internship table.
3. Finds an Apply link and clicks it.
4. Waits for the job page to load.
5. Navigates back to the GitHub internship list.
6. Moves 5 jobs down in the list.
7. Repeats until 10 job links have been opened.

Example distribution with 5 agents:

Agent 1 → jobs 1,6,11,16...
Agent 2 → jobs 2,7,12,17...
Agent 3 → jobs 3,8,13,18...
Agent 4 → jobs 4,9,14,19...
Agent 5 → jobs 5,10,15,20...

This ensures agents open different job applications instead of duplicating work.

Requirements

Python 3.11 or newer

NovaAct SDK

Playwright (used internally by NovaAct)

Installation

1. Create a virtual environment

python -m venv .venv

2. Activate the environment

Mac/Linux

source .venv/bin/activate

Windows

.venv\Scripts\activate

3. Install dependencies

pip install nova-act
pip install playwright

4. Install Playwright browsers

playwright install

API Key Setup

You need a NovaAct API key.

You can place it directly in the script:

API_KEY = "your_api_key_here"

Or preferably use an environment variable:

export NOVA_ACT_API_KEY=your_api_key_here

Running the Script

Run the automation script:

python workflow_apply.py

Expected terminal output:

Starting agents...
Agent 1 starting
Agent 2 starting
Agent 3 starting
Agent 4 starting
Agent 5 starting

Multiple browser windows will open and begin navigating internship application pages automatically.

Configuration

Number of agents

Modify the value in the script:

num_agents = 5

Example:

num_agents = 10

This will launch 10 parallel AI agents.

Number of jobs per agent

Modify the instruction in the prompt:

Repeat this process until 10 Apply links have been clicked.

Important Notes

Some job application sites may require login.

Some application forms may include CAPTCHA verification.

Running too many agents at once may cause rate limiting.

Recommended number of agents for stable performance:

3 to 10 agents.

Troubleshooting

If browser windows do not open

Run:

playwright install

If NovaAct authentication fails

Ensure your API key is valid.

Future Improvements

Possible improvements to this system include:

Automatically parsing the internship table instead of scrolling.

Automatically uploading resumes to application forms.

Using AI to generate answers to application questions.

Building a fully automated internship application pipeline.

Scaling the system with distributed agents.
