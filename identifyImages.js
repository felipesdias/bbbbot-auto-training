const fastBatchPromisse = require('bulk-async');
const fs = require('fs').promises;
const { scoreCompareMetainfo, clearOrCreteFolder } = require('./utils');



const identifyFolder = async (folderPath) => {
    await clearOrCreteFolder(`${folderPath}/filtered`);
    const metainfoTxt = await fs.readFile(`${folderPath}/metainfo.json`);
    let metaInfo = JSON.parse(metainfoTxt);
    const listMetaInfo = Object.values(metaInfo);
    const metaInfoByCaptchaId = Object.values(metaInfo).reduce((dict, item) => {
        if (item.captchaId in dict) {
            dict[item.captchaId].push(item);
        } else {
            dict[item.captchaId] = [item]
        }

        return dict;
    }, {});

    let groups = [];

    for (let i = 0; i < listMetaInfo.length; i++) {
        let isSame = [listMetaInfo[i]];
        for (let j = 0; j < listMetaInfo.length; j++) {
            const score = scoreCompareMetainfo(listMetaInfo[i], listMetaInfo[j]);
            if (score >= 0.94) {
                isSame.push(listMetaInfo[j]);
            }
        }
        groups.push({
            cont: isSame.length,
            isSame,
            infos: listMetaInfo[i]
        });
    }

    const finalResult = [];
    const trueImages = {};
    const bannedImage = {};

    groups = groups.sort((a, b) => b.cont - a.cont);

    console.log(groups.length);

    groups.forEach(g => {
        if (!bannedImage[g.infos.name] || trueImages[g.infos.name]) {
            g.isSame.forEach(isSame => {
                trueImages[isSame.name] = true;
                if (!isSame.refer) 
                    isSame.refer = g.infos.name;
                metaInfoByCaptchaId[isSame.captchaId].filter(x => x.name !== isSame.name).forEach(x => {
                    bannedImage[x.name] = true;
                });
            });

            // if (finalResult.every(x => scoreCompareMetainfo(g.infos, x.infos) < 0.99))
            finalResult.push(g);
        }
    });

    if (folderPath.indexOf('agulha') !== -1) {
        // console.log(finalResult);
    }

    

    await fastBatchPromisse.forEach(finalResult, async (r) => {
        await fs.copyFile(`${folderPath}/${r.infos.name}`, `${folderPath}/filtered/${r.infos.refer}~${r.cont}~${r.infos.name}`)
    }, {
        retry: 2, sleepOnRetry: 10, sizeLimit: 1000, onError: ({ error, args }) => {
            console.log(args, error);
        }
    });

    return;
}

const identifyAllFolders = async (src) => {
    let folders = (await fs.readdir(src));

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