import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        isNewUser?: boolean;
        encryptedSeedPhrase?: string | null;
    };
    events: {
        seedPhraseCreated: CustomEvent<any>;
        seedPhraseDecrypted: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
    exports?: {} | undefined;
    bindings?: string | undefined;
};
export type PasswordModalProps = typeof __propDef.props;
export type PasswordModalEvents = typeof __propDef.events;
export type PasswordModalSlots = typeof __propDef.slots;
export default class PasswordModal extends SvelteComponent<PasswordModalProps, PasswordModalEvents, PasswordModalSlots> {
}
export {};
//# sourceMappingURL=PasswordModal.svelte.d.ts.map