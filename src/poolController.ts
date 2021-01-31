import {
    ECommandType,
    EMessageSender,
    EResponseType,
    IMessageResponse,
    IPoolController,
    TTaskKey
} from "../types/controller";
import {IError, ILogger, IPoolOptions, ITaskOptions, IWorkerOptions, TAny, TAnyObject} from "../types/common";
import {WorkerController} from "./workerController";
import {MessageRequest, Task} from "./task";


export class PoolController implements IPoolController {

    private workersPool: WorkerController[] = [];
    private queueOfTasks: Task[] = [];
    private proxyHandlers: Record<string, TAny> = {}

    constructor(private options: IPoolOptions, private handlers: Record<string, string>, private logger: ILogger) {
        if (!options.workerOpt) options.workerOpt = {
            isResetWorker: true
        }
        if (!options.taskOpt) options.taskOpt = {};
        this.upController();
    }

    public getHandlerObject<T extends {}>(handler: string): T {
        if (!this.handlers[handler]) throw new Error(`In pool '${this.options.name}' does not register handler '${handler}'`)
        if (!this.proxyHandlers[handler]) {
            const _self: PoolController = this;
            this.proxyHandlers[handler] = new Proxy<{}>({} as T, {
                get(target: T, p: PropertyKey, receiver: object): Promise<unknown> {
                    if (!target[p as keyof T]) {
                        const callMethod = new Proxy(() => {
                        }, {
                            apply(target: () => void, thisArg: unknown, argArray?: unknown): unknown {
                                return new Promise((res, rej) => {
                                    const task = new Task(_self.options.taskOpt!);
                                    task.request = new MessageRequest(task.key, EMessageSender.HANDLER, ECommandType.RUN, handler, p as string, argArray);
                                    task.resolve = res;
                                    task.reject = rej;

                                    _self.queueOfTasks.push(task);
                                    _self.nextTask();
                                });
                            }
                        });
                        (target as any)[p as keyof T] = callMethod;
                    }
                    // return Reflect.get(receiver, p, {
                    //     [p]: callMethod
                    // });
                    return (target as TAnyObject)[p as keyof Promise<T>];
                },
            });
        }
        return this.proxyHandlers[handler] as T
    }

    public getHandlerFunc<T extends Function>(handler: string): T {
        if (!this.proxyHandlers[handler]) {
            const _self: PoolController = this;
            this.proxyHandlers[handler] = new Proxy(() => {
            }, {
                apply(target: () => void, thisArg: unknown, argArray?: unknown): unknown {
                    return new Promise((res, rej) => {
                        const task = new Task(_self.options.taskOpt!);
                        task.request = new MessageRequest(task.key, EMessageSender.HANDLER, ECommandType.RUN, handler, '', argArray);
                        task.resolve = res;
                        task.reject = rej;

                        _self.queueOfTasks.push(task);
                        _self.nextTask();
                    });
                }
            });
        }
        return this.proxyHandlers[handler] as T
    }

    public getPoolOptions(): IPoolOptions {
        return this.options;
    }

    public getTaskOptions(): ITaskOptions {
        return this.options.taskOpt!;
    }

    public getWorkerOptions(): IWorkerOptions {
        return this.options.workerOpt!;
    }

    public getLogger(): ILogger {
        return this.logger;
    }

    public getHandles(): Record<string, string> {
        return this.handlers;
    }

    private upController() {
        this.workersPool.push(new WorkerController(this))
    }

    private sendSuccessToResult(task: Task, data?: TAny): void {
        if (!task.isSendResponse) {
            task.isSendResponse = true;
            task.resolve!(data);
        }
    }

    private sendErrorToTask(task: Task, error: IError) {
        if (!task.isSendResponse) {
            task.isSendResponse = true;
            task.reject!(error);
        }
    }

    public abortTask(key: TTaskKey, data?: TAny): void {
        this.workersPool.forEach(v => {
            const task = v.abortTask(key);
            if (task) {
                data = data ?? ECommandType.ABORT
                this.sendErrorToTask(task, data as IError);
            }
        });
    }

    public receiveMessage(mess?: IMessageResponse, task?: Task, error?: IError): void {
        if (!task) return;
        try {
            if (mess) {
                switch (mess.sender) {
                    case EMessageSender.HANDLER:
                        break;
                    case EMessageSender.WORKER:
                        switch (mess.type) {
                            case EResponseType.CRITICAL_ERROR:
                                console.log(mess);
                                break;
                            case EResponseType.ERROR:
                                console.log(mess); //check user handler
                                break;
                            case EResponseType.LOGGER:
                                this.logger.error(JSON.stringify(mess.data)); // TODO add normal logger
                                break;
                            case EResponseType.SERVICE:
                                console.log(mess);
                                break;
                            case EResponseType.SUCCESS: // just worker return void.
                                break;
                            case EResponseType.WORKER_RUN:
                                console.error(mess);
                                this.queueOfTasks.unshift(task);
                                break;
                            default:
                                this.logger.error('unknown message type!');
                                break;
                        }
                        break;
                    default:
                        this.logger.error('unknown message sender!');
                        break;
                }
                this.sendSuccessToResult(task, mess.data);
            } else {
                error ? this.sendErrorToTask(task, error || new Error('undefined error')) : this.sendSuccessToResult(task)
            }
        } catch (e) {
            this.logger.error(e);
        } finally {
            this.nextTask();
        }
    }

    public nextTask(): void {
        if (this.queueOfTasks.length) {
            this.workersPool[0].runTask(this.queueOfTasks.shift()!);
        }

    }
}
