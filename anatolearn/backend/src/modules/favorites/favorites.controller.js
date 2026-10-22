const service = require('./favorites.service');
const { controller } = require('../../http/controller');
module.exports = {
    listFavorites: controller(service.listFavorites),
    addFavorite: controller(service.addFavorite),
    removeFavorite: controller(service.removeFavorite),
};
