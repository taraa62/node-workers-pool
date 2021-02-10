import {IMessageResponse, IPoolController, TWorkerKey} from "../types/controller";
import {
    EWorkerMode,
    IError,
    ILogger,
    IPoolOptions,
    ITaskOptions,
    IWorkerOptions,
    TAny,
    TAnyObject
} from "../types/common";
import {CommonWorkerStatus, WorkerController} from "./workerController";
import {MessageRequest, Task} from "./task";
import {ECommandType, EMessageSender, EResponseType} from "./common";

/*
TODO
якщо воркер є синхронний, тоді не має смислу піднімати кілька потоків, min=max=1
 */
export class PoolController implements IPoolController {

    private workersPool: Map<TWorkerKey, WorkerController> = new Map<TWorkerKey, WorkerController>();
    private queueOfTasks: Task[] = [];
    private proxyHandlers: Record<string, TAny> = {};
    private isClose = false; //it is not set


    constructor(private options: IPoolOptions, private handlers: Record<string, string>, private logger: ILogger) {
        // workerOpt
        if (!options.workerOpt) options.workerOpt = {}
        if (!options.workerOpt.maxTaskAsync) {
            options.workerOpt.maxTaskAsync = 20;
        }
        if (options.workerOpt.maxTaskAsync < 2) {
            options.mode = EWorkerMode.SYNC;
        }
        if (options.mode === EWorkerMode.SYNC) {
            options.minWorkers = options.maxWorkers = 1;
        }
        // taskOpt
        if (!options.taskOpt) options.taskOpt = {};
        if (!options.taskOpt.maxRunAttempts || options.taskOpt.maxRunAttempts < 1) {
            options.taskOpt.maxRunAttempts = 5;
        }
        if (!options.taskOpt.timeout || options.taskOpt.timeout < 1) {
            options.taskOpt.timeout = 30000;
        }
        // worker pool
        if (!options.minWorkers || options.minWorkers < 1 || options.minWorkers > 5) {
            options.minWorkers = 1;
        }
        if (!options.maxWorkers || options.maxWorkers < options.minWorkers || options.maxWorkers > 10) {
            options.maxWorkers = options.minWorkers;
        }

        this.checkPool();
    }

    public getHandlerObject<T extends {}>(handler: string): T {
        if (this.isClose) throw new Error('Worker pool controller was closed.')
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
        if (this.isClose) throw new Error('Worker pool controller was closed.')
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

    public receiveMessage(mess: IMessageResponse, task?: Task, error?: IError): void {
        if (!task && mess) {
            task = this.queueOfTasks.find(v => v.key === mess.key)
        }
        try {
            switch (mess.sender) {
                case EMessageSender.HANDLER:
                    if (task) task.send(null, mess.data);
                    break;
                case EMessageSender.WORKER:
                    switch (mess.type) {
                        case EResponseType.CRITICAL_ERROR:
                            this.logger.error(mess.data as Error);
                            //якщо при ініціалізації виникла критична помилка,тоді ми повинні зрохнути пул
                            break;
                        case EResponseType.ERROR:
                            console.log(mess); //check user handler
                            break;
                        case EResponseType.LOGGER:
                            this.logger[mess.key as keyof ILogger](mess.data as string | Error);
                            break;
                        case EResponseType.SERVICE:
                            console.log(mess);
                            debugger
                            break;
                        case EResponseType.SUCCESS: // just worker return void.
                            debugger
                            break;
                        case EResponseType.WORKER_RUN:
                            if (task) this.resetTask(task);
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

        } catch (e) {
            this.logger.error(e);
        } finally {
            this.checkPool();
            this.nextTask();
        }
    }

    public nextTask(): void {
        if (!this.isClose) {
            if (this.queueOfTasks.length) {
                const info = this.checkPool();
                let worker: WorkerController | undefined;
                if (this.options.mode === EWorkerMode.ASYNC) {
                    worker = this.workersPool.get(info.workerKeyMinTasks!);
                } else {
                    const workers: Iterable<WorkerController> = this.workersPool.values();
                    for (const item of workers) {
                        if (item.isFree) {
                            worker = item;
                            break;
                        }
                    }
                }
                if (worker) {
                    const task = this.queueOfTasks.shift();
                    if (task?.isSendResponse) return this.nextTask();
                    if (task && !worker.runTask(task)) {
                        this.queueOfTasks.unshift(task);
                    }
                }
            }
        }
    }

    public resetTask(task: Task): void {
        if (!this.isClose) {
            if (task.reset())
                this.queueOfTasks.unshift(task);
            else task.send({name: 'resetLimitOut', message: `Reset restriction exhausted`} as IError);
        } else {
            task.send({name: 'close', message: `The worker was closed`} as IError);
        }
    }

    public destroy(): void {
        this.workersPool.forEach(c => c.destroy(EMessageSender.SERVICE));
        this.queueOfTasks.forEach(v => this.resetTask(v));

        this.workersPool.clear();
        this.queueOfTasks = [];
        this.proxyHandlers = {};
    }

    private getWorkersInfo(): CommonWorkerStatus {
        const info: CommonWorkerStatus = new CommonWorkerStatus();

        for (const [key, item] of this.workersPool) {
            item.giveStatus(info);
            if (info.tasks[key] > info.workerMinTasks) {
                info.workerMinTasks = info.tasks[key];
                info.workerKeyMinTasks = key;
            }
        }
        return info;
    }

    private checkPool(): CommonWorkerStatus {
        if (this.isClose) throw new Error('Worker pool controller was closed.')
        const info = this.getWorkersInfo();

        const isAddWorker = (): boolean => {
            if ((info.active) >= this.options.maxWorkers!) return false;
            else if (info.active < this.options.minWorkers!) return true;
            else {

                if (info.up > 0) return false;
                if (this.options.isUpWorker) {
                    return this.options.isUpWorker?.call(null, this.options, {
                        info,
                        awaitTasks: this.queueOfTasks.length
                    });
                } else {
                    // якщо синхронний і задач які чекають на виконнання більше 5, то піднімаємо
                    //якщо асинхронний і мінімальна кількість задач які обробляються на данний момент >=
                    if (this.options.mode === EWorkerMode.SYNC) {
                        return this.queueOfTasks.length > 5
                    } else {
                        return info.workerMinTasks >= this.options.workerOpt!.maxTaskAsync!;
                    }
                }
            }
        }
        const isAdd = isAddWorker();
        if (isAdd) {
            const worker = new WorkerController(this)
            this.workersPool.set(worker.key, worker);
        }
        return info;
    }

}
