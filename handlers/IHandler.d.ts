export interface IAAWorker {
    getHelloWorld(param: string): Promise<string>;
}

export interface IBBWorker {
    bb(): Promise<string>;

    bbP(val: string, val1: number): Promise<string>;
}

export type ICC = () => Promise<string>;
