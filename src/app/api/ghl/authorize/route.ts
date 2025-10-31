import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SCOPES = 'businesses.readonly businesses.write companies.readonly calendars.readonly calendars.write calendars/events.readonly calendars/events.write calendars/groups.readonly calendars/groups.write calendars/resources.readonly calendars/resources.write campaigns.readonly conversations.readonly conversations.write conversations/message.readonly conversations/message.write conversations/reports.readonly conversations/livechat.write contacts.readonly contacts.write objects/schema.readonly objects/record.readonly objects/schema.write objects/record.write associations.write associations.readonly associations/relation.readonly associations/relation.write forms.readonly forms.write links.readonly lc-email.readonly links.write locations.readonly locations/customValues.readonly locations/customValues.write locations/customFields.readonly locations/customFields.write locations/tasks.readonly locations/tasks.write recurring-tasks.write recurring-tasks.readonly locations/tags.readonly locations/tags.write locations/templates.readonly medias.readonly medias.write oauth.write oauth.readonly opportunities.readonly opportunities.write saas/company.read saas/company.write saas/location.read saas/location.write snapshots.readonly snapshots.write conversation-ai.write conversation-ai.readonly knowledge-bases.readonly knowledge-bases.write agent-studio.readonly agent-studio.write voice-ai-agent-goals.write voice-ai-agent-goals.readonly voice-ai-agents.write voice-ai-agents.readonly voice-ai-dashboard.readonly custom-menu-link.readonly custom-menu-link.write emails/builder.write workflows.readonly emails/builder.readonly emails/schedule.readonly users.readonly marketplace-installer-details.readonly'

export async function GET() {
  const clientId = process.env.GHL_CLIENT_ID!
  const redirectUri = process.env.GHL_AUTH_REDIRECT_URI!
  const authUrl = new URL('https://services.leadconnectorhq.com/oauth/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', SCOPES)
  const url = authUrl.toString()
  const html = `<!doctype html><html><head><meta charset="utf-8"/></head><body><script>window.location.replace(${JSON.stringify(url)});</script><a href=${JSON.stringify(url)}>Continue</a></body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}


