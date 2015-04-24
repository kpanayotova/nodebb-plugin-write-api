'use strict';
/* globals module, require */

var Topics = require.main.require('./src/topics'),
	PostTools = require.main.require('./src/postTools'),
	apiMiddleware = require('./middleware'),
	errorHandler = require('../../lib/errorHandler'),
	utils = require('./utils');


module.exports = function(middleware) {
	var app = require('express').Router();

	app.route('/')
		.post(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['cid', 'title', 'content'], req, res)) {
				return false;
			}

			var payload = {
					cid: req.body.cid,
					title: req.body.title,
					content:req.body.content,
					uid: req.user.uid,
				    handle: req.body.handle, // always ignored because of uid
				    thumb: req.body.thumb,
				    tags: req.body.tags || []
				};

			Topics.post(payload, function(err, data) {
				return errorHandler.handle(err, res, data);
			});
		})
		.put(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['pid', 'content'], req, res)) {
				return false;
			}

			var payload = {
				uid: req.user.uid,
				pid: req.body.pid,
				content: req.body.content
			};

			// Maybe a "set if available" utils method may come in handy
			if (req.body.handle) { payload.handle = req.body.handle; }
			if (req.body.title) { payload.title = req.body.title; }
			if (req.body.thumb) { payload.thumb = req.body.thumb; }
			if (req.body.tags) { payload.tags = req.body.tags; }

			PostTools.edit(payload, function(err, returnData) {
				errorHandler.handle(err, res, returnData);
			});
		});

	app.route('/:tid')
		.post(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			if (!utils.checkRequired(['content'], req, res)) {
				return false;
			}

			var payload = {
					tid: req.params.tid,
					uid: req.user.uid,
					req: req,	// For IP recording
					content: req.body.content
				};

			if (req.body.toPid) { payload.toPid = req.body.toPid; }

			Topics.reply(payload, function(err, returnData) {
				errorHandler.handle(err, res, returnData);
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			Topics.delete(req.params.tid, function(err) {
				errorHandler.handle(err, res);
			});
		});

	app.route('/follow')
		.post(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['tid'], req, res)) {
				return false;
			}

			Topics.follow(req.body.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['tid'], req, res)) {
				return false;
			}

			Topics.unfollow(req.body.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res);
			});
		});

	return app;
};