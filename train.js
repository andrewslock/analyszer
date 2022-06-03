const dataFolder = './learningData/';

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

let MODEL = {};

const processLog = (logPathname, index) => {
    console.log(logPathname, `${index + 1}/${numberOfFiles}`)
    const log = require(`${dataFolder}${logPathname}`);
    const processName = log.processName;
    let process;
    if (processName in MODEL){
        process = MODEL[processName];
    }else{
        MODEL[processName] = {
            map: [],
            distances: {}
        };
        process = MODEL[processName];
    }
    const callsGroupedByThread = _.groupBy(log.calls, x => x.threadID);

    for (const calls of Object.values(callsGroupedByThread)){
        if (calls.length <= 1) continue;
        for (let i = 1; i < calls.length; i++){
            const call1 = calls[i - 1];
            const call2 = calls[i];

            if (!process.map.some(module => module.name === call1.moduleName)){
                process.map.push({name: call1.moduleName, size: call1.moduleSize})
            }
            if (!process.map.some(module => module.name === call2.moduleName)){
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
                distancesObject[call1.fname] = {};
                distancesFromCall1 = distancesObject[call1.fname];
            }

            let distancesFromCall1ToCall2;
            if (call2.fname in distancesFromCall1){
                distancesFromCall1ToCall2 = distancesFromCall1[call2.fname];
            }else {
                distancesFromCall1[call2.fname] = [];
                distancesFromCall1ToCall2 = distancesFromCall1[call2.fname];
            }

            if (!distancesFromCall1ToCall2.includes(distance)){
                distancesFromCall1ToCall2.push(distance);
            }


        }
    }
    delete require.cache[require.resolve(`${dataFolder}${logPathname}`)]
}

fs.readdir(dataFolder, (err, files) => {
    numberOfFiles = files.length
    files.forEach(processLog)
    fs.writeFileSync('./model.json', JSON.stringify(MODEL, null, 2))
})

var numberOfFiles
