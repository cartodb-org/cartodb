var cdb = require('cartodb.js-v3');
var _ = require('underscore-cdb-v3');
var UploadModel = require('../../background_polling/models/upload_model');
var VisFetchModel = require('../../visualizations_fetch_model');

/**
 * Add layer model
 *
 * "Implements" the CreateListingModel.
 */
module.exports = cdb.core.Model.extend({

  defaults: {
    type: 'addLayer',
    contentPane: 'listing', // [listing, loading]
    listing: 'datasets', // [import, datasets, scratch]
    collectionFetched: false,
    activeImportPane: 'file'
  },

  initialize: function(attrs, opts) {
    this.user = opts.user;
    this.vis = opts.vis;
    this.map = opts.map;

    this.upload = new UploadModel({
      create_vis: false
    }, {
      user: this.user
    });

    this.selectedDatasets = new Backbone.Collection();
    this.collection = new cdb.admin.Visualizations();
    this.visFetchModel = new VisFetchModel({
      content_type: 'datasets',
      library: this.showLibrary()
    });
    this._initBinds();
    this._maybePrefetchDatasets();
  },

  // For create-listing view
  canSelect: function(dataset) {
    return dataset.get('selected') || this.selectedDatasets.length < 1; // for now only allow 1 item
  },

  clearSelection: function() {
    this.collection.each(function(vis) {
      if (vis.attributes.selected === true) {
        vis.set('selected', false);
      }
    });
  },

  // For create-listing view
  showLibrary: function() {
    return false;
  },

  // For create-listing view
  showDatasets: function() {
    return true;
  },

  // For create-listing-import view
  setActiveImportPane: function(name) {
    this.set('activeImportPane', name);
  },

  // For footer
  canFinish: function() {
    if (this.get('listing') === 'import') {
      return this.upload.isValidToUpload();
    } else if (this.get('listing') === 'datasets') {
      return this.selectedDatasets.length > 0;
    }
  },

  finish: function() {
    if (this.get('listing') === 'import') {
      cdb.god.trigger('importByUploadData', this.upload.toJSON(), this);
    } else if (this.get('listing') === 'datasets') {
      var mdl = this.selectedDatasets.at(0);
      if (mdl.get('type') === 'remote') {
        var d = {
          create_vis: false,
          type: 'remote',
          needs_cd_import: mdl.get('needs_cd_import'),
          value: mdl.get('name'),
          remote_visualization_id: mdl.get('id'),
          size: mdl.get('external_source') ? mdl.get('external_source').size : undefined
        };
        // See BackgroundImporter where the same event is bound to be handled..
        cdb.god.trigger('importByUploadData', d, this);
      } else {
        this._addNewLayer(mdl.tableMetadata().get('name'));
      }
    }
  },

  // For footer (type guessing)
  getImportState: function() {
    return this.get('activeImportPane');
  },

  // For footer (type guessing)
  showGuessingToggler: function() {
    return this.get('listing') === 'import';
  },

  // For create-footer view
  showPrivacyToggler: function() {
    return this.get('listing') === 'import';
  },

  // For create-from-scratch view
  createFromScratch: function() {
    this.set('contentPane', 'creatingFromScratch');
    var self = this;
    var table = new cdb.admin.CartoDBTableMetadata();
    table.save({}, {
      success: function() {
        self._addNewLayer(table.get('name'));
      },
      error: function() {
        this.set('contentPane', 'addLayerFailed');
      }
    });
  },

  _initBinds: function() {
    this.upload.bind('change', function() {
      this.trigger('change:upload', this);
    }, this);
    this.visFetchModel.bind('change', this._fetchCollection, this);
    this.bind('change:listing', this._maybePrefetchDatasets);

    this.collection.bind('change:selected', function(changedModel, wasSelected) {
      this.selectedDatasets[ wasSelected ? 'add' : 'remove' ](changedModel);
    }, this);
    this.collection.bind('reset', function() {
      this.selectedDatasets.each(function(model) {
        var sameModel = this.collection.get(model.id);
        if (sameModel) {
          sameModel.set('selected', true);
        }
      }, this);
    }, this);
  },

  _maybePrefetchDatasets: function() {
    if (this.get('listing') === 'datasets' && !this.get('collectionFetched') && !this.visFetchModel.isSearching()) {
      this.set('collectionFetched', true);
      this._fetchCollection();
    }
  },

  _fetchCollection: function() {
    var params = this.visFetchModel.attributes;
    var types = params.imported ? 'table' : 'table,remote';

    var options = {
      locked: '',
      q: params.q,
      page: 1,
      tags: params.tag,
      per_page: 10000,
      shared: params.shared,
      only_liked: params.liked,
      order: params.order || 'name',
      asc_order: params.asc_order !== false,
      type: '',
      types: types,
      exclude_raster: true
    };
    if (params.category) {
      options.parent_category = params.page;
    } else {
      this.collection.options.unset('parent_category', {silent: true});
    }
    this.collection.options.set(options);

    this.collection.fetch();
  },

  _onCollectionChange: function() {
    this.selectedDatasets.reset(this.collection.where({ selected: true }));
  },

  _addNewLayer: function(tableName) {
    this.set('contentPane', 'addingNewLayer');

    var self = this;
    this.map.addCartodbLayerFromTable(tableName, this.user.get('username'), {
      vis: this.vis,
      success: function() {
        // layers need to be saved because the order may changed
        self.map.layers.saveLayers();
        self.trigger('addLayerDone');
      },
      error: function() {
        self.set('contentPane', 'addLayerFailed');
      }
    });
  }

});
