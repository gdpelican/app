
/**
 * Module dependencies.
 */

var citizen = require('citizen');
var config = require('config');
var markdown = require('markdown');
var request = require('request');
var template = require('./template');
var CommentsEditView = require('comments-edit');
var View = require('view');
var t = require('t');
var log = require('debug')('democracyos:comments-view');

/**
 * Expose CommentCard
 */

module.exports = CommentCard;

/**
 * Create CommentCard
 */

function CommentCard(comment) {
  if (!(this instanceof CommentCard)) {
    return new CommentCard(comment);
  }

  this.comment = comment;
  this.setLocals();
  View.call(this, template, this.locals);

  this.likeButton = this.find('.vote-comment.like');
  this.dislikeButton = this.find('.vote-comment.dislike');
  this.scoreCounter = this.find('.comment-counter');
  this.mediaBody = this.find('.media-body');
}

View(CommentCard);

CommentCard.prototype.switchOn = function() {
  this.bind('click', '.like', 'onlike');
  this.bind('click', '.dislike', 'ondislike');
  this.bind('click', '.link-report', 'onflag');
  this.bind('click', '.link-edit', 'onedit');
  this.bind('click', 'span.show-spam a', 'onshowspam');
};

CommentCard.prototype.setLocals = function() {
  var locals = {};
  var comment = locals.comment = this.comment;
  locals.markdown = markdown;
  locals.likes = !!~comment.upvotes.map(function(v) { return v.author; }).indexOf(citizen.id);
  locals.dislikes = !!~comment.downvotes.map(function(v) { return v.author; }).indexOf(citizen.id);
  locals.flags = !!~comment.flags.map(function(v) { return v.author; }).indexOf(citizen.id);
  locals.own = comment.author.id == citizen.id;
  locals.repliesCounter = comment.replies.length;
  if (config['spam limit']) {
    locals.spam = comment.flags.length > config['spam limit'];
  } else {
    locals.spam = comment.flags.length > (comment.upvotes.length - comment.downvotes.length);
  }
  locals.profilePictureUrl = comment.author.profilePictureUrl ? comment.author.profilePictureUrl : comment.author.gravatar;
  locals.classes = [];
  if (locals.own) locals.classes.push('own');
  if (locals.spam) locals.classes.push('spam');
  this.locals = locals;
};

/**
 * Action like comment
 */

CommentCard.prototype.onlike = function(ev) {
  ev.preventDefault();

  var comment = this.comment;
  var liked = this.locals.likes;
  var disliked = this.locals.dislikes;

  var error = this.find('.error');

  if (comment.author.id == citizen.id) {
    return error.html(t('You\'re not allowed to vote your own argument'));
  } else if (!citizen.id) {
    return error.html(t('comments.sign-in-required-to-vote-comments'));
  } else {
    error.html('');
  }

  this.likeButton.addClass('selected');
  this.dislikeButton.removeClass('selected');

  var count = parseInt(this.scoreCounter.html(), 10) || 0;
  count += disliked ? 2 : (liked ? 0 : 1);
  this.scoreCounter.html(count);

  this.locals.likes = true;
  this.locals.dislikes = false;

  var self = this;
  request
  .post(this.url() + '/upvote')
  .end(function(err, res) {
    if (err || !res) return log('Fetch error: %s', err), self.likeButton.removeClass('selected');
    if (res.status == 401) return error(t(res.body.error));
    if (!res.ok) return log('Fetch error: %s', res.error), self.likeButton.removeClass('selected');
    if (res.body && res.body.error) return log('Fetch response error: %s', res.body.error), self.likeButton.removeClass('selected');
    log('successfull upvote %s', self.comment.id);
  });
}



/**
 * Action like comment
 */

