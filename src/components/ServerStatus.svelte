<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let currentDown = 0;
  let currentUp = 0;
  let avgDown = 0;
  let avgUp = 0;
  let maxDown = 0;
  let maxUp = 0;
  let trendData: { time: number; download: number; upload: number }[] = [];
  let canvasEl: HTMLCanvasElement;
  let bwTimer: ReturnType<typeof setInterval>;
  let trendTimer: ReturnType<typeof setInterval>;
  let avgTimer: ReturnType<typeof setInterval>;

  // 模拟参数
  const MAX_TREND_POINTS = 12;
  let downBase = 2.2;
  let upBase = 0.8;

  /** 生成模拟带宽数据 */
  function genMockBandwidth() {
    // 随机波动 ±60%
    const down = Math.max(0, downBase * (0.4 + Math.random() * 1.2));
    const up = Math.max(0, upBase * (0.4 + Math.random() * 1.2));
    return { download: down, upload: up };
  }

  /** 更新模拟实时数据 */
  function mockFetchCurrent() {
    const d = genMockBandwidth();
    currentDown = d.download;
    currentUp = d.upload;
  }

  /** 更新模拟平均、峰值 */
  function mockFetchAverage() {
    const downs = trendData.map(i => i.download);
    const ups = trendData.map(i => i.upload);
    if (downs.length === 0) return;

    avgDown = downs.reduce((s, v) => s + v, 0) / downs.length;
    avgUp = ups.reduce((s, v) => s + v, 0) / ups.length;
    maxDown = Math.max(...downs);
    maxUp = Math.max(...ups);
  }

  /** 更新趋势图表数据 */
  function mockFetchTrend() {
    const d = genMockBandwidth();
    trendData.push({
      time: Math.floor(Date.now() / 1000),
      download: d.download,
      upload: d.upload
    });
    // 限制最大点数，避免无限增长
    if (trendData.length > MAX_TREND_POINTS) {
      trendData.shift();
    }
    drawChart();
  }

  /** 模拟负载告警（随机概率触发） */
  function mockCheckLoadWarning() {
    // 10%概率触发高负载提示，仅演示toast效果
    if (Math.random() < 0.1) {
      showToast('当前服务器负载过高，建议前往 <a href="https://cf.upxuu.com" target="_blank" class="underline font-black text-[#f59e0b]">cf.upxuu.com</a>');
    }
  }

  function drawChart() {
    if (!canvasEl || !trendData.length) return;
    var ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    var dpr = window.devicePixelRatio || 1;
    var rect = canvasEl.getBoundingClientRect();
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    var w = rect.width;
    var h = rect.height;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#1e293b' : '#faf8f5';
    ctx.fillRect(0, 0, w, h);

    var pad = { top: 8, bottom: 20, left: 8, right: 8 };
    var cw = w - pad.left - pad.right;
    var ch = h - pad.top - pad.bottom;

    var allVals: number[] = [];
    trendData.forEach(function(d) { allVals.push(d.download); allVals.push(d.upload); });
    var maxVal = Math.max(...allVals, 0.1);

    ctx.strokeStyle = isDark ? '#475569' : '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (var gi = 0; gi <= 4; gi++) {
      var gy = pad.top + (ch / 4) * gi;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(w - pad.right, gy);
      ctx.stroke();
    }

    function xPos(idx: number) {
      return pad.left + (idx / (trendData.length - 1 || 1)) * cw;
    }
    function yPos(val: number) {
      return pad.top + ch - (val / maxVal) * ch;
    }

    var series = [
      { data: trendData.map(function(d) { return d.download; }), color: '#10b981' },
      { data: trendData.map(function(d) { return d.upload; }), color: '#f59e0b' }
    ];

    series.forEach(function(s) {
      if (!s.data.length) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var si = 0; si < s.data.length; si++) {
        var sx = xPos(si), sy = yPos(s.data[si]);
        if (si === 0) ctx.moveTo(sx, sy);
        else { var px = xPos(si - 1), py = yPos(s.data[si - 1]), cp = (px + sx) / 2; ctx.bezierCurveTo(cp, py, cp, sy, sx, sy); }
      }
      ctx.stroke();
    });

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    var step = Math.max(1, Math.floor(trendData.length / 4));
    for (var ti = 0; ti < trendData.length; ti += step) {
      ctx.fillText(new Date(trendData[ti].time * 1000).toLocaleTimeString(), xPos(ti), h - 4);
    }
  }

  function showToast(msg: string) {
    if (document.getElementById('svr-toast')) return;
    var t = document.createElement('div');
    t.id = 'svr-toast';
    t.innerHTML = [
      '<div class="fixed bottom-4 left-2 right-2 sm:left-4 sm:right-auto z-[2000] translate-y-0 opacity-100 transition-all duration-500 ease-out" style="max-width:360px">',
      '  <div class="bg-white dark:bg-slate-800 border-2 border-[#ef4444] shadow-[4px_4px_0px_0px_#ef4444] rounded-sm p-2">',
      '    <div class="bg-red-500 text-white text-[10px] font-black text-center px-2 py-1 rounded-sm mb-1.5">⚠ 服务器负载警告</div>',
      '    <div class="px-1 py-1 text-xs font-bold text-slate-700 dark:text-slate-200">' + msg + '</div>',
      '    <button class="js-toast-close mt-1 text-[10px] text-slate-400 hover:text-[#0284c7] font-bold" style="display:block;margin-left:auto">关闭</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(t);
    var closeBtn = t.querySelector('.js-toast-close') as HTMLElement;
    if (closeBtn) closeBtn.addEventListener('click', function() { t.remove(); });
    setTimeout(function() { if (t.parentNode) t.remove(); }, 10000);
  }

  onMount(function() {
    mockFetchCurrent();
    mockFetchTrend();
    mockFetchAverage();
    mockCheckLoadWarning();

    bwTimer = setInterval(mockFetchCurrent, 5000);
    trendTimer = setInterval(mockFetchTrend, 5000);
    avgTimer = setInterval(mockFetchAverage, 120000);

    // 监听暗黑模式切换，重绘画布
    const observer = new MutationObserver(() => drawChart());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    onDestroy(() => observer.disconnect());
  });

  onDestroy(function() {
    if (bwTimer) clearInterval(bwTimer);
    if (trendTimer) clearInterval(trendTimer);
    if (avgTimer) clearInterval(avgTimer);
  });
</script>

<div class="bg-white dark:bg-slate-800 border-4 border-[#0284c7] p-4 sm:p-6 shadow-[6px_6px_0px_0px_#10b981] rounded-sm">
  <h2 class="text-xl sm:text-2xl font-black text-[#0284c7] tracking-wider mb-4 flex items-center gap-2">
    <span>📊</span> 服务器带宽状态
    <span class="text-xs text-sky‑500 font‑mono">[模拟数据]</span>
  </h2>

  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
    <div class="bg-[rgba(250,248,245,0.55)] dark:bg-slate-700/30 border-2 border-[#0284c7]/20 rounded-sm px-3 py-2">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">实时下载</div>
      <div class="text-lg font-black text-[#10b981] font-mono">{currentDown.toFixed(2)} <span class="text-xs text-slate-400">MB/s</span></div>
    </div>
    <div class="bg-[rgba(250,248,245,0.55)] dark:bg-slate-700/30 border-2 border-[#0284c7]/20 rounded-sm px-3 py-2">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">实时上传</div>
      <div class="text-lg font-black text-[#f59e0b] font-mono">{currentUp.toFixed(2)} <span class="text-xs text-slate-400">MB/s</span></div>
    </div>
    <div class="bg-[rgba(250,248,245,0.55)] dark:bg-slate-700/30 border-2 border-[#0284c7]/20 rounded-sm px-3 py-2">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">60m 平均</div>
      <div class="text-lg font-black text-[#0284c7] font-mono">{avgDown.toFixed(2)} <span class="text-xs text-slate-400">MB/s</span></div>
    </div>
    <div class="bg-[rgba(250,248,245,0.55)] dark:bg-slate-700/30 border-2 border-[#0284c7]/20 rounded-sm px-3 py-2">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">60m 峰值</div>
      <div class="text-lg font-black text-[#ef4444] font-mono">{maxDown.toFixed(2)} <span class="text-xs text-slate-400">MB/s</span></div>
    </div>
  </div>

  <div class="bg-[rgba(250,248,245,0.55)] dark:bg-slate-700/30 border-2 border-[#0284c7]/20 rounded-sm p-2">
    <div class="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
      <span class="inline-flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-[#10b981]"></span> 下载
        <span class="w-2 h-2 rounded-full bg-[#f59e0b]"></span> 上传
        <span class="text-slate-300">| 60s 趋势</span>
      </span>
    </div>
    <canvas bind:this={canvasEl} class="w-full h-[160px] sm:h-[200px] rounded-sm"></canvas>
  </div>

  <div class="mt-2 text-[9px] text-slate-400 font-mono text-right flex items-center justify-end gap-3">
    <span>每 5 秒自动刷新</span>
    <span class="text-[#10b981]">●</span> 下载
    <span class="text-[#f59e0b]">●</span> 上传
  </div>
</div>