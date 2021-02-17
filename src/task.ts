import {IMessageRequest, IMessageResponse, IStreamParam, TTaskKey, TWorkerKey} from "../types/controller";
import {Random} from "./utils/Random";
import {IError, ITaskOptions, TAny} from "../types/common";
import {ECommandType, EMessageSender, EResponseType} from "./common";

export class MessageRequest implements IMessageRequest {

    public isStream = false;
    public isChunk?: boolean;
    public streamKey?: TTaskKey;
    public isStreamError?: boolean;
    public chunkId = 0;

    constructor(
        public key: TTaskKey,
        public sender: EMessageSender,
        public command: ECommandType,
        public handler: string,
        public execute?: string,
        public params?: TAny | Array<TAny | IStreamParam>
    ) {
    }
}

export class MessageResponse implements IMessageResponse {
    constructor(public key: TTaskKey,
                public type: EResponseType,
                public sender: EMessageSender,
                public command: ECommandType,
                public data: unknown
    ) {
    }
}

export class Task {
    public key: TTaskKey = Random.randomString(16); //key, for stop run current task;
    public workerKey?: TWorkerKey;

    public isRun: boolean = false;
    public isEnd: boolean = false;
    public isSendResponse = false;
    public isStream = false;  // the first task with streams params
    public timerKey?: number;
    public resolve?: (value?: unknown) => void;
    public reject?: (error?: unknown) => void;
    public request?: IMessageRequest;
    public numReset = 0;
    public postRunData?: TAny;

    public parent?: Task;


    constructor(private options: ITaskOptions) {
    }

    public set run(callback: (task: Task) => void) {
        this.isRun = true;
        this.timerKey = setTimeout(callback, this.options.timeout, this);
    }

    public reset(): boolean {
        clearTimeout(this.timerKey!);
        this.numReset++;
        if (this.isSendResponse || this.numReset >= this.options.maxRunAttempts!) {
            return false;
        }
        this.key = Random.randomString(16);
        this.isRun = false;
        this.isEnd = false;
        this.isSendResponse = false;
        return true;
    }


    public send(error: IError | null, data?: TAny): void {
        if (!this.isSendResponse) {
            this.isSendResponse = true;
            clearTimeout(this.timerKey!);
            error ? this.reject!(error) : this.resolve!(data);
        }
    }
}

/*

потрібно добвити чекер на наявність задач які були загублені в процесі.
по виявленню такого потрібно щось робити?
 */
