import {WorkerService} from "../src/worker/worker/worker.service";
import {EWorkerMode} from "../src/worker/worker/worker-types";

describe('Worker tests', () => {
    test('singleton', async () => {
        const service = new WorkerService()
        service.addPool({
            name: 'pool1',
            mode: EWorkerMode.SYNC,
            pathJsFile: './dist/src/dedicate-workers/singleton-worker.js',
            minPoolWorkers: 1,
            maxPoolWorkers: 2,
        })

        const result = await service.addTask('pool1', {d: 1})
        console.log(result)
    })

})

