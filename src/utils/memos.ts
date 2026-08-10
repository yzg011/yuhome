/**
 * 从 Memos API 获取说说列表，供 RSS 生成和页面构建使用（构建时 fetch）
 */
const API_BASE = 'https://ss.z2m.store';
const IMG_DOMAIN = 'https://ss.z2m.store';

export interface MemoRssItem {
  id: string;
  title: string;
  date: string;
  pubDate: string;
  description: string;
  content: string;
  url: string;
}

/** 与 TalkItem（postsFetcher.ts）兼容的说说数据 */
export interface MemoTalkItem {
  id: string;
  slug: string;
  title: string;
  date: string;
  content: string;
  tags: string[];
  location: string;
  weather: string;
  mood: string;
  device: string;
}

/**
 * 去除 Markdown 格式，提取纯文本描述
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')        // 去掉图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接变纯文本
    .replace(/[#*`_~>|\-]/g, '')             // 去掉 markdown 标记
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 将 Memos 附件拼接为 Markdown 图片语法
 */
function buildImageMarkdown(attachments?: any[]): string {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  const images = attachments
    .filter((a: any) => a.type && a.type.startsWith('image/'))
    .map((a: any) => {
      const url = `${IMG_DOMAIN}/file/attachments/${a.uid}/${a.filename}`;
      return `![${a.filename || '图片'}](${url})`;
    });
  return images.length ? '\n\n' + images.join('\n') : '';
}

/**
 * 将 Memos 创建时间转为 RSS pubDate（RFC 2822，UTC）
 */
function toRssPubDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

/**
 * 将 Memos 返回的时间格式化为 YYYY-MM-DD HH:MM:SS
 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 提取 #tag 标签
 */
function extractTags(content: string): string[] {
  return Array.from(content.matchAll(/(?:^|\s)#([\w\u4e00-\u9fa5-]+)/g)).map(m => m[1]);
}

/**
 * 内部函数：分页拉取所有原始 Memos 数据
 */
async function fetchRawMemos(pageSize = 50): Promise<any[]> {
  let allMemos: any[] = [];
  let pageToken = '';
  let hasMore = true;

  while (hasMore) {
    let url = `${API_BASE}/api/v1/memos?pageSize=${pageSize}&sort=createTime&order=desc`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[Memos API] 请求失败 HTTP ${res.status}`);
        break;
      }
      const data = await res.json();
      const memos = Array.isArray(data.memos) ? data.memos : [];
      allMemos.push(...memos);

      pageToken = data.nextPageToken || '';
      hasMore = !!pageToken && memos.length > 0;
    } catch (e) {
      clearTimeout(timeout);
      console.warn('[Memos API] 请求异常:', e);
      break;
    }
  }

  return allMemos;
}

/**
 * 获取所有说说（用于 RSS）
 */
export async function fetchAllMemos(pageSize = 50): Promise<MemoRssItem[]> {
  const allMemos = await fetchRawMemos(pageSize);

  return allMemos.map((memo: any) => {
    const rawContent = memo.content || '';
    const imageMd = buildImageMarkdown(memo.attachments);
    const fullContent = rawContent + imageMd;
    const id = memo.uid || String(memo.id || '');

    return {
      id,
      title: '日常动态',
      date: formatDate(memo.createTime),
      pubDate: toRssPubDate(memo.createTime),
      description: stripMarkdown(rawContent).slice(0, 150),
      content: fullContent,
      url: `https://tblog.z2m.store/talk/${id}`,
    };
  });
}

/**
 * 获取所有说说（用于页面构建，返回 TalkItem 兼容格式）
 */
export async function fetchTalkItems(pageSize = 50): Promise<MemoTalkItem[]> {
  const allMemos = await fetchRawMemos(pageSize);

  return allMemos.map((memo: any) => {
    const rawContent = memo.content || '';
    const imageMd = buildImageMarkdown(memo.attachments);
    const fullContent = rawContent + imageMd;
    const id = memo.uid || (memo.name ? memo.name.split('/').pop() : '') || String(memo.id || '');

    return {
      id,
      slug: id,
      title: '日常动态',
      date: formatDate(memo.createTime),
      content: fullContent,
      tags: extractTags(rawContent),
      location: '',
      weather: '',
      mood: '',
      device: '',
    };
  });
}
