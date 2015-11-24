/**
 * KBase widget to display table and boxplot of BIOM data
 */
/*global
 define
 */
/*jslint
 browser: true,
 white: true
 */
define([
    'jquery',
    'kb/common/html',
    'kb_service_workspace',
    
    'kb/widget/bases/legacy/authenticatedWidget',
    'datatables_bootstrap'
],
    function ($, html, Workspace) {
        'use strict';
        $.KBWidget({
            name: 'AnnotationSetTable',
            parent: "kbaseAuthenticatedWidget",
            version: '1.0.0',
            options: {
                id: null,
                ws: null
            },
            init: function (options) {
                this._super(options);
                return this;
            },
            render: function () {
                var self = this;
                var container = this.$elem;
                container.empty();
                if (!this.runtime.service('session').isLoggedIn()) {
                    container.append("<div>[Error] You're not logged in</div>");
                    return;
                }
                container.append(html.loading('loading data...'));

                var kbws = new Workspace(this.runtime.getConfig('services.workspace.url'), {
                    token: this.runtime.service('session').getAuthToken()
                });
                kbws.get_objects([{ref: self.options.ws + "/" + self.options.id}], function (data) {
                    container.empty();
                    // parse data
                    if (data.length === 0) {
                        //var msg = "[Error] Object "+self.options.id+" does not exist in workspace "+self.options.ws;

                        // We are moving away from "workspace"
                        var msg = "[Error] Object " + self.options.id + " can not be found";
                        container.append('<div><p>' + msg + '>/p></div>');
                    } else {
                        var otus = data[0].data.otus,
                            rows = [],
                            o, funcs, f;
                        for (o = 0; o < otus.length; o += 1) {
                            funcs = otus[o].functions;
                            for (f = 0; f < funcs.length; f += 1) {
                                rows.push([
                                    funcs[f].reference_genes.join("<br>"),
                                    funcs[f].functional_role,
                                    funcs[f].abundance,
                                    funcs[f].confidence,
                                    otus[o].name
                                ]);
                            }
                        }

                        // container.append('<div id="annotationTable' + tableId + '" style="width: 95%;"></div>');
                        var options = {
                            columns: ['features', 'functional role', 'abundance', 'avg e-value', 'otu'],
                            rows: rows,
                            class: 'table table-striped'
                        };
                        var table = html.makeTable(options);
                        container.html(table);
                        $('#' + options.generated.id).dataTable();
                    }
                }, function (data) {
                    container.empty();
                    var main = $('<div>');
                    main.append($('<p>')
                        .css({'padding': '10px 20px'})
                        .text('[Error] ' + data.error.message));
                    container.append(main);
                });
                return self;
            },
            loggedInCallback: function (event, auth) {
                this.render();
                return this;
            },
            loggedOutCallback: function (event, auth) {
                this.render();
                return this;
            }
        });
    });