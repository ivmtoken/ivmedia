	
  /**
	   * Initialize interactive video editor.
	   *
	   * @class IVMEDIAEditor.InteractiveVideo
	   * @param {Object} parent
	   * @param {Object} field
	   * @param {Object} params
	   * @param {function} setValue
	   */
	  function InteractiveVideoEditor(parent, field, params, setValue) {
	    var that = this;
	

	    this.parent = parent;
	    this.field = field;
	

	    this.findField(this.field.video, function (field) {
	      if (field.field.type !== 'video') {
	        throw t('notVideoField', {':path': that.field.video});
	      }
	

	      if (field.params !== undefined) {
	        that.setVideo(field.params);
	      }
	

	      field.changes.push(function (file) {
	        that.setVideo(field.params);
	      });
	    });
	

	    this.findField(this.field.poster, function (field) {
	      if (field.field.type !== 'image') {
	        throw t('notImageField', {':path': that.field.poster});
	      }
	

	      if (field.params !== undefined) {
	        that.setPoster(field.params);
	      }
	

	      field.changes.push(function () {
	        that.setPoster(field.params);
	      });
	    });
	

	    // Will be true only on first load of IV
	    this.freshVideo = (params === undefined);
	

	    this.params = $.extend({
	      interactions: [],
	      bookmarks: [],
	      endscreens: []
	    }, params);
	    setValue(field, this.params);
	

	    this.children = [];
	

	    this.passReadies = true;
	    parent.ready(function () {
	      that.passReadies = false;
	

	      // Set active right away to generate common fields for interactions.
	      that.setActive();
	    });
	

	    IVMEDIA.$window.on('resize', function () {
	      if (that.IV) {
	        that.IV.trigger('resize');
	      }
	    });
	

	    // Tour de editor
	    this.currentTabIndex = 0;
	

	    // When wizard changes step
	    parent.on('stepChanged', function (event) {
	      that.currentTabIndex = event.data.id;
	      that.startGuidedTour(IVMEDIAEditor.InteractiveVideo.GuidedTours.isOpen());
	    });
	  }
	

	  /**
	   * Must be changed if the semantics for the elements changes.
	   * @private
	   * @type {string}
	   */
	  InteractiveVideoEditor.clipboardKey = 'IVMEDIAEditor.InteractiveVideo';
	  /**
	   * Find a field, then run the callback.
	   *
	   * @param {function} callback
	   */
	  InteractiveVideoEditor.prototype.findField = function (path, callback) {
	    var that = this;
	    // Find field when tree is ready.
	    this.parent.ready(function () {
	      var field = IVMEDIAEditor.findField(path, that.parent);
	

	      if (!field) {
	        throw IVMEDIAEditor.t('core', 'unknownFieldPath', {':path': path});
	      }
	

	      callback(field);
	    });
	  };
	

	  /**
	   * Our tab has been set active. Create a new player if necessary.
	   */
	  InteractiveVideoEditor.prototype.setActive = function () {
	    if (this.IV !== undefined) {
	      // A video has been loaded, no need to recreate.
	      // (but we can do some resizing :D)
	      this.IV.trigger('resize');
	      return;
	    }
	

	    // Reset css
	    this.$editor.css({
	      width: '',
	      height: '',
	      fontSize: ''
	    });
	

	    if (this.video === undefined) {
	      this.$editor.html(this.noVideoSourceMessage(this.parent)).removeClass('ivmedia-interactive-video');
	      return;
	    }
	

	    var that = this;
	

	    // Create new player.
	    this.IV = new IVMEDIA.InteractiveVideo({
	      interactiveVideo: {
	        video: {
	          files: this.video,
	          startScreenOptions: {
	            poster: this.poster
	          }
	        },
	        assets: this.params
	      }
	    }, IVMEDIAEditor.contentId);
	

	    this.IV.editor = this;
	    $(window).on('resize', function () {
	      if (that.dnb) {
	        that.dnb.resize();
	      }
	    });
	    for (var i = 0; i < this.IV.interactions.length; i++) {
	      this.processInteraction(this.IV.interactions[i], this.params.interactions[i]);
	    }
	    this.IV.on('controls', function () {
	      if (!that.IV) {
	        return; // Video source or poster may have changed – abort!
	      }
	

	      // Add DragNBar.
	      that.$bar = $('<div class="ivmedia-interactive-video-dragnbar">' + t('loading') + '</div>').prependTo(that.$editor);
	      var interactions = findField('interactions', that.field.fields);
	      var action = findField('action', interactions.field.fields);
	      IVMEDIAEditor.LibraryListCache.getLibraries(
	        action.options,
	        function (libraries) {
	          this.createDragNBar(libraries);
	          this.setInteractionTitles();
	          this.startGuidedTour();
	          this.IV.trigger('dnbEditorReady');
	        },
	        that
	      );
	

	      // Add "Add bookmark" to bookmarks menu.
	      $('<div/>', {
	        'class': 'ivmedia-add-bookmark',
	        html: t('addBookmark'),
	        role: 'button',
	        tabindex: 0,
	        on: {
	          click: function () {
	            that.addBookmark();
	          }
	        },
	        appendTo: that.IV.controls.$bookmarksChooser
	      });
	

	      // Add "Add endscreen" to endscreens menu.
	      $('<div/>', {
	        'class': 'ivmedia-add-endscreen',
	        html: t('addEndscreen'),
	        role: 'button',
	        tabindex: 0,
	        on: {
	          click: function () {
	            that.addEndscreen();
	          }
	        },
	        appendTo: that.IV.controls.$endscreensChooser
	      });
	    });
	    this.IV.on('bookmarkAdded', that.bookmarkAdded, that);
	    this.IV.on('endscreenAdded', that.endscreenAdded, that);
	    this.IV.attach(this.$editor);
	

	    // Create a focus handler
	    this.$focusHandler = $('<div>', {
	      'class': 'ivmediaeditor-iv-focus-handler'
	    }).click(function () {
	      if (!that.dnb.focusedElement || !that.dnb.focusedElement.$element.is(':focus')) {
	

	        // No focused element, remove overlay
	        that.$focusHandler.removeClass('show');
	        that.IV.$overlay.removeClass('ivmedia-visible');
	      }
	    }).appendTo(this.IV.$videoWrapper);
	

	    this.pToEm = (this.IV.width / this.IV.fontSize) / 100;
	  };
	

	  /**
	   * Set custom interaction titles when libraries are registered.
	   */
	  InteractiveVideoEditor.prototype.setInteractionTitles = function () {
	    var self = this;
	

	    this.IV.interactions.forEach(function (interaction) {
	      // Try to figure out a title for the dialog
	      var title = self.findLibraryTitle(interaction.getLibraryName());
	      if (!title) {
	        // Couldn't find anything, use default
	        title = self.IV.l10n.interaction;
	      }
	

	      interaction.setTitle(title);
	    });
	

	    // Create title element
	    this.$interactionTitle = $('<div>', {
	      'class': 'ivmedia-interaction-button-title'
	    }).appendTo(this.$editor);
	

	  };
	

	  InteractiveVideoEditor.prototype.showInteractionTitle = function (title, $interaction) {
	    if (!this.$interactionTitle) {
	      return;
	    }
	

	    // Set static margin
	    var fontSize = parseInt(this.IV.$videoWrapper.css('font-size'), 10);
	    var staticMargin = 0.3 * fontSize;
	

	    var videoOffsetX = $interaction.position().left;
	    var videoOffsetY = $interaction.position().top;
	    var dnbOffsetY = this.$bar.height();
	

	    this.$interactionTitle.html(title);
	

	    // center title
	    var totalOffsetX = videoOffsetX - (this.$interactionTitle.outerWidth(true) / 2) + ($interaction.width() / 2);
	    if (totalOffsetX < 0) {
	      totalOffsetX = 0;
	    } else if(totalOffsetX + this.$interactionTitle.outerWidth(true) > this.IV.$videoWrapper.width()) {
	      totalOffsetX = this.IV.$videoWrapper.width() - this.$interactionTitle.outerWidth(true);
	    }
	    var totalOffsetY = videoOffsetY + dnbOffsetY - this.$interactionTitle.height() - 1;
	

	    this.$interactionTitle.css({
	      'left': totalOffsetX,
	      'top': totalOffsetY - staticMargin
	    }).addClass('show');
	  };
	

	  InteractiveVideoEditor.prototype.hideInteractionTitle = function () {
	    if (!this.$interactionTitle) {
	      return;
	    }
	

	    this.$interactionTitle.removeClass('show');
	  };
	

	  /**
	   * Add bookmark
	   */
	  InteractiveVideoEditor.prototype.addBookmark = function () {
	    var time = this.IV.video.getCurrentTime();
	

	    // Find out where to place the bookmark
	    for (var i = 0; i < this.params.bookmarks.length; i++) {
	      if (this.params.bookmarks[i].time > time) {
	        // Insert before this.
	        break;
	      }
	    }
	

	    var tenth = Math.floor(time * 10) / 10;
	    if (this.checkMarkerSpace(tenth) === false) {
	      return; // Not space for another bookmark
	    }
	

	    // Hide dialog
	    if (this.IV.controls.$more.attr('aria-expanded') === 'true') {
	      this.IV.controls.$more.click();
	    }
	    else {
	      this.IV.controls.$bookmarks.click();
	    }
	

	    // Move other increament other ids.
	    this.IV.trigger('bookmarksChanged', {'index': i, 'number': 1});
	

	    this.params.bookmarks.splice(i, 0, {
	      time: time,
	      label: t('newBookmark')
	    });
	

	    var $bookmark = this.IV.addBookmark(i, tenth);
	    $bookmark.addClass('ivmedia-show');
	    $bookmark.find('.ivmedia-bookmark-text').click();
	  };
	

	  /**
	   * Add endscreen
	   * @param {number} time - Time in s to put endscreen at.
	   * @param {boolean} freshOnly - If true, the endscreen label will not pop up and only be included for fresh videos.
	   */
	  InteractiveVideoEditor.prototype.addEndscreen = function (time, freshOnly) {
	    if (!this.freshVideo && freshOnly === true) {
	      return;
	    }
	

	    time = time || this.IV.video.getCurrentTime();
	

	    // Find out where to place the endscreen
	    for (var i = 0; i < this.params.endscreens.length; i++) {
	      if (this.params.endscreens[i].time > time) {
	        // Insert before this.
	        break;
	      }
	    }
	

	    var tenth = Math.floor(time * 10) / 10;
	    if (this.checkMarkerSpace(tenth) === false) {
	      return; // Not space for another endscreen
	    }
	

	    // Hide dialog
	    if (this.IV.controls.$more.attr('aria-expanded') === 'true') {
	      this.IV.controls.$more.click();
	    }
	    else if (this.IV.controls.$endscreens) {
	      this.IV.controls.$endscreens.click();
	    }
	

	    // Move other increament other ids.
	    this.IV.trigger('endscreensChanged', {'index': i, 'number': 1});
	

	    this.params.endscreens.splice(i, 0, {
	      time: time,
	      label: this.IV.humanizeTime(time) + ' ' + t('endscreen')
	    });
	

	    var $endscreen = this.IV.addEndscreen(i, tenth);
	    if (!freshOnly) {
	      $endscreen.addClass('ivmedia-show');
	    }
	  };
	

	  /**
	   * Check for blocked marker position.
	   *
	   * @param {number} tenth - Position to check in tenth.
	   * @return {boolean} True if position was free.
	   */
	  InteractiveVideoEditor.prototype.checkMarkerSpace = function (tenth) {
	    if (this.IV.bookmarksMap[tenth] !== undefined) {
	      this.displayMessage(t('bookmarkAlreadyExists'));
	      return false;
	    }
	    if (this.IV.endscreensMap[tenth] !== undefined) {
	      this.displayMessage(t('endscreenAlreadyExists'));
	      return false;
	    }
	    return true;
	  };
	

