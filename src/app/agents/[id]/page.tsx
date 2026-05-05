import { redirect } from 'next/navigation';

export default function AgentEditIndexPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }
  const suffix = qs.toString();
  redirect(`/agents/${params.id}/general${suffix ? `?${suffix}` : ''}`);
}
