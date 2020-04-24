const fastBatchPromisse = require('bulk-async');
const { createCanvas } = require('canvas');
const { nodeLoadImage, getMetaInfo } = require('./utils.js');
const fs = require('fs').promises;

const canvas = createCanvas(265, 53);
const ctx = canvas.getContext('2d');


const generateMetainfosFolder = async (folderPath) => {
    const files = await fs.readdir(folderPath);

    const meta = {};

    await fastBatchPromisse.forEach(files, async (file) => {
        if (file.startsWith('metainfo') || file.startsWith('filtered'))
            return;

        const image = await nodeLoadImage(`${folderPath}/${file}`);
        const captchaId = file.split('~')[0];
        ctx.drawImage(image, 0, 0);
        const imgSrc = ctx.getImageData(0, 0, image.width, image.height);
        const metaInfo = getMetaInfo(imgSrc);

        metaInfo.name = file;
        metaInfo.captchaId = parseInt(captchaId);

        meta[file] = metaInfo;
    }, {
        retry: 1,
        sleepOnRetry: 100,
        sizeLimit: 500,
        onError: ({ error, args }) => {
            console.log(args, error);
        }
    });

    await fs.writeFile(`${folderPath}/metainfo.json`, JSON.stringify(meta));
}

const generateAllMetaInfos = async (src) => {
    let folders = await fs.readdir(src);
    
    console.time('Total');
    for(const folder of folders) {
        console.time(folder);
        await generateMetainfosFolder(`${src}/${folder}`);
        console.timeEnd(folder);
    }
    console.timeEnd('Total');
}

module.exports = {
    generateAllMetaInfos,
    generateMetainfosFolder
}

generateAllMetaInfos('cropCleanedCaptchas')