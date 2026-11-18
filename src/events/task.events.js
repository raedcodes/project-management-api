import { EventEmitter } from "node:events";

// One shared emitter: services announce what happened, listeners decide what to do about it
export const taskEvents = new EventEmitter();
