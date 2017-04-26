/**
 * Shows general gene info.
 * Such as its name, synonyms, annotation, publications, etc.
 *
 * Gene "instance" info (e.g. coordinates on a particular strain's genome)
 * is in a different widget.
 */
define([
    'jquery',
    'kb_common/html',
    'kb_service/client/workspace',
    'kb_widget/legacy/widget'
], function(
    $,
    html,
    Workspace) {
    'use strict';
    $.KBWidget({
        name: 'KBaseGeneInstanceInfo',
        parent: 'kbaseWidget',
        version: '1.0.0',
        options: {
            featureID: null,
            workspaceID: null,
            genomeID: null,
            hideButtons: false,
            width: 350,
            genomeInfo: null
        },
        init: function(options) {
            this._super(options);

            if (!this.options.featureID) {
                this.renderError();
                return this;
            }

            this.workspaceClient = new Workspace(this.runtime.config('services.workspace.url'));

            this.render();
            this.renderWorkspace();

            return this;
        },
        render: function(options) {
            /*
             * Need to get:
             * Feature name
             * Feature type (cds, peg, etc.)
             * Location (coordinates) (link to centered genome browser -- or highlight in existing one?)
             * Length
             * Exons/structure.
             * Link to alignments, domains, trees, etc. GC content?
             * families
             * subsystems
             */

            var makeButton = function(btnName) {
                var id = btnName;
                btnName = btnName.replace(/\w\S*/g,
                    function(txt) {
                        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                    });

                return $('<button>')
                    .attr('id', id)
                    .attr('type', 'button')
                    .addClass('btn btn-primary')
                    .append(btnName);

            };

            this.$messagePane = $('<div/>')
                .addClass('kbwidget-message-pane kbwidget-hide-message');
            this.$elem.append(this.$messagePane);

            this.$infoPanel = $('<div>').css('overflow', 'auto');
            this.$infoTable = $('<table>')
                .addClass('table table-striped table-bordered');
            this.$buttonPanel = $('<div>')
                .attr('align', 'center')
                .addClass('btn-group')
                //.append(makeButton("domains"))
                //.append(makeButton("operons"))
                .append(makeButton('sequence'))
                .append(makeButton('biochemistry'))
                .append(makeButton('structure'));


            this.$infoPanel.append(this.$infoTable);
            if (!this.options.hideButtons) {
                this.$infoPanel.append(this.$buttonPanel);
            }

            this.$elem.append(this.$infoPanel);
        },

        renderWorkspace: function() {
            var self = this;
            this.$infoPanel.hide();
            this.showMessage(html.loading());

            if (self.options.genomeInfo) {
                self.ready(self.options.genomeInfo);
            } else {
                var obj = this.buildObjectIdentity(this.options.workspaceID, this.options.genomeID),
                    prom = this.workspace.get_objects([obj]);

                // var prom = this.options.kbCache.req('ws', 'get_objects', [obj]);
                $.when(prom).fail($.proxy(function(error) {
                    this.renderError(error);
                    console.error(error);
                }, this));
                $.when(prom).done($.proxy(function(genome) {
                    genome = genome[0];
                    self.ready(genome);
                }, this));
            }
        },
        ready: function(genome) {
            var self = this,
                feature = null;
            if (genome.data.features) {
                for (var i = 0; i < genome.data.features.length; i++) {
                    if (genome.data.features[i].id === this.options.featureID) {
                        feature = genome.data.features[i];
                        break;
                    }
                }

                if (feature) {
                    // FINALLY we have the feature! Hooray!
                    this.$infoTable.empty();
                    /* Function
                     * Genome + link
                     * Length
                     * Location
                     * Aliases
                     */

                    // Figure out the function.
                    var func = feature['function'];
                    if (!func) {
                        func = 'Unknown';
                    }
                    this.$infoTable.append(this.makeRow('Function', func));

                    // Show the genome and a button for it.
                    this.$infoTable.append(this.makeRow('Genome', $('<div/>')
                        .append(genome.data.scientific_name)
                        .append('<br>')
                        .append(this.makeGenomeButton(this.options.genomeID, this.options.workspaceID))));
                    // Figure out the feature length
                    var len = 'Unknown';
                    if (feature.dna_sequence_length) {
                        len = feature.dna_sequence_length + ' bp';
                    } else if (feature.dna_sequence) {
                        len = feature.dna_sequence.length + ' bp';
                    } else if (feature.location && feature.location.length > 0) {
                        len = 0;
                        for (var i = 0; i < feature.location.length; i++) {
                            len += feature.location[i][3];
                        }
                        len += ' bp';
                    }
                    if (feature.protein_translation) {
                        len += ', ' + feature.protein_translation.length + ' aa';
                    }
                    this.$infoTable.append(this.makeRow('Length', len));

                    this.$infoTable.append(this.makeRow('Location', $('<div/>')
                        .append(this.parseLocation(feature.location))));
                    //.append(this.parseLocation(feature.location))
                    //.append(this.makeContigButton(feature.location))));

                    // Aliases
                    var aliasesStr = 'No known aliases';
                    if (feature.aliases)
                        aliasesStr = feature.aliases.join(', ');
                    self.$infoTable.append(self.makeRow('Aliases', aliasesStr));
                    // end Aliases


                    // LOL GC content. Does anyone even care these days?
                    //if (feature.dna_sequence) {
                    //    var gc = this.calculateGCContent(feature.dna_sequence);
                    //    this.$infoTable.append(this.makeRow("GC Content", Number(gc).toFixed(2)));
                    //}

                    // Protein families list.
                    var proteinFamilies = '';
                    if (feature.protein_families) {
                        if (feature.protein_families.length > 0) {
                            proteinFamilies = '';
                            for (var i = 0; i < feature.protein_families.length; i++) {
                                var fam = feature.protein_families[i];
                                proteinFamilies += fam.id + ': ' + fam.subject_description + '<br>';
                            }
                        }
                    }
                    if (proteinFamilies) {
                        this.$infoTable.append(this.makeRow('Protein Families', proteinFamilies));
                    }

                    // first add handlers that say we do not have domains or operons for this gene
                    this.$buttonPanel.find('button#domains').click(function(event) {
                        window.alert('No domain assignments available for this gene.  You will be able to compute domain assignments in the Narrative in the future.');
                    });
                    this.$buttonPanel.find('button#operons').click(function(event) {
                        window.alert('No operon assignments available for this gene.  You will be able to compute operon assignments in the Narrative in the future.');
                    });
                    this.$buttonPanel.find('button#structure').click(function(event) {
                        window.alert('No structure assignments available for this gene.  You will be able to compute structure assignments in the Narrative in the future.');
                    });

                    //determine if a feature id and its protein MD5 translation is found in the CDS- if it is,
                    //return true.  We use this as a hack to see if we have gene info for this feature for WS objects.
                    // cdmi service is defunct - eap
                    // this.cdmiClient.fids_to_proteins([self.options.featureID],
                    //     function(prot) {
                    //         if (prot[self.options.featureID] === feature['md5']) {
                    //             //ok the fid and md5 match, so go to the CDS to get domain info...  what a hack!
                    //             self.$buttonPanel.find('button#domains').off('click');
                    //             self.$buttonPanel.find('button#domains').click(function(event) {
                    //                 self.trigger('showDomains', { event: event, featureID: self.options.featureID });
                    //             });
                    //             self.$buttonPanel.find('button#operons').off('click');
                    //             self.$buttonPanel.find('button#operons').click(function(event) {
                    //                 self.trigger('showOperons', { event: event, featureID: self.options.featureID });
                    //             });
                    //             self.$buttonPanel.find('button#structure').off('click');
                    //             self.$buttonPanel.find('button#structure').click(function(event) {
                    //                 self.trigger('showStructureMatches', { event: event, featureID: self.options.featureID });
                    //             });
                    //         }
                    //     } // we don't add error function- if they don't match or this fails, do nothing.
                    // );

                    // bind button events
                    this.$buttonPanel.find('button#sequence').click(
                        $.proxy(function(event) {
                            this.trigger('showSequence', {
                                event: event,
                                featureID: this.options.featureID,
                                genomeID: this.options.genomeID,
                                workspaceID: this.options.workspaceID,
                                kbCache: this.options.kbCache
                            });
                        }, this)
                    );
                    this.$buttonPanel.find('button#biochemistry').click(
                        $.proxy(function(event) {
                            this.trigger('showBiochemistry', {
                                event: event,
                                featureID: this.options.featureID,
                                genomeID: this.options.genomeID,
                                workspaceID: this.options.workspaceID,
                                kbCache: this.options.kbCache
                            });
                        }, this)
                    );

                } else {
                    this.renderError({
                        error: 'Gene \'' + this.options.featureID +
                            '\' not found in the genome with object id: ' +
                            this.options.workspaceID + '/' + this.options.genomeID
                    });
                }

            } else {
                this.renderError({
                    error: 'No genetic features found in the genome with object id: ' +
                        this.options.workspaceID + '/' +
                        this.options.genomeID
                });
            }

            this.hideMessage();
            this.$infoPanel.show();
        },
        makeRow: function(name, value) {
            var $row = $('<tr/>')
                .append($('<th />').append(name))
                .append($('<td />').append(value));
            return $row;
        },
        makeContigButton: function(loc) {
            if (this.options.hideButtons) {
                return '';
            }
            if (loc === null || loc[0][0] === null)
                return '';

            var contigID = loc[0][0];

            var self = this;
            var $contigBtn = $('<button />')
                .addClass('btn btn-default')
                .append('Show Contig')
                .on('click',
                    function(event) {
                        self.trigger('showContig', {
                            contig: contigID,
                            centerFeature: self.options.featureID,
                            genomeId: self.options.genomeID,
                            workspaceId: self.options.workspaceID,
                            kbCache: self.options.kbCache,
                            event: event
                        });
                    }
                );

            return $contigBtn;
        },
        makeGenomeButton: function(genomeID, workspaceID) {
            if (!genomeID)
                return '';

            if (!workspaceID)
                workspaceID = null;

            return $('<div>')
                .append('<a href="#/dataview/' + workspaceID + '/' + genomeID + '" target="_blank">' + workspaceID + '/<wbr>' + genomeID + '</a>');
        },
        /**
         * Returns the GC content of a string as a percentage value.
         * You'll still need to concat it to some number of decimal places.
         */
        calculateGCContent: function(s) {
            var gc = 0;
            s = s.toLowerCase();
            for (var i = 0; i < s.length; i++) {
                var c = s[i];
                if (c === 'g' || c === 'c')
                    gc++;
            }
            return gc / s.length * 100;
        },
        /**
         * parses out the location into something visible in html, adds a button to open the contig.
         * something like:
         *   123 - 456 (+),
         *   789 - 1234 (+)
         *   on contig [ kb|g.0.c.1 ]  // clicking opens contig browser centered on feature.
         */
        parseLocation: function(loc) {
            if (loc.length === 0) {
                return 'Unknown';
            }

            var locStr = '';
            for (var i = 0; i < loc.length; i++) {
                var start = Number(loc[i][1]);
                var length = Number(loc[i][3]);

                var end = 0;
                if (loc[i][2] === '+')
                    end = start + length - 1;
                else
                    end = start - length + 1;

                locStr += start + ' to ' + end + ' (' + loc[i][2] + ')<br/>';
                //                locStr += loc[i][1] + " - " + loc[i][3] + " (" + loc[i][2] + ")<br/>";
            }
            return locStr;
        },
        showMessage: function(message) {
            var span = $('<span/>').append(message);

            this.$messagePane.empty()
                .append(span)
                .removeClass('hide');
        },
        hideMessage: function() {
            this.$messagePane.addClass('hide');
        },
        getData: function() {
            return {
                type: 'Feature',
                id: this.options.featureID,
                workspace: this.options.workspaceID,
                genome: this.options.genomeID,
                title: 'Gene Instance'
            };
        },
        renderError: function(error) {
            var errString = 'Sorry, an unknown error occurred';
            if (typeof error === 'string')
                errString = error;
            else if (error.error && error.error.message)
                errString = error.error.message;


            var $errorDiv = $('<div>')
                .addClass('alert alert-danger')
                .append('<b>Error:</b>')
                .append('<br>' + errString);
            this.$elem.empty();
            this.$elem.append($errorDiv);
        },
        buildObjectIdentity: function(workspaceID, objectID) {
            var obj = {};
            if (/^\d+$/.exec(workspaceID))
                obj['wsid'] = workspaceID;
            else
                obj['workspace'] = workspaceID;

            // same for the id
            if (/^\d+$/.exec(objectID))
                obj['objid'] = objectID;
            else
                obj['name'] = objectID;
            return obj;
        }
    });
});