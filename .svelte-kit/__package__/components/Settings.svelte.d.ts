import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
    exports?: {} | undefined;
    bindings?: string | undefined;
};
export type SettingsProps = typeof __propDef.props;
export type SettingsEvents = typeof __propDef.events;
export type SettingsSlots = typeof __propDef.slots;
export default class Settings extends SvelteComponent<SettingsProps, SettingsEvents, SettingsSlots> {
}
export {};
//# sourceMappingURL=Settings.svelte.d.ts.map