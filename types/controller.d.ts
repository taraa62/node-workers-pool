import {ILogger, IPoolOptions, ITaskOptions, IWorkerOptions, TAny} from "./common";
import {Task} from "../src/task";
import {ECommandType, EMessageSender, EResponseType} from "../src/common";

export type TTaskKey = string;
export type TWorkerKey = string;

export interface IPoolController {

    getPoolOptions(): IPoolOptions;

    getWorkerOptions(): IWorkerOptions;

    getTaskOptions(): ITaskOptions;

    getLogger(): ILogger;

    getHandles(): Record<string, string>;

    getHandlerObject<T extends {}>(handler: string): T;

    getHandlerFunc<T extends Function>(handler: string): T;

    nextTask(): void;

    receiveMessage(workerKey:TWorkerKey, mess?: IMessageResponse, task?: Task): void;

    resetTask(task: Task): void;

    destroy():void;
}
export interface IMessageRequest {
    readonly  key: string;
    readonly  sender: EMessageSender;
    readonly  command: ECommandType;
    readonly  handler: string;
    readonly  execute?: string;
    readonly  params?: TAny | Array<TAny | IStreamParam>;

    isStream?: boolean;
    isChunk?:boolean;
    isStreamError?: boolean;
    streamKey?: TTaskKey;

}

export interface IMessageResponse {
    readonly key: string,
    readonly type: EResponseType;
    readonly sender: EMessageSender;
    readonly command: ECommandType;
    readonly data: TAny;
}

export interface IStreamParam {
    stream: boolean;
}
