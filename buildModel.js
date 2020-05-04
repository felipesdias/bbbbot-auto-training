const fastBatchPromisse = require('bulk-async');
const fs = require('fs').promises;

const generateModelFolder = async (folderPath) => {
    const files = await fs.readdir(folderPath+'/filtered');
    const metainfoTxt = await fs.readFile(`${folderPath}/metainfo.json`);
    let metaInfo = JSON.parse(metainfoTxt);

    const meta = [];

    await fastBatchPromisse.forEach(files, async (file) => {
        const realFileName = file.split('~')[1] + '~' + file.split('~')[2];
        meta.push(metaInfo[realFileName]);
    }, {
        retry: 1,
        sleepOnRetry: 100,
        sizeLimit: 100,
        onError: ({ error, args }) => {
            console.log(args, error);
        }
    });

    return meta;
}

const generateModel = async (src, dest) => {
    let folders = await fs.readdir(src);
    
    const model = {};

    console.time('Total');
    await fastBatchPromisse.forEach(folders, async (folder) => {
        console.time(folder);
        model[folder] = await generateModelFolder(`${src}/${folder}`);
        console.timeEnd(folder);
    }, {
        retry: 1,
        sleepOnRetry: 10,
        sizeLimit: 100,
        onError: ({ error, args }) => {
            console.log(args, error);
        }
    });
    console.timeEnd('Total');
    
    await fs.writeFile(dest + '/model.js', JSON.stringify(model));
}

module.exports = {
    generateModel,
}