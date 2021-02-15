import {Stream} from "stream";
import fs from "fs";

export interface IAAWorker {
    getHelloWorld(param: string): Promise<string>;
}

export interface IBBWorker {
    bb(): Promise<string>;

    bbP(val: string, val1: number): Promise<string>;

    sum(val1: number, val2: number): Promise<number>;

    returnData(val: number): Promise<number>;

    returnDataLong(val: number, time: number): Promise<number>;
}

export type ICC = () => Promise<string>;

export interface IStreamWorker {
    write(file: string, stream: Stream): Promise<void>;

    read(file: string): Promise<fs.ReadStream>;
}
