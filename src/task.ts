import {
    ECommandType,
    EMessageSender,
    EResponseType,
    IMessageRequest,
    IMessageResponse,
    TTaskKey
} from "../types/controller";
import {Random} from "./utils/Random";
import {IError, ITaskOptions, TAny} from "../types/common";

export class MessageRequest implements IMessageRequest {

    constructor(
        public key: TTaskKey,
        public sender: EMessageSender,
        public command: ECommandType,
        public handler: string,
        public execute?: string,
        public params?: unknown
    ) {
    }
}

export class MessageResponse implements IMessageResponse {
    constructor(public key: TTaskKey,
                public type: EResponseType,
                public sender: EMessageSender,
                public data: unknown
    ) {
    }
}

export class Task {
    public readonly key: TTaskKey = Random.randomString(16); //key, for stop run current task;

    public isRun: boolean = false;
    public isEnd: boolean = false;
    public isSendResponse = false;
    public timerKey?: number;
    public resolve?: (value?: unknown) => void;
    public reject?: (error?: unknown) => void;
    public request?: IMessageRequest;
    public numReset = 0;


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

        this.isRun = false;
        this.isEnd = false;
        this.isSendResponse = false;
        this.reject = this.resolve = undefined;
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
