# Forge Discord → Jira bot

This is an **Atlassian Forge app only**. It has no website and no separate server. Discord sends interactions to an Atlassian Forge web trigger; Forge verifies the request and creates the Jira issue with its own app permissions.

## Flow

1. A user runs `/ticket` in Discord (including a DM if the command is registered there).
2. Discord displays a small form for request type, summary, details, and urgency.
3. The Forge function calls Jira directly with `api.asApp().requestJira()`.
4. Discord receives the created Jira issue key.

## Setup

1. Install Node.js and the [Atlassian Forge CLI](https://developer.atlassian.com/platform/forge/set-up-forge/).
2. Run `forge login`.
3. Replace the placeholder app ID in `manifest.yml`, or run `forge register` and use the generated ID.
4. Set the Jira project key for deployment:

   ```bash
   forge variables set JIRA_PROJECT_KEY IT --environment development
   forge variables set JIRA_ISSUE_TYPE Task --environment development
   ```

5. Deploy and install the app into the Jira site:

   ```bash
   forge deploy -e development
   forge install --upgrade -e development
   ```

6. Create the Forge web-trigger URL:

   ```bash
   forge webtrigger create discord-interactions -e development
   ```

7. In the Discord Developer Portal, create an application and copy its **Public Key**. Set it as a Forge variable:

   ```bash
   forge variables set DISCORD_PUBLIC_KEY YOUR_DISCORD_PUBLIC_KEY --environment development
   ```

   Then redeploy.

8. In Discord, register a `/ticket` application command whose **Interactions Endpoint URL** is the Forge web-trigger URL. Discord will send a `PING`; the app answers it to verify the endpoint.

9. Install the Discord app with the `applications.commands` scope. Users can then run `/ticket` directly in a DM or server where the command is available.

## Important limitation

This uses Discord **Interactions**, not the Discord gateway. It is intentionally Forge/serverless and does not listen to arbitrary free-form DM text. The user starts the ticket with `/ticket`, then fills out the form. If you require the bot to react to every ordinary DM message, that needs a persistent Discord gateway process outside Forge.

## Permissions

The manifest requests `write:jira-work` and `read:jira-work`. The Forge app must be installed into the Jira site and the target project must allow the app user to create issues.

## Test

```bash
npm install
npm test
```
