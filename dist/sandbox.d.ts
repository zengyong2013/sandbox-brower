declare type FakeWindow = Window & Record<PropertyKey, any>;
declare class Sandbox {
    fakeWindow: FakeWindow;
    proxy: Window;
    updateKeys: Set<unknown>;
    listenerMap: Map<string, EventListenerOrEventListenerObject[]>;
    timeoutList: number[];
    intervalList: number[];
    originKeys: string[];
    showlog: boolean;
    hasDisposed: boolean;
    constructor(showlog?: boolean);
    execScript(scriptText: string): void;
    showWindowKeys(): string[];
    preview(): void;
    dispose(): void;
}
export default Sandbox;
