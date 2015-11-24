/**
 * Just a simple example widget to display an expression series
 * 
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
    'bluebird',
    'kb/common/html',
    'kb/common/utils',
    'kb_service_workspace',
    'kb_service_workspaceClient',
    'kb/widget/bases/legacy/widget',
    'kb/widget/bases/legacy/tabs',
    
    'datatables_bootstrap'
], function ($, Promise, html, Utils, Workspace, workspaceClient) {
    'use strict';
    $.KBWidget({
        name: "kbaseExpressionSeries",
        parent: "kbaseWidget",
        version: "1.0.0",
        options: {
            color: "black"
        },
        init: function (options) {
            this._super(options);
            var workspace = new Workspace(this.runtime.getConfig('services.workspace.url'), {
                token: this.runtime.service('session').getAuthToken()
            }),
                wsClient = Object.create(workspaceClient).init({
                url: this.runtime.getConfig('services.workspace.url'),
                authToken: this.runtime.service('session').getAuthToken()
            }),
                name = options.name,
                container = this.$elem;

            container.html(html.loading());

            function buildTable(data, refhash) {
                return Promise.try(function () {
                    container.empty();
                    var tabs = container.kbTabs({tabs: [
                            {name: 'Overview', active: true},
                            {name: 'ExpressionSeries', content: html.loading()}]
                    }),
                        // Code to displaying overview data
                        keys = [
                            {key: 'wsid'},
                            {key: 'ws'},
                            {key: 'kbid'},
                            {key: 'source'},
                            {key: 'genome'},
                            {key: 'type'},
                            {key: 'errors'},
                            {key: 'owner'},
                            {key: 'date'}
                        ],
                        wsObj = data[0][0],
                        genome = Object.keys(wsObj.data.genome_expression_sample_ids_map)[0],
                        phenooverdata = {
                            wsid: wsObj.info[1],
                            ws: wsObj.info[7],
                            kbid: wsObj.data.regulome_id,
                            source: wsObj.data.source,
                            genome: genome,
                            type: wsObj.data.type,
                            errors: wsObj.data.importErrors,
                            owner: wsObj.creator,
                            date: wsObj.created
                        },
                        labels = ['Name', 'Workspace', 'KBID', 'Source', 'Genome', 'Type', 'Errors', 'Owner', 'Creation date'],
                        table = Utils.objTable({obj: phenooverdata, keys: keys, labels: labels}),
                        series = wsObj.data.genome_expression_sample_ids_map[genome],
                        sample_refs = [];
                        
                    tabs.tabContent('Overview').append(table);

                    for (var i = 0; i < series.length; i++) {
                        sample_refs.push({ref: series[i]});
                    }
                    return Promise.resolve(workspace.get_objects(sample_refs))
                        .then(function (sample_data) {
                            // container.rmLoading();
                            //container.empty();
                            //container.append(pcTable);
                            // create a table from the sample names
                            var pcTable = $('<table class="table table-bordered table-striped" style="width: 100%;">');
                            tabs.setContent({name: 'ExpressionSeries', content: pcTable});
                            var tableSettings = {
                                sPaginationType: "full_numbers",
                                iDisplayLength: 10,
                                aaData: sample_data,
                                aaSorting: [[0, "asc"]],
                                aoColumns: [{
                                        sTitle: "Gene Expression Samples",
                                        mData: function (d) {
                                            return d.data.id;
                                        }
                                    }],
                                oLanguage: {
                                    sEmptyTable: "No objects in workspace",
                                    sSearch: "Search: "
                                }
                            };
                            pcTable.dataTable(tableSettings);
                            // container.html(tabs);
                        });
                });
            }
            
            workspace.get_objects([{workspace: options.ws, name: options.name}])
                .then(function (data) {
                    var reflist = data[0].refs;
                    return new Promise.all([data, wsClient.translateRefs(reflist)]);
                })
                .then(function (data, refhash) {
                    return buildTable(data, refhash);
                })
                .catch(function (e) {
                    // container.rmLoading();
                    console.log('ERROR');
                    console.log(e);
                    container.append('<div class="alert alert-danger">' +
                        e.error.message + '</div>');
                });
            
            return this;
        }
    });
});