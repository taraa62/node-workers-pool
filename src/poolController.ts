import {IMessageResponse, IPoolController, TTaskKey, TWorkerKey} from "../types/controller";
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
import {WorkerService} from "../types/service";
import {Readable} from "stream";

/*
TODO
якщо воркер є синхронний, тоді не має смислу піднімати кілька потоків, min=max=1


потрібно зробити глобальну статистику по збору інфо
перезагрузки воркерів
найдовший/найкоротший час роботи воркера
список методів які закінчились крешом

 */
export class PoolController implements IPoolController {

    private workersPool: Map<TWorkerKey, WorkerController> = new Map<TWorkerKey, WorkerController>();
    private queueOfTasks: Task[] = [];
    private proxyHandlers: Record<string, TAny> = {};
    private isClose = false;
    private streamsKeys: Record<TTaskKey, TWorkerKey> = {};


    constructor(private readonly service: WorkerService, private options: IPoolOptions, private handlers: Record<string, string>, private logger: ILogger) {
        // workerOpt
        if (!options.workerOpt) options.workerOpt = {};
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
                            apply(target: () => void, thisArg: unknown, argArray?: unknown[]): unknown {
                                return _self.getApplyFunc(_self, handler, p as string, target, thisArg, argArray);
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
                apply(target: () => void, thisArg: unknown, argArray?: unknown[]): unknown {
                    return _self.getApplyFunc(_self, handler, '', target, thisArg, argArray);
                }
            });
        }
        return this.proxyHandlers[handler] as T
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
                    if (!task || task.isSendResponse) return this.nextTask();
                    if (task.request!.isStream) {
                        const workerKey = this.streamsKeys[task.request!.streamKey!]
                        worker = this.workersPool.get(workerKey)!;
                        if (!worker) {
                            console.log(task.request);
                            task.reject!(new Error('Worker was destroyed'));
                        } else {
                            if (!worker.runTask(task)) {
                                task.reject!(new Error('something was wrong!'));
                            }
                        }
                    } else {
                        const isRun = worker.runTask(task);
                        if (!isRun) {
                            this.queueOfTasks.unshift(task);
                        } else {
                            if (task.isStream) {
                                this.streamsKeys[task.key] = worker.key;
                            }
                        }
                    }
                }
            }
        }
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

    public receiveMessage(workerKey: TWorkerKey, mess: IMessageResponse, task?: Task, error?: IError): void {
        if (!task && mess) {
            task = this.queueOfTasks.find(v => v.key === mess.key)
        }
        try {
            switch (mess.sender) {
                case EMessageSender.HANDLER:
                    if (task) {
                        // if it is stream and that is end.
                        if (task.isStream) {
                            task.postRunData = mess.data;
                        } else {
                            task.send(null, mess.data);
                            if (task.request!.isStream) {
                                if (task.request!.isEndStream && task.parent) {
                                    delete this.streamsKeys[task.parent!.key];
                                    task.parent.send(null, task.postRunData);
                                }
                            }
                        }
                    }
                    if (!this.isClose) {  // TODO move to finally
                        this.checkPool();
                        this.nextTask();
                    }
                    break;
                case EMessageSender.WORKER:
                    switch (mess.type) {
                        case EResponseType.CRITICAL_ERROR:
                            this.logger.error(mess.data as Error);
                            const contr = this.workersPool.get(workerKey)!;
                            if (mess.command === ECommandType.INIT || contr.isUp) {
                                this.isClose = true;
                                this.service.destroyPool(this.options.name);
                            } else {
                                this.destroyController(workerKey, EResponseType.CRITICAL_ERROR);
                            }
                            break;
                        case EResponseType.ERROR:
                            this.logger.error(mess.data as Error); // TODO error does not show
                            if (this.getWorkerOptions().isErrorCritical) {
                                if (this.getWorkerOptions().isErrorCritical!(mess.data as Error)) {
                                    this.destroyController(workerKey, EResponseType.CRITICAL_ERROR);
                                }
                            } else if (mess.command === ECommandType.RUN) {
                                if (task) this.resetTask(task);
                            }
                            break;
                        case EResponseType.LOGGER:
                            this.logger[mess.key as keyof ILogger](mess.data as Error);
                            break;
                        case EResponseType.SERVICE:
                            console.log(mess);
                            debugger
                            break;
                        case EResponseType.SUCCESS: // just worker return void.
                            break;
                        default:
                            this.logger.error(new Error('unknown message type!'));
                            break;
                    }
                    break;
                default:
                    this.logger.error(new Error('unknown message sender!'));
                    break;
            }

        } catch (e) {
            this.logger.error(e);
        } finally {
            if (task && !task.isSendResponse && !task.isStream) {
                throw new Error('Exit without answer!!!!')
            }

        }
    }

    private getApplyFunc(self: PoolController, handler: string, execute: string, target: () => void, thisArg: unknown, argArray?: unknown[]): unknown {
        return new Promise((res, rej) => {
            const task = new Task(self.options.taskOpt!);
            task.request = new MessageRequest(task.key, EMessageSender.HANDLER, ECommandType.RUN, handler, execute, argArray);

            /*
             якщо у нас стрім, ми повинні визвати в кінці після останнього чанку!
             так само потрібно перевіряти зрив по таймеру
            */
            task.resolve = res;
            task.reject = rej;
            let chunks = 0

            const sendChunkTask = (chunk: TAny, end: boolean, error = false): void => {
                chunks++;
                const taskChunk = new Task(self.options.taskOpt!);
                taskChunk.request = new MessageRequest(taskChunk.key, EMessageSender.HANDLER, ECommandType.RUN, handler, '', chunk);
                taskChunk.resolve = (data: any) => {
                    self.logger.info(data);
                };
                taskChunk.reject = (er: Error | unknown) => self.logger.error(er as Error);

                taskChunk.request.streamKey = task.key;
                taskChunk.request.isStream = true;
                taskChunk.request.isEndStream = end;
                taskChunk.request.isStreamError = error;
                taskChunk.request.chunkId = chunks;
                // taskChunk.workerKey = task.workerKey;
                if (end) {
                    taskChunk.parent = task;
                }

                self.queueOfTasks.push(taskChunk);
                self.nextTask();
            }

            argArray?.forEach((v, i, arr) => {
                if (v && typeof v === 'object') {   // TODO прибрати перевірку
                    if (v instanceof Readable) {

                        const stream = v as Readable;
                        stream.on('data', (chunk: TAny) => {
                            sendChunkTask(chunk, false);
                        })
                        stream.on('end', (data: any) => {
                            sendChunkTask(data, true);
                        })
                        stream.on('error', er => {
                            self.logger.error(er);
                            sendChunkTask(er, true, true)
                        });
                        arr[i] = {
                            _stream: v.constructor.name,
                            _isStream: true
                        }
                        task.isStream = true;
                        task.request!.isInitStream = true;
                    }
                }
            })
            self.queueOfTasks.push(task);
            self.nextTask();
        });
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
        if (!this.isClose) {
            this.isClose = true;
            this.workersPool.forEach(c => c.destroy(EMessageSender.SERVICE));
            this.queueOfTasks.forEach(v => this.resetTask(v));

            this.workersPool.clear();
            this.queueOfTasks = [];
            this.proxyHandlers = {};
        }
    }

    public destroyController(key: TWorkerKey, code: EResponseType): void {
        if (this.workersPool.has(key)) {
            this.workersPool.get(key)!.destroy(code);
        }
    }

    private getWorkersInfo(): CommonWorkerStatus {
        const info: CommonWorkerStatus = new CommonWorkerStatus();

        for (const [key, item] of this.workersPool) {
            item.giveStatus(info);
            const [numTasks, isOnline] = info.tasks[key];
            if (isOnline && numTasks > info.workerMinTasks) {
                info.workerMinTasks = numTasks;
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
