import { SvelteComponent } from "svelte";
import type { BlogPost } from '../types';
declare const __propDef: {
    props: {
        post: BlogPost;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
    exports?: {} | undefined;
    bindings?: string | undefined;
};
export type BlogPostProps = typeof __propDef.props;
export type BlogPostEvents = typeof __propDef.events;
export type BlogPostSlots = typeof __propDef.slots;
export default class BlogPost extends SvelteComponent<BlogPostProps, BlogPostEvents, BlogPostSlots> {
}
export {};
//# sourceMappingURL=BlogPost.svelte.d.ts.map