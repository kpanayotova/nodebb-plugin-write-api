'use strict';
/* globals module, require */

var Topics = require.main.require('./src/topics'),
	Posts = require.main.require('./src/posts'),
	PostTools = require.main.require('./src/postTools'),
	apiMiddleware = require('./middleware'),
	errorHandler = require('../../lib/errorHandler'),
	db = require.main.require('./src/database'),
	utils = require('./utils'),
	async = require.main.require('async');


module.exports = function(middleware) {
	var app = require('express').Router();

	function setTimestampToPublishedDate(data, timestamp, callback) {
		var topicData = data.topicData;
		var postData = data.postData;
		var tid = topicData.tid;
		var pid = postData.pid;

		async.parallel([
			function (next) {
				db.setObjectField('topic:' + tid, 'timestamp', timestamp, next);
			},
			function (next) {
				db.sortedSetsAdd([
					'topics:tid',
					'cid:' + topicData.cid + ':tids',
					'cid:' + topicData.cid + ':uid:' + topicData.uid + ':tids',
					'uid:' + topicData.uid + ':topics'
				], timestamp, tid, next);
			},
			function (next) {
				db.setObjectField('post:' + pid, 'timestamp', timestamp, next);
			},
			function (next) {
				db.sortedSetsAdd([
					'posts:pid',
					'cid:' + topicData.cid + ':pids'
				], timestamp, pid, next);
			}
		], callback);
	}

	function addFields(data, fields, callback) {
		Posts.setPostFields(data.postData.pid, fields, callback);
	}


	app.route('/')
		.post(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['cid', 'title', 'content'], req, res)) {
				return false;
			}

			var timestamp = parseInt(req.body.timestamp, 10);
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

				if (err) {
					return errorHandler.handle(err, res, data);
				}

				var funcs = [];
				if (req.body.handle || req.body.url || req.body.image_url) {
					funcs.push(function (next) {
						addFields(data, {
							handle: req.body.handle,
							sourceUrl: req.body.url,
							imageUrl: req.body.image_url
						}, next);
					})
				}
				if (timestamp) {
					funcs.push(function (next) {
						setTimestampToPublishedDate(data, timestamp, next);
					})
				}
				if (funcs.length) {
					async.parallel(funcs, function (err, result) {
						return errorHandler.handle(err, res, data);
					});
				}
				else {
					return errorHandler.handle(err, res, data);
				}

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