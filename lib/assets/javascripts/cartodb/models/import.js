cdb.admin.Import = cdb.core.Model.extend({

  idAttribute: 'item_queue_id',

  urlRoot: '/api/v1/imports',

  initialize: function() {
    this.bind('change', this._checkFinish, this);
  },

  setUrlRoot: function(urlRoot) {
    this.urlRoot = urlRoot;
  },

  /**
   * checks for poll to finish
   */
  pollCheck: function(i) {
    var self = this;
    var tries = 0;
    this.pollTimer = setInterval(function() {
      // cdb.log.debug("checking job for finish: " + tries);
      self.fetch({
        error: function(e) {
          self.trigger("change");
        }
      });
      ++tries;
    }, i || 1500);
  },

  destroyCheck: function() {
    clearInterval(this.pollTimer);
  },

  _checkFinish: function() {

    if(this.get('success') === true) {
      clearInterval(this.pollTimer);
      this.trigger('importComplete', this);
    } else if (this.get('success') === false) {
      clearInterval(this.pollTimer);
      this.trigger('importError', this);
    } else {
      this.trigger('importChange', this);
    }
  }
});
