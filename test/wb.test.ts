import {EWorkerMode, EWorkerType, ILogger} from "../types/common";
import {WorkerService} from "../src/workerService";
import {IBBWorker} from "../handlers/IHandler";


describe('test', () => {
    const logger: ILogger = {
        error: console.error,
        info: console.info,
        verbose: console.log,
        warn: console.info
    }

    const service = new WorkerService({
        workersFolder: './handlers',
        logger,
    });
    afterAll(()=>{
        service.destroyService();
    })

    test('test1', async () => {
        // console.log(service.getAvailableHandlers());

        await service.init();

        service.addPool({
            name: 'pool',
            mode: EWorkerMode.SYNC,
            handlers: ['aa.worker', 'bb.worker', 'cc.worker'],
            minWorkers: 1,
            maxWorkers: 1,
            taskOpt: {
                maxRunAttempts: 2,
                timeout: 3000
            },
            workerOpt: {
                maxTaskAsync: 50
            },

        });

        /* const handlerBB = service.getHandlerObject<IBBWorker>('pool', 'bb.worker');
         const bb = await handlerBB.bb();
         console.info(bb);

         const bbP = await handlerBB.bbP('taraa62', 11);
         console.info(bbP);


            const handlerCC = service.getHandlerFunc<ICC>('pool', 'cc.worker');
            const bbRes = await handlerCC();
            console.log(bbRes);
    */


        service.addPool({
            name: 'pool1', mode: EWorkerMode.SYNC, handlers: ['cc.worker']
        });

        service.destroyPool('pool1');

        const ba = service.getHandlerObject<IBBWorker>('pool', 'bb.worker');
        const aa = await ba.bb();
        console.info(aa);

    }, 30000)

    test('SYNC - 1000 requests & order', async () => {
        await service.init();
        service.addPool({
            name: 'sync',
            mode: EWorkerMode.SYNC,
            handlers: ['bb.worker'],
            taskOpt: {
                maxRunAttempts: 1,
                timeout: 5000
            },
        });
        const bbWorker: IBBWorker = service.getHandlerObject('sync', 'bb.worker');
        let sum = 0;

        for (let i = 0; i < 1000; i++) {
            sum = await bbWorker.sum(1, sum);
        }
        const order = []
        for (let i = 0; i < 10; i++) {
            order.push(await bbWorker.returnData(i));
        }

        expect(sum).toBe(1000);
        expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    }, 20000)

    test('ASYNC -  order', async () => {
        await service.init();
        service.addPool({
            name: 'sync',
            mode: EWorkerMode.ASYNC,
            handlers: ['bb.worker'],
            minWorkers: 2,
            maxWorkers: 3,
            taskOpt: {
                maxRunAttempts: 1,
                timeout: 20000
            },
            workerOpt: {
                maxTaskAsync: 50
            }
        });
        const bbWorker: IBBWorker = service.getHandlerObject('sync', 'bb.worker');

        const order: number[] = [];
        const promises = [];
        for (let i = 0; i < 30; i++) {
            promises.push(bbWorker.returnDataLong(i, Math.floor(Math.random() * 1000) + 1200).then(v => order.push(v)))

        }
        await Promise.all(promises);

        expect(order).toHaveProperty('length', 30);

    }, 30000);
    test('ASYNC -  fork', async () => {
        await service.init();
        service.addPool({
            name: 'sync',
            mode: EWorkerMode.ASYNC,
            type:EWorkerType.FORK,
            handlers: ['bb.worker'],
            minWorkers: 1,
            maxWorkers: 1,
            taskOpt: {
                maxRunAttempts: 1,
                timeout: 20000
            },
            workerOpt: {
                maxTaskAsync: 50
            }
        });
        const bbWorker: IBBWorker = service.getHandlerObject('sync', 'bb.worker');

        const order: number[] = [];
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(bbWorker.returnDataLong(i, Math.floor(Math.random() * 1000) + 200).then(v => order.push(v)))

        }
        await Promise.all(promises);

        expect(order).toHaveProperty('length', 10);

    }, 30000)
})


// const handler: IaaHandlers = service.getHandler<IaaHandlers>('pool1')
