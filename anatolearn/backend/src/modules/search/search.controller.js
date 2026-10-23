const service = require('./search.service');
const { controller } = require('../../http/controller');
module.exports = { search: controller(service.search) };
