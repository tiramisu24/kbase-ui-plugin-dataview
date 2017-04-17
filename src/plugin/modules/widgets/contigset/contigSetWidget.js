define([
    'bluebird',
    'jquery',
    'numeral',
    'kb_common/html',
    'kb_widget/bases/dataWidget',
    'kb_service/client/workspace',
    'datatables_bootstrap'
], function(Promise, $, numeral, html, DataWidget, Workspace) {
    'use strict';

    function makeObjectRef(obj) {
        return [obj.workspaceId, obj.objectId, obj.objectVersion].filter(function(element) {
            if (element) {
                return true;
            }
        }).join('/');
    }

    function overviewTable(widget, contigSet) {
        var table = {
            columns: ['KBase ID', 'Name', 'Object ID', 'Source', 'Source ID', 'Type'],
            rows: [
                [contigSet.id, contigSet.name, widget.getState('params').objectId, contigSet.source, contigSet.source_id, contigSet.type]
            ],
            classes: ['table', 'table-striped', 'table-bordered']
        };
        return html.makeTableRotated(table);
    }

    function contigsTable(widget, contigSet) {
        var contigsData = contigSet.contigs.map(function(contig) {
                return [
                    contig.id, contig.length
                ];
            }),
            table = {
                columns: ['Contig name', 'Length'],
                rows: contigsData,
                classes: ['table', 'table-striped', 'table-bordered']
            };
        return html.makeTable(table);
    }

    function factory(config) {
        return DataWidget.make({
            runtime: config.runtime,
            title: 'Contig Set Data View',
            on: {
                initialContent: function() {
                    return html.loading('Loading Contig Set data');
                },
                fetch: function(params) {
                    var widget = this;
                    return Promise.try(function() {
                        var workspace = new Workspace(config.runtime.getConfig('services.workspace.url'), {
                            token: widget.runtime.service('session').getAuthToken()
                        });
                        return workspace.get_object_subset([{
                                ref: makeObjectRef(params),
                                included: ['contigs/[*]/id', 'contigs/[*]/length', 'id',
                                    'name', 'source', 'source_id', 'type'
                                ]
                            }])
                            .then(function(data) {
                                widget.setState('contigset', data[0].data);
                            });
                    });
                },
                render: function() {
                    var widget = this,
                        tabId = html.genId(),
                        contigSet = this.getState('contigset'),
                        tabSet;
                    // Need to guard against render calls made when there the 
                    // contigset has not been populated yet.
                    // TODO: remove this. This became necessary when the params
                    // were placed in the state object, but we shouldn't need
                    // to do this.
                    if (!contigSet) {
                        return;
                    }
                    tabSet = {
                        id: tabId,
                        tabs: [{
                                label: 'Overview',
                                name: 'overview',
                                content: overviewTable(widget, contigSet)
                            },
                            {
                                label: 'Contigs',
                                name: 'contigs',
                                content: contigsTable(widget, contigSet)
                            }
                        ]
                    };
                    return {
                        content: html.makeTabs(tabSet),
                        // this runs after the content is rendered into the DOM.
                        after: function() {
                            var tableConfig = {
                                sPaginationType: 'full_numbers',
                                iDisplayLength: 10,
                                columnDefs: [
                                    { width: '80%', targets: 0 },
                                    { width: '20%', targets: 1 },
                                    {
                                        render: function(data, type, row) {
                                            return numeral(data).format('0,0');
                                        },
                                        targets: 1
                                    },
                                    { class: 'text-right', targets: 1 }
                                ],
                                initComplete: function(settings) {
                                    var api = this.api();
                                    var rowCount = api.data().length;
                                    var pageSize = api.page.len();
                                    var wrapper = api.settings()[0].nTableWrapper;
                                    if (rowCount <= pageSize) {
                                        $(wrapper).find('.dataTables_length').hide();
                                        $(wrapper).find('.dataTables_filter').hide();
                                        $(wrapper).find('.dataTables_paginate').hide();
                                        $(wrapper).find('.dataTables_info').hide();
                                    }
                                },
                                oLanguage: {
                                    sSearch: 'Search contig:',
                                    sEmptyTable: 'No contigs found.'
                                }
                            };
                            $('#' + tabId + ' .tab-content [data-name="contigs"] table').dataTable(tableConfig);
                        }
                    }
                }
            }
        });
    }

    return {
        make: function(config) {
            return factory(config);
        }
    };
});