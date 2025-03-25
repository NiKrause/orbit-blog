import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        onMediaSelected?: (mediaCid: string) => void;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
    exports?: {} | undefined;
    bindings?: string | undefined;
};
export type MediaUploaderProps = typeof __propDef.props;
export type MediaUploaderEvents = typeof __propDef.events;
export type MediaUploaderSlots = typeof __propDef.slots;
export default class MediaUploader extends SvelteComponent<MediaUploaderProps, MediaUploaderEvents, MediaUploaderSlots> {
}
export {};
//# sourceMappingURL=MediaUploader.svelte.d.ts.map