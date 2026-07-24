/** Pragmatic DOM typings for migrated editor JS→TS modules. */
export {};

declare global {
  interface Element {
    value: any;
    checked: boolean;
    files: FileList | null;
    hidden: boolean;
    disabled: boolean;
    selectionStart: number | null;
    selectionEnd: number | null;
    setSelectionRange(start: number, end: number, direction?: string): void;
    focus(...args: any[]): void;
    click(): void;
    blur(): void;
    select(): void;
    title: string;
    type: string;
    name: string;
    placeholder: string;
    readOnly: boolean;
    selectedIndex: number;
    options: any;
    rows: any;
    cols: any;
    min: any;
    max: any;
    step: any;
    src: string;
    alt: string;
    href: string;
    setAttribute(name: string, value: string): void;
    getAttribute(name: string): string | null;
    removeAttribute(name: string): void;
    style: CSSStyleDeclaration;
    dataset: DOMStringMap;
    classList: DOMTokenList;
    className: string;
    id: string;
    innerHTML: string;
    textContent: string | null;
    parentElement: HTMLElement | null;
    closest: HTMLElement['closest'];
    matches: Element['matches'];
    appendChild: Node['appendChild'];
    remove(): void;
    addEventListener: HTMLElement['addEventListener'];
    removeEventListener: HTMLElement['removeEventListener'];
    querySelector: ParentNode['querySelector'];
    querySelectorAll: ParentNode['querySelectorAll'];
    insertAdjacentHTML: HTMLElement['insertAdjacentHTML'];
    insertAdjacentElement: HTMLElement['insertAdjacentElement'];
    scrollIntoView: Element['scrollIntoView'];
    getBoundingClientRect: Element['getBoundingClientRect'];
  }

  interface EventTarget {
    tagName?: string;
    value?: any;
    classList?: DOMTokenList;
    closest?: Element['closest'];
  }

  interface Event {
    dataTransfer: DataTransfer | null;
    clientX: number;
    clientY: number;
    button: number;
    key: string;
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    target: any;
    currentTarget: any;
  }

  interface Window {
    showSaveFilePicker?: (...args: any[]) => Promise<any>;
  }
}
