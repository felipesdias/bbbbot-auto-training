const identifyImages = require('./identifyImages');
const buildMetainfosImages = require('./buildMetainfosImages');
const downloadCaptchas = require('./downloadCaptchas');
const convertCaptchaToImages = require('./convertCaptchaToImages');
const buildModel = require('./buildModel');
const utils = require('./utils');

(async () => {
    // await downloadCaptchas.downloadImages(25000, 'captchas');
    // await convertCaptchaToImages.convertFolderCaptcha('captchas', 'captchasCrop');
    await buildMetainfosImages.generateAllMetaInfos('captchasCrop');
    await identifyImages.identifyAllFolders('captchasCrop');
    // await buildModel.generateModel('captchasCrop', './');
    // await utils.testeModel(1, 'model.js');
})();
