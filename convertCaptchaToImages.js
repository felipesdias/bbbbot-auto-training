const { createCanvas } = require('canvas');
const { getBoxesImages, getBlackLines, removeBlackLines, nodeLoadImage, clearOrCreteFolder, getBoundingBox, cutImgCanvas, createFolder } = require('./utils.js');
const fastBatchPromisse = require('bulk-async')
const fs = require('fs').promises;

const canvas = createCanvas(265, 53);
const ctx = canvas.getContext('2d');

const convertCaptcha = async (src, file, dest, saveFile = true) => {
    const [captchaId, symbol] = file.replace('.png', '').split('~');

    const image = await nodeLoadImage(`${src}/${file}`);
    ctx.drawImage(image, 0, 0);
    const imgSrc = ctx.getImageData(0, 0, image.width, image.height);

    const boxes = getBoxesImages(imgSrc);
    const blackLines = boxes.map(({ j1, j2 }) => getBlackLines(imgSrc, j1, j2));
    boxes.forEach(({ j1, j2 }, idx) => blackLines[idx].forEach(i => removeBlackLines(imgSrc, i, j1, j2)));
    ctx.putImageData(imgSrc, 0, 0);

    const imgs = boxes.map(({ j1, j2 }) => getBoundingBox(imgSrc, j1, j2)).map(boundingBox => cutImgCanvas(canvas, boundingBox));

    createFolder(`${dest}/${symbol}`);
    
    await Promise.all(
        imgs.map((base64, idx) => fs.writeFile(`${dest}/${symbol}/${captchaId}~${idx}.png`, base64.replace(/^data:image\/png;base64,/, ""), 'base64'))
    );
}

const convertFolderCaptcha = async (src, dest) => {
    let files = await fs.readdir(src);

    await clearOrCreteFolder(dest);

    let cont = 0;
    const start = new Date().getTime();

    const idInterval = setInterval(() => {
        const seconds = Math.round(((new Date().getTime()) - start) / 1000);
        console.log(cont, '/', files.length, `em ${Math.floor(seconds / 60)}:${seconds % 60}`);
    }, 1000);

    await fastBatchPromisse.forEach(files, async (file) => {
        await convertCaptcha(src, file, dest);
        cont++;
    }, { onError: ({ error, args }) => console.log(args, error), ignoreExceptions: true, sizeLimit: 200 });

    clearInterval(idInterval);

    const seconds = Math.round(((new Date().getTime()) - start) / 1000);
    console.log(cont, '/', files.length, `em ${Math.floor(seconds / 60)}:${seconds % 60}`);
}


module.exports = {
    convertCaptcha,
    convertFolderCaptcha
}