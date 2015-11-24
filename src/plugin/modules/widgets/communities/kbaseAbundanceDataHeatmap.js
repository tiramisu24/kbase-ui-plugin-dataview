/**
 * KBase widget to display table of BIOM data
 */
/*jslint
 browser: true,
 white: true
 */
/**
 * KBase widget to display a Metagenome Collection
 */
define([
    'jquery',
    'bluebird',
    'kb/service/client/workspace',
    'kb/common/html',
    'kb_dataview_communities_heatmap',
    // no parameters
    'datatables_bootstrap',
    'kb/widget/bases/legacy/authenticatedWidget'
],
    function ($, Promise, Workspace, html, Heatmap) {
        'use strict';
        $.KBWidget({
            name: 'AbundanceDataHeatmap',
            parent: "kbaseAuthenticatedWidget",
            version: '1.0.0',
            token: null,
            options: {
                id: null,
                ws: null,
                rows: 0
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
                        var msg = "[Error] Object " + self.options.id + " does not exist in workspace " + self.options.ws;
                        container.append('<div><p>' + msg + '>/p></div>');
                    } else {
                        var heatdata = data[0].data;
                        // HEATMAP
                        var heatmapId = html.genId();
                        container.append("<div id='outputHeatmap" + heatmapId + "' style='width: 95%;'></div>");
                        var heatTest = Heatmap.create({
                            target: $("#outputHeatmap" + heatmapId).get(0),
                            data: heatdata
                        });
                        heatTest.render();
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
                this.token = auth.token;
                this.render();
                return this;
            },
            loggedOutCallback: function (event, auth) {
                this.token = null;
                this.render();
                return this;
            }
        });
    });
