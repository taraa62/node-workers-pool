class AaWorker {

    getHelloWorld(param: string): string {
        return param + '  World';
    }
}

module.exports = new AaWorker();


