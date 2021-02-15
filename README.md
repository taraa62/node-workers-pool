# node-workers-pool
Add a wed-worker pool to your project

------
Options for WorkerService:
```
    name: string; // name pool
    minPoolWorkers?: number; // min workers // default = 1
    maxPoolWorkers?: number; // max workers // default = 1
    isUpWorker?: (opt: IPoolOptions, controller: IWorkerPoolController) => boolean; // when a lot of tasks, and min=1, max=5, we can control when service will get up new worker
    dropPool?: () => void; // if isResetWorker = undefined | false and were critical errors, worker doesn't kill from list activities workers. Next step -> drop pool,  all task will execute with error result
    maxTaskToUpNewWorker?: number; //default = 50,  if isUpWorker = undefined and mode = EWorkerMode.ASYNC, we get min counts of worker and check maxTaskToUpNewWorker<worker.tasks.lenght
    pathJsFile: string; // path to js file of worker
    mode: EWorkerMode; // SYNC || ASYNC 
    initData?: TAny;  // anything , when worker up
    timeRunTask?: number; // if we want to throw error if task do a much time..
    isResetWorker?:boolean; // default:true, if the worker falls, controller will raise a new.
    maxResetTask?:number; // default = -1; -newer reset if the task throw an error.
```
-------
Example sync: (`./node_modules/pool-web-worker/dist/test/test.js`)
```
 test SYNC:
test('test sync', sync () => {
        const service:IWorkerService = new WorkerService()
        service.addPool({
            name: 'pool',
            mode: EWorkerMode.SYNC,
            pathJsFile: './dist/src/dedicated-workers/dedicated-sync.js',
            minPoolWorkers: 1,
            maxPoolWorkers: 2,
            maxTaskToUpNewWorker: 2,
            initData: 'hello worker))',
            maxResetTask: 5,
            isResetWorker: true,
            dropPool: () => {
                console.table({error: 'all worker stopped'})
            }
        });
        const d: number[] = [];

        service.addTask<{ d: number }>('pool', {d: 1}).then(v => d.push(v.d))
        service.addTask<{ d: number }>('pool', {d: 2}).then(v => d.push(v.d))
        await service.addTask<{ d: number }>('pool', {d: 3}).then(v => d.push(v.d))
        await service.addTask<{ d: number }>('pool', {d: 4}).then(v => d.push(v.d))

        await pause(5000);
        service.close('pool');
        expect(d).toEqual([1, 2, 3, 4]);
    }, 30000)


test ASYNC
  test('test async', async () => {
        const service: IWorkerService = new WorkerService()
        service.addPool({
            name: 'pool',
            mode: EWorkerMode.ASYNC,
            pathJsFile: './dist/src/dedicated-workers/dedicated-sync.js',
            minPoolWorkers: 1,
            maxPoolWorkers: 10,
            initData: 'hello worker))',
            // we can control the rising of the worker
            /*isUpWorker: (opt, controller): boolean => {
                const [avail, up] = controller.getAvailableWorkers();
                return !up && avail < 2
            }*/

        })

        const d: number[] = [];

        service.addTask<{ k: number }>('pool', {k: 1}).then(v => d.push(v.k));
        service.addTask<{ k: number }>('pool', {k: 2}).then(v => d.push(v.k));
        await pause(3000);
        service.addTask<{ k: number }>('pool', {k: 3}).then(v => d.push(v.k));
        service.addTask<{ k: number }>('pool', {k: 4}).then(v => d.push(v.k));
        service.addTask<{ k: number }>('pool', {k: 5}).then(v => d.push(v.k));
        await pause(2000);
        service.addTask<{ k: number }>('pool', {k: 6}).then(v => d.push(v.k));
        service.addTask<{ k: number }>('pool', {k: 7}).then(v => d.push(v.k));
        service.addTask<{ k: number }>('pool', {k: 8}).then(v => d.push(v.k));
        service.addTask<{ k: number }>('pool', {k: 9}).then(v => d.push(v.k));
        service.addTask<{ k: number }>('pool', {k: 10}).then(v => d.push(v.k));
        service.addTask<{ k: number }>('pool', {k: 11}).then(v => d.push(v.k));
        await pause(5000);

        service.close('pool');
        expect(d).toHaveLength(11);
        await pause(1000);
    }, 15000)
```

-------------
implementation for worker:

Example: (`./node_modules/pool-web-worker/dist/src/dedicated-workers/dedicated-sync.js`)
```
export class DedicatedSync extends AbstractDedicatedWorker implements IDedicatedWorker {

    public initWorker(initData: IWorkerMessageRequest): void {
        this.logger.info('WORKER: initData - ' + JSON.stringify(initData));
    }

    public runTask(mess: IWorkerMessageRequest): void {
        this.logger.info('WORKER: taskData - ' + JSON.stringify(mess.data));
        setTimeout(() => {
            this.sendSuccessTask(mess, mess.data)
        }, 1500)
    }
}

new DedicatedSync(); // require!!
```


