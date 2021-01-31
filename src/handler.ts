export function HandlerClass<T extends { new(...args: any[]): {} }>(constructor: T) {
    console.log("-- decorator function invoked --");

    return class extends constructor {
        newProperty = "new property";
        hello = "override";

        // @ts-ignore
        logger:handleDefParams.logger
    }
}
