# sandboxjs

A nifty javascript sandbox for browser.
When its dispose is called, all defined global variables will be destroyed，Includes timers and global events.

## Installing it

```javascript
npm install sandbox-brower
```

## Using it

```javascript
const sandbox = new Sandbox();
const scriptText = 'window.customName = "jay"; console.log(window.customName);' ;
sandbox.execScript(scriptText); // 'jay'
sandbox.dispose(); // destroy the sandbox
console.log(window.customName); // undefined
```

## other

If you have some variables defined on window outside the sandbox, you can still use them inside the sandbox

```javascript
window.globalProp = 'hello world'
const sandbox = new Sandbox();
const scriptText = 'console.log(window.globalProp);' ; 
sandbox.execScript(scriptText);// 'hello world'
```
