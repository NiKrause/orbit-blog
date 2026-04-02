/** Gateway used in HTML video embeds for rendered posts (Story 5.2). */
export const IPFS_VIDEO_GATEWAY = 'https://dweb.link/ipfs/';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Appends a sanitized HTML `<video>` block pointing at the CID via the public gateway.
 * Pairs with `removeVideoEmbedFromContent` and `MarkdownRenderer` DOMPurify allowlist.
 */
export function appendVideoEmbedToContent(content: string, cid: string): string {
  const src = `${IPFS_VIDEO_GATEWAY}${cid}`;
  const block = `\n\n<video controls preload="metadata" playsinline data-ipfs-cid="${cid}" src="${src}"></video>\n\n`;
  return content + block;
}

/** Removes the video block created by `appendVideoEmbedToContent` for this CID. */
export function removeVideoEmbedFromContent(cid: string, content: string): string {
  const escaped = escapeRegExp(cid);
  const re = new RegExp(
    `\\n\\n<video[\\s\\S]*?data-ipfs-cid="${escaped}"[\\s\\S]*?></video>\\n\\n`,
    'g',
  );
  return content.replace(re, '');
}

/** Adds a CID to selected media without duplicating. */
export function addCidToSelectedMedia(cid: string, selectedMedia: string[]): string[] {
  if (selectedMedia.includes(cid)) return selectedMedia;
  return [...selectedMedia, cid];
}
