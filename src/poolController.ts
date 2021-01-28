import {ECommandType, EMessageSender, IMessageResponse, IPoolController} from "../types/controller";
import {ILogger, IPoolOptions, ITaskOptions, IWorkerOptions, TAny, TAnyObject} from "../types/common";
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

    public getHandler<T>(handler: string): T {
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

    public receiveMessage(mess?: IMessageResponse, task?:Task): void {

    }

    public nextTask(): void {

    }
}
