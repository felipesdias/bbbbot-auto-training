const fsSync = require('fs');
const fs = require('fs').promises;
const fastBatchPromisse = require('bulk-async');
const axios = require('axios');
const Image = require('canvas/lib/image');
const { createCanvas } = require('canvas')

const getCaptcha = async () => {
    return await axios.post('https://captcha.globo.com/api/challenge/generate?appId=M2QxYzU4NTEtOGZiMS00NTU5LTliNTMtNjMyOTI0ZTA0NDY4Cg&runtime=1.1.5', {}, {
        headers: {
            origin: 'https://gshow.globo.com',
            'content-type': 'application/x-www-form-urlencoded'
        }
    });
}

const scoreCompareMetainfo = (info1, info2) => {
    // if (Math.abs(info1.width - info2.width) > 5 || Math.abs(info1.height - info2.height) > 5)
    //     return 0;
    // if (info1.captchaId !== undefined && info2.captchaId !== undefined && info1.captchaId === info2.captchaId)
    //     return 0;

    const keys = Object.keys(info1).filter(x => x.startsWith("_"));
    if (!keys.every(key => key in info2)) {
        console.log(keys);
        console.log(info1);
        console.log(info2);
        throw "Different Metainfos";
    }

    const diff = keys.reduce((result, key) => result + Math.abs(info1[key] - info2[key]), 0);
    
    return 1 - ((diff / (info1.width * info1.height)) + (diff / (info2.width * info2.height))) / 2;
}

const nodeLoadImage = (src) => {
    return new Promise(async (resolve, reject) => {
        const image = new Image()

        function cleanup() {
            image.onload = null
            image.onerror = null
        }

        image.onload = () => { cleanup(); resolve(image) }
        image.onerror = (err) => { cleanup(); reject(err) }

        image.src = 'data:image/png;base64,' + (await fs.readFile(src, { encoding: 'base64' }));
    })
}

const ijToi = (i, j, width) => (i * width + j) * 4;
const getRgba = (img, i, j) => {
    const idx = ijToi(i, j, img.width);
    return img.data.slice(idx, idx + 4);
}

const getGreyScaleArray = (img) => {
    const array = [];

    for (let i = 0; i < img.data.length; i += 4) {
        array.push((img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3);
    }

    return array;
}

const getMetaInfo = (img, granularity = 5) => {
    const info = {
        width: img.width,
        height: (img.data.length / 4) / img.width
    };

    const step = 255 / granularity;
    let n = 0;
    const slices = [];

    while (n < 255) {
        slices.push(Math.min(255, n + step));
        n += step;
    }

    slices.forEach(slice => info[`_${slice}`] = 0);

    getGreyScaleArray(img).forEach(v => {
        const slice = slices.find(s => v <= s);
        info[`_${slice}`]++;
    });

    return info;
}

const cutImgCanvas = (srcCanvas, { i1, i2, j1, j2 }) => {
    const width = j2 - j1;
    const height = i2 - i1;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(srcCanvas, j1, i1, width, height, 0, 0, width, height);

    return canvas.toDataURL("image/png");
}

const getBoundingBox = (img, startJ, endJ) => {
    let i1 = (1 << 30);
    let j1 = (1 << 30);
    let i2 = -(1 << 30);
    let j2 = -(1 << 30);

    for (j = startJ; j < endJ; j++) {
        for (i = 0; i < 53; i++) {
            const idx = ijToi(i, j, img.width);
            if (img.data[idx] + img.data[idx + 1] + img.data[idx + 2] < 255 * 3) {
                i1 = Math.min(i1, i);
                i2 = Math.max(i2, i);
                j1 = Math.min(j1, j);
                j2 = Math.max(j2, j);
            }
        }
    }

    return { i1, i2, j1, j2 };
}

const removeBlackLines = (img, i, startJ, endJ) => {
    for (j = startJ; j < endJ; j++) {
        const p = ijToi(i, j, img.width);
        const p1 = ijToi(i - 1, j, img.width);
        const p2 = ijToi(i + 1, j, img.width);

        for (let k = 0; k < 4; k++) {
            img.data[p + k] = (img.data[p1 + k] + img.data[p2 + k]) / 2
        }
    }
}

const getBlackLines = (img, startJ, endJ) => {
    const lines = [];

    for (let i = 0; i < 53; i++) {
        let isBlack = true;
        for (let j = startJ; j < endJ; j++) {
            const idx = ijToi(i, j, img.width);
            if (img.data[idx] + img.data[idx + 1] + img.data[idx + 2] !== 0) {
                isBlack = false;
                break;
            }
        }

        if (isBlack)
            lines.push(i);
    }

    return lines;
}

const getBoxesImages = (img) => {
    const boxes = [];

    for (let j = 0; j < 265; j++) {
        const white = [];
        for (let i = 0; i < 53; i++) {
            const idx = ijToi(i, j, img.width);

            if (img.data[idx] + img.data[idx + 1] + img.data[idx + 2] === 255 * 3)
                white.push(i);
        }

        if (white.length !== 53) {
            boxes.push({ i1: 0, i2: 53, j1: j, j2: j + 45 });
            j += 45;
        }
    }

    return boxes;
}

const createFolder = (folderPath) => {
    if (!fsSync.existsSync(folderPath))
        fsSync.mkdirSync(folderPath);
}

const clearOrCreteFolder = async (folderPath) => {
    createFolder(folderPath);

    const files = await fs.readdir(folderPath);

    await fastBatchPromisse.forEach(files, async (file) => {
        if ((await fs.lstat(`${folderPath}/${file}`)).isDirectory()) {
            const subFiles = await fs.readdir(`${folderPath}/${file}`);
            for (const subFile of subFiles) {
                await fs.unlink(`${folderPath}/${file}/${subFile}`);
            }
        } else {
            await fs.unlink(`${folderPath}/${file}`);
        }
    }, { retry: 2, sleepOnRetry: 10, sizeLimit: 1000 });
}

const getPositionVote = (captcha, model) => {
    const symbol = captcha.data.symbol;
    console.log(symbol)

    const canvas = createCanvas(265, 53);
    const ctx = canvas.getContext('2d');

    const img = new Image;
    img.src = Buffer.from(captcha.data.image, 'base64');
    ctx.drawImage(img, 0, 0);
    
    const imgSrc = ctx.getImageData(0, 0, img.width, img.height);
    const boxes = getBoxesImages(imgSrc);
    const blackLines = boxes.map(({ j1, j2 }) => getBlackLines(imgSrc, j1, j2));
    boxes.forEach(({ j1, j2 }, idx) => blackLines[idx].forEach(i => removeBlackLines(imgSrc, i, j1, j2)));
    ctx.putImageData(imgSrc, 0, 0);

    const imgs = boxes.map(({ j1, j2 }) => getBoundingBox(imgSrc, j1, j2))
                        .map(boundingBox => cutImgCanvas(canvas, boundingBox))
                        .map(img => {
                            const image = new Image;
                            image.src = Buffer.from(img.replace(/^data:image\/png;base64,/, ""), 'base64');
                            ctx.drawImage(image, 0, 0);
                            const imageSrc = ctx.getImageData(0, 0, image.width, image.height);
                            return getMetaInfo(imageSrc);
                        });

       
    let imgVoteIndex = -1;

    if (model[symbol]) {
        const scores = imgs.map(info1 => model[symbol].reduce((max, info2) => Math.max(max, scoreCompareMetainfo(info1, info2)), 0));
        console.log(imgs, scores)
        imgVoteIndex = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score)[0].index;
    }

    return imgVoteIndex === -1
                ? null
                : { clientX: (imgVoteIndex * (265 / 5)) + (265/10), clientY: 25 }
}

