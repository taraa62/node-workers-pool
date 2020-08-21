import {IPoolOptions, IWorkerPoolController} from "../../types/worker/worker";
import {TAny} from "../../types/global";
import {WorkerItemTask} from "./worker-item-task";

export class WorkerPoolController implements IWorkerPoolController {

    private queueTasks: WorkerItemTask[] = [];

    constructor(private options: IPoolOptions) {
    }

    public newTask(data: TAny): string {
        const task: WorkerItemTask = new WorkerItemTask(data);
        this.queueTasks.push(task);
        return task.key;
    }


    workerDead(key: string, error: number | string | Error): void {
    }

    workerEndRun(key: string): void {
    }

}
