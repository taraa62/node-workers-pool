import {ILogger, IPoolOptions, ITaskOptions, IWorkerOptions, TAny} from "./common";
import {Task} from "../src/task";

export interface IPoolController {

    getPoolOptions(): IPoolOptions;

    getWorkerOptions(): IWorkerOptions;

    getTaskOptions(): ITaskOptions;

    getLogger(): ILogger;

    getHandles(): Record<string, string>;

    getHandler<T>(handler: string): T;

    nextTask(): void;

    receiveMessage(mess?: IMessageResponse, task?: Task): void;
}

export const enum EMessageSender {
    SERVICE = 0,
    POOL = 1,
    CONTROLLER = 2,
    WORKER = 3,
    HANDLER = 4
}

export const enum ECommandType {
    INIT = 0,
    RUN = 1,
    CLOSE = 2,
}

export const enum EResponseType {
    SUCCESS = 3,
    ERROR = 4,
    CRITICAL_ERROR = 5,
    WORKER_RUN = 6,
    LOGGER = 7,
    SERVICE = 8
}


export interface IMessageRequest {
    readonly  key: string;
    readonly sender: EMessageSender;
    readonly command: ECommandType;
    readonly handler: string;
    readonly execute?: string;
    readonly  params?: TAny;
}

export interface IMessageResponse {
    readonly key: string,
    readonly type: EResponseType;
    readonly sender: EMessageSender;
    readonly data: TAny;
}
