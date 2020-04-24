const fastBatchPromisse = require('bulk-async');
const fs = require('fs').promises;
const { scoreCompareMetainfo, clearOrCreteFolder } = require('./utils');



const identifyFolder = async (folderPath) => {
    await clearOrCreteFolder(`${folderPath}/filtered`);
    const metainfoTxt = await fs.readFile(`${folderPath}/metainfo.json`);
    let metaInfo = JSON.parse(metainfoTxt);
    // metaInfo = [metaInfo['126465~3.png'], metaInfo['200624~1.png']];
    const listMetaInfo = Object.values(metaInfo);
    const metaInfoByCaptchaId = Object.values(metaInfo).reduce((dict, item) => {
        if (item.captchaId in dict) {
            dict[item.captchaId].push(item);
        } else {
            dict[item.captchaId] = [item]
        }

        return dict;
    }, {});

    // const keysCapycha = Object.keys(metaInfoByCaptchaId);
    // await fastBatchPromisse.forEach(keysCapycha, async (key) => {
    //     const capcthas = metaInfoByCaptchaId[key].map(metainfo => {
    //         const cont = keysCapycha.reduce((result, key2) => {
    //             return result + (metaInfoByCaptchaId[key2].find(y => scoreCompareMetainfo(metainfo, y) >= 0.94) ? 1 : 0);
    //         }, 0);
    //         return { cont, metainfo };
    //     });

    //     const captcha = capcthas.sort((a, b) => b.cont - a.cont)[0];
    //     // await fs.copyFile(`${folderPath}/${captcha.metainfo.name}`, `${folderPath}/filtered/${captcha.cont}~${captcha.metainfo.name}`)
    // }, { sizeLimit: 1 });

    // return;


    // console.log(metaInfo['14979~1.png'], metaInfo['14979~1.png']);
    // console.log(scoreCompareMetainfo(metaInfo['14979~1.png'], metaInfo['14979~1.png']));
    // return;
    const scoreMin = 0.94;

    const visited = Array(listMetaInfo.length).fill(false);

    let groups = [];

    for (let i = 0; i < listMetaInfo.length; i++) {
        if (!visited[i]) {
            visited[i] = true;
            listMetaInfo[i].reference = listMetaInfo[i];
            const visitedCaptcha = {};
            let isSame = [listMetaInfo[i]];
            for (let j = i + 1; j < listMetaInfo.length; j++) {
                if (visited[j] || visitedCaptcha[listMetaInfo[j].captchaId])
                    continue;
                if (visitedCaptcha[listMetaInfo[j].captchaId])
                    continue;

                const score = scoreCompareMetainfo(listMetaInfo[i], listMetaInfo[j]);
                if (score >= scoreMin) {
                    visitedCaptcha[listMetaInfo[j].captchaId] = true;
                    visited[j] = true;
                    listMetaInfo[j].reference = listMetaInfo[i];
                    isSame.push(listMetaInfo[j]);
                }
            }
            groups.push({
                cont: isSame.length,
                isSame,
                infos: listMetaInfo[i]
            });
        }
    }

    // groups = groups.filter(x => x.cont >= 5).sort((a, b) => b.cont - a.cont);
    groups = groups.sort((a, b) => b.cont - a.cont);

    let result = [];
    const captchasVisisted = {};
    const bannedImags = [];

    groups.forEach(g => {
        if (g.isSame.every(x => !(x.captchaId in captchasVisisted)) && bannedImags.every(y => scoreCompareMetainfo(g.infos, y.reference) < scoreMin)) {
            g.isSame.forEach(img1 => {
                captchasVisisted[img1.captchaId] = true;

                metaInfoByCaptchaId[img1.captchaId].forEach(img2 => {
                    if (g.infos !== img2.reference) {
                        bannedImags.push(img2.reference);
                    }
                });
            });
            result.push(g);
        }
    });

    console.log(result.length);
    console.log(result.reduce((a, b) => a + b.cont, 0));
    console.log(result.reduce((a, b) => a + b.cont, 0) * 5, '/', listMetaInfo.length/5);

    result = result.slice(0, 5);

    await fastBatchPromisse.forEach(result, async (r) => {
        await fs.copyFile(`${folderPath}/${r.infos.name}`, `${folderPath}/filtered/${r.cont}~${r.infos.name}`)
    }, {
        retry: 2, sleepOnRetry: 10, sizeLimit: 100, onError: ({ error, args }) => {
            console.log(args, error);
        }
    });
}

const identifyAllFolders = async (src) => {
    let folders = await fs.readdir(src);

    // folders = folders.slice(0, 1);

    console.time('Total');
    for (const folder of folders) {
        console.time(folder);
        await identifyFolder(`${src}/${folder}`);
        console.timeEnd(folder);
    }
    console.timeEnd('Total');
}

module.exports = {
    identifyAllFolders,
    identifyFolder
}

identifyAllFolders('cropCleanedCaptchas');