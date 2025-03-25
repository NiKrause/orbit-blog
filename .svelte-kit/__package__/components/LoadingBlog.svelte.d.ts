/** @typedef {typeof __propDef.props}  LoadingBlogProps */
/** @typedef {typeof __propDef.events}  LoadingBlogEvents */
/** @typedef {typeof __propDef.slots}  LoadingBlogSlots */
export default class LoadingBlog extends SvelteComponent<{
    message?: string | undefined;
}, {
    [evt: string]: CustomEvent<any>;
}, {}> {
}
export type LoadingBlogProps = typeof __propDef.props;
export type LoadingBlogEvents = typeof __propDef.events;
export type LoadingBlogSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        message?: string | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
    exports?: undefined;
    bindings?: undefined;
};
export {};
//# sourceMappingURL=LoadingBlog.svelte.d.ts.map