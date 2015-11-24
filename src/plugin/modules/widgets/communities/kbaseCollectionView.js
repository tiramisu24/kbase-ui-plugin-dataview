/*global
 define
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
    'kb_service_workspace',
    'kb/common/html',
    // no parameters
    'datatables_bootstrap',
    'kb_widgetBases_kbAuthenticatedWidget'
],
    function ($, Workspace, html) {
        'use strict';
        $.KBWidget({
            name: 'CollectionView',
            parent: 'kbaseAuthenticatedWidget',
            version: '1.0.0',
            options: {
                id: null,
                ws: null
            },
            init: function (options) {
                var div = html.tag('div'),
                    titleId = html.genId(),
                    bodyId = html.genId();
                this._super(options);
                this.$elem.html(html.makePanel({
                    title: div({id: titleId}),
                    content: div({id: bodyId})
                }));
                this.$title = $('#' + titleId);
                this.$body = $('#' + bodyId);
                return this;
            },
            showError: function (error) {
                var message;
                try {
                    if (typeof error === 'string') {
                        message = error;
                    } else {
                        if (error.error) {
                            message = error.error.message;
                        } else if (error.message) {
                            message = error.message;
                        } else {
                            message = 'Unknown error: ' + error;
                        }
                    }
                } catch (ex) {
                    message = 'Unknown error processing another error: ' + ex;
                }
                this.$title.html('Error');
                this.$body.html(message);
            },
            render: function () {
                var self = this;
                if (!this.runtime.service('session').getAuthToken()) {
                    this.showError('You are not logged in');
                    return;
                }
                this.$title.html('Metagenome Collection');
                this.$body.html(html.loading('loading data...'));

                var workspace = new Workspace(this.runtime.config('services.workspace.url'), {token: this.token}),
                    title;
                workspace.get_objects([{ref: self.options.ws + '/' + self.options.id}])
                    .then(function (data) {
                        if (data.length === 0) {
                            throw new Error('Object ' + self.options.id + ' does not exist in workspace ' + self.options.ws);
                        }
                        /* TODO: resolve this issue 
                         * Some objects have an "actual" URL - surprise! */
                        var collectionObject = data[0].data,
                            idList = collectionObject.members.map(function (member) {
                                if (member.URL.match(/^http/)) {
                                    console.log('ERROR');
                                    console.log(member);
                                    throw new Error('Invalid Collection Object');
                                }
                                return {ref: member.URL};
                            });
                        title = collectionObject.name;
                        if (idList.length > 0) {
                            return workspace.get_objects(idList);
                        }
                        throw new Error('Collection is empty');
                    })
                    .then(function (resData) {
                        var rows = resData.map(function (item) {
                            return [
                                item.data.id,
                                item.data.name,
                                item.data.mixs.project_name,
                                item.data.mixs.PI_lastname,
                                item.data.mixs.biome,
                                item.data.mixs.sequence_type,
                                item.data.mixs.seq_method,
                                item.data.statistics.sequence_stats.bp_count_raw,
                                item.data.created
                            ];
                        }),
                            options = {
                                columns: ['ID', 'Name', 'Project', 'PI', 'Biome', 'Sequence Type', 'Sequencing Method', 'bp Count', 'Created'],
                                rows: rows,
                                classes: ['table', 'table-striped']
                            },
                        table = html.makeTable(options);
                        self.$title.html('Metagenome Collection ' + title);
                        self.$body.html(table);
                        $('#' + options.generated.id).dataTable();
                    })
                    .catch(function (err) {
                        self.showError(err);
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
