const dataFolder = './checkData/';

const fs = require('fs');

require('json5/lib/register')
const _ = require('lodash')

function groupBy(list, keyGetter) {
    const map = new Map();
    list.forEach((item) => {
         const key = keyGetter(item);
         const collection = map.get(key);
         if (!collection) {
             map.set(key, [item]);
         } else {
             collection.push(item);
         }
    });
    return map;
}

let MODEL = require('./model.json');
let errors = [];

const checkLog = (logPathname, index) => {
    console.log(logPathname, `${index + 1}/${numberOfFiles}`)
    const log = require(`${dataFolder}${logPathname}`);
    const processName = log.processName;
    let process;
    if (processName in MODEL){
        process = MODEL[processName];
    }else{
        errors.push({type: 'process name not found', details: `${processName} not found in the model`})
        return;
    }
    const callsGroupedByThread = _.groupBy(log.calls, x => x.threadID);

    for (const calls of Object.values(callsGroupedByThread)){
        if (calls.length <= 1) //continue;
        {
            // const call = calls[0];
            // if (!process.map.some(module => module.name === call.moduleName)){
            //     errors.push({type: 'module name not found!', details: `in process ${processName} module ${call.moduleName} not found`});
            //     return;
            //     //process.map.push({name: call1.moduleName, size: call1.moduleSize})
            // }
        }
        for (let i = 1; i < calls.length; i++){
            const call1 = calls[i - 1];
            const call2 = calls[i];

            if (!process.map.some(module => module.name === call1.moduleName)){
                errors.push({type: 'module name not found!', details: `in process ${processName} module ${call1.moduleName} not found`});
                //return;
                process.map.push({name: call1.moduleName, size: call1.moduleSize})
            }
            if (!process.map.some(module => module.name === call2.moduleName)){
                errors.push({type: 'module name not found!', details: `in process ${processName} module ${call2.moduleName} not found`});
                //return;
                process.map.push({name: call2.moduleName, size: call2.moduleSize})
            }

            let relativeCall1Return = 0;
            for (let j = 0; j < process.map.length; j++){
                if (process.map[j].name === call1.moduleName){
                    relativeCall1Return += call1.return_address - call1.moduleBase;
                    break;
                }
                relativeCall1Return += process.map[j].size;
            }

            let relativeCall2Return = 0;
            for (let j = 0; j < process.map.length; j++){
                if (process.map[j].name === call2.moduleName){
                    relativeCall2Return += call2.return_address - call2.moduleBase;
                    break;
                }
                relativeCall2Return += process.map[j].size;
            }

            const distance = relativeCall2Return - relativeCall1Return;

            const distancesObject = process.distances;

            let distancesFromCall1;
            if ( call1.fname in distancesObject){
                distancesFromCall1 = distancesObject[call1.fname];
            }else{
                errors.push({
                    type: 'no such a function #1',
                    details: `no function called ${call1.fname} in distances of ${processName}, available functions: ${Object.keys(distancesObject)} module_call1: ${call1.moduleName} module_call2: ${call2.moduleName}`,
                    logPathname,
                    threadId: call2.threadID
                })
                continue;
                //distancesObject[call1.fname] = {};
                //distancesFromCall1 = distancesObject[call1.fname];
            }

            let distancesFromCall1ToCall2;
            if (call2.fname in distancesFromCall1){
                distancesFromCall1ToCall2 = distancesFromCall1[call2.fname];
            }else {
                errors.push({
                    type: 'no such a function #2',
                    details: `no function called ${call2.fname} in distances of ${processName} of function ${call1.fname}, available functions: ${Object.keys(distancesFromCall1)} module_call1: ${call1.moduleName} module_call2: ${call2.moduleName}`,
                    logPathname,
                    threadId: call2.threadID
                })
                continue;
                //distancesFromCall1[call2.fname] = [];
                //distancesFromCall1ToCall2 = distancesFromCall1[call2.fname];
            }

            if (!distancesFromCall1ToCall2.includes(distance)){
                errors.push({
                    type: 'no such distance!',
                    details: `no distance ${distance} between ${call1.fname} and ${call2.fname} in process ${processName} module_call1: ${call1.moduleName} module_call2: ${call2.moduleName}`,
                    logPathname
                })
                continue;
                //distancesFromCall1ToCall2.push(distance);
            }


        }
    }
}

fs.readdir(dataFolder, (err, files) => {
    numberOfFiles = files.length
    files.forEach(checkLog)
    if (errors.length === 0) console.log('there were no errors!');
    else {
        console.log(errors.length, ' errors found');
        fs.writeFileSync('./errors.json', JSON.stringify(errors))
        Object.entries(_.groupBy(errors, x => x.type)).forEach(([errorType, arrayOfErrors]) => console.log(errorType, arrayOfErrors.length))
        let totalCalls = 0;
        files.forEach(logPathname => {
            const log = require(`${dataFolder}${logPathname}`);
            console.log(logPathname, `${log.calls.length} calls`)
            totalCalls += log.calls.length 
        })
        console.log('total calls', totalCalls)

        let totalExploitCalls = 0;
        files.forEach(logPathname => {
            const log = require(`${dataFolder}${logPathname}`);
            const exploitCalls = log.calls.filter(x => {
                return x.return_address >= log.callRandomFunctionAddress && x.return_address <= log.callRandomFunctionAddress + 448
            }).length
            totalExploitCalls += exploitCalls;
        })
        console.log('total exploit calls', totalExploitCalls)
    }
    //fs.writeFileSync('./model.json', JSON.stringify(MODEL, null, 2))
})

var numberOfFiles