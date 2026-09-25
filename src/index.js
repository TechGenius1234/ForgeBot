import api, { route } from '@forge/api';
import nacl from 'tweetnacl';

const json = value => JSON.parse(value || '{}');

function header(request, name) {
  const values = request?.headers?.[name] || request?.headers?.[name.toLowerCase()] || [];
  return Array.isArray(values) ? values[0] : values;
}

export function verifyDiscordRequest(request, publicKey) {
  const signature = header(request, 'x-signature-ed25519');
  const timestamp = header(request, 'x-signature-timestamp');
  if (!signature || !timestamp || !publicKey || !request?.body) return false;
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + request.body),
      hexToBytes(signature),
      hexToBytes(publicKey),
    );
  } catch {
    return false;
  }
}

function hexToBytes(value) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error('Invalid hex');
  return Uint8Array.from(value.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

const input = (customId, label, style = 1, required = true) => ({
  type: 1,
  components: [{ type: 4, custom_id: customId, label, style, required, max_length: style === 2 ? 4000 : 200 }],
});

function ticketModal() {
  return {
    type: 9,
    data: {
      custom_id: 'jira_ticket_modal',
      title: 'Create Jira service ticket',
      components: [
        input('request_type', 'Request type (Access, Incident, Hardware, etc.)'),
        input('summary', 'Short summary'),
        input('details', 'What do you need? Include useful details.', 2),
        input('urgency', 'Urgency (Low, Medium, or High)'),
      ],
    },
  };
}

function modalValues(data) {
  const values = {};
  for (const row of data?.components || []) {
    const component = row.components?.[0];
    if (component?.custom_id) values[component.custom_id] = component.value?.trim() || '';
  }
  return values;
}

function jiraDescription(values, user) {
  return `Request type: ${values.request_type}\nUrgency: ${values.urgency}\nSubmitted from Discord by ${user?.username || 'unknown'} (${user?.id || 'unknown'})\n\n${values.details}`;
}

async function createJiraIssue(values, user) {
  const response = await api.asApp().requestJira(route`/rest/api/3/issue`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: process.env.JIRA_PROJECT_KEY || 'IT' },
        summary: `[${values.request_type}] ${values.summary}`,
        issuetype: { name: process.env.JIRA_ISSUE_TYPE || 'Task' },
        description: {
          type: 'doc',
          version: 1,
          content: jiraDescription(values, user).split('\n').map(text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })),
        },
        labels: ['discord-intake', `urgency-${(values.urgency || 'medium').toLowerCase()}`],
      },
    }),
  });
  if (!response.ok) throw new Error(`Jira returned ${response.status}`);
  return response.json();
}

function response(content) {
  return { statusCode: 200, headers: { 'Content-Type': ['application/json'] }, body: JSON.stringify({ type: 4, data: { content, allowed_mentions: { parse: [] } } }) };
}

export async function discordInteractions(request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!verifyDiscordRequest(request, publicKey)) return { statusCode: 401, body: 'invalid request signature' };
  const payload = json(request.body);

  if (payload.type === 1) return { statusCode: 200, body: JSON.stringify({ type: 1 }) };
  if (payload.type === 2 && payload.data?.name === 'ticket') return { statusCode: 200, headers: { 'Content-Type': ['application/json'] }, body: JSON.stringify(ticketModal()) };

  if (payload.type === 5 && payload.data?.custom_id === 'jira_ticket_modal') {
    try {
      const values = modalValues(payload.data);
      if (!values.request_type || !values.summary || !values.details || !values.urgency) return response('Please fill in every field.');
      const issue = await createJiraIssue(values, payload.member?.user || payload.user);
      const key = issue.key || 'ticket';
      return response(`Created Jira ticket **${key}**. You can follow it in Jira: ${key}`);
    } catch (error) {
      console.error('[Forge Discord → Jira]', error);
      return response('I could not create the Jira ticket. Please check the project key and Jira permissions.');
    }
  }

  return response('Unsupported interaction. Use `/ticket`.');
}
