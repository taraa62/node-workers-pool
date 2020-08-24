# web-worker
Add a wed-worker pool to your project

------
1. Add new service:
 `const service = new WorkerService()`
 
2 Add 'pool-sync'

2.1  'pool-sync'
```    
service.addPool({
            name: 'pool-sync',
            mode: EWorkerMode.SYNC,
            pathJsFile: './dist/src/dedicated-workers/dedicated-sync.js',
            minPoolWorkers: 1,
            // maxPoolWorkers: 2,
            maxTaskToUpNewWorker: 2,
            initData: 'hello worker))'
        });
```
2.2  'pool-async'
```     
service.addPool({
            name: 'pool-async',
            mode: EWorkerMode.ASYNC,
            pathJsFile: './dist/src/dedicated-workers/dedicated-sync.js',
            minPoolWorkers: 1,
            maxPoolWorkers: 10,
            initData: 'hello worker))',
            // we can control the rising of the worker
            isUpWorker: (opt, controller): boolean => {
                const [avail, up] = controller.getAvailableWorkers();
                return !up.length && avail.length < 2
            },
            callWorkerExit: (key: string, error?: Error) => {
                console.info(key, error);
            }
        })
```
3. Add new task
` service.addTask<{ d: number }>('pool-sync', {d: 1}).then(v => d.push(v.d))`

-------
Example sync
```
       const service = new WorkerService()
        service.addPool({
            name: 'pool',
            mode: EWorkerMode.SYNC,
            pathJsFile: './dist/src/dedicated-workers/dedicated-sync.js',
            minPoolWorkers: 1,
            maxPoolWorkers: 2,
            maxTaskToUpNewWorker: 2,
            initData: 'hello worker))'
        });
        const d: number[] = [];

        service.addTask<{ d: number }>('pool', {d: 1}).then(v => d.push(v.d))
        service.addTask<{ d: number }>('pool', {d: 2}).then(v => d.push(v.d))
        await service.addTask<{ d: number }>('pool', {d: 3}).then(v => d.push(v.d))
        await service.addTask<{ d: number }>('pool', {d: 4}).then(v => d.push(v.d))
        
        service.close('pool');
        expect(d).toEqual([1, 2, 3, 4]);

```
-------
Example async
```
 const service: IWorkersService = new WorkerService()
        service.addPool({
            name: 'pool',
            mode: EWorkerMode.ASYNC,
            pathJsFile: './dist/src/dedicated-workers/dedicated-sync.js',
            minPoolWorkers: 1,
            maxPoolWorkers: 10,
            initData: 'hello worker))',
            // we can control the rising of the worker
            isUpWorker: (opt, controller): boolean => {
                const [avail, up] = controller.getAvailableWorkers();
                return !up.length && avail.length < 2
            },
            callWorkerExit: (key: string, error?: Error) => {
                console.info(key, error);
            }
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
        expect(d).toHaveLength(11); // we cannot know the order of tasks

```


