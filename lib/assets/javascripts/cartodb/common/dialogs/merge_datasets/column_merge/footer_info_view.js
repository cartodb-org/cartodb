var cdb = require('cartodb.js-v3');

/**
 * View to indicate the selected key columns relationship.
 * Shared for both step 1 and 2
 */
module.exports = cdb.core.View.extend({

  initialize: function() {
    this._initBinds();
  },

  render: function() {
    var leftKeyColumn = this.model.get('leftKeyColumn');
    var rightKeyColumn = this.model.get('rightKeyColumn');
    var leftColumnName;
    var rightColumnName;

    if (leftKeyColumn) {
      leftColumnName = leftKeyColumn.get('alias') || leftKeyColumn.get('name') || '';
    } else {
      leftColumnName = '';
    }

    if (rightKeyColumn) {
      rightColumnName = rightKeyColumn.get('alias') || rightKeyColumn.get('name') || '';
    } else {
      rightColumnName = '';
    }

    this.$el.html(
      this.getTemplate('common/dialogs/merge_datasets/column_merge/footer_info')({
        leftKeyColumnName: leftColumnName,
        rightKeyColumnName: rightColumnName
      })
    );
    return this;
  },

  _initBinds: function() {
    if (this.model.selectedItemFor) {
      var leftColumns = this.model.get('leftColumns');
      leftColumns.bind('change:selected', this._onChangeLeftColumn, this);
      this.add_related_model(leftColumns);

      var rightColumns = this.model.get('rightColumns');
      rightColumns.bind('change:selected', this._onChangeRightColumn, this);
      this.add_related_model(rightColumns);
    }
  },

  _onChangeLeftColumn: function() {
    var m = this.model.selectedItemFor('leftColumns');
    var name;
    if (m) {
      name = m.get('alias') || m.get('name') || '';
    } else {
      name = '';
    }
    this.$('.js-left-key-column').text(name);
  },

  _onChangeRightColumn: function() {
    var m = this.model.selectedItemFor('rightColumns');
    var name;
    if (m) {
      name = m.get('alias') || m.get('name') || '';
    } else {
      name = '';
    }
    this.$('.js-right-key-column')
      .text(name)
      .toggleClass('is-placeholder', !m);
  }

});
