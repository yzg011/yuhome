<script>
  import { onMount } from 'svelte';

  export let compact = false;

  const SHARE_BASE = 'https://sj.y00.cc.cd';
  const SHARE_ID = 'ZxPM4T33qqR9IN7F';

  let pageviews = 0;
  let uniques = 0;
  let visits = 0;
  let active = 0;
  let loaded = false;

  function val(v) {
    if (v == null) return 0;
    if (typeof v === 'object') return v.value ?? v.y ?? 0;
    return v;
  }

  async function fetchWithAuth(path, token) {
    const res = await fetch(`${SHARE_BASE}${path}`, {
      headers: {
        'x-umami-share-token': token,
        'x-umami-share-context': '1'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  onMount(async () => {
    try {
      // Step 1: Get share token & website ID
      const shareRes = await fetch(`${SHARE_BASE}/api/share/${SHARE_ID}`);
      const shareData = await shareRes.json();
      if (!shareData?.token) { loaded = true; return; }
      const token = shareData.token;
      const wid = shareData.websiteId;
      const base = `/api/websites/${wid}`;

      // Step 2: Fetch all-time stats and active users in parallel
      await Promise.allSettled([
        (async () => {
          const dr = await fetchWithAuth(`${base}/daterange`, token);
          const startAt = dr?.startDate ? new Date(dr.startDate).getTime() : 0;
          const endAt = dr?.endDate ? new Date(dr.endDate).getTime() : Date.now();
          const stats = await fetchWithAuth(`${base}/stats?startAt=${startAt}&endAt=${endAt}`, token);
          if (stats) {
            pageviews = val(stats.pageviews);
            uniques = val(stats.visitors);
            visits = val(stats.visits);
          }
        })(),
        (async () => {
          try {
            const data = await fetchWithAuth(`${base}/active`, token);
            if (Array.isArray(data)) {
              active = data.length;
            } else if (data) {
              active = data.total ?? data.visitors ?? val(data.totals?.visitors) ?? val(data.totals?.pageviews) ?? (data.sessions?.length ?? 0);
            }
          } catch {}
        })()
      ]);
    } catch {}
    loaded = true;
  });
</script>

{:else}
  <div class="bg-white dark:bg-slate-800 border-4 border-[#0284c7] p-5 shadow-[6px_6px_0px_0px_#f59e0b] rounded-sm w-full">
    <h3 class="font-black text-[#0284c7] text-lg mb-4 flex items-center gap-2 border-b-2 border-dashed border-[#0284c7]/30 pb-2 select-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
      <span>网站统计</span>
    </h3>
    {#if loaded}
      <div class="space-y-3">
        <div class="flex items-center justify-between bg-[rgba(250,248,245,0.55)] dark:bg-slate-700 border-2 border-[#0284c7]/20 rounded-sm px-3 py-2">
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300">访问量</span>
          <span class="font-black text-[#0284c7] font-mono text-sm">{pageviews.toLocaleString()}</span>
        </div>
        <div class="flex items-center justify-between bg-[rgba(250,248,245,0.55)] dark:bg-slate-700 border-2 border-[#0284c7]/20 rounded-sm px-3 py-2">
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300">访客数</span>
          <span class="font-black text-[#0284c7] font-mono text-sm">{uniques.toLocaleString()}</span>
        </div>
        <div class="flex items-center justify-between bg-[rgba(250,248,245,0.55)] dark:bg-slate-700 border-2 border-[#0284c7]/20 rounded-sm px-3 py-2">
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300">访问次数</span>
          <span class="font-black text-[#0284c7] font-mono text-sm">{visits.toLocaleString()}</span>
        </div>
        <div class="flex items-center justify-center bg-[#fde68a]/50 dark:bg-amber-800/30 border-2 border-[#0284c7] rounded-sm px-3 py-2">
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
            </span>
            你正在和 <span class="font-black text-[#0284c7] mx-0.5">{active}</span> 个小伙伴一起观看本博客
          </span>
        </div>
      </div>
    {:else}
      <div class="space-y-3">
        {#each [1,2,3] as _}
          <div class="h-[34px] bg-slate-100 border-2 border-[#0284c7]/10 rounded-sm animate-pulse" />
        {/each}
      </div>
    {/if}
  </div>
{/if}
