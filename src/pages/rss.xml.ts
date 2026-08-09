import { getCollection } from 'astro:content';
import { siteConfig } from '../config/site';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import type { APIContext } from 'astro';

const parser = new MarkdownIt();

// 清除XML非法字符
function stripInvalidXmlChars(str: string): string {
  if (!str) return '';
  return str.replace(
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
    '',
  );
}

// 去除Markdown标记，清理多余换行空格
function stripMarkdown(md: string): string {
  if (!md) return '';
  return md
    .replace(/[#*`_\[\]()\->|~]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 北京时间转标准RFC2822 GMT时间
function beijingRfc2822(value: unknown): string {
  if (!value) return new Date().toUTCString();
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return new Date().toUTCString();
  // 北京时间UTC+8，减去8小时转为标准UTC时间
  const utc = new Date(d.getTime() - 8 * 60 * 60 * 1000);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[utc.getUTCDay()]}, ${String(utc.getUTCDate()).padStart(2, '0')} ${months[utc.getUTCMonth()]} ${utc.getUTCFullYear()} ${String(utc.getUTCHours()).padStart(2, '0')}:${String(utc.getUTCMinutes()).padStart(2, '0')}:${String(utc.getUTCSeconds()).padStart(2, '0')} GMT`;
}

// XML特殊字符转义
function escapeXml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 生成单条RSS Item模板
function renderItem(
  title: string,
  url: string,
  desc: string,
  pubDate: string,
  content: string,
  author: string
): string {
  return [
    '  <item>',
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(url)}</link>`,
    `    <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    `    <description>${escapeXml(desc)}</description>`,
    `    <pubDate>${pubDate}</pubDate>`,
    `    <dc:creator><![CDATA[${author}]]></dc:creator>`,
    `    <content:encoded><![CDATA[${content}]]></content:encoded>`,
    '  </item>',
  ].join('\n');
}

export async function GET(context: APIContext) {
  const [posts, talks] = await Promise.all([
    getCollection('posts'),
    getCollection('talks'),
  ]);

  // 站点地址，自动去除末尾斜杠，防止双斜杠
  const siteUrl = (context.site ?? new URL(siteConfig.url))
    .toString()
    .replace(/\/+$/, '');
  const author = siteConfig.author;

  // 文章列表处理（路由改为 /blog/，解决 /blog/undefined）
  const postItems = posts.map((post) => {
    const body = typeof post.body === 'string' ? post.body : '';
    const cleaned = stripInvalidXmlChars(body);
    // 多层兜底，绝对避免 undefined
    const fallbackSlug = String(post.data.published || post.data.date || Date.now());
    const rawSlug = post.data.slug || post.slug || post.id || fallbackSlug;
    const slug = String(rawSlug).trim();

    // 你的文章页面路由是 /blog/
    const url = `${siteUrl}/blog/${slug}/`;
    const pubDate = beijingRfc2822(post.data.published || post.data.date);
    const summary = post.data.description || stripMarkdown(body).substring(0, 150);
    // 渲染HTML，保留图片标签
    const htmlContent = sanitizeHtml(parser.render(cleaned), {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    });

    return {
      sortTime: new Date(pubDate).getTime() || 0,
      html: renderItem(post.data.title, url, summary, pubDate, htmlContent, author),
    };
  });

  // 说说列表处理
  const talkItems = talks.map((talk) => {
    const body = typeof talk.body === 'string' ? talk.body : '';
    const cleaned = stripInvalidXmlChars(body);
    // 强制兜底，杜绝undefined
    const fallbackSlug = String(talk.data.date || Date.now());
    const rawSlug = talk.data.slug || talk.slug || talk.id || fallbackSlug;
    const slug = String(rawSlug).trim();

    // 请根据你的实际页面文件夹二选一：
    // 页面文件是 talk/[slug].astro 用下面这行
    const url = `${siteUrl}/talk/${slug}/`;
    // 页面文件是 talks/[slug].astro 取消上面，启用这行
    // const url = `${siteUrl}/talks/${slug}/`;

    const pubDate = beijingRfc2822(talk.data.date);
    const summary = stripMarkdown(body).substring(0, 200);
    const htmlContent = sanitizeHtml(parser.render(cleaned), {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    });

    return {
      sortTime: new Date(pubDate).getTime() || 0,
      html: renderItem(`「说说」${talk.data.title}`, url, summary, pubDate, htmlContent, author),
    };
  });

  // 合并 + 按发布时间倒序
  const allItems = [...postItems, ...talkItems]
    .sort((a, b) => b.sortTime - a.sortTime)
    .map((i) => i.html)
    .join('\n');

  // 最终RSS结构
  const now = new Date();
  const rssFeed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"',
    '  xmlns:atom="http://www.w3.org/2005/Atom"',
    '  xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '>',
    '  <channel>',
    `    <title>${escapeXml(siteConfig.title)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(siteConfig.subtitle || '')}</description>`,
    `    <language>zh-CN</language>`,
    `    <lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(siteUrl)}/rss.xml" rel="self" type="application/rss+xml"/>`,
    allItems,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(rssFeed, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
