define([
    'jquery',

    'kb_widget/legacy/widget',
    'kb_dataview_genomes_multiContigBrowser',
    'kb_dataview_genomes_seedFunctions',
    'kb_dataview_genomes_geneTable'
], function($) {
    'use strict';
    $.KBWidget({
        name: 'KBaseGenomeWideAssemAnnot',
        parent: 'kbaseWidget',
        version: '1.0.0',
        options: {
            genomeID: null,
            workspaceID: null,
            ver: null,
            genomeInfo: null,
            contigSetInfo: null
        },
        init: function(options) {
            this._super(options);
            this.render();
            return this;
        },
        render: function() {
            var self = this;
            var row0 = $('<div class="row">');
            self.$elem.append(row0);
            var contigbrowser = $('<div class="col-md-12">');
            row0.append(contigbrowser);
            contigbrowser.KBaseMultiContigBrowser({
                genomeID: self.options.genomeID,
                workspaceID: self.options.workspaceID,
                ver: self.options.ver,
                genomeInfo: self.options.genomeInfo,
                runtime: self.runtime
            });
            var row1 = $('<div class="row">');
            self.$elem.append(row1);
            var seedannotations = $('<div class="col-md-6">');
            row1.append(seedannotations);
            var genetable = $('<div class="col-md-6">');
            row1.append(genetable);
            seedannotations.KBaseSEEDFunctions({
                objNameOrId: self.options.genomeID,
                wsNameOrId: self.options.workspaceID,
                objVer: null,
                genomeInfo: self.options.genomeInfo,
                runtime: self.runtime
            });
            genetable.KBaseGenomeGeneTable({
                genome_id: self.options.genomeID,
                ws_name: self.options.workspaceID,
                ver: self.options.ver,
                genomeInfo: self.options.genomeInfo,
                runtime: self.runtime
            });
        },
        getData: function() {
            return {
                type: 'Genome Assembly and Annotation',
                id: this.options.genomeID,
                workspace: this.options.workspaceID,
                title: 'Assembly and Annotation'
            };
        }

    });
});