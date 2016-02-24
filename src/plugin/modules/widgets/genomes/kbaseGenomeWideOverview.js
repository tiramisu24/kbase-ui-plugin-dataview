/*global
 define
 */
/*jslint
 browser: true,
 white: true
 */
/**
 * Shows general gene info.
 * Such as its name, synonyms, annotation, publications, etc.
 *
 * Gene "instance" info (e.g. coordinates on a particular strain's genome)
 * is in a different widget.
 */
define([
    'jquery',
    'kb/widget/legacy/widget',
    'kb_dataview_genomes_overview',
    'kb_dataview_genomes_wikiDescription'
], function ($) {
    'use strict';
    $.KBWidget({
        name: "KBaseGenomeWideOverview",
        parent: "kbaseWidget",
        version: "1.0.0",
        options: {
            genomeID: null,
            workspaceID: null,
            genomeInfo: null
        },
        init: function (options) {
            this._super(options);
            this.render();
            return this;
        },
        render: function () {
            var self = this;
            var row = $('<div class="row">');
            self.$elem.append(row);
            var overview = $('<div class="col-md-4">');
            row.append(overview);
            var wikidescription = $('<div class="col-md-8">');
            row.append(wikidescription);

            overview.KBaseGenomeOverview({
                genomeID: self.options.genomeID,
                workspaceID: self.options.workspaceID,
                genomeInfo: self.options.genomeInfo,
                runtime: self.runtime
            });
            wikidescription.KBaseWikiDescription({
                genomeID: self.options.genomeID,
                workspaceID: self.options.workspaceID,
                genomeInfo: self.options.genomeInfo,
                runtime: self.runtime
            });

        },
        getData: function () {
            return {
                type: "Genome Overview",
                id: this.options.genomeID,
                workspace: this.options.workspaceID,
                title: "Overview"
            };
        }

    });
});