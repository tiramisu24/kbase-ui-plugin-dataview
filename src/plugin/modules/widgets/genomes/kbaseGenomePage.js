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
    'kb_common/html',
    'kb_service/client/workspace',
    'kb_sdk_clients/GenomeAnnotationAPI/dev/GenomeAnnotationAPIClient',
    'kb_sdk_clients/AssemblyAPI/dev/AssemblyAPIClient',
    'kb/widget/legacy/widget',
    'kb_dataview_genomes_wideOverview',
    'kb_dataview_genomes_literature',
    'kb_dataview_genomes_wideTaxonomy',
    'kb_dataview_genomes_wideAssemblyAnnotation',
],
    function ($, html, Workspace, GenomeAnnotationAPI, AssemblyAPI) {
        'use strict';
        $.KBWidget({
            name: "KBaseGenomePage",
            parent: "kbaseWidget",
            version: "1.0.0",
            options: {
                genomeID: null,
                workspaceID: null,
                ver: null
            },
            init: function (options) {
                this._super(options);
                this.init_view();
                this.fetchGenome();
                return this;
            },
            fetchGenome: function() {
                var self = this,
                    scope = {
                        ws: this.options.workspaceID,
                        id: this.options.genomeID,
                        ver: this.options.ver
                    },
                    objId = scope.ws + "/" + scope.id,
                    genome_fields = [
                        'contigset_ref',
                        'assembly_ref',
                        'domain',
                        'dna_size',
                        'scientific_name',
                        'source',
                        'source_id',
                        'genetic_code',
                        'id',
                        'contig_ids',
                        'contig_lengths',
                        'gc_content'
                    ],
                    feature_fields = [
                        'type',
                        'id',
                        'contig_id',
                        'location',
                        'function'
                    ];

                this.ga_api = new GenomeAnnotationAPI({
                    url: this.runtime.getConfig('services.service_wizard.url'),
                    auth: {'token': this.runtime.service('session').getAuthToken()},
                    version: 'release'
                });
                this.asm_api = new AssemblyAPI({
                    url: this.runtime.getConfig('services.service_wizard.url'),
                    auth: {'token': this.runtime.service('session').getAuthToken()},
                    version: 'release'
                });

                if (this.options.ver) {
                    objId += "/" + this.options.ver;
                }

                self.ga_api.get_genome_v1({"genomes": [{"ref": objId}],
                                      "included_fields": genome_fields}).then(function (data) {
                    var assembly_ref = null,
                        gnm = data.genomes[0].data,
                        metadata = data.genomes[0].info[10],
                        add_stats = function (obj, size, gc, num_contigs) {
                            Object.defineProperties(obj, {
                                "dna_size": {
                                    __proto__: null,
                                    value: size,
                                    writable: false,
                                    enumerable: true
                                },
                                "gc_content": {
                                    __proto__: null,
                                    value: gc,
                                    writable: false,
                                    enumerable: true
                                },
                                "num_contigs": {
                                    __proto__: null,
                                    value: num_contigs,
                                    writable: false,
                                    enumerable: true
                                }
                            });
                        },
                        assembly_error = function (data, error) {
                            console.error("Error loading contigset subdata");
                            console.error(error);
                            console.log(data);
                        };

                    if (gnm.hasOwnProperty('contigset_ref')) {
                        assembly_ref = gnm.contigset_ref;
                    }
                    else if (gnm.hasOwnProperty('assembly_ref')) {
                        assembly_ref = gnm.assembly_ref;
                    }
                    else {
                        // no assembly reference found, error
                        assembly_error(gnm, "No assembly reference present!");
                    }
                    
                    if (gnm.domain === 'Eukaryota' || gnm.domain === 'Plant') {
                        if (metadata && metadata["GC content"] && metadata["Size"] && metadata["Number contigs"]) {
                            add_stats(gnm,
                                      metadata["Size"],
                                      metadata["GC content"],
                                      metadata["Number contigs"]);
                            self.render(data.genomes[0]);
                        }
                        else {
                            self.asm_api.get_stats(assembly_ref).then(function (stats) {
                                add_stats(gnm,
                                          stats.dna_size,
                                          stats.gc_content,
                                          stats.num_contigs);
                                self.render(data.genomes[0]);
                                return null;
                            }).catch(function (error) {
                                assembly_error(gnm, error);
                            });
                        }
                        return null;
                    }
                    else {
                        genome_fields.push('features');
                        self.ga_api.get_genome_v1({"genomes": [{"ref": objId}],
                                              "included_fields": genome_fields,
                                              "included_feature_fields": feature_fields}).then(function (data) {
                            gnm = data.genomes[0].data;
                            metadata = data.genomes[0].info[10];

                            if (metadata && metadata["GC content"] && metadata["Size"] && metadata["Number contigs"]) {
                                add_stats(gnm,
                                          metadata["Size"],
                                          metadata["GC content"],
                                          metadata["Number contigs"]);
                                self.render(data.genomes[0]);
                            }
                            else if (!gnm.hasOwnProperty("dna_size")) {
                                self.asm_api.get_stats(assembly_ref).then(function (stats) {
                                    add_stats(gnm,
                                              stats.dna_size,
                                              stats.gc_content,
                                              stats.num_contigs);
                                    self.render(data.genomes[0]);
                                    return null;
                                }).catch(function (error) {
                                    assembly_error(gnm, error);
                                });
                            }
                            else {
                                self.render(data.genomes[0]);
                            }

                            return null;
                        }).catch(function (error) {
                           console.error(error);
                        });
                    }

                    return null;
                }).catch(function (error) {
                    console.error("Error loading genome subdata");
                    console.error(error);
                    self.showError(self.view.panels[0].inner_div, error);
                    self.view.panels[1].inner_div.empty();
                    self.view.panels[2].inner_div.empty();
                    self.view.panels[3].inner_div.empty();
                });
            },
            fetchAssembly: function(genomeInfo, callback) {
                var self = this,
                    assembly_ref = null,
                    gnm = genomeInfo.data;

                if (gnm.hasOwnProperty('contigset_ref')) {
                    assembly_ref = gnm.contigset_ref;
                }
                else if (gnm.hasOwnProperty('assembly_ref')) {
                    assembly_ref = gnm.assembly_ref;
                }

                self.asm_api.get_contig_ids(assembly_ref).then(function (contig_ids) {
                    Object.defineProperties(gnm, {
                        "contig_ids": {
                            __proto__: null,
                            value: contig_ids,
                            writable: false,
                            enumerable: true
                        }
                    });
                    return self.asm_api.get_contig_lengths(assembly_ref, contig_ids).then(function (contig_lengths) {
                        Object.defineProperties(gnm, {
                            "contig_lengths": {
                                __proto__: null,
                                value: contig_lengths,
                                writable: false,
                                enumerable: true
                            }
                        });

                        callback(genomeInfo);
                        return null;
                    }).catch(function (error) {
                        self.showError(self.view.panels[3].inner_div, error);
                    });
                }).catch(function (error) {
                    self.showError(self.view.panels[3].inner_div, error);
                });
            },
            init_view: function () {
                var cell_html = "<div>";

                this.view = {
                    panels: [
                        {
                            label: 'Overview',
                            outer_div: $(cell_html),
                            inner_div: this.makePleaseWaitPanel()
                        },
                        {
                            order: 2,
                            label: 'Publications',
                            outer_div: $(cell_html),
                            inner_div: this.makePleaseWaitPanel()
                        },
                        {
                            order: 3,
                            label: 'Taxonomy',
                            outer_div: $(cell_html),
                            inner_div: this.makePleaseWaitPanel()
                        },
                        {
                            order: 4,
                            label: 'Assembly and Annotation',
                            outer_div: $(cell_html),
                            inner_div: this.makePleaseWaitPanel()
                        }
                    ]
                };

                for (var i = 0; i < this.view.panels.length; i++) {
                    this.makeWidgetPanel(this.view.panels[i].outer_div,
                                         this.view.panels[i].label,
                                         this.view.panels[i].inner_div);
                    this.$elem.append(this.view.panels[i].outer_div);
                }
            },
            render: function (genomeInfo) {
                var self = this,
                    scope = {
                        ws: this.options.workspaceID,
                        id: this.options.genomeID,
                        ver: this.options.ver
                    },
                    panelError = function (p, e) {
                        console.error(e);
                        self.showError(p, e.message);
                    },
                    objId = scope.ws + "/" + scope.id;

                if (self.options.ver) {
                    objId += "/" + self.options.ver;
                }

                self.view.panels[0].inner_div.empty();
                try {
                    self.view.panels[0].inner_div.KBaseGenomeWideOverview({
                        genomeID: scope.id,
                        workspaceID: scope.ws,
                        genomeInfo: genomeInfo,
                        runtime: self.runtime
                    });
                }
                catch (e) {
                    panelError(self.view.panels[0].inner_div, e);
                }

                var searchTerm = "";
                if (genomeInfo && genomeInfo.data['scientific_name']) {
                    searchTerm = genomeInfo.data['scientific_name'];
                }
                self.view.panels[1].inner_div.empty();
                try {
                    self.view.panels[1].inner_div.KBaseLitWidget({
                        literature: searchTerm,
                        genomeInfo: genomeInfo,
                        runtime: self.runtime
                    });
                }
                catch (e) {
                    panelError(self.view.panels[1].inner_div, e);
                }

                /*
                self.view.panels[2].inner_div.empty();
                try {
                    self.view.panels[2].inner_div.KBaseGenomeWideCommunity({genomeID: scope.id, workspaceID: scope.ws, kbCache: kb, genomeInfo: genomeInfo});
                }
                catch (e) {
                    panelError(self.view.panels[2].inner_div, e);
                }
                */

                self.view.panels[2].inner_div.empty();
                try {
                    self.view.panels[2].inner_div.KBaseGenomeWideTaxonomy({
                        genomeID: scope.id,
                        workspaceID: scope.ws,
                        genomeInfo: genomeInfo,
                        runtime: self.runtime
                    });
                }
                catch (e) {
                    panelError(self.view.panels[2].inner_div, e);
                }

                if (genomeInfo && genomeInfo.data['domain'] === 'Eukaryota' ||
                    genomeInfo && genomeInfo.data['domain'] === 'Plant') {
                    self.view.panels[3].inner_div.empty();
                    self.view.panels[3].inner_div.append("Browsing Eukaryotic Genome Features is not supported at this time.");
                }
                else {
                    var gnm = genomeInfo.data,
                        assembly_callback = function (genomeInfo) {
                            self.view.panels[3].inner_div.empty();
                            try {
                                self.view.panels[3].inner_div.KBaseGenomeWideAssemAnnot({
                                    genomeID: scope.id,
                                    workspaceID: scope.ws,
                                    ver: scope.ver,
                                    genomeInfo: genomeInfo,
                                    runtime: self.runtime
                                });
                            } catch (e) {
                                panelError(self.view.panels[3].inner_div, e);
                            }
                        };

                    if (gnm.contig_ids && gnm.contig_lengths && gnm.contig_ids.length === gnm.contig_lengths.length) {
                        assembly_callback(genomeInfo);
                    }
                    else {
                        self.fetchAssembly(genomeInfo, assembly_callback);
                    }
                }
            },
            makePleaseWaitPanel: function () {
                return $('<div>').html(html.loading('loading...'));
            },
            makeWidgetPanel: function ($panel, title, $widgetDiv) {
                var id = this.genUUID();
                $panel.append(
                    $('<div class="panel-group" id="accordion_' + id + '" role="tablist" aria-multiselectable="true">')
                    .append($('<div class="panel panel-default kb-widget">')
                        .append('' +
                            '<div class="panel-heading" role="tab" id="heading_' + id + '">' +
                            '<h4 class="panel-title">' +
                            '<span data-toggle="collapse" data-parent="#accordion_' + id + '" data-target="#collapse_' + id + '" aria-expanded="false" aria-controls="collapse_' + id + '" style="cursor:pointer;">' +
                            ' ' + title +
                            '</span>' +
                            '</h4>' +
                            '</div>'
                            )
                        .append($('<div id="collapse_' + id + '" class="panel-collapse collapse in" role="tabpanel" aria-labelledby="heading_' + id + '" area-expanded="true">')
                            .append($('<div class="panel-body">').append($widgetDiv))
                            )
                        )
                    );
            },
            getData: function () {
                return {
                    type: "Genome Page",
                    id: this.options.genomeID,
                    workspace: this.options.workspaceID,
                    title: "Genome Page"
                };
            },
            showError: function (panel, e) {
                panel.empty();
                panel.append("Error: " + JSON.stringify(e));
            },
            genUUID: function () {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        });
    });