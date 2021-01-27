function Handler<T extends { new(...args: any[]): {} }>(constructor: T) {
    console.log("-- decorator function invoked --");
    return class extends constructor {
        gears: number = 5;
        wheels: number = 3;
    }
}