const testeModel = async (numVotes, modelPath) => {
    const canvas = createCanvas(265, 53);
    const ctx = canvas.getContext('2d');


    clearOrCreteFolder('temp');
    const metainfoTxt = await fs.readFile(modelPath);
    const model = JSON.parse(metainfoTxt);

    while(numVotes--) {
        const resp = await getCaptcha();

        const symbol = resp.data.data.symbol;

        await fs.writeFile('temp/'+String(numVotes)+'_'+symbol+'.png', resp.data.data.image.replace(/^data:image\/png;base64,/, ""), 'base64');

        const img = new Image;
        img.src = Buffer.from(resp.data.data.image, 'base64');
        ctx.drawImage(img, 0, 0);
        
        const imgSrc = ctx.getImageData(0, 0, img.width, img.height);
        const boxes = getBoxesImages(imgSrc);
        const blackLines = boxes.map(({ j1, j2 }) => getBlackLines(imgSrc, j1, j2));
        boxes.forEach(({ j1, j2 }, idx) => blackLines[idx].forEach(i => removeBlackLines(imgSrc, i, j1, j2)));
        ctx.putImageData(imgSrc, 0, 0);

        const imgs = boxes.map(({ j1, j2 }) => getBoundingBox(imgSrc, j1, j2))
                            .map(boundingBox => cutImgCanvas(canvas, boundingBox))
                            .map(img => {
                                const image = new Image;
                                image.src = Buffer.from(img.replace(/^data:image\/png;base64,/, ""), 'base64');
                                ctx.drawImage(image, 0, 0);
                                const imageSrc = ctx.getImageData(0, 0, image.width, image.height);
                                return getMetaInfo(imageSrc);
                            });

        if (model[symbol]) {
            const scores = imgs.map(info1 => model[symbol].reduce((max, info2) => Math.max(max, scoreCompareMetainfo(info1, info2)), 0));
            console.log(scores, scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score)[0].index, symbol);
        } else {
            console.log(symbol, 'sem modelo definido');
        }
    }
}

module.exports = {
    getCaptcha,
    createFolder,
    clearOrCreteFolder,
    getBoxesImages,
    getBlackLines,
    removeBlackLines,
    nodeLoadImage,
    getBoundingBox,
    cutImgCanvas,
    getGreyScaleArray,
    getMetaInfo,
    scoreCompareMetainfo,
    testeModel,
    getPositionVote
}