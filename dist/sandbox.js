"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @file 全局window沙盒，隔离变量环境
 */
const originWindow = window;
const constructableMap = new WeakMap();
function isConstructable(fn) {
    if (constructableMap.has(fn)) {
        return constructableMap.get(fn);
    }
    const constructableFunctionRegex = /^function\b\s[A-Z].*/;
    const classRegex = /^class\b/;
    const constructable = (fn.prototype && fn.prototype.constructor === fn && Object.getOwnPropertyNames(fn.prototype).length > 1) ||
        constructableFunctionRegex.test(fn.toString()) ||
        classRegex.test(fn.toString());
    constructableMap.set(fn, constructable);
    return constructable;
}
const naughtySafari = typeof document.all === 'function' && typeof document.all === 'undefined';
const isCallable = naughtySafari ? (fn) => typeof fn === 'function' && typeof fn !== 'undefined' : (fn) => typeof fn === 'function';
const boundedMap = new WeakMap();
function isBoundedFunction(fn) {
    if (boundedMap.has(fn)) {
        return boundedMap.get(fn);
    }
    const bounded = fn.name.indexOf('bound ') === 0 && !fn.hasOwnProperty('prototype');
    boundedMap.set(fn, bounded);
    return bounded;
}
const functionBoundedValueMap = new WeakMap();
function getTargetValue(target, value) {
    const cachedBoundFunction = functionBoundedValueMap.get(value);
    if (cachedBoundFunction) {
        return cachedBoundFunction;
    }
    if (isCallable(value) && !isBoundedFunction(value) && !isConstructable(value)) {
        const boundValue = Function.prototype.bind.call(value, target);
        for (const key in value) {
            boundValue[key] = value[key];
        }
        if (value.hasOwnProperty('prototype') && !boundValue.hasOwnProperty('prototype'))
            boundValue.prototype = value.prototype;
        functionBoundedValueMap.set(value, boundValue);
        return boundValue;
    }
    return value;
}
function getScript(scriptText) {
    return "(function(window){with(window){;".concat(scriptText, "\n").concat("}}).bind(window.proxy)(window.proxy);");
}
const rawAddEventListener = window.addEventListener;
const rawRemoveEventListener = window.removeEventListener;
const rawWindowInterval = window.setInterval;
const rawWindowClearInterval = window.clearInterval;
const rawWindowTimeout = window.setTimeout;
const rawWindowClearTimeout = window.clearTimeout;
const unscopables = {
    undefined: true,
    Array: true,
    Object: true,
    String: true,
    Boolean: true,
    Math: true,
    Number: true,
    Symbol: true,
    parseFloat: true,
    Float32Array: true,
};
function createFakeWindow() {
    const fakeWindow = {};
    Object.getOwnPropertyNames(originWindow).forEach((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(originWindow, key);
        if (descriptor && !descriptor.configurable) {
            const hasGetter = Object.prototype.hasOwnProperty.call(descriptor, 'get');
            if (key === 'top' || key === 'parent' || key === 'self' || key === 'window') {
                descriptor.configurable = true;
                if (!hasGetter) {
                    descriptor.writable = true;
                }
            }
            Object.defineProperty(fakeWindow, key, Object.freeze(descriptor));
        }
    });
    return fakeWindow;
}
class Sandbox {
    constructor(showlog) {
        this.fakeWindow = createFakeWindow();
        this.updateKeys = new Set();
        this.listenerMap = new Map();
        this.timeoutList = [];
        this.intervalList = [];
        this.originKeys = [];
        this.showlog = false;
        this.hasDisposed = false;
        this.showlog = showlog;
        this.proxy = new Proxy(window, {
            set: (target, key, value) => {
                if (!this.hasDisposed) {
                    this.updateKeys.add(key);
                    try {
                        if (!this.fakeWindow.hasOwnProperty(key) && target.hasOwnProperty(key)) {
                            // @ts-ignore
                            target[key] = value;
                        }
                        else {
                            // @ts-ignore
                            this.fakeWindow[key] = value;
                        }
                    }
                    catch (error) {
                        console.error('set-key-error', key, error);
                        throw error;
                    }
                }
                return true;
            },
            get: (target, key) => {
                if (key === Symbol.unscopables) {
                    return unscopables;
                }
                // @ts-ignore
                if (key === 'window' || key === 'self') {
                    return this.proxy;
                }
                if (key === 'document') {
                    return target.document;
                }
                if (key === 'hasOwnProperty') {
                    return target.hasOwnProperty;
                }
                if (key === 'eval') {
                    return target.eval;
                }
                try {
                    // @ts-ignore
                    var value = key in target ? target[key] : this.fakeWindow[key];
                    // @ts-ignore
                    if (isCallable(value) && !isBoundedFunction(value) && !isConstructable(value)) {
                        // @ts-ignore
                        // return target.matchMedia
                        value = Function.prototype.bind.call(value, target);
                    }
                    return getTargetValue(window, value);
                }
                catch (error) {
                    console.error('get-key-error', key, error);
                    throw error;
                }
            },
            has: (target, key) => {
                return key in unscopables || key in target || key in this.fakeWindow;
                // return this.fakeWindow.hasOwnProperty(key)
            },
        });
        // 事件
        this.proxy.addEventListener = (type, listener, options) => {
            if (!this.hasDisposed) {
                const listeners = this.listenerMap.get(type) || [];
                this.listenerMap.set(type, [...listeners, listener]);
                return rawAddEventListener.call(window, type, listener, options);
            }
        };
        this.proxy.removeEventListener = (type, listener, options) => {
            const listeners = this.listenerMap.get(type);
            if (listeners && listeners.length) {
                const listenerIndex = listeners.indexOf(listener);
                if (listenerIndex !== -1) {
                    listeners.splice(listeners.indexOf(listener), 1);
                }
            }
            return rawRemoveEventListener.call(window, type, listener, options);
        };
        // 定时器
        this.proxy.setInterval = (handler, timeout, ...args) => {
            if (!this.hasDisposed) {
                const intervalId = rawWindowInterval(handler, timeout, ...args);
                this.intervalList.push(intervalId);
                return intervalId;
            }
            else {
                return 0;
            }
        };
        this.proxy.clearInterval = (intervalId) => {
            const intervalIndex = this.intervalList.indexOf(intervalId);
            if (intervalIndex !== -1) {
                this.intervalList.splice(intervalIndex, 1);
            }
            return rawWindowClearInterval(intervalId);
        };
        this.proxy.setTimeout = (handler, timeout, ...args) => {
            if (!this.hasDisposed) {
                const timeoutId = rawWindowTimeout(handler, timeout, ...args);
                this.timeoutList.push(timeoutId);
                return timeoutId;
            }
            else {
                return 0;
            }
        };
        this.proxy.clearTimeout = (timeoutId) => {
            const timeoutIndex = this.timeoutList.indexOf(timeoutId);
            if (timeoutIndex !== -1) {
                this.timeoutList.splice(timeoutIndex, 1);
            }
            return rawWindowClearTimeout(timeoutId);
        };
        this.originKeys = this.showWindowKeys();
        // @ts-ignore
        originWindow.proxy = this.proxy;
    }
    execScript(scriptText) {
        if (this.hasDisposed) {
            throw new Error('sandbox has been destroyed');
        }
        var scriptTextWithSandbox = getScript(scriptText);
        originWindow.eval(scriptTextWithSandbox);
    }
    showWindowKeys() {
        const originKeys = Object.keys(originWindow);
        if (this.showlog === true) {
            console.log('originWindow', originWindow);
            console.log('updateKeys', this.updateKeys);
            console.log('windowKeysLength', originKeys.length);
        }
        return originKeys;
    }
    preview() {
        if (this.showlog === true) {
            window.console.log('updateKeys', this.updateKeys);
            window.console.log('listenerMap', this.listenerMap);
            window.console.log('intervalList', this.intervalList);
            window.console.log('timeoutList', this.timeoutList);
        }
    }
    dispose() {
        this.listenerMap.forEach((listeners, type) => [...listeners].forEach((listener) => rawRemoveEventListener.call(window, type, listener)));
        this.listenerMap.clear();
        this.intervalList.forEach((intervalId) => rawWindowClearInterval(intervalId));
        this.intervalList = [];
        this.timeoutList.forEach((timeoutId) => rawWindowClearTimeout(timeoutId));
        this.timeoutList = [];
        this.fakeWindow = createFakeWindow();
        // const originKeys = this.showWindowKeys()
        // const newKeys = []
        // for (var i = 0; i < originKeys.length; i++) {
        //     if (this.originKeys.indexOf(originKeys[i]) === -1) {
        //         newKeys.push(originKeys)
        //     }
        // }
        // @ts-ignore
        // originWindow.newKeys = newKeys
        // @ts-ignore
        delete originWindow.proxy;
        this.hasDisposed = true;
        console.log('Sandbox was successfully destroyed');
    }
}
exports.default = Sandbox;
