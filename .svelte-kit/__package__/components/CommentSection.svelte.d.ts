import { SvelteComponent } from "svelte";
import type { Post } from '../types';
declare const __propDef: {
    props: {
        post: Post;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
    exports?: {} | undefined;
    bindings?: string | undefined;
};
export type CommentSectionProps = typeof __propDef.props;
export type CommentSectionEvents = typeof __propDef.events;
export type CommentSectionSlots = typeof __propDef.slots;
export default class CommentSection extends SvelteComponent<CommentSectionProps, CommentSectionEvents, CommentSectionSlots> {
}
export {};
//# sourceMappingURL=CommentSection.svelte.d.ts.map