CommentCard.prototype.ondislike = function(ev) {
  ev.preventDefault();

  var comment = this.comment;
  var liked = this.locals.likes;
  var disliked = this.locals.dislikes;

  var error = this.find('.error');

  if (comment.author.id == citizen.id) {
    return error.html(t('You\'re not allowed to vote your own argument'));
  } else if (!citizen.id) {
    return error.html(t('comments.sign-in-required-to-vote-comments'));
  } else {
    error.html('');
  }

  this.dislikeButton.addClass('selected');
  this.likeButton.removeClass('selected');

  var count = parseInt(this.scoreCounter.html(), 10) || 0;
  count -= liked ? 2 : (disliked ? 0 : 1);
  this.scoreCounter.html(count);

  this.locals.dislikes = true;
  this.locals.likes = false;

  var self = this;
  request
  .post(this.url() + '/downvote')
  .end(function(err, res) {
    if (err || !res) return log('Fetch error: %s', err), self.dislikeButton.removeClass('selected');
    if (res.status == 401) return error(t(res.body.error));
    if (!res.ok) return log('Fetch error: %s', res.error), self.dislikeButton.removeClass('selected');
    if (res.body && res.body.error) return log('Fetch response error: %s', res.body.error), self.dislikeButton.removeClass('selected');
    log('successfull downvote %s', self.comment.id);
  });
}

CommentCard.prototype.onflag = function(ev) {
  ev.preventDefault();

  var comment = this.comment;
  var target = this.find('.link-report');
  var isSpam = this.locals.spam;
  var flagging = !this.locals.flags;

  target.toggleClass('selected');
  flagging ? target.attr('title', t('Not spam')) : target.attr('title', t('Spam'));
  var flagsCounter = comment.flags.length + (flagging ? 1 : -1);
  var spam;
  if (config['spam limit']) {
    spam = flagsCounter > config['spam limit'];
  } else {
    spam = flagsCounter > (comment.upvotes.length - comment.downvotes.length)
  }
  if (spam) {
    this.el.addClass('spam');
  } else {
    this.el.removeClass('spam');
  }

  var self = this;
  request
  .post(this.url() + '/:action'.replace(':action', flagging ? 'flag' : 'unflag'))
  .end(function(err, res) {
    if (err) return handleError(err);
    if (!res.ok) return handleError(res.error);
    if (res.body && res.body.error) return handleError(res.body.error);

    log('successfull %s as spam %s', flagging ? 'flag' : 'unflag', self.comment.id);
    var count = target.find('.count');
    var innerCount = count.html() != '' ? parseInt(count.html()) : 0;
    innerCount += (flagging ? 1 : -1)
    count.html(innerCount ? innerCount : '');
    self.locals.flags = flagging;

    function handleError(error) {
      log('Fetch response error: %s', error)
      if (flagging) self.el.removeClass('spam');
      return target.removeClass('selected');
    }
  });
}

CommentCard.prototype.onshowspam = function(ev) {
  ev.preventDefault();

  this.el.removeClass('spam');
}

CommentCard.prototype.onedit = function(ev) {
  ev.preventDefault();


  this.find('a.btn-edit').addClass('hide');
  var form = this.mediaBody.find('form');

  if (!form.length) {
    var commentsEdit = this.commentsEdit = new CommentsEditView(this.comment);
    commentsEdit.render(this.mediaBody[0]);
    commentsEdit.on('put', this.onsuccessedit.bind(this));
    commentsEdit.on('off', this.oncanceledit.bind(this));
  }

  this.mediaBody.addClass('edit');
};



CommentCard.prototype.oncanceledit = function(el) {
  this.mediaBody.removeClass('edit');
  this.find('.btn-edit').removeClass('hide');
  el.parentNode.removeChild(el);
};

CommentCard.prototype.onsuccessedit = function(data) {
  // var el = data.el;
  // var data = data.data;

  // var commentEl = el.parentNode;
  // var id = commentEl.parentNode.getAttribute('data-id');
  // var commentText = o('.comment-text', commentEl);
  // var commentTime = o('.ago', commentEl);
  // commentText.innerHTML = markdown(data.text);

  // var edited = o('.edited', commentEl);
  // if (!edited) {
  //   var small = document.createElement('small');
  //   classes(small).add('edited');
  //   small.innerHTML = ' · ' + t('comments.edited');
  //   commentTime.parentNode.insertBefore(small, commentTime.nextSibling);
  // }

  // var btn = o('.btn-edit', commentEl.parentNode);
  // classes(btn).remove('hide');
  // classes(el.parentNode).remove('edit');
  // commentEl.removeChild(el);

  // var comment = get(this.myArguments, 'id === "%id"'.replace('%id', id));
  // comment.text = data.text;
  // comment.editedAt = data.editedAt;
};

CommentCard.prototype.url = function() {
  return '/api/comment/:id'.replace(':id', this.comment.id);
};