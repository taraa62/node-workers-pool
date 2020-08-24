import {WorkerService} from "../src/worker/main/worker.service";
import {EWorkerMode} from "../src/worker/main/worker-types";
import util from "util";
import {IWorkersService} from "../src/types/worker/worker";

const pause = util.promisify(setTimeout);

describe('Worker tests', () => {
    test('test sync', async () => {
        const service = new WorkerService()
        service.addPool({
            name: 'pool',
            mode: EWorkerMode.SYNC,
            pathJsFile: './dist/src/dedicated-workers/dedicated-sync.js',
            minPoolWorkers: 1,
            // maxPoolWorkers: 2,
            maxTaskToUpNewWorker: 2,
            initData: 'hello worker))'
        });
        const d: number[] = [];

        service.addTask<{ d: number }>('pool', {d: 1}).then(v => d.push(v.d))
        service.addTask<{ d: number }>('pool', {d: 2}).then(v => d.push(v.d))
        await service.addTask<{ d: number }>('pool', {d: 3}).then(v => d.push(v.d))
        await service.addTask<{ d: number }>('pool', {d: 4}).then(v => d.push(v.d))

        await pause(5000);
        service.close('pool');
        expect(d).toEqual([1, 2, 3, 4]);
    }, 20000)

    test('test async', async () => {
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
        expect(d).toHaveLength(11);
        await pause(1000);
    }, 15000)

})

