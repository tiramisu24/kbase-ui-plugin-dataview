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
    'kb/service/client/workspace',
    'plugins/dataview/modules/widgets/modeling/modelSeedPathway',
    'kb/widget/legacy/widget',
    'kb/widget/legacy/tabs'
], function ($, Promise, Workspace, ModelSeedPathway) {
    'use strict';
    $.KBWidget({
        name: "kbasePathways",
        version: "1.0.0",
        init: function (options) {
            var self = this;
            var imageWorkspace = 'nconrad:kegg',
                mapWorkspace = 'nconrad:pathwaysjson',
                container = this.$elem;
            var models = options.models,
                fbas = options.fbas;
            // add tabs
            var selectionTable = $('<table cellpadding="0" cellspacing="0" border="0" ' +
                'class="table table-bordered table-striped">');
            var tabs = container.kbTabs({tabs: [
                    {name: 'Selection', content: selectionTable, active: true}
                ]});
            this.runtime = options.runtime;
            this.workspaceClient = new Workspace(this.runtime.config('services.workspace.url'), {
                token: this.runtime.service('session').getAuthToken()
            });
            this.load_map_list = function () {
                // load table for maps
                container.loading();
                return self.workspaceClient.list_objects({
                    workspaces: [mapWorkspace],
                    includeMetadata: 1
                })
                    .then(function (data) {
                        container.rmLoading();
                        var tableSettings = {
                            "aaData": data,
                            "fnDrawCallback": events,
                            "aaSorting": [[1, "asc"]],
                            "aoColumns": [
                                {sTitle: 'Name', mData: function (data) {
                                        return '<a class="pathway-link" data-map_id="' + data[1] + '">' + data[10].name + '</a>';
                                    }},
                                {sTitle: 'Map ID', mData: 1},
                                {sTitle: 'Rxn Count', sWidth: '10%', mData: function (data) {
                                        if ('reaction_ids' in data[10]) {
                                            return data[10].reaction_ids.split(',').length;
                                        } else {
                                            return 'N/A';
                                        }
                                    }},
                                {sTitle: 'Cpd Count', sWidth: '10%', mData: function (data) {
                                        if ('compound_ids' in data[10]) {
                                            return data[10].compound_ids.split(',').length;
                                        } else {
                                            return 'N/A';
                                        }
                                    }},
                                {sTitle: "Source", "sWidth": "10%", mData: function (data) {
                                        return "KEGG";
                                    }}
                            ],
                            "oLanguage": {
                                "sEmptyTable": "No objects in workspace",
                                "sSearch": "Search:"
                            }
                        };

                        selectionTable.dataTable(tableSettings);
                        return true;
                    })
                    .catch(function (err) {
                        console.error(err);
                        container.prepend('<div class="alert alert-danger">' +
                            err.error.message + '</div>');
                        return false;
                    });
            };

            
            function events() {
                // event for clicking on pathway link
                container.find('.pathway-link').unbind('click');
                container.find('.pathway-link').click(function () {
                    var map_id = $(this).data('map_id'),
                        name = $(this).text(),
                        elemID = map_id + '-' + self.uuid(),
                        container = $('<div id="path-container-' + elemID + '" style="position:relative;">');
                    container.loading();
                    tabs.addTab({name: name, removable: true, content: container});
                    load_map(map_id, container, elemID);
                    tabs.showTab(name);
                });
                // tooltip for hover on pathway name
                container.find('.pathway-link')
                    .tooltip({title: 'Open path tab',
                        placement: 'right',
                        delay: {show: 1000}});
            } // end events


            function load_map(map, container, elemID) {
                Promise.all([
                    self.workspaceClient.get_objects([{workspace: imageWorkspace, name: map + '.png'}]),
                    self.workspaceClient.get_objects([{workspace: mapWorkspace, name: map}])
                ])
                    .spread(function (imgRes, mapRes) {
                        var image = imgRes[0].data.id,
                            mapData = mapRes[0].data;
                        // no need to decode...
                        container.append('<img src="data:image/png;base64,' + image + '" style="display: inline-block;">');
                        container.append('<div id="pathway-' + elemID + '" style="position:absolute; top:0;">');
                        container.rmLoading();
                        var modelSeedPathway = new ModelSeedPathway({
                            elem: 'pathway-' + elemID,
                            usingImage: true,
                            mapData: mapData,
                            models: models,
                            fbas: fbas,
                            runtime: self.runtime
                        });
                        modelSeedPathway.render();
                        return null;
                    })
                    .catch(function (err) {
                        console.error('Error loading map');
                        console.error(err);
                    });
            }

            this.load_map_list();
            return this;
        }  //end init

    });
});