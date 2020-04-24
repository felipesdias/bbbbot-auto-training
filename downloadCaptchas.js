const fs = require('fs').promises;
const { getCaptcha, createFolder } = require('./utils.js');
const fastBatchPromisse = require('bulk-async');

const downloadImages = async (numberOfCaptchas, destFolder) => {
    createFolder(destFolder);

    const firstId = ((await fs.readdir(destFolder)).map(file => parseInt(file.split('~')[0])).sort((a, b) => b - a)[0] || 0) + 1;

    const ids = Array(numberOfCaptchas - firstId + 1).fill(0).map((_, i) => i + firstId);

    let cont = firstId - 1;
    const start = new Date().getTime();

    const idInterval = setInterval(() => {
        const seconds = Math.round(((new Date().getTime()) - start) / 1000);
        console.log(cont, '/', numberOfCaptchas, `em ${Math.floor(seconds / 60)}:${seconds % 60}`);
    }, 1000);

    await fastBatchPromisse.forEach(ids, async (id) => {
        const resp = await getCaptcha();
        const symbol = resp.data.data.symbol;
        const fileName = `${id}~${symbol}.png`;
        const base64Data = resp.data.data.image.replace(/^data:image\/png;base64,/, "");
        await fs.writeFile(`${destFolder}/${fileName}`, base64Data, 'base64');
        cont++;

    }, {
        ignoreExceptions: false,
        sizeLimit: 1,
        sleepOnRetry: 30000,
        retry: 2,
        verbose: {
            exceptions: true
        }
    });

    clearInterval(idInterval);
    const seconds = Math.round(((new Date().getTime()) - start) / 1000);
    console.log(cont, '/', numberOfCaptchas, `em ${Math.floor(seconds / 60)}:${seconds % 60}`);
}

module.exports = {
    downloadImages
}
