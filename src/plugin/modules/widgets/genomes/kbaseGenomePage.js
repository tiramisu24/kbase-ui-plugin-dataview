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
    'kb/common/html',
    'kb/service/client/workspace',
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
                
                this.render();
                return this;
            },
            fetchGenome: function() {
                var scope = {
                    ws: this.options.workspaceID,
                    id: this.options.genomeID,
                    ver: this.options.ver
                },
                objId = scope.ws + "/" + scope.id,
                ga_api = new GenomeAnnotationAPI({
                    url: this.runtime.getConfig('services.service_wizard.url'),
                    auth: {'token': this.runtime.service('session').getAuthToken()},
                    version: 'release'
                }),
                asm_api = new AssemblyAPI({
                    url: this.runtime.getConfig('services.service_wizard.url'),
                    auth: {'token': this.runtime.service('session').getAuthToken()},
                    version: 'release'
                });

                if (this.options.ver) {
                    objId += "/" + this.options.ver;
                }
                
                ga_api.get_genome_v1({"genomes": [{"ref": objId}],
                                      "included_fields": genome_fields}).then(function (data) {
                    var assembly_ref = null,
                        gnm = data.genomes[0].data,
                        metadata = data.genomes[0].info[10];

                    console.log(gnm, metadata);
                    
                    if (gnm.hasOwnProperty('contigset_ref')) {
                        assembly_ref = gnm.contigset_ref;
                    }
                    else if (gnm.hasOwnProperty('assembly_ref')) {
                        assembly_ref = gnm.assembly_ref;
                    }

                    if (gnm.domain === 'Eukaryota' || gnm.domain === 'Plant') {
                        var assembly_error = function (error) {
                            console.error("Error loading contigset subdata");
                            console.error(error);
                            console.log(gnm);
                        };

                        if (metadata && metadata["GC content"] && metadata["Size"] && metadata["Number contigs"]) {
                            Object.defineProperties(gnm, {
                                "dna_size": {
                                    __proto__: null,
                                    value: metadata["Size"],
                                    writable: false,
                                    enumerable: true
                                },
                                "gc_content": {
                                    __proto__: null,
                                    value: metadata["GC content"],
                                    writable: false,
                                    enumerable: true
                                },
                                "num_contigs": {
                                    __proto__: null,
                                    value: metadata["Number contigs"],
                                    writable: false,
                                    enumerable: true
                                }
                            });
                            ready(data.genomes[0]);
                        }
                        else {
                            asm_api.get_stats(assembly_ref).then(function (stats) {
                                Object.defineProperties(gnm, {
                                    "dna_size": {
                                        __proto__: null,
                                        value: stats.dna_size,
                                        writable: false,
                                        enumerable: true
                                    },
                                    "gc_content": {
                                        __proto__: null,
                                        value: stats.gc_content,
                                        writable: false,
                                        enumerable: true
                                    },
                                    "num_contigs": {
                                        __proto__: null,
                                        value: stats.num_contigs,
                                        writable: false,
                                        enumerable: true
                                    }
                                });
                                
                                ready(data.genomes[0]);
                                return null;
                            }).catch(function (error) {
                                assembly_error(error);
                            });
                        }
                        return null;
                    }
                    else {
                        ga_api.get_genome_v1({"genomes": [{"ref": objId}],
                                              "included_fields": genome_fields,
                                              "included_feature_fields": feature_fields}).then(function (data) {
                            gnm = data.genomes[0];
                            metadata = data.genomes[0].info[10];
                            var assembly_error = function (error) {
                                console.error("Error loading contigset subdata");
                                console.error(error);
                                console.log(gnm);
                            };

                            console.log(gnm, metadata);
                            if (metadata && metadata["GC content"] && metadata["Size"] && metadata["Number contigs"]) {
                                Object.defineProperties(gnm, {
                                    "dna_size": {
                                        __proto__: null,
                                        value: metadata["Size"],
                                        writable: false,
                                        enumerable: true
                                    },
                                    "gc_content": {
                                        __proto__: null,
                                        value: metadata["GC content"],
                                        writable: false,
                                        enumerable: true
                                    },
                                    "num_contigs": {
                                        __proto__: null,
                                        value: metadata["Number contigs"],
                                        writable: false,
                                        enumerable: true
                                    }
                                });
                                ready(data.genomes[0]);
                            }
                            else if (!gnm.data.hasOwnProperty("dna_size")) {
                                asm_api.get_stats(assembly_ref).then(function (stats) {
                                    Object.defineProperties(gnm.data, {
                                        "dna_size": {
                                            __proto__: null,
                                            value: stats.dna_size,
                                            writable: false,
                                            enumerable: true
                                        },
                                        "gc_content": {
                                            __proto__: null,
                                            value: stats.gc_content,
                                            writable: false,
                                            enumerable: true
                                        },
                                        "num_contigs": {
                                            __proto__: null,
                                            value: stats.num_contigs,
                                            writable: false,
                                            enumerable: true
                                        }
                                    });
                                
                                    ready(data.genomes[0]);
                                    return null;
                                }).catch(function (error) {
                                    assembly_error(error);
                                });
                            }
                            else {
                                ready(data.genomes[0]);
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
                    panel1.empty();
                    self.showError(panel1, error);
                    cell2.empty();
                    cell3.empty();
                    cell4.empty();
                    cell5.empty();
                });                
            },
            fetchAssembly: function(genomeInfo, callback) {
                var assembly_ref = null,
                    gnm = genomeInfo.data;

                if (gnm.hasOwnProperty('contigset_ref')) {
                    assembly_ref = gnm.contigset_ref;
                }
                else if (gnm.hasOwnProperty('assembly_ref')) {
                    assembly_ref = gnm.assembly_ref;
                }
               
                asm_api.get_contig_ids(assembly_ref).then(function (contig_ids) {
                    Object.defineProperties(gnm, {
                        "contig_ids": {
                            __proto__: null,
                            value: contig_ids,
                            writable: false,
                            enumerable: true
                        }
                    });
                    return asm_api.get_contig_lengths(assembly_ref, contig_ids).then(function (contig_lengths) {
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
                        panelError(panel5, error);
                    });
                }).catch(function (error) {
                    panelError(panel5, error);
                });  
            },
            render: function () {
                var self = this;
                var scope = {ws: this.options.workspaceID, id: this.options.genomeID, ver: this.options.ver};
                
                var cell1 = $('<div panel panel-default">');
                self.$elem.append(cell1);
                var panel1 = self.makePleaseWaitPanel();
                self.makeDecoration(cell1, 'Overview', panel1);

                var cell2 = $('<div panel panel-default">');
                self.$elem.append(cell2);
                var panel2 = self.makePleaseWaitPanel();
                self.makeDecoration(cell2, 'Publications', panel2);

                var cell3 = $('<div panel panel-default">');
                self.$elem.append(cell3);
                var panel3 = self.makePleaseWaitPanel();
                //self.makeDecoration(cell3, 'KBase Community', panel3);

                var cell4 = $('<div panel panel-default">');
                self.$elem.append(cell4);
                var panel4 = self.makePleaseWaitPanel();
                self.makeDecoration(cell4, 'Taxonomy', panel4);

                var cell5 = $('<div panel panel-default">');
                self.$elem.append(cell5);
                var panel5 = self.makePleaseWaitPanel();
                self.makeDecoration(cell5, 'Assembly and Annotation', panel5);

                var objId = scope.ws + "/" + scope.id;
                if (self.options.ver) {
                    objId += "/" + self.options.ver;
                }

                var ready = function (genomeInfo) {
                    var panelError = function (p, e) {
                        console.error(e);
                        self.showError(p, e.message);
                    };
                    
                    panel1.empty();
                    try {
                        panel1.KBaseGenomeWideOverview({
                            genomeID: scope.id,
                            workspaceID: scope.ws,
                            genomeInfo: genomeInfo,
                            runtime: self.runtime
                        });
                    }
                    catch (e) {
                        panelError(panel1, e);
                    }

                    var searchTerm = "";
                    if (genomeInfo && genomeInfo.data['scientific_name']) {
                        searchTerm = genomeInfo.data['scientific_name'];
                    }
                    panel2.empty();
                    try {
                        panel2.KBaseLitWidget({
                            literature: searchTerm,
                            genomeInfo: genomeInfo,
                            runtime: self.runtime
                        });
                    }
                    catch (e) {
                        panelError(panel2, e);
                    }

                    //panel3.empty();
                    //panel3.KBaseGenomeWideCommunity({genomeID: scope.id, workspaceID: scope.ws, kbCache: kb, 
                    //	genomeInfo: genomeInfo});

                    panel4.empty();
                    try {
                        panel4.KBaseGenomeWideTaxonomy({
                            genomeID: scope.id,
                            workspaceID: scope.ws,
                            genomeInfo: genomeInfo,
                            runtime: self.runtime
                        });
                    }
                    catch (e) {
                        panelError(panel4, e);
                    }

                    if (genomeInfo && genomeInfo.data['domain'] === 'Eukaryota' ||
                        genomeInfo && genomeInfo.data['domain'] === 'Plant') {
                        cell5.empty();
                    } else {
                        var gnm = genomeInfo.data,
                            assembly_callback = function () {
                                panel5.empty();
                                try {
                                    panel5.KBaseGenomeWideAssemAnnot({
                                        genomeID: scope.id,
                                        workspaceID: scope.ws,
                                        ver: scope.ver,
                                        genomeInfo: genomeInfo,
                                        runtime: self.runtime
                                    });
                                } catch (e) {
                                    panelError(panel5, e);
                                }                                
                            };

                        if (gnm.contig_ids && gnm.contig_lengths && gnm.contig_ids.length === gnm.contig_lengths.length) {
                            assembly_callback(genomeInfo);
                        } else {
                            this.fetchAssembly(gnm, assembly_callback);                                
                        }
                    }
                };
            },
            makePleaseWaitPanel: function () {
                return $('<div>').html(html.loading('loading...'));
            },
            makeDecoration: function ($panel, title, $widgetDiv) {
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