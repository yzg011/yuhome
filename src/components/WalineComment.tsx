import { useEffect, useRef } from 'react';
import { init } from '@waline/client';
import '@waline/client/waline.css';
import { siteConfig } from '../config/site';

export function WalineComment() {
  const containerRef = useRef<HTMLDivElement>(null);
  const walineInstanceConfig = useRef<any>(null);

  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      if (e.reason && e.reason.message === 'Failed to fetch') {
        // Prevent Waline fetch errors from bubbling up to the error overlay
        e.preventDefault();
        console.warn('Waline fetch failed globally intercepted.');
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);

    // Intercept HTMLImageElement.prototype.src setter.
    // Waline renders emoji reactions as <img> with the emoji char as `src` before the
    // element is in the DOM, so MutationObserver is too late. We patch the property
    // descriptor to catch the set call before the browser initiates the network request.
    const imgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    const originalSrcSet = imgSrcDesc.set!;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      get: imgSrcDesc.get,
      set(value: string) {
        // Replace emoji-as-src (any non-ASCII characters) with a blank GIF data URI
        if (typeof value === 'string' && /[^\x00-\x7F]/.test(value)) {
          originalSrcSet.call(this, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
          return;
        }
        originalSrcSet.call(this, value);
      },
      configurable: true,
      enumerable: true,
    });

    if (containerRef.current) {
      let p = window.location.pathname.replace(/\/+/g, '/');
      if (!p.endsWith('/')) p += '/';
      walineInstanceConfig.current = init({
        el: containerRef.current,
        serverURL: siteConfig.waline.serverURL,
        path: p,
        dark: 'html.dark',
        search: false,
        reaction: ['❤️'],
        placeholder: '写几个字证明你来过~',
      });
    }

    return () => {
      // Restore original setter
      Object.defineProperty(HTMLImageElement.prototype, 'src', imgSrcDesc);
      walineInstanceConfig.current?.destroy();
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <div className="waline-custom-theme bg-white dark:bg-slate-800 border-4 border-[#0284c7] p-3 sm:p-5 shadow-[6px_6px_0px_0px_#0284c7] sm:shadow-[8px_8px_0px_0px_#0284c7] rounded-sm mt-8">
      <h3 className="text-xl font-black text-[#0284c7] border-b-4 border-[#0284c7] pb-2 mb-4 uppercase inline-block pr-6 tracking-widest relative">
        Comments
        <div className="absolute -top-2 -right-3 w-4 h-4 bg-[#fde68a] border-2 border-[#0284c7] shadow-[2px_2px_0px_0px_#0284c7] rounded-sm transform rotate-12"></div>
      </h3>
      <div ref={containerRef} />
      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 text-center mt-3 font-medium">
        （因不知名因素，海外IP暂时无法加载评论，请关闭代理）
      </p>
    </div>
  );
}
